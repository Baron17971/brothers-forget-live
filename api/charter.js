import { getCache } from '@vercel/functions';
import crypto from 'node:crypto';

const TTL=36000;
const NS='brothers-forget-live-v1';
const MAX_GROUPS=8;
const cache=()=>getCache(undefined,NS);
const roomKey=code=>`r:${code}`;
const groupKey=(code,n)=>`g:${code}:${n}`;
const charterKey=code=>`a:${code}`;
const clean=(v,max=180)=>typeof v==='string'?v.replace(/[<>]/g,'').replace(/\s+/g,' ').trim().slice(0,max):'';
function sameToken(a,b){if(!a||!b)return false;const aa=Buffer.from(String(a)),bb=Buffer.from(String(b));return aa.length===bb.length&&crypto.timingSafeEqual(aa,bb);}
async function readBody(req){if(req.body&&typeof req.body==='object')return req.body;const chunks=[];for await(const ch of req)chunks.push(ch);try{return JSON.parse(Buffer.concat(chunks).toString());}catch{return {};}}
async function getGroups(code){const all=await Promise.all(Array.from({length:MAX_GROUPS},(_,i)=>cache().get(groupKey(code,i+1))));return all.filter(Boolean).map(({groupToken,...x})=>x);}
function publicRule(g){return{groupNum:g.groupNum,conflictLabel:g.conflictLabel,rule:g.rule};}

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  try{
    const body=req.method==='POST'?await readBody(req):{};
    const code=clean(req.method==='POST'?body.code:req.query?.code,10);
    const teacherToken=clean(req.method==='POST'?body.teacherToken:req.query?.teacherToken,120);
    if(!code)return res.status(400).json({error:'missing_code'});
    const room=await cache().get(roomKey(code));
    if(!room)return res.status(404).json({error:'room_not_found'});
    if(!sameToken(teacherToken,room.teacherToken))return res.status(403).json({error:'teacher_auth_failed'});
    const groups=await getGroups(code);
    const availableRules=groups.filter(g=>clean(g.rule)).map(publicRule);
    const saved=await cache().get(charterKey(code))||{selectedGroupNums:[]};
    const selectedSet=new Set(Array.isArray(saved.selectedGroupNums)?saved.selectedGroupNums:[]);
    const selectedRules=availableRules.filter(r=>selectedSet.has(r.groupNum));
    if(req.method==='GET')return res.json({availableRules,selectedRules});
    if(req.method!=='POST')return res.status(405).json({error:'method'});
    const action=clean(body.action,30);
    if(action==='reset'){
      await cache().delete(charterKey(code));
      return res.json({ok:true,availableRules,selectedRules:[]});
    }
    if(action!=='save')return res.status(400).json({error:'action'});
    const raw=Array.isArray(body.selectedGroupNums)?body.selectedGroupNums:[];
    const unique=[...new Set(raw.map(Number).filter(n=>Number.isInteger(n)&&n>=1&&n<=MAX_GROUPS))];
    const allowed=new Set(availableRules.map(r=>r.groupNum));
    const selected=unique.filter(n=>allowed.has(n));
    if(selected.length!==5)return res.status(400).json({error:'choose_five'});
    await cache().set(charterKey(code),{selectedGroupNums:selected,updatedAt:Date.now()},{ttl:TTL});
    const picked=availableRules.filter(r=>selected.includes(r.groupNum));
    return res.json({ok:true,availableRules,selectedRules:picked});
  }catch(error){console.error(error);return res.status(500).json({error:'server_error'});}
}

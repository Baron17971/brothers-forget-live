import { getCache } from '@vercel/functions';
import crypto from 'node:crypto';

const TTL=2592000;
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
async function touchRoom(room){const now=Date.now();room.updatedAt=now;room.lastActiveAt=now;await cache().set(roomKey(room.code),room,{ttl:TTL});}

function hydrateSelected(saved,availableRules){
  const byGroup=new Map(availableRules.map(r=>[r.groupNum,r]));
  if(Array.isArray(saved?.selectedRules)){
    return saved.selectedRules.map(item=>{
      const n=Number(item?.groupNum);
      const base=byGroup.get(n);
      if(!base)return null;
      const edited=clean(item?.rule,180)||clean(base.rule,180);
      return {...base,rule:edited};
    }).filter(Boolean);
  }
  const selectedSet=new Set(Array.isArray(saved?.selectedGroupNums)?saved.selectedGroupNums.map(Number):[]);
  return availableRules.filter(r=>selectedSet.has(r.groupNum));
}

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
    const saved=await cache().get(charterKey(code))||{};
    const selectedRules=hydrateSelected(saved,availableRules);
    if(req.method==='GET')return res.json({availableRules,selectedRules});
    if(req.method!=='POST')return res.status(405).json({error:'method'});
    const action=clean(body.action,30);
    if(action==='reset'){
      await cache().delete(charterKey(code));await touchRoom(room);
      return res.json({ok:true,availableRules,selectedRules:[]});
    }
    if(action!=='save')return res.status(400).json({error:'action'});

    const allowed=new Map(availableRules.map(r=>[r.groupNum,r]));
    let picked=[];
    if(Array.isArray(body.selectedRules)){
      const seen=new Set();
      for(const item of body.selectedRules){
        const groupNum=Number(item?.groupNum);
        if(!Number.isInteger(groupNum)||groupNum<1||groupNum>MAX_GROUPS||seen.has(groupNum)||!allowed.has(groupNum))continue;
        const rule=clean(item?.rule,180);
        if(!rule)continue;
        seen.add(groupNum);
        const base=allowed.get(groupNum);
        picked.push({...base,rule});
      }
    }else{
      const raw=Array.isArray(body.selectedGroupNums)?body.selectedGroupNums:[];
      const unique=[...new Set(raw.map(Number).filter(n=>Number.isInteger(n)&&n>=1&&n<=MAX_GROUPS))];
      picked=unique.filter(n=>allowed.has(n)).map(n=>allowed.get(n));
    }

    if(picked.length!==5)return res.status(400).json({error:'choose_five'});
    await cache().set(charterKey(code),{selectedRules:picked.map(r=>({groupNum:r.groupNum,rule:r.rule})),updatedAt:Date.now()},{ttl:TTL});
    await touchRoom(room);
    return res.json({ok:true,availableRules,selectedRules:picked});
  }catch(error){console.error(error);return res.status(500).json({error:'server_error'});}
}

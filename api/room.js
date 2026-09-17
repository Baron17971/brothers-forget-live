import { getCache } from '@vercel/functions';
import crypto from 'node:crypto';

const TTL=2592000;
const NS='brothers-forget-live-v1';
const SHARDS=24;
const MAX_GROUPS=8;
const CONFLICTS={
  giva:['פילגש בגבעה ומלחמת בנימין','⚔'],
  split:['פילוג הממלכה – רחבעם וירבעם','♔'],
  hasmonean:['המאבק החשמונאי הפנימי','⚖'],
  'second-temple':['חורבן בית שני – קמצא ובר קמצא והמאבקים בירושלים','⌂'],
  altalena:['אלטלנה','⚓'],
  lebanon:['מלחמת לבנון הראשונה','◇'],
  rabin:['רצח רבין','✦'],
  disengagement:['ההתנתקות מגוש קטיף','↔']
};
const cache=()=>getCache(undefined,NS);
const roomKey=code=>`r:${code}`;
const groupKey=(code,n)=>`g:${code}:${n}`;
const cloudShard=(code,n)=>`c:${code}:${n}`;
const clean=(v,max=180)=>typeof v==='string'?v.replace(/[<>]/g,'').replace(/\s+/g,' ').trim().slice(0,max):'';
const newCode=()=>String(crypto.randomInt(100000,1000000));
function hash(value){let r=2166136261;for(const c of value){r^=c.charCodeAt(0);r=Math.imul(r,16777619);}return r>>>0;}
function sameToken(a,b){if(!a||!b)return false;const aa=Buffer.from(String(a)),bb=Buffer.from(String(b));return aa.length===bb.length&&crypto.timingSafeEqual(aa,bb);}
async function readBody(req){if(req.body&&typeof req.body==='object')return req.body;const chunks=[];for await(const ch of req)chunks.push(ch);try{return JSON.parse(Buffer.concat(chunks).toString());}catch{return {};}}
function publicRoom(room){return{code:room.code,className:room.className,activeStage:room.activeStage,status:room.status,resultsVisible:room.resultsVisible,version:room.version,lastActiveAt:room.lastActiveAt||room.updatedAt||room.createdAt};}
async function getRoom(code){return cache().get(roomKey(code));}
async function saveRoom(room){await cache().set(roomKey(room.code),room,{ttl:TTL});}
async function touchRoom(room,bump=false){const now=Date.now();room.updatedAt=now;room.lastActiveAt=now;if(bump)room.version+=1;await saveRoom(room);}
async function groups(code){const all=await Promise.all(Array.from({length:MAX_GROUPS},(_,i)=>cache().get(groupKey(code,i+1))));return all.filter(Boolean).map(({groupToken,...x})=>x);}
function normalizeWords(words){if(!Array.isArray(words))return[];const out=[];for(const raw of words){const w=clean(raw,30);if(w&&!out.some(x=>x.toLocaleLowerCase('he')===w.toLocaleLowerCase('he')))out.push(w);if(out.length===3)break;}return out;}
async function myWords(code,voterId){if(!voterId)return[];const bucket=await cache().get(cloudShard(code,hash(voterId)%SHARDS))||{};return Array.isArray(bucket[voterId])?bucket[voterId]:[];}
async function cloud(code){const buckets=await Promise.all(Array.from({length:SHARDS},(_,i)=>cache().get(cloudShard(code,i))));const counts=new Map();for(const bucket of buckets){if(!bucket)continue;for(const list of Object.values(bucket)){if(!Array.isArray(list))continue;for(const raw of list){const w=clean(raw,30);if(!w)continue;const key=w.toLocaleLowerCase('he');const cur=counts.get(key)||{word:w,count:0};cur.count+=1;counts.set(key,cur);}}}return Array.from(counts.values()).sort((a,b)=>b.count-a.count||a.word.localeCompare(b.word,'he'));}
async function resetStage(room){if(room.activeStage===1){await Promise.all(Array.from({length:MAX_GROUPS},(_,i)=>cache().delete(groupKey(room.code,i+1))));}else{await Promise.all(Array.from({length:SHARDS},(_,i)=>cache().delete(cloudShard(room.code,i))));}}
export default async function handler(req,res){res.setHeader('Cache-Control','no-store');try{
 if(req.method==='GET'){
  const code=clean(req.query?.code,10);if(!code)return res.status(400).json({error:'missing_code'});
  const room=await getRoom(code);if(!room)return res.status(404).json({error:'room_not_found'});
  const teacher=sameToken(clean(req.query?.teacherToken,120),room.teacherToken);
  const voterId=clean(req.query?.voterId,140);
  const data={...publicRoom(room),teacher};
  if(teacher){data.groups=await groups(code);data.cloud=await cloud(code);}else if(room.activeStage===2){data.myWords=await myWords(code,voterId);data.cloud=room.resultsVisible?await cloud(code):[];}
  return res.json(data);
 }
 if(req.method!=='POST')return res.status(405).json({error:'method'});
 const body=await readBody(req);const action=clean(body.action,30);
 if(action==='create'){
  let code='';for(let i=0;i<8;i+=1){const c=newCode();if(!await getRoom(c)){code=c;break;}}if(!code)return res.status(503).json({error:'code'});
  const now=Date.now();const room={code,teacherToken:crypto.randomBytes(24).toString('hex'),className:clean(body.className,60),activeStage:1,status:'closed',resultsVisible:false,version:1,createdAt:now,updatedAt:now,lastActiveAt:now};await saveRoom(room);return res.status(201).json({...publicRoom(room),teacherToken:room.teacherToken,groups:[],cloud:[]});
 }
 const code=clean(body.code,10);const room=await getRoom(code);if(!room)return res.status(404).json({error:'room_not_found'});
 if(action==='groupSubmit'){
  if(room.activeStage!==1||room.status!=='open')return res.status(409).json({error:'stage_closed'});
  const groupNum=Number(body.groupNum);const conflictId=clean(body.conflictId,40);const groupToken=clean(body.groupToken,140);const background=clean(body.background,180),result=clean(body.result,180),rule=clean(body.rule,180);
  if(!Number.isInteger(groupNum)||groupNum<1||groupNum>MAX_GROUPS||!CONFLICTS[conflictId]||!groupToken||!background||!result||!rule)return res.status(400).json({error:'bad_group'});
  const key=groupKey(code,groupNum);const existing=await cache().get(key);if(existing&&existing.groupToken!==groupToken)return res.status(409).json({error:'group_taken'});
  const [label,icon]=CONFLICTS[conflictId];await cache().set(key,{groupNum,conflictId,conflictLabel:label,icon,background,result,rule,groupToken,updatedAt:Date.now()},{ttl:TTL});await touchRoom(room,false);return res.json({ok:true});
 }
 if(action==='cloudSubmit'){
  if(room.activeStage!==2||room.status!=='open')return res.status(409).json({error:'stage_closed'});
  const voterId=clean(body.voterId,140);const words=normalizeWords(body.words);if(!voterId||!words.length)return res.status(400).json({error:'bad_words'});
  const key=cloudShard(code,hash(voterId)%SHARDS);for(let attempt=0;attempt<5;attempt+=1){const current=await cache().get(key)||{};await cache().set(key,{...current,[voterId]:words},{ttl:TTL});const verify=await cache().get(key)||{};if(Array.isArray(verify[voterId])){await touchRoom(room,false);return res.json({ok:true,myWords:words});}await new Promise(r=>setTimeout(r,30+attempt*20));}return res.status(409).json({error:'retry'});
 }
 if(!sameToken(clean(body.teacherToken,120),room.teacherToken))return res.status(403).json({error:'teacher_auth_failed'});
 if(action==='setStage'){
  const stage=Number(body.stage);if(!Number.isInteger(stage)||stage<1||stage>2)return res.status(400).json({error:'bad_stage'});room.activeStage=stage;room.status='closed';room.resultsVisible=false;
 }else if(action==='setStatus'){
  room.status=body.status==='open'?'open':'closed';
 }else if(action==='setVisibility'){
  room.resultsVisible=Boolean(body.resultsVisible);
 }else if(action==='resetGroup'){
  const n=Number(body.groupNum);if(!Number.isInteger(n)||n<1||n>MAX_GROUPS)return res.status(400).json({error:'bad_group'});await cache().delete(groupKey(code,n));
 }else if(action==='resetStage'){
  await resetStage(room);
 }else return res.status(400).json({error:'action'});
 await touchRoom(room,true);return res.json({...publicRoom(room),groups:await groups(code),cloud:await cloud(code),teacher:true});
}catch(error){console.error(error);return res.status(500).json({error:'server_error'});}}

import { getCache } from '@vercel/functions';
import crypto from 'node:crypto';

const TTL=36000;
const NS='brothers-forget-live-v1';
const SHARDS=12;
const CONFLICTS={
  giva:{label:'פילגש בגבעה ומלחמת בנימין',image:'/01-giva-benjamin.png'},
  split:{label:'פילוג הממלכה – רחבעם וירבעם',image:'/02-split-kingdom.png'},
  hasmonean:{label:'המאבק החשמונאי הפנימי',image:'/03-hasmonean-conflict.png'},
  'second-temple':{label:'חורבן בית שני – קמצא ובר קמצא והמאבקים בירושלים',image:'/04-second-temple.png'},
  altalena:{label:'אלטלנה',image:'/05-altalena.png'},
  lebanon:{label:'מלחמת לבנון הראשונה',image:'/06-first-lebanon-war.png'},
  rabin:{label:'רצח רבין',image:'/07-rabin-assassination.png'},
  disengagement:{label:'ההתנתקות מגוש קטיף',image:'/08-disengagement.png'}
};
const ORDER=Object.keys(CONFLICTS);
const cache=()=>getCache(undefined,NS);
const roomKey=code=>`r:${code}`;
const stateKey=code=>`thermo:${code}:state`;
const voteKey=(code,conflictId,shard)=>`thermo:${code}:${conflictId}:${shard}`;
const clean=(v,max=160)=>typeof v==='string'?v.replace(/[<>]/g,'').replace(/\s+/g,' ').trim().slice(0,max):'';
function sameToken(a,b){if(!a||!b)return false;const aa=Buffer.from(String(a)),bb=Buffer.from(String(b));return aa.length===bb.length&&crypto.timingSafeEqual(aa,bb);}
function hash(value){let r=2166136261;for(const c of value){r^=c.charCodeAt(0);r=Math.imul(r,16777619);}return r>>>0;}
async function readBody(req){if(req.body&&typeof req.body==='object')return req.body;const chunks=[];for await(const ch of req)chunks.push(ch);try{return JSON.parse(Buffer.concat(chunks).toString());}catch{return {};}}
async function room(code){return cache().get(roomKey(code));}
async function state(code){return await cache().get(stateKey(code))||{conflictId:'giva',status:'closed',resultsVisible:false,version:1};}
async function saveState(code,s){await cache().set(stateKey(code),s,{ttl:TTL});}
async function getVote(code,conflictId,voterId){if(!voterId)return null;const b=await cache().get(voteKey(code,conflictId,hash(voterId)%SHARDS))||{};const v=Number(b[voterId]);return Number.isInteger(v)&&v>=1&&v<=10?v:null;}
async function stats(code,conflictId){const buckets=await Promise.all(Array.from({length:SHARDS},(_,i)=>cache().get(voteKey(code,conflictId,i))));const counts=Array(10).fill(0);for(const b of buckets){if(!b)continue;for(const raw of Object.values(b)){const v=Number(raw);if(Number.isInteger(v)&&v>=1&&v<=10)counts[v-1]+=1;}}const total=counts.reduce((a,b)=>a+b,0);const sum=counts.reduce((a,c,i)=>a+c*(i+1),0);return{counts,total,average:total?Math.round((sum/total)*10)/10:null};}
async function summary(code){const rows=[];for(const conflictId of ORDER){const s=await stats(code,conflictId);rows.push({conflictId,...CONFLICTS[conflictId],...s});}return rows;}
async function resetConflict(code,conflictId){await Promise.all(Array.from({length:SHARDS},(_,i)=>cache().delete(voteKey(code,conflictId,i))));}

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  try{
    if(req.method==='GET'){
      const code=clean(req.query?.code,10);if(!code)return res.status(400).json({error:'missing_code'});
      const r=await room(code);if(!r)return res.status(404).json({error:'room_not_found'});
      const teacher=sameToken(clean(req.query?.teacherToken,120),r.teacherToken);
      const voterId=clean(req.query?.voterId,140);
      const s=await state(code);const conflict=CONFLICTS[s.conflictId]||CONFLICTS.giva;
      const out={teacher,conflictId:s.conflictId,status:s.status,resultsVisible:s.resultsVisible,version:s.version,conflict,question:'עד כמה לדעתכם המחלוקת הזו סיכנה את הבית המשותף?',scale:{min:1,max:10,minLabel:'כמעט לא סיכנה',maxLabel:'סיכנה מאוד'}};
      out.myVote=await getVote(code,s.conflictId,voterId);
      if(teacher||s.resultsVisible)out.stats=await stats(code,s.conflictId);
      if(teacher)out.summary=await summary(code);
      return res.json(out);
    }
    if(req.method!=='POST')return res.status(405).json({error:'method'});
    const body=await readBody(req);const action=clean(body.action,30);const code=clean(body.code,10);const r=await room(code);if(!r)return res.status(404).json({error:'room_not_found'});
    let s=await state(code);
    if(action==='vote'){
      if(r.activeStage!==1||s.status!=='open')return res.status(409).json({error:'closed'});
      const voterId=clean(body.voterId,140),value=Number(body.value);if(!voterId||!Number.isInteger(value)||value<1||value>10)return res.status(400).json({error:'bad_vote'});
      const key=voteKey(code,s.conflictId,hash(voterId)%SHARDS);
      for(let attempt=0;attempt<5;attempt+=1){const current=await cache().get(key)||{};await cache().set(key,{...current,[voterId]:value},{ttl:TTL});const verify=await cache().get(key)||{};if(Number(verify[voterId])===value)return res.json({ok:true,value});await new Promise(r=>setTimeout(r,30+attempt*20));}
      return res.status(409).json({error:'retry'});
    }
    if(!sameToken(clean(body.teacherToken,120),r.teacherToken))return res.status(403).json({error:'teacher_auth_failed'});
    const touch=()=>{s.version=(s.version||0)+1;};
    if(action==='select'){
      const conflictId=clean(body.conflictId,40);if(!CONFLICTS[conflictId])return res.status(400).json({error:'bad_conflict'});s.conflictId=conflictId;s.status='closed';s.resultsVisible=false;touch();
    }else if(action==='setStatus'){
      s.status=body.status==='open'?'open':'closed';touch();
    }else if(action==='setVisibility'){
      s.resultsVisible=Boolean(body.resultsVisible);touch();
    }else if(action==='resetConflict'){
      await resetConflict(code,s.conflictId);s.resultsVisible=false;touch();
    }else if(action==='resetAll'){
      for(const id of ORDER)await resetConflict(code,id);s={conflictId:'giva',status:'closed',resultsVisible:false,version:(s.version||0)+1};
    }else return res.status(400).json({error:'action'});
    await saveState(code,s);return res.json({ok:true,...s,stats:await stats(code,s.conflictId),summary:await summary(code)});
  }catch(error){console.error(error);return res.status(500).json({error:'server_error'});}
}

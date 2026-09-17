import { getCache } from '@vercel/functions';
import crypto from 'node:crypto';

const ROOM_TTL=2592000;
const LOCK_TTL=300;
const NS='brothers-forget-live-v1';
const cache=()=>getCache(undefined,NS);
const roomKey=code=>`r:${code}`;
const failKey=code=>`access-fail:${code}`;
const clean=(v,max=160)=>typeof v==='string'?v.replace(/[<>]/g,'').replace(/\s+/g,' ').trim().slice(0,max):'';
const newCode=()=>String(crypto.randomInt(100000,1000000));
function sameToken(a,b){if(!a||!b)return false;const aa=Buffer.from(String(a)),bb=Buffer.from(String(b));return aa.length===bb.length&&crypto.timingSafeEqual(aa,bb);}
function validPin(pin){return /^\d{4,6}$/.test(pin);}
function makePin(pin){const salt=crypto.randomBytes(16).toString('hex');const hash=crypto.scryptSync(pin,salt,32).toString('hex');return{salt,hash};}
function verifyPin(pin,room){if(!room.pinSalt||!room.pinHash)return false;const actual=crypto.scryptSync(pin,room.pinSalt,32);const expected=Buffer.from(room.pinHash,'hex');return actual.length===expected.length&&crypto.timingSafeEqual(actual,expected);}
async function readBody(req){if(req.body&&typeof req.body==='object')return req.body;const chunks=[];for await(const ch of req)chunks.push(ch);try{return JSON.parse(Buffer.concat(chunks).toString());}catch{return {};}}
async function saveRoom(room){await cache().set(roomKey(room.code),room,{ttl:ROOM_TTL});}
function publicRoom(room){return{code:room.code,className:room.className||'',activeStage:room.activeStage,status:room.status,resultsVisible:room.resultsVisible,version:room.version,lastActiveAt:room.lastActiveAt||room.updatedAt||room.createdAt};}
async function migrateArtifacts(code){
  const keys=[];
  for(let i=1;i<=8;i++)keys.push(`g:${code}:${i}`);
  for(let i=0;i<24;i++)keys.push(`c:${code}:${i}`);
  keys.push(`a:${code}`,`thermo:${code}:state`);
  for(const id of ['giva','split','hasmonean','second-temple','altalena','lebanon','rabin','disengagement'])for(let i=0;i<12;i++)keys.push(`thermo:${code}:${id}:${i}`);
  const values=await Promise.all(keys.map(k=>cache().get(k)));
  await Promise.all(keys.map((k,i)=>values[i]==null?Promise.resolve():cache().set(k,values[i],{ttl:ROOM_TTL})));
}
async function ensurePersistent(room){if((room.persistenceVersion||0)>=2)return;await migrateArtifacts(room.code);room.persistenceVersion=2;}

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  try{
    if(req.method!=='POST')return res.status(405).json({error:'method'});
    const body=await readBody(req);const action=clean(body.action,30);
    if(action==='create'){
      const pin=clean(body.pin,12);if(!validPin(pin))return res.status(400).json({error:'bad_pin'});
      let code='';for(let i=0;i<10;i+=1){const c=newCode();if(!await cache().get(roomKey(c))){code=c;break;}}
      if(!code)return res.status(503).json({error:'code'});
      const now=Date.now(),p=makePin(pin);
      const room={code,teacherToken:crypto.randomBytes(24).toString('hex'),className:clean(body.className,60),activeStage:1,status:'closed',resultsVisible:false,version:1,createdAt:now,updatedAt:now,lastActiveAt:now,pinSalt:p.salt,pinHash:p.hash,pinVersion:1,persistenceVersion:2};
      await saveRoom(room);
      return res.status(201).json({...publicRoom(room),teacherToken:room.teacherToken});
    }
    const code=clean(body.code,10);if(!/^\d{6}$/.test(code))return res.status(400).json({error:'bad_code'});
    const room=await cache().get(roomKey(code));if(!room)return res.status(404).json({error:'room_not_found'});
    if(action==='resume'){
      const pin=clean(body.pin,12);if(!validPin(pin))return res.status(400).json({error:'bad_pin'});
      if(!room.pinHash)return res.status(409).json({error:'pin_not_set'});
      const failed=await cache().get(failKey(code))||{count:0};if((failed.count||0)>=8)return res.status(429).json({error:'too_many_attempts'});
      if(!verifyPin(pin,room)){
        await cache().set(failKey(code),{count:(failed.count||0)+1,updatedAt:Date.now()},{ttl:LOCK_TTL});
        return res.status(403).json({error:'invalid_credentials'});
      }
      await cache().delete(failKey(code));await ensurePersistent(room);room.lastActiveAt=Date.now();room.updatedAt=room.lastActiveAt;await saveRoom(room);
      return res.json({...publicRoom(room),teacherToken:room.teacherToken});
    }
    if(action==='setPin'){
      if(!sameToken(clean(body.teacherToken,120),room.teacherToken))return res.status(403).json({error:'teacher_auth_failed'});
      const pin=clean(body.pin,12);if(!validPin(pin))return res.status(400).json({error:'bad_pin'});
      await ensurePersistent(room);const p=makePin(pin);room.pinSalt=p.salt;room.pinHash=p.hash;room.pinVersion=(room.pinVersion||0)+1;room.lastActiveAt=Date.now();room.updatedAt=room.lastActiveAt;await saveRoom(room);
      return res.json({ok:true,pinConfigured:true,lastActiveAt:room.lastActiveAt});
    }
    if(action==='touch'){
      if(!sameToken(clean(body.teacherToken,120),room.teacherToken))return res.status(403).json({error:'teacher_auth_failed'});
      await ensurePersistent(room);room.lastActiveAt=Date.now();room.updatedAt=room.lastActiveAt;await saveRoom(room);return res.json({ok:true,lastActiveAt:room.lastActiveAt});
    }
    return res.status(400).json({error:'action'});
  }catch(error){console.error(error);return res.status(500).json({error:'server_error'});}
}

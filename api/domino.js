import { getCache } from '@vercel/functions';
import crypto from 'node:crypto';
const TTL=2592000, NS='brothers-forget-live-v1', SHARDS=16;
const cache=()=>getCache(undefined,NS);
const roomKey=c=>'r:'+c, gameKey=c=>'d:'+c, rosterKey=(c,n)=>'dr:'+c+':'+n;
const clean=(v,max=80)=>typeof v==='string'?v.replace(/[<>]/g,'').replace(/\s+/g,' ').trim().slice(0,max):'';
function hash(value){let r=2166136261;for(const c of value){r^=c.charCodeAt(0);r=Math.imul(r,16777619);}return r>>>0;}
function sameToken(a,b){if(!a||!b)return false;const aa=Buffer.from(String(a)),bb=Buffer.from(String(b));return aa.length===bb.length&&crypto.timingSafeEqual(aa,bb);}
async function body(req){if(req.body&&typeof req.body==='object')return req.body;const chunks=[];for await(const c of req)chunks.push(c);try{return JSON.parse(Buffer.concat(chunks).toString());}catch{return {};}}
const tiles=[
{id:1,left:'התחלה',right:'שבט שסירב להסגיר'},
{id:2,left:'שבט בנימין',right:'גבעה'},
{id:3,left:'גבעה',right:'ספר שופטים'},
{id:4,left:'ספר שופטים',right:'מלחמת בנימין'},
{id:5,left:'מלחמת בנימין',right:'רחבעם'},
{id:6,left:'רחבעם',right:'שכם'},
{id:7,left:'שכם',right:'רחבעם וירבעם'},
{id:8,left:'רחבעם וירבעם',right:'פילוג הממלכה'},
{id:9,left:'פילוג הממלכה',right:'הורקנוס ואריסטובולוס'},
{id:10,left:'הורקנוס ואריסטובולוס',right:'פומפיוס'},
{id:11,left:'פומפיוס',right:'63 לפנה״ס'},
{id:12,left:'63 לפנה״ס',right:'רומא'},
{id:13,left:'רומא',right:'בר קמצא'},
{id:14,left:'בר קמצא',right:'ירושלים'},
{id:15,left:'ירושלים',right:'70 לספירה'},
{id:16,left:'70 לספירה',right:'חורבן בית שני'},
{id:17,left:'חורבן בית שני',right:'אוניית הנשק שהגיעה לחופי המדינה הצעירה'},
{id:18,left:'אלטלנה',right:'המקום שבו הורדו מהאונייה לוחמים ונשק'},
{id:19,left:'כפר ויתקין',right:'העיר שמולה התרחשה ההתנגשות הקטלנית'},
{id:20,left:'תל אביב',right:'התאריך שבו הופגזה האונייה מול החוף'},
{id:21,left:'22 ביוני 1948',right:'ראש הממשלה שעמד על סמכות המדינה והצבא'},
{id:22,left:'דוד בן־גוריון',right:'המלחמה שהחלה ביוני 1982'},
{id:23,left:'מלחמת לבנון הראשונה',right:'המדינה שבה פעל צה״ל'},
{id:24,left:'לבנון',right:'מחנות הפליטים שבהם התרחש הטבח'},
{id:25,left:'סברה ושתילה',right:'הוועדה שחקרה'},
{id:26,left:'ועדת כהן',right:'4 בנובמבר 1995'},
{id:27,left:'4 בנובמבר 1995',right:'יצחק רבין'},
{id:28,left:'יצחק רבין',right:'יגאל עמיר'},
{id:29,left:'יגאל עמיר',right:'תוכנית ההתנתקות'},
{id:30,left:'תוכנית ההתנתקות',right:'אריאל שרון'},
{id:31,left:'אריאל שרון',right:'גוש קטיף'},
{id:32,left:'גוש קטיף',right:'סיום השרשרת'}
];
const tileBy=id=>tiles[id-1]||null;
function shuffle(a){const x=[...a];for(let i=x.length-1;i>0;i--){const j=crypto.randomInt(i+1);[x[i],x[j]]=[x[j],x[i]];}return x;}
async function room(code){return cache().get(roomKey(code));}
async function game(code){return cache().get(gameKey(code))||{phase:'lobby',version:1,chainCount:0,chain:[],assignments:{},playerOrder:[],lastPlayer:''};}
async function save(code,g){await cache().set(gameKey(code),g,{ttl:TTL});}
async function roster(code){const shards=await Promise.all(Array.from({length:SHARDS},(_,i)=>cache().get(rosterKey(code,i))));const out=[];for(const s of shards)if(s)for(const p of Object.values(s))if(p&&p.id&&p.name)out.push(p);return out.sort((a,b)=>(a.joinedAt||0)-(b.joinedAt||0));}
async function join(code,id,name){const key=rosterKey(code,hash(id)%SHARDS);for(let a=0;a<5;a++){const cur=await cache().get(key)||{};const next={...cur,[id]:{id,name,joinedAt:cur[id]?.joinedAt||Date.now()}};await cache().set(key,next,{ttl:TTL});const v=await cache().get(key)||{};if(v[id])return v[id];await new Promise(r=>setTimeout(r,25+a*20));}throw new Error('join_race');}
function publicState(g){return{phase:g.phase,version:g.version||1,chainCount:g.chainCount||0,chain:(g.chain||[]).map(tileBy).filter(Boolean),currentClue:g.chainCount?tileBy(g.chainCount)?.right:'התחלה',lastPlayer:g.lastPlayer||''};}
export default async function handler(req,res){res.setHeader('Cache-Control','no-store');try{
 const b=req.method==='POST'?await body(req):{};
 const code=clean(req.method==='GET'?req.query?.code:(b.code||''),10);
 if(!code)return res.status(400).json({error:'missing_code'});
 const r=await room(code);if(!r)return res.status(404).json({error:'room_not_found'});
 if(req.method==='GET'){
  const g=await game(code), teacher=sameToken(clean(req.query?.teacherToken,120),r.teacherToken), id=clean(req.query?.playerId,140), players=g.phase==='lobby'?await roster(code):(g.players||[]);
  const out={...publicState(g),teacher,players:players.map(p=>({id:p.id,name:p.name}))};
  if(id){const p=players.find(x=>x.id===id);out.joined=Boolean(p);out.myTile=g.assignments?.[id]?tileBy(g.assignments[id]):null;}
  return res.json(out);
 }
 if(req.method!=='POST')return res.status(405).json({error:'method'});
 const action=clean(b.action,30), g=await game(code);
 if(action==='join'){
  if(g.phase!=='lobby')return res.status(409).json({error:'game_started'});
  const id=clean(b.playerId,140),name=clean(b.name,24);if(!id||!name)return res.status(400).json({error:'bad_player'});
  await join(code,id,name);g.version=(g.version||1)+1;await save(code,g);return res.json({ok:true});
 }
 if(action==='play'){
  if(g.phase!=='playing')return res.status(409).json({error:'not_playing'});
  const id=clean(b.playerId,140),assigned=Number(g.assignments?.[id]||0),needed=(g.chainCount||0)+1;
  if(!assigned)return res.status(409).json({error:'no_tile'});
  if(assigned!==needed)return res.json({correct:false});
  const player=(g.players||[]).find(p=>p.id===id);g.chainCount=needed;g.chain=[...(g.chain||[]),needed];g.lastPlayer=player?.name||'';delete g.assignments[id];
  if(needed>=32){g.phase='complete';}
  else{
   const assignedSet=new Set(Object.values(g.assignments).map(Number));const pool=tiles.map(t=>t.id).filter(n=>n>needed&&!assignedSet.has(n));
   const next=needed+1;
   if(pool.includes(next))g.assignments[id]=next;
   else{const others=pool.filter(n=>n!==next);if(others.length)g.assignments[id]=others[crypto.randomInt(others.length)];}
  }
  g.version=(g.version||1)+1;await save(code,g);return res.json({correct:true,complete:g.phase==='complete'});
 }
 if(!sameToken(clean(b.teacherToken,120),r.teacherToken))return res.status(403).json({error:'teacher_auth_failed'});
 if(action==='start'){
  const ps=await roster(code);if(!ps.length)return res.status(409).json({error:'no_players'});
  const order=shuffle(ps).slice(0,32), ids=[1,...shuffle(tiles.slice(1).map(t=>t.id))], assignments={};order.forEach((p,i)=>assignments[p.id]=ids[i]);
  const ng={phase:'playing',version:(g.version||1)+1,chainCount:0,chain:[],assignments,players:order,playerOrder:order.map(p=>p.id),lastPlayer:''};await save(code,ng);return res.json({ok:true});
 }
 if(action==='reset'){
  const ng={phase:'lobby',version:(g.version||1)+1,chainCount:0,chain:[],assignments:{},playerOrder:[],lastPlayer:''};await save(code,ng);return res.json({ok:true});
 }
 return res.status(400).json({error:'action'});
}catch(e){console.error(e);return res.status(500).json({error:'server_error'});}}
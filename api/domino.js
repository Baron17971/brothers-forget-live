import { getCache } from '@vercel/functions';
import crypto from 'node:crypto';

const TTL=2592000, NS='brothers-forget-live-v1', SHARDS=16;
const cache=()=>getCache(undefined,NS);
const roomKey=c=>'r:'+c, gameKey=c=>'d:'+c, rosterKey=(c,n)=>'dr:'+c+':'+n;
const clean=(v,max=120)=>typeof v==='string'?v.replace(/[<>]/g,'').replace(/\s+/g,' ').trim().slice(0,max):'';

function hash(value){let r=2166136261;for(const c of value){r^=c.charCodeAt(0);r=Math.imul(r,16777619);}return r>>>0;}
function sameToken(a,b){if(!a||!b)return false;const aa=Buffer.from(String(a)),bb=Buffer.from(String(b));return aa.length===bb.length&&crypto.timingSafeEqual(aa,bb);}
async function body(req){if(req.body&&typeof req.body==='object')return req.body;const chunks=[];for await(const c of req)chunks.push(c);try{return JSON.parse(Buffer.concat(chunks).toString());}catch{return {};}}
function shuffle(a){const x=[...a];for(let i=x.length-1;i>0;i--){const j=crypto.randomInt(i+1);[x[i],x[j]]=[x[j],x[i]];}return x;}

const tiles=[
{id:1,answer:'התחלה',clue:'השבט שסירב להסגיר את אנשי הגבעה',art:'🌄'},
{id:2,answer:'שבט בנימין',clue:'העיר שבה התרחשה הפגיעה בפילגש',art:'🛡️'},
{id:3,answer:'גבעה',clue:'הספר בתנ״ך שבו מסופר האירוע',art:'🏘️'},
{id:4,answer:'ספר שופטים',clue:'המלחמה שבה כמעט הושמד אחד משבטי ישראל',art:'📜'},
{id:5,answer:'מלחמת בנימין',clue:'בנו של שלמה שסירב להקל את עול העם',art:'🛡️⚡🛡️'},
{id:6,answer:'רחבעם',clue:'העיר שבה התכנס העם לקראת המלכתו',art:'👑'},
{id:7,answer:'שכם',clue:'שני המנהיגים שניצבו משני צדי הפילוג',art:'🏰'},
{id:8,answer:'רחבעם וירבעם',clue:'האירוע שבו התפצלה הממלכה לשתיים',art:'👑⚡👑'},
{id:9,answer:'פילוג הממלכה',clue:'שני האחים החשמונאים שנאבקו על המלוכה',art:'👑💔👑'},
{id:10,answer:'הורקנוס ואריסטובולוס',clue:'המצביא הרומי שהתערב במאבק ביניהם',art:'👑👑'},
{id:11,answer:'פומפיוס',clue:'השנה שבה השתלט על ירושלים',art:'🪖🏛️'},
{id:12,answer:'63 לפנה״ס',clue:'המעצמה שניצלה את המאבק הפנימי',art:'🗿📅'},
{id:13,answer:'רומא',clue:'האיש שהושפל וסולק מסעודה',art:'🏛️'},
{id:14,answer:'בר קמצא',clue:'העיר שבה התנהלו מאבקים פנימיים בזמן המצור',art:'🪑🍷'},
{id:15,answer:'ירושלים',clue:'השנה שבה חרב בית המקדש השני',art:'🏰'},
{id:16,answer:'70 לספירה',clue:'האירוע שסיים את תקופת הבית השני',art:'🏛️💨'},
{id:17,answer:'חורבן בית שני',clue:'אוניית הנשק שהגיעה לחופי המדינה הצעירה',art:'🏛️🔥'},
{id:18,answer:'אלטלנה',clue:'המקום שבו הורדו מהאונייה לוחמים ונשק',art:'🚢'},
{id:19,answer:'כפר ויתקין',clue:'העיר שמולה התרחשה ההתנגשות הקטלנית',art:'🏘️🌊'},
{id:20,answer:'תל אביב',clue:'התאריך שבו הופגזה האונייה מול החוף',art:'🏙️🌊'},
{id:21,answer:'22 ביוני 1948',clue:'ראש הממשלה שעמד על סמכות המדינה והצבא',art:'📅'},
{id:22,answer:'דוד בן־גוריון',clue:'המלחמה שהחלה ביוני 1982',art:'👤🇮🇱'},
{id:23,answer:'מלחמת לבנון הראשונה',clue:'המדינה שבה פעל צה״ל במהלך המלחמה',art:'⛰️🪖'},
{id:24,answer:'לבנון',clue:'מחנות הפליטים שבהם התרחש הטבח בספטמבר 1982',art:'🌲⛰️'},
{id:25,answer:'סברה ושתילה',clue:'הוועדה שחקרה את אחריות ישראל לאירועים',art:'🏚️'},
{id:26,answer:'ועדת כהן',clue:'התאריך שבו נרצח ראש ממשלת ישראל',art:'⚖️📁'},
{id:27,answer:'4 בנובמבר 1995',clue:'ראש הממשלה שנרצח בתום עצרת השלום',art:'🕯️📅'},
{id:28,answer:'יצחק רבין',clue:'האדם שביצע את הרצח',art:'👤🇮🇱'},
{id:29,answer:'יגאל עמיר',clue:'התוכנית שבמסגרתה פונו יישובים בשנת 2005',art:'👤⚡'},
{id:30,answer:'תוכנית ההתנתקות',clue:'ראש הממשלה שהוביל את התוכנית',art:'📦🏠'},
{id:31,answer:'אריאל שרון',clue:'חבל ההתיישבות המרכזי שפונה מרצועת עזה',art:'👤🇮🇱'},
{id:32,answer:'גוש קטיף',clue:'סיום השרשרת',art:'🌱🏡'}
];

const tileBy=id=>tiles[id-1]||null;
async function room(code){return cache().get(roomKey(code));}
async function game(code){return (await cache().get(gameKey(code)))||{phase:'lobby',version:1,chainCount:0,chain:[],assignments:{},players:[],lastPlayer:''};}
async function save(code,g){await cache().set(gameKey(code),g,{ttl:TTL});}
async function roster(code){const shards=await Promise.all(Array.from({length:SHARDS},(_,i)=>cache().get(rosterKey(code,i))));const out=[];for(const s of shards)if(s)for(const p of Object.values(s))if(p&&p.id&&p.name)out.push(p);return out.sort((a,b)=>(a.joinedAt||0)-(b.joinedAt||0));}
async function join(code,id,name){const key=rosterKey(code,hash(id)%SHARDS);for(let a=0;a<5;a++){const cur=await cache().get(key)||{};const next={...cur,[id]:{id,name,joinedAt:cur[id]?.joinedAt||Date.now()}};await cache().set(key,next,{ttl:TTL});const v=await cache().get(key)||{};if(v[id])return v[id];await new Promise(r=>setTimeout(r,25+a*20));}throw new Error('join_race');}

function publicState(g){
 const last=g.chainCount?tileBy(g.chainCount):null;
 return {phase:g.phase,version:g.version||1,chainCount:g.chainCount||0,chain:(g.chain||[]).map(tileBy).filter(Boolean),currentClue:last?.clue||'',lastPlayer:g.lastPlayer||''};
}
function remainingIds(g){
 const used=new Set(g.chain||[]);
 const assigned=new Set(Object.values(g.assignments||{}).map(Number));
 return tiles.map(t=>t.id).filter(id=>id>1&&!used.has(id)&&!assigned.has(id));
}
function ensureNext(g,lastPlayerId){
 const next=(g.chainCount||0)+1;
 if(next>32)return;
 const values=Object.values(g.assignments||{}).map(Number);
 if(values.includes(next))return;
 const holders=Object.keys(g.assignments||{});
 if(!holders.length)return;
 const choices=holders.filter(id=>id!==lastPlayerId);
 const target=(choices.length?choices:holders)[crypto.randomInt(choices.length||holders.length)];
 g.assignments[target]=next;
}

export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 try{
  const b=req.method==='POST'?await body(req):{};
  const code=clean(req.method==='GET'?req.query?.code:(b.code||''),10);
  if(!code)return res.status(400).json({error:'missing_code'});
  const r=await room(code);if(!r)return res.status(404).json({error:'room_not_found'});

  if(req.method==='GET'){
   const g=await game(code),teacher=sameToken(clean(req.query?.teacherToken,120),r.teacherToken),id=clean(req.query?.playerId,140);
   const livePlayers=g.phase==='lobby'?await roster(code):(g.players||[]);
   const out={...publicState(g),teacher,players:livePlayers.map(p=>({id:p.id,name:p.name}))};
   if(id){const p=livePlayers.find(x=>x.id===id);out.joined=Boolean(p);out.myTile=g.assignments?.[id]?tileBy(g.assignments[id]):null;}
   return res.json(out);
  }

  if(req.method!=='POST')return res.status(405).json({error:'method'});
  const action=clean(b.action,30),g=await game(code);

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
   const player=(g.players||[]).find(p=>p.id===id);
   g.chainCount=needed;g.chain=[...(g.chain||[]),needed];g.lastPlayer=player?.name||'';
   delete g.assignments[id];

   if(needed>=32){g.phase='complete';}
   else{
    const pool=remainingIds(g);
    if(pool.length)g.assignments[id]=pool[crypto.randomInt(pool.length)];
    ensureNext(g,id);
   }
   g.version=(g.version||1)+1;await save(code,g);
   return res.json({correct:true,complete:g.phase==='complete'});
  }

  if(!sameToken(clean(b.teacherToken,120),r.teacherToken))return res.status(403).json({error:'teacher_auth_failed'});

  if(action==='start'){
   const all=await roster(code);if(!all.length)return res.status(409).json({error:'no_players'});
   const players=shuffle(all);
   const active=players.slice(0,Math.min(players.length,31));
   const rest=shuffle(tiles.slice(2).map(t=>t.id));
   const deal=[2,...rest].slice(0,active.length);
   const assignments={};active.forEach((p,i)=>assignments[p.id]=deal[i]);
   const ng={phase:'playing',version:(g.version||1)+1,chainCount:1,chain:[1],assignments,players,lastPlayer:''};
   await save(code,ng);return res.json({ok:true});
  }

  if(action==='reset'){
   const ng={phase:'lobby',version:(g.version||1)+1,chainCount:0,chain:[],assignments:{},players:[],lastPlayer:''};
   await save(code,ng);return res.json({ok:true});
  }

  return res.status(400).json({error:'action'});
 }catch(e){console.error(e);return res.status(500).json({error:'server_error'});}
}

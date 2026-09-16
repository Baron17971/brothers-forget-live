(function(){
'use strict';
const p=new URLSearchParams(location.search);
const isTeacher=location.pathname==='/teacher';
const isProjector=isTeacher&&p.get('projector')==='1';
const code=p.get('code')||'';
const token=p.get('token')||'';
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const joinUrl=()=>location.origin+'/join?code='+encodeURIComponent(code);
const projectorUrl=()=>location.origin+'/teacher?code='+encodeURIComponent(code)+'&token='+encodeURIComponent(token)+'&projector=1';

function injectProjectorButton(){
  if(!isTeacher||isProjector||document.getElementById('projectorLaunch'))return;
  const firstCard=document.querySelector('.shell > .card:first-child');
  if(!firstCard)return;
  const row=document.createElement('div');
  row.className='projector-launch-row';
  row.innerHTML='<button id="projectorLaunch" class="projector-launch" type="button">▣ תצוגת מקרן לכיתה</button>';
  const strip=firstCard.querySelector('.stage-strip');
  if(strip)strip.after(row);else firstCard.appendChild(row);
  document.getElementById('projectorLaunch').onclick=()=>window.open(projectorUrl(),'_blank','noopener');
}

if(!isProjector){
  if(isTeacher){injectProjectorButton();new MutationObserver(injectProjectorButton).observe(document.getElementById('app'),{childList:true,subtree:true});}
  return;
}

document.body.classList.add('projector-mode');
const root=document.createElement('main');
root.id='projectorRoot';
document.body.appendChild(root);
let view='board';
let lastStage=null;
let lastPaint='';

async function getRoom(){
  const r=await fetch('/api/room?code='+encodeURIComponent(code)+'&teacherToken='+encodeURIComponent(token),{cache:'no-store'});
  if(!r.ok)throw new Error('room');
  return r.json();
}
async function getCharter(){
  try{
    const r=await fetch('/api/charter?code='+encodeURIComponent(code)+'&teacherToken='+encodeURIComponent(token),{cache:'no-store'});
    if(!r.ok)return{selectedRules:[]};
    return r.json();
  }catch(e){return{selectedRules:[]};}
}
function header(room,title,sub){
  return `<div class="projector-head"><div><div class="projector-kicker">כשאחים שוכחים${room.className?' · '+esc(room.className):''}</div><h1 class="projector-title">${esc(title)}</h1><div class="projector-sub">${esc(sub)}</div></div><div class="projector-code"><img alt="QR" src="/api/qr?text=${encodeURIComponent(joinUrl())}"><div><div class="projector-kicker">קוד כיתה</div><strong>${esc(code)}</strong></div></div></div>`;
}
function board(room){
  const by={};(room.groups||[]).forEach(x=>by[x.groupNum]=x);
  const cards=Array.from({length:8},(_,i)=>{
    const n=i+1,item=by[n];
    if(!item)return `<div class="projector-card empty"><div><div class="projector-card-num" style="margin:auto auto 10px">${n}</div><div>ממתינים לקבוצה ${n}</div></div></div>`;
    return `<div class="projector-card"><div class="projector-card-top"><div class="projector-card-num">${n}</div><h3>${esc(item.conflictLabel)}</h3></div><div class="projector-label">הרקע למחלוקת</div><div class="projector-text">${esc(item.background)}</div><div class="projector-label">התוצאה</div><div class="projector-text">${esc(item.result)}</div><div class="projector-label">הכלל שלנו</div><div class="projector-rule">${esc(item.rule)}</div></div>`;
  }).join('');
  return `<div class="projector-board">${cards}</div>`;
}
function charter(data){
  const rules=data.selectedRules||[];
  if(rules.length!==5)return '<div class="projector-charter"><div class="projector-charter-empty">האמנה עדיין לא הושלמה. לאחר בחירת 5 כללים הם יוצגו כאן.</div></div>';
  return `<div class="projector-charter"><h2>אמנת המחלוקת שלנו</h2><ol>${rules.map(r=>`<li>${esc(r.rule)}</li>`).join('')}</ol></div>`;
}
function cloud(room){
  const items=room.cloud||[];
  if(!items.length)return '<div class="projector-cloud-wrap"><div class="projector-cloud-question">מה חוזר שוב ושוב?</div><div class="projector-empty">ממתינים למילים מהכיתה…</div></div>';
  const max=Math.max(...items.map(x=>x.count),1);
  const words=items.map((x,i)=>{const size=32+Math.round((x.count/max)*58);const opacity=.70+((i%4)*.08);return `<span style="font-size:${size}px;opacity:${opacity}">${esc(x.word)}</span>`;}).join('');
  return `<div class="projector-cloud-wrap"><div class="projector-cloud-question">מה חוזר שוב ושוב?</div><div class="projector-cloud">${words}</div></div>`;
}
function toolbar(room,charterData){
  if(room.activeStage!==1)return `<div class="projector-toolbar"><span class="projector-status">${room.status==='open'?'הענן פתוח להזנה':'הענן סגור להזנה'}</span></div>`;
  const saved=(charterData.selectedRules||[]).length===5;
  return `<div class="projector-toolbar"><button data-pview="board" class="${view==='board'?'on':''}">לוח הקבוצות</button><button data-pview="charter" class="${view==='charter'?'on':''}">אמנת המחלוקת${saved?' ✓':''}</button><span class="projector-status">${room.status==='open'?'הפעילות פתוחה לקבוצות':'הפעילות סגורה לקבוצות'}</span></div>`;
}
function wireToolbar(){document.querySelectorAll('[data-pview]').forEach(b=>b.onclick=()=>{view=b.dataset.pview;lastPaint='';tick();});}
async function tick(){
  try{
    const [room,charterData]=await Promise.all([getRoom(),getCharter()]);
    if(!room.teacher)throw new Error('auth');
    if(lastStage!==room.activeStage){lastStage=room.activeStage;view='board';}
    const title=room.activeStage===1?(view==='charter'?'מה למדנו?':'למידה בחברותא'):'ענן מילים כיתתי';
    const sub=room.activeStage===1?(view==='charter'?'5 כללים לאמנת המחלוקת הכיתתית':'8 קבוצות · 8 סיפורי מחלוקת'):'מה חוזר שוב ושוב?';
    const content=room.activeStage===1?(view==='charter'?charter(charterData):board(room)):cloud(room);
    const html=`<div class="projector-shell">${header(room,title,sub)}${toolbar(room,charterData)}${content}</div>`;
    if(html!==lastPaint){root.innerHTML=html;lastPaint=html;wireToolbar();}
  }catch(e){root.innerHTML='<div class="projector-shell"><div class="projector-charter"><div class="projector-charter-empty">לא ניתן לטעון את תצוגת המקרן. פתחו אותה מחדש ממסך המורה.</div></div></div>';}
}
tick();setInterval(tick,1300);
})();

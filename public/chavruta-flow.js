(function(){
'use strict';
const params=new URLSearchParams(location.search);
const roomCode=params.get('code')||'';
const teacherToken=params.get('token')||'';

function replaceText(root,from,to){
  if(!root)return;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  const nodes=[];
  while(walker.nextNode())nodes.push(walker.currentNode);
  nodes.forEach(n=>{if(n.nodeValue&&n.nodeValue.includes(from))n.nodeValue=n.nodeValue.split(from).join(to);});
}

function clickStage(n){
  const b=document.querySelector('.stage[data-stage="'+n+'"]');
  if(b)b.click();
}

async function setStage(n){
  if(!roomCode||!teacherToken)return;
  try{await fetch('/api/room',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'setStage',code:roomCode,teacherToken,stage:n})});}catch(e){}
}

function patchTeacherNav(){
  if(location.pathname!=='/teacher'||params.get('projector')==='1')return;
  const nav=document.querySelector('.charter-subnav');
  if(!nav)return;
  const charter=document.getElementById('openCharter');
  const thermo=document.getElementById('openThermometer');
  let first=[...nav.querySelectorAll('button')].find(b=>b!==charter&&b!==thermo&&b.id!=='openCommonWords');
  if(!first)return;
  first.textContent='חלק א׳ · הצגת הסיפורים';
  first.onclick=()=>clickStage(1);

  let words=document.getElementById('openCommonWords');
  if(!words){
    words=document.createElement('button');
    words.id='openCommonWords';
    words.type='button';
    words.onclick=()=>clickStage(2);
    nav.appendChild(words);
  }
  words.textContent='חלק ג׳ · סקר 3 מילים';
  if(thermo)thermo.textContent='חלק ב׳ · הצבעה על אחדות העם';
  if(charter)charter.textContent='חלק ד׳ · האמנה הכיתתית';

  nav.querySelectorAll('button').forEach(b=>b.classList.remove('primary'));
  const active=document.querySelector('.stage.on');
  const stage=active?Number(active.dataset.stage):1;
  (stage===2?words:first).classList.add('primary');
  [first,thermo,words,charter].forEach(el=>{if(el)nav.appendChild(el);});

  const s1=document.querySelector('.stage[data-stage="1"]');
  const s2=document.querySelector('.stage[data-stage="2"]');
  if(s1){const b=s1.querySelector('b'),sm=s1.querySelector('small');if(b)b.textContent='1. למידה בחברותא';if(sm)sm.textContent='סיפורים · הצבעה · 3 מילים · אמנה';}
  if(s2){const b=s2.querySelector('b'),sm=s2.querySelector('small');if(b)b.textContent='ג׳. סקר 3 מילים';if(sm)sm.textContent='מה חוזר בכל הסיפורים?';}
}

function patchCharter(){
  const card=document.querySelector('.charter-modal-card');
  if(!card)return;
  replaceText(card,'למידה בחברותא · חלק ב','למידה בחברותא · חלק ד׳');
  replaceText(card,'למידה בחברותא · חלק ג׳','למידה בחברותא · חלק ד׳');
}

function patchThermometer(){
  const areas=[document.getElementById('thermoTeacherOverlay'),document.getElementById('thermoStudentOverlay'),document.getElementById('projectorThermoView')];
  areas.forEach(area=>{
    if(!area)return;
    replaceText(area,'למידה בחברותא · חלק ג׳','למידה בחברותא · חלק ב׳');
    replaceText(area,'הבית המשותף','אחדות העם');
    replaceText(area,'המחלוקת הזו סיכנה את אחדות העם','הסיפור הזה סיכן את אחדות העם');
  });
}

function patchWordSurveyStudent(){
  if(location.pathname!=='/join')return;
  const first=document.getElementById('w1');
  if(!first)return;
  const card=first.closest('.card');
  if(card){
    const eyebrow=card.querySelector('.eyebrow');
    if(eyebrow)eyebrow.textContent='למידה בחברותא · חלק ג׳';
    const headings=[...card.querySelectorAll('div,h2,h3')];
    const q=headings.find(el=>el.textContent.trim()==='מה חוזר שוב ושוב?');
    if(q)q.textContent='בחרו 3 מילים שחוזרות בכל הסיפורים';
    const p=card.querySelector('p.muted');
    if(p)p.textContent='בחרו בדיוק שלוש מילים או ביטויים קצרים שלדעתכם חוזרים בסיפורי המחלוקת.';
  }
  const help=document.querySelector('.word-bank-help');
  if(help)help.textContent='בחרו בדיוק 3 מילים שחוזרות בסיפורים — או כתבו מילים משלכם.';
  const title=document.querySelector('.word-bank-title');
  if(title)title.textContent='מחסן מילים לבחירה';
  const btn=document.getElementById('sendWords');
  if(btn&&!btn.dataset.exactThree){
    btn.dataset.exactThree='1';
    btn.addEventListener('click',e=>{
      const vals=['w1','w2','w3'].map(id=>(document.getElementById(id)?.value||'').trim()).filter(Boolean);
      if(vals.length===3)return;
      e.preventDefault();e.stopImmediatePropagation();
      let note=document.getElementById('threeWordsRequired');
      if(!note){note=document.createElement('div');note.id='threeWordsRequired';note.className='error';btn.insertAdjacentElement('afterend',note);}
      note.textContent='יש לבחור בדיוק 3 מילים לפני השליחה.';
    },true);
  }
}

function patchWordSurveyTeacher(){
  if(location.pathname!=='/teacher'||params.get('projector')==='1')return;
  const active=document.querySelector('.stage.on[data-stage="2"]');
  if(!active)return;
  const activity=document.querySelector('.grid.two > .card:first-child');
  if(!activity)return;
  const q=[...activity.querySelectorAll('.q,div,h2,h3')].find(el=>el.textContent.trim()==='מה חוזר שוב ושוב?');
  if(q)q.textContent='3 מילים שחוזרות בכל הסיפורים';
  const p=activity.querySelector('p.muted');
  if(p&&p.textContent.includes('שלוש מילים'))p.textContent='כל תלמיד בוחר בדיוק 3 מילים. התוצאות נבנות בזמן אמת.';
}

function projectorButton(id,text,onClick){
  let b=document.getElementById(id);
  if(!b){b=document.createElement('button');b.id=id;b.type='button';b.onclick=onClick;}
  b.textContent=text;
  return b;
}

function patchProjectorOrder(){
  if(location.pathname!=='/teacher'||params.get('projector')!=='1')return;
  const bar=document.querySelector('.projector-toolbar');
  if(!bar)return;
  const board=bar.querySelector('[data-pview="board"]')||projectorButton('projectorStoriesStep','הצגת הסיפורים',()=>setStage(1));
  const thermo=document.getElementById('projectorThermoBtn');
  const words=projectorButton('projectorWordsStep','סקר 3 מילים',()=>setStage(2));
  let charter=bar.querySelector('[data-pview="charter"]');
  if(!charter){charter=projectorButton('projectorCharterStep','האמנה הכיתתית',async()=>{await setStage(1);setTimeout(()=>{const x=document.querySelector('[data-pview="charter"]');if(x)x.click();},1500);});}
  const status=bar.querySelector('.projector-status');
  if(board)board.textContent='הצגת הסיפורים';
  if(thermo)thermo.textContent='הצבעה על אחדות העם';
  if(charter)charter.textContent='האמנה הכיתתית';
  [board,thermo,words,charter,status].forEach(el=>{if(el)bar.appendChild(el);});

  const cloud=document.querySelector('.projector-cloud-question');
  if(cloud)cloud.textContent='3 מילים שחוזרות בכל הסיפורים';
}

function patchHomeNote(){
  const note=document.getElementById('charterHomeNote');
  if(note)note.innerHTML='<strong>בלמידה בחברותא יש ארבעה חלקים:</strong> חלק א׳ – הצגת שמונת הסיפורים והתובנות; חלק ב׳ – הצבעה עד כמה כל סיפור סיכן את אחדות העם; חלק ג׳ – כל תלמיד בוחר 3 מילים שחוזרות בסיפורים; חלק ד׳ – בחירת חמישה כללים ל״אמנת המחלוקת הכיתתית״.';
}

function patchAll(){patchTeacherNav();patchCharter();patchThermometer();patchWordSurveyStudent();patchWordSurveyTeacher();patchProjectorOrder();patchHomeNote();}
patchAll();
new MutationObserver(patchAll).observe(document.body,{childList:true,subtree:true});
setInterval(patchAll,700);
})();

(function(){
'use strict';

const params=new URLSearchParams(location.search);
const path=location.pathname;
const isTeacher=path==='/teacher';
const isProjector=isTeacher&&params.get('projector')==='1';
const isStudent=path==='/join';
const code=params.get('code')||'';
const token=params.get('token')||'';
const partKey='brothers-forget-active-part:'+code;
let scheduled=false;

function setText(el,text){if(el&&el.textContent!==text)el.textContent=text;}
function rememberPart(n){try{sessionStorage.setItem(partKey,String(n));}catch(e){}}
function rememberedPart(){try{return Number(sessionStorage.getItem(partKey)||0);}catch(e){return 0;}}
function stage(){const on=document.querySelector('.stage.on');return on?Number(on.dataset.stage||1):1;}
function waitFor(selector,cb,tries=24){const el=document.querySelector(selector);if(el){cb(el);return;}if(tries>0)setTimeout(()=>waitFor(selector,cb,tries-1),120);}
function clickStage(n,after){const b=document.querySelector('.stage[data-stage="'+n+'"]');if(!b)return;if(stage()===n){if(after)after();return;}b.click();if(after)setTimeout(after,450);}
async function setStage(n){if(!code||!token)return;try{await fetch('/api/room',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'setStage',code,teacherToken:token,stage:n})});}catch(e){}}

function ensureStyles(){
 if(document.getElementById('fourPartsStyles'))return;
 const s=document.createElement('style');s.id='fourPartsStyles';s.textContent=`
 .four-parts-nav{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:18px 0 4px}
 .four-parts-nav button{border:1px solid rgba(72,42,104,.22);background:#fff;border-radius:16px;padding:13px 10px;min-height:64px;font:inherit;color:inherit;cursor:pointer;transition:.18s ease;box-shadow:0 5px 16px rgba(36,20,58,.05)}
 .four-parts-nav button strong{display:block;font-size:15px;margin-bottom:3px}.four-parts-nav button span{display:block;font-size:12px;opacity:.7}
 .four-parts-nav button.active{background:#efe8f6;border-color:#79559a;box-shadow:0 7px 20px rgba(73,44,104,.13)}
 .teacher-four-parts-title{font-size:13px;font-weight:800;opacity:.68;margin-top:14px}
 .charter-subnav{display:none!important}
 @media(max-width:760px){.four-parts-nav{grid-template-columns:1fr 1fr;gap:8px}.four-parts-nav button{min-height:58px;padding:10px 8px}}
 .projector-four-parts{display:flex;gap:12px;flex-wrap:wrap;margin:14px 0 18px}.projector-four-parts button{font:inherit;border:1px solid rgba(255,255,255,.25);border-radius:999px;padding:10px 18px;cursor:pointer}
 `;document.head.appendChild(s);
}

function openTeacherPart(n){
 rememberPart(n);
 if(n===1){clickStage(1);return;}
 if(n===2){clickStage(1,()=>waitFor('#openThermometer',b=>b.click()));return;}
 if(n===3){clickStage(2);return;}
 if(n===4){clickStage(1,()=>waitFor('#openCharter',b=>b.click()));}
}

function injectTeacherParts(){
 if(!isTeacher||isProjector)return;
 const card=document.querySelector('.shell > .card:first-child');
 if(!card)return;
 const strip=card.querySelector('.stage-strip');
 if(!strip)return;
 strip.style.display='none';
 let title=document.getElementById('teacherFourPartsTitle');
 if(!title){title=document.createElement('div');title.id='teacherFourPartsTitle';title.className='teacher-four-parts-title';title.textContent='ארבעת חלקי הפעילות';strip.insertAdjacentElement('afterend',title);}
 let nav=document.getElementById('teacherFourParts');
 if(!nav){
   nav=document.createElement('div');nav.id='teacherFourParts';nav.className='four-parts-nav';
   nav.innerHTML=`<button data-part="1"><strong>1. הסיפורים</strong><span>הצגת שמונת הסיפורים</span></button><button data-part="2"><strong>2. מד חום</strong><span>עד כמה כל סיפור סיכן את אחדות העם?</span></button><button data-part="3"><strong>3. מה חוזר שוב ושוב?</strong><span>בחירת 3 מילים</span></button><button data-part="4"><strong>4. האמנה הכיתתית</strong><span>5 כללים לניהול מחלוקת</span></button>`;
   title.insertAdjacentElement('afterend',nav);
   nav.querySelectorAll('[data-part]').forEach(b=>b.onclick=()=>openTeacherPart(Number(b.dataset.part)));
 }
 let p=rememberedPart();if(!p)p=stage()===2?3:1;
 if(stage()===2)p=3;else if(p===3)p=1;
 nav.querySelectorAll('[data-part]').forEach(b=>b.classList.toggle('active',Number(b.dataset.part)===p));
 const legacy=document.querySelector('.charter-subnav');if(legacy)legacy.style.display='none';
}

function patchThermometer(){
 [document.getElementById('thermoTeacherOverlay'),document.getElementById('thermoStudentOverlay'),document.getElementById('projectorThermoView')].forEach(area=>{
   if(!area)return;
   const walker=document.createTreeWalker(area,NodeFilter.SHOW_TEXT);const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
   nodes.forEach(n=>{let t=n.nodeValue||'';let v=t.replaceAll('הבית המשותף','אחדות העם').replaceAll('המחלוקת הזו סיכנה את אחדות העם','הסיפור הזה סיכן את אחדות העם').replaceAll('למידה בחברותא · חלק ג׳','למידה בחברותא · חלק ב׳');if(v!==t)n.nodeValue=v;});
 });
}

function patchCharter(){
 const card=document.querySelector('.charter-modal-card');if(!card)return;
 const walker=document.createTreeWalker(card,NodeFilter.SHOW_TEXT);const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
 nodes.forEach(n=>{let t=n.nodeValue||'';let v=t.replaceAll('למידה בחברותא · חלק ב׳','למידה בחברותא · חלק ד׳').replaceAll('למידה בחברותא · חלק ג׳','למידה בחברותא · חלק ד׳');if(v!==t)n.nodeValue=v;});
}

function patchWords(){
 if(isStudent){
   const first=document.getElementById('w1');if(!first)return;
   const card=first.closest('.card');if(card){const eyebrow=card.querySelector('.eyebrow');if(eyebrow)setText(eyebrow,'למידה בחברותא · חלק ג׳');const q=[...card.querySelectorAll('.q,h2,h3,div')].find(x=>x.textContent.trim()==='מה חוזר שוב ושוב?');if(q)setText(q,'מה חוזר שוב ושוב?');const p=card.querySelector('p.muted');if(p)setText(p,'בחרו בדיוק 3 מילים או ביטויים קצרים שלדעתכם חוזרים בסיפורי המחלוקת.');}
   const help=document.querySelector('.word-bank-help');if(help)setText(help,'בחרו בדיוק 3 מילים שחוזרות בסיפורים — או כתבו מילים משלכם.');
   const btn=document.getElementById('sendWords');if(btn&&!btn.dataset.exactThree){btn.dataset.exactThree='1';btn.addEventListener('click',e=>{const vals=['w1','w2','w3'].map(id=>(document.getElementById(id)?.value||'').trim()).filter(Boolean);if(vals.length===3)return;e.preventDefault();e.stopImmediatePropagation();let note=document.getElementById('threeWordsRequired');if(!note){note=document.createElement('div');note.id='threeWordsRequired';note.className='error';btn.insertAdjacentElement('afterend',note);}note.textContent='יש לבחור בדיוק 3 מילים לפני השליחה.';},true);}
 }
 if(isTeacher&&!isProjector&&stage()===2){const activity=document.querySelector('.grid.two > .card:first-child');if(activity){const q=[...activity.querySelectorAll('.q,h2,h3,div')].find(x=>x.textContent.trim()==='מה חוזר שוב ושוב?');if(q)setText(q,'מה חוזר שוב ושוב?');const p=activity.querySelector('p.muted');if(p&&p.textContent.includes('שלוש מילים'))setText(p,'כל תלמיד בוחר בדיוק 3 מילים. התוצאות נבנות בזמן אמת.');}}
}

function openProjectorPart(n){
 if(n===1){setStage(1).then(()=>setTimeout(()=>{const b=document.querySelector('[data-pview="board"]');if(b)b.click();},500));return;}
 if(n===2){setStage(1).then(()=>setTimeout(()=>waitFor('#projectorThermoBtn',b=>b.click()),500));return;}
 if(n===3){setStage(2);return;}
 if(n===4){setStage(1).then(()=>setTimeout(()=>{const b=document.querySelector('[data-pview="charter"]');if(b)b.click();},700));}
}

function injectProjectorParts(){
 if(!isProjector)return;
 const shell=document.querySelector('.projector-shell');if(!shell)return;
 if(document.getElementById('projectorFourParts'))return;
 const head=shell.querySelector('.projector-head');if(!head)return;
 const nav=document.createElement('div');nav.id='projectorFourParts';nav.className='projector-four-parts';
 nav.innerHTML='<button data-pp="1">1. הסיפורים</button><button data-pp="2">2. מד חום</button><button data-pp="3">3. מה חוזר שוב ושוב?</button><button data-pp="4">4. האמנה הכיתתית</button>';
 head.insertAdjacentElement('afterend',nav);nav.querySelectorAll('[data-pp]').forEach(b=>b.onclick=()=>openProjectorPart(Number(b.dataset.pp)));
 const cloud=document.querySelector('.projector-cloud-question');if(cloud)setText(cloud,'מה חוזר שוב ושוב?');
}

function patchHome(){
 const note=document.getElementById('charterHomeNote');if(!note)return;
 const html='<strong>ארבעת חלקי הפעילות:</strong> 1. הצגת שמונת הסיפורים; 2. מד חום – עד כמה כל סיפור סיכן את אחדות העם; 3. „מה חוזר שוב ושוב?” – בחירת 3 מילים; 4. האמנה הכיתתית – בחירת חמישה כללים.';
 if(note.innerHTML!==html)note.innerHTML=html;
}

function patch(){scheduled=false;ensureStyles();injectTeacherParts();injectProjectorParts();patchThermometer();patchCharter();patchWords();patchHome();}
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(patch);}
ensureStyles();patch();
new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
})();

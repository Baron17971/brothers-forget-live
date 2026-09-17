(function(){
'use strict';

function replaceText(root, from, to){
  if(!root) return;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  const nodes=[];
  while(walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(n=>{ if(n.nodeValue&&n.nodeValue.includes(from)) n.nodeValue=n.nodeValue.split(from).join(to); });
}

function patchTeacherNav(){
  if(location.pathname!=='/teacher') return;
  const nav=document.querySelector('.charter-subnav');
  if(!nav) return;
  const first=nav.querySelector('button:not(#openThermometer):not(#openCharter)');
  const thermo=document.getElementById('openThermometer');
  const charter=document.getElementById('openCharter');
  if(first) first.textContent='חלק א׳ · הצגת הסיפורים';
  if(thermo) thermo.textContent='חלק ב׳ · הצבעה על אחדות העם';
  if(charter) charter.textContent='חלק ג׳ · האמנה הכיתתית';
  if(first) nav.appendChild(first);
  if(thermo) nav.appendChild(thermo);
  if(charter) nav.appendChild(charter);
}

function patchCharter(){
  const card=document.querySelector('.charter-modal-card');
  if(!card) return;
  replaceText(card,'למידה בחברותא · חלק ב','למידה בחברותא · חלק ג׳');
}

function patchThermometer(){
  const areas=[
    document.getElementById('thermoTeacherOverlay'),
    document.getElementById('thermoStudentOverlay'),
    document.getElementById('projectorThermoView')
  ];
  areas.forEach(area=>{
    if(!area) return;
    replaceText(area,'למידה בחברותא · חלק ג׳','למידה בחברותא · חלק ב׳');
    replaceText(area,'הבית המשותף','אחדות העם');
    replaceText(area,'המחלוקת הזו סיכנה את אחדות העם','הסיפור הזה סיכן את אחדות העם');
  });
}

function patchProjectorOrder(){
  const bar=document.querySelector('.projector-toolbar');
  if(!bar) return;
  const board=bar.querySelector('[data-pview="board"]');
  const thermo=document.getElementById('projectorThermoBtn');
  const charter=bar.querySelector('[data-pview="charter"]');
  const status=bar.querySelector('.projector-status');
  if(board) board.textContent='הצגת הסיפורים';
  if(thermo) thermo.textContent='הצבעה על אחדות העם';
  if(charter) charter.textContent='האמנה הכיתתית';
  [board,thermo,charter,status].forEach(el=>{if(el)bar.appendChild(el);});
}

function patchHomeNote(){
  const note=document.getElementById('charterHomeNote');
  if(!note) return;
  note.innerHTML='<strong>בלמידה בחברותא יש שלושה חלקים:</strong> חלק א׳ – הצגת שמונת הסיפורים והתובנות של הקבוצות; חלק ב׳ – הצבעה עד כמה כל סיפור סיכן את אחדות העם; חלק ג׳ – בחירת חמישה כללים ל״אמנת המחלוקת הכיתתית״.';
}

function patchAll(){
  patchTeacherNav();
  patchCharter();
  patchThermometer();
  patchProjectorOrder();
  patchHomeNote();
}

patchAll();
new MutationObserver(patchAll).observe(document.body,{childList:true,subtree:true});
setInterval(patchAll,900);
})();

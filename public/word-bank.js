(function(){
'use strict';
const BANK=['פחד','השפלה','שתיקה','חוסר אמון','כוח','דה־לגיטימציה','נקמה','גורם חיצוני','ריסון','מנהיגות'];

function inputs(){return ['w1','w2','w3'].map(id=>document.getElementById(id)).filter(Boolean);}
function current(){return inputs().map(x=>x.value.trim()).filter(Boolean);}
function sync(){
  const vals=current();
  document.querySelectorAll('.word-chip').forEach(btn=>btn.classList.toggle('selected',vals.includes(btn.dataset.word)));
}
function message(text){const el=document.querySelector('.word-bank-note');if(!el)return;el.textContent=text||'';if(text)setTimeout(()=>{if(el.textContent===text)el.textContent='';},1800);}
function toggleWord(word){
  const ins=inputs();
  const existing=ins.find(x=>x.value.trim()===word);
  if(existing){existing.value='';existing.dispatchEvent(new Event('input',{bubbles:true}));sync();return;}
  const empty=ins.find(x=>!x.value.trim());
  if(!empty){message('כבר בחרתם שלוש מילים. אפשר למחוק אחת או לערוך אותה.');return;}
  empty.value=word;
  empty.dispatchEvent(new Event('input',{bubbles:true}));
  sync();
}
function enhance(){
  const first=document.getElementById('w1');
  if(!first||document.querySelector('.word-bank-wrap'))return;
  const entry=first.closest('.word-entry');
  if(!entry)return;
  const wrap=document.createElement('div');
  wrap.className='word-bank-wrap';
  wrap.innerHTML='<div class="word-bank-title">מחסן מילים</div><div class="word-bank-help">בחרו עד 3 מילים שמופיעות שוב ושוב בסיפורים — או כתבו מילים משלכם.</div><div class="word-bank">'+BANK.map(w=>'<button type="button" class="word-chip" data-word="'+w+'">'+w+'</button>').join('')+'</div><div class="word-bank-note" aria-live="polite"></div>';
  entry.parentNode.insertBefore(wrap,entry);
  const label=document.createElement('div');
  label.className='custom-word-label';
  label.textContent='או כתבו בעצמכם:';
  entry.parentNode.insertBefore(label,entry);
  wrap.querySelectorAll('.word-chip').forEach(btn=>btn.addEventListener('click',()=>toggleWord(btn.dataset.word)));
  inputs().forEach(inp=>inp.addEventListener('input',sync));
  sync();
}
const observer=new MutationObserver(enhance);
observer.observe(document.getElementById('app')||document.body,{childList:true,subtree:true});
enhance();
})();

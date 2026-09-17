(function(){
'use strict';
const modal=document.getElementById('modal');
const modalCard=document.getElementById('modalCard');
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);}
function getRoomInfo(){const p=new URLSearchParams(location.search);return{code:p.get('code')||'',teacherToken:p.get('token')||''};}
async function charterGet(){const {code,teacherToken}=getRoomInfo();const r=await fetch('/api/charter?code='+encodeURIComponent(code)+'&teacherToken='+encodeURIComponent(teacherToken),{cache:'no-store'});if(!r.ok)throw new Error('load');return r.json();}
async function charterPost(body){const {code,teacherToken}=getRoomInfo();const r=await fetch('/api/charter',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,code,teacherToken})});let d={};try{d=await r.json();}catch(e){}if(!r.ok){const er=new Error(d.error||'save');er.code=d.error;throw er;}return d;}
function closeCharter(){if(!modal)return;modal.classList.remove('show');modal.setAttribute('aria-hidden','true');}
function finalCharter(rules){if(!rules||rules.length!==5)return'';return `<div class="charter-display"><div class="eyebrow">האמנה הכיתתית שלנו</div><h3>5 כללים לניהול מחלוקת</h3><ol>${rules.map(r=>`<li>${esc(r.rule)}</li>`).join('')}</ol></div>`;}
async function openCharter(){if(!modal||!modalCard)return;modal.classList.add('show');modal.setAttribute('aria-hidden','false');modalCard.classList.add('charter-modal-card');modalCard.innerHTML='<button class="modal-close" id="charterClose">×</button><div class="charter-empty">טוען את הכללים שהקבוצות ניסחו…</div>';document.getElementById('charterClose').onclick=closeCharter;try{const data=await charterGet();renderCharterEditor(data);}catch(e){modalCard.innerHTML='<button class="modal-close" id="charterClose">×</button><h2>האמנה הכיתתית</h2><div class="charter-error">לא הצלחנו לטעון את כללי הקבוצות.</div>';document.getElementById('charterClose').onclick=closeCharter;}}

function renderCharterEditor(data){
  const available=data.availableRules||[];
  let savedRules=data.selectedRules||[];
  const selected=new Set(savedRules.map(r=>Number(r.groupNum)));
  const drafts=new Map();
  available.forEach(r=>drafts.set(Number(r.groupNum),String(r.rule||'')));
  savedRules.forEach(r=>drafts.set(Number(r.groupNum),String(r.rule||'')));

  function selectedPayload(){
    return available.filter(r=>selected.has(Number(r.groupNum))).map(r=>({groupNum:Number(r.groupNum),rule:(drafts.get(Number(r.groupNum))||'').trim()}));
  }

  function paint(messageHtml=''){
    const selectedRules=selectedPayload();
    modalCard.innerHTML=`<button class="modal-close" id="charterClose">×</button><div class="charter-shell">
      <div>
        <div class="eyebrow">למידה בחברותא · חלק ד׳</div>
        <h2 style="margin:3px 0 7px">האמנה הכיתתית</h2>
        <p class="muted" style="margin:0">כל הכללים שהקבוצות הציעו מופיעים כאן. עברו עליהם יחד עם הכיתה, החליטו איזה כלל נכנס לאמנה, וערכו את הניסוח לפי הצורך. בסיום בוחרים בדיוק חמישה כללים.</p>
      </div>
      ${finalCharter(savedRules)}
      <div class="charter-intro"><span class="charter-count">נבחרו ${selected.size} מתוך 5</span><br>${available.length<5?`כרגע הוזנו רק ${available.length} כללים. אפשר לשמור אמנה לאחר שלפחות חמש קבוצות יגישו כלל.`:'כל הכללים מוצגים. אפשר לערוך כל ניסוח, ואז להכניס או להוציא אותו מהאמנה.'}</div>
      <div class="charter-rules">${available.length?available.map(r=>{
        const n=Number(r.groupNum);const isSelected=selected.has(n);const text=drafts.get(n)||'';
        return `<article class="charter-rule ${isSelected?'selected':''}" data-charter-card="${n}">
          <div class="charter-rule-top"><div><div class="group-tag">קבוצה ${n}</div><div class="conflict-tag">${esc(r.conflictLabel)}</div></div><button type="button" class="charter-toggle ${isSelected?'included':''}" data-charter-toggle="${n}">${isSelected?'✓ באמנה':'הוסף לאמנה'}</button></div>
          <label class="charter-edit-label" for="charterRule${n}">נוסח הכלל</label>
          <textarea id="charterRule${n}" class="charter-rule-edit" data-charter-edit="${n}" maxlength="180" rows="3">${esc(text)}</textarea>
        </article>`;
      }).join(''):'<div class="charter-empty">עדיין לא הוגשו כללים בחלק הסיפורים.</div>'}</div>
      <div class="charter-actions"><button class="btn pri" id="saveCharter" ${selected.size===5?'':'disabled'}>שמירת 5 הכללים באמנה</button>${savedRules.length?'<button class="btn ghost" id="resetCharter">איפוס האמנה</button>':''}</div>
      <div id="charterMsg">${messageHtml}</div>
    </div>`;

    document.getElementById('charterClose').onclick=closeCharter;
    document.querySelectorAll('[data-charter-edit]').forEach(el=>{
      el.addEventListener('input',()=>drafts.set(Number(el.dataset.charterEdit),el.value));
    });
    document.querySelectorAll('[data-charter-toggle]').forEach(b=>{
      b.onclick=()=>{
        const n=Number(b.dataset.charterToggle);
        if(selected.has(n))selected.delete(n);
        else if(selected.size<5)selected.add(n);
        else return paint('<div class="charter-error">כבר נבחרו 5 כללים. הוציאו כלל אחד כדי להכניס אחר.</div>');
        paint();
      };
    });

    const save=document.getElementById('saveCharter');
    if(save)save.onclick=async()=>{
      const payload=selectedPayload();
      if(payload.length!==5||payload.some(r=>!r.rule))return paint('<div class="charter-error">יש לבחור בדיוק 5 כללים ולוודא שלכל אחד יש נוסח.</div>');
      save.disabled=true;save.textContent='שומר…';
      try{
        const res=await charterPost({action:'save',selectedRules:payload});
        savedRules=res.selectedRules||[];
        savedRules.forEach(r=>drafts.set(Number(r.groupNum),String(r.rule||'')));
        paint('<div class="charter-saved">✓ האמנה נשמרה. חמשת הכללים הערוכים מוצגים למעלה.</div>');
      }catch(e){paint('<div class="charter-error">יש לבחור בדיוק 5 כללים ולוודא שהניסוח אינו ריק.</div>');}
    };

    const reset=document.getElementById('resetCharter');
    if(reset)reset.onclick=async()=>{await charterPost({action:'reset'});selected.clear();savedRules=[];available.forEach(r=>drafts.set(Number(r.groupNum),String(r.rule||'')));paint();};
  }
  paint();
}

function injectTeacherPartB(){if(location.pathname!=='/teacher')return;const active=document.querySelector('.stage.on');if(!active)return;const activity=document.querySelector('.grid.two > .card:first-child');if(!activity||document.getElementById('charterSubnav'))return;const nav=document.createElement('div');nav.className='charter-subnav';nav.id='charterSubnav';nav.innerHTML='<button class="primary" type="button">חלק א׳ · הצגת הסיפורים</button><button id="openCharter" type="button">חלק ד׳ · האמנה הכיתתית</button>';const anchor=activity.querySelector('.statusline')||activity.firstChild;if(anchor&&anchor.parentNode)anchor.parentNode.insertBefore(nav,anchor);else activity.prepend(nav);document.getElementById('openCharter').onclick=openCharter;}
function patchHome(){if(location.pathname!=='/'||document.getElementById('charterHomeNote'))return;const guides=document.querySelectorAll('.teacher-guide');if(!guides.length)return;const note=document.createElement('div');note.id='charterHomeNote';note.className='callout';note.style.margin='12px 0 16px';note.innerHTML='<strong>בלמידה בחברותא יש ארבעה חלקים:</strong> חלק א׳ – הצגת הסיפורים והתובנות; חלק ב׳ – הצבעה עד כמה כל סיפור סיכן את אחדות העם; חלק ג׳ – בחירת 3 מילים שחוזרות בסיפורים; חלק ד׳ – דיון בכל הכללים, עריכת הניסוח ובחירת 5 כללים ל״אמנת המחלוקת הכיתתית״.';guides[0].after(note);}
setInterval(()=>{injectTeacherPartB();patchHome();},500);
})();

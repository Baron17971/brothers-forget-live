(function(){
'use strict';
const root=document.getElementById('dominoApp');
const toastBox=document.getElementById('dominoToast');
const q=new URLSearchParams(location.search);
const code=q.get('code')||'';
const mode=q.get('mode')||'student';
const token=q.get('token')||'';
let timer=null;
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
function toast(t){toastBox.textContent=t;toastBox.classList.add('show');setTimeout(()=>toastBox.classList.remove('show'),1600);}
function playerId(){const k='brothers-forget-domino-player';let v=localStorage.getItem(k);if(!v){v=crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random();localStorage.setItem(k,v);}return v;}
const pid=playerId();
function joinUrl(){return location.origin+'/domino?code='+encodeURIComponent(code);}
function projectorUrl(){return location.origin+'/domino?mode=projector&code='+encodeURIComponent(code)+'&token='+encodeURIComponent(token);}
async function get(extra={}){let u='/api/domino?code='+encodeURIComponent(code);for(const [k,v] of Object.entries(extra))if(v)u+='&'+encodeURIComponent(k)+'='+encodeURIComponent(v);const r=await fetch(u,{cache:'no-store'});let d={};try{d=await r.json();}catch(e){}if(!r.ok){const er=new Error(d.error||'request');er.code=d.error;throw er;}return d;}
async function post(body){const r=await fetch('/api/domino',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,code})});let d={};try{d=await r.json();}catch(e){}if(!r.ok){const er=new Error(d.error||'request');er.code=d.error;throw er;}return d;}
function hero(sub){return '<section class="hero"><div class="eyebrow">כשאחים שוכחים · פעילות סיום אופציונלית</div><h1>דומינו של מחלוקת</h1><p>'+esc(sub||'מקשיבים. ממתינים. מניחים בזמן הנכון.')+'</p></section>';}
function tile(t){return '<div class="domino"><div>'+esc(t.left)+'</div><div>'+esc(t.right)+'</div></div>';}
function chainHtml(list){return list&&list.length?'<div class="chain">'+list.map(tile).join('')+'</div>':'<div class="waiting">השרשרת עדיין לא התחילה.</div>';}
function progress(n){const p=Math.round((n/32)*100);return '<div class="progress"><span style="width:'+p+'%"></span></div><div class="tiny" style="margin-top:7px">'+n+'/32 קוביות</div>';}
function complete(){return '<div class="quote">„כשכל אחד ממהר להניח את הקובייה שלו, השרשרת עלולה להישבר. הקשבה מחברת.”</div>';}
function startPoll(fn){clearInterval(timer);timer=setInterval(fn,1100);}
function stopPoll(){clearInterval(timer);timer=null;}
async function renderTeacher(){
 try{
  const d=await get({teacherToken:token});
  if(!d.teacher)throw new Error('auth');
  const players=d.players||[];
  root.innerHTML='<div class="shell">'+hero('מסך מורה')+'<section class="card"><div class="teacher-top"><div><div class="status"><span class="dot '+(d.phase==='playing'?'on':'')+'"></span>'+(d.phase==='lobby'?'ממתינים לתלמידים':d.phase==='playing'?'המשחק פעיל':'המשחק הושלם')+'</div><h2 style="margin-bottom:4px">קוד כיתה</h2><div class="code">'+esc(code)+'</div></div><div class="joinbox"><div class="qr"><img alt="QR למשחק" src="/api/qr?text='+encodeURIComponent(joinUrl())+'"></div><div><strong>כניסת תלמידים למשחק</strong><div class="linkbox">'+esc(joinUrl())+'</div><div class="btns"><button class="btn ghost" id="copyJoin">העתקת קישור</button><button class="btn ghost" id="openProjector">פתיחת מקרן</button></div></div></div></div></section><div class="grid"><section class="card"><h2>תלמידים מחוברים: '+players.length+'</h2><div class="roster">'+(players.length?players.map(p=>'<span class="chip">'+esc(p.name)+'</span>').join(''):'<span class="muted">עדיין אין תלמידים בלובי.</span>')+'</div><div class="btns">'+(d.phase==='lobby'?'<button class="btn pri" id="startGame" '+(!players.length?'disabled':'')+'>התחלת המשחק וחלוקת קוביות</button>':'<button class="btn danger" id="resetGame">איפוס וחזרה ללובי</button>')+'</div></section><section class="card"><h2>מצב השרשרת</h2>'+progress(d.chainCount||0)+(d.currentClue?'<div class="open-clue">הקצה הפתוח: '+esc(d.currentClue)+'</div>':'')+'</section></div><section class="card"><h2>השרשרת המשותפת</h2>'+chainHtml(d.chain||[])+(d.phase==='complete'?complete():'')+'</section></div>';
  document.getElementById('copyJoin').onclick=async()=>{try{await navigator.clipboard.writeText(joinUrl());toast('הקישור הועתק');}catch(e){}};
  document.getElementById('openProjector').onclick=()=>window.open(projectorUrl(),'_blank','noopener');
  const s=document.getElementById('startGame');if(s)s.onclick=async()=>{s.disabled=true;try{await post({action:'start',teacherToken:token});renderTeacher();}catch(e){toast(e.code==='no_players'?'אין עדיין תלמידים בלובי':'לא ניתן להתחיל');s.disabled=false;}};
  const r=document.getElementById('resetGame');if(r)r.onclick=async()=>{await post({action:'reset',teacherToken:token});renderTeacher();};
  startPoll(async()=>{try{const n=await get({teacherToken:token});if(n.version!==d.version||n.players.length!==players.length)renderTeacher();}catch(e){}});
 }catch(e){root.innerHTML='<div class="shell">'+hero()+'<section class="card"><h2>לא ניתן לפתוח את מסך המורה</h2><p class="muted">פתחו את המשחק מתוך מסך המורה של „כשאחים שוכחים”.</p></section></div>';}
}
async function renderProjector(){
 document.body.classList.add('projector');
 try{
  const d=await get({teacherToken:token});
  if(!d.teacher)throw new Error('auth');
  root.innerHTML='<div class="shell">'+hero('תצוגת מקרן')+'<section class="card"><div class="teacher-top"><div><div class="eyebrow">קוד כיתה</div><div class="code">'+esc(code)+'</div></div><div class="joinbox"><div class="qr"><img alt="QR למשחק" src="/api/qr?text='+encodeURIComponent(joinUrl())+'"></div><div><strong>'+(d.phase==='lobby'?'סרקו והצטרפו ללובי':d.phase==='playing'?'עקבו אחרי השרשרת':'המשחק הסתיים')+'</strong><div class="muted">'+(d.players||[]).length+' תלמידים מחוברים</div></div></div></div>'+(d.currentClue?'<div class="open-clue">מחפשים קובייה שמתאימה ל־ „'+esc(d.currentClue)+'”</div>':'')+'<div style="margin-top:18px">'+progress(d.chainCount||0)+'</div></section><section class="card">'+chainHtml(d.chain||[])+(d.lastPlayer?'<div class="feedback ok">✓ '+esc(d.lastPlayer)+' חיבר/ה את הקובייה האחרונה</div>':'')+(d.phase==='complete'?complete():'')+'</section></div>';
  startPoll(async()=>{try{const n=await get({teacherToken:token});if(n.version!==d.version)renderProjector();}catch(e){}});
 }catch(e){root.innerHTML='<div class="shell">'+hero()+'<section class="card"><h2>לא ניתן לפתוח תצוגת מקרן</h2></section></div>';}
}
function joinForm(saved){
 root.innerHTML='<div class="shell">'+hero('קובייה אחת. רגע אחד נכון.')+'<section class="card nameform"><h2>כניסה למשחק</h2><p class="muted">כתבו שם פרטי. לאחר שהמורה יתחיל, תקבלו קובייה אחת. לחצו עליה רק כשנראה לכם שהיא מתאימה לקצה השרשרת.</p><input id="playerName" maxlength="24" autocomplete="name" placeholder="השם שלי" value="'+esc(saved||'')+'"><button class="btn pri press" id="joinGame">כניסה ללובי</button><div class="feedback" id="joinFeedback"></div></section></div>';
 document.getElementById('joinGame').onclick=async()=>{const name=document.getElementById('playerName').value.trim();if(!name){document.getElementById('joinFeedback').textContent='כתבו שם פרטי.';return;}localStorage.setItem('brothers-forget-domino-name',name);try{await post({action:'join',playerId:pid,name});renderStudent();}catch(e){document.getElementById('joinFeedback').textContent=e.code==='game_started'?'המשחק כבר התחיל. בקשו מהמורה לאפס אם צריך.':'לא ניתן להצטרף כרגע.';}};
}
async function renderStudent(){
 const saved=localStorage.getItem('brothers-forget-domino-name')||'';
 if(!saved){joinForm('');return;}
 try{
  let d=await get({playerId:pid});
  if(!d.joined){joinForm(saved);return;}
  if(d.phase==='lobby'){
   root.innerHTML='<div class="shell">'+hero('מחכים יחד לרגע הנכון')+'<section class="card"><div class="waiting"><strong>'+esc(saved)+'</strong>, הצטרפת ללובי ✓<br>המורה יתחיל את המשחק ויחלק קובייה לכל תלמיד.</div></section></div>';
  }else if(d.phase==='complete'){
   root.innerHTML='<div class="shell">'+hero('השרשרת הושלמה')+'<section class="card">'+complete()+chainHtml(d.chain||[])+'</section></div>';
  }else{
   const mine=d.myTile;
   root.innerHTML='<div class="shell">'+hero('עקבו אחרי השרשרת. אל תמהרו ללחוץ.')+'<section class="card"><div class="open-clue">הקצה הפתוח: „'+esc(d.currentClue||'התחלה')+'”</div>'+progress(d.chainCount||0)+(mine?'<div class="mytile"><div class="tiny" style="text-align:center;margin-bottom:8px">הקובייה שלך</div>'+tile(mine)+'<button class="btn pri press" id="playTile">הקובייה שלי מתאימה</button><div class="feedback" id="playFeedback"></div></div>':'<div class="waiting" style="margin-top:18px">כרגע אין לך קובייה. המשך לעקוב אחרי השרשרת — ייתכן שתקבל קובייה בהמשך.</div>')+'</section></div>';
   const b=document.getElementById('playTile');if(b)b.onclick=async()=>{b.disabled=true;const f=document.getElementById('playFeedback');f.className='feedback';f.textContent='בודקים…';try{const r=await post({action:'play',playerId:pid});if(r.correct){f.className='feedback ok';f.textContent='✓ נכון! הקובייה שלך נכנסה לשרשרת.';setTimeout(renderStudent,700);}else{f.className='feedback bad';f.textContent='עדיין לא. המשך לעקוב ולהמתין לרגע המתאים.';b.disabled=false;}}catch(e){f.className='feedback bad';f.textContent='לא ניתן לבדוק כרגע. נסו שוב.';b.disabled=false;}};
  }
  startPoll(async()=>{try{const n=await get({playerId:pid});if(n.version!==d.version||n.phase!==d.phase||((n.myTile&&n.myTile.id)!==(d.myTile&&d.myTile.id)))renderStudent();}catch(e){}});
 }catch(e){joinForm(saved);}
}
if(!code){root.innerHTML='<div class="shell">'+hero()+'<section class="card"><h2>חסר קוד כיתה</h2><p class="muted">פתחו את הקישור שקיבלתם מהמורה.</p></section></div>';return;}
if(mode==='teacher')renderTeacher();else if(mode==='projector')renderProjector();else renderStudent();
})();
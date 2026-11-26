// Admin screen. Every call is checked on the server against the is_admin flag of the signed-in account.
(function(){
  const CFG=window.EC_CONFIG||{},$=id=>document.getElementById(id),out=$('out');
  const esc=t=>String(t==null?'':t).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const when=t=>t?new Date(t).toLocaleString('he-IL',{dateStyle:'short',timeStyle:'short'}):'';
  let ses=null;try{ses=JSON.parse(localStorage.getItem('eternal-cycle-session')||'null');}catch(e){}
  async function call(kind,args){
    const r=await fetch(CFG.url+'/functions/v1/act',{method:'POST',headers:{'Content-Type':'application/json',apikey:CFG.anon,'x-ec-token':ses.token},body:JSON.stringify({kind:kind,args:args||{}})});
    return r.json();
  }
  const btn=(label,a,u,h,cls)=>'<button data-a="'+a+'" data-u="'+esc(u)+'"'+(h?' data-h="'+h+'"':'')+(cls?' class="'+cls+'"':'')+'>'+label+'</button>';
  function render(d,note){
    let h=note?'<div class="card"><b>'+note+'</b></div>':'';
    h+='<div class="card stats"><div><b>'+d.users+'</b>חשבונות</div><div><b>'+d.online+'</b>מחוברים עכשיו</div><div><b>'+d.day+'</b>פעילים ביממה</div></div>';
    h+='<h2>חשודים ביממה האחרונה</h2><p class="dim">דיווחי חיסולים שהשרת קיצץ. "בוטים" הם דיווחים שלא ייתכנו במשחק רגיל. חמישה כאלה בשעה משעים את החשבון אוטומטית.</p><div class="card">';
    if(!d.suspects.length)h+='<p class="dim">אין.</p>';
    for(const s of d.suspects)h+='<div class="row"><span><b>'+esc(s.u)+'</b> · רמה '+(s.l||'?')+' · ריסטים '+(s.r||0)+' · קיצוצים '+s.c+' · בוטים '+s.b+' · השעיות '+s.s+(s.ban&&new Date(s.ban)>new Date()?' · <span class="dim">מושעה</span>':'')+'</span><span>'+btn('השעה ליום','ban',s.u,24,'bad')+' '+btn('שבוע','ban',s.u,168,'bad')+' '+btn('לצמיתות','ban',s.u,876000,'bad')+'</span></div>';
    h+='</div><h2>מושעים</h2><div class="card">';
    if(!d.banned.length)h+='<p class="dim">אין.</p>';
    for(const s of d.banned)h+='<div class="row"><span><b>'+esc(s.u)+'</b> · עד '+when(s.until)+' · '+(s.why==='auto'?'אוטומטי':'ידני')+'</span>'+btn('בטל השעיה','unban',s.u)+'</div>';
    h+='</div><h2>מושתקים בצ\'אט</h2><div class="card">';
    if(!d.muted.length)h+='<p class="dim">אין.</p>';
    for(const s of d.muted)h+='<div class="row"><span><b>'+esc(s.u)+'</b> · עד '+when(s.until)+'</span>'+btn('בטל השתקה','unmute',s.u)+'</div>';
    h+='</div><h2>פעולה לפי שם משתמש</h2><div class="card"><div class="row"><input id="who" placeholder="שם משתמש" autocomplete="off"><span>'+btn('השעה ליום','ban','#',24,'bad')+' '+btn('בטל השעיה','unban','#')+' '+btn('השתק ליום','mute','#',24)+' '+btn('סיסמה זמנית','reset','#')+'</span></div><p class="dim">סיסמה זמנית: רק אחרי שווידאת בדרך אחרת שזה בעל החשבון. הסיסמה הישנה מפסיקה לעבוד מיד.</p></div>';
    h+='<h2>צ\'אט אחרון</h2><div class="card">';
    if(!d.chat.length)h+='<p class="dim">אין הודעות.</p>';
    for(const c of d.chat)h+='<div class="row"><span><small>'+when(c.at)+' · '+(c.c==='g'?'גילדה':'כולם')+'</small><br><b>'+esc(c.n)+'</b> <small>('+esc(c.u)+')</small>: <span dir="auto">'+esc(c.m)+'</span></span><span>'+btn('מחק','delmsg',c.i)+' '+btn('השתק ליום','mute',c.u,24)+'</span></div>';
    out.innerHTML=h+'</div>';
  }
  async function load(note){
    if(!CFG.url||!ses||!ses.token){out.innerHTML='<p>צריך להיכנס למשחק קודם, עם חשבון מנהל.</p>';return;}
    let j=null;try{j=await call('aview',{});}catch(e){}
    if(!j||!j.result||!j.result.ok){out.innerHTML='<p>'+(j&&j.result?'לחשבון הזה אין הרשאת ניהול.':'אין חיבור לשרת.')+'</p>';return;}
    render(j.admin,note);
  }
  out.addEventListener('click',async e=>{
    const b=e.target.closest('button[data-a]');if(!b)return;
    let u=b.dataset.u;if(u==='#'){u=($('who').value||'').trim();if(!u)return;}
    b.disabled=true;let j=null;
    try{
      if(b.dataset.a==='reset'){j=await call('aresetpw',{user:u});await load(j&&j.ok?'סיסמה זמנית ל-'+esc(u)+': <span dir="ltr">'+esc(j.temp)+'</span>':esc(j&&j.msg||'הפעולה נכשלה'));return;}
      j=await call('aact',{action:b.dataset.a,target:u,hours:+b.dataset.h||24});
    }catch(err){}
    if(j&&j.result&&j.result.ok)render(j.admin,'בוצע');else await load(esc(j&&j.result&&j.result.msg||'הפעולה נכשלה'));
  });
  load();
})();

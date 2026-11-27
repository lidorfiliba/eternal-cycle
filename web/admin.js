// Admin screen. Every call is checked on the server against the is_admin flag of the signed-in account.
(function(){
  const CFG=window.EC_CONFIG||{},$=id=>document.getElementById(id),out=$('out');
  const esc=t=>String(t==null?'':t).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const when=t=>t?new Date(t).toLocaleString('he-IL',{dateStyle:'short',timeStyle:'short'}):'';
  let ses=null;try{ses=JSON.parse(localStorage.getItem('eternal-cycle-session')||'null');}catch(e){}
  async function call(kind,args){
    const r=await fetch((CFG.api||CFG.url+'/functions/v1/act'),{method:'POST',headers:{'Content-Type':'application/json',apikey:CFG.anon,'x-ec-token':ses.token},body:JSON.stringify({kind:kind,args:args||{}})});
    return r.json();
  }
  const btn=(label,a,u,h,cls)=>'<button data-a="'+a+'" data-u="'+esc(u)+'"'+(h?' data-h="'+h+'"':'')+(cls?' class="'+cls+'"':'')+'>'+label+'</button>';
  let shop=null,backups=[],logRows=null,grant=null,grantArgs=null,logF={user:'',kind:''};
  const GW=[['gold','זהב'],['gems','אבני נשמה'],['boxes','תיבות אוצר'],['cred','אותות ריסט'],['keys','מפתחות מצודה'],['coins','מטבעות עונה'],['tickets','כרטיסי זירה'],['boost','דקות של 50% ניסיון']];
  const LK={log:'פעולה',grant:'נתינה או לקיחה',clamp:'קיצוץ חיסולים',ban:'השעיה',unban:'ביטול השעיה',mute:'השתקה',resetpw:'איפוס סיסמה'};
  const LA={create:'דמות חדשה',switch:'החלפת דמות',reset:'ריסט',buy:'קנייה בחנות',wingEvolve:'פיתוח כנפיים',craftKey:'יצירת מפתח מצודה',evEnter:'כניסה למצודה',evLeave:'יציאה מהמצודה',openBox:'פתיחת תיבה',respec:'חלוקה מחדש של נקודות',claimEvent:'פרס אירוע',claimWorld:'פרס בוס העולם',claimWeek:'פרס שבועי',claimPass:'פרס עונה',claimLogin:'פרס כניסה יומי',towerEnd:'סיום מגדל',trialEnd:'סיום אתגר היום',duelEnd:'סיום דו-קרב',gcreate:'הקמת גילדה',exAdd:'אבן שלמות',egg:'ביצה',upgrade:'שדרוג פריט',sellRar:'מכירה לפי נדירות',sellJunk:'מכירת זבל',bankPut:'הפקדה בבנק',bankTake:'משיכה מהבנק',tick:'שלל מיוחד',mlist:'העלאה לשוק',mbuy:'קנייה בשוק',mcancel:'הורדה מהשוק',gjoin:'הצטרפות לגילדה',gleave:'עזיבת גילדה',gkick:'הוצאה מגילדה',pcreate:'יצירת פארטי',pjoin:'הצטרפות לפארטי',pleave:'עזיבת פארטי',onew:'בקשת תרומה',aact:'פעולת ניהול',aset:'שינוי הגדרה',abackup:'גיבוי',arestore:'שחזור חשבון',aodecide:'החלטה על תרומה',agrant:'נתינה או לקיחה',login:'כניסה',loginFail:'כניסה שנכשלה',gm:'פקודת מנהל משחק',lastCircleEnd:'המעגל האחרון הסתיים',siegeEnd:'מצור הסתיים'};
  const flat=o=>o&&typeof o==='object'?Object.keys(o).map(k=>k+': '+(o[k]&&typeof o[k]==='object'?JSON.stringify(o[k]):o[k])).join(' · '):'';
  function logRow(x){const d=x.d||{},act=x.kind==='log'?(LA[d.k]||d.k||''):(LK[x.kind]||x.kind);
    const who=(x.u?'<b>'+esc(x.u)+'</b>':'<span class="dim">המשחק</span>')+(d.c?' ('+esc(d.c)+' · רמה '+(d.l|0)+' · ריסטים '+(d.rs|0)+')':'');
    const more=[d.a?flat(d.a):'',d.r?flat(d.r):'',Array.isArray(d.n)?d.n.join(', '):'',d.items?JSON.stringify(d.items):'',x.kind!=='log'?flat(d):''].filter(Boolean).join(' | ');
    return '<div class="row"><span>'+who+' · <b>'+esc(act)+'</b>'+(more?'<br><small dir="auto">'+esc(more)+'</small>':'')+'</span><span class="dim">'+when(x.at)+'</span></div>';}
  function render(d,note){
    let h=note?'<div class="card"><b>'+note+'</b></div>':'';
    h+='<div class="card stats"><div><b>'+d.users+'</b>חשבונות</div><div><b>'+d.online+'</b>מחוברים עכשיו</div><div><b>'+d.day+'</b>פעילים ביממה</div></div>';
    if(shop){h+='<h2>תרומות וקרדיטים</h2><div class="card stats"><div><b>'+shop.paid_total+'</b>ש"ח אושרו</div><div><b>'+shop.paid_count+'</b>תרומות</div><div><b>'+shop.pending.length+'</b>ממתינות</div></div><div class="card">';
      if(!shop.pending.length)h+='<p class="dim">אין בקשות ממתינות.</p>';
      for(const o of shop.pending)h+='<div class="row"><span><b>'+esc(o.u)+'</b> ('+esc(o.n)+') · '+o.credits+' קרדיטים · <b>'+o.price+' ש"ח</b><br><small>'+when(o.at)+' · מזהה תרומה: <span dir="auto">'+esc(o.ref)+'</span></small></span><span>'+btn('התרומה התקבלה, אשר','ook',o.id)+' '+btn('דחה','ono',o.id,0,'bad')+'</span></div>';
      h+='</div><p class="dim">אשר רק אחרי שראית את הכסף אצלך. אישור מוסיף את הקרדיטים מיד ואי אפשר לבטל אותו מכאן.</p><div class="card"><p><b>הוראות התרומה שהשחקנים רואים</b></p><textarea id="payInfo" rows="4" style="width:100%;background:#0a0818;border:1px solid #2d2650;border-radius:9px;padding:8px 10px;color:#ece8ff;font:inherit" placeholder="למשל: העברה בביט למספר ... על שם ... . כל עוד השדה ריק, התרומות סגורות.">'+esc(shop.pay)+'</textarea><p>'+btn('שמור הוראות','pay','-')+'</p>';
      if(shop.recent.length){h+='<p class="dim">אחרונות:</p>';for(const o of shop.recent)h+='<div class="row"><span>'+esc(o.u)+' · '+o.credits+' קרדיטים · '+o.price+' ש"ח</span><span class="dim">'+(o.status==='paid'?'אושר':'נדחה')+' · '+when(o.at)+'</span></div>';}
      h+='</div>';}
    h+='<h2>נתינה ולקיחה</h2><div class="card"><p class="dim">פעולה אחת על חשבון אחד. קודם רואים על מי ומה ישתנה, ורק אז מאשרים. כל פעולה נרשמת ביומן עם השם שלך. מספר שלילי לוקח.</p><div class="row"><input id="gUser" placeholder="שם משתמש או שם דמות" autocomplete="off" value="'+esc(grantArgs?grantArgs.user:'')+'"><select id="gWhat">'+GW.map(w=>'<option value="'+w[0]+'"'+(grantArgs&&grantArgs.what===w[0]?' selected':'')+'>'+w[1]+'</option>').join('')+'</select><input id="gN" placeholder="כמות" inputmode="numeric" dir="ltr" style="max-width:110px" value="'+esc(grantArgs?grantArgs.n:'')+'">'+btn('בדוק','gchk','-')+'</div>';
    if(grant)h+='<p>'+(grant.done?'<b>בוצע.</b> ':'<b>לפני אישור:</b> ')+'משתמש <b>'+esc(grant.user)+'</b> · דמויות: '+esc((grant.chars||[]).join(', '))+' · '+esc(grant.what)+': <b dir="ltr">'+grant.before+' → '+grant.after+'</b></p>'+(grant.done?'':'<p>'+btn('אשר ובצע','ggo','-','', 'bad')+'</p>');
    h+='</div><h2>יומן המשחק</h2><div class="card"><div class="row"><input id="lUser" placeholder="שם משתמש (ריק = כולם)" autocomplete="off" value="'+esc(logF.user)+'"><select id="lKind"><option value="">הכול</option>'+Object.keys(LK).map(k=>'<option value="'+k+'"'+(logF.kind===k?' selected':'')+'>'+LK[k]+'</option>').join('')+'</select>'+btn(logRows?'רענן':'הצג את היומן','log','-')+'</div>'+(logRows?(logRows.length?logRows.map(logRow).join(''):'<p class="dim">אין רשומות.</p>')+'<p class="dim">300 הרשומות האחרונות. חיסולים רגילים לא נרשמים אחד אחד, רק שלל מיוחד.</p>':'')+'</div>';
    h+='<h2>גיבויים</h2><div class="card">'+(backups.length?'':'<p class="dim">עוד אין גיבוי.</p>');
    for(const b of backups)h+='<div class="row"><span><b>'+esc(b.day)+'</b> · '+b.accounts+' חשבונות · '+b.kb+' ק"ב</span><span class="dim">'+when(b.at)+'</span></div>';
    h+='<p>'+btn('גבה עכשיו','bak','-')+'</p><div class="row"><input id="rsUser" placeholder="שם משתמש לשחזור" autocomplete="off"><input id="rsDay" placeholder="תאריך, למשל 2026-11-27" autocomplete="off" dir="ltr">'+btn('שחזר חשבון','rst','-',0,'bad')+'</div><p class="dim">גיבוי אוטומטי כל לילה ב-03:10, נשמרים שבעה ימים. שחזור מחזיר את המשחק השמור של חשבון אחד למצב של אותו יום ומוחק את מה שהשיג מאז.</p></div>';
    h+='<h2>דיווחים של שחקנים</h2><div class="card">'+((d.reports||[]).length?'':'<p class="dim">אין דיווחים.</p>');for(const r of d.reports||[])h+='<div class="row"><span><b>'+esc(r.name)+'</b> '+esc(r.msg)+'</span><span class="dim">'+when(r.at)+'</span></div>';h+='</div>';
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
    try{const s=await call('aorders',{});if(s&&s.shop)shop=s.shop;if(s&&s.backups)backups=s.backups;}catch(e){}
    render(j.admin,note);
  }
  out.addEventListener('click',async e=>{
    const b=e.target.closest('button[data-a]');if(!b)return;
    let u=b.dataset.u;if(u==='#'){u=($('who').value||'').trim();if(!u)return;}
    b.disabled=true;let j=null;
    try{
      if(b.dataset.a==='ook'||b.dataset.a==='ono'){if(b.dataset.a==='ook'&&!confirm('לאשר שהתרומה התקבלה ולהוסיף את הקרדיטים?')){b.disabled=false;return;}j=await call('aodecide',{id:+u,ok:b.dataset.a==='ook'});await load(j&&j.result&&j.result.ok?'בוצע':esc(j&&j.result&&j.result.msg||'הפעולה נכשלה'));return;}
      if(b.dataset.a==='gchk'||b.dataset.a==='ggo'){
        if(b.dataset.a==='gchk')grantArgs={user:($('gUser').value||'').trim(),what:$('gWhat').value,n:Math.trunc(+($('gN').value||0))};
        if(!grantArgs||!grantArgs.user||!grantArgs.n){b.disabled=false;return;}
        j=await call('agrant',Object.assign({},grantArgs,{go:b.dataset.a==='ggo'}));grant=j&&j.result&&j.result.ok?j.grant:null;if(grant&&grant.done&&logRows){const l=await call('alog',logF);if(l&&l.log)logRows=l.log;}
        await load(grant?(grant.done?'בוצע ונרשם ביומן':''):esc(j&&j.result&&j.result.msg||'הפעולה נכשלה'));return;}
      if(b.dataset.a==='log'){logF={user:($('lUser').value||'').trim(),kind:$('lKind').value};j=await call('alog',logF);if(j&&j.result&&j.result.ok)logRows=j.log;await load(j&&j.result&&j.result.ok?'':esc(j&&j.result&&j.result.msg||'היומן לא נטען'));return;}
      if(b.dataset.a==='bak'){j=await call('abackup',{});await load(j&&j.result&&j.result.ok?'הגיבוי נלקח':esc(j&&j.result&&j.result.msg||'הגיבוי נכשל'));return;}
      if(b.dataset.a==='rst'){const us=($('rsUser').value||'').trim(),dy=($('rsDay').value||'').trim();if(!us||!dy||!confirm('לשחזר את '+us+' ליום '+dy+'? מה שהשיג מאז יימחק.')){b.disabled=false;return;}j=await call('arestore',{user:us,day:dy});await load(j&&j.result&&j.result.ok?'החשבון שוחזר':esc(j&&j.result&&j.result.msg||'השחזור נכשל'));return;}
      if(b.dataset.a==='pay'){j=await call('aset',{key:'pay_info',value:$('payInfo').value});await load(j&&j.result&&j.result.ok?'ההוראות נשמרו':'השמירה נכשלה');return;}
      if(b.dataset.a==='reset'){j=await call('aresetpw',{user:u});await load(j&&j.ok?'סיסמה זמנית ל-'+esc(u)+': <span dir="ltr">'+esc(j.temp)+'</span>':esc(j&&j.msg||'הפעולה נכשלה'));return;}
      j=await call('aact',{action:b.dataset.a,target:u,hours:+b.dataset.h||24});
    }catch(err){}
    if(j&&j.result&&j.result.ok)render(j.admin,'בוצע');else await load(esc(j&&j.result&&j.result.msg||'הפעולה נכשלה'));
  });
  load();
})();

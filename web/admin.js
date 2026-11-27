// Management screen. It has its own sign-in: user name, password and a code from an authenticator app. It never
// borrows the game's session, and its own lasts a day and ends when the tab is closed. Every call is checked on the
// server against the is_admin flag of the account and against a session that passed the second step.
(function(){
  const CFG=window.EC_CONFIG||{},$=id=>document.getElementById(id),out=$('out');
  const esc=t=>String(t==null?'':t).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const when=t=>t?new Date(t).toLocaleString('he-IL',{dateStyle:'short',timeStyle:'short'}):'';
  const KEY='eternal-cycle-admin';let ses=null;try{ses=JSON.parse(sessionStorage.getItem(KEY)||'null');}catch(e){}
  const keep=v=>{ses=v;try{if(v)sessionStorage.setItem(KEY,JSON.stringify(v));else sessionStorage.removeItem(KEY);}catch(e){}};
  const post=async(kind,args,tok)=>{const h={'Content-Type':'application/json',apikey:CFG.anon};if(tok)h['x-ec-token']=tok;return (await fetch((CFG.api||CFG.url+'/functions/v1/act'),{method:'POST',headers:h,body:JSON.stringify({kind:kind,args:args||{}})})).json();};
  let sign={step:'in',user:'',pass:'',tok:'',sec:null,codes:null};
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
  // ----- signing in -----
  function signForm(msg){
    const bad=msg?'<p style="color:#ff8a9c">'+esc(msg)+'</p>':'';let h='<div class="card">';
    if(sign.step==='in')h+='<h2>כניסה למסך הניהול</h2><p class="dim">כניסה נפרדת מהמשחק: שם משתמש, סיסמה, ואז קוד מאפליקציית האימות בטלפון.</p><p><input id="sUser" placeholder="שם משתמש" autocomplete="username" autocapitalize="none" value="'+esc(sign.user)+'"></p><p><input id="sPass" type="password" placeholder="סיסמה" autocomplete="current-password"></p>'+bad+'<p><button data-a="sIn" data-u="">המשך</button></p>';
    else if(sign.step==='code')h+='<h2>קוד אימות</h2><p>פתח את אפליקציית האימות בטלפון והקלד את 6 הספרות שמופיעות ליד "EternalCycle".</p><p><input id="sCode" inputmode="numeric" autocomplete="one-time-code" maxlength="16" placeholder="6 ספרות" dir="ltr"></p><p class="dim">אין לך את הטלפון? הקלד כאן אחד מקודי החירום שקיבלת בהפעלה.</p>'+bad+'<p><button data-a="sCode" data-u="">כניסה</button> <button data-a="sBack" data-u="">חזרה</button></p>';
    else if(sign.step==='setup')h+='<h2>הגדרה חד-פעמית: אימות בטלפון</h2><p>מסך הניהול נפתח רק עם קוד מהטלפון, כדי שסיסמה שדלפה לא תספיק לאף אחד. עושים את זה פעם אחת:</p><p><b>1.</b> התקן בטלפון אפליקציית אימות, למשל Google Authenticator.</p><p><b>2.</b> באפליקציה בחר "הוספת חשבון" ואז "הזנת מפתח", והקלד את המפתח הזה:</p><p dir="ltr" style="font-family:monospace;font-size:17px;word-break:break-all;user-select:all;text-align:center">'+esc(sign.sec.secret)+'</p><p class="dim">אם אתה גולש עכשיו מהטלפון עצמו: <a href="'+esc(sign.sec.uri)+'">לחץ כאן וזה ייפתח באפליקציה</a>.</p><p><b>3.</b> האפליקציה תציג 6 ספרות שמתחלפות כל חצי דקה. הקלד אותן כאן:</p><p><input id="sCode" inputmode="numeric" maxlength="6" placeholder="6 ספרות" dir="ltr"></p>'+bad+'<p><button data-a="sOn" data-u="">סיימתי</button></p>';
    else if(sign.step==='codes')h+='<h2>כמעט סיימנו: קודי חירום</h2><p>מעכשיו נכנסים לכאן עם סיסמה ועם 6 הספרות מהטלפון. זה הכול.</p><p><b>ומה אם הטלפון יאבד או יישבר?</b> בשביל זה יש 8 קודי חירום. כל אחד מהם מחליף פעם אחת את הספרות מהטלפון. לא צריך לזכור אותם ולא משתמשים בהם ביום-יום: רק שומרים אותם.</p><p dir="ltr" style="font-family:monospace;font-size:16px;line-height:1.9;text-align:center;user-select:all">'+sign.codes.map(esc).join('<br>')+'</p><p><b>מה לעשות עכשיו:</b> צלם את המסך הזה, או העתק את הקודים לפתק, ושמור במקום שאינו הטלפון. הם לא יוצגו שוב.</p><p class="dim">אם אבדו גם הטלפון וגם הקודים, מי שמתחזק את השרת יכול לאפס את האימות ישירות במסד הנתונים. החשבון לא אובד.</p><p><button data-a="sDone" data-u="">שמרתי, המשך למסך הניהול</button></p>';
    out.innerHTML=h+'</div>';
  }
  async function signDo(a){
    const v=id=>$(id)?($(id).value||'').trim():'';let j=null;
    if(a==='sBack'){sign={step:'in',user:sign.user,pass:'',tok:'',sec:null,codes:null};return signForm();}
    if(a==='sDone'){const t=sign.tok,u=sign.user;sign={step:'in',user:'',pass:'',tok:'',sec:null,codes:null};keep({token:t,user:u});return load();}
    try{
      if(a==='sIn'||a==='sCode'){if(a==='sIn'){sign.user=v('sUser');sign.pass=$('sPass')?$('sPass').value:'';}
        if(!sign.user||!sign.pass)return signForm('הקלד שם משתמש וסיסמה');const code=a==='sCode'?v('sCode'):'';if(a==='sCode'&&code.length<6)return signForm('הקלד את הקוד');
        j=await post('login',{user:sign.user,pass:sign.pass,code:code||undefined,mgmt:true});
        if(!j)return signForm('אין חיבור לשרת');if(!j.ok){if(j.tfa){sign.step='code';return signForm(a==='sCode'?j.msg:'');}return signForm(j.msg||'הכניסה נכשלה');}
        if(j.strong){const p=sign;sign={step:'in',user:'',pass:'',tok:'',sec:null,codes:null};keep({token:j.token,user:j.user});p.pass='';return load();}
        const w=await post('whoami',{},j.token);if(!w||!w.ok||!w.admin){sign.pass='';return signForm('לחשבון הזה אין הרשאת ניהול');}
        const st=await post('tfaStart',{pass:sign.pass},j.token);if(!st||!st.ok)return signForm(st&&st.msg||'ההגדרה לא התחילה');sign.tok=j.token;sign.sec=st;sign.step='setup';return signForm();}
      if(a==='sOn'){j=await post('tfaOn',{code:v('sCode'),mgmt:true},sign.tok);if(!j||!j.ok)return signForm(j&&j.msg||'הקוד לא התקבל');sign.pass='';sign.tok=j.token;sign.codes=j.codes;sign.step='codes';return signForm();}
    }catch(e){signForm('אין חיבור לשרת');}
  }
  function render(d,note){
    let h='<p class="dim">מחובר כ-<b dir="auto">'+esc(ses&&ses.user||'')+'</b> · <button data-a="sOut" data-u="">יציאה</button> · <button data-a="sNew" data-u="">קודי חירום חדשים</button></p>'+(note?'<div class="card"><b>'+note+'</b></div>':'');
    h+='<div class="card"><h2>אירועים וכלי משחק</h2><p class="dim">פועל מיד על כל המחוברים, ונרשם ביומן.</p>'+
      '<p><b>הודעה לכולם</b><br><input id="gmSay" maxlength="120" placeholder="טקסט ההודעה" style="width:70%"> <button data-a="gm" data-u="say">שלח</button></p>'+
      '<p><b>בונוס לכולם</b><br>ניסיון × <input id="gmXp" value="1.5" size="3"> שלל × <input id="gmDrop" value="1" size="3"> למשך <input id="gmMin" value="30" size="3"> דקות <button data-a="gm" data-u="boost">הפעל</button> <button data-a="gm" data-u="boost0">בטל בונוס</button></p>'+
      '<p><b>המעגל האחרון</b><br>הרשמה של <input id="gmSec" value="90" size="3"> שניות <button data-a="gm" data-u="br">פתח</button> <button data-a="gm" data-u="brStop">בטל הרשמה</button></p>'+
      '<p><b>מצור</b><br>למשך <input id="gmSg" value="12" size="3"> דקות: <button data-a="gm" data-u="siege">מצור ידידות</button> <button data-a="gm" data-u="siegeBots4">אימון מול בוטים 4 מול 4</button> <button data-a="gm" data-u="siegeBots6">אימון 6 מול 6</button> <button data-a="gm" data-u="siegeStop">עצור מצור</button></p></div>';
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
    if(!ses||!ses.token)return signForm();
    let j=null;try{j=await call('aview',{});}catch(e){}
    if(j&&(j.error==='auth'||(j.result&&j.result.need2fa))){keep(null);return signForm(j.error==='auth'?'פג תוקף הכניסה. היכנס שוב':'');}
    if(!j||!j.result||!j.result.ok){out.innerHTML='<p>'+(j&&j.result?'לחשבון הזה אין הרשאת ניהול.':'אין חיבור לשרת.')+'</p><p><button data-a="sOut" data-u="">יציאה</button></p>';return;}
    try{const s=await call('aorders',{});if(s&&s.shop)shop=s.shop;if(s&&s.backups)backups=s.backups;}catch(e){}
    render(j.admin,note);
  }
  out.addEventListener('click',async e=>{
    const b=e.target.closest('button[data-a]');if(!b)return;
    if(b.dataset.a==='sNew'){const c=prompt('הקלד את 6 הספרות שמופיעות עכשיו באפליקציית האימות. הקודים הישנים יפסיקו לעבוד.');if(!c)return;let r=null;try{r=await post('tfaCodes',{code:c.trim()},ses.token);}catch(err){}if(!r||!r.ok){await load(esc(r&&r.msg||'הפעולה נכשלה'));return;}sign={step:'codes',user:ses.user,pass:'',tok:ses.token,sec:null,codes:r.codes};return signForm();}
    if(b.dataset.a==='sOut'){keep(null);sign={step:'in',user:'',pass:'',tok:'',sec:null,codes:null};return signForm();}
    if(b.dataset.a[0]==='s'&&['sIn','sCode','sBack','sOn','sDone'].indexOf(b.dataset.a)>=0){b.disabled=true;await signDo(b.dataset.a);return;}
    if(b.dataset.a==='gm'){const k=b.dataset.u,n=id=>+($(id)?$(id).value:0)||0,m=k==='say'?{a:'say',m:$('gmSay').value}:k==='boost'?{a:'boost',xp:n('gmXp'),drop:n('gmDrop'),min:n('gmMin')}:k==='boost0'?{a:'boost',min:0}:k==='br'?{a:'br',sec:n('gmSec')}:k==='siege'?{a:'siege',min:n('gmSg')}:k==='siegeBots4'?{a:'siegeBots',min:n('gmSg'),n:4}:k==='siegeBots6'?{a:'siegeBots',min:n('gmSg'),n:6}:{a:k};
      if((k==='boost'||k==='say'||k==='siege')&&!confirm('לבצע עכשיו על כל המחוברים?'))return;b.disabled=true;let r=null;try{r=await call('agm',m);}catch(err){}await load(esc(r&&r.result&&r.result.msg||'הפעולה נכשלה'));return;}
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

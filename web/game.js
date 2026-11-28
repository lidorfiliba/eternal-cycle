import * as G from './core.js';
const BUILD='20261128165855';
const {CITY_SHOP,CITY_WEEK,TRIAL_TRIES,TRIAL_T,TRIAL_RW,TRIAL_MOD,TRIAL_MEDAL,dayNum,BANK,bankCap,wskinOn,CAPEN,EXB,exCount,keepStart,keepGate,SG,sgCamp,sgMove,PETN,PETN2,PET_DAYS,PET_BOX,petOn,setBoost,boostNow,BR,brRing,brWindow,JEWV,SETN2,SETB2,setKey,setName,setTable,PERFECT_M,mastery,masteryNeed,MASTERY_PCT,ELITE_HP,TOWER_TRIES,towerBoss,towerReward,LIVE_W,LIVE_RNG,LIVE_LANE,liveFrom,liveAct,liveOver,worldReward,RESPEC_COST,WEEKLY,SIDEQ,pickOf,reqOf,canWear,WING_MAX,wingFeathers,wingChance,DUEL_LIVE,PASS_MAX,PASS_STEP,PASS_DAY,tierOf,REGION,KEY_SHARDS,KEY_GOLD,KEEP_GATE,KEEP_HP,keepOpen,PACKS,PREM_SHOP,TIER_MIN,evTier,tierRange,tierReward,isFull,STAT_MAX,PARTY_SHARE,LOGIN_RW,AURAS,partyXp,GUILD_FEE,SECRET_Q,siegeInfo,FLOORS,floorMin,zs,canFloor,afkFloor,EVENTS,QUIZ,localMin,evWindows,evMods,evNext,quizFor,BASEZ,canEnter,PARTY_XP,setEnv,CAP,ZONES,MHP,ZSPR,CLS,STATN,RAR,TIERN,WINGN,AFF,POOL,SLOTS,SLOTN,SETN,SETB,rslot,isSet,setCounts,UPCH,clamp,need,pois,tzParts,dayKey,seasonKey,AFK,SHARED,newAccount,newChar,bind,ensureDay,itemVals,itemName,itemScore,calc,zoneInfo,afkZone,autoAlloc,addXp,rollAff,makeItem,rollRar,sellVal,stash,gainItem,rollLoot,offline,canReset,resetGain,doReset,upCost,upChance,upgrade,openBox,passReward,passLevel,TASKS,fighter,simDuel,BOSSN,GOLD_SHOP,RESET_SHOP,SEASON_SHOP,totalResets,slotsOpen,anyEq,QUESTS,give,numOr,int,gearOr,cleanPlayer,cleanItem,adopt,findIt,maxKps,BOTN,buildOpps,apply,BAG,MATK,SKLV,SKCD,DROPS,ARM}=G;
import {tr,getLang,setLang,startLang} from './i18n.js';
const PG=p=>p+(getLang()==='en'?'.en':'')+'.html'; // the terms and privacy pages exist in both languages
const CFG=window.EC_CONFIG||{},ONLINE=!!CFG.url;


/* ---------- state, storage, server ---------- */
const KEY='eternal-cycle-v2',PKEY='eternal-cycle-prefs';
let A=null,S=null,C=null,statsDirty=true,panelDirty=true,tab='char',demo=false,busy=false,localDirty=false;
let prefs={mute:false};try{Object.assign(prefs,JSON.parse(localStorage.getItem(PKEY)||'{}'));}catch(e){}
const savePrefs=()=>{try{localStorage.setItem(PKEY,JSON.stringify(prefs));}catch(e){}};
// Controls the player sets for himself: which key does what on a keyboard, and how large the touch controls are.
// Fight keys and map-skill keys are two separate sets, so the same key may serve in both.
const KEYDEF={atk:' ',s0:'1',s1:'2',s2:'3',s3:'4',dash:'q',pot:'e',buf:'r',bash:'f',use:'g',k0:'1',k3:'2',k4:'3',k5:'4',k6:'q',k7:'e',k2:'r',k1:'f'};
const KEYS_FIGHT=[['atk','תקיפה'],['s0','מיומנות ראשונה'],['s1','מיומנות מהממת'],['s3','מיומנות גדולה'],['s2','מגן'],['dash','צעד'],['pot','שיקוי'],['buf','באף לקבוצה'],['bash','הדיפה'],['use','לחיצה על מתג או כתר']];
const KEYS_FARM=[['k0','מיומנות ראשונה'],['k3','מיומנות חזקה'],['k5','מיומנות גדולה'],['k4','מגן'],['k6','צעד'],['k7','שיקוי'],['k2','באף'],['k1','משיכת מפלצות']]; // the same hands as in a fight: 1 2 4 3 Q E R F
// A key is known by where it sits on the keyboard, not by the letter the current language puts on it: E is E in Hebrew too.
const evKey=e=>{const c=e.code||'';if(/^Key[A-Z]$/.test(c))return c[3].toLowerCase();if(/^Digit[0-9]$/.test(c))return c[5];if(/^Numpad[0-9]$/.test(c))return c[6];if(c==='Space')return ' ';return e.key||'';};
const keyOf=a=>(prefs.keys&&prefs.keys[a])||KEYDEF[a],keyName=k=>k===' '?'רווח':k.length===1?k.toUpperCase():k;
const keyAct=(list,k)=>{for(const x of list)if(keyOf(x[0])===k)return x[0];return '';};
const keyTaken=k=>!!(keyAct(KEYS_FIGHT,k)||keyAct(KEYS_FARM,k));
function applySizes(){const st=document.documentElement.style;st.setProperty('--mvS',clampN(prefs.mvS,70,160)/100);st.setProperty('--atS',clampN(prefs.atS,70,160)/100);}
function clampN(v,a,b){v=Number(v)||100;return Math.max(a,Math.min(b,v));}
let bindWait='';
function settingsHtml(){
  const row=x=>'<div class="kv" style="margin:4px 0"><span>'+x[1]+'</span><button class="btn sm'+(bindWait===x[0]?' pri':'')+'" data-act="bindKey" data-k="'+x[0]+'" style="min-width:86px">'+(bindWait===x[0]?'לחץ על מקש':keyName(keyOf(x[0])))+'</button></div>';
  return '<h2>הגדרות שליטה</h2><p class="hint">גודל הכפתורים במסך מגע</p>'+
    '<button class="btn'+(fastOn()?' pri':'')+'" data-act="fastGfx" style="width:100%;margin-bottom:6px">'+(fastOn()?'גרפיקה מהירה: פעילה':'גרפיקה מהירה: כבויה')+'</button><p class="hint" style="margin-bottom:10px">גרפיקה מהירה מוותרת על הזוהר הרך סביב כנפיים, סטים ואפקטים, והמשחק רץ חלק הרבה יותר. מומלץ בטלפון.</p>'+
    '<div class="kv"><span>כפתורי תנועה</span><b class="num" id="szMvV">'+clampN(prefs.mvS,70,160)+'%</b></div><input type="range" id="szMv" min="70" max="160" step="5" value="'+clampN(prefs.mvS,70,160)+'" style="width:100%">'+
    '<div class="kv"><span>כפתורי תקיפה</span><b class="num" id="szAtV">'+clampN(prefs.atS,70,160)+'%</b></div><input type="range" id="szAt" min="70" max="160" step="5" value="'+clampN(prefs.atS,70,160)+'" style="width:100%">'+
    '<h2 style="margin-top:12px">מקשים במקלדת</h2><p class="hint">לוחצים על שורה ואז על המקש הרצוי. הליכה תמיד בחצים, וגם באותיות שלא נבחרו למשהו אחר.</p><p class="hint"><b>בקרב: זירה, מגדל, מצור והמעגל האחרון</b></p>'+KEYS_FIGHT.map(row).join('')+
    '<p class="hint" style="margin-top:8px"><b>במפות</b></p>'+KEYS_FARM.map(row).join('')+
    '<div class="grid2" style="margin-top:10px"><button class="btn" data-act="keysReset">חזרה לברירת המחדל</button><button class="btn pri" data-act="closeModal">סגור</button></div>';
}
function openSettings(){bindWait='';openModal(settingsHtml());}
window.addEventListener('keydown',e=>{if(!bindWait)return;if(!$('modal').classList.contains('on')){bindWait='';return;}e.preventDefault();e.stopImmediatePropagation();const k=evKey(e).length===1?evKey(e).toLowerCase():evKey(e);
  if(k!=='Escape'&&!/^(Shift|Control|Alt|Meta|Tab|Enter|Arrow.*)$/.test(k)){const list=bindWait[0]==='k'&&bindWait.length===2?KEYS_FARM:KEYS_FIGHT,old=keyOf(bindWait),other=keyAct(list,k);prefs.keys=prefs.keys||{};if(other&&other!==bindWait)prefs.keys[other]=old;prefs.keys[bindWait]=k;savePrefs();}
  bindWait='';$('modalBox').innerHTML=settingsHtml();},true);
document.addEventListener('input',e=>{const t=e.target;if(!t||(t.id!=='szMv'&&t.id!=='szAt'))return;if(t.id==='szMv'){prefs.mvS=+t.value;$('szMvV').textContent=t.value+'%';}else{prefs.atS=+t.value;$('szAtV').textContent=t.value+'%';}savePrefs();applySizes();});
applySizes();
const $=id=>document.getElementById(id);
const esc=t=>String(t).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const L=x=>'<span dir="ltr">'+x+'</span>';
function fmt(n){n=Math.floor(n);if(n>=1e7)return (n/1e6).toFixed(1)+'M';if(n>=1e5)return Math.round(n/1e3)+'K';return n.toLocaleString('en-US');}
function fmtT(s){if(!isFinite(s))return '...';s=Math.max(1,Math.round(s));if(s<60)return s+' שנ׳';if(s<3600)return Math.round(s/60)+' דק׳';return (s/3600).toFixed(1)+' שע׳';}
function setState(o){const a=adopt(o);if(!a||!a.chars.length)return false;A=a;S=A.chars[A.cur];statsDirty=true;panelDirty=true;return true;}
function loadLocal(){try{const t=localStorage.getItem(KEY);if(t){const o=adopt(JSON.parse(t));if(o&&o.chars.length)return o;}}catch(e){}return null;}
function saveLocal(){if(ONLINE||!A||demo)return;try{localStorage.setItem(KEY,JSON.stringify(A));}catch(e){}}
function touch(){statsDirty=true;panelDirty=true;}
function toast(txt,r){if(demo||!txt)return;const d=document.createElement('div');d.className='toast'+(r!=null?' r'+r:'');d.textContent=txt;$('toasts').appendChild(d);setTimeout(()=>d.remove(),2600);while($('toasts').children.length>4)$('toasts').firstChild.remove();}
function setNet(ok){$('net').textContent=ONLINE?(ok?'מחובר לשרת':'אין חיבור לשרת'):'מצב מקומי, בלי הגנה';}

// In online mode the server owns the account; the client only asks and displays.
let world=null,worldAt=0,session=null,chain=Promise.resolve(),players=[],market=[],party={code:'',members:[]},partyN=0,auras=[];
// Online accounts: username + password. After sign-in the server hands back a signed session token kept in this browser.
const SKEY='eternal-cycle-session';
function initServer(){
  if(window.EC_MOCK){session={token:'mock',user:'mock'};return;}
  try{const o=JSON.parse(localStorage.getItem(SKEY)||'null');if(o&&o.token)session=o;}catch(e){}
}
function setSession(o){session=o;try{if(o)localStorage.setItem(SKEY,JSON.stringify(o));else localStorage.removeItem(SKEY);}catch(e){}}
async function post(body,token){
  const h={'Content-Type':'application/json'};if(CFG.anon)h.apikey=CFG.anon;if(token)h['x-ec-token']=token;
  const res=await fetch((CFG.api||CFG.url+'/functions/v1/act'),{method:'POST',headers:h,body:JSON.stringify(body)});
  return {status:res.status,j:await res.json().catch(()=>null)};
}
async function rpc(kind,args){
  const r=await post({kind:kind,args:args||{}},session&&session.token);
  if(r.status===401){setSession(null);location.reload();throw new Error('auth');}
  if(r.status!==200||!r.j)throw new Error(r.j&&r.j.error||('HTTP '+r.status));return r.j;
}
if(typeof window!=='undefined'&&window.EC_MOCK)rpc=window.EC_MOCK; // test hook: an in-page stand-in for the server
// Every state change goes through send(), one at a time and in order.
function send(kind,args){
  if(gmWalk()&&(kind==='tick'||kind==='travel'||kind==='buy'))args=Object.assign({gm:1},args); // the server checks the right itself
  const run=async()=>{
    if(!ONLINE){const r=apply(A,kind,args,{});S=A.chars[A.cur]||S;touch();localDirty=true;return r;}
    const j=await rpc(kind,args);
    if(j.state)setState(j.state);if(j.world)world=j.world;if(j.players)players=j.players;if(j.market){market=j.market;panelDirty=true;}if(j.party){party=j.party;panelDirty=true;}if(j.guild){guild=j.guild;panelDirty=true;}if(j.top){topList=j.top;panelDirty=true;}if(j.banned)showBanned(j.result&&j.result.msg);
    setNet(true);return j.result||{ok:false,msg:j.error||''};
  };
  const p=chain.then(run);chain=p.catch(()=>{});
  return p.catch(()=>{setNet(false);return {ok:false,msg:'net'};});
}
const pend={kills:0,casts:0,pots:0,boss:false,clean:false,elite:false,t:0};
// The party at the side of the screen, as in the old games: each member's name and life. A press opens the party window.
let follow='',followNo='',ptyT=0,ptySig='';
function renderPty(){
  const el=$('ptyHud');if(!el)return;const on=!!(party.code&&party.members.length>1&&SC.mode==='farm'&&!SC.duel);
  let h='';if(on)for(const m of party.members){const pr=m.me?null:peers.find(q=>q.s&&q.s.n===m.n),hp=m.me?Math.round(clamp(SC.hero.hp/Math.max(1,C.hp),0,1)*100):pr&&pr.hp!=null?pr.hp:-1;
    h+='<div'+(follow===m.n?' class="fol"':'')+'>'+esc(m.n)+(m.leader?' ★':'')+'<small>'+(hp>=0?'רמה '+L(m.l):!m.active?'לא מחובר':esc(zoneName(clamp(m.zone|0,-1,ZONES.length-1))))+(follow===m.n?' · עוקב':'')+'</small>'+(hp>=0?'<i><b style="width:'+hp+'%"></b></i>':'')+'</div>';}
  if(h!==ptySig){ptySig=h;el.innerHTML=h;el.style.display=on?'':'none';}
}
function ptyWin(){
  let h='<h2>הפארטי</h2>';
  if(!party.code){openModal(h+'<p class="hint">אתה לא בפארטי. מזמינים שחקן מלשונית שחקנים או בלחיצה עליו במפה.</p><div class="acts"><button class="btn" data-act="closeModal">סגור</button></div>');return;}
  for(const m of party.members)h+='<div class="kv"><span><i class="dot" style="background:var(--'+(m.active?'good':'line')+')"></i>'+esc(m.n)+(m.me?' (אתה)':'')+(m.leader?' · מוביל':'')+'<br><small>רמה '+L(m.l)+' · '+esc(zoneName(clamp(m.zone|0,-1,ZONES.length-1)))+'</small></span>'+(m.me?'':'<button class="btn sm'+(follow===m.n?' pri':'')+'" data-act="pfollow" data-n="'+esc(m.n)+'">'+(follow===m.n?'הפסק לעקוב':'עקוב אחריו')+'</button>')+'</div>';
  openModal(h+'<p class="hint">עקוב אחריו: הדמות שלך הולכת אחרי החבר במפה ועוברת איתו למפות שהיא רשאית להיכנס אליהן. תזוזה ידנית שלך לא מבטלת את המעקב, רק הכפתור.</p><div class="kv"><span>קוד להזמנת חברים</span><b class="num" dir="ltr" style="letter-spacing:2px;color:var(--gold)">'+esc(party.code)+'</b></div><div class="acts"><button class="btn" data-act="closeModal">סגור</button><button class="btn" data-act="pleave">עזוב פארטי</button></div>');
}
let followBusy=false;
function followStep(){
  if(!follow||!S||demo||SC.mode!=='farm'||SC.ev||SC.duel||busy||followBusy||SC.hero.dead>0||SC.hero.climb)return;
  const m=party.members.find(q=>q.n===follow&&!q.me);if(!m){follow='';return;}if(!m.active)return;
  const z=clamp(m.zone|0,-1,ZONES.length-1),f=z<0?0:clamp(m.f|0,0,FLOORS-1);
  if(z!==SC.zi||f!==SC.fl){const key=z+':'+f;if(followNo===key)return;const d=ZONES[z];
    if(z>=0&&(!d||d.min>S.lvl||d.castle||(d.req?S.resets<d.req:z>A.open))){followNo=key;toast('הדמות שלך עוד לא רשאית להיכנס למפה של '+follow);return;}
    followBusy=true;act('travel',{z:z,f:f}).then(r=>{followBusy=false;if(r.ok){followNo='';snd('portal');enterZone(z,'L',f);saveLocal();}else{followNo=key;if(r.msg&&r.msg!=='net')toast(r.msg);}});return;}
  followNo='';const p=peers.find(q=>q.s&&q.s.n===follow),h=SC.hero;if(p&&Math.abs(p.x-h.x)>170&&h.manual<=0){h.tgt=null;h.tx=clamp(p.x-(p.x>h.x?60:-60),30,mapW()-30);}
}
// a window in the background is still in the party: it checks in now and then, so shared experience keeps arriving
setInterval(()=>{if(document.hidden&&ONLINE&&!demo&&S&&party.code&&SC.zi>=0&&SC.mode==='farm')flushTick();},20000);
function flushTick(){
  if(!ONLINE||demo||!S)return Promise.resolve();
  if(!pend.kills&&!pend.casts&&!pend.boss&&!pend.elite&&!(party.code&&SC.zi>=0))return chain; // in a party, keep checking in: that is how shared experience arrives
  const a={z:SC.zi,f:SC.fl,kills:pend.kills,casts:pend.casts,pots:pend.pots,boss:pend.boss,clean:pend.boss&&pend.clean,elite:pend.elite,ev:SC.ev?1:0},l0=S.lvl;pend.clean=false;pend.kills=0;pend.casts=0;pend.pots=0;pend.boss=false;pend.elite=false;pend.t=0;
  return send('tick',a).then(r=>afterTick(r,null,l0));
}
async function act(kind,args){await flushTick();return send(kind,args);}
function localTick(a){a.f=SC.fl;a.ev=SC.ev?1:0;a.casts=pend.casts;pend.casts=0;const r=apply(A,'tick',a,{});localDirty=true;return r;}

/* ---------- player market (online only) ---------- */
function loadMarket(){if(ONLINE&&!demo)send('mget',{});}
async function listItem(id,priceTxt,to){
  const price=Math.floor(Number(String(priceTxt).replace(/[^0-9]/g,'')));if(!ONLINE)return;
  if(!(price>=1&&price<=1e9)){toast('מחיר לא תקין');return;}
  closeSheet();const r=await act('mlist',{id:id,price:price,to:to==null?'':to});toast(r.ok?'הפריט הוצע בשוק':r.msg==='net'?'אין חיבור לשרת':r.msg);touch();
}
async function buyListing(mid){const r=await act('mbuy',{id:mid});if(r.ok){snd('rare');toast('הפריט נקנה ונמצא בתיק');}else toast(r.msg==='net'?'אין חיבור לשרת':r.msg);touch();}
async function cancelListing(mid){const r=await act('mcancel',{id:mid});toast(r.ok?'הפריט חזר לתיק':r.msg==='net'?'אין חיבור לשרת':r.msg);touch();}
function renderMarket(){
  let h='<h2>שוק השחקנים</h2>';
  if(!ONLINE)return h+'<p class="hint">השוק עובד רק במצב מקוון, מול השרת. כרגע המשחק במצב מקומי.</p>';
  h+='<p class="hint">מציעים פריט מהתיק דרך חלון הפריט. העסקה מתבצעת בשרת, והמוכר מקבל 95% מהמחיר מיד.</p>';
  const mine=market.filter(m=>m.mine),others=market.filter(m=>!m.mine);
  const row=(m,my)=>{const it=cleanItem(m.it);if(!it)return '';return '<div class="card shop r'+it.r+'"><div style="width:34px;color:var(--r'+it.r+')">'+SVG[it.s]+'</div><div class="z"><b style="color:var(--r'+it.r+')">'+esc(itemName(it,S.cls))+(it.p?' '+L('+'+it.p):'')+'</b><small>'+mainLine(it)+(it.af.length?' · '+it.af.map(a=>AFF[a[0]][0]+' '+L('+'+a[1]+'%')).join(', '):'')+'</small>'+(my?'':'<small>מוכר: '+esc(String(m.sn||'').slice(0,14))+'</small>')+(m.direct?'<small style="color:var(--gold)">הצעה ישירה בתוך הפארטי</small>':'')+'</div>'+
    (my?'<button class="btn sm" data-act="mcancel" data-m="'+esc(m.id)+'">בטל · '+L(fmt(m.price))+'</button>':'<button class="btn sm'+(A.gold>=m.price?' pri':'')+'" data-act="mbuy" data-m="'+esc(m.id)+'"'+(A.gold>=m.price?'':' disabled')+'>'+L(fmt(m.price))+' זהב</button>')+'</div>';};
  h+=others.length?others.slice(0,40).map(m=>row(m,false)).join(''):'<p class="hint">אין כרגע הצעות של שחקנים אחרים.</p>';
  if(mine.length)h+='<h2>החנות שלי</h2>'+mine.map(m=>row(m,true)).join('');
  return h+'<button class="btn" data-act="mrefresh">רענן שוק</button>';
}

/* ---------- canvas drawing ---------- */
const cv=$('cv'),ctx=cv.getContext('2d');let W=360,H=260,DPR=1,ZM=1;
const calm=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function resize(){const r=cv.getBoundingClientRect();DPR=Math.min(window.devicePixelRatio||1,2);ZM=Math.max(1,Math.min(1.4,r.height/760,r.width/800));W=Math.max(200,r.width/ZM);H=Math.max(140,r.height/ZM);cv.width=Math.max(200,r.width)*DPR;cv.height=Math.max(140,r.height)*DPR;} // on a large screen the scene is enlarged, not just widened
window.addEventListener('resize',resize);if(prefs.big)document.getElementById('app').classList.add('wide');if(prefs.big)document.getElementById('bigBtn').textContent='הקטן';setTimeout(()=>fsSync(),0);
const MW=1500,TW=1150;
const TOWN={n:'כפר המעגל',sky:['#141033','#4a3a78'],sil:'#0c0a20',amb:'#ffe9a8',kind:'town'};
const NPCS=[]; // the village is a lobby now: the tabs are reached from anywhere, and the street belongs to players' stalls
const SC={t:0,cam:0,mons:[],boss:null,hero:{x:110,face:1,dir:0,hp:1,atkT:0,anim:0,dead:0,mAtk:1,tgt:null,tx:null,goal:null,manual:0,buff:0,shield:0,cds:[0,0,0,0,0,0],autoSk:0,mv:false},fx:[],parts:[],nums:[],drops:[],shake:0,mode:'farm',duel:null,zi:-1,fl:0};
const amb=[];for(let i=0;i<26;i++)amb.push({x:Math.random(),y:Math.random(),s:.5+Math.random()*1.5,v:.02+Math.random()*.05});
const mapW=()=>SC.zi<0?TW:MW, gy=()=>Math.min(H*.8,H-112);
function lookOf(s){const g=it=>it?[it.t,it.r,it.p,it.season?1:0,it.ex?(isFull(it)?2:1):0]:null,o={c:s.cls,w:g(s.eq.w),ar:g(s.eq.a),g:s.eq.g?g(s.eq.g).concat([wskinOn(s)]):null,sp:armorPlus(s),r:s.resets|0};
  const sc=setCounts(s);let bz=-1,bn=0,bk='';for(const z in sc)if(sc[z]>bn){bn=sc[z];bz=parseInt(z);bk=z;}if(bn>=4)o.set=[bn,(String(bk).slice(-1)==='b'?TCOL2:TCOL)[clamp(bz,0,TCOL.length-1)],String(bk).slice(-1)==='b'?1:0];{const p=petOn(s,Date.now());if(p)o.pet=p.perm?21:p.r+1+(p.t===2?10:0);}let pf=0;for(const k in s.eq)if(s.eq[k]&&s.eq[k].pf)pf++;if(pf)o.pf=pf;return o;}
function glowAmt(p,r,t){let g=p>=13?24:p>=11?16+5*Math.sin(t*6):p>=9?12:p>=7?7:0;if(r>=3)g=Math.max(g,6);return g;}
function gearColor(g,t,fallback){if(!g)return fallback;if(g[2]>=15)return 'hsl('+((t*90)%360)+',95%,68%)';return RAR[g[1]].c;}
const WPAL={1:['#2f7a45','#b6ef86'],2:['#2260c9','#a8e8ff'],3:['#c42d18','#ffbe55'],4:['#caa02e','#fff8d2'],5:['#35106b','#d596ff'],6:['#1b6ea8','#effcff'],7:['#a8740a','#fff1a8'],8:['#ff4fa3','#7df9ff'],s:['#a637ee','#62f3e2']};
const SPR={"mh":{"w":128,"h":69,"ax":28,"ay":69,"bh":52,"a":{"idle":[0,8],"run":[1,8],"atk":[2,6],"atk2":[3,6],"hit":[4,4],"die":[5,6]}},"ew":{"w":94,"h":69,"ax":26,"ay":69,"bh":58,"a":{"idle":[0,8],"run":[1,8],"atk":[2,8],"hit":[3,4],"die":[4,5]}},"hu":{"w":91,"h":66,"ax":42,"ay":66,"bh":42,"a":{"idle":[0,8],"run":[1,8],"atk":[2,7],"atk2":[3,5],"hit":[4,3],"die":[5,8]}},"mush":{"w":71,"h":45,"ax":32,"ay":45,"bh":37,"a":{"idle":[0,4],"run":[1,8],"atk":[2,8],"hit":[3,4],"die":[4,4]}},"gob":{"w":88,"h":46,"ax":44,"ay":46,"bh":36,"a":{"idle":[0,4],"run":[1,8],"atk":[2,8],"hit":[3,4],"die":[4,4]}},"skel":{"w":98,"h":59,"ax":32,"ay":57,"bh":51,"a":{"idle":[0,4],"run":[1,4],"atk":[2,8],"hit":[3,4],"die":[4,4]}},"eye":{"w":56,"h":41,"ax":27,"ay":33,"bh":33,"a":{"idle":[0,8],"atk":[1,8],"hit":[2,4],"die":[3,4]}},"worm":{"w":77,"h":54,"ax":30,"ay":54,"bh":45,"a":{"idle":[0,9],"run":[1,9],"atk":[2,16],"hit":[3,3],"die":[4,8]}},"skel_f":{"w":98,"h":59,"ax":32,"ay":57,"bh":51,"a":{"idle":[0,4],"run":[1,4],"atk":[2,8],"hit":[3,4],"die":[4,4]}},"gob_r":{"w":88,"h":46,"ax":44,"ay":46,"bh":36,"a":{"idle":[0,4],"run":[1,8],"atk":[2,8],"hit":[3,4],"die":[4,4]}},"eye_p":{"w":56,"h":41,"ax":27,"ay":33,"bh":33,"a":{"idle":[0,8],"atk":[1,8],"hit":[2,4],"die":[3,4]}},"skel_g":{"w":98,"h":59,"ax":32,"ay":57,"bh":51,"a":{"idle":[0,4],"run":[1,4],"atk":[2,8],"hit":[3,4],"die":[4,4]}},"n_smith":{"w":128,"h":69,"ax":28,"ay":69,"bh":52,"a":{"idle":[0,8]}},"n_merch":{"w":91,"h":66,"ax":42,"ay":66,"bh":42,"a":{"idle":[0,8]}},"n_guard":{"w":94,"h":69,"ax":26,"ay":69,"bh":58,"a":{"idle":[0,8]}},"n_herald":{"w":91,"h":66,"ax":42,"ay":66,"bh":42,"a":{"idle":[0,8]}},"n_arena":{"w":128,"h":69,"ax":28,"ay":69,"bh":52,"a":{"idle":[0,8]}},"mush_d":{"w":71,"h":45,"ax":32,"ay":45,"bh":37,"a":{"idle":[0,4],"run":[1,8],"atk":[2,8],"hit":[3,4],"die":[4,4]}},"worm_i":{"w":77,"h":54,"ax":30,"ay":54,"bh":45,"a":{"idle":[0,9],"run":[1,9],"atk":[2,16],"hit":[3,3],"die":[4,8]}},"gob_g":{"w":88,"h":46,"ax":44,"ay":46,"bh":36,"a":{"idle":[0,4],"run":[1,8],"atk":[2,8],"hit":[3,4],"die":[4,4]}},"skel_d":{"w":98,"h":59,"ax":32,"ay":57,"bh":51,"a":{"idle":[0,4],"run":[1,4],"atk":[2,8],"hit":[3,4],"die":[4,4]}}};
const IMG={},CLSSPR={blade:'mh',storm:'ew',hunter:'hu',lord:'lord'};SPR.lord={w:160,h:105,ax:80,ay:105,bh:54,a:{idle:[0,8],run:[1,8],atk:[2,4],atk2:[3,4],hit:[4,4],die:[5,6]}}; // the warlord is his own figure: a crowned king, sword and cape
// The game master may walk into any map, to test. It is a switch he turns on, and off by default, so his own characters play by the rules like everyone's.
function gmWalk(){try{return !!(ONLINE&&me.admin&&localStorage.getItem('ec-gmwalk')==='1');}catch(e){return false;}}
function loadSprites(){for(const k in SPR){const im=new Image();if(k==='mh'||k==='ew'||k==='hu'||k==='lord')im.onload=()=>measureBody(k);im.src='assets/'+k+'.png';IMG[k]=im;}}
// Where the hero's body is in every animation frame, so wings and the weapon on the back move with it.
// Thin parts (the weapon in the hand) are worn away first; what is left is the body. Stored as [middle x, top y] in sprite pixels.
const BODY={};
function measureBody(key){
  try{const m=SPR[key],im=IMG[key],c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(im,0,0);const out={};
    for(const an in m.a){const row=m.a[an][0],n=m.a[an][1];out[an]=[];
      for(let fi=0;fi<n;fi++){const d=x.getImageData(fi*m.w,row*m.h,m.w,m.h).data,w=m.w,h=m.h,on=(px,py)=>px>=0&&py>=0&&px<w&&py<h&&d[(py*w+px)*4+3]>128;
        let top=h,pts=[];for(let py=2;py<h-2;py++)for(let px=2;px<w-2;px++){let ok=true;for(let dy=-2;dy<=2&&ok;dy++)for(let dx=-2;dx<=2;dx++)if(!on(px+dx,py+dy)){ok=false;break;}if(ok){pts.push(px,py);if(py<top)top=py;}}
        if(pts.length<40){out[an].push(null);continue;}
        let sx=0,cnt=0;const lim=top+(m.ay-top)*.6;for(let i=0;i<pts.length;i+=2)if(pts[i+1]<=lim){sx+=pts[i];cnt++;}
        out[an].push([sx/cnt-m.ax,top-m.ay]);}}
    if(out.idle&&out.idle[0])BODY[key]=out;
  }catch(e){}
}
function bodyShift(key,an,fi){const b=BODY[key];if(!b)return [0,0];const fr=b[an]||b.idle,f=fr[clamp(fi|0,0,fr.length-1)],o=b.idle[0];return f?[clamp(f[0]-o[0],-9,9),clamp(f[1]-o[1],-6,10)]:[0,0];} // clamped: attack frames with a big slash drawn in would throw it off
// In a crowd every other fighter is drawn plainly: no blurred glow, no aura, no sparks. A blurred shadow is by far the
// dearest thing a phone can be asked to paint, and a siege asked for dozens of them every frame.
let LITE=false;
function spr(key,an,fi,x,y,k,flip,glowC,glowB,alpha,sheet){if(LITE)glowB=0;
  const m=SPR[key],src=IMG[key];if(!m||!src||!src.complete||!src.naturalWidth)return false;const im=sheet||src;
  const a=m.a[an]||m.a.idle;fi=Math.max(0,Math.min(a[1]-1,fi|0));
  ctx.save();ctx.translate(Math.round(x),Math.round(y));ctx.scale(flip?-k:k,k);ctx.imageSmoothingEnabled=false;
  if(glowB){ctx.shadowColor=glowC;ctx.shadowBlur=glowB;}if(alpha!=null)ctx.globalAlpha=alpha;
  ctx.drawImage(im,fi*m.w,a[0]*m.h,m.w,m.h,-m.ax,-m.ay,m.w,m.h);
  if(glowB>10)ctx.drawImage(im,fi*m.w,a[0]*m.h,m.w,m.h,-m.ax,-m.ay,m.w,m.h);
  ctx.restore();return true;
}
const frames=(key,an)=>{const m=SPR[key];return (m.a[an]||m.a.idle)[1];};
const wcv=document.createElement('canvas');wcv.width=340;wcv.height=280;const wctx=wcv.getContext('2d');
const WING_AT={blade:[5,.7],storm:[3,.72],hunter:[4,.76],lord:[4,.74]}; // where the wings meet the back: pixels behind the middle, share of body height
const WLEN=[0,60,80,86,104,106,94,116,122];
// One wing, drawn in its own space: the shoulder is the origin, +x points behind the hero, -y is up.
function wingShape(c,T,pal,t,far){
  const L=WLEN[T],lin=(len,a,b)=>{const g=c.createLinearGradient(0,0,len,0);g.addColorStop(0,a);g.addColorStop(1,b);return g;};
  const feather=(a,len,w,fill,rim)=>{c.save();c.rotate(a);c.fillStyle=fill;c.beginPath();c.moveTo(0,-w*.3);c.bezierCurveTo(len*.35,-w,len*.8,-w*.75,len,0);c.bezierCurveTo(len*.75,w*.7,len*.3,w*.8,0,w*.3);c.closePath();c.fill();
    c.strokeStyle=rim;c.lineWidth=1.4;c.globalAlpha*=.6;c.stroke();c.beginPath();c.moveTo(4,0);c.lineTo(len*.9,0);c.lineWidth=1;c.stroke();c.restore();};
  const fan=(n,a0,a1,len,w,f0,f1,rim,prof)=>{for(let i=n-1;i>=0;i--){const u=n>1?i/(n-1):0,l=len*(prof?prof(u):.62+.38*Math.sin(Math.PI*Math.min(1,u*1.25+.12)));feather(a0+(a1-a0)*u,l,w,lin(l,f0,f1),rim);}};
  const dark=far?'#0a0616':pal[0];
  if(T===5){ // bat: fingers and a scalloped membrane
    const tips=[[-1.25,.7],[-.85,1],[-.4,.95],[.05,.8],[.5,.55]].map(q=>[Math.cos(q[0])*L*q[1],Math.sin(q[0])*L*q[1]]);
    c.fillStyle=lin(L,pal[0],pal[1]);c.beginPath();c.moveTo(0,0);c.lineTo(tips[0][0],tips[0][1]);
    for(let i=1;i<tips.length;i++){const a=tips[i-1],b=tips[i];c.quadraticCurveTo((a[0]+b[0])*.36,(a[1]+b[1])*.36,b[0],b[1]);}
    c.quadraticCurveTo(L*.2,L*.18,0,10);c.fill();
    c.strokeStyle=pal[1];c.lineWidth=3;c.lineCap='round';c.beginPath();for(const q of tips){c.moveTo(0,0);c.lineTo(q[0],q[1]);}c.stroke();
    c.fillStyle='#fff';for(const q of tips){c.beginPath();c.arc(q[0],q[1],2.6,0,7);c.fill();}
  }else if(T===6){ // ice: faceted crystals
    for(let i=7;i>=0;i--){const u=i/7,a=-1.45+u*1.9,len=L*(.55+.45*Math.sin(Math.PI*Math.min(1,u*1.2+.1))),w=9+len*.06;c.save();c.rotate(a);
      c.fillStyle=lin(len,pal[0],pal[1]);c.beginPath();c.moveTo(0,-3);c.lineTo(len*.5,-w);c.lineTo(len,0);c.lineTo(0,0);c.fill();
      c.fillStyle=lin(len,'#0f4f80','#bfeaff');c.beginPath();c.moveTo(0,0);c.lineTo(len,0);c.lineTo(len*.5,w*.8);c.lineTo(0,3);c.fill();
      c.strokeStyle='rgba(255,255,255,.85)';c.lineWidth=1.2;c.beginPath();c.moveTo(2,0);c.lineTo(len,0);c.stroke();c.restore();}
  }else if(T===8){ // energy: blades of light
    for(let i=8;i>=0;i--){const u=i/8,a=-1.5+u*2,len=L*(.6+.4*Math.sin(Math.PI*Math.min(1,u*1.2+.1)))*(1+.05*Math.sin(t*6+i));c.save();c.rotate(a);
      c.fillStyle=lin(len,pal[0],pal[1]);c.globalAlpha*=.85;c.beginPath();c.moveTo(8,-5);c.lineTo(len*.8,-3);c.lineTo(len,0);c.lineTo(len*.8,3);c.lineTo(8,5);c.fill();
      c.globalAlpha/=.85;c.fillStyle='#fff';c.fillRect(10,-1.2,len*.78,2.4);c.restore();}
    c.fillStyle='#fff';c.beginPath();c.arc(2,0,7,0,7);c.fill();
  }else if(T===3){ // flame: tongues that flicker, with a bright core
    for(let i=7;i>=0;i--){const u=i/7,a=-1.5+u*1.95+Math.sin(t*8+i*1.9)*.07,len=L*(.55+.45*Math.sin(Math.PI*Math.min(1,u*1.2+.1)))*(1+.08*Math.sin(t*11+i*2.3));
      for(const [sc,f0,f1] of [[1,pal[0],pal[1]],[.6,'#ff9a2e','#fff3a8']]){c.save();c.rotate(a);const l=len*sc,w=13*sc,wv=Math.sin(t*10+i)*5*sc;c.fillStyle=lin(l,f0,f1);
        c.beginPath();c.moveTo(0,-w*.4);c.bezierCurveTo(l*.3,-w*1.2,l*.6,w*.3+wv,l,-w*.5+wv);c.bezierCurveTo(l*.7,w*.9,l*.3,w*.5,0,w*.4);c.fill();c.restore();}}
  }else{ // feathered: leaf, storm, angel, golden
    const n=[0,4,7,0,10,0,0,12][T],w=T===1?15:T===2?10:9,rim=T===1?'#eaffd0':'#ffffff';
    if(T===7)fan(n,-1.62,.55,L*1.02,w+1,far?dark:'#7a4f06',pal[0],rim);
    fan(n,-1.5,.45,L,w,dark,pal[1],rim);
    if(T>=2)fan(Math.ceil(n*.7),-1.42,.3,L*.5,w*.9,pal[1],'#ffffff',rim,u=>.8+.2*Math.sin(Math.PI*u));
    if(T>=4)fan(Math.ceil(n*.5),-1.3,.15,L*.27,w*.8,'#ffffff','#ffffff',rim,()=>1);
    c.strokeStyle=T===1?'#6b4a2e':pal[1];c.lineWidth=T===1?4:5;c.lineCap='round';c.beginPath();c.moveTo(0,2);c.quadraticCurveTo(L*.12,-L*.2,L*.1,-L*.42);c.stroke();
  }
}
// Eight wing styles by tier: leaf, storm feathers, flame, angel, bat, ice, golden, energy. Both wings sweep back from the shoulders.
// In a crowd a fighter's wings are painted once, still, and kept: painting every feather of thirty pairs of wings on
// every frame is most of what a plainly drawn fighter costs.
const WCACHE={};
// The warlord wears a cape where others wear wings: the same item, the same fifty ranks. It grows longer and richer with
// the rank: a border, a lining, an emblem, a fur collar, a second layer, a hem cut in tails, light along its edge.
function drawCape(x,y,g,t,k,flip,bh,mv,anim){
  const R=clamp(g[0]|0,1,WING_MAX),hi=R>8,fam=hi?Math.floor((R-9)/7):0,gr=hi?(R-9)%7:0,wsk=g[5]|0,f=flip?-1:1,at=WING_AT.lord;
  let pal=g[3]?WPAL.s:WPAL[hi?[3,5,6,2,7,8][fam]:R];
  if(hi&&!g[3]){const h=([8,268,205,172,44,318][fam]+gr*19)%360;pal=['hsl('+h+',78%,'+(26+gr*2)+'%)','hsl('+((h+26)%360)+',100%,'+(68+gr*3)+'%)'];if(fam===5){const hh=(t*90+gr*40)%360;pal=['hsl('+hh+',85%,40%)','hsl('+((hh+150)%360)+',100%,80%)'];}}
  if(wsk===1)pal=['#fff6d8','#ffd75e'];else if(wsk===2)pal=['#1a0a26','#ff3b5c'];
  const L=Math.min(bh*at[1]+(hi?3:-2),18+R*2.4),wide=9+Math.min(R,20)*.45+(hi?fam:0),sway=LITE?0:Math.sin(t*2.6)*1.6+Math.sin(t*4.1)*.7,back=(mv?7+Math.sin(t*9)*1.5:0)+(anim>0?anim*5:0),tails=hi?2+(fam+gr)%3:R>=6?2:0;
  ctx.save();ctx.translate(Math.round(x-f*at[0]*k*.2),Math.round(y-bh*k*at[1]));ctx.scale(f*k,k);ctx.lineJoin='round';
  const shape=(grow,drop)=>{const bx=-(wide+grow)-back+sway,by=L+drop;ctx.beginPath();ctx.moveTo(-4,-3);ctx.lineTo(4.5,-2.5);ctx.quadraticCurveTo(6+grow*.3-back*.25,by*.55,3-back*.4+sway*.5,by);
    if(tails){const n=tails*2;for(let i=1;i<=n;i++){const u=i/n,px=3-back*.4+sway*.5+(bx-(3-back*.4+sway*.5))*u;ctx.lineTo(px,by-(i%2?4.5+grow*.3:0)+Math.sin(t*3+i)*(LITE?0:.6));}}else ctx.quadraticCurveTo((bx+3)/2,by+2.2,bx,by-1.5);
    ctx.quadraticCurveTo(bx-2,by*.5,-4,-3);ctx.closePath();};
  if(hi&&(gr>=3||fam>=2)){shape(3.5,2.5);ctx.fillStyle=pal[1];ctx.globalAlpha=.55;ctx.fill();ctx.globalAlpha=1;} // the second layer, under the first
  shape(0,0);const gd=ctx.createLinearGradient(0,-3,-wide,L);gd.addColorStop(0,pal[0]);gd.addColorStop(.75,pal[0]);gd.addColorStop(1,pal[1]);ctx.fillStyle=gd;
  if(!LITE&&(hi||wsk||g[3]||R>=7)){ctx.shadowColor=pal[1];ctx.shadowBlur=(hi?8+fam*2:5)+(wsk?6:0);}ctx.fill();ctx.shadowBlur=0;
  if(R>=3){ctx.strokeStyle=R>=5||hi?'#ffd75e':pal[1];ctx.lineWidth=hi?1.5:1;ctx.stroke();}
  if(R>=5){ctx.save();ctx.clip();ctx.strokeStyle=pal[1];ctx.globalAlpha=.5;ctx.lineWidth=1;for(let i=1;i<=3;i++){ctx.beginPath();ctx.moveTo(1-i*2.2,0);ctx.quadraticCurveTo(-i*3.2-back*.3,L*.5,-i*(wide/3.4)-back+sway,L+2);ctx.stroke();}ctx.restore();} // folds
  if(R>=7){const ex=-wide*.45-back*.5+sway*.4,ey=L*.52,er=2.4+(hi?fam*.35:0);ctx.fillStyle='#ffd75e';ctx.beginPath();ctx.moveTo(ex,ey-er*1.5);ctx.lineTo(ex+er,ey);ctx.lineTo(ex,ey+er*1.5);ctx.lineTo(ex-er,ey);ctx.closePath();ctx.fill();if(hi){ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(ex,ey,er*.35,0,7);ctx.fill();}} // the emblem
  if(hi||R===8){ctx.fillStyle=wsk===2?'#3a2a48':'#f4f0ff';for(let i=0;i<5;i++){ctx.beginPath();ctx.arc(-4+i*2.1,-3+Math.abs(i-2)*.35,1.9+(hi?gr*.08:0),0,7);ctx.fill();}} // fur at the shoulders
  ctx.restore();
  if((hi||wsk)&&!calm&&!LITE&&Math.random()<.1+fam*.03)SC.parts.push({x:x-f*(wide+back)*k*(.4+Math.random()*.6),y:y-bh*k*at[1]+L*k*(.6+Math.random()*.4),vx:-f*10,vy:-18,life:.7,c:Math.random()<.3?'#fff':pal[1],s:2});
}
function drawWings(x,y,g,t,k,flip,cls,bh,mv,anim){
  if(cls==='lord'){drawCape(x,y,g,t,k,flip,bh,mv,anim);return;}
  if(LITE){t=0;mv=false;anim=0;}
  const R=clamp(g[0]|0,1,WING_MAX),hi=R>8,fam=hi?Math.floor((R-9)/7):0,gr=hi?(R-9)%7:0,T=hi?[2,3,4,5,6,7,8][([1,3,4,0,5,6][fam]+gr)%7]:R,c=wctx,at=WING_AT[cls]||WING_AT.blade,f=flip?-1:1;let pal=g[3]?WPAL.s:WPAL[T];
  const wsk=g[5]|0;
  if(hi&&!g[3]&&!wsk){const h=([8,268,205,172,44,318][fam]+gr*19)%360;pal=['hsl('+h+',88%,'+(34+gr*3)+'%)','hsl('+((h+26)%360)+',100%,'+(72+gr*3)+'%)'];if(fam===5){const hh=(t*90+gr*40)%360;pal=['hsl('+hh+',92%,56%)','hsl('+((hh+150)%360)+',100%,84%)'];}}
  k*=hi?1.06+fam*.035+gr*.022:1;if(LITE)k*=.72; // in a crowd the others' wings are kept small, so the fight can be read
  if(wsk===1){const l=78+Math.sin(t*2.4)*8;pal=['hsl(46,100%,'+(l-18)+'%)','hsl(52,100%,'+(l+8)+'%)'];}else if(wsk===2){const l=14+Math.sin(t*2)*4;pal=['hsl(272,70%,'+l+'%)','hsl('+(350+Math.sin(t*3)*10)+',95%,58%)'];}
  if(T===8&&!g[3]&&!hi&&!wsk){const h=(t*70)%360;pal=['hsl('+h+',90%,55%)','hsl('+((h+120)%360)+',95%,80%)'];}
  const wkey=LITE?(g[0]|0)+'|'+cls+'|'+(g[3]?1:0)+'|'+bh+'|'+wsk:'';let src=wcv;if(wkey&&WCACHE[wkey])src=WCACHE[wkey];else{
  const flap=Math.sin(t*(mv?7:2.6))*(mv?1.5:1),lean=(mv?.22:0)-(anim>0?anim*.35:0),OX=130,OY=185; // beat faster on the run, trail back, open on a strike
  c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,340,280);
  c.save();c.translate(OX-14,OY-4);c.rotate(-.42+flap*.11+lean*.7);c.scale(.74,.74);c.globalAlpha=.72;wingShape(c,T,pal,t+.4,true);c.restore(); // far wing, behind and higher
  if(hi){ // the high ranks grow more wings: a lower pair from the third grade, a small crest pair from the sixth, and a jewel at the root
    const T2=[4,5,6,2,7,8][(fam+2)%6],p2=[pal[1],'#ffffff'];
    if(gr>=1||fam>=2){c.save();c.translate(OX-4,OY+6);c.rotate(.95+flap*.2+lean*.5);c.scale(.5+gr*.02,.5+gr*.02);c.globalAlpha=.9;wingShape(c,fam>=3?T2:T,pal,t+.8,false);c.restore();}
    if(gr>=3||fam>=4){c.save();c.translate(OX-2,OY-6);c.rotate(-.75+flap*.08);c.scale(.42+gr*.015,.42+gr*.015);c.globalAlpha=.95;wingShape(c,T2,p2,t+1.3,false);c.restore();}
    if(gr>=5){c.save();c.translate(OX-8,OY+12);c.rotate(1.45+flap*.24);c.scale(.36,.36);c.globalAlpha=.85;wingShape(c,T2,p2,t+1.7,false);c.restore();}
  }
  c.save();c.translate(OX,OY);c.rotate(flap*.14+lean);c.globalAlpha=1;wingShape(c,T,pal,t,false);c.restore();
  if(hi){const jr=5+fam*.6;c.save();c.translate(OX-3,OY-2);const jg=c.createRadialGradient(-1.5,-1.5,0,0,0,jr);jg.addColorStop(0,'#ffffff');jg.addColorStop(.45,pal[1]);jg.addColorStop(1,pal[0]);c.fillStyle=jg;c.beginPath();c.moveTo(0,-jr);c.lineTo(jr*.8,0);c.lineTo(0,jr);c.lineTo(-jr*.8,0);c.closePath();c.fill();c.strokeStyle='#fff8d2';c.lineWidth=1.2;c.stroke();c.restore();}
  if(T===4||T>=7){c.save();c.strokeStyle=T===8?pal[1]:'#fff3b0';c.lineWidth=5;c.globalAlpha=.85;c.beginPath();c.ellipse(OX-(at[0]+3)*2,OY-bh*2*(1-at[1])-20,22,6.5,0,0,7);c.stroke();c.restore();}
  if(wkey){const cp=document.createElement('canvas');cp.width=340;cp.height=280;cp.getContext('2d').drawImage(wcv,0,0);WCACHE[wkey]=cp;src=cp;}}
  const u=k*.5,ax=x-f*at[0]*k,ay=y-bh*k*at[1];
  ctx.save();ctx.translate(Math.round(ax),Math.round(ay));ctx.scale(-f*u,u);ctx.imageSmoothingEnabled=true;
  const gl=Math.max(glowAmt(g[2],g[1],t),hi?14+fam*2+gr:T>=4?6+T:3);ctx.shadowColor=pal[1];ctx.shadowBlur=LITE?0:gl;
  ctx.drawImage(src,-130,-185);ctx.restore();
  if(hi&&!calm&&Math.random()<.12+fam*.05)SC.parts.push({x:ax-f*(10+Math.random()*60)*k*.5,y:ay-Math.random()*60*k*.5,vx:-f*14,vy:-26,life:.8,c:Math.random()<.3?'#fff':pal[1],s:2+(gr>3?1:0)});
  if(!calm&&!LITE&&Math.random()<(hi?.3:.2)+(wsk?.12:0)){const px=ax-f*(8+Math.random()*58)*k*.5,py=ay-Math.random()*56*k*.5,W1=wsk===1?7:wsk===2?3:T;
    if(W1===1)SC.parts.push({x:px,y:py,vx:-f*10,vy:14,g:26,life:1.5,c:Math.random()<.5?'#b6ef86':'#5fbf5a',s:3,k:'f'});                     // leaves drift down
    else if(W1===2)SC.parts.push({x:px,y:py,vx:(Math.random()-.5)*90,vy:(Math.random()-.5)*90,g:0,life:.35,c:'#e8fbff',s:3,k:'s'});          // storm sparks
    else if(W1===3)SC.parts.push({x:px,y:py,vx:-f*8,vy:-34,g:-30,life:1,c:Math.random()<.4?'#fff1a8':'#ff7a2e',s:3,k:Math.random()<.45?'f':'d'}); // feathers of fire, and embers rising
    else if(W1===4||W1===7)SC.parts.push({x:px,y:py,vx:0,vy:20,g:210,life:1.1,c:Math.random()<.3?'#fff8d2':'#ffd75e',s:3.2,k:'d'});            // gold dripping
    else if(W1===5)SC.parts.push({x:px,y:py,vx:-f*6,vy:-12,g:-10,life:1.3,c:Math.random()<.5?'#d596ff':'#5a2aa8',s:3,k:'f'});                  // shreds of the abyss floating up
    else if(W1===6)SC.parts.push({x:px,y:py,vx:(Math.random()-.5)*20,vy:18,g:14,life:1.6,c:'#effcff',s:3,k:'s'});                          // snow
    else SC.parts.push({x:px,y:py,vx:-f*10,vy:10,g:30,life:1.3,c:'hsl('+((t*120+px)%360)+',95%,72%)',s:3,k:Math.random()<.5?'f':'d'});}      // every colour at once
}
// Armor shows on the character: the whole sprite sheet is recolored toward the armor tier's color (or the set color for ancient pieces).
const TINT={};
function tintedSheet(key,col,amt){
  const im=IMG[key];if(!im||!im.complete||!im.naturalWidth)return null;const id=key+col+amt;if(TINT[id])return TINT[id];
  const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;const x=c.getContext('2d');
  x.drawImage(im,0,0);x.globalCompositeOperation='color';x.globalAlpha=amt;x.fillStyle=col;x.fillRect(0,0,c.width,c.height);
  x.globalAlpha=1;x.globalCompositeOperation='destination-in';x.drawImage(im,0,0);
  return TINT[id]=c;
}
// The body takes the colour of the armor's tier (or of the set, when four pieces are worn), so two characters of one
// class in different gear do not look alike. Ancient armor colours more strongly.
// Strong, saturated colours only: a pale tint drains the body and makes it look like a ghost.
const BODYC=['#8f8a80','#b0875a','#3f7fd6','#d69a2a','#2fa8bd','#e0622e','#7d5fd6','#d6a81e','#9b4fd6','#2a8fd0','#c79a1e','#d64a6e','#d6702a','#b04ad6'],BODYC2=['#6f8c3a','#a0703a','#2f5fc0','#e07a2a','#2f9a86','#c93a3a','#5a4cc0','#c0902a','#3a5fd6','#2ab0b0','#a8861e','#d64aa0','#b0541e','#d04a8a'];
function armorSheet(key,look){const a=look.ar;if(!a||look.spr||a[0]<2&&a[1]<3)return null;const i=clamp(a[0],1,BODYC.length)-1;return tintedSheet(key,(look.set&&look.set[2]?BODYC2:BODYC)[i],a[1]===4?.5:a[1]===3?.42:.34);}
// A full ancient set: a turning rune circle under the feet, in the set's color.
function drawSetAura(x,y,sc,set,t){
  const n=set[0],c=set[1],R=(30+n*2)*sc;
  ctx.save();ctx.translate(x,y+1);ctx.scale(1,.32);ctx.globalCompositeOperation='lighter';ctx.strokeStyle=c;ctx.shadowColor=c;ctx.shadowBlur=10;
  ctx.globalAlpha=.75;ctx.lineWidth=2.5;ctx.setLineDash([10,7]);ctx.lineDashOffset=-t*24;ctx.beginPath();ctx.arc(0,0,R,0,7);ctx.stroke();
  ctx.setLineDash([]);ctx.globalAlpha=.45;ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,0,R*.72,0,7);ctx.stroke();
  if(n>=6){ctx.globalAlpha=.7;ctx.rotate(t*.8);ctx.beginPath();for(let i=0;i<=6;i++){const a=i*Math.PI*2/3*2;ctx.lineTo(Math.cos(a)*R*.72,Math.sin(a)*R*.72);}ctx.stroke();
    ctx.rotate(-t*1.6);ctx.lineWidth=3;for(let i=0;i<6;i++){const a=i*Math.PI/3;ctx.beginPath();ctx.moveTo(Math.cos(a)*R*1.06,Math.sin(a)*R*1.06);ctx.lineTo(Math.cos(a)*R*1.2,Math.sin(a)*R*1.2);ctx.stroke();}}
  ctx.restore();
  if(!calm&&Math.random()<(n>=6?.3:.14))SC.parts.push({x:x+(Math.random()-.5)*R*1.8,y:y-2,vx:0,vy:-60-Math.random()*40,life:.9,c:c,s:2});
}
// A companion that follows the hero. Which one depends on how many resets the player has done.
const PETS=[[15,'עוף החול'],[7,'דרקונון'],[3,'פיית המעגל'],[1,'רוח קטנה']];
const petTier=r=>r>=15?4:r>=7?3:r>=3?2:r>=1?1:0;
// The player's own animals, ten of them, two in each rank: 0 wolf cub, 1 silver owl, 2 ghost fox, 3 young dragon, 4 phoenix,
// 5 night cat, 6 storm raven, 7 moon rabbit, 8 flame tiger cub, 9 heavenly unicorn. Four-legged ones trot at the heel, the winged hover at the shoulder.
function drawBeast(x,y,sc,kind,t,flip,mv){
  if(kind===3||kind===4){drawPet(x,y-34*sc,sc*1.2,kind,t,flip);return;}
  const k=sc*1.25,f=flip?-1:1,run=mv?Math.sin(t*13):Math.sin(t*2.2)*.25,E=(cx,cy,rx,ry,r)=>{ctx.beginPath();ctx.ellipse(cx,cy,rx,ry,r||0,0,7);ctx.fill();},eye=(ex,ey,c,r)=>{ctx.shadowBlur=0;ctx.fillStyle=c||'#fff';E(ex,ey,r||1.6,r||1.6);ctx.fillStyle='#000';E(ex+.4,ey,(r||1.6)*.5,(r||1.6)*.5);};
  ctx.save();ctx.lineJoin='round';ctx.lineCap='round';
  if(kind===1||kind===6){ // birds: a round owl with great eyes, a lean raven with sparks
    const fl=Math.sin(t*(kind===6?11:8)),raven=kind===6,c0=raven?'#2a3350':'#cfd6e6',c1=raven?'#151a2e':'#8f9bb8';
    ctx.translate(x,y-(40+Math.sin(t*2.6)*4)*sc);ctx.scale(f*k,k);ctx.shadowColor=raven?'#7db8ff':'#fff';ctx.shadowBlur=8;
    ctx.fillStyle=c1;for(const s of [-1,1]){ctx.save();ctx.translate(-1,-1);ctx.rotate(s*(.5+fl*.55));ctx.beginPath();ctx.moveTo(0,0);ctx.quadraticCurveTo(-6,-s*10,-15,-s*(raven?13:9));ctx.quadraticCurveTo(-9,-s*3,-11,-s*1);ctx.quadraticCurveTo(-5,-s*1,0,2*s);ctx.fill();ctx.restore();}
    ctx.fillStyle=c0;if(raven){E(0,0,8,4.6,-.15);E(7,-3,4,3.6);ctx.fillStyle='#e8b23e';ctx.beginPath();ctx.moveTo(10,-4.5);ctx.lineTo(16,-2.5);ctx.lineTo(10,-1);ctx.fill();ctx.fillStyle=c1;ctx.beginPath();ctx.moveTo(-6,0);ctx.lineTo(-16,3);ctx.lineTo(-15,-1);ctx.lineTo(-6,-2);ctx.fill();eye(8,-3.6,'#9fd0ff',1.4);
      if(!calm&&Math.random()<.1)SC.parts.push({x:x-f*10*k,y:y-40*sc,vx:(Math.random()-.5)*40,vy:20,life:.3,c:'#bfe0ff',s:2});}
    else{E(0,0,7,7.5);ctx.fillStyle='#f4f6fb';E(1.5,1.5,4.2,5);ctx.fillStyle=c1;ctx.beginPath();ctx.moveTo(-5,-6);ctx.lineTo(-6,-11);ctx.lineTo(-2,-7);ctx.fill();ctx.beginPath();ctx.moveTo(4,-6.5);ctx.lineTo(6,-11);ctx.lineTo(7,-6);ctx.fill();eye(-1,-2.5,'#ffe27a',2.4);eye(4.5,-2.5,'#ffe27a',2.4);ctx.fillStyle='#e8b23e';ctx.beginPath();ctx.moveTo(1.2,-.5);ctx.lineTo(2.4,2);ctx.lineTo(3.4,-.5);ctx.fill();}
    ctx.restore();return;}
  // four-legged: one body, told apart by ears, tail, coat and what shines on them
  const Q={10:['#f2c14e','#fff0b8','#b07a1c'],0:['#8d93a6','#c9cede','#5d6274'],5:['#2b2440','#3b3158','#191428'],2:['#8fe9ff','#e6fbff','#4fb8d8'],7:['#f4f1ff','#ffffff','#c9c2ea'],8:['#ff8a2e','#ffd09a','#c44a12'],9:['#ffffff','#fff6fb','#d9d2f2']}[kind],hop=kind===7?Math.abs(Math.sin(t*(mv?9:3)))*(mv?7:2):0;
  ctx.translate(x,y-(9+hop)*sc);ctx.scale(f*k,k);
  if(kind===10){ctx.shadowColor='#ffe27a';ctx.shadowBlur=12;const fl=Math.sin(t*9);ctx.fillStyle='#fff6d8';for(const s of [-1,1]){ctx.save();ctx.translate(-1,-4);ctx.rotate(-.9+s*.25+fl*.3*s);ctx.beginPath();ctx.moveTo(0,0);ctx.quadraticCurveTo(-8,-12,-18,-13);ctx.quadraticCurveTo(-11,-7,-13,-3);ctx.quadraticCurveTo(-6,-2,2,2);ctx.fill();ctx.restore();}}
  if(kind===2){ctx.globalAlpha=.82;ctx.shadowColor='#8fe9ff';ctx.shadowBlur=12;}else if(kind===9){ctx.shadowColor='#ffd9f6';ctx.shadowBlur=12;}else if(kind===8){ctx.shadowColor='#ff8a2e';ctx.shadowBlur=8;}
  ctx.strokeStyle=Q[2];ctx.lineWidth=2.6;for(const [lx,ph] of [[-6,0],[-3,1],[5,1],[8,0]]){const a=run*(ph?1:-1)*(mv?.7:.2);ctx.beginPath();ctx.moveTo(lx,3);ctx.lineTo(lx+Math.sin(a)*4,9);ctx.stroke();}
  // tail
  if(kind===10){ctx.strokeStyle=Q[2];ctx.lineWidth=2.2;ctx.beginPath();ctx.moveTo(-9,0);ctx.quadraticCurveTo(-17,3+Math.sin(t*4)*2,-18,-6);ctx.stroke();ctx.fillStyle=Q[2];E(-18,-7,2.4,2.4);}
  else if(kind===0||kind===2){ctx.fillStyle=kind===2?Q[1]:Q[0];ctx.save();ctx.translate(-9,0);ctx.rotate(-.5+Math.sin(t*5)*.25);E(-6,0,kind===2?9:6.5,kind===2?4.2:3.2);ctx.fillStyle='#fff';E(-11,0,3,2.2);ctx.restore();}
  else if(kind===5||kind===8){ctx.strokeStyle=Q[0];ctx.lineWidth=2.4;ctx.beginPath();ctx.moveTo(-9,0);ctx.quadraticCurveTo(-18,-2+Math.sin(t*4)*3,-17,-11);ctx.stroke();if(kind===8){const g=ctx.createRadialGradient(-17,-12,0,-17,-12,6);g.addColorStop(0,'#fff6c2');g.addColorStop(.5,'#ffae42');g.addColorStop(1,'transparent');ctx.fillStyle=g;E(-17,-12-Math.abs(Math.sin(t*9)),5,6.5);}}
  else if(kind===7){ctx.fillStyle='#fff';E(-10,0,3,3);}
  else{for(let i=0;i<4;i++){ctx.strokeStyle='hsl('+((t*80+i*70)%360)+',95%,72%)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-9,-1);ctx.quadraticCurveTo(-15,2+i*2+Math.sin(t*4+i)*2,-19,6+i*1.5);ctx.stroke();}}
  ctx.fillStyle=Q[0];E(0,0,10,5.6);ctx.fillStyle=Q[1];E(1,2,7,3);
  if(kind===8){ctx.strokeStyle=Q[2];ctx.lineWidth=1.5;for(const sx of [-5,-1,3]){ctx.beginPath();ctx.moveTo(sx,-5);ctx.lineTo(sx+1.5,-.5);ctx.stroke();}}
  // head
  const hx=11,hy=kind===9?-7:-4;ctx.fillStyle=Q[0];if(kind===9){ctx.beginPath();ctx.moveTo(6,-2);ctx.lineTo(9,-8);ctx.lineTo(13,-6);ctx.lineTo(9,1);ctx.fill();E(hx+1,hy,5.5,3.6,.35);}else E(hx,hy,5.4,4.8);
  if(kind===10){ctx.fillStyle='#fff';E(hx,hy,5,4.6);ctx.beginPath();ctx.moveTo(hx-3,hy-3);ctx.lineTo(hx-4,hy-9);ctx.lineTo(hx,hy-4);ctx.fill();ctx.fillStyle='#e8962e';ctx.beginPath();ctx.moveTo(hx+3.5,hy-2);ctx.lineTo(hx+9,hy+1);ctx.lineTo(hx+3.5,hy+2.5);ctx.fill();}
  else if(kind===0||kind===2||kind===8||kind===5){ctx.beginPath();ctx.moveTo(hx-4,hy-3);ctx.lineTo(hx-3.5,hy-(kind===2?11:9));ctx.lineTo(hx-.5,hy-4);ctx.fill();ctx.beginPath();ctx.moveTo(hx+.5,hy-4);ctx.lineTo(hx+2.5,hy-(kind===2?11:9));ctx.lineTo(hx+4,hy-3);ctx.fill();if(kind!==5){ctx.fillStyle=Q[1];E(hx+3.6,hy+1.6,2.6,2);}ctx.fillStyle='#1a1426';E(hx+5.6,hy+.8,1,1);}
  else if(kind===7){ctx.save();ctx.translate(hx-1,hy-3);ctx.rotate(-.25+Math.sin(t*3)*.08);E(0,-7,1.9,7);ctx.fillStyle='#ffc9e6';E(0,-7,.8,5);ctx.restore();ctx.fillStyle=Q[0];ctx.save();ctx.translate(hx+2,hy-3);ctx.rotate(.2);E(0,-6.5,1.9,6.5);ctx.restore();ctx.fillStyle='#ff9ac8';E(hx+5.2,hy+.8,.9,.8);
    ctx.shadowColor='#fff3b0';ctx.shadowBlur=10;ctx.strokeStyle='#fff3b0';ctx.lineWidth=1.6;ctx.beginPath();ctx.arc(-1,-13+Math.sin(t*2)*1.5,4,.6,3.9);ctx.stroke();}
  else{ctx.fillStyle=Q[0];ctx.beginPath();ctx.moveTo(hx-2,hy-3);ctx.lineTo(hx-1,hy-8);ctx.lineTo(hx+1,hy-3);ctx.fill();const g=ctx.createLinearGradient(hx+2,hy-3,hx+7,hy-15);g.addColorStop(0,'#ffe27a');g.addColorStop(1,'#fff');ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(hx+1.5,hy-3);ctx.lineTo(hx+7,hy-15);ctx.lineTo(hx+4,hy-2.5);ctx.fill();
    for(let i=0;i<4;i++){ctx.strokeStyle='hsl('+((t*80+i*70)%360)+',95%,72%)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(8-i*1.2,-7+i*1.6);ctx.quadraticCurveTo(3-i,-5+i*2+Math.sin(t*4+i),1-i,1+i*.8);ctx.stroke();}}
  eye(hx+2,hy-.8,kind===5?'#ffe27a':kind===2?'#fff':'#fff',kind===5?1.9:1.6);
  ctx.restore();
  if(!calm&&(kind===2||kind===8||kind===9||kind===10)&&Math.random()<.14)SC.parts.push({x:x-f*14*k+(Math.random()-.5)*10,y:y-12*sc,vx:-f*14,vy:-16,life:.6,c:kind===8?'#ffae42':kind===10?'#ffe27a':kind===9?'hsl('+((t*80)%360)+',95%,75%)':'#bff4ff',s:2});
}
function drawPet(x,y,sc,tier,t,flip){
  const k=sc*1.15,f=flip?-1:1,bob=Math.sin(t*3.1)*4*k,fl=Math.sin(t*14)*.5;
  ctx.save();ctx.translate(x,y+bob);ctx.scale(f*k,k);ctx.lineJoin='round';
  if(tier===1){const g=ctx.createRadialGradient(0,0,1,0,0,11);g.addColorStop(0,'#fff');g.addColorStop(.4,'#8fe9ff');g.addColorStop(1,'transparent');ctx.globalCompositeOperation='lighter';ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,11,0,7);ctx.fill();
    ctx.globalAlpha=.5;ctx.beginPath();ctx.moveTo(-3,2);ctx.quadraticCurveTo(-12,6+fl*3,-18,2);ctx.quadraticCurveTo(-11,1,-3,-2);ctx.fill();}
  else if(tier===2){ctx.shadowColor='#ffb3f0';ctx.shadowBlur=10;ctx.fillStyle='rgba(255,220,250,.75)';for(const s of [-1,1]){ctx.save();ctx.rotate(s*(.5+fl*.5)-.2);ctx.beginPath();ctx.ellipse(-2,-7*s,4,9,0,0,7);ctx.fill();ctx.restore();}
    ctx.fillStyle='#fff3c4';ctx.beginPath();ctx.arc(0,0,4.5,0,7);ctx.fill();ctx.fillStyle='#ff8ad8';ctx.beginPath();ctx.arc(1.5,-.5,1.1,0,7);ctx.fill();}
  else if(tier===3){ctx.shadowColor='#5cf2b0';ctx.shadowBlur=8;
    ctx.fillStyle='#1f8f6a';ctx.beginPath();ctx.moveTo(-3,-3);ctx.lineTo(-13,-13-fl*8);ctx.lineTo(-11,-2);ctx.lineTo(-16,-4-fl*5);ctx.lineTo(-8,3);ctx.fill(); // wing
    ctx.strokeStyle='#2fc48f';ctx.lineWidth=3;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-6,4);ctx.quadraticCurveTo(-15,10,-19,4+fl*3);ctx.stroke(); // tail
    ctx.fillStyle='#2fc48f';ctx.beginPath();ctx.ellipse(-2,3,8,5.5,-.2,0,7);ctx.fill();ctx.beginPath();ctx.arc(7,-3,5,0,7);ctx.fill();ctx.beginPath();ctx.moveTo(10,-4);ctx.lineTo(15,-2);ctx.lineTo(10,0);ctx.fill();
    ctx.fillStyle='#ffe27a';ctx.beginPath();ctx.moveTo(5,-7);ctx.lineTo(4,-12);ctx.lineTo(8,-8);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(8.5,-4,1.5,0,7);ctx.fill();ctx.fillStyle='#000';ctx.beginPath();ctx.arc(9,-4,.7,0,7);ctx.fill();}
  else{ctx.shadowColor='#ffae42';ctx.shadowBlur=14;const hue=(t*60)%40;
    for(const s of [-1,1]){ctx.save();ctx.rotate(s*(.35+fl*.45));for(let i=0;i<4;i++){ctx.fillStyle='hsl('+(18+hue+i*8)+',100%,'+(55+i*6)+'%)';ctx.beginPath();ctx.moveTo(-2,0);ctx.quadraticCurveTo(-8-i*2,-s*(8+i*3),-16-i*2,-s*(14+i*2));ctx.quadraticCurveTo(-6-i,-s*(3+i),2,0);ctx.fill();}ctx.restore();}
    for(let i=0;i<3;i++){ctx.strokeStyle='hsl('+(25+i*12)+',100%,62%)';ctx.lineWidth=2.4-i*.5;ctx.beginPath();ctx.moveTo(-5,2);ctx.quadraticCurveTo(-14,8+i*3+fl*3,-24-i*3,3+i*4);ctx.stroke();}
    ctx.fillStyle='#ffd75e';ctx.beginPath();ctx.ellipse(0,1,7,4.5,-.15,0,7);ctx.fill();ctx.beginPath();ctx.arc(7,-3,3.8,0,7);ctx.fill();ctx.fillStyle='#ff7a2e';ctx.beginPath();ctx.moveTo(10,-4);ctx.lineTo(14.5,-2.5);ctx.lineTo(10,-1);ctx.fill();
    ctx.beginPath();ctx.moveTo(6,-6);ctx.lineTo(4,-12);ctx.lineTo(8,-9);ctx.lineTo(9,-13);ctx.lineTo(10,-6);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#000';ctx.beginPath();ctx.arc(8,-3.5,.8,0,7);ctx.fill();}
  ctx.restore();
  if(tier>=3&&!calm&&Math.random()<.18)SC.parts.push({x:x-f*8*k,y:y+bob+4,vx:-f*20,vy:-10,life:.5,c:tier===4?'#ffae42':'#5cf2b0',s:2});
}
// A title by resets, shown over the head.
const TITLES=[[30,'בן אלמוות','#ff6b8a'],[15,'אגדה','#ffd75e'],[7,'אלוף המעגל','#c77dff'],[3,'לוחם מעגל','#5aa9ff'],[1,'מתעורר','#8be28b']];
const titleOf=r=>TITLES.find(x=>r>=x[0])||null;
function nameTag(x,y,name,r,tag,crown){const tl=titleOf(r|0);label((crown?'♛ ':'')+(tag?'['+tag+'] ':'')+name,x,y,tl?tl[2]:'#e9e4ff',12);if(tl)label(tl[1],x,y-14,tl[2],10.5);}
// Upgraded armor shows on the body the way it does in MU. `sp` is [lowest, average] upgrade level over the five armor pieces.
// Average +7 a faint shimmer, +9 a steady glow, +11 a pulse with a band of light crossing the body.
// Every piece at +13: an aura of rising flame around the whole body; at +15 it turns to shifting colors.
function armorPlus(s){let mn=99,sum=0;for(const k in ARM){const it=s.eq[k],p=it?it.p|0:0;sum+=p;if(p<mn)mn=p;}return [mn===99?0:mn,Math.round(sum/5)];}
const GLOW_NAME=[[15,'הילת קשת'],[13,'הילת להבה'],[11,'זוהר פועם'],[9,'זוהר'],[7,'נצנוץ']];
function glowTier(sp){if(!sp)return 0;const mn=sp[0]|0,av=sp[1]|0;return mn>=15?15:mn>=13?13:av>=11?11:av>=9?9:av>=7?7:0;}
function armorGlowColor(look,t,tier){if(tier>=15)return 'hsl('+((t*80)%360)+',95%,66%)';const a=look.ar;return look.set?look.set[1]:a?(a[1]===4?RAR[4].c:TCOL[clamp(a[0],1,12)-1]):'#ffe9a6';}
function sprFrame(sheet,key,an,fi,x,y,k,flip,alpha,dx,dy,sx,sy){ // one frame of a sheet, drawn about the feet, optionally stretched
  const m=SPR[key],a=m.a[an]||m.a.idle;fi=Math.max(0,Math.min(a[1]-1,fi|0));
  ctx.save();ctx.translate(Math.round(x+(dx||0)),Math.round(y+(dy||0)));ctx.scale((flip?-k:k)*(sx||1),k*(sy||1));ctx.imageSmoothingEnabled=false;ctx.globalAlpha=alpha;
  ctx.drawImage(sheet,fi*m.w,a[0]*m.h,m.w,m.h,-m.ax,-m.ay,m.w,m.h);ctx.restore();
}
function silhouette(key,col){const im=IMG[key];if(!im||!im.complete||!im.naturalWidth)return null;const id='sil'+key+col;if(TINT[id])return TINT[id];
  const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;const x=c.getContext('2d');x.drawImage(im,0,0);x.globalCompositeOperation='source-in';x.fillStyle=col;x.fillRect(0,0,c.width,c.height);
  if(Object.keys(TINT).length>80)for(const k in TINT)if(k.startsWith('sil'))delete TINT[k];
  return TINT[id]=c;}
// From +13 a ring circles the body with an orb riding it; at +15 there are three orbs, lightning jumps from them
// to the body and a rune turns on the ground. The far half is drawn behind the body and the near half over it.
function drawOrbit(x,y,k,bh,t,tier,col,front){
  const cx=x,cy=y-bh*k*.5,rx=bh*k*.5,ry=rx*.3,n=tier>=15?3:1,c=tier>=15?col:'#ffd75e';
  ctx.save();ctx.globalCompositeOperation='lighter';ctx.strokeStyle=c;ctx.shadowColor=c;ctx.shadowBlur=10;
  if(!front&&tier>=15){ctx.save();ctx.translate(x,y);ctx.scale(1,.3);ctx.globalAlpha=.55;ctx.lineWidth=2;const R=rx*1.25;ctx.beginPath();ctx.arc(0,0,R,0,7);ctx.stroke();ctx.rotate(t*1.3);ctx.beginPath();for(let i=0;i<5;i++){const q=i*1.2566;ctx.moveTo(Math.cos(q)*R,Math.sin(q)*R);ctx.lineTo(Math.cos(q+2.513)*R,Math.sin(q+2.513)*R);}ctx.stroke();ctx.restore();}
  ctx.globalAlpha=.5;ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(cx,cy,rx,ry,-.18,front?0:Math.PI,front?Math.PI:Math.PI*2);ctx.stroke();
  for(let i=0;i<n;i++){const a=t*2.6+i*6.283/n,sn=Math.sin(a);if((sn>0)!==front)continue;
    const ox=cx+Math.cos(a)*rx*Math.cos(-.18)-sn*ry*Math.sin(-.18),oy=cy+Math.cos(a)*rx*Math.sin(-.18)+sn*ry*Math.cos(-.18);
    ctx.globalAlpha=1;ctx.shadowBlur=0;const g=ctx.createRadialGradient(ox,oy,0,ox,oy,9*k*.5+3);g.addColorStop(0,'#fff');g.addColorStop(.35,c);g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.fillRect(ox-14,oy-14,28,28);
    if(tier>=15&&!calm){const ph=Math.floor(t*14)+i*5;if(ph%3!==1){let px=ox,py=oy;const tx=cx+(((ph*13)%9)-4)*k,ty=cy+(((ph*7)%15)-7)*k;ctx.shadowBlur=8;
      for(const [w,cc] of [[3,c],[1.2,'#fff']]){ctx.strokeStyle=cc;ctx.lineWidth=w;ctx.beginPath();ctx.moveTo(ox,oy);px=ox;py=oy;for(let j=1;j<=4;j++){const u=j/4,jx=j<4?(((ph*31+j*17)%13)-6)*k*.8:0,jy=j<4?(((ph*19+j*11)%13)-6)*k*.8:0;ctx.lineTo(ox+(tx-ox)*u+jx,oy+(ty-oy)*u+jy);}ctx.stroke();}}
      if(Math.random()<.2)SC.parts.push({x:ox,y:oy,vx:(Math.random()-.5)*60,vy:-20,life:.35,c:c,s:2});}
  }
  ctx.restore();
}
function drawArmorAura(key,an,fi,x,y,k,flip,tier,col,t,bh){ // behind the body
  if(tier<7)return;const hueStep=tier>=15?Math.floor(t*6)%12:0,c=tier>=15?'hsl('+hueStep*30+',95%,66%)':col,sil=silhouette(key,c);if(!sil)return;
  ctx.save();ctx.globalCompositeOperation='lighter';ctx.shadowColor=c;
  if(tier>=13){ // flame: copies of the outline, taller and fainter, wavering upward
    for(let i=1;i<=4;i++){const w=Math.sin(t*7+i*1.7)*2.2*k*.5,up=i*(3.2+Math.sin(t*5+i)*1.2)*k*.5;ctx.shadowBlur=10+i*5;
      sprFrame(sil,key,an,fi,x,y,k,flip,.34-i*.06,w,-up*.35,1+i*.035,1+i*.075);}
    if(!calm)for(let n=0;n<2;n++)if(Math.random()<.5)SC.parts.push({x:x+(Math.random()-.5)*30*k*.5,y:y-Math.random()*bh*k,vx:(Math.random()-.5)*10,vy:-70-Math.random()*50,life:.7,c:c,s:Math.random()<.3?3:2});
  }else{const pulse=.5+.5*Math.sin(t*(tier>=11?5:3)),n=tier>=11?3:2,base=tier>=11?.34:tier>=9?.3:.24;for(let i=1;i<=n;i++){ctx.shadowBlur=10+i*7;sprFrame(sil,key,an,fi,x,y,k,flip,(base+.14*pulse)/i,0,-i,1+i*.05,1+i*.04);}
    if(!calm&&Math.random()<(tier>=9?.22:.12))SC.parts.push({x:x+(Math.random()-.5)*34*k*.5,y:y-Math.random()*bh*k*.8,vx:0,vy:-45-Math.random()*30,life:.7,c:c,s:2});}
  ctx.restore();
}
function drawArmorShine(key,an,fi,x,y,k,flip,tier,t,bh){ // over the body: sparkles, and from +11 a band of light that crosses it
  if(tier<7)return;
  if(!calm&&Math.random()<(tier>=11?.28:tier>=9?.2:.13))SC.nums.push({x:x+(Math.random()-.5)*34*k*.5,y:y-Math.random()*bh*k,txt:'✦',c:'#ffffff',s:7+Math.random()*6,life:.35});
  if(tier<11)return;const sil=silhouette(key,'#ffffff');if(!sil)return;const m=SPR[key],per=tier>=13?1.6:2.4,u=(t%per)/per;if(u>.45)return;
  const span=m.w*k,bx=x-span/2+u/.45*span,bw=7*k;
  ctx.save();ctx.beginPath();ctx.moveTo(bx,y+4);ctx.lineTo(bx+bw,y+4);ctx.lineTo(bx+bw+bh*k*.5,y-m.h*k);ctx.lineTo(bx+bh*k*.5,y-m.h*k);ctx.closePath();ctx.clip();
  ctx.globalCompositeOperation='lighter';sprFrame(sil,key,an,fi,x,y,k,flip,.5);ctx.restore();
}
// The weapon carried on the back: its shape follows the item tier (six designs per class), its glow the upgrade level.
const TCOL=['#9aa3ad','#c9d2dc','#bfe3ff','#e8c27a','#9fe8ff','#ff8a4d','#a487ff','#ffd75e','#b07cff','#8fe6ff','#ffe27a','#ff6b8a','#ff9a3d','#f4f0ff'],TCOL2=['#7f8c5a','#b9a37c','#8fb7ff','#ffb36b','#6fd0c8','#ff5c5c','#7a6cd6','#ffe9a0','#5c8dff','#b7f0ff','#d9b24a','#ff9ad0','#c96a2a','#ffd0f0'];
TCOL.push('#e9e4ff');TCOL2.push('#ff3a4a'); // the void's two sets
function drawBackWeapon(x,y,look,t,k,flip){
  const w=look.w;if(!w)return;const tier=clamp(w[0]|0,1,12),st=Math.floor((tier-1)/2),p=w[2]|0,base=TCOL[tier-1],ex=w[4]|0,edge=p>=15||ex===2?'hsl('+((t*90)%360)+',95%,72%)':ex?'#7dffb0':RAR[w[1]].c,gl=Math.max(glowAmt(p,w[1],t),ex?8+ex*3:0);
  ctx.save();ctx.translate(x,y+Math.sin(t*2.2)*1.5*k);ctx.scale(flip?-k:k,k);ctx.rotate(look.c==='hunter'?-.95:-.62);
  if(gl||tier>=7){ctx.shadowColor=edge;ctx.shadowBlur=Math.max(gl,tier>=7?6:0);}
  ctx.lineJoin='round';ctx.lineCap='round';
  const shaft=(a,b,wd,col)=>{ctx.strokeStyle=col;ctx.lineWidth=wd;ctx.beginPath();ctx.moveTo(0,a);ctx.lineTo(0,b);ctx.stroke();};
  const poly=(pts,fill)=>{ctx.fillStyle=fill;ctx.beginPath();pts.forEach((q,i)=>i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]));ctx.closePath();ctx.fill();ctx.strokeStyle=edge;ctx.lineWidth=.7;ctx.stroke();};
  if(look.c==='blade'){
    const len=[15,18,19,21,24,26][st],wd=[1.6,2.4,1.8,2.6,3.2,2.8][st];
    shaft(2,7,1.6,'#5a4630');ctx.fillStyle=edge;ctx.fillRect(-4-st*.4,0,8+st*.8,1.6);ctx.beginPath();ctx.arc(0,8,1.5,0,7);ctx.fill();
    if(st===2)poly([[-wd,0],[wd,0],[wd+2.5,-len*.6],[1.5,-len],[-wd*.4,-len*.55]],base); // saber
    else if(st===3)poly([[-wd,0],[wd,0],[wd+1.5,-len*.25],[wd-.6,-len*.4],[wd+1.5,-len*.6],[0,-len],[-wd-1.5,-len*.6],[-wd+.6,-len*.4],[-wd-1.5,-len*.25]],base); // flame blade
    else if(st===4)poly([[-wd,0],[wd,0],[wd+1.5,-len*.7],[0,-len],[-wd-1.5,-len*.7]],base); // crystal greatsword
    else if(st===5){poly([[-wd,0],[wd,0],[wd,-len*.75],[0,-len],[-wd,-len*.75]],base);ctx.fillStyle=edge;for(let i=1;i<4;i++){ctx.beginPath();ctx.arc(0,-len*i*.22,.9,0,7);ctx.fill();}} // rune blade
    else poly([[-wd,0],[wd,0],[wd*.8,-len*.8],[0,-len],[-wd*.8,-len*.8]],base);
    ctx.strokeStyle='rgba(255,255,255,.7)';ctx.lineWidth=.6;ctx.beginPath();ctx.moveTo(0,-2);ctx.lineTo(0,-len*.8);ctx.stroke();
  }else if(look.c==='storm'||look.c==='lord'){
    const len=22+st*1.2;shaft(8,-len,1.7,st>=3?'#3b2a5c':'#6b4a2e');const ty=-len-2,pul=1+.12*Math.sin(t*5);
    if(st===1){ctx.strokeStyle=edge;ctx.lineWidth=1.6;ctx.beginPath();ctx.arc(0,ty-2,4.5,.6,Math.PI*2-.6+1.2);ctx.stroke();} // crescent
    else if(st===2)poly([[0,ty-9],[3,ty-3],[0,ty+2],[-3,ty-3]],base); // crystal
    else if(st===3){for(const dx of [-3.4,0,3.4])poly([[dx-1,ty+1],[dx+1,ty+1],[dx,ty-7-(dx?0:3)]],base);} // trident
    else if(st===4){ctx.fillStyle=base;ctx.strokeStyle=edge;ctx.lineWidth=.7;ctx.beginPath();for(let i=0;i<10;i++){const r=i%2?2.4:6,a=i*Math.PI/5-Math.PI/2+t;ctx.lineTo(Math.cos(a)*r,ty-4+Math.sin(a)*r);}ctx.closePath();ctx.fill();ctx.stroke();} // star
    else if(st===5){ctx.strokeStyle=edge;ctx.lineWidth=1.4;for(const r of [3,6]){ctx.beginPath();ctx.ellipse(0,ty-4,r,r*.45,t*(r===3?2:-1.4),0,7);ctx.stroke();}}
    ctx.fillStyle=st===5?'#fff':base;ctx.beginPath();ctx.arc(0,ty-(st===0?2:4),(st===0?3.4:2.2)*pul,0,7);ctx.fill();
  }else{
    const len=26+st*1.3;shaft(10,-len,1.4,'#6b4a2e');const ty=-len;
    if(st===1)poly([[0,ty-9],[2.4,ty-2],[4.5,ty+2],[1,ty],[0,ty+3],[-1,ty],[-4.5,ty+2],[-2.4,ty-2]],base); // barbed
    else if(st===2)poly([[-1,ty+4],[1,ty+4],[4.5,ty-4],[1.5,ty-12],[-1,ty-3]],base); // glaive
    else if(st===3){poly([[-2.6,ty+1],[-1,ty-9],[0,ty+1]],base);poly([[0,ty+1],[1,ty-9],[2.6,ty+1]],base);} // twin tip
    else if(st===4)poly([[0,ty-11],[2.2,ty-3],[5,ty-1],[2,ty+1],[0,ty+4],[-2,ty+1],[-5,ty-1],[-2.2,ty-3]],base); // harpoon
    else if(st===5){poly([[0,ty-12],[2.4,ty-2],[-2.4,ty-2]],base);poly([[1,ty],[7,ty-5],[6,ty+4]],base);} // halberd
    else poly([[0,ty-8],[2.6,ty-1],[0,ty+2],[-2.6,ty-1]],base);
    ctx.fillStyle=edge;ctx.fillRect(-1.6,ty+3,3.2,1.4);
  }
  ctx.restore();
  if((p>=9||ex)&&!calm&&Math.random()<(p>=13||ex===2?.3:.12))SC.parts.push({x:x+(flip?1:-1)*(4+Math.random()*10)*k,y:y-(6+Math.random()*22)*k,vx:0,vy:-14,life:.6,c:edge,s:2});
}
function rr(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
// The body changes with the account's resets: fire at the back, cracked ground, a fan of blades, a crown, lightning.
// Upgrades add sparkles one by one, and a perfect ancient piece puts moving colours around the wearer.
const PRISM=['#ff5c7a','#ffb23e','#ffd75e','#62f3e2','#5aa9ff','#c77dff'];
function drawForm(key,an,fi,x,y,bx,by,k,sc,bh,look,t,flip,front,anim){
  if(LITE)return;
  const r=look.r|0,cc=(CLS[look.c]||CLS.blade).c,H=bh*k,hot=r>=25?'#ff3b5c':r>=10?'#ff7a3d':cc,av=look.sp?look.sp[1]|0:0,pf=look.pf|0;
  if(!r&&!av&&!pf)return;ctx.save();ctx.globalCompositeOperation='lighter';
  if(!front){
    if(r>=6){ctx.strokeStyle=hot;ctx.shadowColor=hot;ctx.shadowBlur=8;ctx.lineWidth=1.6;ctx.globalAlpha=.45+.2*Math.sin(t*3);const n=r>=15?7:5;for(let i=0;i<n;i++){const a=i/n*6.28+.4,L=(20+((i*37)%14))*sc*(r>=25?1.3:1);ctx.beginPath();ctx.moveTo(x+Math.cos(a)*6*sc,y+1+Math.sin(a)*2*sc);ctx.lineTo(x+Math.cos(a+.25)*L*.55,y+1+Math.sin(a+.25)*L*.18);ctx.lineTo(x+Math.cos(a)*L,y+1+Math.sin(a)*L*.3);ctx.stroke();}}
    if(r>=3){const sil=silhouette(key,hot);if(sil){ctx.shadowColor=hot;ctx.shadowBlur=14;const n=r>=15?3:2;for(let i=1;i<=n;i++)sprFrame(sil,key,an,fi,x,y,k,flip,(r>=25?.13:.15)/i,0,-i*2,1+.05*i+.02*Math.sin(t*9+i),1+.08*i+.035*Math.sin(t*11+i*2));}}
    if(r>=40&&!calm){const cy=by-H*.6,R=36*sc;ctx.strokeStyle='#ffd75e';ctx.shadowColor='#ffd75e';ctx.shadowBlur=10;ctx.globalAlpha=.5;ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(bx,cy,R,0,7);ctx.stroke();for(let i=0;i<8;i++){const a=t*.7+i*.785;ctx.beginPath();ctx.moveTo(bx+Math.cos(a)*R*.82,cy+Math.sin(a)*R*.82);ctx.lineTo(bx+Math.cos(a)*R*1.14,cy+Math.sin(a)*R*1.14);ctx.stroke();}}
    if(r>=10){const n=r>=40?8:r>=25?6:r>=15?5:3,cy=by-H*.58,cx=bx-(flip?-1:1)*5*sc,fl=1+(anim>0?anim*.3:0);ctx.shadowColor=hot;ctx.shadowBlur=12;
      for(let i=0;i<n;i++){const u=n>1?i/(n-1)-.5:0,a=-1.5708+u*(n>=6?2.5:1.9)+Math.sin(t*1.6+i)*.05,L=(26+(1-Math.abs(u)*1.2)*12+(r>=25?6:0))*sc*fl,d=14*sc,ox=cx+Math.cos(a)*d,oy=cy+Math.sin(a)*d,tx=cx+Math.cos(a)*(d+L),ty=cy+Math.sin(a)*(d+L),nx=-Math.sin(a)*3.2*sc,ny=Math.cos(a)*3.2*sc,mx=ox+(tx-ox)*.3,my=oy+(ty-oy)*.3;
        ctx.globalAlpha=.8;ctx.fillStyle=hot;ctx.beginPath();ctx.moveTo(ox,oy);ctx.lineTo(mx+nx,my+ny);ctx.lineTo(tx,ty);ctx.lineTo(mx-nx,my-ny);ctx.closePath();ctx.fill();ctx.globalAlpha=.9;ctx.strokeStyle='#fff';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(ox,oy);ctx.lineTo(tx,ty);ctx.stroke();}}
    ctx.restore();return;}
  if(r>=1&&!calm){const n=3+Math.min(6,r>>1);ctx.shadowColor=hot;ctx.shadowBlur=6;for(let i=0;i<n;i++){const ph=(t*.55+i*.371)%1;ctx.globalAlpha=(1-ph)*.85;ctx.fillStyle=i%3?hot:'#ffd9a0';const s2=(1.4+(i%3)*.6)*sc;ctx.fillRect(x+Math.sin(i*12.9+ph*3)*20*sc,y-ph*H*.95,s2,s2);}}
  if(r>=15){const n=r>=25?5:3,hy=by-H-3*sc;ctx.fillStyle='#ffd75e';ctx.shadowColor='#ffd75e';ctx.shadowBlur=10;ctx.globalAlpha=.75+.2*Math.sin(t*4);for(let i=0;i<n;i++){const u=i-(n-1)/2,px=bx+u*6*sc,hh=(9-Math.abs(u)*2.2)*sc;ctx.beginPath();ctx.moveTo(px-2*sc,hy);ctx.lineTo(px,hy-hh);ctx.lineTo(px+2*sc,hy);ctx.closePath();ctx.fill();}}
  if(r>=25&&!calm&&Math.floor(t*2.5)%3===0){const sd=Math.floor(t*14),rn=i=>{const v=Math.sin(sd*12.9898+i*78.233)*43758.5453;return v-Math.floor(v);};ctx.strokeStyle='#fff';ctx.shadowColor=hot;ctx.shadowBlur=12;ctx.globalAlpha=.8;ctx.lineWidth=1.4;const side=rn(0)<.5?-1:1;let px=bx+side*10*sc,py=by-H*.7;ctx.beginPath();ctx.moveTo(px,py);for(let i=1;i<=5;i++){px+=side*(rn(i)*10-2)*sc;py+=H*.14;ctx.lineTo(px,py);}ctx.stroke();}
  if(av>0){const n=Math.min(15,av);ctx.fillStyle='#fff';ctx.shadowColor=cc;ctx.shadowBlur=8;for(let i=0;i<n;i++){const tw=Math.pow(Math.max(0,Math.sin(t*2.6+i*2.1)),3);if(tw<.05)continue;const px=x+Math.sin(i*91.7)*22*sc,py=y-((i*.618)%1)*H,S2=(1.6+av*.14)*sc*tw;ctx.globalAlpha=tw;ctx.beginPath();ctx.moveTo(px,py-S2*2);ctx.lineTo(px+S2*.5,py-S2*.5);ctx.lineTo(px+S2*2,py);ctx.lineTo(px+S2*.5,py+S2*.5);ctx.lineTo(px,py+S2*2);ctx.lineTo(px-S2*.5,py+S2*.5);ctx.lineTo(px-S2*2,py);ctx.lineTo(px-S2*.5,py-S2*.5);ctx.closePath();ctx.fill();}}
  if(pf>0){const col=PRISM[Math.floor(t*3)%6],sil=silhouette(key,col);if(sil){ctx.shadowColor=col;ctx.shadowBlur=16;sprFrame(sil,key,an,fi,x,y,k,flip,.07+.02*pf,0,-1,1.05,1.04);}
    const n=Math.min(12,pf*2);for(let i=0;i<n;i++){const a=t*1.8+i*6.28/n,px=bx+Math.cos(a)*26*sc,py=by-H*.5+Math.sin(a)*H*.42+Math.sin(a*2)*4;ctx.globalAlpha=Math.sin(a)>0?.95:.4;ctx.fillStyle=PRISM[(i+Math.floor(t*4))%6];ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=10;ctx.beginPath();ctx.arc(px,py,2.2*sc,0,7);ctx.fill();}}
  ctx.restore();
}
// The warlord rides. His beast is drawn under him: a great dark war-beast in gilded plate, mane and tail of fire, and
// it fights with him: its head lunges with his blows and on his skills it breathes fire.
const MOUNT_UP=27,MOUNT_SC=.86,MOUNT_BIG=1.25; // the rider's feet are deep inside the beast and the saddle cloth covers him to the hip: he sits
function drawMount(x,y,sc,t,flip,mv,anim,sk,front){
  const f=flip?-1:1,u=sc*MOUNT_BIG,X=q=>x+f*q*u,Y=q=>y-q*u,run=mv?Math.sin(t*13):0,bob=mv?Math.abs(Math.sin(t*13))*2.5*u:Math.sin(t*2.4)*.8*u,lunge=anim>0?Math.sin((1-anim)*Math.PI)*9:0,FIRE='#ff7a2e';
  ctx.save();
  if(!front){
    ctx.fillStyle='rgba(0,0,0,.4)';ctx.beginPath();ctx.ellipse(x,y+1,44*u,7*u,0,0,7);ctx.fill();
    // far legs, then the tail of fire, then the body
    const leg=(bx,ph,col,w)=>{const sw=run?Math.sin(t*13+ph)*9:0,lift=run?Math.max(0,Math.cos(t*13+ph))*5:0;ctx.strokeStyle=col;ctx.lineWidth=w*u;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(X(bx),Y(24)-bob);ctx.lineTo(X(bx+sw*.4),Y(12+lift));ctx.lineTo(X(bx+sw),Y(lift));ctx.stroke();
      if(!LITE){ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=.55+.25*Math.sin(t*9+ph);ctx.fillStyle=FIRE;ctx.beginPath();ctx.ellipse(X(bx+sw),Y(lift+1),6*u,3*u,0,0,7);ctx.fill();ctx.restore();}};
    leg(-20,2.2,'#120c18',6);leg(20,.6,'#120c18',6);
    if(!LITE){ctx.save();ctx.globalCompositeOperation='lighter';for(let q=0;q<3;q++){const w=Math.sin(t*8+q*1.3)*4;ctx.globalAlpha=.7-q*.16;ctx.fillStyle=q<2?'#ffd75e':FIRE;ctx.beginPath();ctx.moveTo(X(-32),Y(40)-bob);ctx.quadraticCurveTo(X(-46-q*5),Y(46+w)-bob,X(-52-q*6),Y(30-q*5+w)-bob);ctx.quadraticCurveTo(X(-42-q*3),Y(32)-bob,X(-32),Y(32)-bob);ctx.fill();}ctx.restore();}
    const g=ctx.createLinearGradient(0,Y(50),0,Y(20));g.addColorStop(0,'#3a2a48');g.addColorStop(1,'#140e1c');ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(x,Y(35)-bob,36*u,14*u,0,0,7);ctx.fill();
    ctx.beginPath();ctx.ellipse(X(-22),Y(36)-bob,16*u,15*u,0,0,7);ctx.fill();ctx.beginPath();ctx.ellipse(X(24),Y(38)-bob,15*u,15*u,0,0,7);ctx.fill();
    leg(-26,0,'#241a2e',7);leg(14,3.6,'#241a2e',7);
    ctx.restore();return;}
  // in front of the rider: the saddle cloth over his legs, the plated neck and head, the mane of fire, the breath
  ctx.fillStyle='#7a1626';ctx.strokeStyle='#f2c14e';ctx.lineWidth=1.6*u;ctx.beginPath();ctx.moveTo(X(-13),Y(53)-bob);ctx.lineTo(X(13),Y(53)-bob);ctx.lineTo(X(17),Y(26)-bob);ctx.lineTo(X(0),Y(19)-bob);ctx.lineTo(X(-17),Y(26)-bob);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.strokeStyle='#3a2418';ctx.lineWidth=3*u;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(X(4),Y(50)-bob);ctx.lineTo(X(10),Y(30)-bob);ctx.stroke();ctx.fillStyle='#f2c14e';ctx.beginPath();ctx.ellipse(X(11),Y(27)-bob,4*u,2.4*u,0,0,7);ctx.fill();ctx.strokeStyle='#f2c14e';ctx.lineWidth=1.6*u; // the stirrup
  ctx.fillStyle='#f2c14e';ctx.beginPath();ctx.moveTo(X(0),Y(42)-bob);ctx.lineTo(X(5),Y(35)-bob);ctx.lineTo(X(0),Y(28)-bob);ctx.lineTo(X(-5),Y(35)-bob);ctx.closePath();ctx.fill();
  const hx=X(50+lunge),hy=Y(60-lunge*.5)-bob;
  ctx.strokeStyle='#241a2e';ctx.lineWidth=17*u;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(X(28),Y(42)-bob);ctx.quadraticCurveTo(X(36),Y(58)-bob,hx-f*6*u,hy+3*u);ctx.stroke();
  ctx.strokeStyle='#f2c14e';ctx.lineWidth=2*u;ctx.beginPath();ctx.moveTo(X(22),Y(50)-bob);ctx.quadraticCurveTo(X(31),Y(40)-bob,X(38),Y(34)-bob);ctx.stroke();
  ctx.save();ctx.translate(hx,hy);ctx.scale(f,1);ctx.rotate(.5-lunge*.02);
  ctx.fillStyle='#2c2038';ctx.beginPath();ctx.ellipse(4*u,0,13*u,7.5*u,0,0,7);ctx.fill();ctx.fillStyle='#f2c14e';ctx.beginPath();ctx.moveTo(-6*u,-7*u);ctx.lineTo(12*u,-6*u);ctx.lineTo(15*u,-1*u);ctx.lineTo(-4*u,-2*u);ctx.closePath();ctx.fill(); // the gilded face plate
  ctx.fillStyle='#e9e2f5';ctx.beginPath();ctx.moveTo(-5*u,-7*u);ctx.lineTo(-9*u,-19*u);ctx.lineTo(-1*u,-8*u);ctx.closePath();ctx.fill();ctx.beginPath();ctx.moveTo(2*u,-7*u);ctx.lineTo(1*u,-16*u);ctx.lineTo(6*u,-7*u);ctx.closePath();ctx.fill(); // horns
  ctx.save();ctx.globalCompositeOperation='lighter';ctx.fillStyle='#ff3b2e';ctx.beginPath();ctx.arc(5*u,-3*u,2.4*u,0,7);ctx.fill();ctx.restore();
  if(anim>0&&!LITE){const p=Math.sin((1-anim)*Math.PI),L=(sk?80:34)*u*p;ctx.save();ctx.globalCompositeOperation='lighter';const gr=ctx.createLinearGradient(14*u,0,14*u+L,0);gr.addColorStop(0,'#fff');gr.addColorStop(.4,FIRE);gr.addColorStop(1,'transparent');ctx.fillStyle=gr;for(let q=0;q<2;q++){ctx.globalAlpha=.75*p;ctx.beginPath();ctx.moveTo(14*u,2*u);ctx.quadraticCurveTo(14*u+L*.6,(-10-q*6)*u*p+Math.sin(t*30+q)*3,14*u+L,(q-1)*12*u*p);ctx.quadraticCurveTo(14*u+L*.6,(12+q*5)*u*p,14*u,5*u);ctx.fill();}ctx.restore();}
  ctx.restore();
  if(!LITE){ctx.save();ctx.globalCompositeOperation='lighter';for(let q=0;q<4;q++){const u2=q/3,mx=X(26+u2*20+lunge*u2),my=Y(46+u2*18-lunge*.4*u2)-bob,fl=(9+Math.sin(t*10+q*1.7)*4)*u;ctx.globalAlpha=.75;ctx.fillStyle=q%2?'#ffd75e':FIRE;ctx.beginPath();ctx.moveTo(mx-4*u,my);ctx.quadraticCurveTo(mx-f*6*u,my-fl*1.5,mx+4*u,my);ctx.fill();}ctx.restore();}
  ctx.restore();
}
function drawHero(x,y,sc,look,t,anim,flip,dead,mv,fury){
  if(look.c==='lord'&&!dead&&!look.spr&&!drawHero.rid){drawMount(x,y,sc,t,flip,mv,anim,look.sk,false);drawHero.rid=1;try{drawHero(x,y-MOUNT_UP*sc,sc*MOUNT_SC,look,t,anim,flip,dead,false,fury);}finally{drawHero.rid=0;}drawMount(x,y,sc,t,flip,mv,anim,look.sk,true);return;}
  const key=look.spr||CLSSPR[look.c],m=SPR[key],k=2*sc,cl=CLS[look.c]||CLS.blade;
  const maxP=Math.max(look.w?look.w[2]:0,look.ar?look.ar[2]:0,look.g?look.g[2]:0);
  const gc=fury?'#ffd75e':gearColor(look.w||look.ar||look.g,t,cl.c);
  if((maxP>=11||fury)&&!dead&&!LITE){const gr=ctx.createRadialGradient(0,0,2,0,0,50);gr.addColorStop(0,gc);gr.addColorStop(1,'transparent');
    ctx.save();ctx.translate(x,y);ctx.globalCompositeOperation='lighter';ctx.globalAlpha=.4+.15*Math.sin(t*5);ctx.scale(1,.3);ctx.fillStyle=gr;ctx.beginPath();ctx.arc(0,0,50,0,7);ctx.fill();ctx.restore();}
  ctx.fillStyle='rgba(0,0,0,.35)';ctx.beginPath();ctx.ellipse(x,y+1,20*sc,5*sc,0,0,7);ctx.fill();
  if(look.set&&!dead&&!LITE)drawSetAura(x,y,sc,look.set,t);
  if(!dead&&!look.spr&&look.pet&&!LITE){const pr=look.pet===21?2:clamp((look.pet-1)%10,0,4),pk=look.pet===21?10:pr+(look.pet>10?5:0),px=x+(flip?-1:1)*(pk===1||pk===6||pk===3||pk===4?30:40)*sc,pc=RAR[pr].c;ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=.35+.15*Math.sin(t*4);ctx.fillStyle=pc;ctx.beginPath();ctx.ellipse(px,y+1,12*sc,4*sc,0,0,7);ctx.fill();ctx.restore();drawBeast(px,y,sc,pk,t+2.3,flip,mv);}
  if(!dead&&!look.spr&&!LITE&&petTier(look.r|0))drawPet(x-(flip?-1:1)*38*sc,y-m.bh*k*.92,sc,petTier(look.r|0),t+(look.c==='storm'?1:0),flip);
  let an='idle',fi=Math.floor(t*8);
  if(dead){an='die';fi=Math.min(frames(key,'die')-1,Math.floor((dead===true?9:dead)*8));}
  else if(anim>0){an=look.sk&&m.a.atk2?'atk2':'atk';fi=Math.floor((1-anim)*frames(key,an));}
  else if(mv){an='run';fi=Math.floor(t*12)%frames(key,'run');}
  else fi=fi%frames(key,'idle');
  const bs=look.spr||dead?[0,0]:bodyShift(key,an,fi),bx=x+(flip?-1:1)*bs[0]*k,by=y+bs[1]*k; // the body's place in this frame
  if(!dead&&!look.spr)drawForm(key,an,fi,x,y,bx,by,k,sc,m.bh,look,t,flip,false,anim);
  if(look.g&&!dead)drawWings(bx,by,look.g,t,k,flip,look.c,m.bh,mv,anim);
  // Every class's figure already holds its own weapon, so no second one is drawn on its back: the weapon's rank shows in the figure's glow.
  let gl=0;if(look.w)gl=Math.max(gl,glowAmt(look.w[2],look.w[1],t));if(look.ar)gl=Math.max(gl,glowAmt(look.ar[2],look.ar[1],t)*.7);if(fury)gl=Math.max(gl,14);
  const sheet=armorSheet(key,look),gt=look.spr||dead?0:glowTier(look.sp),ac=gt?armorGlowColor(look,t,gt):null;
  if(gt&&!LITE)drawArmorAura(key,an,fi,x,y,k,flip,gt,ac,t,m.bh);if(gt>=13&&!LITE)drawOrbit(bx,by,k,m.bh,t,gt,ac,false);
  if(mv&&maxP>=11&&!dead&&!calm&&!LITE)spr(key,an,fi-1,x-(flip?-1:1)*12*sc,y,k,flip,null,0,.28,sheet); // afterimage at +11
  spr(key,an,fi,x,y,k,flip,gt>=7?ac:gc,dead?0:Math.max(anim>0?Math.min(gl,6):gl,gt>=13?12:gt>=9?11:gt>=7?9:0),null,sheet);
  if(gt&&!LITE)drawArmorShine(key,an,fi,x,y,k,flip,gt,t,m.bh);if(gt>=13&&!LITE)drawOrbit(bx,by,k,m.bh,t,gt,ac,true);
  if(!dead&&!look.spr)drawForm(key,an,fi,x,y,bx,by,k,sc,m.bh,look,t,flip,true,anim);
  if(look.lu>0&&!dead){const u=look.lu,sil=silhouette(key,'#ffd75e'),w=silhouette(key,'#ffffff'); // level up: the body flares gold for a second
    if(sil&&w){ctx.save();ctx.globalCompositeOperation='lighter';ctx.shadowColor='#ffd75e';ctx.shadowBlur=22;const e=1-u;
      sprFrame(w,key,an,fi,x,y,k,flip,u*u*.3);for(let i=1;i<=3;i++)sprFrame(sil,key,an,fi,x,y,k,flip,u*.32/i,0,-e*i*5,1+(.06+e*.22)*i,1+(.05+e*.2)*i);ctx.restore();}
    if(!calm)for(let n=0;n<2;n++)SC.parts.push({x:x+(Math.random()-.5)*46*sc,y:y-Math.random()*m.bh*k,vx:(Math.random()-.5)*30,vy:-90-Math.random()*70,life:.6,c:Math.random()<.4?'#fff':'#ffd75e',s:2+Math.random()*2});}
  if(maxP>=13&&!dead&&!calm&&!LITE&&Math.random()<.35)SC.parts.push({x:x+(Math.random()-.5)*44*sc,y:y-Math.random()*m.bh*k,vx:0,vy:-20,life:.8,c:gc,s:2});
}
function drawMon(m,zi,t,flip,sc){
  const z=ZONES[zi],key=z.spr,sm=SPR[key],fl=SC.mode==='farm'&&!SC.ev?SC.fl:0,fc=fl===2?'#b46bff':fl===1?'#ff9a4a':null,sheet=z.tint?tintedSheet(key,z.tint,.55):null,k=(m.boss?3.6:m.elite?2.9:2)*sc*(1+fl*.08),lift=z.fly?(26+Math.sin(t*3+m.ph)*5)*sc*(m.boss?1.6:1):0,y=m.y-lift;
  ctx.fillStyle='rgba(0,0,0,.35)';ctx.beginPath();ctx.ellipse(m.x,m.y+1,(m.boss?36:18)*sc,(m.boss?8:4)*sc,0,0,7);ctx.fill();
  if(m.elite&&!m.boss){ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=.34+.14*Math.sin(t*5);const R=sm.bh*k*.75,gr=ctx.createRadialGradient(m.x,y-sm.bh*k*.5,4,m.x,y-sm.bh*k*.5,R);gr.addColorStop(0,'#ffd75e');gr.addColorStop(1,'transparent');ctx.fillStyle=gr;ctx.beginPath();ctx.arc(m.x,y-sm.bh*k*.5,R,0,7);ctx.fill();ctx.restore();label('אלוף',m.x,y-sm.bh*k-10,'#ffd75e',12);}
  if(m.boss){ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=.3+.12*Math.sin(t*4);const R=sm.bh*k*.8,gr=ctx.createRadialGradient(m.x,y-sm.bh*k*.5,4,m.x,y-sm.bh*k*.5,R);gr.addColorStop(0,'#ff5c7a');gr.addColorStop(1,'transparent');ctx.fillStyle=gr;ctx.beginPath();ctx.arc(m.x,y-sm.bh*k*.5,R,0,7);ctx.fill();ctx.restore();}
  let an='idle',fi=Math.floor(t*8+m.ph);
  if(m.die>0){an='die';fi=Math.floor((1-m.die/.45)*frames(key,'die'));}
  else if(m.hit>.45){an='hit';fi=Math.floor((1-m.hit)/.55*frames(key,'hit'));}
  else if(m.atkA>0){an='atk';fi=Math.floor((1-m.atkA/.5)*frames(key,'atk'));}
  else if(m.mv&&sm.a.run){an='run';fi=Math.floor(t*10+m.ph)%frames(key,'run');}
  else fi=fi%frames(key,'idle');
  spr(key,an,fi,m.x,y,k,flip,m.hit>.6?'#fff':m.boss?'#ff5c7a':fc,m.hit>.6?10:m.boss?8:fc?6:0,m.die>0?clamp(m.die/.2,0,1):null,sheet);
  if(m.stun>0){ctx.save();ctx.strokeStyle='#5fd4ff';ctx.lineWidth=2;ctx.globalAlpha=.85;ctx.beginPath();ctx.ellipse(m.x,y-sm.bh*k-6,16*sc,5*sc,0,(t*6)%6.28,(t*6)%6.28+4);ctx.stroke();ctx.restore();}
  if(m.die<=0&&!m.boss){const w=34,hpw=clamp(m.hp/m.max,0,1)*w,by=y-sm.bh*k-10;ctx.fillStyle='rgba(0,0,0,.6)';ctx.fillRect(m.x-w/2,by,w,4);ctx.fillStyle='#ff5c7a';ctx.fillRect(m.x-w/2,by,hpw,4);}
}
// While the world boss lives it stands behind every map, huge, and strikes the ground now and then. Each of my kills
// throws a spark up at it, so the fight is felt wherever I am.
let wbForce=false; // for checks only: show the boss without waiting for its hour
const wbOn=()=>{if(wbForce){if(!world)world={hp:.6,max:1,n:1,mine:0,key:''};return SC.zi>=0&&SC.mode==='farm';}const ww=worldWin();return !!(ww&&world&&world.key===ww.key&&!world.dead&&world.hp>0&&SC.zi>=0&&SC.mode==='farm'&&!SC.ev);};
const WB={t:5,zone:null,hurt:0};
// A dark copy of a sprite sheet: the shape and a hint of its detail, for something huge and far away.
function shadeSheet(key,col,amt){
  const im=IMG[key];if(!im||!im.complete||!im.naturalWidth)return null;const id='sh'+key+col+amt;if(TINT[id])return TINT[id];
  const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;const x=c.getContext('2d');
  x.drawImage(im,0,0);x.globalCompositeOperation='source-atop';x.globalAlpha=amt;x.fillStyle=col;x.fillRect(0,0,c.width,c.height);return TINT[id]=c;
}
// The world boss stands far behind the map, between the far hills and the near ones, taller than the screen's sky:
// part of the scenery, never beside the player.
function wbX(){return W*.5+Math.sin(SC.t*.25)*W*.05;}
function drawWorldBoss(dt){
  if(!wbOn()){WB.zone=null;WB.t=5;return;}const t=SC.t,g0=gy(),key=ZONES[BASEZ-1].spr,sm=SPR[key];if(!sm)return;const k=g0*1.45/sm.bh,x=wbX(),y=g0+sm.bh*k*.22+Math.sin(t*.8)*5,low=world.hp<world.max*.3;
  WB.hurt=Math.max(0,WB.hurt-dt*3);
  ctx.save();{const cy=g0*.42,R=g0*.75,gr=ctx.createRadialGradient(x,cy,10,x,cy,R);gr.addColorStop(0,low?'rgba(255,60,90,'+(.22+WB.hurt*.15)+')':'rgba(170,90,255,'+(.2+WB.hurt*.15)+')');gr.addColorStop(1,'transparent');ctx.fillStyle=gr;ctx.fillRect(0,0,W,g0);}ctx.restore();
  // A colossus rising behind the hills, drawn in clean shapes so it stays sharp at any size: horned head, burning eyes,
  // a heart of light in its chest, and one arm that lifts before it strikes the ground.
  const wind=WB.zone?1-clamp(WB.zone.t/1.5,0,1):0,u=Math.min(g0/430,W/470),br=Math.sin(t*.8),c0=low?'#4a0a18':'#24104e',c1=low?'#14030a':'#0a0518',rim=low?'rgba(255,110,130,':'rgba(196,150,255,',eye=low?'#ff5c7a':'#e0b3ff',hot=WB.hurt>.3;
  ctx.save();ctx.translate(x,g0+18*u+br*3*u);ctx.scale(u,u*(1+br*.008));ctx.lineJoin='round';
  const body=ctx.createLinearGradient(0,-300,0,40);body.addColorStop(0,hot?(low?'#8a1830':'#4a2a8a'):c0);body.addColorStop(1,c1);ctx.fillStyle=body;ctx.strokeStyle=rim+(.45+WB.hurt*.4)+')';ctx.lineWidth=2.5;
  const limb=(sx,sy,ang,len,w)=>{ctx.save();ctx.translate(sx,sy);ctx.rotate(ang);ctx.beginPath();ctx.moveTo(-w,0);ctx.quadraticCurveTo(-w*1.25,len*.5,-w*.8,len);ctx.lineTo(-w*1.5,len+w*1.1);ctx.lineTo(-w*.3,len+w*.6);ctx.lineTo(0,len+w*1.5);ctx.lineTo(w*.3,len+w*.6);ctx.lineTo(w*1.5,len+w*1.1);ctx.lineTo(w*.8,len);ctx.quadraticCurveTo(w*1.25,len*.5,w,0);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();};
  limb(-150,-196,.16+br*.02,190,30);limb(150,-196,-.16-br*.02-wind*2.5,190,30); // the right arm rises as the blow is readied
  ctx.beginPath();ctx.moveTo(-178,-200);ctx.lineTo(-206,-236);ctx.lineTo(-150,-222);ctx.lineTo(-128,-262);ctx.lineTo(-96,-226);ctx.quadraticCurveTo(0,-246,96,-226);ctx.lineTo(128,-262);ctx.lineTo(150,-222);ctx.lineTo(206,-236);ctx.lineTo(178,-200);
  ctx.quadraticCurveTo(150,-90,126,60);ctx.lineTo(-126,60);ctx.quadraticCurveTo(-150,-90,-178,-200);ctx.closePath();ctx.fill();ctx.stroke(); // shoulders with spikes, and the chest
  {const pr=.6+.4*Math.sin(t*2.2),g=ctx.createRadialGradient(0,-150,2,0,-150,58);g.addColorStop(0,'rgba(255,255,255,'+(.85*pr)+')');g.addColorStop(.35,rim+(.7*pr)+')');g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,-150,58,0,7);ctx.fill();
    ctx.strokeStyle=rim+(.5*pr)+')';ctx.lineWidth=2;for(let i=0;i<6;i++){const a=i*1.047+t*.2;ctx.beginPath();ctx.moveTo(Math.cos(a)*16,-150+Math.sin(a)*16);ctx.lineTo(Math.cos(a)*(40+i*4),-150+Math.sin(a)*(40+i*4));ctx.stroke();}}
  ctx.fillStyle=body;ctx.strokeStyle=rim+(.45+WB.hurt*.4)+')';ctx.lineWidth=2.5;
  ctx.beginPath();ctx.moveTo(-46,-262);ctx.quadraticCurveTo(-112,-300,-96,-372);ctx.quadraticCurveTo(-78,-318,-36,-300);ctx.closePath();ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(46,-262);ctx.quadraticCurveTo(112,-300,96,-372);ctx.quadraticCurveTo(78,-318,36,-300);ctx.closePath();ctx.fill();ctx.stroke(); // horns
  ctx.beginPath();ctx.moveTo(-50,-292);ctx.quadraticCurveTo(0,-330,50,-292);ctx.lineTo(44,-236);ctx.lineTo(18,-208);ctx.lineTo(0,-200);ctx.lineTo(-18,-208);ctx.lineTo(-44,-236);ctx.closePath();ctx.fill();ctx.stroke(); // the head
  ctx.shadowColor=eye;ctx.shadowBlur=18;ctx.fillStyle=eye;for(const sd of [-1,1]){ctx.beginPath();ctx.moveTo(sd*10,-262);ctx.lineTo(sd*34,-274);ctx.lineTo(sd*30,-256);ctx.closePath();ctx.fill();}
  ctx.strokeStyle=eye;ctx.lineWidth=2.5;ctx.globalAlpha=.6+.3*Math.sin(t*3);ctx.beginPath();ctx.moveTo(-16,-226);ctx.lineTo(-8,-220);ctx.lineTo(0,-226);ctx.lineTo(8,-220);ctx.lineTo(16,-226);ctx.stroke();
  ctx.restore();
  if(!calm&&Math.random()<.2)SC.parts.push({x:SC.cam+x+(Math.random()-.5)*220*u,y:g0-(120+Math.random()*200)*u,vx:(Math.random()-.5)*20,vy:-30,life:1.2,c:eye,s:2});
}
function worldBossStrike(dt,g0){ // in map coordinates: mark the ground, then strike it
  if(!wbOn())return;const h=SC.hero,low=world.hp<world.max*.3;
  if(!WB.zone){if((WB.t-=dt)<=0){WB.t=(low?5:8)+Math.random()*3;WB.zone={x:clamp(h.x+(Math.random()-.5)*260,160,mapW()-160),t:1.5,w:low?230:180};snd('growl');}return;}
  const z=WB.zone,u=1-clamp(z.t/1.5,0,1);ctx.save();ctx.globalAlpha=.2+.45*u;ctx.fillStyle='#c56bff';ctx.beginPath();ctx.ellipse(z.x,g0,z.w,22,0,0,7);ctx.fill();ctx.globalAlpha=.9;ctx.strokeStyle='#f0d0ff';ctx.lineWidth=2.5;ctx.beginPath();ctx.ellipse(z.x,g0,z.w*u,22*u,0,0,7);ctx.stroke();
  ctx.globalAlpha=.25+.4*u;ctx.fillStyle='#c56bff';ctx.fillRect(z.x-z.w*.5*u,0,z.w*u,g0);ctx.restore();label('בוס העולם מכה!',z.x,g0-150,'#f0d0ff',13);
  if((z.t-=dt)<=0){WB.zone=null;for(let q=-2;q<=2;q++)SC.fx.push({k:'pillar',x:z.x+q*z.w*.4,y:g0,life:.5,d:.5,c:'#c56bff'});SC.fx.push({k:'ring',x:z.x,y:g0-10,life:.5,c:'#c56bff',r:z.w});SC.fx.push({k:'screen',life:.3,d:.3,c:'#c56bff'});if(!calm)SC.shake=.5;snd('slam');
    if(h.dead<=0&&Math.abs(h.x-z.x)<z.w&&!h.up){const d=C.hp*.3*(h.shield>0?.3:1);h.hp-=d;addNum(h.x,g0-100,'-'+fmt(d),'#c56bff',true);}}
}
function drawBg(zi,t){
  const z=zi<0?TOWN:ZONES[zi],g0=gy();
  const g=ctx.createLinearGradient(0,0,0,g0);g.addColorStop(0,z.sky[0]);g.addColorStop(1,z.sky[1]);ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  ctx.save();ctx.globalAlpha=.5;ctx.fillStyle=z.amb;ctx.shadowColor=z.amb;ctx.shadowBlur=30;ctx.beginPath();ctx.arc(W*.78,H*.2,16,0,7);ctx.fill();ctx.restore();
  for(let layer=0;layer<2;layer++){ctx.fillStyle=z.sil;ctx.globalAlpha=layer?1:.55;ctx.beginPath();ctx.moveTo(0,g0);
    const off=SC.cam*(layer?.5:.2),amp=layer?H*.16:H*.3,base=g0-(layer?H*.05:H*.14);
    for(let x=0;x<=W+8;x+=8){const u=(x+off)*.02*(layer?1.3:.8)+zi*7;
      let y=Math.sin(u)*.5+Math.sin(u*2.3+1)*.3+Math.sin(u*5.1)*.2;
      if(z.kind==='brute'||z.kind==='town')y=Math.round(y*3)/3;
      ctx.lineTo(x,base-(.5+y*.5)*amp);}
    ctx.lineTo(W+8,g0);ctx.fill();if(!layer&&SC.mode==='farm'&&zi>=0){ctx.globalAlpha=1;drawWorldBoss(SC.dt||0);}}
  ctx.globalAlpha=1;
  const gg=ctx.createLinearGradient(0,g0,0,H);gg.addColorStop(0,z.sil);gg.addColorStop(1,'#050409');ctx.fillStyle=gg;ctx.fillRect(0,g0-1,W,H-g0+1);
  if(SC.fl>0&&zi>=0){ctx.fillStyle='rgba(0,0,0,'+(.16*SC.fl)+')';ctx.fillRect(0,0,W,H);}
  ctx.strokeStyle='rgba(255,255,255,.07)';ctx.lineWidth=1;for(let x=-(SC.cam%60);x<W;x+=60){ctx.beginPath();ctx.moveTo(x,g0+6);ctx.lineTo(x+22,g0+6);ctx.stroke();}
  ctx.fillStyle=z.amb;
  for(const a of amb){a.y-=a.v*.016*(zi===4?-1.5:1);if(a.y<0)a.y=1;if(a.y>1)a.y=0;ctx.globalAlpha=.25+.35*Math.abs(Math.sin(t*2+a.x*20));ctx.beginPath();ctx.arc(a.x*W+Math.sin(t+a.y*9)*6,a.y*g0,a.s,0,7);ctx.fill();}
  ctx.globalAlpha=1;
}
function label(txt,x,y,c,size){txt=tr(txt);ctx.font='700 '+(size||12)+'px Assistant,Arial';ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='rgba(0,0,0,.75)';ctx.strokeText(txt,x,y);ctx.fillStyle=c||'#fff';ctx.fillText(txt,x,y);}
function drawPortal(x,open,txt,t){
  const y=gy()-44,c=open?'#5fd4ff':'#6b6488';
  ctx.save();ctx.translate(x,y);ctx.globalCompositeOperation='lighter';ctx.strokeStyle=c;ctx.shadowColor=c;ctx.shadowBlur=open?16:0;
  for(let i=0;i<3;i++){ctx.globalAlpha=open?.8-i*.2:.5;ctx.lineWidth=3-i*.6;ctx.beginPath();ctx.ellipse(0,0,22-i*5,42-i*9,0,open?t*(1+i*.4):0,(open?t*(1+i*.4):0)+5);ctx.stroke();}
  ctx.restore();label(txt,x,y-52,open?'#bfeeff':'#a79fc9',11.5);
}
function drawLadder(x,p){
  const g0=gy(),up=p.kind==='up',c=p.ok?'#d6ae6e':'#6b6488',d=p.ok?'#7a5a2e':'#3d3856',top=up?Math.max(46,g0-210):g0-36,bot=up?g0:g0+7;
  ctx.save();
  if(up){ctx.fillStyle='rgba(12,8,24,.9)';ctx.fillRect(x-64,top-2,128,13);ctx.fillStyle=c;ctx.fillRect(x-64,top-5,128,4);ctx.fillStyle=d;for(let k=-2;k<=2;k++)ctx.fillRect(x+k*28-2,top+11,4,7);}
  else{ctx.fillStyle='rgba(4,2,10,.92)';ctx.beginPath();ctx.ellipse(x,g0+5,36,9,0,0,7);ctx.fill();ctx.strokeStyle=d;ctx.lineWidth=2;ctx.stroke();}
  ctx.lineCap='round';
  for(const [w,col] of [[6,d],[3,c]]){ctx.strokeStyle=col;ctx.lineWidth=w;ctx.beginPath();ctx.moveTo(x-13,top);ctx.lineTo(x-13,bot);ctx.moveTo(x+13,top);ctx.lineTo(x+13,bot);ctx.stroke();}
  ctx.strokeStyle=c;ctx.lineWidth=3;ctx.beginPath();for(let y=bot-9;y>top+4;y-=15){ctx.moveTo(x-13,y);ctx.lineTo(x+13,y);}ctx.stroke();
  ctx.restore();label((up?'\u25B2 ':'\u25BC ')+p.txt,x,up?g0-128:g0-48,p.ok?'#ffe2a8':'#a79fc9',11.5);
}
function addNum(x,y,txt,c,big){SC.nums.push({x:x+(Math.random()-.5)*14,y:y,txt:txt,c:c,s:big?22:15,life:.9});}
function burst(x,y,c,n){if(calm)n=Math.ceil(n/3);for(let i=0;i<n;i++){const a=Math.random()*6.28,v=40+Math.random()*130;SC.parts.push({x:x,y:y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-40,life:.35+Math.random()*.4,c:c,s:1.5+Math.random()*2});}}
function perfectFound(){snd('rare');announce('עתיק מושלם נפל לידיך! הפריט הנדיר ביותר במשחק',true);toast('עתיק מושלם בתיק שלך',6);SC.fx.push({k:'screen',life:1.2,d:1.2,c:'#ffd75e'});if(!calm)SC.shake=.5;}
// Reset arts: special attacks that join the ordinary chain as the account gathers resets. Every third finisher
// fires the next one that is open, so a veteran's fight looks nothing like a newcomer's.
const ARTS=[{r:1,n:'להב רפאים',d:'שלושה גלי להב שחוצים את השורה'},{r:3,n:'מטר כוכבים',d:'כוכבים נופלים על חמש מפלצות'},{r:6,n:'חותם המעגל',d:'חותם בוער מתחת לרגליים פוגע בכל מה שקרוב'},{r:10,n:'ברק הנצח',d:'ברק שקופץ בין שש מפלצות'},{r:15,n:'סופת אפר',d:'עמודי אש עולים מתחת לכל האויבים בטווח'},{r:25,n:'קריסת הזמן',d:'הזמן נעצר: כל המסך נפגע ונהמם'},{r:40,n:'משפט הנצח',d:'ברק, אש וכוכבים על כל מה שזז'}];
const artsOpen=()=>{const R=A?totalResets(A):0;return ARTS.filter(a=>R>=a.r);};
function castArt(m,col){
  const h=SC.hero,un=artsOpen();if(!un.length)return;const a=un[(h.artI=(h.artI||0)+1)%un.length],i=ARTS.indexOf(a),g=gy(),mult=1.5+i*.25,near=R=>alive().filter(q=>Math.abs(q.x-h.x)<R).sort((p,q)=>Math.abs(p.x-h.x)-Math.abs(q.x-h.x));
  addNum(h.x,hY()-150,a.n,'#ffd75e',true);snd('fury');h.skA=.35;let ts=[];
  if(i===0){ts=near(280).filter(q=>(q.x-h.x)*h.face>-30);for(let q=0;q<3;q++)SC.fx.push({k:'wave',x:h.x+h.face*(10+q*26),y:g,dir:h.face,dist:230+q*30,h:70+q*22,life:.34+q*.08,d:.34+q*.08,c:q===1?'#ffffff':col});SC.fx.push({k:'cres',x:h.x+h.face*40,y:g-40,R:64,rot:h.face<0?3.14:0,sp:1.6*h.face,life:.3,d:.3,c:col});}
  else if(i===1){ts=near(300).slice(0,5);for(const q of ts){SC.fx.push({k:'line',x1:q.x-90*h.face,y1:-20,x2:q.x,y2:q.y-24,life:.26,c:'#ffffff',w:3});SC.fx.push({k:'line',x1:q.x-90*h.face+6,y1:-20,x2:q.x,y2:q.y-24,life:.3,c:col,w:7});SC.fx.push({k:'star',x:q.x,y:q.y-26,r:36,rot:Math.random()*3,life:.4,d:.4,c:'#ffd75e'});}}
  else if(i===2){ts=near(175);SC.fx.push({k:'rune',x:h.x,y:g-2,r:160,life:.8,d:.8,c:col});SC.fx.push({k:'rune',x:h.x,y:g-2,r:96,life:.6,d:.6,c:'#ffd75e'});SC.fx.push({k:'ring',x:h.x,y:g-10,life:.5,c:col,r:170});}
  else if(i===3){ts=near(340).slice(0,6);let px=h.x+h.face*14,py=hY()-70;for(const q of ts){const pts=[[px,py]];for(let u=1;u<5;u++)pts.push([px+(q.x-px)*u/5+(Math.random()-.5)*22,py+(q.y-30-py)*u/5+(Math.random()-.5)*22]);pts.push([q.x,q.y-30]);SC.fx.push({k:'bolt',pts:pts,life:.3,c:col});px=q.x;py=q.y-30;}}
  else if(i===4){ts=near(260);for(const q of ts){SC.fx.push({k:'pillar',x:q.x,y:g,life:.45,d:.45,c:'#ff7a3d'});SC.fx.push({k:'rune',x:q.x,y:g-2,r:40,life:.5,d:.5,c:'#ff7a3d'});}SC.fx.push({k:'screen',life:.3,d:.3,c:'#ff7a3d'});}
  else if(i===5){ts=near(400);SC.fx.push({k:'screen',life:.55,d:.55,c:'#9fe8ff'});SC.fx.push({k:'rune',x:h.x,y:g-2,r:240,life:1,d:1,c:'#9fe8ff'});for(const q of ts){if(!q.boss)q.stun=Math.max(q.stun||0,1.2);SC.fx.push({k:'star',x:q.x,y:q.y-28,r:30,rot:0,life:.5,d:.5,c:'#9fe8ff'});}}
  else{ts=near(440);SC.fx.push({k:'screen',life:.5,d:.5,c:'#ffd75e'});for(const q of ts){const pts=[];let px=q.x+(Math.random()-.5)*40,py=0;while(py<q.y-30){pts.push([px,py]);px+=(Math.random()-.5)*28;py+=20;}pts.push([q.x,q.y-26]);SC.fx.push({k:'bolt',pts:pts,life:.34,c:'#ffd75e'});SC.fx.push({k:'pillar',x:q.x,y:g,life:.5,d:.5,c:col});SC.fx.push({k:'star',x:q.x,y:q.y-28,r:40,rot:Math.random()*3,life:.45,d:.45,c:'#ffffff'});}SC.fx.push({k:'rune',x:h.x,y:g-2,r:200,life:.9,d:.9,c:'#ffd75e'});}
  if(!calm)SC.shake=Math.max(SC.shake||0,.2+i*.04);
  for(const q of ts){SC.fx.push({k:'flash',x:q.x,y:q.y-26,r:40,life:.22,d:.22,c:col});if(q.die<=0)strike(q,mult,col,true);}
}
// The combo's burst is each class's own: the same great light, in its own shape and colour.
// The blade's is a storm of crossing steel, the witch's a strike of lightning, the hunter's a rain of spears, the warlord's falling chains of fire.
function comboFx(cls,x,g,big,ox,oy){
  const n=big?1:.6,C=cls==='storm'?['#6fd3ff','#b9a2ff']:cls==='hunter'?['#8be28b','#d8ff7a']:cls==='lord'?['#ff7a2e','#ffd75e']:['#ff8a4d','#ffe1a8'];
  SC.fx.push({k:'flash',x:x,y:g-40,r:150*n,life:.3,d:.3,c:'#fff'});for(let q=0;q<3;q++)SC.fx.push({k:'ring',x:x,y:g-10,life:.45+q*.18,c:q===1?'#fff':C[0],r:(70+q*55)*n});burst(x,g-40,C[0],big?46:24);burst(x,g-40,'#fff',big?18:8);
  if(cls==='storm'){for(let b=0;b<(big?5:3);b++){const pts=[];let px=x+(b-2)*34+(Math.random()-.5)*20,py=0;while(py<g-24){pts.push([px,py]);px+=(Math.random()-.5)*34;py+=20;}pts.push([x+(b-2)*16,g-12]);SC.fx.push({k:'bolt',pts:pts,life:.3+b*.05,c:b%2?C[1]:C[0]});}
    SC.fx.push({k:'rune',x:x,y:g-2,r:96*n,life:.8,d:.8,c:C[0]});SC.fx.push({k:'star',x:x,y:g-50,r:60*n,rot:0,life:.45,d:.45,c:C[1]});}
  else if(cls==='hunter'){ // a rain of spears: thick shafts of light fall in a fan, each one bursts where it lands, and pillars rise between them
    for(let q=0;q<(big?11:6);q++){const tx=x+(q-(big?5:2.5))*22,d=.34+q*.035,x0=tx-80+Math.random()*20,y0=g-320-Math.random()*60;SC.fx.push({k:'line',x1:x0,y1:y0,x2:tx,y2:g-8,life:d,c:q%2?C[1]:C[0],w:6});SC.fx.push({k:'line',x1:x0,y1:y0,x2:tx,y2:g-8,life:d*.7,c:'#fff',w:2});SC.fx.push({k:'flash',x:tx,y:g-10,r:30,life:d,d:d,c:C[0]});}
    for(let q=-3;q<=3;q++)SC.fx.push({k:'pillar',x:x+q*26,y:g,life:.4+Math.abs(q)*.06,d:.6,c:q%2?C[1]:C[0]});
    SC.fx.push({k:'rune',x:x,y:g-2,r:100*n,life:.8,d:.8,c:C[0]});SC.fx.push({k:'star',x:x,y:g-44,r:76*n,rot:.4,life:.55,d:.55,c:C[1]});SC.fx.push({k:'ring',x:x,y:g-10,life:.7,c:C[1],r:150*n});}
  else if(cls==='lord'){const hx=ox==null?x-120:ox,hy=oy==null?g-92:oy;for(let q=0;q<(big?4:2);q++){const a=q*Math.PI/2+.5;SC.fx.push({k:'chain',x1:hx,y1:hy+(q-1.5)*5,x2:x+Math.cos(a)*30,y2:g-34+Math.sin(a)*22,life:.42+q*.03,d:.5});}
    for(const q of [-1,1])SC.fx.push({k:'wave',x:x,y:g,dir:q,dist:130*n,h:70,life:.34,d:.34,c:C[0]});for(let q=-1;q<=1;q++)SC.fx.push({k:'pillar',x:x+q*30,y:g,life:.4+Math.abs(q)*.06,d:.6,c:q%2?C[1]:C[0]});}
  else{for(let q=0;q<(big?9:5);q++){const a=q*.7,r=30+q*7;SC.fx.push({k:'slash',x:x+Math.cos(a)*r*.6,y:g-44+Math.sin(a)*r*.45,rot:a+1.2,life:.2+q*.035,c:q%3===0?'#fff':q%3===1?C[0]:C[1],big:true});}
    for(const q of [-1,1]){SC.fx.push({k:'cres',x:x,y:g-40,R:44*n,rot:q>0?0:3.14,sp:q*2.4,life:.34,d:.34,c:C[0]});SC.fx.push({k:'wave',x:x,y:g,dir:q,dist:110*n,h:56,life:.3,d:.3,c:C[1]});}}
  if(big&&!calm)SC.fx.push({k:'screen',life:.22,d:.22,c:C[0]});
}
// Each class's two fighting skills have a look of their own. In a crowd only the blows that touch me are drawn in full.
function skillFx(cls,k,ax,g,vx,ge,face,c,full){
  if(cls==='lord'&&full){
    const F='#ff7a2e';
    if(k==='s0'){ // chains of fire: three of them lash out from his hand and wrap the enemy
      for(const q of [-1,1])SC.fx.push({k:'chain',x1:ax+face*14,y1:g-92+q*8,x2:vx+q*10,y2:ge-34+q*16,life:.3,d:.35});
      SC.fx.push({k:'ring',x:vx,y:ge-8,life:.35,c:F,r:54});SC.fx.push({k:'flash',x:vx,y:ge-30,r:50,life:.22,d:.22,c:'#ffd75e'});burst(vx,ge-30,F,14);}
    else{ // the beast's breath: it stamps, fire runs along the ground to the enemy and rises around him, and chains fall on those beside him
      SC.fx.push({k:'wave',x:ax+face*30,y:g,dir:face,dist:Math.min(280,Math.abs(vx-ax)+80),h:90,life:.34,d:.34,c:F});for(let q=0;q<2;q++)SC.fx.push({k:'ring',x:ax+face*26,y:g-4,life:.3+q*.1,c:q?'#ffd75e':F,r:40+q*26});
      for(const q of [-1,1])SC.fx.push({k:'chain',x1:ax+face*14,y1:g-92+q*7,x2:vx+q*36,y2:ge-24,life:.4,d:.5});
      SC.fx.push({k:'pillar',x:vx,y:ge,life:.4,d:.5,c:F});SC.fx.push({k:'ring',x:vx,y:ge-4,life:.6,c:'#ffd75e',r:120});burst(vx,ge-40,F,22);}
    return;}
  if(!full){if(k==='s1'){SC.fx.push({k:'pillar',x:vx,y:ge,life:.35,d:.35,c:c});}else SC.fx.push({k:'flash',x:vx,y:ge-30,r:30,life:.2,d:.2,c:c});return;}
  if(cls==='blade'){
    if(k==='s0'){ // blade storm: three crescents turning through the enemy, a wave running out of the swing
      for(let q=0;q<3;q++)SC.fx.push({k:'cres',x:vx-face*(14-q*12),y:ge-34-q*6,R:26+q*8,rot:(face<0?3.14:0)+(q-1)*.7,sp:(q%2?-2.4:2.4),life:.26+q*.07,d:.26+q*.07,c:q===1?'#fff':c});
      SC.fx.push({k:'wave',x:ax+face*14,y:g,dir:face,dist:Math.min(220,Math.abs(vx-ax)+60),h:74,life:.3,d:.3,c:c});SC.fx.push({k:'slash',x:vx,y:ge-30,rot:face<0?3.6:-.5,life:.24,c:'#fff',big:true});burst(vx,ge-30,c,10);}
    else{ // crushing blow: steel falls from above, the ground answers
      SC.fx.push({k:'met',x0:vx-face*70,y0:ge-230,x:vx,y:ge-8,life:.2,d:.2,c:c});SC.fx.push({k:'pillar',x:vx,y:ge,life:.5,d:.5,c:c});SC.fx.push({k:'ring',x:vx,y:ge-4,life:.5,c:'#fff',r:110});SC.fx.push({k:'ring',x:vx,y:ge-4,life:.7,c:c,r:70});
      SC.fx.push({k:'star',x:vx,y:ge-40,r:60,rot:.4,life:.42,d:.42,c:'#fff'});for(let q=0;q<10;q++)SC.parts.push({x:vx+(Math.random()-.5)*60,y:ge-4,vx:(Math.random()-.5)*220,vy:-120-Math.random()*140,life:.6,c:q%3?c:'#d8c8a8',s:3});}}
  else if(cls==='storm'){
    if(k==='s0'){ // chain lightning: three forks from the sky, a circle of runes under the caster
      for(let q=0;q<3;q++){const pts=[];let px=vx+(q-1)*46+(Math.random()-.5)*20,py=0;while(py<ge-30){pts.push([px,py]);px+=(Math.random()-.5)*30+(vx-px)*.12;py+=16;}pts.push([vx+(q-1)*8,ge-24]);SC.fx.push({k:'bolt',pts:pts,life:.24+q*.06,c:q===1?'#fff':c});}
      SC.fx.push({k:'rune',x:ax,y:g-2,r:58,life:.6,d:.6,c:c});SC.fx.push({k:'flash',x:vx,y:ge-30,r:54,life:.24,d:.24,c:c});burst(vx,ge-30,'#fff',10);}
    else{ // the breaking storm: a column of light, a seal under the enemy, the sky flashes
      for(let q=-1;q<=1;q++)SC.fx.push({k:'pillar',x:vx+q*20,y:ge,life:.5+Math.abs(q)*.1,d:.5+Math.abs(q)*.1,c:q?c:'#fff'});SC.fx.push({k:'rune',x:vx,y:ge-2,r:84,life:.8,d:.8,c:c});
      SC.fx.push({k:'ring',x:vx,y:ge-4,life:.55,c:c,r:120});SC.fx.push({k:'star',x:vx,y:ge-44,r:58,rot:0,life:.4,d:.4,c:'#fff'});SC.fx.push({k:'screen',life:.16,d:.16,c:c});}}
  else{
    if(k==='s0'){ // a rain of arrows: a dozen shafts falling in a fan
      for(let q=0;q<11;q++){const ox=(q-5)*9+(Math.random()-.5)*8;SC.fx.push({k:'line',x1:vx+ox-face*90,y1:ge-210-Math.random()*40,x2:vx+ox,y2:ge-10-Math.random()*26,life:.14+q*.022,c:q%3?c:'#fff',w:2});}
      SC.fx.push({k:'ring',x:vx,y:ge-4,life:.4,c:c,r:70});burst(vx,ge-24,c,12);}
    else{ // the piercing shot: one bright shaft through the enemy and far beyond
      const ex=vx+face*170;SC.fx.push({k:'line',x1:ax+face*18,y1:g-58,x2:ex,y2:ge-40,life:.3,c:c,w:7});SC.fx.push({k:'line',x1:ax+face*18,y1:g-58,x2:ex,y2:ge-40,life:.2,c:'#fff',w:3});
      for(let q=0;q<3;q++)SC.fx.push({k:'ring',x:ax+(vx-ax)*(q+1)/3,y:g-50+(ge-g)*(q+1)/3,life:.3+q*.08,c:q===2?'#fff':c,r:34+q*14});SC.fx.push({k:'star',x:vx,y:ge-40,r:54,rot:.78,life:.38,d:.38,c:'#fff'});
      for(let q=0;q<8;q++)SC.parts.push({x:vx,y:ge-40,vx:face*(160+Math.random()*220),vy:(Math.random()-.5)*120,life:.45,c:q%2?c:'#fff',s:3});}}
}
function attackFx(cls,hx,hy,face,targets,combo,c){
  for(const tg of targets){
    if(cls==='lord'){ // the warlord does not cut: a chain of fire lashes out from his hand and burns where it lands; on the great blows his beast stamps
      SC.fx.push({k:'chain',x1:hx+face*14,y1:hy-92,x2:tg.x,y2:tg.y-30,life:combo?.36:.24,d:combo?.36:.24});burst(tg.x,tg.y-30,'#ff7a2e',combo?14:6);
      if(combo){for(const q of [-1,1])SC.fx.push({k:'chain',x1:hx+face*14,y1:hy-92+q*7,x2:tg.x+q*14,y2:tg.y-30+q*14,life:.4,d:.4});SC.fx.push({k:'pillar',x:tg.x,y:tg.y,life:.3,d:.4,c:'#ff7a2e'});
        SC.fx.push({k:'wave',x:hx+face*30,y:tg.y,dir:face,dist:Math.abs(tg.x-hx)+50,h:46,life:.3,d:.3,c:'#ff7a2e'});SC.fx.push({k:'ring',x:hx+face*26,y:hy-4,life:.3,c:'#ffb23e',r:44});}}
    else if(cls==='blade')SC.fx.push({k:'slash',x:tg.x-6*face,y:tg.y-28,rot:Math.random()*1.2-.6+(face<0?3.14:0),life:.22,c:c,big:combo});
    else if(cls==='storm'){if(combo){const pts=[];let px=tg.x+(Math.random()-.5)*30,py=0;while(py<tg.y-20){pts.push([px,py]);px+=(Math.random()-.5)*26;py+=18;}pts.push([tg.x,tg.y-24]);SC.fx.push({k:'bolt',pts:pts,life:.28,c:c});}
      else SC.fx.push({k:'line',x1:hx+16*face,y1:hy-96,x2:tg.x,y2:tg.y-26,life:.16,c:c,w:4});}
    else{if(combo){for(let i=0;i<4;i++)SC.fx.push({k:'line',x1:tg.x-60+i*14+Math.random()*10,y1:-10,x2:tg.x-10+i*6,y2:tg.y-18,life:.2+i*.04,c:c,w:2});}
      else SC.fx.push({k:'line',x1:hx+18*face,y1:hy-58,x2:tg.x,y2:tg.y-26,life:.14,c:c,w:2});}
    burst(tg.x,tg.y-26,c,combo?12:5);
    SC.fx.push({k:'flash',x:tg.x,y:tg.y-26,r:combo?44:22,life:.2,d:.2,c:c});if(combo&&!calm)SC.fx.push({k:'star',x:tg.x,y:tg.y-28,r:26,rot:Math.random()*3,life:.28,d:.28,c:c});
  }
  if(combo&&!SC.duel){SC.fx.push({k:'ring',x:targets[0]?targets[0].x:hx,y:hy-20,life:.4,c:c});if(!calm)SC.shake=.25;}
}
function drawFx(dt){
  ctx.save();ctx.globalCompositeOperation='lighter';
  SC.fx=SC.fx.filter(f=>(f.life-=dt)>0);{const cap=SC.duel&&SC.duel.br&&SC.duel.D.f.length>3?50:150;if(SC.fx.length>cap)SC.fx.splice(0,SC.fx.length-cap);}
  for(const f of SC.fx){ctx.strokeStyle=f.c;ctx.fillStyle=f.c;ctx.shadowColor=f.c;ctx.shadowBlur=12;
    if(f.k==='slash'){const a=clamp(f.life/.22,0,1);ctx.globalAlpha=a;ctx.lineWidth=(f.big?7:4)*a+1;ctx.beginPath();ctx.arc(f.x,f.y,f.big?42:26,f.rot-1.1,f.rot+1.1);ctx.stroke();ctx.strokeStyle='#fff';ctx.lineWidth=(f.big?2.5:1.5)*a+.5;ctx.beginPath();ctx.arc(f.x,f.y,(f.big?42:26)-1,f.rot-.9,f.rot+.9);ctx.stroke();}
    else if(f.k==='cres'){const a=clamp(f.life/f.d,0,1),R=f.R*(1.25-a*.25);ctx.globalAlpha=a;ctx.save();ctx.translate(f.x,f.y);ctx.rotate(f.rot+(1-a)*f.sp);ctx.beginPath();ctx.arc(0,0,R,-1.2,1.2);ctx.arc(-R*.35,0,R*.82,.95,-.95,true);ctx.closePath();ctx.fill();ctx.restore();}
    else if(f.k==='met'){const u=1-clamp(f.life/f.d,0,1),x=f.x0+(f.x-f.x0)*u,y=f.y0+(f.y-f.y0)*u;ctx.globalAlpha=1;ctx.lineWidth=7;ctx.lineCap='round';const gr=ctx.createLinearGradient(x-(f.x-f.x0)*.25,y-(f.y-f.y0)*.25,x,y);gr.addColorStop(0,'transparent');gr.addColorStop(1,f.c);ctx.strokeStyle=gr;ctx.beginPath();ctx.moveTo(x-(f.x-f.x0)*.25,y-(f.y-f.y0)*.25);ctx.lineTo(x,y);ctx.stroke();ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x,y,5,0,7);ctx.fill();
      if(f.life<dt*1.5&&!f.hit){f.hit=1;burst(f.x,f.y,f.c,16);SC.fx.push({k:'ring',x:f.x,y:f.y+6,life:.35,c:f.c,r:60});}}
    else if(f.k==='pillar'){const a=clamp(f.life/f.d,0,1);ctx.globalAlpha=a*.85;const w=(10+26*(1-a));const gr=ctx.createLinearGradient(f.x-w,0,f.x+w,0);gr.addColorStop(0,'transparent');gr.addColorStop(.5,f.c);gr.addColorStop(1,'transparent');ctx.fillStyle=gr;ctx.fillRect(f.x-w,0,w*2,f.y);ctx.fillStyle='#fff';ctx.globalAlpha=a*.6;ctx.fillRect(f.x-2,0,4,f.y);}
    else if(f.k==='flash'){const a=clamp(f.life/f.d,0,1),R=f.r*(1.3-a*.5);ctx.shadowBlur=0;ctx.globalAlpha=a;const g=ctx.createRadialGradient(f.x,f.y,0,f.x,f.y,R);g.addColorStop(0,'#fff');g.addColorStop(.3,f.c);g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.fillRect(f.x-R,f.y-R,R*2,R*2);}
    else if(f.k==='star'){const a=clamp(f.life/f.d,0,1),R=f.r*(.5+(1-a)*.8);ctx.globalAlpha=a;ctx.fillStyle='#fff';ctx.save();ctx.translate(f.x,f.y);ctx.rotate(f.rot+(1-a)*1.2);ctx.beginPath();for(let i=0;i<8;i++){const q=i*Math.PI/4,r=i%2?R*.16:R;ctx.lineTo(Math.cos(q)*r,Math.sin(q)*r);}ctx.closePath();ctx.fill();ctx.restore();}
    else if(f.k==='rune'){const a=clamp(f.life/f.d,0,1),R=f.r*(1-a*a*.35),sp=(1-a)*2.2;ctx.globalAlpha=Math.min(1,a*2.2)*.9;ctx.save();ctx.translate(f.x,f.y);ctx.scale(1,.34);ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(0,0,R,0,7);ctx.stroke();ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,0,R*.72,0,7);ctx.stroke();
      ctx.rotate(sp);ctx.beginPath();for(let i=0;i<6;i++){const q=i*Math.PI/3;ctx.moveTo(Math.cos(q)*R*.72,Math.sin(q)*R*.72);ctx.lineTo(Math.cos(q+2.094)*R*.72,Math.sin(q+2.094)*R*.72);}ctx.stroke();
      ctx.rotate(-sp*2);ctx.fillStyle='#fff';for(let i=0;i<8;i++){const q=i*Math.PI/4;ctx.fillRect(Math.cos(q)*R*.86-2,Math.sin(q)*R*.86-2,4,4);}ctx.restore();
      ctx.shadowBlur=0;ctx.globalAlpha=a*.22;const g=ctx.createLinearGradient(0,f.y-f.r*.9,0,f.y);g.addColorStop(0,'transparent');g.addColorStop(1,f.c);ctx.fillStyle=g;ctx.fillRect(f.x-R*.72,f.y-f.r*.9,R*1.44,f.r*.9);}
    else if(f.k==='wave'){const a=clamp(f.life/f.d,0,1),x=f.x+f.dir*(1-a)*f.dist,H=f.h*(.6+a*.4);ctx.globalAlpha=a;const R=H*.5;ctx.save();ctx.translate(x,f.y-R);ctx.scale(f.dir,1);ctx.beginPath();ctx.arc(0,0,R,-1.25,1.25);ctx.arc(-R*.4,0,R*.85,1,-1,true);ctx.closePath();ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,0,R-1,-1,1);ctx.stroke();ctx.restore();
      if(!calm&&Math.random()<.6)SC.parts.push({x:x,y:f.y-Math.random()*H,vx:-f.dir*60,vy:-30,life:.4,c:f.c,s:2});}
    else if(f.k==='screen'){ctx.shadowBlur=0;ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=clamp(f.life/f.d,0,1)*.28;ctx.fillStyle=f.c;ctx.fillRect(0,0,ctx.canvas.width,ctx.canvas.height);ctx.restore();}
    else if(f.k==='chain'){ // a chain of fire, drawn cheaply: one sagging curve stroked three times (a glow, dark links, gold links between them), never link by link
      const a=clamp(f.life/f.d,0,1),dx=f.x2-f.x1,dy=f.y2-f.y1,len=Math.hypot(dx,dy)||1,sag=Math.min(26,len*.12)*(.4+.6*a),grow=clamp((1-a)*3,.05,1),ex=f.x1+dx*grow,ey=f.y1+dy*grow,mx=f.x1+dx*grow*.5,my=f.y1+dy*grow*.5+sag*2*grow;
      const path=()=>{ctx.beginPath();ctx.moveTo(f.x1,f.y1);ctx.quadraticCurveTo(mx,my,ex,ey);};ctx.shadowBlur=0;ctx.lineCap='butt';
      if(!LITE){ctx.globalCompositeOperation='lighter';ctx.globalAlpha=a*.45;ctx.strokeStyle='#ff7a2e';ctx.lineWidth=9;path();ctx.stroke();ctx.globalCompositeOperation='source-over';}
      ctx.globalAlpha=a;ctx.lineWidth=4.5;ctx.setLineDash([7,6]);ctx.strokeStyle='#3a2418';path();ctx.stroke();ctx.lineDashOffset=6.5;ctx.strokeStyle='#ffd75e';ctx.lineWidth=2.6;path();ctx.stroke();ctx.setLineDash([]);ctx.lineDashOffset=0;
      ctx.globalAlpha=a*.9;ctx.fillStyle='#ffb23e';ctx.beginPath();ctx.arc(ex,ey,5,0,7);ctx.fill();}
    else if(f.k==='line'){ctx.globalAlpha=clamp(f.life/.15,0,1);ctx.lineCap='round';ctx.lineWidth=f.w+1;ctx.beginPath();ctx.moveTo(f.x1,f.y1);ctx.lineTo(f.x2,f.y2);ctx.stroke();ctx.strokeStyle='#fff';ctx.lineWidth=Math.max(1,f.w*.4);ctx.beginPath();ctx.moveTo(f.x1+(f.x2-f.x1)*.45,f.y1+(f.y2-f.y1)*.45);ctx.lineTo(f.x2,f.y2);ctx.stroke();}
    else if(f.k==='bolt'){ctx.globalAlpha=clamp(f.life/.2,0,1);for(const [w,col] of [[5,f.c],[1.6,'#fff']]){ctx.strokeStyle=col;ctx.lineWidth=w;ctx.beginPath();f.pts.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.stroke();}ctx.strokeStyle=f.c;ctx.lineWidth=1.5;ctx.beginPath();f.pts.forEach((p,i)=>{if(i&&i%3===0){ctx.moveTo(p[0],p[1]);ctx.lineTo(p[0]+((i*37)%40-20),p[1]+22);}});ctx.stroke();}
    else if(f.k==='ring'){const a=Math.min(1,f.life/.4),R=f.r||90;ctx.globalAlpha=a;ctx.lineWidth=4*a+1;ctx.beginPath();ctx.ellipse(f.x,f.y,(1-a)*R+10,((1-a)*R+10)*.35,0,0,7);ctx.stroke();}
    else if(f.k==='beam'){const a=clamp(f.life/1.2,0,1);ctx.globalAlpha=a*.8;const g=ctx.createLinearGradient(0,0,0,f.y);g.addColorStop(0,'transparent');g.addColorStop(1,f.c);ctx.fillStyle=g;ctx.fillRect(f.x-7,0,14,f.y);}
    else if(f.k==='lvl'){const a=f.life/.9;ctx.globalAlpha=a;ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(f.x,f.y-(1-a)*80,30,9,0,0,7);ctx.stroke();}
  }
  ctx.shadowBlur=0;
  SC.parts=SC.parts.filter(p=>(p.life-=dt)>0);{const cap=SC.duel&&SC.duel.br&&SC.duel.D.f.length>3?110:260;if(SC.parts.length>cap)SC.parts.splice(0,SC.parts.length-cap);}
  for(const p of SC.parts){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=(p.g==null?160:p.g)*dt;ctx.globalAlpha=clamp(p.life*2,0,1);ctx.fillStyle=p.c;
    if(!p.k)ctx.fillRect(p.x,p.y,p.s,p.s);
    else if(p.k==='d'){ctx.beginPath();ctx.moveTo(p.x,p.y-p.s*2.2);ctx.quadraticCurveTo(p.x+p.s*.9,p.y,p.x,p.y+p.s*.6);ctx.quadraticCurveTo(p.x-p.s*.9,p.y,p.x,p.y-p.s*2.2);ctx.fill();} // a drop
    else if(p.k==='f'){p.x+=Math.sin(SC.t*4+p.s*7+p.y*.05)*22*dt;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(SC.t*2.5+p.y*.04);ctx.beginPath();ctx.ellipse(0,0,p.s*2.2,p.s*.75,0,0,7);ctx.fill();ctx.fillStyle='rgba(255,255,255,.7)';ctx.fillRect(-p.s*2,-.4,p.s*4,.8);ctx.restore();} // a feather
    else if(p.k==='s'){ctx.save();ctx.translate(p.x,p.y);ctx.rotate(SC.t*3+p.x*.1);ctx.fillRect(-p.s,-p.s*.25,p.s*2,p.s*.5);ctx.fillRect(-p.s*.25,-p.s,p.s*.5,p.s*2);ctx.restore();}} // a spark, a flake
  // loot orbs fly to the hero
  const h=SC.hero;SC.drops=SC.drops.filter(d=>d.life>0);
  for(const d of SC.drops){d.life-=dt;d.age+=dt;if(d.age<.45+(d.lie||0)){if(d.age>.45){d.vx=0;}d.x+=d.vx*dt;d.y+=d.vy*dt;d.vy+=500*dt;if(d.y>gy()-6){d.y=gy()-6;d.vy=0;d.vx=0;}}
    else{const dx=h.x-d.x,dy=gy()-45-d.y,dist=Math.hypot(dx,dy);if(dist<16){d.life=0;continue;}const v=Math.min(dist,520*dt*(1+d.age));d.x+=dx/dist*v;d.y+=dy/dist*v;}
    ctx.globalAlpha=d.left?clamp(d.life,0,.55):1;ctx.fillStyle=d.c;ctx.shadowColor=d.c;ctx.shadowBlur=10;ctx.beginPath();ctx.arc(d.x,d.y,d.s,0,7);ctx.fill();
    if(d.txt&&d.age>.3&&d.age<.45+(d.lie||0)+.15){ctx.shadowBlur=0;ctx.font='700 10.5px system-ui';ctx.textAlign='center';const tw=ctx.measureText(tr(d.txt)).width+8;ctx.fillStyle='rgba(8,6,20,.72)';ctx.fillRect(d.x-tw/2,d.y-22-(d.row||0)*13,tw,12.5);ctx.fillStyle=d.left?'#8d87a8':d.c;ctx.fillText(tr(d.txt),d.x,d.y-12.5-(d.row||0)*13);}}
  ctx.restore();
  SC.nums=SC.nums.filter(n=>(n.life-=dt)>0);ctx.textAlign='center';
  for(const n of SC.nums){n.y-=38*dt;ctx.globalAlpha=clamp(n.life*2.2,0,1);ctx.font='800 '+n.s+'px Assistant,Arial';ctx.lineWidth=3;ctx.strokeStyle='rgba(0,0,0,.75)';{const tx=tr(n.txt);ctx.strokeText(tx,n.x,n.y);ctx.fillStyle=n.c;ctx.fillText(tx,n.x,n.y);}}
  ctx.globalAlpha=1;
}
function hpBar(x,y,w,frac,c,lbl){ctx.fillStyle='rgba(0,0,0,.6)';rr(x,y,w,7,3);ctx.fill();ctx.fillStyle=c;rr(x,y,Math.max(3,w*clamp(frac,0,1)),7,3);ctx.fill();if(lbl)label(lbl,x+w/2,y-5);}

/* ---------- sound ---------- */
let AC=null,MG=null;const sndLast={};
function initAudio(){try{if(!AC){const X=window.AudioContext||window.webkitAudioContext;if(!X)return;AC=new X();MG=AC.createGain();MG.gain.value=.5;MG.connect(AC.destination);}if(AC.state==='suspended')AC.resume();loadSfx();}catch(e){}}
document.addEventListener('pointerdown',initAudio);document.addEventListener('keydown',initAudio);
// Recorded effects; anything not loaded falls back to the synthesised version below.
const SFX={pull:['whoosh'],ult:['ult'],hit:['hit0','hit1','hit2'],crit:['crit0','crit1'],skill:['skill0','skill1'],hurt:['hurt0','hurt1'],kill:['kill'],coin:['coin'],rare:['rare'],boss:['roar0','roar1'],bossdie:['bossdie'],growl:['growl0'],slam:['slam']};
const SFXVOL={bossdie:.8,growl:.6,pull:.6,ult:.8,hit:.5,crit:.75,skill:.6,hurt:.35,kill:.4,coin:.3,rare:.6,boss:.7,slam:.8},sfxBuf={};let sfxAsked=false;
function loadSfx(){
  if(sfxAsked||!AC)return;sfxAsked=true;
  for(const k in SFX)for(const f of SFX[k])fetch('sfx/'+f+'.mp3').then(r=>r.ok?r.arrayBuffer():null).then(b=>b&&AC.decodeAudioData(b)).then(b=>{if(b)sfxBuf[f]=b;}).catch(()=>{});
}
function playSfx(n){
  const list=SFX[n];if(!list)return false;const b=sfxBuf[list[Math.floor(Math.random()*list.length)]];if(!b)return false;
  const src=AC.createBufferSource(),g=AC.createGain();src.buffer=b;src.playbackRate.value=.92+Math.random()*.16;g.gain.value=SFXVOL[n]||.5;src.connect(g);g.connect(MG);src.start();return true;
}
function tone(f,d,type,v,f2,at){const t=AC.currentTime+(at||0),o=AC.createOscillator(),g=AC.createGain();o.type=type;o.frequency.setValueAtTime(f,t);if(f2)o.frequency.exponentialRampToValueAtTime(f2,t+d);
  g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.001,t+d);o.connect(g);g.connect(MG);o.start(t);o.stop(t+d+.02);}
let noiseBuf=null;
function noise(d,v,hp){if(!noiseBuf){noiseBuf=AC.createBuffer(1,AC.sampleRate*.4,AC.sampleRate);const a=noiseBuf.getChannelData(0);for(let i=0;i<a.length;i++)a[i]=Math.random()*2-1;}
  const t=AC.currentTime,n=AC.createBufferSource(),g=AC.createGain(),f=AC.createBiquadFilter();n.buffer=noiseBuf;f.type='highpass';f.frequency.value=hp||800;
  g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.001,t+d);n.connect(f);f.connect(g);g.connect(MG);n.start(t);n.stop(t+d);}
const SNDGAP={hit:.06,crit:.08,kill:.09,coin:.12,hurt:.3,click:.04};
function snd(n){
  if(!AC||AC.state!=='running'||!A||prefs.mute||demo)return;const now=AC.currentTime;if(now-(sndLast[n]||-9)<(SNDGAP[n]||.05))return;sndLast[n]=now;
  try{
  if(playSfx(n)){if(n==='skill')noise(.2,.08,600);return;}
  if(n==='hit'){noise(.05,.12,1500);tone(190,.07,'square',.05,90);}
  else if(n==='crit'){noise(.09,.2,900);tone(560,.12,'sawtooth',.07,220);}
  else if(n==='skill'){noise(.25,.16,500);tone(180,.3,'sawtooth',.08,900);}
  else if(n==='pull'){tone(700,.3,'sine',.1,160);}
  else if(n==='fury'){tone(220,.35,'sawtooth',.07,660);tone(330,.35,'square',.04,990);}
  else if(n==='kill'){tone(320,.13,'triangle',.1,70);}
  else if(n==='coin'){tone(1250,.05,'sine',.07);tone(1680,.09,'sine',.07,null,.05);}
  else if(n==='rare'){[660,880,1320,1760].forEach((f,i)=>tone(f,.16,'triangle',.1,null,i*.08));}
  else if(n==='lvl'){[523,659,784,1046].forEach((f,i)=>tone(f,.14,'square',.06,null,i*.07));}
  else if(n==='boss'){tone(75,.9,'sawtooth',.16,45);tone(110,.9,'square',.06,60);}
  else if(n==='slam'){noise(.3,.3,120);tone(90,.3,'sine',.25,40);}
  else if(n==='hurt'){tone(150,.12,'square',.07,70);}
  else if(n==='ok'){tone(880,.1,'triangle',.1);tone(1320,.2,'triangle',.1,null,.09);}
  else if(n==='fail'){tone(210,.3,'sawtooth',.09,100);}
  else if(n==='portal'){tone(300,.35,'sine',.1,900);}
  else if(n==='click'){tone(640,.03,'square',.03);}
  }catch(e){}
}

/* ---------- world ---------- */
// Some maps have a second level: a deck in the middle of the map with its own monsters and a ladder at each end.
// Ranged classes can shoot up and down; a blade has to climb. Monsters stay on their own level.
const DECK={x0:520,x1:1080,h:92},hasDeck=zi=>zi>=0&&!SC.ev&&(zi<24?zi%3===1:zi%2===0),deckH=()=>DECK.h*clamp(H/300,.8,1.45),hY=()=>gy()-deckH()*(SC.hero.lift||0);
function newMon(home,zi){const z=zs(zi,SC.fl),hp=z.hp*(SC.ev?KEEP_HP:1);return {home:home,x:home,y:gy(),hp:hp,max:hp,hit:0,die:0,ph:Math.random()*6,resp:0,stun:0,atkT:1,pull:null};}
function enterZone(z,side,f,ev){
  killBudget=3;killRateT=0;
  const h=SC.hero;SC.ev=!!ev;SC.zi=z;SC.fl=z<0?0:clamp(f|0,0,FLOORS-1);SC.mons=[];SC.boss=null;SC.drops=[];SC.fx=[];SC.nums=[];SC.parts=[];h.tgt=null;h.goal=null;h.tx=null;h.manual=0;
  h.x=side==='R'?mapW()-110:110;h.face=side==='R'?-1:1;
  if(h.climb&&h.climb.ph==='wait'){h.climb.ph='in';h.climb.t=.45;h.x=side==='R'?mapW()-50:50;}else h.climb=null;
  if(z>=0){const n=ev?22:8,gap=ev?52:140;for(let i=0;i<n;i++)SC.mons.push(newMon((ev?240:300)+i*gap+Math.random()*(ev?30:50),z));}
  {const was=SC.sh;SC.sh=!!(ONLINE&&CFG.api&&!demo&&z>=0&&ZONES[z].shared);SC.shAcc=0;if(SC.sh){SC.mons.forEach((m,i)=>{m.sid=i;});netSend({t:'sj',z:z,f:SC.fl,ev:ev?1:0});}else if(was)netSend({t:'sl'});}
  h.up=0;h.lift=0;if(hasDeck(z))for(const i of [2,3,4]){const m=SC.mons[i];m.up=1;m.home=clamp(m.home,DECK.x0+50,DECK.x1-50);m.x=m.home;}
  if(z<0&&ONLINE&&!demo)loadMarket();
  if(z<0||z!==S.zone){auras=[];partyN=0;}statsDirty=true;panelDirty=true;syncBoss();peers=[];beatT=99;
}
function spawnBoss(){
  const zi=SC.zi,z=ZONES[zi];if(SC.boss||zi<0)return;
  const b=newMon(MW-280,zi);b.boss=true;if(SC.sh)b.sid=-1;b.hp=b.max=zs(zi,SC.fl).hp*30;b.slamT=4;b.wind=0;b.m2T=8;b.mets=[];b.metN=0;b.metT=0;b.chg=null;b.dash=null;b.weak=0;b.clean=true;SC.boss=b;SC.mons.push(b);snd('boss');toast('הבוס של '+z.n+' הופיע בקצה המפה');
}
// A champion: one monster of the pack that is far stronger and carries a sure rare drop. The server decides when.
function syncElite(){
  if(!A||SC.mode!=='farm'||SC.ev)return;const e=A.elite,want=!!(e&&e.z===SC.zi&&(e.f|0)===SC.fl&&SC.zi>=0),cur=SC.mons.find(m=>m.elite);
  if(want&&!cur&&!pend.elite){const h=SC.hero,m=newMon(clamp(h.x+(h.x<mapW()/2?1:-1)*(150+Math.random()*60),160,mapW()-160),SC.zi);m.elite=true;if(SC.sh)m.sid=-2;for(let q=-1;q<=1;q++)SC.fx.push({k:'pillar',x:m.x+q*26,y:m.y,life:.9,d:.9,c:'#ffd75e'});SC.fx.push({k:'ring',x:m.x,y:m.y-20,life:.8,c:'#ffd75e',r:120});m.hp=m.max=zs(SC.zi,SC.fl).hp*ELITE_HP;m.ag=true;SC.mons.push(m);snd('growl');announce('מפלצת אלופה הופיעה במפה הזו, זוהרת בזהב. הבס אותה לשלל מיוחד',true);}
  else if(!want&&cur&&cur.die<=0){SC.mons=SC.mons.filter(m=>m!==cur);if(SC.hero.tgt===cur)SC.hero.tgt=null;}
}
function dropOrbs(m,rep){
  const add=(c,s)=>SC.drops.push({x:m.x,y:m.y-24,vx:(Math.random()-.5)*160,vy:-160-Math.random()*90,c:c,s:s,age:0,life:4});
  snd(rep.notable?'rare':'kill');if(!rep.notable&&(rep.items||rep.gems))snd('coin');
  add('#f2c14e',3);if(rep.gems)add('#5fd4ff',4);if(rep.boxes)add('#ff6b3d',5);
  { // what fell lies on the ground for a moment with its name, then the character picks up what it was told to
    let row=0;const lay=(txt,c,left)=>{if(SC.drops.length>70)return;SC.drops.push({x:m.x+(Math.random()-.5)*90,y:m.y-24,vx:(Math.random()-.5)*120,vy:-170-Math.random()*60,c:c,s:left?3:4.5,age:0,life:left?4.5:5,lie:left?4:1.5+row*.12,txt:txt,left:left,row:row%3});row++;};
    if(rep.gold>0)lay(fmt(rep.gold)+' זהב','#f2c14e',false);if(rep.gems>0)lay(rep.gems+' אבני נשמה','#5fd4ff',false);if(rep.shards>0)lay(rep.shards+' שברי ארגמן','#ff5c7a',false);if(rep.anc>0)lay(rep.anc+' נקודות עתיקות','#ffd75e',true);if(rep.feather)lay('נוצת נצח','#ffd75e',false);
    if(rep.names)for(const n of rep.names)lay(n[0],n[1]>=6?'#ffd75e':n[1]>=5?'#7dffb0':RAR[n[1]].c,!!n[2]);}
  if(rep.notable)for(const it of rep.notable){add(RAR[it.r].c,5.5);SC.fx.push({k:'beam',x:m.x,y:m.y,life:1.2,c:RAR[it.r].c});toast((it.ex?'':RAR[it.r].n+': ')+itemName(it,S.cls),it.ex?4:it.r);}
  if(rep.jewel)toast('אבן שלמות נפלה מהבוס',4);
  if(rep.shards&&(A.shards||0)>=KEY_SHARDS&&(A.shards||0)-rep.shards<KEY_SHARDS)toast('יש לך מספיק שברים למפתח מצודה',3);
  else if(rep.items)add('#b9b4c7',4);
}
function afterXp(ups){
  if(!(ups>0))return;snd('lvl');statsDirty=true;panelDirty=true;const h=SC.hero;
  h.luAt=SC.t;SC.fx.push({k:'lvl',x:h.x,y:gy(),life:.9,c:'#f2c14e'});SC.fx.push({k:'rune',x:h.x,y:gy()-2,r:64,life:1,d:1,c:'#ffd75e'});SC.fx.push({k:'pillar',x:h.x,y:gy(),life:.7,d:.7,c:'#ffd75e'});addNum(h.x,gy()-120,'רמה '+S.lvl,'#f2c14e',true);
  for(let i=0;i<6;i++)if(!S.resets&&S.lvl>=SKLV[i]&&S.lvl-ups<SKLV[i]&&i>0)toast('כישור חדש: '+CLS[S.cls].sk[i]);
  if(splashN(S.lvl)>splashN(S.lvl-ups))toast('המכה הרגילה שלך פוגעת עכשיו גם ב-'+splashN(S.lvl)+' מפלצות סמוכות');
  if(S.lvl>=CAP)toast('רמה 400. אפשר לבצע ריסט');
}
let bossPending=false;
function syncBoss(){
  if(!A||bossPending||SC.mode!=='farm')return;
  const want=!!(A.bossAt&&A.bossAt.z===SC.zi&&SC.zi>=0);
  if(want&&!SC.boss)spawnBoss();
  else if(!want&&SC.boss){const b=SC.boss;SC.boss=null;SC.mons=SC.mons.filter(m=>m!==b);if(SC.hero.tgt===b)SC.hero.tgt=null;}
}
function afterTick(r,m,l0){
  if(!r||!r.ok){bossPending=false;if(r&&r.msg==='המפה נעולה'&&SC.zi>=0&&!afterTick.out){afterTick.out=1;toast('המפה הזאת נעולה לדמות שלך. חזרת לכפר');send('travel',{z:-1,f:0}).then(()=>{afterTick.out=0;enterZone(-1,'L',0);});return;} // a character standing where it may not: back to the village
    if(r&&r.msg&&r.msg!=='net')send('sync',{}).then(()=>syncBoss());return;}
  if(r.petGone)toast(r.petGone+' עזב אותך. הזמן שלו נגמר',5);
  if(r.afk)showOffline(r.afk);
  if(r.evOver&&SC.ev){leaveKeep(true);return;}
  if(r.sqNew){const d=SIDEQ[r.sqNew.i];snd('portal');announce('משימת צד: '+d.t+' · '+d.d(r.sqNew.n),true);panelDirty=true;}if(r.sqDone){snd('rare');announce('משימת הצד הושלמה. אסוף את הפרס בלשונית אירועים',true);panelDirty=true;}if(r.sqLost)toast('משימת הצד פגה');
  const rep=r.rep||{},src=m||{x:SC.hero.x+SC.hero.face*26,y:gy()};
  if(!ONLINE||rep.items||rep.gems||rep.boxes||rep.notable)dropOrbs(src,rep);
  if(rep.items||rep.boxes)panelDirty=true;
  if(rep.elite){toast('האלוף הובס. השלל שלך',3);snd('rare');}if(rep.eliteDenied)toast('השרת לא אישר את הניצחון על האלוף');
  if(rep.perfect)perfectFound();
  if(rep.clean)toast('ניצחון נקי: אף מהלך מסומן לא פגע בך. אבן נשמה נוספת',3);
  if(rep.boss||rep.bossDenied){bossPending=false;if(rep.opened!=null)toast('השער אל '+ZONES[rep.opened].n+' נפתח');if(rep.bossDenied)toast('השרת לא אישר את הניצחון על הבוס');}
  if(r.shared>0)addNum(SC.hero.x,gy()-150,'+'+fmt(r.shared)+' ניסיון מהפארטי','#8be28b',true);
  if(r.partyN!=null)partyN=r.partyN;if(r.auras&&r.auras.join()!==auras.join()){auras=r.auras;statsDirty=true;panelDirty=true;}
  if(S.lvl>l0)afterXp(S.lvl-l0);
  statsDirty=true;syncBoss();syncElite();
}
function onKill(m,zi){
  if(wbOn()){WB.hurt=1;const bx=SC.cam+wbX(),by=gy()*.42;SC.fx.push({k:'line',x1:m.x,y1:m.y-30,x2:bx,y2:by,life:.3,c:'#f0d0ff',w:2});SC.fx.push({k:'flash',x:bx,y:by,r:44,life:.25,d:.25,c:'#c56bff'});}
  const z=ZONES[zi];
  if(demo){burst(m.x,m.y-24,z.c,10);if(m.boss)SC.boss=null;return;}
  if(m.elite){snd('bossdie');burst(m.x,m.y-36,'#ffd75e',30);addNum(m.x,m.y-120,'האלוף הובס!','#ffd75e',true);m.gone=true;if(ONLINE){pend.elite=true;flushTick();}else{const l0=S.lvl;afterTick(localTick({z:zi,kills:0,elite:true}),m,l0);}return;}
  if(m.boss){snd('bossdie');
    SC.boss=null;bossPending=true;burst(m.x,m.y-40,'#f2c14e',40);if(!calm)SC.shake=.4;addNum(m.x,m.y-150,'הבוס הובס!','#f2c14e',true);
    if(ONLINE){pend.boss=true;pend.clean=!!m.clean;flushTick();}else{const l0=S.lvl;afterTick(localTick({z:zi,kills:0,boss:true,clean:!!m.clean}),m,l0);}
    return;
  }
  burst(m.x,m.y-24,z.c,10);
  if(ONLINE){ // predict XP now; loot and the real numbers arrive with the next server tick
    if(killBudget<1){snd('kill');return;}killBudget-=1; // faster than the server will count: the kill is seen but not promised, so experience never jumps back
    pend.kills++;snd('kill');SC.drops.push({x:m.x,y:m.y-24,vx:(Math.random()-.5)*160,vy:-200,c:'#f2c14e',s:3,age:0,life:4});
    const l0=S.lvl;addXp(S,zs(zi,SC.fl).xp*C.xpM);afterXp(S.lvl-l0);if(pend.kills>=25)flushTick();
  }else{const l0=S.lvl;afterTick(localTick({z:zi,kills:1}),m,l0);}
}
async function travelTo(z,side,f){
  if(busy){SC.hero.climb=null;return;}busy=true;const r=await act('travel',{z:z,f:f|0});busy=false;
  if(!r.ok){SC.hero.climb=null;toast(r.msg==='net'?'אין חיבור לשרת':r.msg);return;}
  snd('portal');enterZone(z,side,f|0);saveLocal();
}
let killBudget=20,killRate=1,killRateT=0; // the same allowance the server keeps for me
let hitOut=[0,0],hitT=0; // my hardest hit since I last told the others on my map, so they see my numbers too
// On a map whose monsters are the server's, a blow is only asked for: the server works out the damage and tells
// everyone on the floor, me included. Nothing is counted here.
let myKey='';
function shCredit(c){SC.shAcc=(SC.shAcc||0)+c;while(SC.shAcc>=1-1e-9){SC.shAcc-=1;if(killBudget<1)continue;killBudget-=1;pend.kills++;const l0=S.lvl;addXp(S,zs(SC.zi,SC.fl).xp*C.xpM);afterXp(S.lvl-l0);if(pend.kills>=25)flushTick();}}
function shMsg(m){
  if(!SC.sh||SC.mode!=='farm')return;const find=i=>SC.mons.find(q=>q.sid===i);
  if(m.t==='ss'){if(m.z!==SC.zi||m.f!==SC.fl||!!m.ev!==!!SC.ev||SC.evWait)return;const n=m.hp.length;for(let i=SC.mons.filter(x=>x.sid>=0).length;i<n;i++){const mm=newMon(SC.ev?240+((i*97)%1100):300+((i*97)%1120)+70,SC.zi);mm.sid=i;SC.mons.push(mm);}
    SC.mons.forEach(x=>{if(x.sid==null)return;const h=m.hp[x.sid];if(h==null)return;if(h<=0){if(x.die<=0&&x.resp<=0){x.resp=1e9;x.dead=true;}}else{x.hp=x.max*h;if(x.resp>0)x.resp=.01;}});return;}
  const x=find(m.i);if(!x)return;
  if(m.t==='sr'){if(x.resp>0)x.resp=.01;else if(x.die<=0){x.hp=x.max;x.dead=false;}return;}
  const mine=m.k===myKey;addNum(x.x,x.y-60,fmt(m.d),m.cr?'#ffd75e':mine?'#fff':'#9fd0ff',!!m.cr);x.hit=1;x.ag=true;if(mine)snd(m.cr?'crit':'hit');
  if(m.t==='sh'){x.hp=x.max*m.h;return;}
  if(x.boss||x.elite){x.hp=0;if(x.die<=0){x.die=.45;x.dead=true;onKill(x,SC.zi);}return;} // the map's boss or its champion: the server saw it fall
  x.hp=0;if(x.die<=0&&x.resp<=0){x.die=.45;x.dead=true;burst(x.x,x.y-24,ZONES[SC.zi].c,10);if(mine)snd('kill');SC.drops.push({x:x.x,y:x.y-24,vx:(Math.random()-.5)*160,vy:-200,c:'#f2c14e',s:3,age:0,life:4});}
  if(m.c>0)shCredit(+m.c);
}
function strike(m,mult,col,big){
  if(SC.sh&&m.sid!=null){if(ws&&ws.readyState===1){netSend({t:'sh',i:m.sid,m:Math.round(mult*(m.weak>0?1.5:1)*100)/100});m.ag=true;}else if(!(SC.shWarn>SC.t-6)){SC.shWarn=SC.t;toast('אין חיבור חי לשרת. במפה הזו החיסולים נספרים רק דרך השרת',4);}return;}
  const crit=Math.random()<C.crit,d=Math.round(C.dmg*(crit?C.cdmg:1)*mult*(m.weak>0?1.5:1)*(.9+Math.random()*.2));
  if(d>hitOut[0])hitOut=[d,crit?1:0];
  snd(crit?'crit':'hit');m.hp-=d;m.hit=1;m.ag=true;addNum(m.x,m.y-(m.boss?130:60),fmt(d),crit?'#ffd75e':big?col:'#fff',crit||big);
  if(m.hp<=0&&m.die<=0){m.die=.45;m.dead=true;onKill(m,SC.zi);}
}
const alive=()=>SC.mons.filter(m=>m.die<=0&&m.resp<=0);
// Every ordinary hit also reaches monsters near the target: the blade cleaves, lightning chains, the spear goes through.
// More of them with level (one from 30, two from 120, three from 250, four from 350), each for 60% of the hit.
const splashN=l=>l>=350?4:l>=250?3:l>=120?2:l>=30?1:0;
function splash(m,col){
  const n=splashN(S.lvl);if(!n||m.boss)return;const h=SC.hero,cls=S.cls,R=cls==='blade'?80:cls==='lord'?110:cls==='storm'?130:170;
  const near=alive().filter(o=>o!==m&&!o.boss&&(cls==='hunter'?(o.x-m.x)*h.face>0&&Math.abs(o.x-m.x)<R:Math.abs(o.x-m.x)<R)).sort((a,b)=>Math.abs(a.x-m.x)-Math.abs(b.x-m.x)).slice(0,n);
  let px=m.x;for(const o of near){
    if(cls==='storm')SC.fx.push({k:'bolt',pts:[[px,m.y-28],[(px+o.x)/2+(Math.random()-.5)*14,m.y-40-Math.random()*14],[o.x,o.y-26]],life:.2,c:col});
    else if(cls==='hunter')SC.fx.push({k:'line',x1:px,y1:m.y-26,x2:o.x,y2:o.y-26,life:.14,c:col,w:2});
    else if(cls==='lord')SC.fx.push({k:'chain',x1:m.x,y1:m.y-30,x2:o.x,y2:o.y-28,life:.26,d:.26});
    else SC.fx.push({k:'slash',x:o.x-6*h.face,y:o.y-28,rot:Math.random()*1.2-.6+(h.face<0?3.14:0),life:.2,c:col});
    SC.fx.push({k:'flash',x:o.x,y:o.y-26,r:16,life:.16,d:.16,c:col});px=o.x;strike(o,.6,col,false);}
}
function cast(i,auto){
  const h=SC.hero;if(SC.mode!=='farm'||SC.zi<0||h.dead>0||h.climb)return false;
  if(i===7)return drinkPot(false);
  if(i===6){if(h.dashT>0)return false;h.dashT=DUEL_LIVE.dash.cd;h.inv=DUEL_LIVE.dash.inv;const d=h.dir||h.face||1,x0=h.x;h.x=clamp(h.x+d*DUEL_LIVE.dash.d,30,mapW()-30);h.tgt=null;h.manual=.4;snd('click');SC.fx.push({k:'line',x1:x0,y1:gy()-50,x2:h.x,y2:gy()-50,life:.2,c:'#9fe8ff',w:6});burst(x0,gy()-40,'#9fe8ff',10);return true;}
  if(!skOpen(i)||h.cds[i]>0)return false;
  const beat=i===0||i===3;if(beat&&h.beat>0){if(!auto)h.q={i:i,until:h.qKeep||SC.t+.5,seek:h.qKeep?1:0};return false;} // pressed a breath early: it goes off on the beat, as in a fight
  // A fighting skill pressed with nothing in its reach is not wasted on the air: the hero goes for the nearest monster and lets it go when he gets there.
  if(beat&&!auto){const rg=CLS[S.cls].range,reach=i===3?rg*1.4+40:S.cls==='blade'?120:rg+80,live=alive();let nm=null,bd=1e9;for(const o of live){const d=Math.abs(o.x-h.x)-(o.boss?40:0);if(d<bd){bd=d;nm=o;}}
    if(nm&&bd>reach){if(bd>1100){toast('אין מטרה בטווח');return false;}h.tgt=nm;h.tx=null;h.goal=null;h.manual=0;h.q={i:i,until:h.qKeep||SC.t+3,seek:1};return false;}
    if(nm&&!(h.tgt&&live.indexOf(h.tgt)>=0&&Math.abs(h.tgt.x-h.x)<=reach+(h.tgt.boss?40:0))){h.tgt=nm;h.face=nm.x>=h.x?1:-1;}}
  const col=gearColor(lookOf(S).w,SC.t,CLS[S.cls].c),melee=S.cls==='blade',loud=SC.t-(h.saidT||0)>1.6;if(beat){h.beat=SG.skT;h.atkT=Math.max(h.atkT||0,SG.skT);}
  if(i===0){const tg0=h.tgt&&h.tgt.die<=0&&!(h.tgt.resp>0)?h.tgt:null,cx=melee||!tg0?h.x+(melee?0:h.face*120):tg0.x,R=melee?135:120,ts=alive().filter(m=>Math.abs(m.x-cx)<R*(m.boss?1.4:1));
    if(!ts.length&&auto)return false;snd('skill');h.anim=1;h.skA=.3;attackFx(S.cls,h.x,hY(),h.face,ts,loud,col);if(loud)SC.fx.push({k:'rune',x:h.x,y:gy()-2,r:70,life:.6,d:.6,c:col});if(melee)for(const d of [-1,1])SC.fx.push({k:'wave',x:h.x+d*20,y:gy(),dir:d,dist:120,h:loud?70:44,life:.26,d:.26,c:col});if(!ts.length)SC.fx.push({k:'ring',x:cx,y:gy()-20,life:.4,c:col});
    if(loud){h.saidT=SC.t;SC.nums.push({x:h.x,y:gy()-135,txt:CLS[S.cls].sk[0]+'!',c:col,s:18,life:1});}for(const m of ts)strike(m,PVE_SK[0],col,true);}
  else if(i===1){snd('pull');for(const m of alive()){if(m.boss||Math.abs(m.x-h.x)>380)continue;m.pull=h.x+(m.x>h.x?1:-1)*(34+Math.random()*44);m.stun=1.8;m.ag=true;}
    SC.fx.push({k:'ring',x:h.x,y:gy()-20,life:.4,c:'#5fd4ff',r:300});SC.fx.push({k:'rune',x:h.x,y:gy()-2,r:150,life:.7,d:.7,c:'#5fd4ff'});SC.nums.push({x:h.x,y:gy()-135,txt:CLS[S.cls].sk[1]+'!',c:'#5fd4ff',s:18,life:1});}
  else if(i===3){const r=CLS[S.cls].range*1.4+40;let m=h.tgt&&h.tgt.die<=0&&!h.tgt.resp?h.tgt:null;
    if(!m){let bd=r;for(const o of alive()){const d=Math.abs(o.x-h.x);if(d<bd){bd=d;m=o;}}}
    if(!m){if(!auto)toast('אין מטרה בטווח');return false;}
    snd('skill');h.face=m.x>=h.x?1:-1;h.anim=1;h.skA=.35;attackFx(S.cls,h.x,hY(),h.face,[m],loud,col);burst(m.x,gy()-50,col,loud?26:10);SC.fx.push({k:'flash',x:m.x,y:gy()-40,r:loud?90:50,life:.25,d:.25,c:col});
    if(loud){h.saidT=SC.t;SC.fx.push({k:'ring',x:m.x,y:gy()-30,life:.35,c:col,r:70});SC.fx.push({k:'star',x:m.x,y:gy()-44,r:48,rot:.4,life:.4,d:.4,c:col});SC.nums.push({x:h.x,y:gy()-135,txt:CLS[S.cls].sk[3]+'!',c:col,s:18,life:1});}if(melee)SC.fx.push({k:'cres',x:m.x,y:gy()-40,R:52,rot:h.face<0?3.14:0,sp:.9*h.face,life:.3,d:.3,c:col});
    strike(m,PVE_SK[1],col,true);}
  else if(i===4){snd('fury');h.shield=DUEL_LIVE.sk[2].dur;if(S.cls==='hunter'){h.shield=0;h.inv=SG.shadow;}SC.fx.push({k:'ring',x:h.x,y:gy()-40,life:.5,c:'#9fe8ff',r:90});SC.fx.push({k:'rune',x:h.x,y:gy()-2,r:80,life:1,d:1,c:'#9fe8ff'});SC.fx.push({k:'pillar',x:h.x,y:gy(),life:.6,d:.6,c:'#9fe8ff'});burst(h.x,gy()-50,'#9fe8ff',20);
    SC.nums.push({x:h.x,y:gy()-135,txt:CLS[S.cls].sk[4]+'!',c:'#9fe8ff',s:18,life:1});}
  else if(i===5){ // the great skill, each class's own as in the siege: the blade leaps, the warlord's chains drag, the witch's meteor bursts, the hunter's spear goes through the line
    const live=alive(),F='#ff7a2e';let m=h.tgt&&live.indexOf(h.tgt)>=0?h.tgt:null;if(!m){let bd=620;for(const o of live){const d=Math.abs(o.x-h.x);if(d<bd){bd=d;m=o;}}}
    if(!m){if(!auto)toast('אין מטרה בטווח');return false;}
    snd('ult');h.face=m.x>=h.x?1:-1;h.anim=1;h.skA=.5;if(!calm)SC.shake=.3;SC.nums.push({x:h.x,y:gy()-150,txt:CLS[S.cls].sk[5]+'!',c:'#ffd75e',s:21,life:1.2});
    if(S.cls==='blade'){const x0=h.x;h.x=clamp(m.x-h.face*30,30,mapW()-30);h.tgt=m;SC.fx.push({k:'line',x1:x0,y1:gy()-60,x2:h.x,y2:gy()-60,life:.25,c:col,w:8});for(let k=0;k<5;k++)SC.fx.push({k:'cres',x:m.x,y:gy()-40,R:44+k*10,rot:k*1.2,sp:(k%2?-1:1)*2,life:.3+k*.04,d:.4,c:k%2?'#fff':col});SC.fx.push({k:'ring',x:m.x,y:gy()-10,life:.45,c:col,r:120});
      strike(m,PVE_SK[2],col,true);for(const o of live)if(o!==m&&Math.abs(o.x-m.x)<130)strike(o,PVE_SK[2]*.5,col,true);}
    else if(S.cls==='lord'){const ts=live.filter(o=>Math.abs(o.x-h.x)<520).slice(0,6);for(const o of ts){SC.fx.push({k:'chain',x1:h.x+h.face*14,y1:hY()-92,x2:o.x,y2:gy()-30,life:.45,d:.45});if(!o.boss){o.pull=h.x+(o.x>h.x?1:-1)*(40+Math.random()*50);o.stun=1.2;o.ag=true;}burst(o.x,gy()-30,F,12);strike(o,o===m?PVE_SK[2]:PVE_SK[2]*.6,col,true);}SC.fx.push({k:'ring',x:h.x,y:gy()-6,life:.5,c:F,r:200});}
    else if(S.cls==='storm'){SC.fx.push({k:'met',x0:m.x+200,y0:-40,x:m.x,y:gy()-14,life:.3,d:.3,c:'#ff8a4d'});for(let k=0;k<4;k++)SC.fx.push({k:'met',x0:m.x+200+(k-1.5)*70,y0:-40,x:m.x+(k-1.5)*70,y:gy()-14,life:.36+k*.05,d:.4,c:k%2?'#ff8a4d':col});SC.fx.push({k:'rune',x:m.x,y:gy()-2,r:150,life:.9,d:.9,c:col});SC.fx.push({k:'flash',x:m.x,y:gy()-40,r:150,life:.35,d:.35,c:'#fff'});
      for(const o of live)if(Math.abs(o.x-m.x)<160*(o.boss?1.4:1))strike(o,o===m?PVE_SK[2]:PVE_SK[2]*.7,col,true);}
    else{const ts=live.filter(o=>(o.x-h.x)*h.face>=-20&&Math.abs(o.x-h.x)<640);SC.fx.push({k:'line',x1:h.x+h.face*18,y1:hY()-58,x2:h.x+h.face*660,y2:gy()-40,life:.3,c:'#fff',w:7});SC.fx.push({k:'line',x1:h.x+h.face*18,y1:hY()-58,x2:h.x+h.face*660,y2:gy()-40,life:.4,c:col,w:12});
      for(const o of ts){burst(o.x,gy()-40,col,12);SC.fx.push({k:'flash',x:o.x,y:gy()-36,r:50,life:.3,d:.3,c:col});strike(o,o===m?PVE_SK[2]:PVE_SK[2]*.75,col,true);}}}
  else{snd('fury');h.buff=8;SC.fx.push({k:'ring',x:h.x,y:gy()-20,life:.4,c:'#ffd75e',r:120});SC.fx.push({k:'rune',x:h.x,y:gy()-2,r:90,life:1,d:1,c:'#ffd75e'});SC.fx.push({k:'pillar',x:h.x,y:gy(),life:.6,d:.6,c:'#ffd75e'});SC.fx.push({k:'star',x:h.x,y:gy()-70,r:40,rot:0,life:.5,d:.5,c:'#ffd75e'});burst(h.x,gy()-50,'#ffd75e',24);SC.nums.push({x:h.x,y:gy()-135,txt:CLS[S.cls].sk[2]+'!',c:'#ffd75e',s:18,life:1});}
  h.cds[i]=SKCD[i];if(!auto){pend.casts++;comboStep(i,col);}return true;
}
// In the maps a fight is the siege's fight: the two skills on one short beat, the guard, the great skill, the step, a potion by the press.
// What the skills are worth here: [the first, the strong one, the great one], against one plain blow.
const PVE_SK=[.5,1.6,4],skOpen=i=>S.resets>0||S.lvl>=SKLV[i]; // the first skill strikes everyone around, so each takes less; a character that has reset once keeps all its skills from level 1
function drinkPot(auto){const h=SC.hero;if(SC.mode!=='farm'||SC.zi<0||h.dead>0||h.potT>0||h.hp>=C.hp)return false;if(A.pots==null)A.pots=G.POT_START;
  if(A.pots<1){if(!auto&&SC.t-(h.noPotT||-9)>4){h.noPotT=SC.t;toast('נגמרו השיקויים. קונים בחנות הזהב');}return false;}
  h.potT=SG.potCd;A.pots--;pend.pots++;const g=C.hp*SG.heal;h.hp=Math.min(C.hp,h.hp+g);snd('coin');addNum(h.x,gy()-100,'+'+fmt(g),'#6fe39a');SC.fx.push({k:'ring',x:h.x,y:gy()-40,life:.25,c:'#6fe39a',r:34});return true;}
// A combo against monsters, in the same order as against players: a plain blow, the first skill, then the pulling one,
// each within a short moment of the last. Only by hand; the pulling skill's wait is what keeps it from being cheap.
const CBW=1.6,CBM=1.6,CBS=.5;
function comboStep(i,col,hitM){
  const h=SC.hero,k=i<0?'atk':i===0?'s0':i===3?'s1':'',q=G.COMBO[S.cls]||G.COMBO.blade,ok=SC.t-(h.cbT||-9)<=CBW,n=ok?h.cb|0:0;
  if(hitM)h.cbM=hitM;
  if(n>0&&k===q[n]){h.cb=n+1;h.cbT=SC.t;if(h.cb<3){SC.nums.push({x:h.x,y:gy()-160,txt:h.cb+'/3',c:'#ffd75e',s:15,life:.8});return;}}
  else{if(k===q[0]){h.cb=1;h.cbT=SC.t;}else if(k!=='atk')h.cb=0;return;} // plain blows fall by themselves here, so they never break the order
  {h.cb=0;const live=alive();let m=h.cbM&&live.indexOf(h.cbM)>=0?h.cbM:null;if(!m){let bd=420;for(const o of live){const d=Math.abs(o.x-h.x);if(d<bd){bd=d;m=o;}}}
    if(!m)return;snd('ult');snd('slam');SC.nums.push({x:h.x,y:gy()-165,txt:'קומבו!',c:'#ff5c7a',s:W<560?24:32,life:1.2});
    const hit=(o,k,big)=>{comboFx(S.cls,o.x,gy(),big,h.x+h.face*14,hY()-92);strike(o,k,col,true);};
    hit(m,CBM,true);if(!calm)SC.shake=.3;
    for(const o of live.filter(o=>o!==m&&!o.boss&&Math.abs(o.x-h.x)<380).slice(0,4))hit(o,CBS);return;}
  h.cb=0;
}
function portalState(dir){ // what stands at the left (-1) or right (+1) end of the current floor
  const zi=SC.zi,fl=SC.fl;
  if(SC.ev)return dir<0?{to:-1,f:0,ok:true,txt:'יציאה מהמצודה',ev:1}:null;
  if(zi>=0){const upDir=fl%2===0?1:-1; // ladders zigzag: up on the right of floor 1, on the left of floor 2
    if(fl<FLOORS-1&&dir===upDir){const need=floorMin(zi,fl+1);return {kind:'up',to:zi,f:fl+1,ok:S.lvl>=need,txt:'קומה '+(fl+2)+(S.lvl>=need?'':' · רמה '+need),why:'צריך רמה '+need+' כדי לטפס לקומה הבאה'};}
    if(fl>0&&dir===-upDir)return {kind:'down',to:zi,f:fl-1,ok:true,txt:'קומה '+fl};
    if(dir<0){const back=zi>=BASEZ||zi===0?-1:zi-1;return {to:back,f:back<0?0:afkTop(back),ok:true,txt:back<0?TOWN.n:ZONES[back].n};}
  }else if(dir<0)return null;
  if(zi>=BASEZ-1)return null;
  const to=zi+1;
  if(to>A.open)return {to:to,f:0,ok:false,txt:'נעול: הבס את הבוס',why:'קודם צריך להביס את הבוס של '+ZONES[zi].n};
  if(ZONES[to].min>S.lvl)return {to:to,f:0,ok:false,txt:ZONES[to].n+' · רמה '+ZONES[to].min,why:'צריך רמה '+ZONES[to].min+' כדי להיכנס'};
  return {to:to,f:0,ok:true,txt:ZONES[to].n};
}
function afkTop(z){let f=FLOORS-1;while(f>0&&S.lvl<floorMin(z,f))f--;return f;}
function arrive(g){
  if(g.npc){openTab(g.npc.tab);toast(g.npc.n);return;}
  const p=portalState(g.dir);if(!p)return;if(!p.ok){toast(p.why);return;}
  if(p.ev){leaveKeep(false);return;}
  if(p.kind){const h=SC.hero,side=g.dir<0?'L':'R';h.dir=0;h.tgt=null;h.tx=null;h.goal=null;h.x=g.dir<0?50:mapW()-50;h.face=g.dir;snd('click');
    h.climb={kind:p.kind,ph:'out',t:.45,go:()=>travelTo(p.to,side,p.f)};return;}
  travelTo(p.to,g.dir<0?'R':'L',p.f);
}
function updateWorld(dt){
  const h=SC.hero,zi=SC.zi,z=zi>=0?ZONES[zi]:null,mw=mapW();
  if(h.climb){const cl=h.climb;cl.t-=dt;
    if(cl.t<=0){if(cl.ph==='out'){cl.ph='wait';cl.t=4;cl.go();}else h.climb=null;}
    return;}
  for(let i=0;i<6;i++)h.cds[i]=Math.max(0,h.cds[i]-dt);h.shield=Math.max(0,(h.shield||0)-dt);h.beat=Math.max(0,(h.beat||0)-dt);h.potT=Math.max(0,(h.potT||0)-dt);h.dashT=Math.max(0,(h.dashT||0)-dt);h.inv=Math.max(0,(h.inv||0)-dt);
  if(h.q&&h.beat<=0){const q=h.q;h.q=null;if(SC.t<=q.until){h.qKeep=q.seek?q.until:0;cast(q.i,false);h.qKeep=0;}}
  if(S.auto&&(prefs.autoPot==null?50:prefs.autoPot)>0&&h.dead<=0&&h.hp<C.hp*(prefs.autoPot==null?50:prefs.autoPot)/100)drinkPot(true);
  h.buff=Math.max(0,h.buff-dt);h.manual=Math.max(0,h.manual-dt);h.autoSk=Math.max(0,h.autoSk-dt);h.anim=Math.max(0,h.anim-dt*4);h.skA=Math.max(0,(h.skA||0)-dt);h.atkT-=dt;h.mv=false;
  // monsters
  for(const m of SC.mons){
    if(m.die>0){m.die-=dt;if(m.die<=0){if(m.boss||m.elite)m.gone=true;else m.resp=m.sid!=null&&SC.sh?1e9:SC.ev?.9:3.5;}continue;}
    if(m.resp>0){m.resp-=dt;if(m.resp<=0){m.hp=m.max;m.x=m.home;m.dead=false;m.stun=0;m.pull=null;m.ag=false;}continue;}
    m.hit=Math.max(0,m.hit-dt*4);m.atkA=Math.max(0,(m.atkA||0)-dt);m.mv=false;
    if(m.pull!=null){m.x+=(m.pull-m.x)*Math.min(1,dt*9);if(Math.abs(m.pull-m.x)<3)m.pull=null;}
    if(m.stun>0){m.stun-=dt;continue;}
    if(m.boss){ // marked moves: each shows on the ground first, and each can be walked out of
      const mad=m.hp<m.max*.35,bh=(pc,far)=>{if(h.dead>0)return;const d=C.hp*pc*(h.shield>0?1-DUEL_LIVE.sk[2].cut:1);if(h.inv>0)return;h.hp-=d;m.clean=false;snd('hurt');addNum(h.x,gy()-100,'-'+fmt(d),'#ff5c7a',true);};
      m.weak=Math.max(0,m.weak-dt);
      if(m.metN>0&&(m.metT-=dt)<=0){m.metN--;m.metT=mad?.45:.6;m.mets.push({x:h.x,t:.95});}
      for(const q of m.mets){q.t-=dt;if(q.t<=0){SC.fx.push({k:'flash',x:q.x,y:gy()-30,r:60,life:.3,d:.3,c:'#ff9a4a'});SC.fx.push({k:'ring',x:q.x,y:gy()-8,life:.35,c:'#ff9a4a',r:62});burst(q.x,gy()-10,'#ff9a4a',10);snd('slam');if(Math.abs(h.x-q.x)<58)bh(.2);}}
      m.mets=m.mets.filter(q=>q.t>0);
      if(m.dash){const st=Math.sign(m.dash.to-m.x)*760*dt;if(Math.abs(m.dash.to-m.x)<=Math.abs(st)){m.x=m.dash.to;m.dash=null;m.weak=2.2;}else m.x+=st;m.mv=true;if(m.dash&&!m.dash.hit&&!h.up&&Math.abs(h.x-m.x)<52){m.dash.hit=true;bh(.35);}continue;}
      if(m.chg){m.chg.t-=dt;m.atkA=.4;if(m.chg.t<=0){m.dash={to:clamp(m.x+m.chg.dir*420,120,mapW()-120),hit:false};m.chg=null;snd('pull');}continue;}
      if(m.wind<=0&&(m.m2T-=dt)<=0&&Math.abs(h.x-m.x)<340&&h.dead<=0){m.m2T=mad?6:9.5;if(zi%2===0){m.metN=mad?5:3;m.metT=0;snd('growl');}else{m.chg={t:mad?.8:1.05,dir:h.x>=m.x?1:-1};snd('growl');continue;}}
    }
    if(m.boss&&m.wind>0){m.wind-=dt;m.atkA=.5*clamp(m.wind/1.2,0,1);if(m.wind<=0){SC.fx.push({k:'ring',x:m.slamX,y:gy()-10,life:.4,c:'#ff5c7a',r:130});if(!calm)SC.shake=.3;snd('slam');
        if(h.dead<=0&&Math.abs(h.x-m.slamX)<125){const d=C.hp*.45*(h.shield>0?.3:1);h.hp-=d;m.clean=false;addNum(h.x,gy()-100,'-'+fmt(d),'#ff5c7a',true);}m.slamT=m.hp<m.max*.35?4:6;m.weak=2.2;}continue;}
    const dx=h.x-m.x,ad=Math.abs(dx),reach=m.boss?70:36;
    if(ad>420)m.ag=false;
    const same=m.boss||(m.up?1:0)===(h.up?1:0);if(!same)m.ag=false;
    if(same&&h.dead<=0&&(m.boss?ad<340:(m.ag||ad<110))){
      if(ad>reach){m.x+=Math.sign(dx)*(m.boss?45:58)*dt;m.mv=true;}
      else if((m.atkT-=dt)<=0){m.atkT=m.boss?1.2:1;m.atkA=.5;if(h.inv>0){addNum(h.x,gy()-100,'החטיא','#9fe8ff');}else{const taken=Math.max(zs(zi,SC.fl).atk*300/(300+C.def),C.hp*G.liveBite(zi)*(1+.12*SC.fl))*(m.boss?2:m.elite?1.6:1)*(h.shield>0?1-DUEL_LIVE.sk[2].cut:1);h.hp-=taken;snd('hurt');addNum(h.x,gy()-100,'-'+fmt(taken),'#ff5c7a');}}
      if(m.boss&&(m.slamT-=dt)<=0&&ad<210){m.wind=1.2;m.slamX=m.x;snd('growl');}
    }else if(Math.abs(m.x-m.home)>4){m.x+=Math.sign(m.home-m.x)*40*dt;m.mv=true;m.back=true;}else m.back=false;
    if(m.up)m.x=clamp(m.x,DECK.x0+18,DECK.x1-18);
  }
  SC.mons=SC.mons.filter(m=>!m.gone);
  if(h.dead>0){h.dead-=dt;if(h.dead<=0){h.hp=C.hp;h.x=110;h.up=0;h.lift=0;h.tgt=null;h.tx=null;h.goal=null;}return;}
  if(h.hp<=0){h.dead=3;h.tgt=null;addNum(h.x,gy()-120,'נפלת','#ff5c7a',true);return;}
  h.hp=Math.min(C.hp,h.hp+C.hp*.01*dt); // health comes back slowly by itself: in a fight it is potions that keep one standing
  // hero
  if(SC.zi>=0&&ZONES[SC.zi].x&&!calm&&Math.random()<dt*26){const vx=ZONES[SC.zi].x;SC.parts.push({x:SC.cam+Math.random()*W,y:Math.random()*gy()*.9,vx:vx===3?(Math.random()-.5)*60:-30-Math.random()*40,vy:vx===3?-50-Math.random()*40:vx===2?-70:10,life:1.6+Math.random(),c:vx===1?'#ffffff':vx===2?'#ff2a3a':'#b79cff',s:vx===3?3:2});} // the void is never still: bone dust, rising blood, sparks of nothing
  const live=alive(),range=CLS[S.cls].range,spd=190*(1+(S.eq.g?Math.min(8,S.eq.g.t)*.08:0))*(h.buff>0?1.5:1);
  if(h.tgt&&(h.tgt.die>0||h.tgt.resp>0||h.tgt.gone))h.tgt=null;
  if(h.dir){h.tgt=null;h.tx=null;h.goal=null;h.manual=.5;h.face=h.dir;h.mv=true;h.x=clamp(h.x+h.dir*spd*dt,30,mw-30);
    const atL=h.dir<0&&h.x<=66&&zi>=0,atR=h.dir>0&&h.x>=mw-66&&!!portalState(1);
    if(atL||atR){h.edgeT=(h.edgeT||0)+dt;if(h.edgeT>.3){h.edgeT=-1.5;arrive({dir:h.dir});SC.cam=clamp(h.x-W*.4,0,Math.max(0,mapW()-W));return;}}else if(h.edgeT>0)h.edgeT=0;
  }
  if(zi>=0&&!h.tgt&&h.manual<=0&&h.tx==null){
    const mel=S.cls==='blade',lv=m=>(m.up?1:0)!==(h.up?1:0);
    if(S.auto){let best=null,bd=1e9;for(const m of live){const d=Math.abs(m.x-h.x)*(m.boss?.5:1)+(mel&&lv(m)?240:0);if(d<bd){bd=d;best=m;}}h.tgt=best;}
  }
  if(h.tgt&&h.tx==null){const m=h.tgt,dx=m.x-h.x,r=range+(m.boss?40:0),mu=m.up?1:0,hu=h.up?1:0;h.face=dx>=0?1:-1;
    if(S.cls==='blade'&&mu!==hu){ // a blade goes to the nearest ladder to climb, or to the nearest edge to drop
      const a=mu?DECK.x0+16:DECK.x0-14,b=mu?DECK.x1-16:DECK.x1+14,gx=Math.abs(h.x-a)<Math.abs(h.x-b)?a:b,d=gx-h.x;h.face=d>=0?1:-1;
      if(Math.abs(d)>7){h.x+=Math.sign(d)*Math.min(Math.abs(d),spd*dt);h.mv=true;}else if(mu){h.up=1;snd('click');}}
    else if(Math.abs(dx)>r){h.x+=Math.sign(dx)*spd*dt;h.mv=true;}
    else{
      if(S.auto&&h.autoSk<=0&&cast(0,true))h.autoSk=3;
      if(h.atkT<=0){h.atkT=1/(C.aspd*(h.buff>0?2:1));h.anim=1;h.lastAtk=SC.t;const col=gearColor(lookOf(S).w,SC.t,CLS[S.cls].c);h.chain=SC.t-(h.chainT||0)>2.5?1:(h.chain||0)+1;h.chainT=SC.t;comboStep(-1,col,m);const step=h.chain%4; // the ordinary attack is a four-beat chain: jab, cross, jab, finisher
        if(step===0){attackFx(S.cls,h.x,hY(),h.face,[m],true,col);h.skA=.25;
          if(S.cls==='lord'){SC.fx.push({k:'wave',x:h.x+h.face*30,y:gy(),dir:h.face,dist:Math.abs(m.x-h.x)+70,h:70,life:.32,d:.32,c:'#ff7a2e'});for(let q=0;q<2;q++)SC.fx.push({k:'ring',x:h.x+h.face*30,y:gy()-4,life:.3+q*.12,c:q?'#ffd75e':'#ff7a2e',r:40+q*30});burst(m.x,gy()-30,'#ff7a2e',16);}
          else if(S.cls==='blade'){SC.fx.push({k:'cres',x:m.x,y:gy()-38,R:50,rot:h.face<0?3.14:0,sp:1.4*h.face,life:.28,d:.28,c:col});SC.fx.push({k:'wave',x:h.x+h.face*20,y:gy(),dir:h.face,dist:150,h:64,life:.3,d:.3,c:col});}
          else if(S.cls==='storm'){SC.fx.push({k:'pillar',x:m.x,y:gy(),life:.35,d:.35,c:col});SC.fx.push({k:'rune',x:m.x,y:gy()-2,r:44,life:.5,d:.5,c:col});}
          else for(let q=-1;q<=1;q++)SC.fx.push({k:'line',x1:h.x+18*h.face,y1:gy()-58+q*10,x2:m.x,y2:m.y-26+q*14,life:.16+Math.abs(q)*.04,c:col,w:2.5});
          strike(m,1.8,col,true);if((h.artN=(h.artN||0)+1)%3===0&&SC.mode==='farm')castArt(m,col);}
        else{attackFx(S.cls,h.x,hY(),h.face,[m],false,col);if(step===2&&S.cls==='blade')SC.fx.push({k:'cres',x:m.x-4*h.face,y:gy()-34,R:30,rot:(h.face<0?3.14:0)+.5,sp:-1.1*h.face,life:.2,d:.2,c:col});strike(m,1,col,false);}
        splash(m,col);if(m.dead)h.atkT=Math.max(h.atkT,.3);}
    }
  }else if(h.tx!=null){const dx=h.tx-h.x;h.face=dx>=0?1:-1;
    if(Math.abs(dx)<6){h.tx=null;if(h.goal){const g=h.goal;h.goal=null;arrive(g);}}else{h.x+=Math.sign(dx)*Math.min(Math.abs(dx),spd*dt);h.mv=true;}}
  h.x=clamp(h.x,30,mw-30);if(h.up&&(h.x<DECK.x0-6||h.x>DECK.x1+6))h.up=0;h.lift=(h.lift||0)+((h.up?1:0)-(h.lift||0))*Math.min(1,dt*9);
  SC.cam=clamp(h.x-W*.4,0,Math.max(0,mw-W));
}
function holdBtn(id,d){const b=$(id);const on=e=>{e.preventDefault();initAudio();SC.hero.dir=d;b.classList.add('hold');},off=()=>{if(SC.hero.dir===d)SC.hero.dir=0;b.classList.remove('hold');};
  b.addEventListener('pointerdown',on);for(const ev of ['pointerup','pointercancel','pointerleave'])b.addEventListener(ev,off);b.addEventListener('contextmenu',e=>e.preventDefault());}
holdBtn('mvL',-1);holdBtn('mvR',1);
for(const [id,v] of [['mvU',-1],['mvD',1]]){const b=$(id),on=e=>{e.preventDefault();initAudio();SC.hero.dz=v;b.classList.add('hold');},off=()=>{if(SC.hero.dz===v)SC.hero.dz=0;b.classList.remove('hold');};b.addEventListener('pointerdown',on);for(const ev of ['pointerup','pointercancel','pointerleave'])b.addEventListener(ev,off);b.addEventListener('contextmenu',e=>e.preventDefault());}
window.addEventListener('keydown',e=>{if(!SC.duel||e.target&&e.target.tagName==='INPUT')return;if(evKey(e)==='ArrowUp'||(evKey(e)==='w'&&!keyTaken('w'))){SC.hero.dz=-1;e.preventDefault();}else if(evKey(e)==='ArrowDown'||(evKey(e)==='s'&&!keyTaken('s'))){SC.hero.dz=1;e.preventDefault();}});
window.addEventListener('keyup',e=>{if((evKey(e)==='ArrowUp'||evKey(e)==='w')&&SC.hero.dz<0||(evKey(e)==='ArrowDown'||evKey(e)==='s')&&SC.hero.dz>0)SC.hero.dz=0;});
{const bar=$('duelBar');bar.addEventListener('pointerdown',e=>{const b=e.target.closest('button');if(!b||b.disabled||!SC.duel)return;e.preventDefault();initAudio();if(b.dataset.a==='atk')SC.duel.holdAtk=true;duelAct(b.dataset.a);});
  for(const ev of ['pointerup','pointercancel','pointerleave'])bar.addEventListener(ev,()=>{if(SC.duel)SC.duel.holdAtk=false;});bar.addEventListener('contextmenu',e=>e.preventDefault());
  window.addEventListener('keydown',e=>{if(!SC.duel||e.target&&e.target.tagName==='INPUT')return;if(e.key==='Tab'&&SC.duel.br){e.preventDefault();selNext();return;}const k=keyAct(KEYS_FIGHT,evKey(e).toLowerCase());if(!k)return;e.preventDefault();if(k==='use'){const u=$('useBtn');if(u&&u.style.display!=='none')u.click();return;}if(k==='pot'&&e.repeat)return;if(k==='atk')SC.duel.holdAtk=true;duelAct(k);});
  window.addEventListener('keyup',e=>{if(SC.duel&&evKey(e).toLowerCase()===keyOf('atk'))SC.duel.holdAtk=false;});}
window.addEventListener('keydown',e=>{if(e.target&&e.target.tagName==='INPUT')return;const k=evKey(e);if(k==='ArrowLeft'||(k==='a'&&!keyTaken('a')))SC.hero.dir=-1;else if(k==='ArrowRight'||(k==='d'&&!keyTaken('d')))SC.hero.dir=1;else if(S&&!demo&&!SC.duel){const fk=keyAct(KEYS_FARM,k.length===1?k.toLowerCase():k);if(fk)cast(+fk[1],false);}});
window.addEventListener('keyup',e=>{const k=evKey(e);if((k==='ArrowLeft'||k==='a')&&SC.hero.dir<0||(k==='ArrowRight'||k==='d')&&SC.hero.dir>0)SC.hero.dir=0;});
window.addEventListener('blur',()=>{SC.hero.dir=0;});
// The walking stick of the Last Circle: hold it and lean it the way you want to go.
const joy={v:[0,0],id:null};
{const el=$('joy'),knob=el.firstElementChild,R=40,set=e=>{const r=el.getBoundingClientRect();let dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2);const m=Math.hypot(dx,dy);if(m>R){dx*=R/m;dy*=R/m;}knob.style.transform='translate('+dx+'px,'+dy+'px)';joy.v=m<8?[0,0]:[dx/R,dy/R];},
  end=()=>{joy.id=null;joy.v=[0,0];knob.style.transform='';};
  el.addEventListener('pointerdown',e=>{e.preventDefault();initAudio();joy.id=e.pointerId;try{el.setPointerCapture(e.pointerId);}catch(_){}set(e);});
  el.addEventListener('pointermove',e=>{if(joy.id===e.pointerId)set(e);});for(const ev of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(ev,e=>{if(joy.id===e.pointerId||ev==='lostpointercapture')end();});el.addEventListener('contextmenu',e=>e.preventDefault());}
cv.addEventListener('pointerdown',e=>{
  if(SC.duel&&SC.duel.br&&SC.mode==='duel'){const r=cv.getBoundingClientRect();brTap((e.clientX-r.left)/ZM,(e.clientY-r.top)/ZM);return;}
  if(!S||demo||busy||SC.mode!=='farm'||SC.hero.dead>0||SC.hero.climb)return;
  const r=cv.getBoundingClientRect(),wx=(e.clientX-r.left)/ZM+SC.cam,py=(e.clientY-r.top)/ZM,h=SC.hero,g0=gy();
  if(Math.hypot((e.clientX-r.left)/ZM-W*.78,py-H*.2)<26){if(++egg.moon>=7)tryEgg('moon');return;}
  h.tgt=null;h.goal=null;h.tx=null;
  if(py>g0-170-(hasDeck(SC.zi)?deckH():0)){
    for(const m of alive())if(m.up&&Math.abs(wx-m.x)<32&&py>g0-deckH()-95&&py<g0-deckH()+8){h.tgt=m;return;}
    for(const m of alive())if(!m.up&&Math.abs(wx-m.x)<(m.boss?60:32)&&py>g0-(m.boss?170:95)){h.tgt=m;return;}
    for(const p of peers)if(Math.abs(wx-p.x)<26&&py>g0-120){showPeer(p);return;}
    if(SC.zi<0&&ONLINE)for(const q of stalls())if(Math.abs(wx-q.x)<40&&py>g0-90){openStall(q);return;}
    if(SC.zi>=0&&Math.abs(wx-50)<42){h.tx=60;h.goal={dir:-1};return;}
    if(portalState(1)&&Math.abs(wx-(mapW()-50))<42){h.tx=mapW()-60;h.goal={dir:1};return;}
  }
  h.tx=clamp(wx,30,mapW()-30);h.manual=2.5;
});
function drawWorld(){
  const h=SC.hero,sc=clamp(H/300,.8,1.45),g0=gy(),zi=SC.zi,lk=lookOf(S),hk=SPR[CLSSPR[S.cls]];lk.sk=h.skA>0;
  ctx.save();ctx.translate(-Math.round(SC.cam),0);
  const pl=portalState(-1),pr=portalState(1);
  for(const [p,x] of [[pl,50],[pr,mapW()-50]])if(p){if(p.kind)drawLadder(x,p);else drawPortal(x,p.ok,p.txt,SC.t);}
  if(zi<0)for(const n of NPCS){drawHero(n.x,g0,sc,{c:n.c,spr:n.spr},SC.t+n.x,0,true,0,false,false);label(n.n,n.x,g0-SPR[n.spr].bh*2*sc-12,n.col,12.5);}
  if(hasDeck(zi)){const dh=deckH(),y=g0-dh; // the deck and its two ladders
    ctx.fillStyle='rgba(0,0,0,.28)';ctx.fillRect(DECK.x0+6,g0-3,DECK.x1-DECK.x0-12,5);
    for(const lx of [DECK.x0+16,DECK.x1-16]){ctx.strokeStyle='#7a5a34';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(lx-9,y);ctx.lineTo(lx-9,g0);ctx.moveTo(lx+9,y);ctx.lineTo(lx+9,g0);ctx.stroke();ctx.strokeStyle='#c9a26a';ctx.lineWidth=2.5;ctx.beginPath();for(let q=y+10;q<g0-3;q+=13){ctx.moveTo(lx-9,q);ctx.lineTo(lx+9,q);}ctx.stroke();}
    ctx.fillStyle='#3a2a18';for(let px=DECK.x0+70;px<DECK.x1-40;px+=120)ctx.fillRect(px,y+8,7,dh-8);
    const gr=ctx.createLinearGradient(0,y,0,y+11);gr.addColorStop(0,'#b58a52');gr.addColorStop(1,'#5e4426');ctx.fillStyle=gr;ctx.fillRect(DECK.x0,y,DECK.x1-DECK.x0,11);ctx.fillStyle='rgba(0,0,0,.25)';for(let px=DECK.x0+38;px<DECK.x1;px+=38)ctx.fillRect(px,y,1.5,11);ctx.fillStyle='rgba(255,236,190,.35)';ctx.fillRect(DECK.x0,y,DECK.x1-DECK.x0,1.5);}
  worldBossStrike(SC.dt||0,g0);
  for(const m of SC.mons){if(m.resp>0)continue;m.y=g0-(m.up?deckH():0);
    if(m.boss&&m.wind>0){ctx.save();ctx.globalAlpha=.25+.3*(1-m.wind/1.2);ctx.fillStyle='#ff5c7a';ctx.beginPath();ctx.ellipse(m.slamX,g0,125,16,0,0,7);ctx.fill();ctx.restore();}
    if(m.boss){for(const q of m.mets){const u=1-clamp(q.t/.95,0,1);ctx.save();ctx.globalAlpha=.2+.4*u;ctx.fillStyle='#ff9a4a';ctx.beginPath();ctx.ellipse(q.x,g0,58,12,0,0,7);ctx.fill();ctx.globalAlpha=.9;ctx.strokeStyle='#ffd0a0';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(q.x,g0,58*u,12*u,0,0,7);ctx.stroke();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=.8;ctx.fillStyle='#ffb060';ctx.beginPath();ctx.arc(q.x+q.t*90,g0-q.t*520,7,0,7);ctx.fill();ctx.restore();}
      if(m.chg){const x1=clamp(m.x+m.chg.dir*420,120,mapW()-120),u=1-clamp(m.chg.t/1.05,0,1);ctx.save();ctx.globalAlpha=.18+.35*u;ctx.fillStyle='#ff5c7a';ctx.fillRect(Math.min(m.x,x1),g0-9,Math.abs(x1-m.x),18);ctx.globalAlpha=.9;ctx.fillStyle='#ffd0d8';for(let q=0;q<4;q++){const ax=m.x+m.chg.dir*(60+q*100+((SC.t*160)%100));if((ax-m.x)*m.chg.dir<Math.abs(x1-m.x)){ctx.beginPath();ctx.moveTo(ax+m.chg.dir*10,g0);ctx.lineTo(ax-m.chg.dir*6,g0-7);ctx.lineTo(ax-m.chg.dir*6,g0+7);ctx.fill();}}ctx.restore();}
      if(m.weak>0&&m.die<=0)label('חשוף! נזק מוגבר',m.x,g0-200*sc,'#7df9ff',12);}
    drawMon(m,zi,SC.t,m.dash?m.dash.to<m.x:m.chg?m.chg.dir<0:m.back?m.home<m.x:h.x<m.x,sc);}
  if(h.tx!=null&&!h.goal){ctx.strokeStyle='rgba(255,255,255,.5)';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(h.tx,g0,9,3,0,0,7);ctx.stroke();}
  if(h.tgt){ctx.strokeStyle='#ffd75e';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(h.tgt.x,g0+1-(h.tgt.up?deckH():0),h.tgt.boss?40:22,h.tgt.boss?8:5,0,0,7);ctx.stroke();}
  drawPeers(g0,sc);
  const cl=h.climb;
  if(cl){const u=cl.ph==='wait'?1:cl.ph==='out'?1-cl.t/.45:cl.t/.45,above=(cl.kind==='up')===(cl.ph!=='in');
    ctx.save();ctx.globalAlpha=clamp(1-u*u,0,1);drawHero(h.x,g0+(above?-u*170:u*46),sc,lk,SC.t,0,h.face<0,0,true,false);ctx.restore();}
  else{
    const hg=g0-deckH()*(h.lift||0);
    if(h.shield>0){ctx.save();ctx.globalCompositeOperation='lighter';ctx.strokeStyle='#9fe8ff';ctx.shadowColor='#9fe8ff';ctx.shadowBlur=14;ctx.globalAlpha=.45+.25*Math.sin(SC.t*9);ctx.lineWidth=2.5;ctx.beginPath();ctx.ellipse(h.x,hg-hk.bh*sc,34*sc,hk.bh*sc+8,0,0,7);ctx.stroke();ctx.restore();}
    lk.lu=h.luAt!=null?Math.max(0,1-(SC.t-h.luAt)/1.1):0;drawHero(h.x,hg,sc,lk,SC.t,h.anim,h.face<0,h.dead>0?3-h.dead:0,h.mv,h.buff>0);lk.lu=0;
    if(h.say&&h.say.t>SC.t)bubble(h.x,hg-hk.bh*2*sc-52,h.say.m);
    hpBar(h.x-30,hg-hk.bh*2*sc-16,60,h.hp/C.hp,'#6fe39a');nameTag(h.x,hg-hk.bh*2*sc-22,S.name,lk.r,guild.mine?guild.mine.tag:'',!!(guild.mine&&guild.mine.castle));}
  drawFx(SC.dt);ctx.restore();
  if(window.EC&&window.EC.gallery)window.EC.gallery(drawHero,ctx); // debug hook for looking at gear art
  if(SC.ev&&SC.evWait){label('המצודה מתחילה בעוד '+mmss(Math.max(0,(SC.evStart-Date.now())/1000)),W/2,H*.3,'#ff5c7a',20);label('השער ננעל כשהספירה נגמרת. מי שבחוץ מחכה למצודה הבאה',W/2,H*.3+24,'#c9c2ea',11);}
  if(SC.boss){hpBar(W*.2,92,W*.6,SC.boss.hp/SC.boss.max,'#ff5c7a','בוס: '+monName(zi,SC.ev?0:SC.fl));}
  {const ww=worldWin();if(ww&&world&&world.key===ww.key&&zi>=0){const y=SC.boss?124:92,tot=world.max-world.hp;
    hpBar(W*.14,y,W*.72,world.hp/world.max,world.dead?'#6fe39a':'#c56bff',world.dead?'בוס העולם הובס!':'בוס העולם · '+world.n+' לוחמים · החלק שלך '+(tot>0?Math.round(world.mine/tot*100):0)+'%');}}
}

/* ---------- arena duel ---------- */
// Pace: levels gained over the last minutes, as experience per hour, kills per minute and time left to the reset.
const pace={q:[],k:0};
function paceTick(){
  if(S&&!demo){const hr=new Date().getHours();if(hr===4)tryEgg('dawn');if(A.kills%10000>=7777&&A.kills%10000<7900)tryEgg('lucky');if(SC.zi<0&&!SC.hero.mv){if((egg.still+=5)>=180)tryEgg('still');}else egg.still=0;}
  if(!S||SC.mode!=='farm')return;const now=Date.now(),lv=S.resets*CAP+S.lvl+(S.lvl>=CAP?0:S.xp/need(S.lvl));
  if(pace.q.length&&(lv<pace.q[pace.q.length-1][1]||lv-pace.q[pace.q.length-1][1]>50))pace.q=[];
  pace.q.push([now,lv,A.kills+pend.kills]);while(pace.q.length>2&&now-pace.q[0][0]>300000)pace.q.shift();
  const a=pace.q[0],dt=(now-a[0])/1000;let t='';
  if(dt>=20&&SC.zi>=0){const lph=(lv-a[1])/dt*3600,kpm=(A.kills+pend.kills-a[2])/dt*60;
    if(lph>0||kpm>0)t=L(fmt(Math.round(kpm)))+' חיסולים בדקה · '+L(lph>=10?Math.round(lph):lph.toFixed(1))+' רמות בשעה'+(S.lvl<CAP&&lph>0?' · ריסט בעוד '+fmtT((CAP-(S.lvl+S.xp/need(S.lvl)))/lph*3600):'');}
  const el=$('paceTag');if(el.dataset.t!==t){el.dataset.t=t;el.innerHTML=t;}el.style.display=t?'':'none';
}
// The side quest picked up on the road, if there is one.
// The gear guide: every tier and set with real numbers, computed from the same formulas the game uses.
function showGuide(){
  const cls=S.cls,main=CLS[cls].main,mk=(sl,t,r,p)=>({s:sl,t:t,r:r,p:p,z:0,af:[]}),arm=(t,r,p)=>{let hp=0,df=0;for(const sl of ['h','a','p','l','b']){const v=itemVals(mk(sl,t,r,p));hp+=v.hp;df+=v.def;}return [hp,df];};
  const myT=S.eq.w?S.eq.w.t:1;let rows='';
  for(let t=1;t<=TIERN.length;t++){let zi=-1;for(let i=0;i<ZONES.length;i++)if(tierOf(i)===t){zi=i;break;}if(zi<0)continue;
    const a0=arm(t,3,0),a15=arm(t,4,15),q=reqOf(mk('w',t,3,0),cls),qa=reqOf(mk('a',t,3,0),cls);
    rows+='<div class="card" style="display:block'+(t===myT?';border-color:var(--gold)':'')+'"><div class="kv"><b style="color:var(--gold)">דרגה '+L(t)+' · '+TIERN[t-1]+'</b><span>'+(ZONES[zi].req?'מפות ריסט':'מ'+zoneName(zi))+'</span></div>'+
      '<div class="kv"><span>סט עתיק</span><b style="color:var(--r4)">'+SETN[t-1]+'</b></div><div class="kv"><span>סט עתיק שני</span><b style="color:var(--r4)">'+SETN2[t-1]+'</b></div>'+
      '<div class="kv"><span>נשק אגדי '+L('+0')+' / '+L('+9')+' / '+L('+15')+'</span><b class="num">'+L(fmt(itemVals(mk('w',t,3,0)).atk)+' / '+fmt(itemVals(mk('w',t,3,9)).atk)+' / '+fmt(itemVals(mk('w',t,3,15)).atk))+'</b></div>'+
      '<div class="kv"><span>נשק עתיק '+L('+15')+'</span><b class="num" style="color:var(--r4)">'+L(fmt(itemVals(mk('w',t,4,15)).atk))+'</b></div>'+
      '<div class="kv"><span>5 חלקי שריון אגדי '+L('+0')+'</span><b class="num">'+L(fmt(a0[0])+' חיים · '+fmt(a0[1])+' הגנה')+'</b></div>'+
      '<div class="kv"><span>סט עתיק מלא '+L('+15')+'</span><b class="num" style="color:var(--r4)">'+L(fmt(a15[0])+' חיים · '+fmt(a15[1])+' הגנה')+'</b></div>'+
      '<div class="kv"><span>דרישות</span><b class="num">'+STATN[main][0]+' '+L(fmt(q[main]))+' · '+STATN.vit[0]+' '+L(fmt(qa.vit))+'</b></div></div>';}
  const up=[6,7,8,9,10,11,12,13,14].map(p=>L('+'+(p+1))+': '+L(Math.round(upChance({p:p})*100)+'%')).join(' · ');
  openModal('<h3 style="color:var(--gold)">מדריך ציוד</h3><div style="display:flex;flex-direction:column;gap:8px;max-height:62vh;overflow-y:auto;text-align:start">'+
    '<div class="card" style="display:block"><b>מה חזק יותר, בקצרה</b><p class="hint" style="margin-top:4px">'+
      '1. <b>נדירות</b> מכפילה את הפריט: '+RAR.map(r=>'<span style="color:'+r.c+'">'+r.n+' ×'+L(r.m)+'</span>').join(' · ')+'.<br>'+
      '2. <b>כל + מוסיף 8%</b>. '+L('+9')+' שווה 72% יותר, ו-'+L('+15')+' שווה 120% יותר.<br>'+
      '3. <b>דרגה אחת למעלה</b> שווה בערך 15% עד 25% לנשק. לכן אגדי '+L('+9')+' מדרגה נמוכה מנצח רגיל '+L('+0')+' משתי דרגות מעליו.<br>'+
      '4. <b>עתיק מול אגדי</b>: עתיק חזק ב-33%, ורק חלקים עתיקים נספרים לסט.<br>'+
      '5. <b>אקסלנט</b> מוסיף אופציות (נזק, קריטי, מהירות ועוד) שלא קיימות בפריט רגיל, ואקסלנט מלא הוא הטוב ביותר באותה דרגה ונדירות.<br>'+
      '6. הכפתור "לבש את הכי חזק" בתיק מחשב את כל זה בשבילך.</p></div>'+
    '<div class="card" style="display:block"><b>בונוס סט עתיק</b><p class="hint" style="margin-top:4px">חלקים עתיקים מאותה דרגה: '+SETB.map(b=>L(b[0])+' חלקים: '+AFF[b[1]][0]+' '+L('+'+b[2]+'%')).join(' · ')+'. הנשק נספר כחלק השישי.</p><p class="hint" style="margin-top:4px">לכל דרגה יש סט שני, של שורדים ומחפשי אוצרות: '+SETB2.map(b=>L(b[0])+' חלקים: '+AFF[b[1]][0]+' '+L('+'+b[2]+'%')).join(' · ')+'. חלקים משני הסטים לא נספרים יחד.</p></div>'+
    '<div class="card" style="display:block"><b style="color:#ffd75e">עתיק מושלם</b><p class="hint" style="margin-top:4px">הפריט הנדיר ביותר במשחק: חלק סט עתיק עם כל האופציות ובסיס חזק ב-'+L(Math.round((PERFECT_M-1)*100)+'%')+'. הוא נופל רק מבוסים, מאלופים ומקומות גבוהות במגדל הנצח, בסיכוי זעום. סט מלא כזה הוא עניין של חודשים.</p></div>'+
    '<div class="card" style="display:block"><b>בונוס אקסלנט מלא</b><p class="hint" style="margin-top:4px">חלקי אקסלנט מלא נספרים לבונוס משלהם, בכל נדירות: '+EXB.map(b=>L(b[0])+' חלקים: '+AFF[b[1]][0]+' '+L('+'+b[2]+'%')).join(' · ')+'. חלק עתיק שהוא גם אקסלנט מלא נספר גם לסט וגם לבונוס הזה.</p></div>'+
    '<div class="card" style="display:block"><b>איפה משיגים חלקי סט</b><p class="hint" style="margin-top:4px">חלק עתיק נופל מכל מפלצת, אבל במפות הריסט הוא נופל פי שלושה. המפלצות שם קשות בהרבה ונותנות פחות ניסיון לדקה, אז הולכים לשם בשביל הסט ולא בשביל רמות. דרגות ציוד 9 ומעלה קיימות רק שם.</p></div>'+
    '<div class="card" style="display:block"><b>חיות מחמד</b><p class="hint" style="margin-top:4px">יוצאות מתיבות, לעיתים רחוקות. חיה לבושה נותנת זהב ושלל, והנדירות גם ניסיון, נזק, חיים ומהירות. היא גם מוכרת בשבילך את מה שמסנן האיסוף משאיר על הרצפה. הזמן שלה מתחיל בלבישה הראשונה.</p></div>'+
    '<div class="card" style="display:block"><b>תכשיטים</b><p class="hint" style="margin-top:4px">שלושה מקומות נוספים: טבעת עוצמה מוסיפה נזק באחוזים, טבעת חיים מוסיפה חיים, ושרשרת נותנת קצת משניהם. הם נופלים לעיתים רחוקות מכל מפלצת, תמיד מאלופים, ומהתיבה של המעגל האחרון. אפשר לשדרג אותם כמו כל פריט, והם לא חלק מסט.</p></div>'+
    '<div class="card" style="display:block"><b>סיכויי שדרוג</b><p class="hint" style="margin-top:4px">עד '+L('+6')+' תמיד מצליח. אחר כך: '+up+'. מ-'+L('+7')+' כישלון מוריד דרגה, אלא אם יש קמע הגנה.</p></div>'+
    '<p class="hint">המספרים לפי המקצוע שלך. הדרגה שהנשק שלך בה מסומנת בזהב.</p>'+rows+
    '</div><div class="acts"><button class="btn pri" data-act="closeModal">סגור</button></div>');
}
// The world boss: one health bar for the whole server.
const worldWin=()=>evWindows(Date.now(),0).find(w=>w.e.world&&w.live);
function loadWorld(){if(!ONLINE||demo||Date.now()-worldAt<8000)return;worldAt=Date.now();rpc('wget',{}).then(j=>{if(j&&j.world!==undefined){world=j.world;panelDirty=true;}}).catch(()=>{});}
function brCard(live){
  const up=ws&&ws.readyState===1,bw=brWindow(Date.now()),d=SC.duel,inb=d&&d.br;
  let h='<p class="hint">נלחמים ביד, עם מהלכי הזירה, מול שחקנים אחרים שמחוברים עכשיו. מקומות ריקים מתמלאים בלוחמים של השרת. מי שלא מחובר, או לא נכנס בזמן, לא משתתף. מקום שני ושלישי מקבלים תיבות ומטבעות, וכל משתתף מקבל 5 מטבעות עונה.</p>';
  if(!ONLINE||demo)return h+'<p class="hint" style="color:var(--bad)">האירוע הזה קיים רק במשחק המחובר לשרת.</p>';
  if(inb)return h+'<p class="hint" style="color:var(--good)">אתה בזירה'+(d.br.phase==='lobby'?' · '+L(d.br.n)+' לוחמים נרשמו':'')+'</p>'+(d.br.phase==='lobby'?'<button class="btn" style="width:100%" data-act="brLeave">צא מהזירה</button>':'');
  {const se=brSign();if(se)return h+'<button class="btn pri glow" style="width:100%" data-act="brJoin"'+(up&&SC.mode==='farm'?'':' disabled')+'>'+(up?'השתגר לזירה · ההרשמה נסגרת בעוד '+L(mmss((se-Date.now())/1000)):'אין חיבור חי לשרת')+'</button>';}
  if(live)return h+'<p class="hint" style="color:var(--bad)">ההרשמה נסגרה. הקרב כבר התחיל.</p>';
  return h;
}
/* ---------- The Last Circle: a live fight of up to eight, held by the server ---------- */
// The field is seen from above at a slant: x runs across, y runs away from the viewer at half scale. The view follows me.
const BRS=()=>Math.min(1,W/430),bP=(x,y)=>{const c=SC.duel.br.cam,k=BRS();return [W/2+(x-c[0])*k,gy()-70+(y-c[1])*k*.55];};
const LOOTN={w:'נשק',a:'שריון',p:'שיקוי',b:'מגפיים',W:'נשק אגדי'},LOOTC={w:'#ffb23e',a:'#5aa9ff',p:'#6fe39a',b:'#7df9ff',W:'#ffd75e'};
const brF=(x,y)=>({x:x,y:y,hp:1,cls:S.cls,at:{atk:0,s0:0,s1:0,s2:0,s3:0,dash:0,pot:0,buf:0,bash:0},stun:0,sh:0,inv:0,bfN:0,wound:0,pots:BR.pots,alive:true,kills:0,w:0,ar:0,bt:0});
function brEnter(n,left,quiet){
  flushTick();
  SC.duel={br:{phase:'lobby',n:n,until:Date.now()+left,looks:[lookOf(S)],names:[S.name],bot:[0],tg:[null],ring:BR.R,cam:[0,0],deadT:[0],loot:[],go:null},D:{f:[brF(0,0)],t:0,T:[1],pool:[1]},me:0,v:[{anim:0,face:1,mv:false,hitT:0}],end:0,sent:false,go:1,holdAtk:false,opp:lookOf(S),posT:0,last:[0,0]};
  SC.mode='duel';SC.fx=[];SC.nums=[];SC.drops=[];SC.hero.dir=0;SC.hero.dz=0;closeModal();renderDuelBar();if(!quiet)toast('הגעת לזירת המעגל האחרון. הקרב מתחיל כשההרשמה נסגרת',4);
}
// An arena fight against a player who is not here is fought on the open round field, by the very rules of the siege and
// the circle. Nobody else is in it, so it is held right here: the same engine the server runs, fed to the same screen.
function startArena(pd){
  brEnter(0,0,true);const d=SC.duel,b=d.br,L=pd.live,B=G.brNew([{id:'me',n:S.name,c:S.cls},{id:'op',n:pd.o.n,c:pd.o.c,bot:true}],Math.random,{b:[L.b[0],L.b[1]],cr:[L.cr[0],L.cr[1]]});
  b.arena={B:B,acc:0,pd:pd};b.ring=BR.DR;d.opp=pd.o;
  brBegin({me:0,f:[{n:S.name,c:S.cls,h:C.hp},Object.assign({},pd.o,{bot:1})],T:B.t,xy:B.f.map(f=>[f.x,f.y]),loot:[]});d.sel=1;{const me=d.D.f[0];for(const k in me.at)me.at[k]=+B.f[0].at[k]||0;me.pots=B.f[0].pots;} // one enemy: he is marked from the start
}
const arenaState=B=>({t:'brS',T:B.t,ring:BR.DR,s:B.f.map(f=>[Math.round(f.x),Math.round(f.y),Math.round(f.hp*1000)/1000,f.alive?1:0,f.sh>B.t?1:0,f.stun>B.t?1:0,f.face<0?-1:1,f.kills,f.inv>B.t?1:0,f.w,f.ar,f.bt,f.pots])});
function arenaNet(m){const d=SC.duel,b=d.br,B=b.arena.B,f=B.f[0];if(b.phase!=='fight'||B.over)return;
  if(m.t==='brLeave'){b.arena.left=1;send('duelEnd',{win:false});return;}
  if(!f.alive||B.t<0)return;
  if(m.t==='brPos'){if(f.stun>B.t||f.pushT>B.t)return;f.x=+m.x||0;f.y=+m.y||0;const r=Math.hypot(f.x,f.y);if(r>BR.DR){f.x*=BR.DR/r;f.y*=BR.DR/r;}f.face=m.f<0?-1:1;return;}
  if(m.t==='brAct'){if(m.f!==undefined)f.face=m.f<0?-1:1;const o=G.brAct(B,0,String(m.k),Math.random,Number.isInteger(m.to)?m.to:-1);if(!o||o.no)return;const out=arenaState(B);out.ev=[o];brState(out);const me=d.D.f[0];for(const k in me.at)me.at[k]=+f.at[k]||0;me.pots=f.pots|0;renderDuelBar();if(B.over)arenaEnd();}}
function arenaTick(dt){const d=SC.duel,b=d.br,a=b.arena,B=a.B;if(b.phase!=='fight'||B.over)return;a.acc+=Math.min(.5,dt);
  while(a.acc>=.1&&!B.over){a.acc-=.1;const ev=G.brStep(B,.1,Math.random),m=arenaState(B);if(ev.length)m.ev=ev;brState(m);}
  if(B.over)arenaEnd();}
async function arenaEnd(){const d=SC.duel;if(!d||!d.br||!d.br.arena||d.sent)return;const b=d.br,B=b.arena.B,me=B.f[0],op=B.f[1],win=me.alive&&(!op.alive||me.hp>=op.hp);
  b.phase='end';d.sent=true;d.holdAtk=false;d.end=3;renderDuelBar();SC.nums.push({x:W/2,y:H*.36,txt:win?'ניצחון!':'הפסד',c:win?'#f2c14e':'#ff5c7a',s:34,life:2.8});snd(win?'rare':'slam');
  const r=await send('duelEnd',{win:win});if(SC.duel!==d)return;b.res={arena:1,win:r&&r.ok?!!r.win:win,gain:r&&r.ok?r.gain|0:0,denied:!!(r&&r.denied)};}
function brBegin(m){
  const d=SC.duel;if(!d||!d.br)return;const b=d.br,fs=Array.isArray(m.f)?m.f:[];d.me=m.me|0;b.phase='fight';d.sel=-1;if(!brBegin.told){brBegin.told=1;toast(DESK?'לחיצה על יריב או מקש Tab מסמנים אותו, והמכות שלך הולכות אליו':'לחיצה על יריב מסמנת אותו, והמכות שלך הולכות אליו',5);}b.looks=[];b.hpv=[];b.names=[];b.bot=[];b.tg=[];b.deadT=[];d.v=[];d.D.f=[];b.go=null;
  b.g=[];b.tag=[];
  fs.forEach((raw,i)=>{const p=G.cleanPlayer('f'+i,raw),xy=m.xy&&m.xy[i]||[0,0];b.g.push(raw.g|0);b.tag.push(String(raw.tag||''));b.looks.push(i===d.me?lookOf(S):p);b.hpv.push(p.h);b.names.push(p.n);b.bot.push(raw.bot?1:0);b.tg.push(null);b.deadT.push(0);
    const f=brF(+xy[0],+xy[1]);f.cls=p.c;f.at={atk:0,s0:1,s1:3,s2:0,s3:8,dash:0,pot:0};d.D.f.push(f);d.v.push({anim:0,face:1,mv:false,hitT:0});});
  b.loot=(m.loot||[]).map(l=>({id:l[0],x:+l[1],y:+l[2],k:String(l[3])}));
  d.D.t=+m.T||-4;d.go=Math.max(.1,-d.D.t);b.cam=[d.D.f[d.me].x,d.D.f[d.me].y];snd('boss');renderDuelBar();
}
function brState(m){
  const d=SC.duel;if(!d||!d.br||d.br.phase==='lobby')return;const b=d.br,D=d.D;D.t=+m.T;if(m.ring!=null)b.ring=+m.ring;if(m.sg&&b.sg)b.sg=m.sg;
  (m.s||[]).forEach((q,i)=>{const f=D.f[i];if(!f||!q)return;const was=f.alive;f.hp=+q[2];f.alive=!!q[3];f.sh=q[4]?D.t+.3:0;f.stun=q[5]?D.t+.3:0;f.kills=q[7]|0;f.inv=q[8]?D.t+.3:0;f.w=q[9]|0;f.ar=q[10]|0;f.bt=q[11]|0;f.pots=q[12]|0;f.bfN=q[13]|0;f.wound=q[14]?D.t+.3:0;if(q[15]!=null){f.rs=q[15]|0;f.rsAt=SC.t;}
    if(i!==d.me){b.tg[i]=[+q[0],+q[1]];d.v[i].face=q[6]<0?-1:1;}
    else if(D.t>(d.noSnap||0)&&Math.hypot(f.x-q[0],f.y-q[1])>320){f.x=+q[0];f.y=+q[1];b.go=null;} // the server did not accept where I think I am
    if(!was&&f.alive){b.deadT[i]=0;if(i===d.me){f.x=+q[0];f.y=+q[1];b.go=null;renderDuelBar();}else{f.x=+q[0];f.y=+q[1];}}
    if(was&&!f.alive){b.deadT[i]=.01;const p=bP(f.x,f.y);burst(p[0],p[1]-40,'#ff5c7a',26);snd('bossdie');if(i===d.me){SC.nums.push({x:W/2,y:H*.4,txt:b.sg?'נפלת':'נפלת',c:'#ff5c7a',s:b.sg?22:30,life:2.2});renderDuelBar();}}});
  for(const o of m.ev||[])brShow(d,o);
}
function brShow(d,o){
  const D=d.D,b=d.br;
  if(b.sg){const gname=g=>g>0?(b.gn&&b.gn[g]||'גילדה'):'אף גילדה',mine=g=>g===b.g[d.me];
    const pn=i=>(b.names[i]||'')+(b.tag[i]?' ['+b.tag[i]+']':'');
    if(o.k==='use'){if(o.c){snd('boss');announce(pn(o.by)+' לוקח את הכתר! 30 שניות עד הכיבוש',true);}else{announce(pn(o.by)+' משתלט על המתג ה'+(o.q?'ימני':'שמאלי'),true);if(!mine(o.g))snd('growl');}return;}
    if(o.k==='buf'){const a=D.f[o.by];if(a){const p=bP(a.x,a.y),c={b:'#ff8a4d',s:'#9fe8ff',h:'#6fe39a'}[o.bk];SC.fx.push({k:'ring',x:p[0],y:p[1]-10,life:.6,c:c,r:SG.buf.r*.5});SC.fx.push({k:'rune',x:p[0],y:p[1]-2,r:80,life:.8,d:.8,c:c});if(mine(b.g[o.by])){if(o.by===d.me)snd('fury');addNum(p[0],p[1]-130,{b:'באף חיים לקבוצה',s:'באף הגנה לקבוצה',h:'באף כוח לקבוצה'}[o.bk],c,true);}}return;}
    if(o.k==='cstop'){announce(o.keep?'ההשתלטות על הכתר נעצרה. הזמן נשמר למנהל, פחות שנייה, כל עוד הוא חי':'ההשתלטות על הכתר נעצרה. הזמן שנצבר אבד',true);snd('slam');return;}
    if(o.k==='swLost'){snd('slam');announce('המתג ה'+(o.q?'ימני':'שמאלי')+' התפנה: מי שהחזיק בו נפל או עזב',true);return;}
    if(o.k==='sw'){snd('boss');announce('המתג ה'+(o.q?'ימני':'שמאלי')+' בידי '+pn(o.by),true);return;}
    if(o.k==='taken'){snd('rare');announce('הטירה נכבשה! הכתר בידי '+gname(o.g),true);if(!calm)SC.fx.push({k:'screen',life:1,d:1,c:'#ffd75e'});return;}
    if(o.k==='buy'){if(o.by===d.me){snd('coin');const p=bP(D.f[d.me].x,D.f[d.me].y);addNum(p[0],p[1]-120,'+ שיקוי','#6fe39a',true);}return;}
    if(o.k==='up'||o.k==='out'||o.k==='down')return;
    if(o.ls){const a=D.f[o.by];if(!a)return;const c0=sgCamp({t:D.t,sg:{gate:b.sg.gate,lsDown:0}}),pa=bP(a.x,a.y),pg=bP(c0[0],c0[1]);d.v[o.by].anim=1;attackFx(a.cls,pa[0],pa[1],d.v[o.by].face,[{x:pg[0],y:pg[1]-10}],o.k!=='atk',CLS[a.cls].c);addNum(pg[0],pg[1]-40,Math.max(1,Math.round(o.dm*100))+'%','#7df9ff',false);if(o.broke){snd('bossdie');burst(pg[0],pg[1]-20,'#7df9ff',40);announce('אבן החיים של התוקפים נהרסה! הם חוזרים מהמחנה הרחוק',true);}return;}
    if(o.gate!=null){const a=D.f[o.by],g=SG.gates[o.gate];if(!a)return;const pa=bP(a.x,a.y),pg=bP((g[0]+g[2])/2,(g[1]+g[3])/2);d.v[o.by].anim=1;attackFx(a.cls,pa[0],pa[1],d.v[o.by].face,[{x:pg[0],y:pg[1]-10}],o.k!=='atk',CLS[a.cls].c);addNum(pg[0],pg[1]-40,Math.max(1,Math.round(o.dm*100))+'%','#ffb23e',false);if(o.broke){snd('bossdie');announce(o.open?'אבני השמירה נפלו: המגן על חדר הכתר נעלם!':SG.stat.indexOf(o.gate)>=0?'אבן שמירה נופצה!':'שער נפרץ!',true);if(!calm)SC.shake=.4;}return;}}
  if(o.k==='spawn'){const l=o.l;if(!b.loot.some(x=>x.id===l[0]))b.loot.push({id:l[0],x:+l[1],y:+l[2],k:String(l[3]),born:SC.t});if(o.big){snd('boss');announce('נשק אגדי נחת במרכז המעגל!',true);}return;}
  if(o.k==='pick'){const it=b.loot.find(x=>x.id===o.id);b.loot=b.loot.filter(x=>x.id!==o.id);const f=D.f[o.by];if(f){const p=bP(f.x,f.y);burst(p[0],p[1]-30,LOOTC[o.it]||'#fff',12);if(o.by===d.me){snd('rare');addNum(p[0],p[1]-120,'+ '+LOOTN[o.it],LOOTC[o.it],true);renderDuelBar();}else if(o.it==='W')addNum(p[0],p[1]-120,b.names[o.by]+' לקח את הנשק האגדי','#ffd75e',true);}return;}
  if(o.k==='ring'){const v=D.f[o.to];if(v){const p=bP(v.x,v.y);addNum(p[0],p[1]-110,b.names[o.to]+' נשרף מחוץ למעגל','#ff5c7a',false);}return;}
  {const a0=D.f[o.by];if(a0&&o.jx){const p0=bP(a0.x,a0.y),c0=CLS[a0.cls].c;a0.x=o.jx[0];a0.y=o.jx[1];if(o.by===d.me){b.go=null;d.last=[a0.x,a0.y];}else b.tg[o.by]=[o.jx[0],o.jx[1]];d.v[o.by].hop=.38;const p1=bP(a0.x,a0.y); // the leap: an arc of light from where he stood to where he lands
    for(let q=0;q<10;q++)SC.parts.push({x:p0[0]+(p1[0]-p0[0])*q/10,y:p0[1]-24-Math.sin(q/10*Math.PI)*70,vx:0,vy:-14,life:.55,c:q%2?'#fff':c0,s:4});SC.fx.push({k:'ring',x:p0[0],y:p0[1]-6,life:.35,c:c0,r:50});}}
  const a=D.f[o.by];if(!a)return;const va=d.v[o.by],pa=bP(a.x,a.y),ax=pa[0],g=pa[1],col=LOOTC[a.w>=3?'W':'w'],k=o.k,cc=CLS[a.cls].c;
  if(k==='s2'){if(o.by===d.me)snd('fury');SC.fx.push({k:'rune',x:ax,y:g-2,r:60,life:.9,d:.9,c:'#9fe8ff'});return;}
  if(k==='dash'){for(let q=0;q<4;q++)SC.parts.push({x:ax,y:g-20-q*14,vx:(Math.random()-.5)*120,vy:0,life:.4,c:'#9fe8ff',s:3});return;}
  if(k==='pot'){burst(ax,g-50,'#6fe39a',o.by===d.me?12:5);return;}
  const v=D.f[o.to];if(!v)return;if(o.by===d.me){if(o.loose&&!d.looseTold){d.looseTold=1;toast(DESK?'מכה בלי יריב מסומן חלשה יותר ואין בה קומבו. לחץ על יריב או Tab כדי לסמן':'מכה בלי יריב מסומן חלשה יותר ואין בה קומבו. גע ביריב כדי לסמן');}d.cbN=o.miss?0:o.cb|0;d.cbAt=D.t;if(d.cbN===2)SC.nums.push({x:ax,y:g-150,txt:'2/3',c:'#ffd75e',s:20,life:.7});}
  if(o.pull){const a0=D.f[o.by],p0=bP(a0.x,a0.y),q0=bP(v.x,v.y);for(const q of [-6,6])SC.fx.push({k:'chain',x1:p0[0],y1:p0[1]-80+q,x2:q0[0],y2:q0[1]-34+q,life:.45,d:.45});burst(q0[0],q0[1]-30,'#ff7a2e',14);}
  if(o.px){const q0=bP(v.x,v.y);if(o.to===d.me){v.x=o.px[0];v.y=o.px[1];b.go=null;d.last=[v.x,v.y];}else b.tg[o.to]=[o.px[0],o.px[1]];const q1=bP(o.px[0],o.px[1]); // thrown back: a streak and dust along the way
    SC.fx.push({k:'line',x1:q0[0],y1:q0[1]-10,x2:q1[0],y2:q1[1]-10,life:.3,c:'#e8d8b8',w:4});for(let q=0;q<7;q++)SC.parts.push({x:q0[0]+(q1[0]-q0[0])*q/7,y:q0[1]-4,vx:(Math.random()-.5)*50,vy:-30-Math.random()*40,life:.5,c:'#d8c8a8',s:3});}
  const pv=bP(v.x,v.y),vx=pv[0],ge=pv[1],big=k!=='atk';va.anim=1;if(Math.abs(v.x-a.x)>4)va.face=v.x>=a.x?1:-1;
  if(k==='s3'&&!(o.by===d.me||o.to===d.me)&&D.f.length>3){SC.fx.push({k:'flash',x:vx,y:ge-40,r:50,life:.25,d:.25,c:cc});SC.fx.push({k:'ring',x:vx,y:ge-6,life:.4,c:cc,r:80});}
  else if(k==='s3'){if(o.by===d.me||o.to===d.me)snd('ult');SC.fx.push({k:'rune',x:vx,y:ge-2,r:120,life:1,d:1,c:cc});SC.fx.push({k:'flash',x:vx,y:ge-40,r:90,life:.35,d:.35,c:cc});SC.fx.push({k:'ring',x:vx,y:ge-6,life:.55,c:cc,r:140});SC.fx.push({k:'ring',x:vx,y:ge-6,life:.8,c:'#fff',r:90});for(let q=-2;q<=2;q++)SC.fx.push({k:'pillar',x:vx+q*28,y:ge,life:.5,d:.5,c:cc});SC.fx.push({k:'star',x:vx,y:ge-40,r:84,rot:.2,life:.45,d:.45,c:'#fff'});}
  else if(k==='bash'){if(o.by===d.me||o.to===d.me)snd('slam');SC.fx.push({k:'ring',x:vx,y:ge-20,life:.4,c:'#ffd75e',r:76});SC.fx.push({k:'flash',x:vx,y:ge-40,r:64,life:.25,d:.25,c:'#ffd75e'});if(!o.miss)addNum(vx,ge-128,o.guard?'המגן עצר':'נהדף','#ffd75e',false);}
  else if(k==='s1'||k==='s0')skillFx(a.cls,k,ax,g,vx,ge,va.face,cc,o.by===d.me||o.to===d.me||D.f.length<=3);
  attackFx(a.cls,ax,g,va.face,[{x:vx,y:ge-10}],big,a.w?col:cc);
  if(o.miss){addNum(vx,ge-110,'חמק!','#9fe8ff',true);return;}
  d.v[o.to].hitT=.18;if(o.by===d.me||o.to===d.me)snd(o.crit?'crit':big?'skill':'hit');if(o.by===d.me||o.to===d.me||D.f.length<=3)addNum(vx,ge-92,fmt(Math.max(1,Math.round(o.dm*(b.sg?(b.hpv&&b.hpv[o.to]||2000)*5:10000)))),o.to===d.me?'#ff5c7a':o.crit?'#ffd75e':'#fff',o.crit||big);
  if(o.stun&&(o.by===d.me||o.to===d.me||D.f.length<=3))addNum(vx,ge-128,'הלם','#ffd75e',false);
  if(o.combo&&!(o.by===d.me||o.to===d.me)&&D.f.length>3){SC.nums.push({x:vx,y:ge-130,txt:'קומבו!',c:'#ff5c7a',s:15,life:.8});SC.fx.push({k:'ring',x:vx,y:ge-10,life:.4,c:'#ffd75e',r:60});}
  else if(o.combo){snd('ult');SC.nums.push({x:vx,y:ge-150,txt:'קומבו!',c:'#ff5c7a',s:W<560?26:36,life:1.2});snd('slam');comboFx((D.f[o.by]||{}).cls,vx,ge,true,ax+(vx>=ax?14:-14),g-92);if(!calm)SC.shake=o.by===d.me||o.to===d.me?.7:.3;}
  else if(b.sg&&o.cb===2&&o.by===d.me)addNum(ax,g-150,'קומבו 2/3','#ffb23e',false);
  if(o.more)for(const x of o.more){const f=D.f[x[0]];if(!f)continue;const p=bP(f.x,f.y);d.v[x[0]].hitT=.18;SC.fx.push({k:'flash',x:p[0],y:p[1]-30,r:26,life:.2,d:.2,c:cc});if(o.by===d.me||x[0]===d.me||D.f.length<=3)addNum(p[0],p[1]-92,fmt(Math.max(1,Math.round(x[1]*(b.sg?(b.hpv&&b.hpv[x[0]]||2000)*5:10000)))),x[3]?'#9fb0c8':x[0]===d.me?'#ff5c7a':'#fff',false);}
  if(o.dead&&!(b.sg&&o.by!==d.me&&o.to!==d.me))addNum(vx,ge-140,b.names[o.by]+' חיסל את '+b.names[o.to],'#ffd75e',true);
}
function brOver(m){
  const d=SC.duel;if(!d||!d.br)return;const b=d.br,pl=m.place|0;b.phase='end';d.sent=true;d.holdAtk=false;d.end=4.5;b.res=m;renderDuelBar();
  if(m.sg){SC.nums.push({x:W/2,y:H*.36,txt:m.win?'הטירה בידי '+m.win:'אף גילדה לא כבשה את הטירה',c:m.won?'#f2c14e':'#c9c2ea',s:24,life:4.4});snd(m.won?'rare':'slam');return;}
  SC.nums.push({x:W/2,y:H*.36,txt:pl===0?'ניצחת במעגל האחרון!':'מקום '+(pl+1)+' מתוך '+(m.n|0),c:pl===0?'#f2c14e':'#c9c2ea',s:pl===0?30:26,life:4.4});snd(pl===0?'rare':'slam');if(pl===0&&!calm)SC.fx.push({k:'screen',life:1,d:1,c:'#ffd75e'});
}
function brExit(msg){const d=SC.duel;if(!d||!d.br)return;$('useBtn').style.display='none';const m=d.br.res;SC.mode='farm';SC.duel=null;SC.fx=[];SC.nums=[];SC.hero.dir=0;SC.hero.dz=0;renderDuelBar();
  if(m&&m.arena){toast(m.denied?'השרת לא אישר את הניצחון':m.win?'ניצחון. הדירוג עלה ב-'+m.gain+', קיבלת 8 מטבעות עונה':'הפסד. הדירוג ירד ב-12');}
  else if(m&&m.sg){toast((m.test?'מצור הידידות נגמר. ':m.won?'הגילדה שלך מחזיקה בטירה. ':'המצור נגמר. ')+'קיבלת '+String(m.rt||''),7);send('sync',{});loadGuild&&loadGuild();}
  else if(m){toast((m.place===0?'ניצחת במעגל האחרון. קיבלת ':'מקום '+((m.place|0)+1)+' במעגל האחרון. קיבלת ')+String(m.rt||''),7);send('sync',{});}else if(msg)toast(msg);touch();}
function selMark(d,tgt,rng){const q=d.sel,f=q>=0?d.D.f[q]:null,me=d.D.f[d.me];if(!f||!f.alive){d.sel=-1;return tgt;}const p=bP(f.x,f.y),a=SC.t*3;ctx.save();ctx.strokeStyle='#ffd75e';ctx.lineWidth=2.5;ctx.setLineDash([7,5]);ctx.lineDashOffset=-a*6;ctx.beginPath();ctx.ellipse(p[0],p[1]+2,34*BRS(),11*BRS(),0,0,7);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#ffd75e';ctx.beginPath();ctx.moveTo(p[0],p[1]-128+Math.sin(a)*3);ctx.lineTo(p[0]-7,p[1]-140+Math.sin(a)*3);ctx.lineTo(p[0]+7,p[1]-140+Math.sin(a)*3);ctx.fill();ctx.restore();return Math.hypot(f.x-me.x,f.y-me.y)<=rng?q:tgt;}
// The next enemy, nearest first: for the Tab key on a computer.
function selNext(){const d=SC.duel;if(!d||!d.br||d.br.phase!=='fight')return;const b=d.br,me=d.D.f[d.me],L=[];d.D.f.forEach((f,i)=>{if(i===d.me||!f.alive||(b.sg&&b.g[i]===b.g[d.me]))return;const q=Math.hypot(f.x-me.x,f.y-me.y);if(q<520)L.push([q,i]);});if(!L.length){d.sel=-1;return;}L.sort((x,y)=>x[0]-y[0]);const at=L.findIndex(x=>x[1]===d.sel);d.sel=L[(at+1)%L.length][1];snd('click');}
function brTap(px,py){ // a tap on an enemy chooses him as the one to strike; a tap on the field walks there
  const d=SC.duel,b=d.br,k=BRS();
  if(b.phase==='fight'){let hit=-1,bd=58;d.D.f.forEach((f,i)=>{if(i===d.me||!f.alive||(b.sg&&b.g[i]===b.g[d.me]))return;const p=bP(f.x,f.y),q=Math.hypot(px-p[0],py-(p[1]-40));if(q<bd){bd=q;hit=i;}});
    if(hit>=0){d.sel=d.sel===hit?-1:hit;snd('click');const p=bP(d.D.f[hit].x,d.D.f[hit].y);SC.fx.push({k:'ring',x:p[0],y:p[1],life:.3,c:'#ffd75e',r:40});return;}}b.go=[b.cam[0]+(px-W/2)/k,b.cam[1]+(py-(gy()-70))/(k*.55)];SC.fx.push({k:'ring',x:px,y:py,life:.3,c:'#7df9ff',r:26});
}
function updateBr(dt){
  const d=SC.duel,b=d.br,D=d.D,me=D.f[d.me],vm=d.v[d.me];
  for(const v of d.v){v.anim=Math.max(0,v.anim-dt*3.2);v.hitT=Math.max(0,v.hitT-dt);v.hop=Math.max(0,(v.hop||0)-dt);}
  for(let i=0;i<b.deadT.length;i++)if(b.deadT[i]>0)b.deadT[i]+=dt;
  if(b.phase==='end'){if((d.end-=dt)<=0)brExit();return;}
  if(b.phase==='fight'){D.t+=dt;if(d.go>0&&D.t>=0){d.go=0;renderDuelBar();snd('boss');}if(b.arena)arenaTick(dt);if(b.phase!=='fight')return;}
  vm.mv=false;
  if(me.alive&&me.stun<=D.t&&(b.phase==='lobby'||D.t>=0)){
    let vx=SC.hero.dir,vy=SC.hero.dz;if(joy.v[0]||joy.v[1]){vx=joy.v[0];vy=joy.v[1];}if(vx||vy)b.go=null;else if(b.go){const gx=b.go[0]-me.x,gy2=b.go[1]-me.y,gd=Math.hypot(gx,gy2);if(gd<8)b.go=null;else{vx=gx/gd;vy=gy2/gd;}}
    if(vx||vy){const n=Math.hypot(vx,vy),sp=BR.spd*(1+.12*(me.bt|0))*dt;if(b.sg){me.g=b.g[d.me];sgMove({sg:b.sg},me,me.x+vx/n*sp,me.y+vy/n*sp);}else{me.x+=vx/n*sp;me.y+=vy/n*sp;const r=Math.hypot(me.x,me.y),lim=b.arena?BR.DR:b.phase==='lobby'?240:BR.R;if(r>lim){me.x*=lim/r;me.y*=lim/r;}}vm.mv=true;if(Math.abs(vx)>.15)vm.face=vx>0?1:-1;}}
  if(b.phase==='fight'){
    if(d.q){if(D.t>d.q.until||!me.alive)d.q=null;else if(me.at[d.q.k]<=D.t){const k=d.q.k;d.q=null;duelAct(k);}}
    else if(d.holdAtk||b.auto)duelAct('atk');
    if(me.alive&&(d.posT-=dt)<=0&&(Math.abs(me.x-d.last[0])>.5||Math.abs(me.y-d.last[1])>.5)){d.posT=.08;d.last=[me.x,me.y];netSend({t:b.sg?'sgPos':'brPos',x:Math.round(me.x),y:Math.round(me.y),f:vm.face});}
    D.f.forEach((f,i)=>{if(i===d.me)return;const tg=b.tg[i],v=d.v[i];v.mv=false;if(tg&&f.alive){const ex=tg[0]-f.x,ey=tg[1]-f.y;if(Math.abs(ex)>1||Math.abs(ey)>1){f.x+=ex*Math.min(1,dt*10);f.y+=ey*Math.min(1,dt*10);v.mv=Math.hypot(ex,ey)>4;}}});
  }
  {const ub=$('useBtn');let t='';if(b.sg&&me.alive&&b.phase==='fight'){const near=(p)=>Math.abs(me.x-p[0])<SG.zone&&Math.abs(me.y-p[1])<SG.zone,S2=b.sg;SG.sw.forEach((p,q)=>{if(near(p)&&!(S2.swn&&S2.swn[q])&&!(S2.swp[q][1]>0))t='לחץ כדי להשתלט על המתג';});if(near(SG.crown)&&!(S2.crown[1]>0)&&b.g[d.me]!==S2.holder)t=b.lead?'לחץ כדי לקחת את הכתר':'רק מנהל הגילדה לוקח את הכתר';}
    if(ub.textContent!==t)ub.textContent=t;ub.style.display=t?'':'none';}
  // the view follows me, or the middle of the circle once I am out
  const fx=me.alive||b.phase==='lobby'?me.x:0,fy=me.alive||b.phase==='lobby'?me.y:0;b.cam[0]+=(fx-b.cam[0])*Math.min(1,dt*7);b.cam[1]+=(fy-b.cam[1])*Math.min(1,dt*7);
  if((d.bt=(d.bt||0)+dt)>(b.sg?.08:DESK?.1:.25)){d.bt=0;renderDuelBar();if(tab==='pass'&&b.phase==='lobby')panelDirty=true;}
}
function drawSg(dt){
  const d=SC.duel,b=d.br,D=d.D,k=BRS(),sc=clamp(H/300,.8,1.45)*.74,me=D.f[d.me],S2=b.sg,myG=b.g[d.me],R=(r)=>{const p0=bP(r[0],r[1]),p1=bP(r[2],r[3]);return [p0[0],p0[1],p1[0]-p0[0],p1[1]-p0[1]];},gc=g=>g===myG?'#6fe39a':g>0?'#ff5c7a':'#d9c48a';
  ctx.save();ctx.fillStyle='rgba(8,6,20,.6)';ctx.fillRect(0,0,W,H);
  {const f=R([-SG.W/2,SG.Y0,SG.W/2,SG.Y1]);const gr=ctx.createLinearGradient(0,f[1],0,f[1]+f[3]);gr.addColorStop(0,'rgba(60,50,110,.85)');gr.addColorStop(1,'rgba(40,70,60,.8)');ctx.fillStyle=gr;ctx.fillRect(f[0],f[1],f[2],f[3]);ctx.strokeStyle='rgba(255,215,94,.5)';ctx.lineWidth=2;ctx.strokeRect(f[0],f[1],f[2],f[3]);
    const y=R(SG.hall);ctx.fillStyle='rgba(120,104,150,.5)';ctx.fillRect(y[0],y[1],y[2],y[3]); // the yard
    ctx.strokeStyle='rgba(255,255,255,.06)';ctx.lineWidth=1;for(let x=-SG.W/2;x<=SG.W/2;x+=100){const a=bP(x,SG.Y0),c=bP(x,SG.Y1);ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(c[0],c[1]);ctx.stroke();}for(let yy=SG.Y0;yy<=SG.Y1;yy+=100){const a=bP(-SG.W/2,yy),c=bP(SG.W/2,yy);ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(c[0],c[1]);ctx.stroke();}}
  for(const sh of SG.shops){const p=bP(sh[0],sh[1]);ctx.fillStyle='rgba(111,227,154,.18)';ctx.strokeStyle='#6fe39a';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(p[0],p[1],SG.shopR*k,SG.shopR*k*.55,0,0,7);ctx.fill();ctx.stroke();label('שיקויים · '+SG.potPack+' ב-'+SG.potPrice*SG.potPack+' זהב',p[0],p[1]-6,'#6fe39a',10);}
  {const ls=S2.ls||[1,0],c1=sgCamp({t:0,sg:{gate:S2.gate,lsDown:0}}),c0=ls[1]>0?SG.camp:c1,p=bP(c0[0],c0[1]);ctx.strokeStyle='#ffd75e';ctx.lineWidth=1.5;ctx.setLineDash([6,5]);ctx.beginPath();ctx.ellipse(p[0],p[1],60*k,60*k*.55,0,0,7);ctx.stroke();ctx.setLineDash([]);label('מחנה התוקפים',p[0],p[1]-6,'#ffd75e',10);
    if(c1!==SG.camp){const q=bP(c1[0],c1[1]);if(ls[1]>0)label('אבן החיים נהרסה · חוזרת בעוד '+ls[1]+' שניות',q[0],q[1]-6,'#8f88b8',10);else{const yy=q[1]-34*k+Math.sin(SC.t*2)*3;ctx.save();ctx.fillStyle='#7df9ff';ctx.shadowColor='#7df9ff';ctx.shadowBlur=14;ctx.beginPath();ctx.moveTo(q[0],yy-16*k);ctx.lineTo(q[0]+9*k,yy);ctx.lineTo(q[0],yy+16*k);ctx.lineTo(q[0]-9*k,yy);ctx.closePath();ctx.fill();ctx.restore();hpBar(q[0]-24,q[1]-64*k-8,48,ls[0],'#7df9ff');label('אבן החיים',q[0],q[1]-64*k-14,'#9fe8ff',10);}}}
  SG.sw.forEach((s,q)=>{const p=bP(s[0],s[1]),c=gc(S2.sw[q]),pr=S2.swp[q];ctx.fillStyle=c;ctx.globalAlpha=.25+.1*Math.sin(SC.t*4);ctx.beginPath();ctx.ellipse(p[0],p[1],SG.zone*k,SG.zone*k*.55,0,0,7);ctx.fill();ctx.globalAlpha=1;ctx.strokeStyle=c;ctx.lineWidth=2.5;ctx.stroke();
    if(pr[1]>0){ctx.strokeStyle=gc(pr[0]);ctx.lineWidth=4;ctx.beginPath();ctx.ellipse(p[0],p[1],SG.zone*k,SG.zone*k*.55,0,-1.57,-1.57+6.283*pr[1]/SG.swT);ctx.stroke();}label('מתג '+(q?'ימני':'שמאלי'),p[0],p[1]-8,c,10.5);{const n=S2.swn&&S2.swn[q];label(n?'מחזיק: '+n[0]+(n[1]?' ['+n[1]+']':''):'פנוי',p[0],p[1]+16,n?c:'#8f88b8',10);}});
  {const p=bP(SG.crown[0],SG.crown[1]),c=gc(S2.holder),pr=S2.crown;ctx.fillStyle='#ffd75e';ctx.globalAlpha=.3+.12*Math.sin(SC.t*3);ctx.beginPath();ctx.ellipse(p[0],p[1],SG.zone*k,SG.zone*k*.55,0,0,7);ctx.fill();ctx.globalAlpha=1;ctx.strokeStyle='#ffd75e';ctx.lineWidth=2.5;ctx.stroke();
    if(pr[1]>0){ctx.strokeStyle=gc(pr[0]);ctx.lineWidth=5;ctx.beginPath();ctx.ellipse(p[0],p[1],SG.zone*k,SG.zone*k*.55,0,-1.57,-1.57+6.283*pr[1]/SG.crownT);ctx.stroke();}
    ctx.fillStyle='#ffd75e';ctx.shadowColor='#ffd75e';ctx.shadowBlur=12;const cy=p[1]-22+Math.sin(SC.t*2)*3;ctx.beginPath();ctx.moveTo(p[0]-14,cy+8);ctx.lineTo(p[0]-14,cy-4);ctx.lineTo(p[0]-7,cy+2);ctx.lineTo(p[0],cy-9);ctx.lineTo(p[0]+7,cy+2);ctx.lineTo(p[0]+14,cy-4);ctx.lineTo(p[0]+14,cy+8);ctx.closePath();ctx.fill();ctx.shadowBlur=0;label('הכתר',p[0],p[1]+16,'#ffd75e',10.5);}
  // walls cast forward so they read as standing stone; gates show how much is left of them
  const wall=(r,col,top)=>{const q=R(r),h=26*k;ctx.fillStyle='rgba(20,16,36,.9)';ctx.fillRect(q[0],q[1]-h,q[2],q[3]+h);ctx.fillStyle=col;ctx.fillRect(q[0],q[1]-h,q[2],q[3]);ctx.fillStyle=top;ctx.fillRect(q[0],q[1]-h+q[3],q[2],h);};
  for(const w of SG.walls)wall(w,'#8d86a8','#5d5878');
  const shUp=SG.stat.some(q=>S2.gate[q]>0);
  if(shUp){const q=R(SG.shield),hh=70*k;ctx.save();ctx.globalAlpha=.3+.12*Math.sin(SC.t*3);ctx.fillStyle='#7df9ff';ctx.fillRect(q[0],q[1]-hh,q[2],q[3]+hh);ctx.globalAlpha=.9;ctx.strokeStyle='#bff';ctx.lineWidth=2;ctx.strokeRect(q[0],q[1]-hh,q[2],q[3]+hh);ctx.restore();label('מגן המגדל',q[0]+q[2]/2,q[1]-hh-6,'#9fe8ff',10.5);}
  SG.gates.forEach((g,q)=>{const hp=S2.gate[q],st=SG.stat.indexOf(q)>=0;if(hp>0)wall(g,st?'#7df9ff':'#b98a4a',st?'#3a8aa8':'#7a5a2e');const p=bP((g[0]+g[2])/2,(g[1]+g[3])/2);if(hp>0)hpBar(p[0]-24,p[1]-44*k-14,48,hp,st?'#7df9ff':'#ffb23e');if(st&&hp<=0)return;label(st?'אבן שמירה':hp>0?'שער':'שער פרוץ',p[0],p[1]-44*k-20,hp>0?(st?'#9fe8ff':'#ffb23e'):'#8f88b8',10);});
  ctx.restore();
  let tgt=-1;if(me.alive){const rng=LIVE_RNG[me.cls]+14;let bd=1e9;D.f.forEach((f,i)=>{if(i===d.me||!f.alive||b.g[i]===myG||!G.inFront({x:me.x,face:d.v[d.me].face},f))return;const q=Math.hypot(f.x-me.x,f.y-me.y);if(q<=rng&&q<bd){bd=q;tgt=i;}});tgt=selMark(d,tgt,rng);
    const p=bP(me.x,me.y);ctx.strokeStyle='rgba(125,249,255,.22)';ctx.lineWidth=1;ctx.setLineDash([5,6]);ctx.beginPath();ctx.ellipse(p[0],p[1],rng*k,rng*k*.55,0,0,7);ctx.stroke();ctx.setLineDash([]);}
  if(b.go&&me.alive){const p=bP(b.go[0],b.go[1]);ctx.strokeStyle='rgba(125,249,255,.6)';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(p[0],p[1],9,4,0,0,7);ctx.stroke();}
  const ord=D.f.map((_,i)=>i).sort((p,q)=>D.f[p].y-D.f[q].y);
  for(const i of ord){const a=D.f[i],v=d.v[i];if(!a.alive&&!(b.deadT[i]>0&&b.deadT[i]<1.6))continue;const dead=a.alive?0:b.deadT[i],p=bP(a.x,a.y),ax=p[0],ya=p[1]-(v.hop>0?Math.sin(Math.PI*(1-v.hop/.38))*70:0);if(ax<-80||ax>W+80||ya<-40||ya>H+140)continue;const x=ax+(v.hitT>.1?(Math.random()-.5)*2.5:0),c=i===d.me?'#7df9ff':gc(b.g[i]);
    ctx.fillStyle='rgba(0,0,0,.4)';ctx.beginPath();ctx.ellipse(ax,ya+2,20*sc,6*sc,0,0,7);ctx.fill();
    ctx.strokeStyle=i===tgt?'#ff5c7a':c;ctx.globalAlpha=i===tgt||i===d.me?.95:.55;ctx.lineWidth=i===tgt?2.5:1.5;ctx.beginPath();ctx.ellipse(ax,ya+2,26*sc,8*sc,0,0,7);ctx.stroke();ctx.globalAlpha=1;
    if(a.sh>D.t){ctx.save();ctx.globalCompositeOperation='lighter';ctx.strokeStyle='#9fe8ff';ctx.globalAlpha=.6;ctx.lineWidth=2.5;ctx.beginPath();ctx.ellipse(ax,ya-44*sc,28*sc,48*sc,0,0,7);ctx.stroke();ctx.restore();}
    ctx.save();if(a.inv>D.t)ctx.globalAlpha=.45;LITE=(i!==d.me?D.f.length>3:D.f.length>10)&&!window.EC_FULLFX;drawHero(x,ya,sc,b.looks[i],SC.t+i*1.7,v.anim,v.face<0,dead>0?Math.max(.01,dead):0,v.mv,false);LITE=false;ctx.restore();
    if(dead>0)continue;const top=ya-134*sc;hpBar(ax-26,top,52,a.hp,b.g[i]===myG?'#6fe39a':'#ff5c7a');label((b.tag[i]?'['+b.tag[i]+'] ':'')+b.names[i],ax,top-6,c,10.5);if(a.stun>D.t)label('✦',ax,top-20,'#ffd75e',12);}
  drawFx(dt);
  {const mw=58,mh=102,mx=W-mw-8,my=62,qx=mw/SG.W,qy=mh/(SG.Y1-SG.Y0),M=(x,y)=>[mx+mw/2+x*qx,my+(y-SG.Y0)*qy];ctx.save();ctx.fillStyle='rgba(8,6,20,.75)';ctx.strokeStyle='rgba(255,215,94,.6)';ctx.lineWidth=1.5;ctx.fillRect(mx,my,mw,mh);ctx.strokeRect(mx,my,mw,mh);
    ctx.fillStyle='#8d86a8';for(const w of SG.walls){const a=M(w[0],w[1]),c2=M(w[2],w[3]);ctx.fillRect(a[0],a[1],Math.max(1.5,c2[0]-a[0]),Math.max(1.5,c2[1]-a[1]));}SG.sw.forEach((s,q)=>{const p=M(s[0],s[1]);ctx.fillStyle=gc(S2.sw[q]);ctx.fillRect(p[0]-2.5,p[1]-2.5,5,5);});{const p=M(SG.crown[0],SG.crown[1]);ctx.fillStyle='#ffd75e';ctx.fillRect(p[0]-3,p[1]-3,6,6);}
    D.f.forEach((f,i)=>{if(!f.alive)return;const p=M(f.x,f.y);ctx.fillStyle=i===d.me?'#7df9ff':gc(b.g[i]);ctx.beginPath();ctx.arc(p[0],p[1],i===d.me?2.8:1.9,0,7);ctx.fill();});ctx.restore();}
  const hn=S2.holder>0?(b.gn&&b.gn[S2.holder]||'גילדה'):'אף גילדה';
  if(W>=560){const n=D.f[d.me].bfN|0,bf=[n&1?'חיים':'',n&2?'הגנה':'',n&4?'כוח':'',n===7?'מהירות':''].filter(Boolean);label(bf.length?'באפים עליך: '+bf.join(' · '):'אין עליך באפים. עמדו קרוב זה לזה והפעילו אותם',W/2,82,bf.length?'#9fe8ff':'#b9b3d6',10);}
  SG.sw.forEach((s,q)=>{const pr=S2.swp[q];if(pr[1]>0&&S2.crown[1]<=0){const bw=W*.5,bx=W/2-bw/2,by=H*.24+q*30;label((pr[0]===myG?'משתלטים על המתג ה':'האויב משתלט על המתג ה')+(q?'ימני':'שמאלי'),W/2,by-4,gc(pr[0]),13);ctx.fillStyle='rgba(0,0,0,.6)';ctx.fillRect(bx,by,bw,8);ctx.fillStyle=gc(pr[0]);ctx.fillRect(bx,by,bw*clamp(pr[1]/SG.swT,0,1),8);}});
  if(S2.crown[1]>0){const bw=W*.6,bx=W/2-bw/2,by=H*.26+8;ctx.fillStyle='rgba(0,0,0,.6)';ctx.fillRect(bx,by,bw,10);ctx.fillStyle=gc(S2.crown[0]);ctx.fillRect(bx,by,bw*clamp(S2.crown[1]/SG.crownT,0,1),10);}
  label((b.test?'מצור ידידות':'מצור הטירה')+' · '+mmss(S2.left),W/2,30,'#ffd75e',13);label('מחזיקים בטירה: '+hn,W/2,48,gc(S2.holder),11);
  if(S2.crown[1]>0)label('הכתר נכבש: '+Math.ceil(SG.crownT-S2.crown[1])+' שניות',W/2,H*.26,gc(S2.crown[0]),15);
  else if(W<560&&D.t>20){}
  else if(me.alive&&myG!==S2.holder)label(S2.sw[0]===myG&&S2.sw[1]===myG?'שני המתגים שלכם. מנהל הגילדה לוקח את הכתר!':'שני חברים מחזיקים את שני המתגים, ומנהל הגילדה לוקח את הכתר',W/2,66,'#dfe6f5',10.5);
  else if(me.alive)label('הגנו על המתגים ועל הכתר עד סוף הזמן',W/2,66,'#dfe6f5',10.5);
  if(!me.alive){const left=Math.max(0,Math.ceil((me.rs|0)-(SC.t-(me.rsAt||SC.t))));label(left>0?'נפלת. חוזרים לקרב בעוד '+left+' שניות':'חוזרים לקרב בעוד רגע',W/2,H*.3,'#ff5c7a',16);if(myG===S2.holder&&left>0)label('מגיני הטירה חוזרים בתוך החומות, אחרי המתנה ארוכה יותר',W/2,H*.3+20,'#c9c2ea',11);}
}
function drawBr(dt){
  if(SC.duel.br.sg)return drawSg(dt);
  const d=SC.duel,b=d.br,D=d.D,k=BRS(),sc=clamp(H/300,.8,1.45)*.78,me=D.f[d.me],c0=bP(0,0),RX=BR.R*k,RY=BR.R*k*.55;
  ctx.save();
  { // the plain: one wide disc, rings and spokes to read distance by, and scattered stones that give movement something to pass
    ctx.fillStyle='rgba(8,6,20,.55)';ctx.fillRect(0,0,W,H);
    const gr=ctx.createRadialGradient(c0[0],c0[1],10,c0[0],c0[1],RX);gr.addColorStop(0,'rgba(96,74,160,.75)');gr.addColorStop(1,'rgba(44,34,92,.8)');ctx.fillStyle=gr;ctx.beginPath();ctx.ellipse(c0[0],c0[1],RX,RY,0,0,7);ctx.fill();
    ctx.strokeStyle='rgba(255,215,94,.13)';ctx.lineWidth=1;for(let r=100;r<BR.R;r+=100){ctx.beginPath();ctx.ellipse(c0[0],c0[1],r*k,r*k*.55,0,0,7);ctx.stroke();}
    for(let a=0;a<12;a++){const an=a*.5236;ctx.beginPath();ctx.moveTo(c0[0],c0[1]);ctx.lineTo(c0[0]+Math.cos(an)*RX,c0[1]+Math.sin(an)*RY);ctx.stroke();}
    ctx.strokeStyle='rgba(255,215,94,.55)';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(c0[0],c0[1],RX,RY,0,0,7);ctx.stroke();
    for(let i=0;i<70;i++){const a=i*2.399,r=Math.sqrt((i*37%70)/70)*BR.R*.97,p=bP(Math.cos(a)*r,Math.sin(a)*r);if(p[0]<-20||p[0]>W+20||p[1]<-10||p[1]>H+10)continue;ctx.fillStyle=i%3?'rgba(20,14,44,.55)':'rgba(150,130,210,.35)';ctx.beginPath();ctx.ellipse(p[0],p[1],(5+i%5)*k,(2.5+i%3)*k,0,0,7);ctx.fill();}
  }
  if(b.phase!=='lobby'){ // outside the circle the ground burns
    const rx=b.ring*k,ry=b.ring*k*.55,a=.3+.08*Math.sin(SC.t*5);ctx.save();ctx.beginPath();ctx.rect(0,0,W,H);ctx.ellipse(c0[0],c0[1],rx,ry,0,0,7);ctx.fillStyle='rgba(255,50,80,'+a+')';ctx.fill('evenodd');
    ctx.strokeStyle='#ff5c7a';ctx.shadowColor='#ff5c7a';ctx.shadowBlur=14;ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(c0[0],c0[1],rx,ry,0,0,7);ctx.stroke();ctx.restore();}
  for(const l of b.loot){const p=bP(l.x,l.y);if(p[0]<-30||p[0]>W+30||p[1]<-30||p[1]>H+30)continue;const c=LOOTC[l.k],bob=Math.sin(SC.t*4+l.id)*3,big=l.k==='W'?1.6:1,y=p[1]-12*big+bob;
    ctx.save();ctx.globalCompositeOperation='lighter';ctx.fillStyle=c;ctx.globalAlpha=.3+.15*Math.sin(SC.t*5+l.id);ctx.beginPath();ctx.ellipse(p[0],p[1],16*big,6*big,0,0,7);ctx.fill();if(l.k==='W'){ctx.globalAlpha=.25;ctx.fillRect(p[0]-3,p[1]-160,6,160);}ctx.restore();
    ctx.fillStyle=c;ctx.strokeStyle='#fff';ctx.lineWidth=1.2;ctx.shadowColor=c;ctx.shadowBlur=10;ctx.beginPath();ctx.moveTo(p[0],y-9*big);ctx.lineTo(p[0]+8*big,y);ctx.lineTo(p[0],y+9*big);ctx.lineTo(p[0]-8*big,y);ctx.closePath();ctx.fill();ctx.stroke();ctx.shadowBlur=0;
    label(LOOTN[l.k],p[0],y-14*big,c,9.5);}
  ctx.restore();
  // whom my next hit would reach
  let tgt=-1;if(b.phase==='fight'&&me.alive){const rng=(b.arena?LIVE_RNG[me.cls]:BR.rng)+14;let bd=1e9;D.f.forEach((f,i)=>{if(i===d.me||!f.alive||!G.inFront({x:me.x,face:d.v[d.me].face},f))return;const q=Math.hypot(f.x-me.x,f.y-me.y);if(q<=rng&&q<bd){bd=q;tgt=i;}});tgt=selMark(d,tgt,rng);
    const p=bP(me.x,me.y);ctx.strokeStyle='rgba(125,249,255,.22)';ctx.lineWidth=1;ctx.setLineDash([5,6]);ctx.beginPath();ctx.ellipse(p[0],p[1],rng*k,rng*k*.55,0,0,7);ctx.stroke();ctx.setLineDash([]);}
  if(b.go&&me.alive){const p=bP(b.go[0],b.go[1]);ctx.strokeStyle='rgba(125,249,255,.6)';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(p[0],p[1],9,4,0,0,7);ctx.stroke();}
  const ord=D.f.map((_,i)=>i).sort((p,q)=>D.f[p].y-D.f[q].y);
  for(const i of ord){const a=D.f[i],v=d.v[i],dead=b.deadT[i]||0;if(dead>1.6)continue;const p=bP(a.x,a.y),ax=p[0],ya=p[1]-(v.hop>0?Math.sin(Math.PI*(1-v.hop/.38))*70:0);if(ax<-80||ax>W+80||ya<-40||ya>H+140)continue;const x=ax+(v.hitT>.1?(Math.random()-.5)*2.5:0);
    ctx.fillStyle='rgba(0,0,0,.4)';ctx.beginPath();ctx.ellipse(ax,ya+2,20*sc,6*sc,0,0,7);ctx.fill();
    if(i===d.me&&a.alive){ctx.strokeStyle='rgba(125,249,255,.75)';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(ax,ya+2,26*sc,8*sc,0,0,7);ctx.stroke();}
    if(i===tgt){ctx.strokeStyle='#ff5c7a';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(ax,ya+2,28*sc,9*sc,0,0,7);ctx.stroke();}
    if(a.sh>D.t){ctx.save();ctx.globalCompositeOperation='lighter';ctx.strokeStyle='#9fe8ff';ctx.shadowColor='#9fe8ff';ctx.shadowBlur=12;ctx.globalAlpha=.6;ctx.lineWidth=2.5;ctx.beginPath();ctx.ellipse(ax,ya-44*sc,28*sc,48*sc,0,0,7);ctx.stroke();ctx.restore();}
    ctx.save();if(a.inv>D.t)ctx.globalAlpha=.45;LITE=(i!==d.me?D.f.length>3:D.f.length>10)&&!window.EC_FULLFX;drawHero(x,ya,sc,b.looks[i],SC.t+i*1.7,v.anim,v.face<0,dead>0?Math.max(.01,dead):0,v.mv,a.w>=3);LITE=false;ctx.restore();
    if(dead>0)continue;const top=ya-134*sc;hpBar(ax-26,top,52,a.hp,i===d.me?'#6fe39a':'#ff5c7a');label(b.names[i]+(a.kills?' · '+a.kills:''),ax,top-6,i===d.me?'#7df9ff':b.bot[i]?'#c9c2ea':'#ffd75e',10.5);
    for(let q=0;q<a.w;q++){ctx.fillStyle=LOOTC.w;ctx.fillRect(ax-26+q*6,top+10,4,4);}for(let q=0;q<a.ar;q++){ctx.fillStyle=LOOTC.a;ctx.fillRect(ax+22-q*6,top+10,4,4);}
    if(a.stun>D.t)label('✦',ax,top-20,'#ffd75e',12);}
  drawFx(dt);
  { // a small map: the circle, the finds, the others
    const mr=34,mx=W-mr-10,my=96,q=mr/BR.R;ctx.save();ctx.fillStyle='rgba(8,6,20,.7)';ctx.strokeStyle='rgba(255,215,94,.6)';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(mx,my,mr,0,7);ctx.fill();ctx.stroke();
    if(b.phase!=='lobby'){ctx.strokeStyle='#ff5c7a';ctx.beginPath();ctx.arc(mx,my,Math.max(2,b.ring*q),0,7);ctx.stroke();}
    for(const l of b.loot){ctx.fillStyle=LOOTC[l.k];ctx.fillRect(mx+l.x*q-1,my+l.y*q-1,l.k==='W'?4:2,l.k==='W'?4:2);}
    D.f.forEach((f,i)=>{if(!f.alive)return;ctx.fillStyle=i===d.me?'#7df9ff':'#ff5c7a';ctx.beginPath();ctx.arc(mx+f.x*q,my+f.y*q,i===d.me?3:2.2,0,7);ctx.fill();});ctx.restore();}
  const alive=D.f.filter(f=>f.alive).length;
  if(b.phase==='lobby'){label('זירת המעגל האחרון',W/2,34,'#ffd75e',14);label(b.n+' לוחמים נרשמו · הקרב מתחיל בעוד '+mmss(Math.max(0,(b.until-Date.now())/1000)),W/2,54,'#c9c2ea',11);label('כולם מתחילים שווים. מי שמוצא ציוד מהר יותר, מנצח',W/2,72,'#8f88b8',10);}
  else if(b.arena){label('זירה · מול '+(b.names[1]||''),W/2,34,'#ffd75e',13);label(D.t<0?'מתחילים בעוד '+Math.ceil(-D.t):mmss(Math.max(0,BR.DT-D.t)),W/2,52,'#c9c2ea',11);const op=D.f[1];if(op)label('שיקויים: שלך '+(me.pots|0)+' · שלו '+(op.pots|0),W/2,70,'#dfe6f5',10.5);}
  else{label('המעגל האחרון · נותרו '+alive,W/2,34,'#ffd75e',13);label(D.t<0?'מתחילים בעוד '+Math.ceil(-D.t):mmss(Math.max(0,BR.TIME-D.t))+(me.alive?'':' · אתה צופה'),W/2,52,'#c9c2ea',11);
    if(me.alive)label('נשק '+me.w+'/'+BR.wMax+' · שריון '+me.ar+'/'+BR.aMax+' · מגפיים '+me.bt+'/'+BR.bMax,W/2,70,'#dfe6f5',10.5);
    if(me.alive&&D.t>=0&&Math.hypot(me.x,me.y)>b.ring)label('אתה מחוץ למעגל! רוץ פנימה',W/2,H*.3,'#ff5c7a',15);
    else if(me.alive&&D.t>=0&&D.t<6)label('רוץ לאסוף ציוד. כולם שווים עד שמוצאים משהו',W/2,H*.3,'#7df9ff',12);}
}
const wGot={}; // world boss prizes collected in this visit, by fight
function worldCard(w,live){
  if(!ONLINE)return '<p class="hint">בוס העולם קיים רק במצב מקוון.</p>';
  if(!world||!w||world.key!==w.key)return live?'<p class="hint">טוען את מצב הקרב...</p>':'';
  const tot=world.max-world.hp,sh=tot>0?world.mine/tot:0,over=!live||world.dead,rank=world.top.findIndex(t=>t.d<=world.mine)+1;
  let h='<div class="bar'+(world.dead?' gold':'')+'" style="margin:8px 0 6px"><i style="width:'+(world.hp/world.max*100)+'%;background:#c56bff"></i></div><div class="kv"><span>'+(world.dead?'הבוס הובס':'חיים')+'</span><b class="num">'+L(fmt(Math.round(world.hp))+'/'+fmt(Math.round(world.max)))+'</b></div>'+
    '<div class="kv"><span>החלק שלך בנזק</span><b class="num" style="color:var(--gold)">'+L(Math.round(sh*100)+'%')+'</b></div>'+
    world.top.map((t,i)=>'<div class="kv"><span>'+L(i+1)+'. '+esc(t.n)+'</span><b class="num">'+L(fmt(Math.round(t.d)))+'</b></div>').join('')+
    '<p class="hint">מקום ראשון: 3 נוצות נצח, 2 תיבות עונה, 30 מטבעות. מ-10% מהנזק: 2 נוצות, תיבת עונה, 20 מטבעות. מ-1%: נוצה ו-10 מטבעות. אם הבוס שורד, מקבלים רק מטבעות.</p>';
  if(over&&world.mine>0)h+=world.claimed||wGot[world.key]?'<button class="btn" style="width:100%" disabled>הפרס נאסף</button>':'<button class="btn pri glow" style="width:100%" data-act="claimWorld">אסוף פרס</button>';
  return h;
}
function sideCard(){
  const q=A.sq;if(!q)return '<h2>משימת צד</h2><p class="hint">אין כרגע. משימות צד צצות מדי פעם תוך כדי לחימה במפות, מרמה 20.</p>';
  const d=SIDEQ[q.i],left=Math.max(0,(q.until-Date.now())/1000);
  return '<h2>משימת צד</h2><div class="card shop task"><div class="z"><b>'+d.t+' · '+zoneName(q.z)+'</b><div class="bar'+(q.done?' gold':'')+'"><i style="width:'+Math.round(q.have/q.n*100)+'%"></i></div><small>'+d.d(q.n)+' · '+L(q.have+'/'+q.n)+(q.done?'':' · נשארו '+L(mmss(left)))+'</small></div>'+
    (q.done?'<button class="btn sm pri glow" data-act="sqClaim">אסוף</button>':'<button class="btn sm" data-act="sqDrop">ותר</button>')+'</div>';
}
// Hidden finds: the client notices the moment, the server decides whether it counts and pays once.
const egg={moon:0,still:0,tried:{}};
async function tryEgg(k){if(!S||demo||egg.tried[k]||(A.eggs&&A.eggs[k]))return;egg.tried[k]=1;const r=await send('egg',{k:k});if(r&&r.ok){snd('rare');announce('\u2726 '+r.t,true);toast('מצאת סוד נסתר ('+r.found+'/5)',4);}}
/* ---------- the arena: a live duel. You walk, strike, cast, guard, dash and drink; nothing happens by itself.
   The rules are liveAct in core.js. Against an absent player the fight runs here and the game plays his side;
   against a connected player the server runs it and this screen only sends what you try and shows what happened. ---------- */
const DBTN=['atk','s0','s1','s3','s2','dash','pot','buf','bash'],BUFN={lord:['פיקוד','חיים לקבוצה'],blade:['זעקת קרב','חיים לקבוצה'],storm:['מגן נשמה','הגנה לקבוצה'],hunter:['עין הנץ','כוח לקבוצה']};
const dX=u=>u*(W/LIVE_W),dy=f=>gy()-(1-f.z)*84,dsc=f=>.8+f.z*.2;
function startDuel(pd,net){
  if(pd.tower&&!pd.o.w)pd.o.w=[1,0,0,0];
  const D=liveFrom(pd.live,net?net.cls[0]:S.cls,net?net.cls[1]:pd.o.c),me=net?net.side:0;
  SC.duel={opp:pd.o,D:D,me:me,net:net||null,v:[{anim:0,face:1,mv:false,hitT:0},{anim:0,face:-1,mv:false,hitT:0}],end:0,win:null,gain:0,sent:false,ai:{t:.6,threat:0},holdAtk:false,go:1.2,posT:0,tgt:null,last:[0,0]};
  if(net&&net.spec){SC.duel.spec=net.spec;SC.duel.go=0;SC.duel.tg=[null,null];}
  if(pd.trial){SC.duel.trial=pd.trial;SC.duel.t0=SC.t;}
  if(pd.tower){SC.duel.tower=pd.tower;SC.duel.slam=null;SC.duel.slamT=pd.trial===1?2.5:4.5;D.f[1].pots=0;D.f[1].at.atk=1.5;}
  SC.mode='duel';SC.fx=[];SC.nums=[];SC.drops=[];SC.hero.dir=0;SC.hero.dz=0;closeModal();renderDuelBar();
}
const DESK=!!(window.matchMedia&&window.matchMedia('(hover:hover) and (pointer:fine)').matches);
// Soft glows (the canvas's shadow blur) are by far the dearest thing drawn: on a phone they are what makes a fight stutter.
// Fast graphics turns them off everywhere at once and leaves every shape and colour as it is. On by default on a phone.
const fastOn=()=>prefs.fast==null?!DESK:!!prefs.fast;
function applyFast(){const on=fastOn();for(const c of [ctx,wctx]){if(on)Object.defineProperty(c,'shadowBlur',{set(){},get(){return 0},configurable:true});else delete c.shadowBlur;}for(const k in WCACHE)delete WCACHE[k];}
applyFast();
// The life bar under the fight: the same in every fight against players, on a phone and on a computer, and never behind the fighter's own.
let duelHpV=-1;
function duelHpTick(){const d=SC.duel;if(!d||d.spec)return;const me=d.D.f[d.me];if(!me)return;const v=Math.round(clamp(me.alive===false?0:me.hp,0,1)*100);if(v===duelHpV)return;duelHpV=v;const hpb=$('duelHp');hpb.firstChild.style.width=v+'%';hpb.lastChild.textContent=v+'%';}
function renderDuelBar(){
  const d=SC.duel,bar=$('duelBar'),hpb=$('duelHp');$('specBtn').style.display=d&&d.spec?'':'none';if(!d||d.spec){bar.style.display='none';hpb.style.display='none';return;}bar.style.display='grid';const me=d.D.f[d.me],off=d.sent||d.go>0;
  const desk=DESK&&$('stage').clientWidth>=640;bar.classList.toggle('desk',desk);hpb.style.display='';hpb.classList.toggle('mob',!desk);duelHpTick();
  const sgOn=!!(d.br&&d.br.sg),brOn=!!d.br||!!(d.D&&d.D.pvp),cg=brOn&&d.cbN?d.D.t-d.cbAt:-1,cbQ=G.COMBO[S.cls]||G.COMBO.blade,noMark=!!d.br&&!(d.sel>=0),cbK=!noMark&&cg>=SG.cbMin&&cg<=SG.cbMax?cbQ[d.cbN]:'';
  bar.querySelectorAll('button').forEach((b,i)=>{const k=DBTN[i];if(k==='buf'||k==='bash'){b.style.display=sgOn?'':'none';if(!sgOn)return;}const cd=k==='atk'?0:Math.max(0,(me.at[k]||0)-d.D.t),nm=k==='atk'?'תקיפה':k==='dash'?'צעד':k==='bash'?'הדיפה':k==='buf'?BUFN[S.cls][0]:k==='pot'?'שיקוי ×'+me.pots:CLS[S.cls].sk[k==='s0'?0:k==='s1'?3:k==='s2'?4:5],
    t=(desk?'<kbd>'+keyName(keyOf(k))+'</kbd>':'')+nm+'<small>'+(cd>.6?Math.ceil(cd)+' שנ׳':k==='pot'&&!me.pots?'נגמר':k==='buf'?BUFN[S.cls][1]:k==='bash'?'זורק יריב ממתג':k===cbK?'קומבו עכשיו':noMark&&cbQ.indexOf(k)>=0?(k===cbQ[0]?'סמן יריב לקומבו':'&nbsp;'):brOn&&k===cbQ[0]?'קומבו 1':brOn&&k===cbQ[1]?'קומבו 2':brOn&&k===cbQ[2]?'קומבו 3':k==='s3'&&d.br?(S.cls==='blade'?'זינוק':S.cls==='lord'?'מושך יריב':S.cls==='storm'?'פוגע באזור':'חודר מגן'):k==='s2'?(S.cls==='hunter'?'נעלם לרגע':S.cls==='lord'&&sgOn?'מגן לך ולחברים':'מגן'):k==='s3'?'מכה סופית':k==='s1'?'מהמם':k==='dash'?'חמיקה':'&nbsp;')+'</small>';
    if(desk){const mx=d.cdMax||(d.cdMax={});if(cd>(mx[k]||0))mx[k]=cd;if(cd<=0)mx[k]=0;const pc=cd>0&&mx[k]?Math.round(cd/mx[k]*100)+'%':'0%';if(b.dataset.cd!==pc){b.dataset.cd=pc;b.style.setProperty('--cd',pc);}}
    if(b.dataset.h!==t){b.dataset.h=t;b.innerHTML=t;}const dis=off||cd>0||(k==='pot'&&!me.pots);if(b.disabled!==dis)b.disabled=dis;b.classList.toggle('rdy',!dis&&(cbK?k===cbK:k==='s3'&&!sgOn));});
}
function dShow(d,o){ // play what a move did; o comes from liveAct, here or on the server
  const D=d.D,i=o.by,a=D.f[i],v=D.f[1-i],va=d.v[i],ax=dX(a.x),vx=dX(v.x),g=dy(a),ge=dy(v),col=gearColor((i===d.me?(d.spec||lookOf(S)):d.opp).w,SC.t,CLS[a.cls].c),k=o.k,pool=D.pool[1-i];
  if(k==='s2'){snd('fury');SC.fx.push({k:'rune',x:ax,y:g-2,r:70,life:.9,d:.9,c:'#9fe8ff'});SC.fx.push({k:'pillar',x:ax,y:g,life:.5,d:.5,c:'#9fe8ff'});return;}
  if(k==='dash'){for(let q=0;q<4;q++)SC.parts.push({x:ax,y:g-20-q*14,vx:(Math.random()-.5)*120,vy:0,life:.4,c:'#9fe8ff',s:3});snd('whoosh');return;}
  if(k==='pot'){burst(ax,g-50,'#6fe39a',18);addNum(ax,g-112,'+30%','#6fe39a',true);snd('fury');return;}
  const big=k!=='atk'||o.fin;va.anim=1;va.face=v.x>=a.x?1:-1;
  if(k==='s0'||k==='s1')skillFx(a.cls,k,ax,g,vx,ge,va.face,col,true);
  else if(k==='s3'){snd('ult');SC.fx.push({k:'rune',x:ax,y:g-2,r:150,life:1,d:1,c:col});if(!calm){SC.fx.push({k:'screen',life:.3,d:.3,c:col});SC.shake=.4;}for(const q of [-1,1])SC.fx.push({k:'wave',x:ax+q*30,y:g,dir:q,dist:420,h:110,life:.55,d:.55,c:col});SC.fx.push({k:'flash',x:vx,y:ge-40,r:90,life:.35,d:.35,c:col});}
  attackFx(a.cls,ax,g,va.face,[{x:vx,y:(o.miss==='lane'?g:ge)-10}],big,col);
  if(D.pvp&&i===d.me&&(k==='atk'||k==='s0'||k==='s1')){d.cbN=o.miss?0:o.cb|0;d.cbAt=D.t;}
  if(o.miss==='lane'){addNum(vx,ge-110,'החטיא','#c9c2ea',false);return;}
  if(o.miss==='inv'){addNum(vx,ge-110,'חמק!','#9fe8ff',true);return;}
  if(o.guard)SC.fx.push({k:'ring',x:vx,y:ge-40,life:.3,c:'#9fe8ff',r:50});
  d.v[1-i].hitT=.18;snd(o.crit?'crit':big?'skill':'hit');addNum(vx,ge-92,fmt(Math.round(o.dm*pool)),o.crit?'#ffd75e':big?col:'#fff',o.crit||big);if(big&&!calm&&!D.pvp)SC.shake=Math.max(SC.shake,.18);
  if(o.stun)addNum(vx,ge-128,'הלם','#ffd75e',false);
  if(o.combo){snd('ult');SC.nums.push({x:vx,y:ge-150,txt:'קומבו!',c:'#ff5c7a',s:W<560?26:36,life:1.2});comboFx((D.f[o.by]||{}).cls,vx,ge,true,ax+(vx>=ax?14:-14),g-92);if(!calm)SC.shake=.4;}
}
// The step goes where the player aims (joystick, arrows or keys). With no aim it goes a random way. The server's own
// fighter keeps its habits: the blade steps in, the others step away or aside.
function dashMove(d,i){const D=d.D,me=D.f[i],en=D.f[1-i],mine=i===d.me;let vx,vz;
  if(mine){vx=joy.v[0]||SC.hero.dir;vz=joy.v[1]||SC.hero.dz;if(!vx&&!vz){const a=Math.random()*Math.PI*2;vx=Math.cos(a);vz=Math.sin(a);}const n=Math.hypot(vx,vz)||1;vx/=n;vz/=n;}
  else{const side=Math.random()<.5?(me.z>.5?-1:1):0;vz=side;vx=side?0:(me.cls==='blade'?(en.x>=me.x?1:-1):(en.x>=me.x?-1:1));}
  me.x=clamp(me.x+vx*DUEL_LIVE.dash.d,20,LIVE_W-20);me.z=clamp(me.z+vz*.55,0,1);}
function duelAct(k){
  const d=SC.duel;if(!d||d.sent||d.go>0||d.spec)return;const D=d.D,me=D.f[d.me];
  if((d.br||D.pvp)&&(k==='s0'||k==='s1')&&me.at[k]>D.t&&me.at[k]-D.t<.5&&!(me.stun>D.t)){d.q={k:k,until:D.t+.7};return;}
  if(d.br){if(d.br.phase!=='fight'||!me.alive||D.t<0||(me.stun>D.t&&k!=='pot')||me.at[k]>D.t||(k==='pot'&&!me.pots))return;
    if(k==='bash'&&d.br.sg){const r=LIVE_RNG[me.cls]+30,mg=d.br.g[d.me];if(!D.f.some((f,i)=>i!==d.me&&f.alive&&d.br.g[i]!==mg&&Math.hypot(f.x-me.x,f.y-me.y)<=r)){const p=bP(me.x,me.y);addNum(p[0],p[1]-110,'אין יריב צמוד להדוף','#ffd75e',false);me.at.bash=D.t+.6;return;}}
    {const q=d.sel,f=q>=0?D.f[q]:null;if(q>=0&&(!f||!f.alive))d.sel=-1;const fc=d.v[d.me].face<0?-1:1;netSend(d.sel>=0?{t:d.br.sg?'sgAct':'brAct',k:k,to:d.sel,f:fc}:{t:d.br.sg?'sgAct':'brAct',k:k,f:fc});}
    if(k==='dash'){me.at.dash=D.t+DUEL_LIVE.dash.cd;d.noSnap=D.t+.8;let vx=joy.v[0]||SC.hero.dir,vy=joy.v[1]||SC.hero.dz;if(!vx&&!vy){if(d.br.go){vx=d.br.go[0]-me.x;vy=d.br.go[1]-me.y;}else{const an=Math.random()*Math.PI*2;vx=Math.cos(an);vy=Math.sin(an);}}const n=Math.hypot(vx,vy)||1;if(d.br.sg)me.g=d.br.g[d.me];if(d.br.sg)sgMove({sg:d.br.sg},me,me.x+vx/n*DUEL_LIVE.dash.d,me.y+vy/n*DUEL_LIVE.dash.d);else{me.x+=vx/n*DUEL_LIVE.dash.d;me.y+=vy/n*DUEL_LIVE.dash.d;const r=Math.hypot(me.x,me.y);if(r>BR.R){me.x*=BR.R/r;me.y*=BR.R/r;}}netSend({t:d.br.sg?'sgPos':'brPos',x:Math.round(me.x),y:Math.round(me.y),f:d.v[d.me].face});}else if(k==='atk'||k==='s0'||k==='s1'){const n=D.t+SG.skT;for(const q of ['atk','s0','s1'])if(me.at[q]<n)me.at[q]=n;}else me.at[k]=D.t+(k==='pot'?.12:.3);return;}
  if(d.net){if((me.stun>D.t&&!(D.pvp&&k==='pot'))||me.at[k]>D.t)return;netSend({t:'act',k:k});if(D.pvp&&(k==='atk'||k==='s0'||k==='s1')){const n=D.t+SG.skT;for(const q of ['atk','s0','s1'])if(me.at[q]<n)me.at[q]=n;return;}if(k==='dash'){me.at.dash=D.t+DUEL_LIVE.dash.cd;dashMove(d,d.me);netSend({t:'pos',x:me.x,z:me.z});}else if(k==='atk')me.at.atk=D.t+D.T[d.me];return;}
  const o=liveAct(D,0,k,Math.random);if(!o)return;if(k==='dash')dashMove(d,0);dShow(d,o);renderDuelBar();if(k==='s1'||k==='s3')d.ai.threat=.5;
}
function duelAI(d,dt){ // the absent player, played here with his own numbers and the same moves
  const D=d.D,me=D.f[1],en=D.f[0],ai=d.ai,v=d.v[1],rng=LIVE_RNG[me.cls],dist=Math.abs(en.x-me.x),dir=en.x>=me.x?1:-1,act=k=>{const o=liveAct(D,1,k,Math.random);if(!o)return false;if(k==='dash')dashMove(d,1);dShow(d,o);return true;};
  v.mv=false;if(me.stun>D.t)return;
  const want=me.cls==='blade'?rng*.8:rng*.86,sp=me.cls==='blade'?150:128;
  if(dist>want+8){me.x+=dir*sp*dt;v.mv=true;}else if(me.cls!=='blade'&&dist<want*.55&&me.x>30&&me.x<LIVE_W-30){me.x-=dir*sp*.8*dt;v.mv=true;}
  me.x=clamp(me.x,20,LIVE_W-20);v.face=dir;
  {const dz=en.z-me.z;if(Math.abs(dz)>.1){me.z=clamp(me.z+Math.sign(dz)*.62*dt,0,1);v.mv=true;}}
  if(ai.threat>0){const was=ai.threat;ai.threat-=dt;if(was>.25&&ai.threat<=.25){if(Math.random()<.4)act('dash');else if(Math.random()<.45)act('s2');}}
  const lined=Math.abs(en.z-me.z)<=LIVE_LANE;
  if((ai.t-=dt)>0){if(lined)act('atk');return;}
  ai.t=.3+Math.random()*.25;const r=Math.random();
  if(me.hp<.36&&me.pots>0&&r<.75){act('pot');return;}
  if(me.hp<.6&&me.sh<=D.t&&r<.3&&act('s2'))return;
  if(!lined)return;
  if(r<.5&&act('s3'))return;if(r<.7&&act('s1'))return;if(r<.8&&act('s0'))return;
  act('atk');
}
function towerAI(d,dt){ // a floor guardian: walks you down, swings, and marks the ground before a heavy slam
  const D=d.D,me=D.f[1],en=D.f[0],v=d.v[1],dist=Math.abs(en.x-me.x),dir=en.x>=me.x?1:-1,mad=me.hp<.5;v.mv=false;if(me.stun>D.t)return;
  if(d.slam){d.slam.t-=dt;if(d.slam.t<=0){const s=d.slam,g=gy()-(1-s.z)*84;d.slam=null;v.anim=1;SC.fx.push({k:'ring',x:dX(s.x),y:g-6,life:.45,c:'#ff5c7a',r:dX(74)});SC.fx.push({k:'flash',x:dX(s.x),y:g-20,r:70,life:.3,d:.3,c:'#ff5c7a'});if(!calm)SC.shake=.4;snd('slam');
      if(Math.abs(en.x-s.x)<72&&Math.abs(en.z-s.z)<=LIVE_LANE){if(en.inv>D.t)addNum(dX(en.x),dy(en)-110,'חמק!','#9fe8ff',true);else{const dm=D.b[1]*2.6*(en.sh>D.t?.4:1);en.hp-=dm;d.v[0].hitT=.25;addNum(dX(en.x),dy(en)-100,fmt(Math.round(dm*D.pool[0])),'#ff5c7a',true);}}}
    return;}
  if(dist>58){me.x+=dir*(mad?96:72)*dt;v.mv=true;}me.x=clamp(me.x,20,LIVE_W-20);v.face=dir;
  {const dz=en.z-me.z;if(Math.abs(dz)>.08){me.z=clamp(me.z+Math.sign(dz)*(mad?.5:.36)*dt,0,1);v.mv=true;}}
  if((d.slamT-=dt)<=0&&dist<150){d.slamT=(mad?3.6:5.5)*(d.trial===1?.6:1);d.slam={t:mad?.85:1.1,x:en.x,z:en.z};snd('growl');return;}
  if(dist<=76&&Math.abs(en.z-me.z)<=LIVE_LANE){const o=liveAct(D,1,'atk',Math.random);if(o)dShow(d,o);}
}
function updateDuel(dt){
  if(SC.duel.br)return updateBr(dt);
  const d=SC.duel,D=d.D,me=D.f[d.me],vm=d.v[d.me];
  for(const v of d.v){v.anim=Math.max(0,v.anim-dt*3.2);v.hitT=Math.max(0,v.hitT-dt);v.hop=Math.max(0,(v.hop||0)-dt);}
  if(d.end>0){d.end-=dt;if(d.end<=0)finishDuel();return;}
  if(d.go>0){d.go-=dt;if(d.go<=0){renderDuelBar();snd('boss');}return;}
  if(d.sent)return;
  if(d.spec){D.t+=dt;for(let i=0;i<2;i++){const f=D.f[i],v=d.v[i],tg=d.tg[i];v.mv=false;if(tg){const ex=tg[0]-f.x,ez=tg[1]-f.z;if(Math.abs(ex)>1||Math.abs(ez)>.02){f.x+=ex*Math.min(1,dt*12);f.z+=ez*Math.min(1,dt*12);v.mv=true;if(Math.abs(ex)>2)v.face=ex>0?1:-1;}}}return;}
  D.t+=dt;vm.mv=false;
  if(me.stun<=D.t){const jx=SC.hero.dir||(Math.abs(joy.v[0])>.3?Math.sign(joy.v[0]):0),jz=SC.hero.dz||(Math.abs(joy.v[1])>.3?Math.sign(joy.v[1]):0); // the stick, or the keys
    if(jx){me.x=clamp(me.x+jx*(me.cls==='blade'?165:145)*dt,20,LIVE_W-20);vm.mv=true;vm.face=jx;}
    if(jz){me.z=clamp(me.z+jz*.95*dt,0,1);vm.mv=true;}}
  if(d.q){const me=D.f[d.me];if(D.t>d.q.until)d.q=null;else if(me.at[d.q.k]<=D.t){const k=d.q.k;d.q=null;duelAct(k);}}
  else if(d.holdAtk)duelAct('atk');
  if(d.net){ // tell the server where I stand, and glide the other side toward where it said he is
    if((d.posT-=dt)<=0&&(Math.abs(me.x-d.last[0])>.5||Math.abs(me.z-d.last[1])>.01)){d.posT=.05;d.last=[me.x,me.z];netSend({t:'pos',x:Math.round(me.x*10)/10,z:Math.round(me.z*100)/100});}
    const op=D.f[1-d.me],vo=d.v[1-d.me];vo.mv=false;if(d.tgt){const ex=d.tgt[0]-op.x,ez=d.tgt[1]-op.z;if(Math.abs(ex)>1||Math.abs(ez)>.02){op.x+=ex*Math.min(1,dt*20);op.z+=ez*Math.min(1,dt*20);vo.mv=true;if(Math.abs(ex)>2)vo.face=ex>0?1:-1;}}
  }else{if(d.tower)towerAI(d,dt);else duelAI(d,dt);if(liveOver(D))endDuel(d.tower?D.f[1].hp<=0:D.win===0);}
  if((d.bt=(d.bt||0)+dt)>(DESK?.1:.25)){d.bt=0;renderDuelBar();}
}
async function endDuel(win){ // a fight that ran here: report it; the server checks that it could have happened
  const d=SC.duel;if(!d||d.sent)return;d.sent=true;d.end=9;d.holdAtk=false;d.local=win;renderDuelBar();
  const r=await send(d.trial?'trialEnd':d.tower?'towerEnd':'duelEnd',{win:win});if(SC.duel!==d)return;if(d.tower&&r&&r.ok){d.rt=r.rt;d.tier=r.tier;d.el=r.el;if(r.perfect)perfectFound();}
  showResult(d,r&&r.ok?!!r.win:win,r&&r.ok?r.gain|0:0,!!(r&&r.denied));
}
function showResult(d,win,gain,denied){
  d.sent=true;d.holdAtk=false;d.local=win;d.win=win;d.gain=gain;d.denied=denied;d.end=2.4;renderDuelBar();
  SC.nums.push({x:W/2,y:H*.4,txt:win?'ניצחון!':'הפסד',c:win?'#f2c14e':'#ff5c7a',s:34,life:2.4});snd(win?'rare':'slam');
}
function finishDuel(){
  const d=SC.duel,win=d.win;
  if(d.spec){toast(d.winner?d.winner+' ניצח':'הקרב נגמר');SC.mode='farm';SC.duel=null;SC.fx=[];SC.nums=[];renderDuelBar();return;}
  if(d.trial){toast(d.denied?'השרת לא אישר את הניצחון':d.win?'אתגר היום הושלם ב-'+(d.el|0)+' שניות · מדליית '+TRIAL_MEDAL[d.tier|0]+(d.rt?' · קיבלת '+d.rt:' · כבר יש לך מדליה כזו או טובה ממנה'):'שומר היום ניצח. נסה שוב',d.win?5:0);SC.mode='farm';SC.duel=null;SC.fx=[];SC.nums=[];SC.hero.dir=0;SC.hero.dz=0;renderDuelBar();touch();return;}
  if(d.tower){toast(d.denied?'השרת לא אישר את הניצחון':d.win?'קומה '+d.tower+' נכבשה. קיבלת '+(d.rt||''):'השומר של קומה '+d.tower+' ניצח. נסה שוב',d.win?4:0);if(d.win)announce('כבשת את קומה '+d.tower+' במגדל הנצח',true);SC.mode='farm';SC.duel=null;SC.fx=[];SC.nums=[];SC.hero.dir=0;SC.hero.dz=0;renderDuelBar();touch();return;}
  toast(d.denied?'השרת לא אישר את הניצחון':d.why==='left'&&win?'היריב עזב. ניצחת':win?'ניצחון. הדירוג עלה ב-'+d.gain+', קיבלת 8 מטבעות עונה':'הפסד. הדירוג ירד ב-12');
  SC.mode='farm';SC.duel=null;SC.fx=[];SC.nums=[];SC.hero.dir=0;SC.hero.dz=0;renderDuelBar();if(d.net)send('sync',{});touch();
}
function drawDuel(dt){
  if(SC.duel.br)return drawBr(dt);
  const d=SC.duel,D=d.D,sc=clamp(H/300,.8,1.45),f=D.f,g=gy(),me=d.me,lost=d.sent?(d.win!=null?!d.win:!d.local):null,dead=d.sent?Math.min(2.4,d.end>2.4?(9-d.end):2.4-d.end+.6):0,looks=[];looks[me]=d.spec?d.spec:lookOf(S);looks[1-me]=d.opp;
  { // the floor, seen at an angle: far edge narrower, lines running into the distance
    const y0=g-84,y1=g+6,in0=W*.13;ctx.save();const gr=ctx.createLinearGradient(0,y0,0,y1);gr.addColorStop(0,'rgba(60,44,110,.55)');gr.addColorStop(1,'rgba(120,90,190,.38)');ctx.fillStyle=gr;
    ctx.beginPath();ctx.moveTo(in0,y0);ctx.lineTo(W-in0,y0);ctx.lineTo(W-6,y1);ctx.lineTo(6,y1);ctx.closePath();ctx.fill();ctx.strokeStyle='rgba(255,215,94,.22)';ctx.lineWidth=1;
    for(let q=0;q<=8;q++){const u=q/8;ctx.beginPath();ctx.moveTo(in0+(W-2*in0)*u,y0);ctx.lineTo(6+(W-12)*u,y1);ctx.stroke();}
    for(let q=0;q<=4;q++){const u=q/4,y=y0+(y1-y0)*u*u,ins=in0+(6-in0)*u*u;ctx.beginPath();ctx.moveTo(ins,y);ctx.lineTo(W-ins,y);ctx.stroke();}
    ctx.strokeStyle='rgba(255,215,94,.6)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(in0,y0);ctx.lineTo(W-in0,y0);ctx.lineTo(W-6,y1);ctx.lineTo(6,y1);ctx.closePath();ctx.stroke();ctx.restore();}
  const lined=Math.abs(f[0].z-f[1].z)<=LIVE_LANE;
  if(d.slam){const s=d.slam,u=1-clamp(s.t/1.1,0,1),g2=g-(1-s.z)*84;ctx.save();ctx.globalAlpha=.22+.4*u;ctx.fillStyle='#ff3b5c';ctx.beginPath();ctx.ellipse(dX(s.x),g2+2,dX(72),16,0,0,7);ctx.fill();ctx.globalAlpha=.9;ctx.strokeStyle='#ff8aa0';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(dX(s.x),g2+2,dX(72)*u,16*u,0,0,7);ctx.stroke();ctx.restore();}
  for(const i of (f[0].z<=f[1].z?[0,1]:[1,0])){const a=f[i],v=d.v[i],ya=dy(a),s2=sc*dsc(a),ax=dX(a.x),x=ax+(v.hitT>0?(Math.random()-.5)*5:0),down=lost!=null&&(i===me?lost:!lost);
    ctx.fillStyle='rgba(0,0,0,.4)';ctx.beginPath();ctx.ellipse(ax,ya+2,22*s2,6*s2,0,0,7);ctx.fill();
    if(lined&&i!==me&&!d.sent){ctx.strokeStyle='rgba(255,92,122,.55)';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(ax,ya+2,28*s2,8*s2,0,0,7);ctx.stroke();}
    if(a.sh>D.t){ctx.save();ctx.globalCompositeOperation='lighter';ctx.strokeStyle='#9fe8ff';ctx.shadowColor='#9fe8ff';ctx.shadowBlur=12;ctx.globalAlpha=.5+.3*Math.sin(SC.t*9);ctx.lineWidth=2.5;ctx.beginPath();ctx.ellipse(ax,ya-44*s2,30*s2,50*s2,0,0,7);ctx.stroke();ctx.restore();}
    if(d.tower&&i!==me){drawMon({x:x,y:ya,boss:true,hit:v.hitT>0?.9:0,atkA:v.anim>.2?v.anim*.5:0,die:down?Math.max(.01,.45-dead*.4):0,ph:0,mv:v.mv},d.opp.bossZ|0,SC.t,v.face<0,s2*.62);}
    else{ctx.save();if(a.inv>D.t)ctx.globalAlpha=.45;drawHero(x,ya,s2,looks[i],SC.t+i*1.7,v.anim,v.face<0,down?Math.max(.01,dead):0,v.mv,false);ctx.restore();}
    if(a.stun>D.t)for(let q=0;q<3;q++){const an=SC.t*6+q*2.1;label('✦',ax+Math.cos(an)*16,ya-128*s2+Math.sin(an)*5,'#ffd75e',12);}}
  const side=(x,a,c,nm)=>{hpBar(x-60,26,120,a.hp,c,nm);label('שיקויים '+a.pots+(a.sh>D.t?' · מגן':'')+(a.stun>D.t?' · המום':''),x,48,'#c9c2ea',10.5);};
  side(W*(me?.74:.26),f[me],'#6fe39a',d.spec?d.spec.n:S.name);side(W*(me?.26:.74),f[1-me],'#ff5c7a',d.opp.n);
  label(d.go>0?'היכון...':mmss(Math.max(0,DUEL_LIVE.time-D.t)),W/2,32,d.go>0?'#ffd75e':'#fff',d.go>0?18:13);if(d.net)label(d.spec?'צופה בקרב חי':'קרב חי מול שחקן',W/2,48,'#7df9ff',10.5);if(d.trial){const el=Math.floor(SC.t-d.t0);label('אתגר היום · '+el+' שניות · '+(el<=TRIAL_T[0]?'זהב':el<=TRIAL_T[1]?'כסף':'ארד'),W/2,64,el<=TRIAL_T[0]?'#ffd75e':el<=TRIAL_T[1]?'#dfe6f5':'#d99a6c',11.5);}else if(d.tower)label('מגדל הנצח · קומה '+d.tower,W/2,64,'#ffd75e',11);
  if(d.go<=0&&!d.sent&&!d.spec){const far=Math.abs(f[1].x-f[0].x)>LIVE_RNG[f[me].cls]+14;if(far||!lined)label(!lined?'עמוד מולו כדי לפגוע':'התקרב כדי לתקוף',dX(f[me].x),dy(f[me])-150*sc*dsc(f[me]),'#ffd75e',11);}
  const hx0=SC.hero.x;SC.hero.x=dX(f[me].x);drawFx(dt);SC.hero.x=hx0;
}
/* ---------- the live line to the server: invitations and duels between two connected players ---------- */
const EMO=['\u{1F44B}','\u{1F602}','\u{1F44D}','\u2764\uFE0F','\u{1F621}','\u{1F483}','GG','\u{1F64F}'];
let liveDuels=[];
let mvT=0,mvLast=[0,false,1,0],ws=null,whisperTo=null,friendsOn={},whoT=0;
const isBlocked=(k,n)=>(A&&A.blocked||[]).some(x=>x.k===k||(n&&x.n===n)),isFriend=k=>(A&&A.friends||[]).some(x=>x.k===k);
function askWho(){const fr=A&&A.friends||[];if(fr.length&&ws&&ws.readyState===1)netSend({t:'who',ks:fr.map(f=>f.k)});}
let brAsk=false,brLive=0,sgLive=0,sgTest=false;
function sgJoin(){if(!netUp()||SC.mode!=='farm')return false;netSend({t:'sgJoin'});return true;}
const netUp=()=>!!(ws&&ws.readyState===1);
const brSign=()=>{const n=Date.now();if(brLive>n)return brLive;const w=ONLINE&&!demo?brWindow(n):null;return w&&w.phase==='sign'?w.signEnd:0;};
function brJoin(){if(!(ws&&ws.readyState===1)||SC.mode!=='farm')return false;brAsk=true;netSend({t:'brJoin'});return true;}
function netSend(m){const d=SC.duel;if(d&&d.br&&d.br.arena&&(m.t==='brAct'||m.t==='brPos'||m.t==='brLeave'))return arenaNet(m);if(ws&&ws.readyState===1)ws.send(JSON.stringify(m));}
function netOpen(){
  if(!CFG.api||!session||!session.token||demo||(ws&&ws.readyState<2))return;
  try{ws=new WebSocket(CFG.api.replace(/^http/,'ws').replace(/\/+$/,'')+'/ws');}catch(e){ws=null;return;}
  const sock=ws;sock.onopen=()=>sock.send(JSON.stringify({t:'hello',token:session.token}));
  sock.onmessage=e=>{let m;try{m=JSON.parse(e.data);}catch(_){return;}if(m&&typeof m==='object')netMsg(m);};
  sock.onclose=()=>{if(ws===sock)ws=null;setTimeout(netOpen,900);const d=SC.duel;if(d&&d.br&&d.br.arena)return;if(d&&d.br){d.br.res=null;brExit('החיבור לשרת נותק. יצאת מהזירה');return;}if(d&&d.net&&!d.sent){d.why='lost';showResult(d,false,0,false);toast('החיבור לקרב נותק');}};
  sock.onerror=()=>{};
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&ONLINE&&S&&!demo)netOpen();});
function netMsg(m){
  if(m.t==='hi'){myKey=String(m.k||'');if(SC.sh)netSend({t:'sj',z:SC.zi,f:SC.fl,ev:SC.ev?1:0});return;}
  if(m.t==='ss'||m.t==='sh'||m.t==='sd'||m.t==='sr'){shMsg(m);return;}
  const d=SC.duel;
  if(m.t==='invite'){if(SC.mode!=='farm'||!S){netSend({t:'answer',id:m.id,ok:false});return;}snd('boss');const f=m.from||{};
    openModal('<h3 style="color:var(--gold)">'+esc(String(f.n||''))+' מאתגר אותך לדו-קרב חי</h3><p class="hint">'+(CLS[f.c]?CLS[f.c].n:'')+' · רמה '+L(f.l|0)+' · ריסטים '+L(f.r|0)+' · כוח '+L(fmt(f.p|0))+'</p><p class="hint">קרב בזמן אמת בין שניכם. המנצח עולה בדירוג. ההזמנה פגה תוך 20 שניות.</p><div class="acts"><button class="btn" data-act="pvpNo" data-id="'+(m.id|0)+'">סרב</button><button class="btn pri glow" data-act="pvpYes" data-id="'+(m.id|0)+'">קבל</button></div>');}
  else if(m.t==='start'){flushTick();startDuel({o:G.cleanPlayer('opp',m.opp),live:m.L},{side:m.side?1:0,id:m.id,cls:m.cls});announce('דו-קרב חי מול '+SC.duel.opp.n,true);}
  else if(m.t==='pos'){if(d&&d.spec)d.tg[m.s?1:0]=[+m.x||0,+m.z||0];else if(d&&d.net)d.tgt=[+m.x||0,+m.z||0];}
  else if(m.t==='duels'){liveDuels=Array.isArray(m.list)?m.list.slice(0,20):[];if(tab==='arena')panelDirty=true;}
  else if(m.t==='watching'){if(SC.mode!=='farm')return;flushTick();const p0=G.cleanPlayer('a',m.p[0]),p1=G.cleanPlayer('b',m.p[1]);startDuel({o:p1,live:m.L},{side:0,id:m.id,cls:m.cls,spec:p0});const D=SC.duel.D;D.t=+m.T||0;for(let i=0;i<2;i++){const s=m.f[i],f=D.f[i];f.hp=+s.hp;f.stun=+s.stun;f.sh=+s.sh;f.inv=+s.inv;f.pots=s.pots|0;f.x=+m.xz[i][0];f.z=+m.xz[i][1];}}
  else if(m.t==='over'){if(d&&d.spec){d.winner=m.win?d.opp.n:d.spec.n;d.sent=true;d.win=!m.win;d.local=!m.win;d.end=2.4;SC.nums.push({x:W/2,y:H*.4,txt:d.winner+' ניצח',c:'#f2c14e',s:26,life:2.4});}}
  else if(m.t==='emote'){const p=peers.find(q=>q.k===m.k);if(p&&EMO[m.e|0])p.say={m:EMO[m.e|0],t:SC.t+3.5};}
  else if(m.t==='mv'){const p=peers.find(q=>q.k===m.k);if(p&&SC.mode==='farm'){p.v=clamp(+m.v||0,-1200,1200);p.vT=.5;p.tx=clamp((+m.x||0)+p.v*.1,30,mapW()-30);p.f=m.f<0?-1:1;p.a=!!m.a;if(m.p!=null)p.hp=m.p;if(m.h>0){const big=!!m.c;SC.nums.push({x:p.x+p.f*46,y:gy()-(hasDeck(SC.zi)&&p.up?deckH():0)-78,txt:fmt(Math.round(+m.h)),c:big?'#ffb23e':'#c9b8ff',s:big?19:15,life:1});if(+m.h>(p.top||0))p.top=+m.h;}}}
  else if(m.t==='ev'){if(!d||!d.net||!m.o||!m.f)return;const D=d.D;D.t=+m.T||D.t;for(let i=0;i<2;i++){const s=m.f[i],f=D.f[i];f.hp=+s.hp;f.stun=+s.stun;f.sh=+s.sh;f.inv=+s.inv;f.pots=s.pots|0;f.wound=+s.wound||0;if(s.at)for(const k in f.at)f.at[k]=+s.at[k]||0;}dShow(d,m.o);renderDuelBar();}
  else if(m.t==='end'){if(d&&d.net){d.why=m.why;showResult(d,!!m.win,m.gain|0,false);}}
  else if(m.t==='who'){const was=friendsOn,now={};for(const k of m.on||[])now[String(k)]=1;friendsOn=now;for(const f of A.friends||[])if(now[f.k]&&!was[f.k]&&whoT++>0)toast(f.n+' התחבר');if(!whoT)whoT=1;if(tab==='arena')panelDirty=true;}
  else if(m.t==='whisper'){const f=m.from||{},k=String(f.k||''),n=String(f.n||'').slice(0,14);if(isBlocked(k,n))return;chatLog.push({c:'p',n:n,g:'',m:String(m.m||'').slice(0,160),me:false,k:k});chatAt=Date.now();if(!(tab==='chat'&&chatCh==='p'))chatUnread++;snd('click');toast('הודעה פרטית מ-'+n);if(!whisperTo)whisperTo={k:k,n:n};const l=$('chatList');if(l&&chatCh==='p'){l.innerHTML=chatRows();l.scrollTop=l.scrollHeight;}renderChatBar();}
  else if(m.t==='whispered'){chatLog.push({c:'p',n:S.name,g:'',m:String(m.m||''),me:true,k:String(m.k||''),to:whisperTo&&whisperTo.k===m.k?whisperTo.n:''});const l=$('chatList');if(l&&chatCh==='p'){l.innerHTML=chatRows();l.scrollTop=l.scrollHeight;}}
  else if(m.t==='brLobby'){if(d&&d.br){if(d.br.phase==='lobby'){d.br.n=m.n|0;d.br.until=Date.now()+(+m.left||0);}}else if(SC.mode==='farm'&&brAsk){brAsk=false;brEnter(m.n|0,+m.left||0);}if(tab==='pass')panelDirty=true;}
  else if(m.t==='brOpen'){const left=+m.left||0;brLive=left>0?Date.now()+left:0;if(left>0&&!m.quiet){snd('boss');announce('המעגל האחרון נפתח! לחץ כאן כדי להשתגר לזירה, תוך '+Math.round(left/1000)+' שניות',true,'last');}if(tab==='pass')panelDirty=true;}
  else if(m.t==='brCancel'){if(d&&d.br){d.br.res=null;brExit('ההרשמה למעגל האחרון בוטלה');}}
  else if(m.t==='boost'){const left=+m.left||0;setBoost(left>0?{xp:m.xp,drop:m.drop,until:Date.now()+left}:null);const b=boostNow(Date.now());if(!m.quiet)announce(b?'בונוס לכולם: ניסיון ×'+b.xp+', שלל ×'+b.drop+' למשך '+Math.round(left/60000)+' דקות':'הבונוס לכולם הסתיים',true);if(tab==='pass')panelDirty=true;}
  else if(m.t==='gmSay'){snd('boss');announce('הודעת מנהל: '+String(m.m||'').slice(0,120),true);toast('הודעת מנהל: '+String(m.m||'').slice(0,120),6);}
  else if(m.t==='gmRes'){toast(String(m.msg||''),4);}
  else if(m.t==='brNo'){brAsk=false;toast('ההרשמה למעגל האחרון סגורה כרגע');}
  else if(m.t==='brStart'){if(m.sg){if(!(d&&d.br)){if(SC.mode!=='farm')return;brEnter(0,0);}const b=SC.duel.br;b.sg=m.sg;b.lead=!!m.lead;b.test=!!m.test;b.gn={};for(const g of m.guilds||[])b.gn[g[0]]=String(g[1]);}brBegin(m);}
  else if(m.t==='sgAdd'){if(d&&d.br&&d.br.sg&&m.f&&m.i===d.D.f.length){const b=d.br,p=G.cleanPlayer('f'+m.i,m.f),f=brF(+m.xy[0],+m.xy[1]);f.cls=p.c;f.pots=SG.pots;(b.hpv=b.hpv||[])[m.i]=p.h;d.D.f.push(f);d.v.push({anim:0,face:1,mv:false,hitT:0});b.looks.push(p);b.names.push(p.n);b.bot.push(0);b.tg.push(null);b.deadT.push(0);b.g.push(m.f.g|0);b.tag.push(String(m.f.tag||''));addNum(W/2,H*.3,p.n+' הצטרף למצור','#c9c2ea',false);}}
  else if(m.t==='sgOpen'){const left=+m.left||0;sgLive=left>0?Date.now()+left:0;sgTest=!!m.test;if(left>0&&!m.quiet){snd('boss');announce((m.test?'מצור ידידות נפתח':'מצור הטירה התחיל')+'! מצטרפים מלשונית הגילדה',true);}panelDirty=true;}
  else if(m.t==='sgHint'){toast({held:'המתג תפוס. קודם צריך להפיל את מי שמחזיק בו',lead:'רק מנהל הגילדה יכול לקחת את הכתר',own:'הטירה כבר שלכם',sw:'צריך ששני חברי גילדה אחרים יחזיקו את שני המתגים',wound:'פצוע מקומבו: אי אפשר לשתות עוד רגע'}[m.no]||'אי אפשר כרגע',4);}
  else if(m.t==='sgNo'){toast(m.why==='guild'?'רק חברי גילדה יכולים להצטרף למצור':'אין מצור פתוח כרגע');}
  else if(m.t==='brS')brState(m);
  else if(m.t==='brMe'){if(d&&d.br){const f=d.D.f[d.me];if(m.at)for(const k in f.at)f.at[k]=+m.at[k]||0;f.pots=m.pots|0;renderDuelBar();}}
  else if(m.t==='brEnd')brOver(m);
  else if(m.t==='offline')toast('הוא לא מחובר כרגע');
  else if(m.t==='pAsk'){snd('boss');openModal('<h2>הזמנה לפארטי</h2><p style="margin:8px 0 12px">'+esc(String(m.n||'שחקן').slice(0,14))+' מזמין אותך לפארטי שלו. להצטרף?</p><div class="grid2"><button class="btn pri" data-act="pans" data-ok="1">כן, הצטרף</button><button class="btn" data-act="pans" data-ok="0">לא</button></div>');}
  else if(m.t==='pRes'){if(m.ok&&m.sent)toast('ההזמנה נשלחה. מחכים לתשובה');else if(m.ok){toast(m.joined?'הצטרפת לפארטי':'ההזמנה התקבלה. הוא בפארטי שלך',4);snd('rare');act('pget',{});}else toast({off:'השחקן לא נמצא או לא מחובר',full:'הפארטי מלא, עד חמישה שחקנים','in':'הוא כבר בפארטי שלך',busy:'יש לו הזמנה פתוחה. נסה שוב עוד רגע',no:'ההזמנה נדחתה',join:'ההצטרפות נכשלה. מי שכבר בפארטי אחר צריך לעזוב אותו קודם'}[m.why]||'ההזמנה לא נשלחה',4);}
  else if(m.t==='muted')toast('אתה מושתק ולא יכול לשלוח הודעות');
  else if(m.t==='declined')toast('ההזמנה לדו-קרב לא התקבלה');
  else if(m.t==='busy')toast('השחקן באמצע קרב אחר');
  else if(m.t==='noticket')toast('אין לך כרטיס זירה');
  else if(m.t==='gone'){if(m.k&&SC.mode==='farm'){toast('הוא לא זמין לקרב חי. נלחמים בדמות שלו');act('duelStart',{k:String(m.k)}).then(r=>{if(r.ok)startArena(r.pd);else toast(r.msg==='net'?'אין חיבור לשרת':r.msg);});}}
}
function frame(dt){
  SC.t+=dt;SC.dt=dt;if(statsDirty){C=calc(S,auras);statsDirty=false;}
  if(SC.mode==='farm'){updateWorld(dt);updatePeers(dt);}else updateDuel(dt);
  ctx.setTransform(DPR*ZM,0,0,DPR*ZM,0,0);
  ctx.save();if(SC.shake>0){SC.shake-=dt;ctx.translate((Math.random()-.5)*7,(Math.random()-.5)*5);}
  const cam=SC.cam;if(SC.mode==='duel')SC.cam=0;
  drawBg(SC.zi,SC.t);
  if(SC.ev&&SC.mode==='farm'){const gr=ctx.createLinearGradient(0,0,0,H);gr.addColorStop(0,'rgba(150,10,40,.42)');gr.addColorStop(1,'rgba(60,0,20,.25)');ctx.fillStyle=gr;ctx.fillRect(0,0,W,H);}
  if(SC.mode==='farm')drawWorld();
  else drawDuel(dt);
  SC.cam=cam;ctx.restore();
}

/* ---------- UI ---------- */
const SVG={
 w:'<svg viewBox="0 0 40 40"><path d="M30 4 34 6 36 10 16 30 12 30 10 28 10 24Z" fill="currentColor"/><path d="M8 26l6 6-3 3-2-2-4 4-2-2 4-4-2-2z" fill="#f2c14e"/></svg>',
 a:'<svg viewBox="0 0 40 40"><path d="M10 6l6 3h8l6-3 6 7-5 5v16H9V18l-5-5z" fill="currentColor"/><path d="M15 18h10v3H15z" fill="#0008"/></svg>',
 h:'<svg viewBox="0 0 40 40"><path d="M8 24c0-10 5-17 12-17s12 7 12 17v8h-8v-8h-8v8H8z" fill="currentColor"/></svg>',
 p:'<svg viewBox="0 0 40 40"><path d="M11 6h18l2 28h-8l-3-18-3 18h-8z" fill="currentColor"/></svg>',
 l:'<svg viewBox="0 0 40 40"><path d="M12 34V19l-4-6 3-2 4 5V7h4v9h1V5h4v11h1V8h4v15l-3 11z" fill="currentColor"/></svg>',
 b:'<svg viewBox="0 0 40 40"><path d="M14 6h9v16l10 5v7H12z" fill="currentColor"/></svg>',
 g:'<svg viewBox="0 0 40 40"><path d="M20 30C12 30 3 22 3 8c6 2 11 6 17 16C26 14 31 10 37 8c0 14-9 22-17 22z" fill="currentColor"/><path d="M20 24v10" stroke="#fff8" stroke-width="2"/></svg>',
 y:'<svg viewBox="0 0 40 40"><circle cx="20" cy="26" r="8" fill="currentColor"/><circle cx="9" cy="16" r="4" fill="currentColor"/><circle cx="17" cy="9" r="4" fill="currentColor"/><circle cx="26" cy="10" r="4" fill="currentColor"/><circle cx="32" cy="18" r="4" fill="currentColor"/></svg>',
 r:'<svg viewBox="0 0 40 40"><circle cx="20" cy="25" r="10" fill="none" stroke="currentColor" stroke-width="4"/><path d="M20 4l6 7-6 6-6-6z" fill="#ff5c7a"/></svg>',
 q:'<svg viewBox="0 0 40 40"><circle cx="20" cy="25" r="10" fill="none" stroke="currentColor" stroke-width="4"/><path d="M20 4l6 7-6 6-6-6z" fill="#6fe39a"/></svg>',
 n:'<svg viewBox="0 0 40 40"><path d="M6 6c0 14 6 20 14 20s14-6 14-20" fill="none" stroke="currentColor" stroke-width="3"/><path d="M20 24l6 7-6 7-6-7z" fill="#ffd75e"/></svg>'
};
const gcls=p=>p>=13?' g13':p>=11?' g11':p>=9?' g9':p>=7?' g7':'';
const petLeft=it=>it.perm?'נשארת לתמיד':it.until?'נשארו '+fmtT(Math.max(0,(it.until-Date.now())/1000)):L(PET_DAYS[it.r])+' ימים מהרגע שתלבש';
function mainLine(it){if(it.s==='y')return petLeft(it);const v=itemVals(it);return it.s==='w'?'נזק '+fmt(v.atk):ARM[it.s]?'חיים '+fmt(v.hp)+' · הגנה '+v.def:JEWV[it.s]?[v.wd?'נזק '+L('+'+v.wd+'%'):'',v.wh?'חיים '+L('+'+v.wh+'%'):''].filter(Boolean).join(' · '):'נזק '+L('+'+v.wd+'%');}
function itemCard(it){
  return '<button class="it r'+it.r+gcls(it.p)+(it.pf?' ex full pf':it.ex?(isFull(it)?' ex full':' ex'):'')+'" data-act="item" data-id="'+it.id+'" style="color:var(--r'+it.r+')">'+SVG[it.s]+
    '<span class="nm">'+esc(itemName(it,S.cls))+(it.p?' '+L('+'+it.p):'')+'</span><span class="sub">'+mainLine(it)+'</span></button>';
}
function findItem(id){for(const k of SLOTS)if(S.eq[k]&&S.eq[k].id===id)return {it:S.eq[k],eq:k};const i=A.inv.findIndex(x=>x.id===id);if(i>=0)return {it:A.inv[i],i:i};const b=(A.bank||[]).findIndex(x=>x.id===id);return b>=0?{it:A.bank[b],bank:b}:null;}
function tog(lbl,on,act){return '<div class="tog"><span>'+lbl+'</span><button class="btn sm'+(on?' on':'')+'" data-act="'+act+'">'+(on?'פעיל':'כבוי')+'</button></div>';}
const zoneName=z=>z<0?TOWN.n:ZONES[z].n;
const monName=(zi,fl)=>ZONES[zi].m+(fl===1?' זועם':fl===2?' קדמון':'');

function renderHud(){
  $('hName').textContent=S.name;$('hCls').textContent=CLS[S.cls].n;$('hLv').textContent=S.lvl;$('hRs').textContent=S.resets;
  $('hXp').style.width=(S.lvl>=CAP?100:S.xp/need(S.lvl)*100)+'%';
  $('cGold').textContent=fmt(A.gold);$('cGem').textContent=fmt(A.gems);$('cCred').textContent=fmt(A.cred);$('cCoin').textContent=fmt(A.coins);
  const duel=SC.mode==='duel',zi=SC.zi;
  $('zoneTag').textContent=duel?'זירה':SC.ev?'מצודת הארגמן '+SC.evTier+' · '+mmss((SC.evEnd-Date.now())/1000):zoneName(zi)+(zi>=0?' · קומה '+(SC.fl+1):'')+(partyN>0&&zi>=0?' · פארטי '+(partyN+1)+(partyXp(partyN)?' · '+Math.round(partyXp(partyN)*100)+'%+':''):'');
  $('rateTag').textContent=duel||zi<0?'':SC.boss?'בוס במפה':'בוס: '+(A.bossM[zi]||0)+'/'+BOSSN;
  {const left=(A.boost-Date.now())/1000,bt=left>0&&!duel?'ניסיון '+L('+50%')+' · '+mmss(left):'';if($('boostTag').dataset.t!==bt){$('boostTag').dataset.t=bt;$('boostTag').innerHTML=bt;}}
  {const kg=S&&!demo?keepWin():null;if(kg&&kg.key!==keepAnn){keepAnn=kg.key;if(!SC.ev&&!duel){snd('boss');announce('מצודת הארגמן מתחילה בעוד '+Math.max(1,Math.ceil((keepStart(kg)-Date.now())/60000))+' דקות. נכנסים רק עכשיו, עד סוף הספירה',true);}}}
  {const kw=!duel&&!SC.ev&&S&&!demo?keepWin():null,kb=$('keepBtn');kb.style.display=kw?'':'none';if(kw){const t=(A.keys>0||(A.ev&&A.ev[kw.key]&&A.ev[kw.key].in)?'שגר למצודה':'המצודה פתוחה · אין מפתח')+' · מתחילה בעוד '+mmss((keepStart(kw)-Date.now())/1000);if(kb.textContent!==t)kb.textContent=t;}}
  {const up=!duel&&S&&!demo&&ws&&ws.readyState===1,sgo=up&&sgLive>Date.now()&&(guild.mine||me.admin),se=up&&!sgo?brSign():0,bb=$('brBtn');bb.style.display=se||sgo?'':'none';const act=sgo?'sgJoin':'brJoin';if(bb.dataset.act!==act)bb.dataset.act=act;if(se||sgo){const t=sgo?(sgTest?'מצור ידידות':'מצור הטירה')+' · הצטרף · '+mmss((sgLive-Date.now())/1000):'המעגל האחרון נפתח · השתגר לזירה · '+mmss((se-Date.now())/1000);if(bb.textContent!==t)bb.textContent=t;}}
  $('resetNow').style.display=canReset(S)&&!duel?'block':'none';
  $('autoBtn').style.display=$('skills').style.display=duel||zi<0?'none':'';$('paceTag').style.visibility=$('bigBtn').style.visibility=$('setBtn').style.visibility=$('sndBtn').style.visibility=$('fsBtn').style.visibility=duel?'hidden':'';if(duel)renderDuelBar();{const brm=duel&&SC.duel&&!SC.duel.spec;$('joy').style.display=brm&&!DESK?'':'none';$('mv').style.display=brm?'none':'';if(!brm&&(joy.v[0]||joy.v[1]))joy.v=[0,0];}$('mvU').style.display=$('mvD').style.display='none';$('stage').classList.toggle('duel',duel);
  $('sndBtn').textContent=prefs.mute?'צליל כבוי':'צליל פעיל';$('sndBtn').classList.toggle('on',!prefs.mute);
  $('autoBtn').textContent='אוטומטי: '+(S.auto?'פעיל':'כבוי');$('autoBtn').classList.toggle('on',!!S.auto);
  const bs=$('skills').children,h=SC.hero;
  {const cq=G.COMBO[S.cls]||G.COMBO.blade,cn={s0:cq.indexOf('s0')+1,s1:cq.indexOf('s1')+1},pots=A.pots==null?G.POT_START:A.pots;
  for(const b of bs){const i=+b.dataset.i,lock=i<6&&!skOpen(i),cd=i===6?h.dashT||0:i===7?0:h.cds[i],nm=i===6?'צעד':i===7?'שיקוי ×'+pots:CLS[S.cls].sk[i];b.className=lock?'lock':cd>0||(i===7&&pots<1)?'cd':'';
    const txt=lock?'רמה '+SKLV[i]:cd>.6?Math.ceil(cd)+' שנ׳':i===7?(pots<1?'נגמר':'&nbsp;'):i===0?'קומבו '+cn.s0:i===3?'קומבו '+cn.s1:'מוכן',kb=DESK?'<kbd>'+keyName(keyOf('k'+i))+'</kbd>':'';if(b.dataset.s!==txt+S.cls+nm){b.dataset.s=txt+S.cls+nm;b.innerHTML=kb+esc(nm)+'<b>'+txt+'</b>';}}}
  {const pb=$('potBtn'),v=prefs.autoPot==null?50:prefs.autoPot;pb.style.display=$('autoBtn').style.display;const t=v?'שיקוי אוטומטי: '+v+'%':'שיקוי אוטומטי: כבוי';if(pb.textContent!==t)pb.textContent=t;pb.classList.toggle('on',!!v);}
  const q=QUESTS[A.q],qe=$('quest');
  if(!q||duel){qe.style.display='none';}else{const p=q.p(A,S),done=p[0]>=p[1];qe.style.display='';qe.classList.toggle('done',done);
    qe.textContent=done?'המשימה הושלמה. לחץ לקבלת '+q.rt:'משימה: '+q.t+(p[1]>1?' ('+Math.min(p[0],p[1])+'/'+p[1]+')':'');}
  const now=Date.now(),lw=evWindows(now,10),ec=$('evChip');let evReady=false,chip='';
  for(const w of lw){const rec=(A.ev||{})[w.key]||{};if(w.e.obj&&(rec[w.e.obj[0]]||0)>=w.e.obj[1]&&!rec.c)evReady=true;}
  const lv1=lw.filter(w=>w.live).sort((a,b)=>(b.e.obj?1:0)-(a.e.obj?1:0))[0];
  if(lv1){const rec=(A.ev||{})[lv1.key]||{};chip=lv1.e.n+(lv1.e.obj&&lv1.e.obj[0]!=='q'?' · '+Math.min(rec[lv1.e.obj[0]]||0,lv1.e.obj[1])+'/'+lv1.e.obj[1]:'')+' · '+mmss((lv1.end-now)/1000);}
  else{let best=null,bt=1e9;for(const e of EVENTS){const t=evNext(e,now);if(t<bt){bt=t;best=e;}}chip='הבא: '+best.n+' בעוד '+fmtT(bt);}
  ec.style.display=duel?'none':'';ec.textContent=evReady?'פרס אירוע מחכה לך':chip;ec.classList.toggle('done',evReady);ec.classList.toggle('live',!!lv1);
  if(premSeen==null)premSeen=A.prem||0;else if((A.prem||0)>premSeen){announce('התרומה אושרה. קיבלת '+fmt((A.prem||0)-premSeen)+' קרדיטים. תודה!',true);premSeen=A.prem||0;myOrders=null;loadOrders();}else premSeen=A.prem||0;
  if(passSeen<0)passSeen=passLevel(S);else if(passLevel(S)>passSeen){passSeen=passLevel(S);announce('פס העונה: רמה '+passSeen+'! '+passReward(passSeen).t+' מחכה לך',true);panelDirty=true;}
  const plv=passLevel(S),pb=evReady||(A.login&&!A.login.got)||plv>A.pass.claimed||TASKS.some(t=>A.daily[t.k]>=t.n&&!A.daily.done[t.k]);
  const bt=document.querySelector('#tabs [data-tab=pass]');let b=bt.querySelector('.badge');if(pb&&!b){b=document.createElement('i');b.className='badge';bt.appendChild(b);}else if(!pb&&b)b.remove();
}
function renderChar(){
  const c=C;let h='<div class="card"><div class="grid2">'+
   '<div class="kv"><span>כוח לחימה</span><b class="num" style="color:var(--gold)">'+fmt(c.power)+'</b></div>'+
   '<div class="kv"><span>נזק למכה</span><b class="num">'+fmt(c.dmg)+'</b></div>'+
   '<div class="kv"><span>מכות בשנייה</span><b class="num">'+c.aspd.toFixed(2)+'</b></div>'+
   '<div class="kv"><span>קריטי</span><b class="num">'+Math.round(c.crit*100)+'%</b></div>'+
   '<div class="kv"><span>חיים</span><b class="num">'+fmt(c.hp)+'</b></div>'+
   '<div class="kv"><span>הגנה</span><b class="num">'+fmt(c.def)+'</b></div>'+
   '<div class="kv"><span>בונוס ניסיון</span><b class="num">'+L('+'+Math.round((c.xpM-1)*100)+'%')+'</b></div>'+
   '<div class="kv"><span>טווח תקיפה</span><b>'+(S.cls==='blade'?'קרוב':S.cls==='lord'?'בינוני':'רחוק')+'</b></div></div></div>';
  {const sk=CLS[S.cls].sk,cb=n=>n?'<b style="color:#ff5c7a;margin-inline-start:6px">קומבו '+n+'/3</b>':'',cq=G.COMBO[S.cls]||G.COMBO.blade,ci=k=>cq.indexOf(k)+1,nmK=k=>k==='atk'?'תקיפה':sk[k==='s0'?0:3],
      mv=[['תקיפה',cb(ci('atk')),'מכה רגילה. חלשה לבדה, ובעיקר מול לוחם להב'],[sk[0],cb(ci('s0')),'מיומנות מהירה בלי המתנה'],[sk[3],cb(ci('s1')),'מיומנות חזקה בלי המתנה'],[sk[5],'',S.cls==='blade'?'המיומנות הגדולה. זינוק אל יריב רחוק':S.cls==='lord'?'המיומנות הגדולה. שלשלת שמושכת יריב רחוק אליך':S.cls==='storm'?'המיומנות הגדולה. נופלת מרחוק ופוגעת גם במי שליד היריב':'המיומנות הגדולה. נזרקת רחוק וחודרת מגן'],[sk[4],'',S.cls==='hunter'?'נעלמים לשנייה. שום מכה לא פוגעת':S.cls==='lord'?'מגן לשלוש שניות. במצור מכסה גם חברי גילדה שעומדים לידך':'מגן לשלוש שניות. עוצר הדיפה והלם'],['צעד','','חמיקה קצרה לכיוון שמכוונים'],['הדיפה','','במצור בלבד. זורקת יריב רחוק'],[BUFN[S.cls][0],'','במצור בלבד. '+BUFN[S.cls][1]]];
    h+='<h2>המתקפות שלך בקרב</h2><div class="card"><p class="hint">בזירה, במגדל, במצור ובמעגל האחרון. <b>לכל דמות קומבו משלה.</b> הקומבו שלך: <b>'+cq.map(nmK).join(' ← ')+'</b>, על אותו יריב, הכי מהר שאפשר. המכה האחרונה מתפוצצת על היריב, מהממת אותו והודפת אותו.</p><p class="hint"><b>כיוון:</b> לחיצה על יריב מסמנת אותו, והמכות הולכות אליו כל עוד הוא בטווח. בלי יריב מסומן המכה פוגעת במי שעומד מול הדמות, אבל היא חלשה יותר ואין בה קומבו.</p><p class="hint"><b>מכת אזור:</b> '+(S.cls==='blade'?'המיומנות הראשונה שלך פוגעת בכל מי שסביבך':S.cls==='storm'||S.cls==='lord'?'המיומנות החזקה שלך פוגעת גם במי שעומד ליד היריב שבחרת':'המיומנות הראשונה שלך פוגעת גם בשני היריבים הקרובים אליך')+'. <b>במצור היא פוגעת גם בחברי הגילדה שלך שעומדים בתוכה, בחמישית מהנזק.</b></p><p class="hint"><b>חוסן:</b> לוחם להב סופג הכי פחות, ומכה רגילה בקושי מזיזה אותו. מכשפת סער וצייד צללים נופלים מהר גם ממכות רגילות.</p>'+mv.map(m=>'<div class="kv" style="align-items:flex-start;margin:6px 0"><span><b>'+m[0]+'</b>'+m[1]+'<br><small style="color:var(--dim)">'+m[2]+'</small></span></div>').join('')+'</div>';}
  {const ml=mastery(A.kills),a0=masteryNeed(ml),a1=masteryNeed(ml+1);
    h+='<h2>דרגת המעגל</h2><div class="card" style="display:block"><div class="kv"><b style="color:var(--gold)">דרגה '+L(ml)+'</b><b class="num">'+L('+'+ml*MASTERY_PCT+'%')+' נזק וחיים</b></div><div class="bar gold" style="margin:6px 0"><i style="width:'+clamp((A.kills-a0)/(a1-a0)*100,0,100)+'%"></i></div><p class="hint">הדרגה הזו לא נגמרת. כל מפלצת שהחשבון חיסל אי פעם נספרת, וכל דרגה מוסיפה '+L(MASTERY_PCT+'%')+' נזק וחיים לכל הדמויות. עוד '+L(fmt(Math.max(0,a1-A.kills)))+' חיסולים לדרגה הבאה.</p></div>';}
  {const R=totalResets(A),nx=ARTS.find(a=>R<a.r);
    h+='<h2>אומנויות ריסט</h2><div class="card" style="display:block"><p class="hint" style="margin-bottom:6px">מתקפות מיוחדות שמצטרפות לשרשרת המכות ככל שהחשבון צובר ריסטים. כל מכת סיום שלישית מפעילה את הבאה בתור. גם המראה של הדמות משתנה באותן מדרגות.'+(nx?' הבאה נפתחת בריסט '+L(nx.r)+'.':'')+'</p>'+ARTS.map(a=>'<div class="kv"'+(R>=a.r?'':' style="opacity:.45"')+'><span><b style="color:'+(R>=a.r?'var(--gold)':'inherit')+'">'+a.n+'</b> · '+a.d+'</span><b class="num">'+(R>=a.r?'פעיל':'ריסט '+L(a.r))+'</b></div>').join('')+'</div>';}
  h+='<h2>נקודות סטט: '+L(S.pts)+'</h2><div class="card">';const spentPts=S.stats.str+S.stats.agi+S.stats.vit+S.stats.ene-60;
  {const tot=['str','agi','vit','ene'].reduce((n,k)=>n+S.stats[k],0);h+='<p class="hint">המרב לכל סטט הוא '+L(fmt(STAT_MAX))+'. חילקת '+L(fmt(tot))+' מתוך '+L(fmt(STAT_MAX*4))+'. כל ריסט מוסיף כ-2,000 נקודות, כך שדמות מלאה בכל הסטטים דורשת כ-65 ריסטים.</p>';}
  for(const k of ['str','agi','vit','ene'])h+='<div class="stat"><div class="n">'+STATN[k][0]+'<small>'+STATN[k][1]+'</small></div><b class="num"'+(S.stats[k]>=STAT_MAX?' style="color:var(--gold)"':'')+'>'+(S.stats[k]>=STAT_MAX?'מלא':fmt(S.stats[k]))+'</b>'+
    '<button class="btn sm" data-act="pt" data-k="'+k+'" data-n="1"'+(S.pts<1?' disabled':'')+'>'+L('+1')+'</button>'+
    '<button class="btn sm" data-act="pt" data-k="'+k+'" data-n="10"'+(S.pts<10?' disabled':'')+'>'+L('+10')+'</button>'+
    '<button class="btn sm" data-act="pt" data-k="'+k+'" data-n="all"'+(S.pts<1?' disabled':'')+'>הכל</button></div>';
  h+='</div><div class="card" style="display:flex;flex-direction:column;gap:8px">'+tog('חלוקת נקודות אוטומטית',S.autoPts,'autoPts')+'<button class="btn sm" data-act="respecAsk"'+(spentPts>0&&A.cred>=RESPEC_COST?'':' disabled')+'>איפוס נקודות · '+L(RESPEC_COST)+' אותות ריסט</button></div>';
  h+='<h2>ריסט</h2><div class="card"><p class="hint">ברמה 400 חוזרים לרמה 1 בכפר. הסטטים, הציוד והשערים הפתוחים נשארים, ובדרך חזרה למעלה מקבלים שוב 5 נקודות סטט בכל רמה. כל ריסט מוסיף גם '+L('+4%')+' נזק לתמיד ו-'+L(resetGain(S))+' אותות ריסט. המפות הרגילות זהות לכולם. האתגר למי שעשה ריסט נמצא במפות הריסט: מפלצות חזקות בהרבה, ויותר ניסיון וזהב. כל סטט מתמלא ב-'+L(fmt(STAT_MAX))+'.</p>'+
    '<div class="bar gold" style="margin:8px 0"><i style="width:'+(S.lvl/CAP*100)+'%"></i></div>'+
    '<button class="btn pri" style="width:100%" data-act="reset"'+(canReset(S)?'':' disabled')+'>'+(canReset(S)?'בצע ריסט':'רמה '+S.lvl+' מתוך 400')+'</button></div>';
  h+='<h2>הדמויות שלך</h2><p class="hint">דמות שלא משחקים בה ממשיכה להילחם לבד במפה שבה השארת אותה, בקצב של 70%. בכפר היא נחה. הזהב, התיק והשערים משותפים.</p>';
  A.chars.forEach((ch,i)=>{const cur=i===A.cur;h+='<div class="card opp"'+(cur?' style="border-color:var(--gold)"':'')+'><div class="z"><b>'+esc(ch.name)+'</b><small>'+CLS[ch.cls].n+' · רמה '+L(ch.lvl)+' · ריסטים '+L(ch.resets)+' · '+zoneName(cur?SC.zi:ch.zone)+'</small></div>'+
    (cur?'<span class="tag">משחק עכשיו</span>':'<button class="btn sm pri" data-act="switch" data-i="'+i+'">החלף</button>')+'</div>';});
  if(A.chars.length<3){const open=A.chars.length<slotsOpen(A);
    h+='<button class="btn" data-act="newChar"'+(open?'':' disabled')+'>'+(open?'צור דמות חדשה':A.chars.length===1?'דמות שנייה נפתחת ברמה 50':'דמות שלישית נפתחת אחרי ריסט ראשון')+'</button>';}
  h+=accountHtml();
  return h;
}
function setLines(z,n){return setTable(z).map(b=>'<div class="kv"'+(n>=b[0]?' style="color:var(--r4)"':'')+'><span style="color:inherit">'+L(b[0])+' חלקים</span><b>'+AFF[b[1]][0]+' '+L('+'+b[2]+'%')+'</b></div>').join('');}
function renderGear(){
  const sp=armorPlus(S),gtier=glowTier(sp),gn=GLOW_NAME.find(x=>gtier>=x[0]);
  const res=[['זהב',fmt(A.gold),'var(--gold)'],['אבני נשמה',A.gems,'var(--arc)'],['אותות ריסט',A.cred,'var(--ember)'],['מטבעות עונה',A.coins,'var(--r2)'],['קרדיטים',fmt(A.prem||0),'#7df9ff'],['נוצות נצח',A.feathers||0,'#ffd75e'],['אבני שלמות',A.jewels||0,'#7dffb0'],
    ['קמעות הגנה',A.charms,'#ffd75e'],['שברי ארגמן',A.shards||0,'#ff6b8a'],['מפתחות מצודה',A.keys||0,'#ffb23e'],['תיבות אוצר',A.boxes,'#c9a66b'],['תיבות עונה',A.sboxes,'#c77dff'],['כרטיסי זירה',A.tickets,'#8fd3ff']];
  let h='<button class="btn" style="width:100%;margin-bottom:6px;border-color:var(--gold);color:var(--gold)" data-act="toBank">בנק · '+L((A.bank||[]).length+'/'+bankCap(A))+' פריטים · הצג</button><button class="btn" data-act="guide">מדריך ציוד: מה הכי חזק ומה כדאי ללבוש</button><h2>מה יש לך</h2><div class="card resgrid">'+res.map(x=>'<div><i class="dot" style="background:'+x[2]+'"></i><span>'+x[0]+'</span><b class="num">'+L(x[1])+'</b></div>').join('')+'</div><h2>ציוד לבוש</h2><button class="btn pri" data-act="bestEq">הלבש את הציוד הכי חזק מהתיק</button><p class="hint">בודק את התיק ומחליף כל חלק בחזק ממנו. ציוד שלבוש על דמות אחרת בחשבון לא זז ממנה. כדי להעביר אותו, צריך קודם להסיר אותו שם.</p><div class="card"><div class="kv"><span>זוהר השריון</span><b style="color:var(--gold)">'+(gn?gn[1]:'עדיין אין')+'</b></div><p class="hint">חמשת חלקי השריון קובעים את הזוהר על הגוף. ממוצע השדרוג שלך '+L('+'+sp[1])+', והחלק הנמוך ביותר '+L('+'+sp[0])+'. נצנוץ בממוצע '+L('+7')+', זוהר ב-'+L('+9')+', זוהר פועם ב-'+L('+11')+'. כשכל החלקים ב-'+L('+13')+' נדלקת הילת להבה סביב כל הגוף, וב-'+L('+15')+' היא מחליפה צבעים.</p>'+
    '<div class="kv" style="margin-top:6px"><span>אבני שלמות</span><b class="num" style="color:#7dffb0">'+L(A.jewels||0)+'</b></div><p class="hint">פריט אקסלנט נופל לעיתים רחוקות ונושא אופציות נוספות, עד כל האופציות של החלק. אבן שלמות מוסיפה לו אופציה חסרה. האבנים נופלות מבוסים ונמכרות בחנות הריסט ובחנות העונה.</p></div><div class="items">';
  for(const k of SLOTS)h+=S.eq[k]?itemCard(S.eq[k]):'<div class="it empty">'+SLOTN[k]+'</div>';
  h+='</div>';
  {const n=exCount(S);if(n)h+='<div class="card" style="display:block;border-color:#7dffb0"><b style="color:#7dffb0">בונוס אקסלנט מלא · '+L(n+'/6')+'</b>'+EXB.map(b=>'<div class="kv"'+(n>=b[0]?' style="color:#7dffb0"':'')+'><span style="color:inherit">'+L(b[0])+' חלקים</span><b>'+AFF[b[1]][0]+' '+L('+'+b[2]+'%')+'</b></div>').join('')+'</div>';}
  const sc=setCounts(S);for(const z in sc)h+='<div class="card r4"><b style="color:var(--r4)">סט עתיק: '+setName(z)+' · '+L(sc[z]+'/6')+'</b>'+setLines(z,sc[z])+'</div>';
  h+='<div class="card" style="display:flex;flex-direction:column;gap:8px">'+tog('לבש אוטומטית ציוד חזק יותר',A.autoEq,'autoEq')+
    '<div><span style="font-size:13px">מה להרים מהרצפה</span><div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:5px">'+[['0','רגיל'],['1','קסום'],['2','נדיר'],['3','אגדי'],['4','עתיק'],['set','חלקי סט'],['g','כנפיים'],['ex','אקסלנט']].map(x=>'<button class="btn sm pk'+(pickOf(A)[x[0]]?' on':'')+'" data-act="pickup" data-k="'+x[0]+'">'+(pickOf(A)[x[0]]?'\u2713 ':'\u2715 ')+x[1]+'</button>').join('')+'</div><p class="hint" style="margin-top:4px">ירוק עם \u2713: הדמות מרימה. אפור עם \u2715: נשאר על הרצפה. זהב, אבני נשמה, תיבות ושברים נאספים תמיד.</p></div>'+
    '<div class="tog"><span>מכירה אוטומטית</span><button class="btn sm" data-act="autoSell">'+['כבויה','רגיל','רגיל וקסום','עד נדיר','עד אגדי'][A.autoSell|0]+'</button></div>'+
    '<p class="hint">בכל תיבה יש סיכוי קטן לחיית מחמד: '+PETN.map((n,i)=>'<span style="color:'+RAR[i].c+'">'+n+' או '+PETN2[i]+' '+L((PET_BOX[i]*100)+'%')+' · '+L(PET_DAYS[i])+' ימים</span>').join(' · ')+'. בתיבת עונה הסיכוי כפול.</p>'+
    '<div class="tog"><span>תיבות אוצר: '+L(A.boxes)+'</span><button class="btn sm pri" data-act="openBox" data-k=""'+(A.boxes?'':' disabled')+'>פתח תיבה</button></div>'+
    '<div class="tog"><span>תיבות עונה: '+L(A.sboxes)+' · 15% לחלק סט עתיק</span><button class="btn sm pri" data-act="openBox" data-k="s"'+(A.sboxes?'':' disabled')+'>פתח תיבה</button></div>'+
    '<div class="kv"><span>קמעות הגנה</span><b>'+L(A.charms)+'</b></div></div>';
  {const bk=A.bank||[];h+='<h2 id="bankSec" style="color:var(--gold)">בנק '+L(bk.length+'/'+bankCap(A))+'</h2>'+(bk.length?'<div class="items">'+bk.slice().sort((a,b)=>b.r-a.r||b.t-a.t||b.p-a.p).map(it=>itemCard(it)).join('')+'</div>':'<p class="hint">הבנק ריק. לוחצים על פריט בתיק ואז על "לבנק" כדי לשמור אותו כאן. מה שבבנק לא נמכר במכירה מהירה ולא תופס מקום בתיק.</p>');}
  h+='<h2>תיק משותף '+L(A.inv.length+'/'+BAG)+'</h2>';
  if(!A.inv.length)h+='<p class="hint">התיק ריק. פריטים נופלים ממפלצות ומבוסים. פריט עתיק שייך לסט של המפה שבה נפל, ושישה חלקים נותנים את כל בונוסי הסט.</p>';
  else{const inv=A.inv.slice().sort((a,b)=>b.r-a.r||b.t-a.t||b.p-a.p);h+='<div class="items">'+inv.map(it=>itemCard(it)).join('')+'</div><p class="hint">מכירה מהירה לפי צבע. תופיע בקשת אישור לפני המכירה. פריטי אקסלנט וכנפיים לא נמכרים כך.</p><div class="sellrow">'+
    RAR.map((q,i)=>{const n=A.inv.filter(it=>it.r===i&&it.s!=='g'&&!it.ex).length;return '<button class="btn sm" data-act="sellAsk" data-r="'+i+'" style="border-color:var(--r'+i+');color:var(--r'+i+')"'+(n?'':' disabled')+'>'+q.n+' · '+L(n)+'</button>';}).join('')+(()=>{const n=A.inv.filter(it=>it.ex&&it.s!=='g'&&it.s!=='y'&&!isFull(it)).length;return '<button class="btn sm" data-act="sellAsk" data-r="9" style="border-color:#7df9ff;color:#7df9ff"'+(n?'':' disabled')+'>אקסלנט · '+L(n)+'</button>';})()+'</div>';}
  return h;
}
function renderZones(){
  let h='<p class="hint">בכל מפה שלוש קומות: בכל קומה המפלצות חזקות יותר, ויש יותר ניסיון, זהב וסיכוי לשלל. עוברים בין קומות ומפות דרך השערים שבקצוות, או בקפיצה מכאן. שער חדש נפתח אחרי ניצחון על הבוס של המפה. הבוס מופיע אחרי '+L(BOSSN)+' חיסולים כשאתה משחק בעצמך.</p>';
  h+='<div class="card zone'+(SC.zi<0?' cur':'')+'"><div class="sw" style="background:linear-gradient('+TOWN.sky[0]+','+TOWN.sky[1]+')"></div><div class="z"><b>'+TOWN.n+'</b><small>נפח, סוחרת, שומר המעגל, כרוז העונה, שער הזירה</small></div><button class="btn sm" data-act="zone" data-i="-1"'+(SC.zi<0?' disabled':'')+'>'+(SC.zi<0?'כאן':'קפוץ')+'</button></div>';
  ZONES.forEach((z,i)=>{const opened=gmWalk()||(z.castle?!!(guild.mine&&guild.mine.castle):z.req?S.resets>=z.req:i<=A.open),lv=z.min<=S.lvl,zf=zoneInfo(i,C,AFK),cur=SC.zi===i;
    if(i<BASEZ&&i%REGION===0)h+='<h2>אזור '+L(i/REGION+1)+' · ציוד '+TIERN[tierOf(i)-1]+'</h2>';
    if(z.castle)h+='<h2>העיר העתיקה</h2><p class="hint">הפרס של הגילדה שמחזיקה בטירה. מפלצות קשות, ציוד בדרגת '+TIERN[tierOf(i)-1]+', וחלקי סט עתיק נופלים כאן מעט יותר מאשר במפות הריסט. מי שהגילדה שלו מאבדת את הטירה יוצא מהעיר.</p>';
    if(z.x===1)h+='<h2 style="color:#b79cff">ארצות הריק</h2><p class="hint">מעבר לסוף הדרך. המפלצות כאן הורגות במכה את מי שלא סיים לבנות את הדמות שלו. רק כאן נופל ציוד הריק, החזק ביותר במשחק, ושני הסטים שלו נותנים פי אחד וחצי מכל סט אחר. חלקי הסט העתיק נופלים כאן באקראי ולעיתים רחוקות מאוד: סט שלם הוא עבודה של חודשים.</p>';
    if(i===BASEZ)h+='<h2>מפות ריסט</h2><p class="hint">נפתחות לפי מספר הריסטים של הדמות. המפלצות חזקות יותר, הניסיון והזהב גבוהים יותר, והציוד בדרגות חדשות עם סטים עתיקים משלו. נכנסים אליהן מכאן.</p>';
    h+='<div class="card zone'+(cur?' cur':'')+(opened&&lv?'':' lock')+'"><div class="sw" style="background:linear-gradient('+z.sky[0]+','+z.sky[1]+')"></div><div class="z"><b>'+z.n+'</b>'+
      '<small>'+z.m+' · מרמה '+L(z.min)+(opened&&lv?' · '+L(fmt(zf.xps*60))+' ניסיון לדקה בלי לשחק'+(zf.e<1?' · מסוכן':''):'')+'</small>'+
      '<small>שלל: ציוד '+TIERN[tierOf(i)-1]+' עם בונוס '+AFF[z.sig][0]+(z.wing?' · '+WINGN[z.wing-1]:'')+' · סט '+SETN[tierOf(i)-1]+'</small>'+
      (!opened?'<small style="color:var(--bad)">'+(z.castle?'פתוחה רק לגילדה שמחזיקה בטירה':z.req?'נפתח אחרי '+L(z.req)+' ריסטים של הדמות (יש '+L(S.resets)+')':'נעול: הבס את הבוס של '+ZONES[i-1].n)+'</small>':!lv?'<small style="color:var(--bad)">צריך רמה '+z.min+'</small>':'')+'</div>'+
      (opened&&lv?'<div style="display:flex;flex-direction:column;gap:4px">'+[0,1,2].map(f=>{const ok=S.lvl>=floorMin(i,f),here=cur&&SC.fl===f;return '<button class="btn sm" data-act="zone" data-i="'+i+'" data-f="'+f+'"'+(ok&&!here?'':' disabled')+'>'+(here?'כאן':'קומה '+(f+1)+(ok?'':' · '+L(floorMin(i,f))))+'</button>';}).join('')+'</div>':'')+'</div>';});
  return h;
}
function shopList(name,list,have,curName){
  const top=name==='reset'?G.topResets(A):0;let lastNeed=0;
  return list.map(o0=>{let o=o0;if(o.k==='pots'){const n=A.pots==null?G.POT_START:A.pots;o=Object.assign({},o,{cost:G.potCost(S),d:o.d+'. יש לך '+L(n)});}let dis=have<o.cost||(o.k==='pots'&&(A.pots==null?G.POT_START:A.pots)+G.POT_PACK>G.POT_MAX),head='',note='';if(o.k==='bless'&&A.bless>=10)dis=true;
    if(name==='reset'){const lf=G.resetLeft(A,o),lock=top<o.need;if(o.need!==lastNeed){lastNeed=o.need;head='<p class="hint" style="margin:12px 0 4px"><b>'+(o.need<=1?'מהריסט הראשון':'מריסט '+L(o.need))+'</b>'+(lock?' · נעול. חסרים לך '+L(o.need-top)+' ריסטים':'')+'</p>';}
      if(lf[0]>=0)note=' · נשארו '+L(lf[0])+' השבוע';if(lf[1]>=0)note+=' · נשארו '+L(lf[1])+' בסך הכול';
      if(lock)return head+'<div class="card shop" style="opacity:.5"><div class="z"><b>'+o.t+'</b>'+(o.d?'<small>'+o.d+'</small>':'')+'</div><button class="btn sm" disabled>ריסט '+L(o.need)+'</button></div>';
      if(lf[0]===0||lf[1]===0)dis=true;
      return head+'<div class="card shop"><div class="z"><b>'+o.t+'</b><small>'+(o.d||'')+note+'</small></div><button class="btn sm'+(dis?'':' pri')+'" data-act="buy" data-s="'+name+'" data-k="'+o.k+'"'+(dis?' disabled':'')+'>'+L(fmt(o.cost))+' '+curName+'</button></div>';}if(o.k==='bankx'&&(A.bankX|0)>=3)dis=true;
    if(o.k==='wsk1'||o.k==='wsk2'){const id=o.k==='wsk1'?1:2;if((A.wsk||[]).indexOf(id)>=0)return '<div class="card shop"><div class="z"><b>'+o.t+'</b><small>'+o.d+'</small></div><button class="btn sm'+((A.wskOn|0)===id?'':' pri')+'" data-act="buy" data-s="'+name+'" data-k="'+o.k+'">'+((A.wskOn|0)===id?'הסר':'לבש')+'</button></div>';}
    return '<div class="card shop"><div class="z"><b>'+o.t+'</b>'+(o.d?'<small>'+o.d+'</small>':'')+'</div><button class="btn sm'+(dis?'':' pri')+'" data-act="buy" data-s="'+name+'" data-k="'+o.k+'"'+(dis?' disabled':'')+'>'+L(fmt(o.cost))+' '+curName+'</button></div>';}).join('');
}
function renderShop(){
  let h=renderCredits()+renderMarket()+'<h2>חנות אותות ריסט</h2><p class="hint">אותות מקבלים רק מריסט. יש לך '+L(A.cred)+'. המדפים נפתחים לפי מספר הריסטים של הדמות הכי מתקדמת שלך ('+L(G.topResets(A))+'), וחלק מהמוצרים מוגבלים בכמות לשבוע.'+((A.areset|0)>0?' ריסטים אוטומטיים שנותרו: '+L(A.areset|0)+'.':'')+'</p>'+shopList('reset',RESET_SHOP,A.cred,'אותות');
  {const cas=!!(guild.mine&&guild.mine.castle)||gmWalk();h+='<h2>חנות העיר העתיקה</h2><p class="hint">נקודות עתיקות נופלות רק ממפלצות בעיר העתיקה, כשמשחקים שם בעצמך, ועד '+CITY_WEEK+' בשבוע. יש לך '+L(A.anc|0)+'. השבוע אספת '+L((A.week&&A.week.anc)|0)+' מתוך '+CITY_WEEK+'.'+(cas?'':' החנות פתוחה רק לגילדה שמחזיקה בטירה.')+'</p>'+shopList('city',CITY_SHOP,cas?A.anc|0:-1,'נקודות');}
  h+='<h2>חנות זהב</h2>'+(A.boost>Date.now()?'<p class="hint">מגילת ניסיון פעילה עוד '+fmtT((A.boost-Date.now())/1000)+'.</p>':'')+shopList('gold',GOLD_SHOP,A.gold,'זהב');
  h+='<h2>חנות העונה</h2><p class="hint">מטבעות עונה מקבלים מהפס, מריסטים ומהזירה.</p>'+shopList('season',SEASON_SHOP,A.coins,'מטבעות');
  return h;
}
const mmss=s=>{s=Math.max(0,Math.round(s));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');};
const OBJN={k:'חיסולים',b:'בוסים',w:'ניצחונות',q:'תשובה נכונה'};
function renderEvents(){
  const now=Date.now(),wins=evWindows(now,10),ev=A.ev||{};
  let h='';{const bo=boostNow(Date.now());if(bo)h+='<div class="card zone cur" style="display:block"><div class="kv"><b style="color:var(--gold)">בונוס לכולם פעיל</b><b class="num" style="color:var(--good)">'+L(mmss((bo.until-Date.now())/1000))+'</b></div><p class="hint">ניסיון ×'+L(bo.xp)+' · שלל ×'+L(bo.drop)+'. הופעל על ידי מנהל המשחק.</p></div>';}
  h+='<h2>אירועים</h2><p class="hint">האירועים רצים לפי השעון, בשעון ישראל. בונוסים ומשימות נספרים רק כשמשחקים בפועל.</p>';
  for(const e of EVENTS){
    const w=wins.find(x=>x.e.id===e.id),rec=w&&ev[w.key]||{},on=w&&w.live;
    // an event that is over for this player (the world boss fell, the prize was taken) no longer reads as running
    const fin=!!(on&&((e.world&&world&&world.key===w.key&&world.dead)||(e.obj&&rec.c))),live=on&&!fin;
    let tierLine='',tn='';
    if(e.tiered){const t=rec.tr||evTier(S.lvl),nx=evTier(S.lvl)+1;
      if(!t)tierLine='<p class="hint" style="color:var(--bad)">הכניסה מרמה '+L(TIER_MIN[0])+'. חסרות לך '+L(TIER_MIN[0]-S.lvl)+' רמות.</p>';
      else{const rg=tierRange(t),rw=tierReward(t);tn=' '+t;
        tierLine='<div class="tiers">'+TIER_MIN.map((m,i)=>'<i class="'+(i+1===t?'on':i+1<t?'past':'')+'">'+(i+1)+'</i>').join('')+'</div><p class="hint"><b style="color:var(--gold)">דרגה '+L(t)+'</b> · רמות '+L(rg[0]+'-'+rg[1])+'</p>'+
          (nx<=7&&!rec.tr?'<p class="hint" style="color:#8fd3ff">עוד '+L(TIER_MIN[nx-1]-S.lvl)+' רמות לדרגה '+L(nx)+'. תגיע לפני שהשער נפתח.</p>':'');}}
    h+='<div id="ev_'+e.id+'" class="card'+(live?' zone cur':'')+'" style="display:block"><div class="kv"><b'+(live?' style="color:var(--gold)"':'')+'>'+e.n+tn+'</b><b class="num" style="color:var(--'+(live?'good':'dim')+')">'+(live?'פעיל · '+L(mmss((w.end-now)/1000)):fin?'הסתיים · הבא בעוד '+fmtT(evNext(e,now)):'בעוד '+fmtT(evNext(e,now)))+'</b></div>'+
      '<p class="hint">'+e.d+' · '+e.when+(e.rt&&!e.tiered?' · פרס: '+e.rt:'')+'</p>'+tierLine+(e.tiered?keepCard(e,w,rec,live):'')+(e.world?worldCard(w,on):'')+(e.br?brCard(live):'');
    if(w&&e.obj){
      const have=Math.min(rec[e.obj[0]]||0,e.obj[1]),done=have>=e.obj[1];
      if(e.id==='quiz'&&live&&!rec.t){const q=quizFor(w.key);h+='<p style="margin:8px 0 6px;font-weight:700">'+q.q+'</p><div class="grid2">'+q.o.map((o,i)=>'<button class="btn sm" data-act="answer" data-i="'+i+'">'+L(o)+'</button>').join('')+'</div>';}
      else if(e.id==='quiz'&&rec.t&&!rec.q)h+='<p class="hint" style="color:var(--bad)">תשובה שגויה. נתראה בחידון הבא.</p>';
      else h+='<div class="bar gold" style="margin:8px 0 6px"><i style="width:'+(have/e.obj[1]*100)+'%"></i></div><div class="kv"><span>'+OBJN[e.obj[0]]+'</span><b class="num">'+L(have+'/'+e.obj[1])+'</b></div>';
      if(done)h+='<button class="btn pri" style="width:100%" data-act="claimEvent" data-k="'+e.id+'"'+(rec.c?' disabled':'')+'>'+(rec.c?'הפרס נאסף':'אסוף פרס')+'</button>';
    }
    h+='</div>';
  }
  return h;
}
const PICON={
  coins:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="#b98cff" stroke="#f1e4ff" stroke-width="1.5"/><circle cx="12" cy="12" r="4.5" fill="none" stroke="#f1e4ff" stroke-width="1.5"/></svg>',
  gems:'<svg viewBox="0 0 24 24"><path d="M6 4h12l4 6-10 11L2 10z" fill="#4fc3ff" stroke="#e6f8ff" stroke-width="1.2"/><path d="M2 10h20M9 4l-2 6 5 11 5-11-2-6" fill="none" stroke="#e6f8ff" stroke-width="1"/></svg>',
  sboxes:'<svg viewBox="0 0 24 24"><rect x="3" y="10" width="18" height="10" rx="2" fill="#a637ee" stroke="#f3dcff" stroke-width="1.2"/><path d="M3 10c0-4 4-6 9-6s9 2 9 6z" fill="#7a22c4" stroke="#f3dcff" stroke-width="1.2"/><rect x="10.5" y="8.5" width="3" height="5" rx="1" fill="#ffd75e"/></svg>',
  wing:'<svg viewBox="0 0 24 24"><path d="M12 19C9 12 5 9 1 8c1 4 3 6 5 7-2 0-3 0-4-1 1 3 4 5 10 5zM12 19c3-7 7-10 11-11-1 4-3 6-5 7 2 0 3 0 4-1-1 3-4 5-10 5z" fill="#ffd75e" stroke="#fff6cf" stroke-width="1"/></svg>'};
let passSeen=-1,passScroll=null;
function renderPass(){
  const lv=passLevel(S),d=new Date(),end=new Date(d.getFullYear(),d.getMonth()+(d.getMonth()%2?1:2),1),days=Math.ceil((end-d)/864e5),xp=lv>=PASS_MAX?100:Math.floor(A.pass.xp%PASS_STEP/PASS_STEP*100),pd=Math.min(PASS_DAY,A.daily.pxp||0),wait=lv-A.pass.claimed;
  let nextBig=0;for(const m of [20,40,60])if(m>A.pass.claimed){nextBig=m;break;}
  let h=loginCard()+renderEvents()+'<h2>פס העונה</h2><div class="passHead"><div class="plv"><small>רמה</small><b>'+lv+'</b><small>מתוך '+PASS_MAX+'</small></div><div class="pinfo">'+
    '<div class="kv"><span>'+(lv>=PASS_MAX?'הגעת לרמה המרבית':'ניסיון לרמה '+(lv+1))+'</span><b class="num">'+L(lv>=PASS_MAX?'100%':(A.pass.xp%PASS_STEP)+'/'+PASS_STEP)+'</b></div>'+
    '<div class="bar gold big"><i style="width:'+xp+'%"></i></div>'+
    '<small>'+(nextBig?'הפרס הגדול הבא: <b>'+passReward(nextBig).t+'</b> ברמה '+nextBig+(nextBig>lv?', עוד '+(nextBig-lv)+' רמות':', מחכה לאיסוף')+' · ':'')+'נשארו '+L(days)+' ימים לעונה</small></div></div>'+
    '<div class="card" style="display:block"><div class="kv"><span>ניסיון לפס ממשחק היום</span><b class="num"'+(pd>=PASS_DAY?' style="color:var(--good)"':'')+'>'+L(pd+'/'+PASS_DAY)+'</b></div><div class="bar gold"><i style="width:'+Math.round(pd/PASS_DAY*100)+'%"></i></div><p class="hint">העונה נמשכת חודשיים. חיסולים, ריסטים וניצחונות בזירה מקדמים את הפס עד '+L(PASS_DAY)+' ביום, והמשימות היומיות מתווספות מעל זה. מי שמשחק כל יום מסיים בנחת.</p></div>';
  h+='<div class="track" id="passTrack">';
  for(let i=1;i<=PASS_MAX;i++){const rw=passReward(i),got=i<=A.pass.claimed,open=!got&&i<=lv,cur=i===lv+1,big=!!rw.wing||rw.feathers>=3,ic=rw.wing||rw.feathers?'wing':rw.sboxes?'sboxes':rw.gems?'gems':'coins';
    h+='<div class="tier'+(got?' got':open?' open':cur?' cur':'')+(big?' big':'')+'"><b>'+i+'</b><span class="pic">'+PICON[ic]+'</span><em>'+rw.t+'</em><i>'+(got?'נאסף':open?'מוכן':cur?L(xp+'%'):'נעול')+'</i></div>';}
  h+='</div>';
  h+='<button class="btn pri'+(wait>0?' glow':'')+'" data-act="claimPass"'+(wait>0?'':' disabled')+'>'+(wait>1?'אסוף '+wait+' פרסים':wait===1?'אסוף פרס רמה '+(A.pass.claimed+1):'אין פרס לאיסוף כרגע')+'</button>';
  h+=sideCard();
  h+='<h2>משימות יומיות</h2><p class="hint">מתאפסות בחצות. חלק מקדמות את הפס וחלק נותנות פרס מיידי.</p>';
  const taskRow=(t,v,done,act)=>{v=Math.min(v||0,t.n);const ready=v>=t.n&&!done;
    return '<div class="card shop task'+(done?' done':'')+'"><div class="z"><b>'+t.t+'</b><div class="bar'+(ready||done?' gold':'')+'"><i style="width:'+Math.round(v/t.n*100)+'%"></i></div><small>'+L(fmt(v)+'/'+fmt(t.n))+' · '+(t.rt?t.rt:L('+'+t.xp)+' ניסיון לפס')+'</small></div><button class="btn sm'+(ready?' pri glow':'')+'" data-act="'+act+'" data-k="'+t.k+'"'+(ready?'':' disabled')+'>'+(done?'נאסף':'אסוף')+'</button></div>';};
  for(const t of TASKS)h+=taskRow(t,A.daily[t.f||t.k],A.daily.done[t.k],'claimTask');
  const wk=A.week||{done:{}},wd=new Date(),left=7-wd.getDay();
  h+='<h2>משימות שבועיות</h2><p class="hint">מתאפסות במוצאי שבת, בעוד '+L(left)+' ימים. כל אחת נותנת גם '+L(120)+' ניסיון לפס.</p>';
  for(const t of WEEKLY)h+=taskRow(t,wk[t.k],wk.done&&wk.done[t.k],'claimWeek');
  return h;
}
// Keep the reward track where the player scrolled it; the first time, bring the current level into view.
function passTrackFix(first){
  const t=$('passTrack');if(!t)return;
  if(passScroll!=null&&!first){t.scrollLeft=passScroll;}
  else{const c=t.querySelector('.tier.open')||t.querySelector('.tier.cur');if(c)t.scrollLeft=c.offsetLeft-t.offsetLeft-(t.clientWidth-c.offsetWidth)/2;}
  passScroll=t.scrollLeft;t.addEventListener('scroll',()=>{passScroll=t.scrollLeft;},{passive:true});
}
function renderParty(){
  let h='<h2>פארטי</h2>';
  if(!ONLINE)return h+'<p class="hint">פארטי עובד רק במצב מקוון, מול השרת.</p>';
  const per=Math.round(PARTY_XP*100),buffs=Object.keys(AURAS).map(k=>'<div class="kv"><span>'+esc(CLS[k].n)+' · '+esc(AURAS[k].n)+'</span><b'+(auras.includes(k)?' style="color:var(--good)"':'')+'>'+L('+')+esc(AURAS[k].d)+(auras.includes(k)?' · פעיל':'')+'</b></div>').join('');
  const rules='<p class="hint">עד חמישה שחקנים. כל מקצוע נותן באף משלו לחברי הפארטי שנלחמים איתו באותה מפה, גם מול בוסים. מהשחקן השלישי באותה מפה, כל חבר מוסיף '+L(per+'%')+' ניסיון, עד '+L(per*3+'%')+'. בנוסף, כל חיסול של חבר במפה שלך נותן לך עד '+L(Math.round(PARTY_SHARE*100)+'%')+' מהניסיון שלו. עד 15 רמות הפרש מקבלים הכול, ומשם זה יורד, עד '+L('15%')+' מהסכום בהפרש של 100 רמות ומעלה.</p>'+buffs;
  if(!party.code)return h+'<div class="card" style="display:flex;flex-direction:column;gap:8px">'+rules+'<p class="hint">חברי פארטי יכולים גם למכור פריטים ישירות זה לזה.</p>'+
    '<input type="text" id="pname" maxlength="14" placeholder="שם של שחקן מחובר" autocomplete="off"><button class="btn pri" data-act="pinvite">הזמן לפארטי</button><p class="hint">השחקן מקבל שאלה ועונה כן או לא. אפשר גם ללחוץ על שחקן במפה או ברשימת השחקנים ולהזמין משם.</p><button class="btn" data-act="pcreate">צור פארטי</button><input type="text" id="pcode" maxlength="6" placeholder="קוד פארטי של חבר" autocomplete="off" dir="ltr"><button class="btn" data-act="pjoin">הצטרף עם קוד</button></div>';
  h+='<div class="card"><div class="kv"><span>קוד להזמנת חברים</span><b class="num" dir="ltr" style="letter-spacing:2px;color:var(--gold)">'+esc(party.code)+'</b></div>';
  for(const m of party.members)h+='<div class="kv"><span><i class="dot" style="background:var(--'+(m.active?'good':'line')+')"></i>'+esc(m.n)+(m.me?' (אתה)':'')+(m.leader?' · מוביל':'')+'</span><b>רמה '+L(m.l)+' · '+esc(zoneName(clamp(m.zone|0,-1,ZONES.length-1)))+'</b></div>';
  if(party.members.length<5)h+='<div style="display:flex;gap:6px;margin-top:8px"><input type="text" id="pname" maxlength="14" placeholder="שם של שחקן מחובר" autocomplete="off" style="flex:1"><button class="btn sm pri" data-act="pinvite">הזמן</button></div>';
  return h+'<div style="margin-top:6px">'+rules+'</div><p class="hint" style="margin-top:6px">איתך במפה עכשיו: '+L(partyN)+' חברים. בונוס ניסיון: '+L(Math.round(partyXp(partyN)*100)+'%')+'.</p><button class="btn sm" data-act="pleave">עזוב פארטי</button></div>';
}
function renderArena(){
  const arenaOpps=A.opps||[];
  let h=renderTrial()+renderTower()+renderFriends()+(ONLINE&&liveDuels.length?'<h2>קרבות חיים עכשיו</h2>'+liveDuels.map(x=>'<div class="card opp"><div class="z"><b>'+esc(String(x.a))+' נגד '+esc(String(x.b))+'</b><small>דו-קרב חי</small></div><button class="btn sm pri" data-act="watch" data-id="'+(x.id|0)+'"'+(SC.mode==='farm'?'':' disabled')+'>צפה</button></div>').join(''):'')+renderTop()+renderGuild()+renderParty()+'<h2>זירה</h2><div class="card"><div class="grid2"><div class="kv"><span>דירוג</span><b class="num" style="color:var(--gold)">'+A.rating+'</b></div><div class="kv"><span>כרטיסים היום</span><b class="num">'+A.tickets+'</b></div></div>'+
    '<p class="hint" style="margin-top:6px">קרב חי, שום דבר לא קורה לבד: זזים עם החיצים, תוקפים, ומפעילים שלושה כישורים, מגן, צעד חמיקה ושלושה שיקויים. מכת המהמם עוצרת את היריב לרגע, המגן בולם 60% מהנזק, ובזמן חמיקה אי אפשר לפגוע בך. כשהיריב לא מחובר, המשחק מפעיל את הדמות שלו עם הציוד האמיתי שלו. במקלדת: רווח לתקיפה, 1 עד 4 לכישורים, Q לחמיקה, E לשיקוי. '+(ONLINE?'הדמות שלך שמורה בשרת ומופיעה לשחקנים אחרים.':'מצב מקומי: יוצגו רק דמויות אימון.')+'</p>'+(A.pd?'<button class="btn pri glow" data-act="fight" data-i="0">חזור לקרב שהתחלת</button>':'')+'</div><h2>יריבים</h2>';
  arenaOpps.forEach((o,i)=>{h+='<div class="card opp"><div class="z"><b>'+esc(o.n)+'</b>'+(o.bot?'<span class="tag">דמות אימון</span>':'')+
    '<small>'+CLS[o.c].n+' · רמה '+L(o.l)+' · ריסטים '+L(o.r)+' · כוח '+L(fmt(o.p))+'</small></div><button class="btn sm pri" data-act="fight" data-i="'+i+'"'+(A.tickets>0&&SC.mode==='farm'?'':' disabled')+'>הילחם</button></div>';});
  if(!arenaOpps.length)h+='<p class="hint">טוען יריבים...</p>';
  h+='<button class="btn" data-act="reroll">החלף יריבים</button>';
  return h;
}
function renderPanel(){
  panelDirty=false;const p=$('panel');
  p.innerHTML=tab==='char'?renderChar():tab==='gear'?renderGear():tab==='zones'?renderZones():tab==='shop'?renderShop():tab==='pass'?renderPass():tab==='chat'?renderChat():renderArena();
  if(tab==='pass')passTrackFix(false);
  if(tab==='chat'){const l=$('chatList');if(l)l.scrollTop=l.scrollHeight;renderChatBar();}
}
function openSheet(id){
  const f=findItem(id);if(!f){closeSheet();return;}const it=f.it,v=itemVals(it),uc=upCost(it);
  let diff='';if(f.eq==null){const old=S.eq[it.s];S.eq[it.s]=it;const p2=calc(S).power;S.eq[it.s]=old;const d=p2-C.power;diff='<div class="kv"><span>שינוי בכוח הלחימה אם תלבש</span><b class="num" style="color:var(--'+(d>=0?'good':'bad')+')">'+L((d>=0?'+':'-')+fmt(Math.abs(d)))+'</b></div>';}
  let h='<h3 class="r'+it.r+'" style="color:var(--r'+it.r+')">'+esc(itemName(it,S.cls))+(it.p?' '+L('+'+it.p):'')+'</h3>'+
    '<p class="hint">'+RAR[it.r].n+' · דרגה '+L(it.t)+(it.z>=0?' · מקור: '+ZONES[it.z].n:'')+'</p>'+
    (it.pf?'<p class="extag" style="color:#ffd75e">עתיק מושלם · כל האופציות · בסיס חזק ב-'+L(Math.round((PERFECT_M-1)*100)+'%')+'</p>':it.ex?'<p class="extag">'+(isFull(it)?'אקסלנט מלא · כל ':'אקסלנט · ')+L(it.af.length+'/'+POOL[it.s].length)+' אופציות</p>':'')+'<div>';
  if(it.s==='w')h+='<div class="kv"><span>נזק נשק</span><b class="num">'+fmt(v.atk)+'</b></div>';
  if(ARM[it.s])h+='<div class="kv"><span>חיים</span><b class="num">'+fmt(v.hp)+'</b></div><div class="kv"><span>הגנה</span><b class="num">'+v.def+'</b></div>';
  if(it.s==='y')h+='<div class="kv"><span>זמן</span><b class="num">'+petLeft(it)+'</b></div><p class="hint">חיית מחמד הולכת איתך, נותנת את הבונוסים שלמטה, ומוכרת בשבילך את מה שמסנן האיסוף היה משאיר על הרצפה. הזמן מתחיל בפעם הראשונה שלובשים אותה וממשיך לרוץ גם בתיק. חיה שעוד לא נלבשה אפשר למכור בשוק השחקנים.</p>';
  if(JEWV[it.s])h+=(v.wd?'<div class="kv"><span>נזק</span><b class="num">'+L('+'+v.wd+'%')+'</b></div>':'')+(v.wh?'<div class="kv"><span>חיים</span><b class="num">'+L('+'+v.wh+'%')+'</b></div>':'');
  if(it.s==='g')h+='<div class="kv"><span>נזק</span><b class="num">'+L('+'+v.wd+'%')+'</b></div><div class="kv"><span>חיים</span><b class="num">'+L('+'+v.wh+'%')+'</b></div><div class="kv"><span>מהירות הליכה</span><b class="num">'+L('+'+it.t*8+'%')+'</b></div>';
  for(const a of it.af)h+='<div class="kv aff"><span style="color:inherit">'+AFF[a[0]][0]+'</span><b class="num">'+L('+'+a[1]+'%')+'</b></div>';
  h+=diff+'</div>';
  if(isSet(it)){const sk=setKey(it),n=setCounts(S)[sk]||0;h+='<div class="card r4"><b style="color:var(--r4)">סט עתיק: '+setName(sk)+' · לבושים '+L(n+'/6')+'</b>'+setLines(sk,n)+'</div>';}
  if(it.s==='g'&&it.t<WING_MAX){const n=wingFeathers(it.t),ok=it.p>=15&&(A.feathers||0)>=n;
    h+='<button class="btn'+(ok?' pri glow':'')+'" data-act="wingEvolve" data-id="'+it.id+'"'+(ok?'':' disabled')+' style="width:100%;margin-bottom:6px">פתח ל'+(S.cls==='lord'?CAPEN:WINGN)[it.t]+' · '+L(n)+' נוצות · '+L(Math.round(wingChance(it.t)*100)+'%')+'</button>'+
      '<p class="hint" style="margin-bottom:6px">'+(it.p<15?'כנפיים מתפתחות לדרגה הבאה רק ב-'+L('+15')+'. ':'')+'יש לך '+L(A.feathers||0)+' נוצות נצח. קונים אותן בחנות העונה, ומקבלים בפס העונה ולעיתים מבוסים. כישלון שורף את הנוצות, הכנפיים נשארות. הדרגה הבאה מתחילה מ-'+L('+0')+' וחלשה מהנוכחית עד שמשדרגים אותה שוב. דרגה '+L(it.t+'/'+WING_MAX)+'.</p>';}
  if(it.ex&&!isFull(it))h+='<button class="btn'+(A.jewels>0?' pri':'')+'" data-act="exAdd" data-id="'+it.id+'"'+(A.jewels>0?'':' disabled')+' style="width:100%;margin-bottom:6px">הוסף אופציה · אבני שלמות: '+L(A.jewels||0)+'</button>';
  if(it.p<15)h+='<p class="hint">שדרוג לדרגה '+L('+'+(it.p+1))+': '+L(uc.gems)+' אבני נשמה ו-'+L(fmt(uc.gold))+' זהב · סיכוי '+L(Math.round(upChance(it)*100)+'%')+(it.p>=7?' · כישלון מוריד דרגה אחת'+(A.charms?' (יש קמע הגנה)':''):'')+'</p>';
  {const q=reqOf(it,S.cls),wr=G.wearResets(it);h+='<div class="kv" style="margin-bottom:6px"><span>דרישות</span><b>'+(wr?'<span style="color:'+(S.resets>=wr?'var(--good)':'#ff5c7a')+'">ריסט '+L(wr)+'</span> · ':'')+Object.keys(q).map(k=>'<span style="color:'+(S.stats[k]>=q[k]?'var(--good)':'#ff5c7a')+'">'+STATN[k][0]+' '+L(fmt(q[k]))+'</span>').join(' · ')+'</b></div>';}
  if(f.bank!=null){h+='<div class="acts"><button class="btn pri" data-act="bankTake" data-id="'+it.id+'"'+(A.inv.length>=BAG?' disabled':'')+'>'+(A.inv.length>=BAG?'התיק מלא':'הוצא לתיק')+'</button><button class="btn" data-act="closeSheet">סגור</button></div>';$('sheetBox').innerHTML=h;$('sheetBox').className='box r'+it.r+gcls(it.p);$('sheet').classList.add('on');return;}
  h+='<div class="acts">'+(f.eq!=null?'<button class="btn" data-act="unequip" data-id="'+it.id+'">הסר</button>':'<button class="btn pri" data-act="equip" data-id="'+it.id+'"'+(canWear(S,it)?'':' disabled')+'>'+(canWear(S,it)?'לבש':S.resets<G.wearResets(it)?'נדרש ריסט '+L(G.wearResets(it)):'חסרים סטטים')+'</button>')+
    '<button class="btn" data-act="upgrade" data-id="'+it.id+'"'+(it.p>=15||A.gems<uc.gems||A.gold<uc.gold?' disabled':'')+'>'+(it.p>=15?'דרגה מרבית':'שדרג')+'</button>'+
    (f.eq==null?'<button class="btn" data-act="sell" data-id="'+it.id+'">מכור ב-'+L(fmt(sellVal(it)))+'</button><button class="btn" data-act="bankPut" data-id="'+it.id+'"'+((A.bank||[]).length>=BANK?' disabled':'')+'>לבנק</button>':'')+
    '<button class="btn" data-act="closeSheet">סגור</button></div>';
  if(f.eq==null)h+='<div class="tog"><label for="mprice">מחיר בשוק השחקנים</label><input type="text" inputmode="numeric" id="mprice" value="'+sellVal(it)*10+'" style="width:110px;padding:6px 8px"><button class="btn sm" data-act="list" data-id="'+it.id+'"'+(ONLINE?'':' disabled')+'>הצע</button></div>'+(ONLINE&&party.members.length>1?'<div class="tog"><label for="mto">למי להציע</label><select id="mto" style="background:#0a0818;color:var(--ink);border:1px solid var(--line);border-radius:10px;padding:6px 8px;font:inherit"><option value="">לכל השחקנים</option>'+party.members.map((m,i)=>m.me?'':'<option value="'+i+'">רק ל-'+esc(m.n)+'</option>').join('')+'</select></div>':'')+(ONLINE?'':'<p class="hint">השוק זמין רק במצב מקוון.</p>');
  $('sheetBox').innerHTML=h;$('sheetBox').className='box r'+it.r+gcls(it.p);$('sheet').classList.add('on');
}
function closeSheet(){$('sheet').classList.remove('on');}
function openModal(html){$('modalBox').innerHTML=html;$('modal').classList.add('on');}
function closeModal(){$('modal').classList.remove('on');}
function showOffline(list){
  list=(list||[]).filter(x=>x.rep.secs>=60&&x.rep.kills>0);if(!list.length)return;
  const sum=k=>list.reduce((n,x)=>n+(x.rep[k]||0),0);
  let h='<h3>בזמן שלא היית</h3><div>';
  for(const x of list)h+='<div class="kv"><span>'+esc(x.name)+' · '+zoneName(x.zone)+' · '+fmtT(Math.min(x.rep.secs,12*3600))+'</span><b class="num">'+L('+'+x.rep.levels)+' רמות</b></div>';
  if(sum('resets'))h+='<div class="kv"><span style="color:var(--gold)">ריסטים אוטומטיים שבוצעו</span><b class="num" style="color:var(--gold)">'+L(sum('resets'))+'</b></div>';
  h+='<div class="kv"><span>מפלצות שחוסלו</span><b class="num">'+fmt(sum('kills'))+'</b></div><div class="kv"><span>זהב</span><b class="num">'+L('+'+fmt(sum('gold')))+'</b></div>'+
    '<div class="kv"><span>אבני נשמה</span><b class="num">'+L('+'+sum('gems'))+'</b></div><div class="kv"><span>תיבות אוצר</span><b class="num">'+L('+'+sum('boxes'))+'</b></div>'+
    '<div class="kv"><span>פריטים שנפלו</span><b class="num">'+sum('items')+' ('+sum('sold')+' נמכרו)</b></div></div>';
  const nb=[];for(const x of list)if(x.rep.notable)for(const it of x.rep.notable)nb.push(it);
  if(nb.length)h+='<p class="hint">שלל בולט: '+nb.slice(-6).map(it=>'<b style="color:var(--r'+it.r+')">'+esc(itemName(it,S.cls))+'</b>').join(', ')+'</p>';
  h+='<p class="hint">בלי לשחק הקצב הוא 70%, ובוסים מופיעים רק כשאתה במפה.</p><div class="acts"><button class="btn pri" data-act="closeModal">המשך</button></div>';openModal(h);
}
let pickCls='blade';
function showCreate(extra){
  const cl=k=>'<button data-act="pick" data-k="'+k+'" data-x="'+(extra?1:'')+'" class="'+(pickCls===k?'on':'')+'">'+CLS[k].n+'<small>'+(k==='blade'?'קרב קרוב':k==='lord'?'עמיד, מחזק את הקבוצה':'קרב מרחוק')+'</small></button>';
  openModal('<h3>'+(extra?'דמות חדשה':'מעגל הנצח')+'</h3><p class="hint">'+(extra?'הדמות החדשה מתחילה בכפר וחולקת איתך זהב, תיק ושערים.':'לוחצים על המסך כדי ללכת, על מפלצת כדי לתקוף, ומפעילים כישורים. מביסים בוסים, פותחים מפות, מגיעים לרמה 400 ועושים ריסט.')+'</p>'+
    '<label for="nm" class="hint">שם הדמות</label><input type="text" id="nm" maxlength="14" value="'+esc($('nm')?$('nm').value:'')+'" placeholder="עד 14 תווים" autocomplete="off">'+
    '<div class="cls">'+cl('blade')+cl('storm')+cl('hunter')+cl('lord')+'</div><div class="acts"><button class="btn pri" data-act="create" data-x="'+(extra?1:'')+'">'+(extra?'צור דמות':'צא לדרך')+'</button>'+(extra?'<button class="btn" data-act="closeModal">ביטול</button>':'')+'</div>');
}
/* ---------- picking up a new version without being asked ---------- */
// BUILD is stamped on every commit, together with version.txt. When the two differ, a newer client is out:
// refresh the cached files and reload. One attempt per version, so a slow deploy cannot cause a reload loop.
async function checkVersion(){
  if(!S||demo||SC.mode!=='farm'||document.hidden)return;
  let v='';try{const r=await fetch('version.txt?t='+Date.now(),{cache:'no-store'});if(!r.ok)return;v=(await r.text()).trim();}catch(e){return;}
  if(!/^[0-9]{14}$/.test(v)||v<=BUILD)return;
  try{if(sessionStorage.getItem('ec-upd')===v)return;sessionStorage.setItem('ec-upd',v);}catch(e){}
  toast('גרסה חדשה, מתעדכן...');
  try{await flushTick();if(!ONLINE)saveLocal();}catch(e){}
  try{await Promise.all(['./','index.html','game.js','core.js','config.js'].map(u=>fetch(u,{cache:'reload'}).catch(()=>null)));}catch(e){}
  location.reload();
}
setInterval(paceTick,5000);setInterval(()=>{if(ONLINE&&S&&!demo){netOpen();askWho();if(tab==='arena')netSend({t:'duels'});}},6000);setInterval(()=>{if(worldWin()||(tab==='pass'&&evWindows(Date.now(),60).some(w=>w.e.world)))loadWorld();},10000);setInterval(checkVersion,60000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(checkVersion,1500);});setTimeout(checkVersion,8000);

/* ---------- full screen and installing as an app ---------- */
const fsEl=()=>document.fullscreenElement||document.webkitFullscreenElement,fsCan=!!(document.documentElement.requestFullscreen||document.documentElement.webkitRequestFullscreen);
const standalone=()=>window.matchMedia('(display-mode: standalone)').matches||window.matchMedia('(display-mode: fullscreen)').matches||navigator.standalone===true;
let installEvt=null;
function fsSync(){const b=$('fsBtn');b.style.display=fsCan&&!standalone()?'':'none';b.textContent=fsEl()?'צא ממסך מלא':'מסך מלא';setTimeout(resize,150);}
function fsToggle(){
  try{const d=document.documentElement;
    if(fsEl())(document.exitFullscreen||document.webkitExitFullscreen).call(document);
    else{const p=(d.requestFullscreen||d.webkitRequestFullscreen).call(d,{navigationUI:'hide'});if(p&&p.catch)p.catch(()=>toast('הדפדפן לא אישר מסך מלא'));}
  }catch(e){toast('הדפדפן לא תומך במסך מלא');}
}
document.addEventListener('fullscreenchange',fsSync);document.addEventListener('webkitfullscreenchange',fsSync);
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installEvt=e;panelDirty=true;if(!prefs.inst){prefs.inst=1;savePrefs();setTimeout(()=>announce('אפשר להתקין את המשחק כאפליקציה. הכפתור בלשונית דמות'),20000);}});
window.addEventListener('appinstalled',()=>{installEvt=null;panelDirty=true;});
// A notification on the phone when the character reaches the reset level while the game is closed.
let pushOn=null,pushKey='';
const pushCan=()=>ONLINE&&!demo&&'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
function pushLoad(){if(!pushCan()||!session)return;post({kind:'pushget',args:{}},session.token).then(r=>{if(r.j&&r.j.ok){pushOn=!!r.j.on;pushKey=String(r.j.key||'');panelDirty=true;}}).catch(()=>{});}
async function pushToggle(){
  if(!pushCan()){toast('הדפדפן הזה לא תומך בהתראות');return;}
  if(!pushKey){try{const r=await post({kind:'pushget',args:{}},session.token);if(r.j&&r.j.ok){pushOn=!!r.j.on;pushKey=String(r.j.key||'');}}catch(e){}}
  if(!pushKey){toast('השרת לא ענה כרגע. נסה שוב בעוד רגע');return;}
  try{
    const reg=await navigator.serviceWorker.register('sw.js');await navigator.serviceWorker.ready;
    if(pushOn){const s=await reg.pushManager.getSubscription();if(s)await s.unsubscribe();await post({kind:'pushoff',args:{}},session.token);pushOn=false;toast('ההתראות כובו');}
    else{if(await Notification.requestPermission()!=='granted'){toast('לא ניתנה הרשאה להתראות. אפשר לשנות את זה בהגדרות הדפדפן');return;}
      const pad='='.repeat((4-pushKey.length%4)%4),raw=atob((pushKey+pad).replace(/-/g,'+').replace(/_/g,'/')),key=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)key[i]=raw.charCodeAt(i);
      const old=await reg.pushManager.getSubscription();if(old)await old.unsubscribe();const sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
      const r=await post({kind:'pushon',args:{sub:sub.toJSON(),lang:getLang()}},session.token);if(r.j&&r.j.ok){pushOn=true;toast('ההתראות פעילות. תקבל הודעה כשהדמות מגיעה לרמה 400',5);}else{await sub.unsubscribe();toast('לא הצלחתי להפעיל התראות');}}
  }catch(e){toast('לא הצלחתי להפעיל התראות');}
  renderPanel();
}
function pushHtml(){
  if(!ONLINE||demo)return '';const ios=/iphone|ipad|ipod/i.test(navigator.userAgent);
  return '<h2>התראות לטלפון</h2><div class="card" style="display:flex;flex-direction:column;gap:8px"><p class="hint">הודעה אחת כשהדמות שהשארת להתאמן מגיעה לרמה 400 ומוכנה לריסט, כשהמשחק סגור. אם קנית ריסטים אוטומטיים, ההודעה מגיעה כשהם נגמרים.</p>'+
    (pushCan()?'<button class="btn'+(pushOn?' on':' pri')+'" data-act="pushToggle">'+(pushOn?'התראות פעילות · כבה':'הפעל התראות')+'</button>':'<p class="hint" style="color:var(--bad)">'+(ios?'באייפון התראות עובדות רק אחרי שמוסיפים את המשחק למסך הבית ופותחים אותו משם.':'הדפדפן הזה לא תומך בהתראות.')+'</p>')+'</div>';
}
function installHtml(){
  if(standalone())return '';
  const ios=/iphone|ipad|ipod/i.test(navigator.userAgent);
  return '<h2>כמו אפליקציה</h2><div class="card" style="display:flex;flex-direction:column;gap:8px">'+
    (installEvt?'<p class="hint">התקנה מוסיפה סמל למסך הבית, והמשחק נפתח במסך מלא בלי שורת הדפדפן.</p><button class="btn pri" data-act="install">התקן את המשחק</button>'
      :ios?'<p class="hint">באייפון: פתח את העמוד בספארי, לחץ על כפתור השיתוף ובחר "הוסף למסך הבית". המשחק ייפתח משם במסך מלא.</p>'
      :'<p class="hint">כדי לקבל סמל במסך הבית: פתח את העמוד בכרום, פתח את התפריט ובחר "הוסף למסך הבית" או "התקן אפליקציה".</p>')+
    (fsCan?'<button class="btn" data-act="fs">'+(fsEl()?'צא ממסך מלא':'מסך מלא עכשיו')+'</button>':'')+'</div>';
}
function setBig(on){prefs.big=!!on;savePrefs();$('app').classList.toggle('wide',prefs.big);$('bigBtn').textContent=prefs.big?'הקטן':'הגדל';resize();}
function openTab(name){
  if(prefs.big)setBig(false);
  tab=name;document.querySelectorAll('#tabs button').forEach(b=>b.classList.toggle('on',b.dataset.tab===tab));
  if(tab==='arena'){loadArena();if(ONLINE&&!demo){send('pget',{});loadGuild();loadTop();}}if(tab==='shop'){loadMarket();loadOrders();}passScroll=null;renderPanel();$('panel').scrollTop=0;
}
function loadArena(){if(!demo&&S)act('opps',{}).then(()=>{panelDirty=true;});}
function enterGame(r){
  S=A.chars[A.cur];C=calc(S,auras);enterZone(S.zone,'L',S.floor);SC.hero.hp=C.hp;SC.hero.dead=0;SC.hero.cds=[0,0,0,0,0,0];SC.hero.climb=null;SC.hero.shield=0;touch();renderHud();renderPanel();
  if(r&&r.afk)showOffline(r.afk);else showLogin();
}
async function switchTo(i){
  if(busy||SC.mode!=='farm')return;busy=true;const r=await act('switch',{i:i});busy=false;
  if(!r.ok){toast(r.msg==='net'?'אין חיבור לשרת':r.msg);return;}
  enterGame(r);saveLocal();
}
function boxFx(r){
  if(!r)return;const h=SC.hero,c=r.it?RAR[r.it.r].c:'#f2c14e';snd(r.it&&r.it.r>=3?'rare':'coin');
  if(r.pet){announce('חיית מחמד יצאה מהתיבה: '+itemName(r.it,S.cls),true);}
  if(r.it)toast(RAR[r.it.r].n+' · '+itemName(r.it,S.cls)+(r.where==='eq'?' (נלבש)':r.where==='sold'?' (נמכר)':''),r.it.r);else toast('מהתיבה: '+r.txt);
  if(SC.mode!=='farm')return;SC.fx.push({k:'beam',x:h.x+30*h.face,y:gy(),life:1.2,c:c});burst(h.x+30*h.face,gy()-10,c,26);
  for(let i=0;i<5;i++)SC.drops.push({x:h.x+30*h.face,y:gy()-10,vx:(Math.random()-.5)*220,vy:-200-Math.random()*120,c:c,s:4.5,age:0,life:4});
}
function accountHtml(){return installHtml()+pushHtml()+accountHtml2();}
function accountHtml2(){
  if(!ONLINE)return '<h2>העברה בין מכשירים</h2><div class="card" style="display:flex;flex-direction:column;gap:8px"><p class="hint">מצב מקומי: ההתקדמות שמורה במכשיר הזה. קוד השמירה מעביר אותה למכשיר אחר, וטעינה מחליפה את מה שיש כאן.</p><button class="btn" data-act="expSave">העתק קוד שמירה</button><input type="text" id="impCode" placeholder="הדבק כאן קוד שמירה" autocomplete="off"><button class="btn" data-act="impSave">טען קוד שמירה</button></div>';
  return '<h2>שפה · Language</h2>'+'<div class="seg notr" style="justify-content:center"><button class="btn sm'+(getLang()==='he'?' pri':'')+'" data-act="lang" data-l="he">עברית</button><button class="btn sm'+(getLang()==='en'?' pri':'')+'" data-act="lang" data-l="en">English</button></div>'+'<h2>חשבון</h2><div class="card" style="display:flex;flex-direction:column;gap:8px"><p class="hint">מחובר כ-<b dir="auto">'+esc(session&&session.user||'')+'</b>. אפשר להיכנס עם אותו שם וסיסמה מכל מכשיר.</p>'+
    (me.secret?'':'<p class="hint" style="color:var(--bad)">עוד לא הוגדרה שאלת שחזור. בלעדיה אי אפשר לשחזר סיסמה שנשכחה.</p>')+
    '<button class="btn'+(me.secret?'':' pri')+'" data-act="acct" data-k="secret">שאלת שחזור</button><button class="btn" data-act="acct" data-k="pass">שינוי סיסמה</button><button class="btn" data-act="tfa">אימות דו-שלבי: '+(me.tfa?'פעיל':'כבוי')+'</button><button class="btn" data-act="settings">הגדרות שליטה: מקשים וגודל כפתורים</button>'+
    (me.admin?'<a class="btn" href="admin.html" style="text-align:center;text-decoration:none;color:inherit">מסך ניהול</a>':'')+
    (me.admin?'<div class="card" style="display:flex;flex-direction:column;gap:6px;border-color:var(--gold)"><b style="color:var(--gold)">כלי מנהל המשחק</b><button class="btn'+(gmWalk()?' pri':'')+'" data-act="gmWalk">'+(gmWalk()?'מעבר חופשי בכל המפות: פעיל':'מעבר חופשי בכל המפות: כבוי')+'</button><p class="hint">כשהמעבר החופשי פעיל, בלשונית מפה כל המפות פתוחות לך, בכל רמה, כולל העיר העתיקה והחנות שלה. כשהוא כבוי הדמויות שלך משחקות לפי החוקים, כמו כל שחקן.</p><p class="hint">רק החשבון שלך רואה את זה, והשרת בודק את ההרשאה מחדש בכל לחיצה. כל פעולה מוכרזת בצ׳אט העולמי.</p>'+
      '<button class="btn pri" data-act="gm" data-a="br" data-sec="90">פתח את המעגל האחרון עכשיו · הרשמה 90 שניות</button><button class="btn sm" data-act="gm" data-a="br" data-sec="30">פתח לבדיקה מהירה · 30 שניות</button><button class="btn sm" data-act="gm" data-a="brStop">בטל הרשמה פתוחה</button>'+
      '<button class="btn pri" data-act="gm" data-a="siegeBots" data-min="12" data-n="4">מצור אימון מול בוטים · 4 מול 4 · 12 דקות</button><button class="btn" data-act="gm" data-a="siegeBots" data-min="15" data-n="6">מצור אימון גדול · 6 מול 6 · 15 דקות</button><p class="hint">הבוטים מחזיקים בטירה ומשחקים כמו שחקנים: מתגים, כתר, קומבו, הדיפה, שיקויים ובאפים. אתה מנהל הצד שלך ורק אתה לוקח את הכתר. שני בוטים שלך הולכים למתגים. המצור לא משנה כלום במשחק.</p>'+
      '<button class="btn pri" data-act="gm" data-a="siege" data-min="10">פתח מצור ידידות ל-10 דקות</button><button class="btn sm" data-act="gm" data-a="siegeStop">סגור מצור שרץ</button>'+
      '<button class="btn" data-act="gm" data-a="boost" data-xp="2" data-drop="1" data-min="60">ניסיון כפול לכולם לשעה</button><button class="btn" data-act="gm" data-a="boost" data-xp="1" data-drop="2" data-min="60">שלל כפול לכולם לשעה</button><button class="btn" data-act="gm" data-a="boost" data-xp="2" data-drop="2" data-min="30">ניסיון ושלל כפולים לחצי שעה</button><button class="btn sm" data-act="gm" data-a="boost" data-min="0">בטל בונוס</button>'+
      '<input id="gmText" maxlength="120" placeholder="הודעה לכל המחוברים" autocomplete="off"><button class="btn" data-act="gm" data-a="say">שלח הודעה לכולם</button></div>':'')+
    '<button class="btn" data-act="logout">התנתק</button><button class="btn sm" data-act="acct" data-k="del" style="color:var(--bad)">מחיקת חשבון</button>'+
    '<p class="hint"><a href="'+PG('terms')+'" target="_blank" rel="noopener">תקנון</a> · <a href="'+PG('privacy')+'" target="_blank" rel="noopener">פרטיות</a></p></div>';
}
let authMode='login';
function showAuth(msg){
  const reg=authMode==='register';
  openModal('<h3>מעגל הנצח</h3>'+'<div class="seg notr" style="justify-content:center"><button class="btn sm'+(getLang()==='he'?' pri':'')+'" data-act="lang" data-l="he">עברית</button><button class="btn sm'+(getLang()==='en'?' pri':'')+'" data-act="lang" data-l="en">English</button></div>'+'<p class="hint">'+(reg?'בחר שם משתמש וסיסמה. איתם נכנסים לחשבון מכל מכשיר.':'היכנס עם שם המשתמש והסיסמה שלך.')+'</p>'+
    '<label for="auUser" class="hint">שם משתמש</label><input type="text" id="auUser" maxlength="16" autocomplete="username" autocapitalize="none" placeholder="4 עד 16 תווים">'+
    '<label for="auPass" class="hint">סיסמה</label><input type="password" id="auPass" maxlength="72" autocomplete="'+(reg?'new-password':'current-password')+'" placeholder="לפחות 8 תווים">'+
    (reg?'<label for="auQ" class="hint">שאלת שחזור, למקרה שתשכח את הסיסמה</label>'+qSelect('auQ')+'<input type="text" id="auA" maxlength="60" placeholder="התשובה שלך" autocomplete="off">':'')+
    (msg?'<p class="hint" style="color:var(--bad)">'+esc(msg)+'</p>':'')+
    '<div class="acts"><button class="btn pri" data-act="authGo">'+(reg?'הרשמה':'כניסה')+'</button></div>'+
    '<button class="btn sm" data-act="authSwap">'+(reg?'יש לי כבר חשבון':'אין לי חשבון, הרשמה')+'</button>'+(reg?'':' <button class="btn sm" data-act="forgot">שכחתי סיסמה</button>')+
    '<p class="hint" style="margin-top:8px">'+(reg?'בהרשמה אתה מאשר את ':'')+'<a href="'+PG('terms')+'" target="_blank" rel="noopener">התקנון</a> '+(reg?'ואת ':'· ')+'<a href="'+PG('privacy')+'" target="_blank" rel="noopener">מדיניות הפרטיות</a></p>');
}
let authKeep=null;
function showCode(msg){openModal('<h3>אימות דו-שלבי</h3><p class="hint">הקלד את הקוד בן 6 הספרות מאפליקציית האימות, או אחד מקודי הגיבוי.</p><input type="text" id="auCode" maxlength="16" inputmode="numeric" autocomplete="one-time-code" placeholder="קוד" dir="ltr">'+(msg?'<p class="hint" style="color:var(--bad)">'+esc(msg)+'</p>':'')+'<div class="acts"><button class="btn" data-act="authBack">חזרה</button><button class="btn pri" data-act="authGo">כניסה</button></div>');}
async function authGo(){
  if(authKeep&&$('auCode')){const k=authKeep,code=($('auCode').value||'').trim();if(code.length<6){showCode('הקלד את הקוד');return;}openModal('<h3>מעגל הנצח</h3><p class="hint">מתחבר...</p>');let r=null;try{r=await post({kind:'login',args:{user:k.user,pass:k.pass,code:code}});}catch(e){}
    if(!r||!r.j){showCode('אין חיבור לשרת. נסה שוב');return;}if(!r.j.ok){if(r.j.tfa)showCode(r.j.msg);else{authKeep=null;showAuth(r.j.msg||'הפעולה נכשלה');}return;}authKeep=null;setSession({token:r.j.token,user:r.j.user});await startOnline();return;}
  authKeep=null;const user=($('auUser').value||'').trim(),pass=$('auPass').value||'';
  if(user.length<3){showAuth('שם משתמש קצר מדי');return;}if(pass.length<8){showAuth('הסיסמה צריכה לפחות 8 תווים');return;}
  const reg=authMode==='register',q=reg?+$('auQ').value:0,ans=reg?($('auA').value||'').trim():'';
  if(reg&&ans.length<2){showAuth('כתוב תשובה לשאלת השחזור');return;}
  openModal('<h3>מעגל הנצח</h3><p class="hint">מתחבר...</p>');
  let r=null;try{r=await post({kind:authMode,args:{user:user,pass:pass,q:q,a:ans}});}catch(e){}
  if(!r||!r.j){showAuth('אין חיבור לשרת. נסה שוב');return;}
  if(!r.j.ok){if(r.j.tfa&&!reg){authKeep={user:user,pass:pass};showCode();return;}showAuth(r.j.msg||'הפעולה נכשלה');return;}
  setSession({token:r.j.token,user:r.j.user});await startOnline();
}
async function startOnline(){
  const r=await send('sync',{});if(banned)return;loadMe();
  if(r.ok){demo=false;closeModal();enterGame(r);return;}
  if(r.msg==='net'){openModal('<h3>אין חיבור לשרת</h3><p class="hint">השרת לא ענה. נסה שוב בעוד רגע.</p><div class="acts"><button class="btn pri" data-act="retry">נסה שוב</button></div>');return;}
  S=A.chars[0];closeModal();showCreate(false);
}
const failTxt=r=>{if(r&&!r.ok)toast(r.msg==='net'?'אין חיבור לשרת':r.msg);};
let clickBusy=false;
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target&&(e.target.id==='auPass'||e.target.id==='auUser'))authGo();});
document.addEventListener('click',async e=>{
  const t=e.target.closest('[data-tab]');if(t){openTab(t.dataset.tab);return;}
  if(e.target.id==='sheet'){closeSheet();return;}
  const b=e.target.closest('[data-act]');if(!b)return;const a=b.dataset.act,id=+b.dataset.id;snd('click');
  if(a==='pick'){pickCls=b.dataset.k;showCreate(!!b.dataset.x);return;}
  if(a==='closeModal'){closeModal();return;}
  if(a==='closeSheet'){closeSheet();return;}
  if(a==='retry'){location.reload();return;}
  if(a==='authSwap'){authMode=authMode==='login'?'register':'login';showAuth();return;}
  if(a==='authGo'){authGo();return;}
  if(a==='forgot'){fg={user:'',q:null};showForgot();return;}
  if(a==='forgotGo'){forgotGo();return;}
  if(a==='authBack'){showAuth();return;}
  if(a==='acct'){acctModal(b.dataset.k);return;}
  if(a==='tfa'){tfaModal(b.dataset.s||'',null);return;}
  if(a==='tfaGo'){tfaGo(b.dataset.s);return;}
  if(a==='acctGo'){acctGo(b.dataset.k);return;}
  if(a==='tut'){tutNext();return;}
  if(a==='keepGo'){enterKeep();return;}
  if(a==='credBuy'){loadOrders().then(()=>showPacks());return;}
  if(a==='ordSend'){ordSend();return;}
  if(a==='ordCancel'){rpc('ocancel',{id:+b.dataset.id}).then(j=>{if(j.orders)myOrders=j.orders;renderPanel();}).catch(()=>{});return;}
  if(a==='sellAsk'&&+b.dataset.r===9){const list=A.inv.filter(it=>it.ex&&it.s!=='g'&&it.s!=='y'&&!isFull(it)),gold=list.reduce((x,it)=>x+sellVal(it),0),up=list.filter(it=>it.p>0).length;if(!list.length)return;
    openModal('<h3 style="color:#7df9ff">למכור את כל האקסלנט?</h3><p class="hint">'+L(list.length)+' פריטים יימכרו תמורת '+L(fmt(gold))+' זהב. אי אפשר לבטל אחרי המכירה.</p><p class="hint" style="color:var(--bad)">אלה פריטי אקסלנט מכל הדרגות'+(up?', '+L(up)+' מהם משודרגים':'')+'. אקסלנט מלא לא נמכר כאן.</p><div class="acts"><button class="btn" data-act="closeModal">ביטול</button><button class="btn pri" data-act="sellRar" data-r="0" data-ex="1">מכור '+L(list.length)+' פריטים</button></div>');return;}
  if(a==='sellAsk'){const q=+b.dataset.r,list=A.inv.filter(it=>it.r===q&&it.s!=='g'&&!it.ex),gold=list.reduce((x,it)=>x+sellVal(it),0),up=list.filter(it=>it.p>0).length;if(!list.length)return;
    openModal('<h3 style="color:var(--r'+q+')">למכור את כל ה'+RAR[q].n+'?</h3><p class="hint">'+L(list.length)+' פריטים יימכרו תמורת '+L(fmt(gold))+' זהב. אי אפשר לבטל אחרי המכירה.</p>'+
      (up?'<p class="hint" style="color:var(--bad)">שים לב: '+L(up)+' מהם משודרגים.</p>':'')+(q>=3?'<p class="hint" style="color:var(--bad)">אלה פריטים '+(q===4?'עתיקים':'אגדיים')+'. ודא שאתה לא צריך אותם.</p>':'')+
      '<div class="acts"><button class="btn" data-act="closeModal">ביטול</button><button class="btn pri" data-act="sellRar" data-r="'+q+'">מכור '+L(list.length)+' פריטים</button></div>');return;}
  if(a==='respecAsk'){openModal('<h3>לאפס את נקודות הסטט?</h3><p class="hint">כל הנקודות שחילקת חוזרות אליך ואפשר לחלק אותן מחדש. המחיר: '+L(RESPEC_COST)+' אותות ריסט. יש לך '+L(A.cred)+'. ציוד שכבר לבוש נשאר עליך.'+(S.autoPts?' החלוקה האוטומטית פעילה ותחלק אותן מיד מחדש. כבה אותה קודם אם אתה רוצה לחלק לבד.':'')+'</p><div class="acts"><button class="btn" data-act="closeModal">ביטול</button><button class="btn pri" data-act="respec">אפס נקודות</button></div>');return;}
  if(a==='lang'){if(b.dataset.l!==getLang())setLang(b.dataset.l);return;}
  if(a==='emote'){const i=+b.dataset.i;if(EMO[i]){SC.hero.say={m:EMO[i],t:SC.t+3.5};netSend({t:'emote',z:SC.zi,fl:SC.fl,e:i});}return;}
  if(a==='gmWalk'){try{localStorage.setItem('ec-gmwalk',gmWalk()?'0':'1');}catch(e){}toast(gmWalk()?'מעבר חופשי פעיל: כל המפות פתוחות לך':'מעבר חופשי כבוי: הדמות שלך כפופה לחוקים כמו כל שחקן');renderPanel();return;}
  if(a==='gm'){if(!netUp())toast('אין חיבור חי לשרת');else netSend({t:'gm',a:b.dataset.a,sec:+b.dataset.sec||0,xp:+b.dataset.xp||1,drop:+b.dataset.drop||1,min:+b.dataset.min||0,n:+b.dataset.n||0,m:b.dataset.a==='say'&&$('gmText')?$('gmText').value:''});return;}
  if(a==='toBank'){const e=$('bankSec');if(e)e.scrollIntoView({behavior:'smooth',block:'start'});return;}
  if(a==='sgUse'){netSend({t:'sgAct',k:'use'});return;}
  if(a==='sgJoin'){if(!sgJoin())toast('אין חיבור חי לשרת');return;}
  if(a==='brJoin'){if(!brJoin())toast('אין חיבור חי לשרת');return;}
  if(a==='brLeave'){netSend({t:SC.duel&&SC.duel.br&&SC.duel.br.sg?'sgLeave':'brLeave'});const dd=SC.duel;if(dd&&dd.br){dd.br.res=null;brExit('יצאת מהזירה');}return;}
  if(a==='pushToggle'){pushToggle();return;}
  if(a==='watch'){netSend({t:'watch',id:+b.dataset.id});return;}
  if(a==='unwatch'){netSend({t:'unwatch'});if(SC.duel&&SC.duel.spec){SC.mode='farm';SC.duel=null;SC.fx=[];SC.nums=[];renderDuelBar();}return;}
  if(a==='guide'){showGuide();return;}
  if(a==='big'){setBig(!prefs.big);return;}
  if(a==='fs'){fsToggle();return;}
  if(a==='install'){if(installEvt){const ev=installEvt;installEvt=null;ev.prompt();}renderPanel();return;}
  if(a==='say'){say();return;}
  if(a==='topBy'){topBy=b.dataset.k==='power'?'power':'resets';renderPanel();return;}
  if(a==='chatCh'){chatCh=b.dataset.c==='g'?'g':b.dataset.c==='p'?'p':'w';renderPanel();return;}
  if(a==='wTo'){closeModal();whisperTo={k:b.dataset.k,n:b.dataset.n};chatCh='p';openTab('chat');setTimeout(()=>{const el=$('chatIn');if(el)el.focus();},60);return;}
  if(a==='reportAsk'){openModal('<h3>לדווח על '+esc(b.dataset.n)+'?</h3><p class="hint">הדיווח מגיע למנהל המשחק. כתוב בקצרה מה קרה.</p><input type="text" id="repWhy" maxlength="100" placeholder="למשל: קללות בצ\'אט" autocomplete="off"><div class="acts"><button class="btn" data-act="closeModal">ביטול</button><button class="btn pri" data-act="report" data-k="'+esc(b.dataset.k)+'" data-n="'+esc(b.dataset.n)+'">שלח דיווח</button></div>');return;}
  if(a==='logout'){setSession(null);location.reload();return;}
  if(a==='create'){
    if(clickBusy)return;clickBusy=true;const nm=($('nm').value||'').trim().slice(0,14)||'גיבור',extra=!!b.dataset.x;
    const keep=A,wasDemo=demo;if(!extra){demo=false;if(!ONLINE)A=newAccount();}
    const r=await send('create',{name:nm,cls:pickCls});clickBusy=false;
    if(!r.ok){if(!extra){A=keep;demo=wasDemo;S=A.chars[0];}const d=document.createElement('p');d.className='hint';d.style.color='var(--bad)';d.textContent=r.msg==='net'?'אין חיבור לשרת. נסה שוב.':r.msg;$('modalBox').appendChild(d);return;}
    closeModal();enterGame(r);saveLocal();toast('בהצלחה, '+S.name);return;}
  if(!S||demo)return;
  if(a==='sk'){cast(+b.dataset.i,false);renderHud();return;}
  if(a==='fastGfx'){prefs.fast=!fastOn();savePrefs();applyFast();openSettings();return;}
  if(a==='potAuto'){const L2=[0,30,50,70,85],v=prefs.autoPot==null?50:prefs.autoPot;prefs.autoPot=L2[(L2.indexOf(v)+1)%L2.length];savePrefs();renderHud();return;}
  if(a==='auto'){S.auto=!S.auto;SC.hero.tgt=null;renderHud();send('setAuto',{on:S.auto});return;}
  if(a==='mute'){prefs.mute=!prefs.mute;savePrefs();renderHud();return;}
  if(a==='settings'){openSettings();return;}
  if(a==='ptyWin'){ptyWin();return;}
  if(a==='pfollow'){const n=b.dataset.n||'';follow=follow===n?'':n;followNo='';ptyWin();return;}
  if(a==='sgGuide'){openModal('<h2>מדריך למצור</h2>'+[["מתי", "כל שבת ב-21:00 למשך שעה"], ["מי", "רק חברי גילדה. מצטרפים מהכפתור הצף במסך או מלשונית שחקנים"], ["המטרה", "הגילדה שמחזיקה בכתר כשהשעה נגמרת זוכה בטירה"], ["הדרך", "יוצאים מהמחנה בדרום ועוברים שתי סוללות עם מעברים צרים"], ["שערים", "שלושה קווי הגנה בדרך אל הכתר: חומה חיצונית, חומה אמצעית וחומת הטירה. בכל קו די לפרוץ שער אחד"], ["אבן החיים", "תוקף שנופל חוזר ליד אבן החיים, שמתקדמת אל מאחורי כל קו חומה שנפרץ. מגיני הטירה יכולים לצאת ולהרוס אותה, ואז התוקפים חוזרים מהמחנה הרחוק עד שהיא צומחת מחדש אחרי דקה"], ["אבני שמירה", "ארבע אבנים בחצר הטירה. כל עוד אחת עומדת מגן חוסם את חדר הכתר לכל מי שאינו מהגילדה המחזיקה. האבנים מרפאות את המגינים שלידן"], ["חדר הכתר", "נמצא בתוך הטירה מאחורי פתח צר. המתגים צמודים לקירות הצד והכתר באמצע"], ["מתג", "עומדים עליו ולוחצים על הכפתור הצהוב. אחרי שלוש שניות הוא שלכם כל עוד אתם עומדים עליו בחיים"], ["כתר", "רק מנהל הגילדה לוקח אותו ורק כששני חברים אחרים מחזיקים את שני המתגים. צריך 30 שניות על הכתר. הפרעה עולה שנייה. מנהל שנופל מאבד את כל הזמן שצבר"], ["קומבו", "תקיפה ואז המיומנות הראשונה ואז המיומנות המהממת. לוחצים על כל אחת כשהכפתור שלה נדלק"], ["יריב", "לחיצה על יריב מסמנת אותו, והמכות שלך הולכות אליו כל עוד הוא בטווח. לכל מקצוע מיומנות אחת שפוגעת בכמה יריבים"], ["תנועה", "הדיפה זורקת יריב ממתג. זינוק מנחית אתכם על יריב רחוק. צעד מתחמק ממכה. מגן עוצר הדיפה והלם"], ["באפים", "כל מקצוע מפעיל באף על חברים שעומדים קרוב. הישארו יחד"], ["שיקויים", "קונים אצל המוכר במחנה ובחצר הטירה. אפשר להחזיק עד 60"], ["נפילה", "חוזרים אחרי עשר שניות. התוקפים במחנה והמגינים בחצר הטירה"], ["הפרס", "הטירה עד המצור הבא. עוד ניסיון וזהב. כניסה לעיר העתיקה ולחנות שלה"]].map(x=>'<p style="margin:7px 0"><b style="color:var(--gold)">'+x[0]+'</b><br>'+x[1]+'</p>').join('')+'<button class="btn pri" data-act="closeModal" style="width:100%">הבנתי</button>');return;}
  if(a==='bindKey'){bindWait=b.dataset.k;$('modalBox').innerHTML=settingsHtml();return;}
  if(a==='keysReset'){prefs.keys={};prefs.mvS=100;prefs.atS=100;savePrefs();applySizes();openSettings();return;}
  if(a==='closeModal'&&bindWait){bindWait='';}
  if(a==='item'){openSheet(id);return;}
  if(a==='newChar'){$('modalBox').innerHTML='';showCreate(true);return;}
  if(a==='expSave'){saveLocal();const code=btoa(unescape(encodeURIComponent(JSON.stringify(A))));const inp=$('impCode');
    const done=()=>toast('קוד השמירה הועתק'),fb=()=>{inp.value=code;inp.focus();inp.select();toast('סמן והעתק את הקוד מהשדה');};
    try{navigator.clipboard.writeText(code).then(done,fb);}catch(e2){fb();}return;}
  if(a==='impSave'){if(ONLINE)return;let o=null;try{o=adopt(JSON.parse(decodeURIComponent(escape(atob($('impCode').value.trim())))));}catch(e2){}
    if(!o||!o.chars.length){toast('הקוד לא תקין');return;}A=o;const r=await send('sync',{});enterGame(r);saveLocal();toast('ההתקדמות נטענה');return;}
  if(a==='evtab'){openTab('pass');return;}
  if(clickBusy||busy)return;clickBusy=true;
  try{
    let r=null;
    if(a==='quest'){const q=QUESTS[A.q];if(q){const p=q.p(A,S);if(p[0]>=p[1]){r=await act('claimQuest',{});if(r.ok){snd('rare');toast('קיבלת '+r.rt);}}}}
    else if(a==='switch'){clickBusy=false;await switchTo(+b.dataset.i);}
    else if(a==='list'){await listItem(id,$('mprice').value,$('mto')?$('mto').value:'');}
    else if(a==='gcreate'){r=await act('gcreate',{name:($('gname').value||'').trim(),tag:($('gtag').value||'').trim()});if(r.ok)toast('הגילדה נפתחה');}
    else if(a==='gjoin'){r=await act('gjoin',{name:b.dataset.n});if(r.ok)toast('הצטרפת לגילדה');}
    else if(a==='gleave'){r=await act('gleave',{});}
    else if(a==='gkick'){r=await act('gkick',{i:+b.dataset.i});}
    else if(a==='gnotice'){r=await act('gnotice',{text:$('gnotice').value||''});}
    else if(a==='pcreate'||a==='pleave'){r=await act(a,{});if(r.ok&&a==='pleave'){follow='';closeModal();partyN=0;auras=[];statsDirty=true;}}
    else if(a==='pjoin'){r=await act('pjoin',{code:($('pcode').value||'').trim()});if(r.ok)toast('הצטרפת לפארטי');}
    else if(a==='mbuy'){await buyListing(b.dataset.m);}
    else if(a==='mcancel'){await cancelListing(b.dataset.m);}
    else if(a==='mrefresh'){loadMarket();}
    else if(a==='zone'){if(SC.mode==='farm'){clickBusy=false;await travelTo(+b.dataset.i,'L',+(b.dataset.f||0));}}
    else if(a==='reset'){if(SC.mode==='farm'&&canReset(S)){r=await act('reset',{});if(r.ok){enterZone(-1,'L',0);C=calc(S,auras);SC.hero.hp=C.hp;if(!calm)SC.shake=.4;burst(SC.hero.x,gy()-50,'#f2c14e',40);snd('lvl');toast('ריסט '+r.resets+'. קיבלת '+r.gain+' אותות ריסט');}}}
    else if(a==='equip'||a==='unequip'||a==='sell'||a==='bankPut'||a==='bankTake'){r=await act(a,{id:id});closeSheet();if(r&&!r.ok)toast(r.msg==='net'?'אין חיבור לשרת':r.msg);else if(a==='bankPut')toast('הפריט בבנק. הבנק נמצא בלשונית ציוד, מעל התיק',4);}
    else if(a==='craftKey'){r=await act('craftKey',{});if(r.ok){snd('rare');toast('נוצר מפתח מצודה. יש לך '+r.keys);}}
    else if(a==='bestEq'){$('spin').classList.add('on');await new Promise(z=>setTimeout(z,3000));r=await act('bestEq',{});$('spin').classList.remove('on');
      if(r.ok){snd(r.n?'rare':'ok');toast(r.n?'הוחלפו '+r.n+' חלקים. כוח הלחימה עלה ב-'+fmt(r.gain):'כבר לבוש עליך הציוד הכי חזק שיש בתיק');}}
    else if(a==='sellRar'){closeModal();r=await act('sellRar',b.dataset.ex?{r:0,ex:1}:{r:+b.dataset.r});if(r.ok){snd('coin');toast(r.n+' פריטים נמכרו ב-'+fmt(r.gold)+' זהב');}}
    else if(a==='sellJunk'){r=await act('sellJunk',{});if(r.ok)toast('נמכר ב-'+fmt(r.gold)+' זהב');}
    else if(a==='upgrade'){r=await act('upgrade',{id:id});if(r.ok){const c=r.code;snd(c==='ok'?'ok':c==='poor'||c==='max'?'click':'fail');
        toast(c==='ok'?'השדרוג הצליח. דרגה '+r.p:c==='saved'?'נכשל. קמע ההגנה שמר על הדרגה':c==='down'?'נכשל. הדרגה ירדה ל-'+r.p:c==='fail'?'השדרוג נכשל':'חסרים חומרים',c==='ok'?r.r:null);touch();C=calc(S,auras);openSheet(id);}}
    else if(a==='openBox'){r=await act('openBox',{k:b.dataset.k});if(r.ok)boxFx(r.box);}
    else if(a==='buy'&&b.dataset.k==='rename'&&!b.dataset.go){openModal('<h3>שינוי שם לדמות</h3><p class="hint">4 עד 14 תווים. השם הנוכחי: '+esc(S.name)+'</p><input type="text" id="newName" maxlength="14" autocomplete="off"><div class="acts"><button class="btn" data-act="closeModal">ביטול</button><button class="btn pri" data-act="buy" data-s="prem" data-k="rename" data-go="1">שנה שם</button></div>');return;}
    else if(a==='buy'){const nn=b.dataset.go?($('newName')&&$('newName').value||'').trim():'';if(b.dataset.go)closeModal();r=await act('buy',nn?{shop:b.dataset.s,k:b.dataset.k,name:nn}:{shop:b.dataset.s,k:b.dataset.k});if(r.ok){if(r.box)boxFx(r.box);else if(r.free){snd('click');statsDirty=true;toast('המראה עודכן');}else{snd('coin');toast('נקנה: '+r.bought);}}}
    else if(a==='claimPass'){for(let n=0;n<PASS_MAX&&passLevel(S)>A.pass.claimed;n++){r=await act('claimPass',{});if(!r.ok)break;snd('rare');toast('פרס עונה: '+r.t);}passScroll=null;}
    else if(a==='claimEvent'){r=await act('claimEvent',{id:b.dataset.k});if(r.ok){snd('rare');toast('פרס האירוע: '+r.rt);if(r.levels)afterXp(r.levels);}}
    else if(a==='answer'){r=await act('answer',{a:+b.dataset.i});if(r.ok){snd(r.correct?'ok':'fail');toast(r.correct?'תשובה נכונה. אסוף את הפרס':'תשובה שגויה');}}
    else if(a==='wingEvolve'){const id=+b.dataset.id;r=await act('wingEvolve',{id:id});if(r.ok){if(r.evolved){snd('rare');toast((S.cls==='lord'?'הגלימה התפתחה: '+CAPEN[r.t-1]:'הכנפיים התפתחו: '+WINGN[r.t-1]),4);announce('הכנפיים שלך התפתחו ל'+WINGN[r.t-1],true);}else{snd('slam');toast('הפיתוח נכשל. '+r.need+' נוצות נשרפו');}openSheet(id);}else toast(r.msg);}
    else if(a==='exAdd'){const id=+b.dataset.id;r=await act('exAdd',{id:id});if(r.ok){snd('rare');toast(r.full?'הפריט הגיע לאקסלנט מלא':'נוספה אופציה: '+AFF[r.opt[0]][0]+' '+r.opt[1]+'%',4);openSheet(id);}}
    else if(a==='claimLogin'){r=await act('claimLogin',{});if(r.ok){snd('rare');closeModal();toast('פרס יום '+r.day+': '+r.t);}}
    else if(a==='claimTask'){r=await act('claimTask',{k:b.dataset.k});if(r.ok){snd('coin');toast(r.rt?'קיבלת '+r.rt:r.xp+' ניסיון לפס');}}
    else if(a==='claimWorld'){r=await act('claimWorld',{});if(world&&(r.ok||/נאסף/.test(String(r.msg)))){wGot[world.key]=1;world.claimed=true;}if(r.ok){snd('rare');toast('בוס העולם: מקום '+r.rank+'. קיבלת '+r.rt,4);}else toast(r.msg);panelDirty=true;}
    else if(a==='claimWeek'){r=await act('claimWeek',{k:b.dataset.k});if(r.ok){snd('rare');toast('פרס שבועי: '+r.rt,4);}}
    else if(a==='sqClaim'){r=await act('sqClaim',{});if(r.ok){snd('rare');toast('משימת הצד הושלמה. הפרס אצלך',4);}}
    else if(a==='sqDrop'){r=await act('sqDrop',{});}
    else if(a==='pickup'){r=await act('pick',{k:b.dataset.k});}
    else if(a==='respec'){closeModal();r=await act('respec',{});if(r.ok){snd('rare');toast(fmt(r.pts)+' נקודות חזרו אליך');}else toast(r.msg);}
    else if(a==='fight'){if(SC.mode==='farm'&&(A.tickets>0||A.pd)){r=await act('duelStart',{i:+b.dataset.i});if(r.ok)startArena(r.pd);}}
    else if(a==='da'){return;}
    else if(a==='challenge'){closeModal();const k=b.dataset.k;if(ws&&ws.readyState===1){netSend({t:'challenge',k:k});toast('ההזמנה נשלחה. מחכים לתשובה');r={ok:true};}else{r=await act('duelStart',{k:k});if(r.ok)startArena(r.pd);else toast(r.msg==='net'?'אין חיבור לשרת':r.msg);}}
    else if(a==='friend'||a==='block'){const on=b.dataset.on==='1';closeModal();r=await act(a,{k:b.dataset.k,n:b.dataset.n,on:on});if(r.ok){toast(a==='friend'?(on?b.dataset.n+' נוסף לחברים':'הוסר מהחברים'):(on?b.dataset.n+' נחסם. לא תראה הודעות ממנו':'החסימה הוסרה'));askWho();}else toast(r.msg);}
    else if(a==='report'){const why=($('repWhy')||{}).value||'';closeModal();r=await act('report',{k:b.dataset.k,n:b.dataset.n,why:why});toast(r.ok?'הדיווח נשלח. תודה':r.msg);r={ok:true};}
    else if(a==='trial'){r=await act('trialStart',{});if(r.ok)startDuel(r.pd);else toast(r.msg==='net'?'אין חיבור לשרת':r.msg);}
    else if(a==='tower'){r=await act('towerStart',{});if(r.ok)startDuel(r.pd);else toast(r.msg==='net'?'אין חיבור לשרת':r.msg);}
    else if(a==='pvpYes'||a==='pvpNo'){closeModal();netSend({t:'answer',id:+b.dataset.id,ok:a==='pvpYes'});r={ok:true};}
    else if(a==='pinvite'){closeModal();if(b.dataset.k)netSend({t:'pInv',k:b.dataset.k});else{const n=($('pname')&&$('pname').value||'').trim();if(!n)toast('הקלד שם של שחקן מחובר');else netSend({t:'pInv',n:n});}r={ok:true};}
    else if(a==='pans'){closeModal();netSend({t:'pAns',ok:b.dataset.ok==='1'});r={ok:true};}
    else if(a==='reroll'){loadArena();}
    else if(a==='pt'){r=await act('pt',{k:b.dataset.k,n:b.dataset.n});}
    else if(a==='autoPts'||a==='autoEq'||a==='autoSell'){r=await act(a,{});}
    failTxt(r);
  }finally{clickBusy=false;}
  touch();if(S){C=calc(S,auras);statsDirty=false;}renderHud();renderPanel();saveLocal();
});

/* ---------- daily login reward, and a card for other players ---------- */
function loginTiles(){
  const lg=A.login||{s:1,got:1},day=clamp(lg.s|0,1,7);
  return '<div class="lgrid">'+LOGIN_RW.map((rw,i)=>{const d=i+1,got=d<day||(d===day&&lg.got),cur=d===day&&!lg.got,ic=rw.sboxes?'sboxes':rw.boxes?'sboxes':rw.gems?'gems':rw.boost?'wing':'coins';
    return '<div class="tier'+(got?' got':cur?' open':'')+(d===7?' big':'')+'"><b>יום '+d+'</b><span class="pic">'+PICON[ic]+'</span><em>'+rw.t+'</em><i>'+(got?'נאסף':cur?'היום':'בהמשך')+'</i></div>';}).join('')+'</div>';
}
function loginCard(){
  const lg=A.login;if(!lg)return '';
  return '<h2>פרס כניסה יומי</h2><div class="card" style="display:flex;flex-direction:column;gap:8px"><p class="hint">נכנסים כל יום ואוספים. שבעה ימים ברצף מביאים לתיבת עונה. יום שלא נאסף מחזיר להתחלה.</p>'+loginTiles()+
    '<button class="btn pri'+(lg.got?'':' glow')+'" data-act="claimLogin"'+(lg.got?' disabled':'')+'>'+(lg.got?'נאסף היום. נתראה מחר':'אסוף את הפרס של היום')+'</button></div>';
}
function showLogin(){
  const lg=A.login;if(!lg||lg.got||demo)return;
  openModal('<h3>פרס כניסה יומי · יום '+clamp(lg.s|0,1,7)+'</h3>'+loginTiles()+'<div class="acts"><button class="btn" data-act="closeModal">אחר כך</button><button class="btn pri glow" data-act="claimLogin">אסוף</button></div>');
}
const gearLine=(g,names)=>g?esc(names[clamp(g[0],1,names.length)-1])+' · '+RAR[g[1]].n+(g[2]?' · '+L('+'+g[2]):''):'אין';
function showPeer(p){
  const s=p.s,tl=titleOf(s.r|0),pet=PETS.find(x=>s.r>=x[0]);
  openModal('<h3 style="color:'+(tl?tl[2]:'var(--gold)')+'">'+(p.g?'['+esc(p.g)+'] ':'')+esc(s.n)+'</h3><p class="hint">'+CLS[s.c].n+(tl?' · '+tl[1]:'')+'</p>'+
    '<div class="kv"><span>רמה</span><b class="num">'+L(s.l)+'</b></div><div class="kv"><span>ריסטים</span><b class="num">'+L(s.r)+'</b></div><div class="kv"><span>כוח לחימה</span><b class="num">'+L(fmt(s.p))+'</b></div>'+
    '<div class="kv"><span>נשק</span><b>'+gearLine(s.w,TIERN)+'</b></div><div class="kv"><span>שריון</span><b>'+gearLine(s.ar,TIERN)+'</b></div><div class="kv"><span>כנפיים</span><b>'+gearLine(s.g,WINGN)+'</b></div>'+
    (pet?'<div class="kv"><span>מלווה</span><b>'+pet[1]+'</b></div>':'')+
    '<div class="grid2" style="margin-top:10px"><button class="btn pri" data-act="challenge" data-k="'+esc(p.k)+'"'+(A.tickets>0&&SC.mode==='farm'?'':' disabled')+'>אתגר לדו-קרב</button><button class="btn" data-act="pinvite" data-k="'+esc(p.k)+'"'+(party.members.length>=5?' disabled':'')+'>הזמן לפארטי</button></div>'+
    '<p class="hint" style="margin-top:6px">אם הוא מחובר הוא מקבל הזמנה, ואם הוא מקבל אותה נלחמים זה בזה בזמן אמת. אחרת נלחמים בדמות שלו, שהמשחק מפעיל. עולה כרטיס זירה.</p>'+
    '<div class="grid2" style="margin-top:6px"><button class="btn" data-act="wTo" data-k="'+esc(p.k)+'" data-n="'+esc(s.n)+'">הודעה פרטית</button><button class="btn" data-act="friend" data-on="'+(isFriend(p.k)?0:1)+'" data-k="'+esc(p.k)+'" data-n="'+esc(s.n)+'">'+(isFriend(p.k)?'הסר מהחברים':'הוסף לחברים')+'</button>'+
    '<button class="btn sm" data-act="block" data-on="'+(isBlocked(p.k)?0:1)+'" data-k="'+esc(p.k)+'" data-n="'+esc(s.n)+'">'+(isBlocked(p.k)?'בטל חסימה':'חסום')+'</button><button class="btn sm" data-act="reportAsk" data-k="'+esc(p.k)+'" data-n="'+esc(s.n)+'">דווח</button></div>'+
    '<div class="acts"><button class="btn" data-act="closeModal">סגור</button></div>');
}
function renderTrial(){
  const m=dayNum()%3,left=TRIAL_TRIES-(A.daily.tr|0),best=A.daily.trB,rw=t=>{const r=TRIAL_RW[t];return [r.gems?L(r.gems)+' אבני נשמה':'',r.coins?L(r.coins)+' מטבעות עונה':'',r.boxes?'תיבת אוצר':''].filter(Boolean).join(' · ');};
  return '<h2>אתגר היום</h2><div class="card" style="display:block"><div class="kv"><b style="color:var(--gold)">שומר היום: '+TRIAL_MOD[m]+'</b><span>'+(best==null?'עוד לא הושלם היום':'ההישג שלך היום: '+TRIAL_MEDAL[best])+'</span></div>'+
    '<div class="kv"><span>זהב · עד '+L(TRIAL_T[0])+' שניות</span><b>'+rw(0)+'</b></div><div class="kv"><span>כסף · עד '+L(TRIAL_T[1])+' שניות</span><b>'+rw(1)+'</b></div><div class="kv"><span>ארד · ניצחון</span><b>'+rw(2)+'</b></div>'+
    '<p class="hint">השומר נבנה לפי הכוח של הדמות שלך, אז המדליה תלויה באיך שנלחמת ולא בציוד. השעון רץ מהרגע שנכנסת. מדליה טובה יותר משלמת את ההפרש. '+L(TRIAL_TRIES)+' ניסיונות ביום, ושומר אחר בכל יום.</p>'+
    '<button class="btn pri'+(left>0&&best!==0?' glow':'')+'" style="width:100%" data-act="trial"'+(left>0&&SC.mode==='farm'?'':' disabled')+'>'+(left>0?'התחל · נותרו '+L(left)+' ניסיונות':'נגמרו הניסיונות להיום')+'</button></div>';
}
function renderTower(){
  const tw=A.tower||{best:0},f=(tw.best|0)+1,b=towerBoss(f),left=TOWER_TRIES-(A.daily.tw|0),rw=towerReward(f),c=calc(S,auras),secs=b.hp/Math.max(1,c.dps);
  return '<h2>מגדל הנצח</h2><div class="card" style="display:block"><div class="kv"><b style="color:var(--gold)">הקומה הבאה: '+L(f)+'</b><span>השיא שלך: '+L(tw.best|0)+'</span></div>'+
    '<div class="kv"><span>חיי השומר</span><b class="num">'+L(fmt(b.hp))+'</b></div><div class="kv"><span>ניסיונות שנותרו היום</span><b class="num">'+L(left)+'</b></div>'+
    '<div class="kv"><span>פרס</span><b>'+[rw.gems?L(rw.gems)+' אבני נשמה':'',rw.gold?L(fmt(rw.gold))+' זהב':'',rw.coins?L(rw.coins)+' מטבעות עונה':'',rw.sboxes?'תיבת עונה':'',rw.feathers?L(rw.feathers)+' נוצות נצח':''].filter(Boolean).join(' · ')+'</b></div>'+
    '<p class="hint">בכל קומה שומר אחד, חזק מהקודם, ואין קומה אחרונה. נלחמים ביד, עם המהלכים של הזירה, ויש '+L(75)+' שניות. כשהשומר מסמן אזור אדום על הרצפה, צא ממנו או הפעל מגן. ניצחון לא עולה ניסיון, הפסד כן. '+(secs>60?'<span style="color:var(--bad)">לפי הנזק שלך כרגע, הקומה הזו על הגבול. שדרג ציוד או חזור אחרי ריסט.</span>':'')+'</p>'+
    '<button class="btn pri'+(left>0?' glow':'')+'" style="width:100%" data-act="tower"'+(left>0&&SC.mode==='farm'?'':' disabled')+'>'+(left>0?'טפס לקומה '+L(f):'נגמרו הניסיונות להיום')+'</button></div>';
}
function renderFriends(){
  if(!ONLINE)return '';const fr=A.friends||[],bl=A.blocked||[];let h='<h2>חברים</h2>';
  if(!fr.length)h+='<p class="hint">עוד אין חברים. לחץ על שחקן במפה ובחר "הוסף לחברים". כשחבר מתחבר תקבל הודעה.</p>';
  for(const f of fr){const on=!!friendsOn[f.k];h+='<div class="card opp"><div class="z"><b>'+esc(f.n)+'</b><small style="color:'+(on?'var(--good)':'var(--dim)')+'">'+(on?'מחובר עכשיו':'לא מחובר')+'</small></div>'+
    '<button class="btn sm" data-act="wTo" data-k="'+esc(f.k)+'" data-n="'+esc(f.n)+'"'+(on?'':' disabled')+'>הודעה</button><button class="btn sm'+(on?' pri':'')+'" data-act="challenge" data-k="'+esc(f.k)+'"'+(A.tickets>0&&SC.mode==='farm'?'':' disabled')+'>דו-קרב</button><button class="btn sm" data-act="friend" data-on="0" data-k="'+esc(f.k)+'" data-n="'+esc(f.n)+'">הסר</button></div>';}
  if(bl.length)h+='<p class="hint">חסומים: '+bl.map(x=>esc(x.n)+' <button class="btn sm" data-act="block" data-on="0" data-k="'+esc(x.k)+'" data-n="'+esc(x.n)+'">בטל</button>').join(' · ')+'</p>';
  return h;
}
/* ---------- the keep: a tiered event fought in its own place, entered with a crafted key ---------- */
let keepAnn='',keepT=0;
const keepWin=()=>{const w=keepGate(Date.now());return w&&!(A&&A.ev&&A.ev[w.key]&&A.ev[w.key].no)?w:null;};
async function enterKeep(){
  if(busy||SC.ev||SC.mode!=='farm'||!S||demo)return;busy=true;const r=await act('evEnter',{id:'crimson'});busy=false;
  if(!r.ok){toast(r.msg==='net'?'אין חיבור לשרת':r.msg);if(!(A.keys>0))openTab('pass');return;}
  snd('portal');enterZone(r.z,'L',0,true);SC.evEnd=r.end;SC.evTier=r.tier;SC.evStart=r.start||0;SC.evWait=Date.now()<SC.evStart;if(SC.evWait)SC.mons=[];announce(SC.evWait?'אתה בתוך מצודת הארגמן '+r.tier+'. הנחיל יוצא כשהספירה נגמרת':'נכנסת למצודת הארגמן '+r.tier,true);saveLocal();
}
// A player who was inside a running keep and lost it without choosing to (a dropped connection, a server restart, a reload) is put back in.
const keepBackWin=()=>{if(!A||!S)return null;const w=evWindows(Date.now(),0).find(x=>x.e.tiered&&x.live),rec=w&&(A.ev||{})[w.key];return rec&&rec.in&&!rec.out&&!rec.no?w:null;};
let keepQuit='';
function keepBack(){const w=ONLINE&&!demo&&!SC.ev&&SC.mode==='farm'&&keepBackWin();if(w&&w.key!==keepQuit)enterKeep();}
setInterval(keepBack,4000);
async function leaveKeep(told){
  if(!SC.ev)return;SC.ev=false;if(!told){keepQuit=S.evIn||keepQuit;await flushTick();await send('evLeave',{});}
  enterZone(-1,'L',0);if(S.zone!==-1&&!ONLINE)S.zone=-1;toast(told?'השער נסגר. חזרת לכפר':'יצאת מהמצודה');saveLocal();
}
function keepCard(e,w,rec,live){
  const sh=A.shards||0,keys=A.keys||0,back=!!keepBackWin(),open=!!keepWin()||back;
  let h='<div class="kv" style="margin-top:6px"><span>מפתחות מצודה</span><b class="num" style="color:var(--gold)">'+L(keys)+'</b></div><div class="kv"><span>שברי ארגמן</span><b class="num">'+L(sh+'/'+KEY_SHARDS)+'</b></div>'+
    '<p class="hint"><b>איך נכנסים:</b> שברי ארגמן נופלים ממפלצות בכל מפה. מ-'+L(KEY_SHARDS)+' שברים ו-'+L(fmt(KEY_GOLD))+' זהב יוצרים מפתח. השער נפתח חמש דקות לפני כל שעה עגולה, והמפתח משגר אותך פנימה לחכות. בפנים מחכה נחיל אדיר של מפלצות חלשות עם ניסיון רגיל, כך שעולים רמות מהר בזכות הכמות. <b>הכניסה פתוחה רק ב-'+L(KEEP_GATE)+' הדקות שלפני הפתיחה, והפרס הוא הכמות עצמה.</b> מי שפספס, יצא בעצמו או עשה ריסט באמצע מחכה למצודה הבאה.</p>'+
    '<div class="grid2"><button class="btn sm'+(sh>=KEY_SHARDS&&A.gold>=KEY_GOLD?' pri':'')+'" data-act="craftKey"'+(sh>=KEY_SHARDS&&A.gold>=KEY_GOLD?'':' disabled')+'>צור מפתח</button>'+
    '<button class="btn sm'+(open&&!SC.ev&&(keys>0||rec.in)?' pri glow':'')+'" data-act="keepGo"'+(open&&!SC.ev&&(keys>0||rec.in)?'':' disabled')+'>'+(SC.ev?'אתה בפנים':back?'חזור למצודה':open?'שגר למצודה':live?'הכניסה נסגרה':'השער סגור')+'</button></div>';
  return h;
}
/* ---------- paid credits ---------- */
let myOrders=null,premSeen=null;
const ORD_ST={pending:'ממתין לאישור',paid:'אושר',rejected:'נדחה',cancelled:'בוטל'};
function renderCredits(){
  let h='<h2>חנות קרדיטים</h2>';if(!ONLINE)return h+'<p class="hint">קרדיטים קיימים רק במצב מקוון.</p>';
  const pend=myOrders&&myOrders.orders.find(o=>o.status==='pending');
  h+='<div class="card" style="display:flex;flex-direction:column;gap:8px"><div class="kv"><span>הקרדיטים שלך</span><b class="num" style="color:#7df9ff;font-size:17px">'+L(fmt(A.prem||0))+'</b></div>'+
    (A.vip>Date.now()?'<p class="hint" style="color:var(--gold)">מעמד נצח פעיל עוד '+fmtT((A.vip-Date.now())/1000)+'.</p>':'')+
    (pend?'<p class="hint">תרומה של '+L(pend.price)+' ש"ח ('+L(fmt(pend.credits))+' קרדיטים) ממתינה לאישור.</p><button class="btn sm" data-act="ordCancel" data-id="'+pend.id+'">בטל בקשה</button>'
      :'<p class="hint">המשחק חינמי ומתקיים מתרומות של שחקנים. מי שתורם מקבל קרדיטים כתודה.</p><button class="btn pri" data-act="credBuy">תרום למשחק וקבל קרדיטים</button>')+'</div>';
  return h+shopList('prem',PREM_SHOP,A.prem||0,'קרדיטים');
}
async function loadOrders(){if(!ONLINE||demo)return;try{const j=await rpc('oget',{});if(j.orders){myOrders=j.orders;panelDirty=true;}}catch(e){}}
function showPacks(msg){
  const o=myOrders||{pay:'',orders:[]};
  if(!o.pay){openModal('<h3>תרומה למשחק</h3><p class="hint">התרומות עוד לא נפתחו. הן ייפתחו כשמפעיל המשחק יגדיר איך תורמים.</p><div class="acts"><button class="btn pri" data-act="closeModal">סגור</button></div>');return;}
  openModal('<h3>תרומה למשחק</h3><p class="hint">בוחרים סכום, תורמים לפי ההוראות, והקרדיטים נכנסים לחשבון אחרי שהתרומה אושרה. תרומה מגיל 18, או באישור הורה.</p>'+
    PACKS.map(p=>'<label class="pack"><input type="radio" name="pack" value="'+p.k+'"'+(p.k==='p2'?' checked':'')+'><span><b>תרומה של '+L(p.ils)+' ש"ח</b>'+(p.note?'<small>'+p.note+'</small>':'')+'</span><b class="num" style="color:#7df9ff">'+L(fmt(p.credits))+' קרדיטים</b></label>').join('')+
    '<p class="hint" style="margin-top:8px"><b>איך תורמים:</b></p><p dir="auto" style="white-space:pre-wrap;margin:0 0 8px">'+esc(o.pay)+'</p>'+
    '<input type="text" id="ordRef" maxlength="60" placeholder="שם התורם או 4 ספרות אחרונות, כדי לזהות את התרומה" autocomplete="off">'+
    (msg?'<p class="hint" style="color:var(--bad)">'+esc(msg)+'</p>':'')+
    '<p class="hint">קרדיטים ופריטים הם חלק מהמשחק בלבד ואין להם ערך כספי. פרטים ב<a href="'+PG('terms')+'" target="_blank" rel="noopener">תקנון</a>.</p>'+
    '<div class="acts"><button class="btn" data-act="closeModal">ביטול</button><button class="btn pri" data-act="ordSend">תרמתי, שלח בקשה</button></div>');
}
async function ordSend(){
  const el=document.querySelector('input[name=pack]:checked'),ref=($('ordRef').value||'').trim();if(!el)return;if(ref.length<2){showPacks('כתוב פרט שיזהה את התרומה');return;}
  let j=null;try{j=await rpc('onew',{pack:el.value,ref:ref});}catch(e){}
  if(j&&j.orders)myOrders=j.orders;if(!j||!j.result||!j.result.ok){showPacks(j&&j.result&&j.result.msg||'אין חיבור לשרת');return;}
  closeModal();toast('תודה! הקרדיטים ייכנסו אחרי שהתרומה תאושר');panelDirty=true;
}
/* ---------- leaderboard: the top 20 ---------- */
let topList=null,topBy='resets';
function loadTop(){if(ONLINE&&!demo)send('top',{});}
function renderTop(){
  let h='<h2>טבלת המובילים</h2>';
  let rows=topList&&topList[topBy];
  if(!rows){ // local mode, or the list has not arrived yet: fall back to what this device knows
    rows=players.filter(p=>!p.me).map(p=>({n:p.n,r:p.r,l:p.l,p:p.p||0,c:p.c||''}));rows.push({n:S.name,r:totalResets(A),l:S.lvl,p:C.power,c:S.cls,me:true});
    rows.sort(topBy==='power'?(a,b)=>b.p-a.p:(a,b)=>b.r-a.r||b.l-a.l);rows=rows.slice(0,20);}
  h+='<div class="seg"><button class="btn sm'+(topBy==='resets'?' pri':'')+'" data-act="topBy" data-k="resets">לפי ריסטים</button><button class="btn sm'+(topBy==='power'?' pri':'')+'" data-act="topBy" data-k="power">לפי כוח</button><span class="hint">20 הראשונים</span></div><div class="card top">';
  rows.forEach((r,i)=>{const tl=titleOf(r.r|0);
    h+='<div class="trow'+(r.me?' me':'')+(i<3?' m'+(i+1):'')+'"><i>'+(i+1)+'</i><div><b style="color:'+(tl?tl[2]:'var(--ink)')+'">'+esc(r.n)+'</b><small>'+(CLS[r.c]?CLS[r.c].n+' · ':'')+'רמה '+L(r.l)+(tl?' · '+tl[1]:'')+'</small></div><span class="num">'+(topBy==='power'?L(fmt(r.p))+'<small>כוח</small>':L(r.r)+'<small>ריסטים</small>')+'</span></div>';});
  if(!rows.some(r=>r.me))h+='<div class="trow me"><i>-</i><div><b>'+esc(S.name)+'</b><small>עוד לא בעשרים הראשונים</small></div><span class="num">'+(topBy==='power'?L(fmt(C.power))+'<small>כוח</small>':L(S.resets|0)+'<small>ריסטים</small>')+'</span></div>';
  return h+'</div>';
}
/* ---------- other players, chat, guilds ---------- */
let chatAt=0,peers=[],chatLog=[],chatSince=0,chatCh='w',chatUnread=0,onlineN=0,guild={mine:null,top:[],holder:null},me={secret:true,admin:false},beatT=0,beatBusy=false,banned=false;
async function beat(){
  if(beatBusy||!ONLINE||demo||!S||document.hidden||SC.mode!=='farm')return;beatBusy=true;
  try{const h=SC.hero,j=await rpc('beat',{x:Math.round(h.x),f:h.face,a:SC.t-(h.lastAtk||-9)<3,s:chatSince}),b=j&&j.beat;
    if(b){if(b.banned){location.reload();return;}
      if(b.peers&&!SC.ev)mergePeers(b.peers);if(b.chat&&b.chat.length)addChat(b.chat);if(b.online!=null)onlineN=b.online;renderChatBar();}
  }catch(e){}finally{beatBusy=false;}
}
function mergePeers(list){
  const old={};for(const p of peers)old[p.k]=p;
  peers=list.slice(0,20).map(o=>{const k=String(o.k),x=clamp(+o.x||110,30,mapW()-30),p=old[k]||{x:x,an:0,sw:Math.random()*2,dir:1};
    p.k=k;p.s=G.cleanPlayer(k,o.s);if(p.s.ar&&p.s.ar[1]===4)p.s.set=[4,TCOL[clamp(p.s.ar[0],1,TCOL.length)-1]];p.tx=x;p.f=o.f<0?-1:1;p.a=!!o.a;p.g=String(o.g||'').slice(0,4);return p;});
}
function updatePeers(dt){
  for(const p of peers){if(p.v&&p.vT>0){p.vT-=dt;p.tx=clamp(p.tx+p.v*dt,30,mapW()-30);} // keep walking the way he was walking until the next report
    const d=p.tx-p.x;p.mv=Math.abs(d)>4||(!!p.v&&p.vT>0);
    if(Math.abs(d)>.5){p.x+=Math.sign(d)*Math.min(Math.abs(d),Math.max(260,Math.abs(p.v||0)*1.25,Math.abs(d)*7)*dt);p.dir=p.v?(p.v<0?-1:1):Math.abs(d)>70?(d<0?-1:1):p.f;}
    p.an=Math.max(0,p.an-dt*4);if(p.a&&!p.mv&&SC.zi>=0&&(p.sw-=dt)<=0){p.sw=.8+Math.random()*.6;p.an=1;}}
}
function bubble(x,y,txt){ // what someone just said, over their head
  ctx.save();ctx.font='600 11.5px Assistant,Arial';ctx.textAlign='center';const w=Math.min(190,ctx.measureText(txt).width+14);
  ctx.fillStyle='rgba(255,255,255,.94)';rr(x-w/2,y-20,w,19,7);ctx.fill();ctx.beginPath();ctx.moveTo(x-5,y-2);ctx.lineTo(x+5,y-2);ctx.lineTo(x,y+5);ctx.closePath();ctx.fill();
  ctx.fillStyle='#1a1630';ctx.fillText(txt,x,y-6.5,w-10);ctx.restore();
}
// Stalls: every player with items on the market has a stand in the village street, whether or not he is online.
function stalls(){const by={};for(const m of market){if(m.direct)continue;(by[m.sn]=by[m.sn]||[]).push(m);}return Object.keys(by).slice(0,8).map((n,i)=>({n:n,x:250+i*112,list:by[n],mine:by[n][0].mine}));}
function drawStalls(g0,sc){
  const st=stalls();if(!st.length){label('רחוב הדוכנים: מי שמציע פריט בשוק מקבל כאן דוכן',TW/2,g0-74*sc,'#a79fc9',11.5);return;}
  for(const q of st){const x=q.x,w=38*sc,hh=46*sc,c=q.mine?'#6fe39a':'#f2c14e';
    ctx.fillStyle='rgba(0,0,0,.35)';ctx.beginPath();ctx.ellipse(x,g0+1,w*.95,5,0,0,7);ctx.fill();
    ctx.fillStyle='#5e4426';ctx.fillRect(x-w*.8,g0-hh,4,hh);ctx.fillRect(x+w*.8-4,g0-hh,4,hh);ctx.fillStyle='#7a5a34';ctx.fillRect(x-w*.85,g0-hh*.42,w*1.7,hh*.42);ctx.fillStyle='#b58a52';ctx.fillRect(x-w*.9,g0-hh*.48,w*1.8,5);
    for(let k=0;k<6;k++){ctx.fillStyle=k%2?'#fff3d6':c;ctx.beginPath();ctx.moveTo(x-w+k*w/3,g0-hh);ctx.lineTo(x-w+(k+1)*w/3,g0-hh);ctx.lineTo(x-w+(k+1)*w/3-2,g0-hh+12*sc);ctx.lineTo(x-w+k*w/3+2,g0-hh+12*sc);ctx.closePath();ctx.fill();}
    for(let k=0;k<Math.min(3,q.list.length);k++){const it=cleanItem(q.list[k].it);ctx.fillStyle=it?RAR[it.r].c:'#fff';ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=8;ctx.fillRect(x-w*.5+k*w*.42,g0-hh*.48-9,8,8);ctx.shadowBlur=0;}
    label(q.n,x,g0-hh-18,c,11.5);label(q.list.length+' פריטים',x,g0-hh-5,'#d9d3f5',10);}
}
function openStall(q){
  const rows=q.list.slice(0,20).map(m=>{const it=cleanItem(m.it);if(!it)return '';return '<div class="card shop r'+it.r+'"><div style="width:34px;color:var(--r'+it.r+')">'+SVG[it.s]+'</div><div class="z"><b style="color:var(--r'+it.r+')">'+esc(itemName(it,S.cls))+(it.p?' '+L('+'+it.p):'')+'</b><small>'+mainLine(it)+'</small></div>'+
    (m.mine?'<button class="btn sm" data-act="mcancel" data-m="'+esc(m.id)+'">בטל</button>':'<button class="btn sm'+(A.gold>=m.price?' pri':'')+'" data-act="mbuy" data-m="'+esc(m.id)+'"'+(A.gold>=m.price?'':' disabled')+'>'+L(fmt(m.price))+' זהב</button>')+'</div>';}).join('');
  openModal('<h3 style="color:var(--gold)">הדוכן של '+esc(q.n)+'</h3><div style="display:flex;flex-direction:column;gap:8px;max-height:52vh;overflow-y:auto">'+rows+'</div><div class="acts"><button class="btn pri" data-act="closeModal">סגור</button></div>');
}
function drawPeers(g0,sc){
  if(SC.zi<0&&ONLINE)drawStalls(g0,sc);
  for(const p of peers){ctx.save();ctx.globalAlpha=.9;LITE=peers.length>3;drawHero(p.x,g0,sc,p.s,SC.t+p.k.charCodeAt(0),p.an,(p.mv?p.dir:p.f)<0,0,p.mv,false);LITE=false;ctx.restore();
    nameTag(p.x,g0-SPR[CLSSPR[p.s.c]].bh*2*sc-10,p.s.n,p.s.r,p.g,false);if(p.top)label('מכה: '+fmt(Math.round(p.top)),p.x,g0+16,'#c9b8ff',9.5);if(p.say&&p.say.t>SC.t)bubble(p.x,g0-SPR[CLSSPR[p.s.c]].bh*2*sc-40,p.say.m);}
}
function addChat(list){
  const first=chatSince===0;if(!first&&list.length)chatAt=Date.now();
  for(const m of list){const i=+m.i;if(!(i>chatSince))continue;chatSince=i;const sys=m.n==='\u2605';if(!sys&&!m.me&&isBlocked('',String(m.n||'')))continue;chatLog.push({c:m.c==='g'?'g':'w',n:String(m.n||''),g:String(m.g||''),m:String(m.m||''),me:!!m.me,sys:sys});if(!sys&&!first){const who=m.me?SC.hero:peers.find(p=>p.s&&p.s.n===m.n);if(who)who.say={m:String(m.m||'').slice(0,60),t:SC.t+6};}if(sys){if(!first)announce('\u2605 '+String(m.m||''));}else if(!first&&tab!=='chat'&&!m.me)chatUnread++;}
  if(chatLog.length>120)chatLog.splice(0,chatLog.length-120);
  const l=$('chatList');if(l){l.innerHTML=chatRows();l.scrollTop=l.scrollHeight;}
}
function chatRows(){
  const rows=chatLog.filter(m=>m.c===chatCh).slice(-60);
  if(!rows.length)return '<p class="hint">'+(chatCh==='p'?'הודעות פרטיות עוברות רק בין שני שחקנים מחוברים ולא נשמרות. בוחרים למי לכתוב מכרטיס השחקן או מרשימת החברים.':chatCh==='g'?'עוד אין הודעות בגילדה.':'עוד אין הודעות. תהיה הראשון.')+'</p>';
  if(chatCh==='p')return rows.map(m=>'<div class="cl'+(m.me?' me':'')+'"><b>'+(m.me?'אל '+esc(m.to||''):esc(m.n))+'</b> <span dir="auto">'+esc(m.m)+'</span>'+(m.me?'':' <button class="btn sm" data-act="wTo" data-k="'+esc(m.k)+'" data-n="'+esc(m.n)+'">השב</button>')+'</div>').join('');
  return rows.map(m=>m.sys?'<div class="cl" style="color:var(--gold)">\u2605 <span dir="auto">'+esc(m.m)+'</span></div>':'<div class="cl'+(m.me?' me':'')+'"><b>'+(m.g?'['+esc(m.g)+'] ':'')+esc(m.n)+'</b> <span dir="auto">'+esc(m.m)+'</span></div>').join('');
}
function renderChat(){
  if(!ONLINE)return '<h2>צ\'אט</h2><p class="hint">הצ\'אט עובד רק במצב מקוון, מול השרת.</p>';
  chatUnread=0;
  return '<div class="seg"><button class="btn sm'+(chatCh==='w'?' pri':'')+'" data-act="chatCh" data-c="w">כולם</button><button class="btn sm'+(chatCh==='g'?' pri':'')+'" data-act="chatCh" data-c="g">גילדה</button><button class="btn sm'+(chatCh==='p'?' pri':'')+'" data-act="chatCh" data-c="p">פרטי</button><span class="hint">'+L(onlineN)+' מחוברים עכשיו</span></div>'+
    '<div id="chatList">'+chatRows()+'</div><div class="chatSend"><input type="text" id="chatIn" maxlength="160" placeholder="'+(chatCh==='p'?(whisperTo?'הודעה פרטית אל '+esc(whisperTo.n):'בחר שחקן מכרטיס שחקן או מהחברים'):'כתוב הודעה')+'" autocomplete="off" enterkeyhint="send"><button class="btn pri" data-act="say">שלח</button></div>'+
    '<div class="seg notr" style="flex-wrap:wrap">'+EMO.map((e,i)=>'<button class="btn sm" data-act="emote" data-i="'+i+'">'+e+'</button>').join('')+'</div><p class="hint">הכפתורים למעלה מציגים תגובה מעל הדמות שלך למי שנמצא איתך במפה.</p>'+
    '<p class="hint">שמור על שפה מכבדת. קללות, הטרדה ופרסום מביאים להשתקה.</p>';
}
async function say(){
  const el=$('chatIn');if(!el)return;const m=el.value.trim();if(!m)return;el.value='';if(m==='מעגל הנצח'){tryEgg('circle');return;}
  if(chatCh==='p'){if(!whisperTo){toast('בחר קודם למי לכתוב');return;}if(!ws||ws.readyState!==1){toast('אין חיבור חי לשרת כרגע');el.value=m;return;}netSend({t:'whisper',k:whisperTo.k,m:m});return;}
  let j=null;try{j=await rpc('say',{m:m,g:chatCh==='g'});}catch(e){}
  const r=j&&j.result;if(!r||!r.ok){toast(r&&r.msg||'ההודעה לא נשלחה');if(!el.value)el.value=m;return;}
  beatT=99;
}
document.addEventListener('keydown',e=>{if(evKey(e)==='Enter'&&e.target&&e.target.id==='chatIn'){e.preventDefault();say();}});
function renderChatBar(){
  const el=$('chatBar');if(!el)return;if(!ONLINE||demo||!S){el.style.display='none';return;}el.style.display='';
  const m=Date.now()-chatAt<180000?chatLog[chatLog.length-1]:null,t=(chatUnread?'('+chatUnread+') ':'')+(m?(m.g?'['+m.g+'] ':'')+m.n+': '+m.m:'צ\'אט · '+onlineN+' מחוברים עכשיו');
  if(el.textContent!==t)el.textContent=t;
}
function loadGuild(){if(ONLINE&&!demo)send('gget',{});}
function siegeLine(){
  const s=siegeInfo(Date.now());
  return s.on?'המצור פעיל עכשיו, נשארו '+s.left+' דקות.':'המצור הבא בשבת ב-21:00, בעוד '+(s.next>=1440?Math.floor(s.next/1440)+' ימים':s.next>=60?Math.floor(s.next/60)+' שעות':s.next+' דקות')+'.';
}
function renderGuild(){
  let h='<h2>גילדה</h2>';if(!ONLINE)return h+'<p class="hint">גילדות עובדות רק במצב מקוון, מול השרת.</p>';
  const g=guild.mine,hold=guild.holder;
  h+='<button class="btn" data-act="sgGuide" style="width:100%;margin-bottom:6px">מדריך למצור: איך זה עובד</button>';
  h+='<div class="card"><p class="hint"><b>מצור הטירה</b> · '+siegeLine()+' קרב חי על טירה מוקפת חומה בסוף דרך ארוכה: עוברים את הסוללות, פורצים שער, שני חברים לוחצים על שני המתגים ונשארים עליהם, ומנהל הגילדה לוקח את הכתר במשך חצי דקה. מי שיוצא מהמתג או נופל מאבד אותו, והכתר נעצר. תוקף שנופל חוזר תוך כמה שניות למחנה, והמחנה מתקדם אל מאחורי כל קו חומה שנפרץ. מגיני הטירה חוזרים בתוך החומות אחרי המתנה ארוכה יותר. המצור נמשך שעה. המתגים והכתר נמצאים בחדר הכתר, מאחורי פתח אחד צר. קונים שיקויים אצל המוכר. קומבו עושים רק בסדר אחד ובקצב: תקיפה, אז המיומנות הראשונה, אז המיומנות המהממת, כל אחת כשהכפתור שלה נדלק. לחיצה מאוחרת או מתקפה אחרת באמצע מבטלת. קומבו מכה חזק, מהמם, הודף ומונע שיקוי לרגע. המיומנויות והשיקוי פועלים בלי המתנה: מי שמהיר בידיים ומדויק בקומבו מנצח. מגן עוצר הדיפה והלם, אבל לא את כל הנזק: מי שלא ממלא חיים בזמן נופל גם מאחורי מגן. המיומנות הגדולה היא זינוק: היא מגיעה רחוק ומנחיתה אותך על היריב. הדיפה היא מכה חלשה שזורקת את היריב רחוק, וככה אחד דוחף ממתג בזמן שהאחרים תוקפים. כל מקצוע מפעיל באף על חברי הגילדה שלידו: לוחם חיים, מכשפה הגנה, צייד כוח, ושלושתם יחד גם מהירות. מול דמות חזקה בהרבה אין סיכוי. בין שווים מכריעים מילוי החיים והקומבו. מי שמחזיק בכתר כשהזמן נגמר מחזיק בטירה שבוע, וכל חברי הגילדה מקבלים '+L('+10%')+' ניסיון וזהב, וגישה לעיר העתיקה.</p>'+(sgLive>Date.now()?'<button class="btn pri glow" style="width:100%;margin-bottom:6px" data-act="sgJoin"'+(netUp()&&SC.mode==='farm'&&guild.mine?'':' disabled')+'>'+(guild.mine?(sgTest?'הצטרף למצור הידידות':'הצטרף למצור')+' · נשארו '+L(mmss((sgLive-Date.now())/1000)):'רק חברי גילדה יכולים להצטרף')+'</button>':'')+'<p class="hint" style="display:none"></p><div class="kv"><span>מחזיקה בטירה</span><b>'+(hold?esc(hold.name)+' ['+esc(hold.tag)+']':'אף גילדה')+'</b></div></div>';
  if(!g){
    h+='<div class="card" style="display:flex;flex-direction:column;gap:8px"><p class="hint">עד 20 חברים. כל רמת גילדה מוסיפה '+L('1%')+' ניסיון לכל החברים, עד '+L('10%')+'. הרמה עולה מהחיסולים של כולם.</p>'+
      '<input type="text" id="gname" maxlength="14" placeholder="שם הגילדה, 3 עד 14 תווים" autocomplete="off"><input type="text" id="gtag" maxlength="4" placeholder="תג, 2 עד 4 תווים" autocomplete="off" dir="ltr">'+
      '<button class="btn pri" data-act="gcreate">פתח גילדה · '+L(fmt(GUILD_FEE))+' זהב</button></div>';
  }else{
    h+='<div class="card"><div class="kv"><span><b>'+esc(g.name)+'</b> ['+esc(g.tag)+']</span><b>רמה '+L(g.lvl)+' · '+L('+'+(g.lvl+(g.castle?10:0))+'%')+' ניסיון</b></div>'+
      '<div class="kv"><span>חיסולים של הגילדה</span><b class="num">'+L(fmt(g.points))+'</b></div><div class="kv"><span>נקודות במצור</span><b class="num">'+L(fmt(g.siege))+'</b></div>'+
      (g.notice?'<p class="hint" dir="auto" style="margin:6px 0;color:var(--ink)">'+esc(g.notice)+'</p>':'');
    g.members.forEach((m,i)=>{h+='<div class="kv"><span><i class="dot" style="background:var(--'+(m.on?'good':'line')+')"></i>'+esc(m.n)+(m.me?' (אתה)':'')+(m.ld?' · מוביל':'')+'</span><b>רמה '+L(m.l)+' · '+L(fmt(m.k))+(g.leader&&!m.me?' <button class="btn sm" data-act="gkick" data-i="'+i+'">הוצא</button>':'')+'</b></div>';});
    if(g.leader)h+='<div class="tog" style="margin-top:6px"><input type="text" id="gnotice" maxlength="120" placeholder="הודעה לחברי הגילדה" autocomplete="off"><button class="btn sm" data-act="gnotice">עדכן</button></div>';
    h+='<button class="btn sm" data-act="gleave" style="margin-top:8px">עזוב גילדה</button></div>';
  }
  if(guild.top&&guild.top.length){h+='<div class="card"><p class="hint"><b>גילדות מובילות</b></p>';
    for(const t of guild.top)h+='<div class="kv"><span>'+(t.castle?'♜ ':'')+esc(t.name)+' ['+esc(t.tag)+'] · '+L(t.n+'/20')+'</span><b>רמה '+L(t.lvl)+(t.siege?' · מצור '+L(fmt(t.siege)):'')+(!g&&t.n<20?' <button class="btn sm" data-act="gjoin" data-n="'+esc(t.name)+'">הצטרף</button>':'')+'</b></div>';
    h+='</div>';}
  return h;
}
function showBanned(msg){banned=true;openModal('<h3>החשבון מושעה</h3><p class="hint">'+esc(msg||'')+'</p><p class="hint">השעיה ניתנת כשהשרת מזהה דיווחי חיסולים שלא ייתכנו במשחק רגיל, או בהחלטת מנהל. אם לדעתך נפלה טעות, אפשר לפנות דרך עמוד התקנון.</p><div class="acts"><button class="btn" data-act="logout">התנתק</button></div>');}

/* ---------- account: recovery question, password, deletion ---------- */
const qSelect=id=>'<select id="'+id+'">'+SECRET_Q.map((q,i)=>'<option value="'+i+'">'+esc(q)+'</option>').join('')+'</select>';
const pwInput=(id,ph,ac)=>'<input type="password" id="'+id+'" maxlength="72" autocomplete="'+ac+'" placeholder="'+ph+'">';
function acctModal(kind,msg){
  const h=kind==='secret'?'<h3>שאלת שחזור</h3><p class="hint">אם תשכח את הסיסמה, התשובה תאפשר לקבוע סיסמה חדשה. בחר תשובה שרק אתה יודע.</p>'+qSelect('acQ')+'<input type="text" id="acA" maxlength="60" placeholder="התשובה שלך" autocomplete="off">'+pwInput('acP','הסיסמה הנוכחית','current-password')
    :kind==='pass'?'<h3>שינוי סיסמה</h3><p class="hint">אחרי השינוי, מכשירים אחרים יצטרכו להיכנס מחדש.</p>'+pwInput('acP','הסיסמה הנוכחית','current-password')+pwInput('acN','סיסמה חדשה, לפחות 8 תווים','new-password')
    :'<h3>מחיקת חשבון</h3><p class="hint" style="color:var(--bad)">המחיקה סופית. הדמויות, הציוד וההתקדמות נמחקים מהשרת ואי אפשר לשחזר אותם.</p>'+pwInput('acP','הסיסמה, לאישור','current-password');
  openModal(h+(msg?'<p class="hint" style="color:var(--bad)">'+esc(msg)+'</p>':'')+'<div class="acts"><button class="btn" data-act="closeModal">ביטול</button><button class="btn pri" data-act="acctGo" data-k="'+kind+'">'+(kind==='del'?'מחק לצמיתות':'שמור')+'</button></div>');
}
// Two-step sign-in: optional. Switched on with an authenticator app; eight backup codes are shown once.
let tfaSec=null;
function tfaModal(step,msg,codes){
  const bad=msg?'<p class="hint" style="color:var(--bad)">'+esc(msg)+'</p>':'',stop='<button class="btn" data-act="closeModal">ביטול</button>';
  if(codes){openModal('<h3>האימות הדו-שלבי פעיל</h3><p class="hint" style="color:var(--bad)">שמור את קודי הגיבוי במקום בטוח. כל קוד עובד פעם אחת, והם לא יוצגו שוב. בלי הטלפון ובלי הקודים אי אפשר להיכנס לחשבון.</p><p dir="ltr" style="font-family:monospace;font-size:15px;line-height:1.9;text-align:center;user-select:all">'+codes.map(esc).join('<br>')+'</p><div class="acts"><button class="btn pri" data-act="closeModal">שמרתי</button></div>');return;}
  if(me.tfa){openModal('<h3>כיבוי אימות דו-שלבי</h3><p class="hint">אחרי הכיבוי הכניסה לחשבון היא בסיסמה בלבד.</p>'+pwInput('tfP','הסיסמה הנוכחית','current-password')+'<input type="text" id="tfC" maxlength="16" autocomplete="one-time-code" placeholder="קוד מהאפליקציה או קוד גיבוי" dir="ltr">'+bad+'<div class="acts">'+stop+'<button class="btn pri" data-act="tfaGo" data-s="off">כבה</button></div>');return;}
  if(step==='code'&&tfaSec){openModal('<h3>אימות דו-שלבי</h3><p class="hint">1. פתח אפליקציית אימות בטלפון (למשל Google Authenticator או Authy) והוסף חשבון עם המפתח הזה:</p><p dir="ltr" style="font-family:monospace;font-size:14px;text-align:center;word-break:break-all;user-select:all">'+esc(tfaSec.secret)+'</p><a class="btn sm" href="'+esc(tfaSec.uri)+'" style="text-align:center;text-decoration:none;color:inherit">פתח באפליקציית האימות שבמכשיר הזה</a><p class="hint">2. הקלד את הקוד בן 6 הספרות שהאפליקציה מציגה:</p><input type="text" id="tfC" maxlength="6" inputmode="numeric" autocomplete="one-time-code" placeholder="קוד" dir="ltr">'+bad+'<div class="acts">'+stop+'<button class="btn pri" data-act="tfaGo" data-s="on">הפעל</button></div>');return;}
  openModal('<h3>אימות דו-שלבי</h3><p class="hint">לא חובה. כשהוא פעיל, כניסה לחשבון דורשת גם קוד מאפליקציית אימות בטלפון, כך שסיסמה שדלפה לא מספיקה. צריך טלפון עם אפליקציית אימות.</p>'+pwInput('tfP','הסיסמה הנוכחית','current-password')+bad+'<div class="acts">'+stop+'<button class="btn pri" data-act="tfaGo" data-s="start">המשך</button></div>');
}
async function tfaGo(step){
  const v=id=>$(id)?($(id).value||'').trim():'',kind=step==='start'?'tfaStart':step==='on'?'tfaOn':'tfaOff',args=step==='start'?{pass:$('tfP')?$('tfP').value:''}:step==='on'?{code:v('tfC')}:{pass:$('tfP')?$('tfP').value:'',code:v('tfC')};
  let r=null;try{r=await post({kind:kind,args:args},session&&session.token);}catch(e){}
  const j=r&&r.j;if(!j||!j.ok){tfaModal(step==='on'?'code':'',j&&j.msg||'אין חיבור לשרת');return;}
  if(step==='start'){tfaSec={secret:j.secret,uri:j.uri};tfaModal('code');return;}
  if(step==='on'){tfaSec=null;me.tfa=true;panelDirty=true;tfaModal('',null,j.codes);return;}
  me.tfa=false;panelDirty=true;closeModal();toast('האימות הדו-שלבי כובה');
}
async function acctGo(kind){
  const v=id=>$(id)?$(id).value:'',args=kind==='secret'?{pass:v('acP'),q:+v('acQ'),a:v('acA')}:kind==='pass'?{pass:v('acP'),next:v('acN')}:{pass:v('acP')};
  let r=null;try{r=await post({kind:kind==='secret'?'setsecret':kind==='pass'?'chpass':'delacct',args:args},session&&session.token);}catch(e){}
  const j=r&&r.j;if(!j||!j.ok){acctModal(kind,j&&j.msg||'אין חיבור לשרת');return;}
  if(kind==='del'){setSession(null);location.reload();return;}
  if(kind==='pass')setSession({token:j.token,user:j.user});else me.secret=true;
  closeModal();toast('נשמר');panelDirty=true;
}
let fg={user:'',q:null};
function showForgot(msg){
  openModal('<h3>שחזור סיסמה</h3>'+(fg.q==null?'<p class="hint">כתוב את שם המשתמש, ותוצג שאלת השחזור שנבחרה בהרשמה.</p><input type="text" id="fgUser" maxlength="16" autocomplete="username" autocapitalize="none" placeholder="שם משתמש">'
    :'<p class="hint">ענה על השאלה כדי לקבוע סיסמה חדשה:</p><p><b>'+esc(SECRET_Q[fg.q]||'')+'</b></p><input type="text" id="fgA" maxlength="60" placeholder="התשובה שלך" autocomplete="off">'+pwInput('fgP','סיסמה חדשה, לפחות 8 תווים','new-password')+(fg.tfa?'<input type="text" id="fgC" maxlength="16" autocomplete="one-time-code" placeholder="קוד אימות או קוד גיבוי" dir="ltr">':''))+
    (msg?'<p class="hint" style="color:var(--bad)">'+esc(msg)+'</p>':'')+'<div class="acts"><button class="btn" data-act="authBack">חזרה</button><button class="btn pri" data-act="forgotGo">המשך</button></div>');
}
async function forgotGo(){
  let r=null;
  if(fg.q==null){const u=($('fgUser').value||'').trim();if(u.length<3){showForgot('שם משתמש קצר מדי');return;}
    try{r=await post({kind:'forgot',args:{user:u}});}catch(e){}
    if(!r||!r.j||!r.j.ok){showForgot('אין חיבור לשרת. נסה שוב');return;}fg={user:u,q:r.j.q};showForgot();return;}
  const a=$('fgA').value||'',p=$('fgP').value||'';if(p.length<8){showForgot('הסיסמה צריכה לפחות 8 תווים');return;}
  try{r=await post({kind:'recover',args:{user:fg.user,a:a,pass:p,code:$('fgC')?($('fgC').value||'').trim():undefined}});}catch(e){}
  if(!r||!r.j){showForgot('אין חיבור לשרת. נסה שוב');return;}if(!r.j.ok){if(r.j.tfa)fg.tfa=true;showForgot(r.j.msg||'הפעולה נכשלה');return;}
  setSession({token:r.j.token,user:r.j.user});fg={user:'',q:null};openModal('<h3>מעגל הנצח</h3><p class="hint">מתחבר...</p>');await startOnline();
}
function loadMe(){
  if(!ONLINE||window.EC_MOCK||!session)return;
  pushLoad();
  post({kind:'whoami',args:{}},session.token).then(r=>{if(r.j&&r.j.ok){me={secret:!!r.j.secret,admin:!!r.j.admin,tfa:!!r.j.tfa};panelDirty=true;}}).catch(()=>{});
}

/* ---------- event announcements in the middle of the screen ---------- */
// From five minutes before an event, once a minute, and once more when it opens.
const annPrev={},annMark={},annLive={},annQ=[];let annT=0,annShow=0,annAge=99,annGap=0,annRemind=200;
// An announcement about an event can be pressed: it opens the events list at that event, or sends you straight into the circle while it takes fighters.
function announce(txt,live,ev){annQ.push({t:txt,live:!!live,ev:ev||''});if(annQ.length>4)annQ.shift();}
function annGo(){const el=$('annc'),ev=el&&el.dataset.ev;if(!ev||!el.classList.contains('on'))return;if(SC.duel)return;if(ev==='last'&&brSign()){if(!brJoin())toast('אין חיבור חי לשרת');return;}openTab('pass');renderPanel();setTimeout(()=>{const c=document.getElementById('ev_'+ev);if(c)c.scrollIntoView({block:'center',behavior:'smooth'});},60);}
{const el=document.getElementById('annc');if(el)el.addEventListener('click',annGo);}
function updateAnnounce(dt){
  const el=$('annc');if(!el)return;
  // A message starts a little below the middle, drifts up for most of a minute and fades. A newer one may replace it after a few seconds.
  if(annShow>0){annShow-=dt;annAge+=dt;if(annShow<=0||(annQ.length&&annAge>6)){el.classList.remove('on');annShow=0;annGap=.7;}}
  else if((annGap-=dt)<=0&&annQ.length&&S&&!demo){const a=annQ.shift();el.textContent=a.t;el.dataset.ev=a.ev||'';el.classList.toggle('go',!!a.ev);el.classList.toggle('live',a.live);
    el.style.transition='none';el.style.transform='translateY(0)';void el.offsetWidth;el.style.transition='opacity .7s, transform 52s linear';el.style.transform='translateY(-'+Math.round(H*.26)+'px)';
    el.classList.add('on');annShow=50;annAge=0;snd(a.live?'boss':'ok');}
  if(!S||demo||(annT+=dt)<1)return;annT=0;
  const now=Date.now(),list=EVENTS.map(e=>{const t=e.tiered?evTier(S.lvl):0;return {id:e.id,n:e.n+(t?' '+t:''),s:evNext(e,now),d:e.d,t:t,tiered:e.tiered};}),sg=siegeInfo(now);
  list.push({id:'siege',n:'מצור הטירה',s:sg.on?1e9:sg.next*60-new Date(now).getSeconds(),d:'קרב חי על הטירה. מצטרפים מלשונית הגילדה'});
  for(const e of list){const prev=annPrev[e.id];annPrev[e.id]=e.s;
    if(prev!=null&&prev<=90&&e.s>prev+120){annMark[e.id]=0;announce(e.tiered?e.n+' נפתחה! '+(A.keys>0?'לחץ על שגר למצודה':'צריך מפתח כדי להיכנס'):e.n+' התחיל! '+String(e.d).split('.')[0],true,e.id);continue;}
    if(e.s<=300&&e.s>5){const m=Math.ceil(e.s/60);if(annMark[e.id]!==m&&prev!=null){annMark[e.id]=m;announce(e.n+' מתחיל בעוד '+(m===1?'דקה':m+' דקות'),false,e.id);
      if(e.tiered&&m===4&&e.t&&!(A.keys>0))announce('אין לך מפתח למצודה. '+((A.shards||0)>=KEY_SHARDS?'צור אחד באירועים':'חסרים '+(KEY_SHARDS-(A.shards||0))+' שברי ארגמן'));
      if(e.tiered&&(m===5||m===2)){if(!e.t)announce('הכניסה ל'+e.n+' מרמה '+TIER_MIN[0]+'. חסרות לך '+(TIER_MIN[0]-S.lvl)+' רמות');else if(e.t<7)announce('עוד '+(TIER_MIN[e.t]-S.lvl)+' רמות לדרגה '+(e.t+1)+'. תספיק?');}}}}
  // While an event runs: how much is left, the moment its goal is reached, and what was missed when it closes.
  const ev=A.ev||{},wins=evWindows(now,1);
  for(const w of wins){const e=w.e;if(!e.obj)continue;const rec=ev[w.key]||{},have=Math.min(rec[e.obj[0]]||0,e.obj[1])+(e.obj[0]==='k'&&w.live?0:0),done=have>=e.obj[1],st=annLive[w.key]||(annLive[w.key]={});
    if(done&&!rec.c&&!st.done){st.done=1;announce('השלמת את '+e.n+'! הפרס מחכה באירועים',true,e.id);}
    if(w.live&&!done){const left=Math.ceil((w.end-now)/60000);if(left<=2&&st.left!==left&&e.id!=='quiz'){st.left=left;announce((left<=1?'דקה אחרונה: ':'נשארו 2 דקות: ')+e.n+' · '+have+'/'+e.obj[1]);}
      if(e.id==='quiz'&&!rec.t&&!st.q){st.q=1;announce('חידון המעגל פתוח. ענה בלשונית אירועים',true);}}
    if(!w.live&&!done&&!st.miss&&(have>0||e.id==='storm')){st.miss=1;announce('פספסת את '+e.n+'. הבא בעוד '+Math.ceil(evNext(e,now)/60)+' דקות');}}
  for(const k in annLive)if(!wins.some(w=>w.key===k))delete annLive[k];
  // Rewards left uncollected are called out every few minutes.
  if((annRemind+=1)>=240){annRemind=0;const lv=passLevel(S);
    if(A.login&&!A.login.got)announce('פרס הכניסה היומי מחכה לך');
    else if(lv>A.pass.claimed)announce('פרס פס העונה מחכה לאיסוף');
    else if(TASKS.some(t=>A.daily[t.k]>=t.n&&!A.daily.done[t.k]))announce('משימה יומית הושלמה. אסוף את הפרס');}
}

/* ---------- first steps ---------- */
const TUT=['החזק את החץ ימינה, או לחץ על השער, כדי לצאת מהכפר אל השדה','לחץ על מפלצת כדי לתקוף אותה. הדמות ממשיכה להילחם לבד','הכפתורים מימין הם הכישורים. הפעל את הראשון','אחרי 40 חיסולים מגיע בוס, והוא פותח את המפה הבאה. בקצה כל קומה יש סולם לקומה חזקה יותר','ברמה 400 עושים ריסט ומתחזקים. האירועים בשעות קבועות מקצרים את הדרך. בהצלחה'];
let tutStep=-1,tutT=0;
function updateTut(dt){
  const el=$('tip');if(!el)return;
  if(tutStep<0){if(!S||demo||prefs.tut||A.kills>60){el.style.display='none';return;}tutStep=0;}
  if(tutStep>=TUT.length){el.style.display='none';return;}
  tutT+=dt;
  const done=tutStep===0?SC.zi>=0:tutStep===1?(A.kills>=2||pend.kills>=2)&&tutT>3:tutStep===2?(pend.casts>0||A.casts>0)&&tutT>3||tutT>14:tutT>(tutStep===3?12:9);
  if(done){tutNext();return;}
  el.style.display=SC.mode==='farm'&&annAge>6&&!$('modal').classList.contains('on')?'':'none';
  const t=TUT[tutStep];if(el.dataset.t!==t){el.dataset.t=t;el.firstChild.textContent=t;el.lastChild.textContent='הבנתי · '+(tutStep+1)+'/'+TUT.length;}
}
function tutNext(){tutStep++;tutT=0;if(tutStep>=TUT.length){prefs.tut=1;savePrefs();$('tip').style.display='none';}}

/* ---------- loop ---------- */
let lastT=0,hudT=0,saveT=0,evT=0,resyncing=false;
function loop(ts){
  requestAnimationFrame(loop);if(!S)return;
  let dt=(ts-lastT)/1000;lastT=ts;if(!(dt>0))return;
  if(dt>3&&!demo){ // the tab was asleep: let the rules decide what happened meanwhile
    if(!resyncing){resyncing=true;send('sync',{}).then(r=>{resyncing=false;if(!r.ok||SC.mode!=='farm')return;if(SC.ev&&!S.evIn)leaveKeep(true);else if(!SC.ev&&(S.zone!==SC.zi||(S.floor|0)!==SC.fl))enterZone(S.zone,'L',S.floor);C=calc(S,auras);SC.hero.hp=C.hp;syncBoss();if(r.afk)showOffline(r.afk);saveLocal();});}
    return;
  }
  dt=Math.min(dt,.1);
  frame(dt);
  if((hudT+=dt)>.2){hudT=0;renderHud();const ae=document.activeElement;if(panelDirty&&!$('sheet').classList.contains('on')&&!(ae&&ae.tagName==='INPUT'&&$('panel').contains(ae)))renderPanel();}
  if(tab==='pass'&&(evT+=dt)>1){evT=0;panelDirty=true;}
  if(SC.duel)duelHpTick();
  if((ptyT+=dt)>.5){ptyT=0;renderPty();followStep();}
  if(ONLINE){pend.t+=dt;if(pend.t>8){pend.t=0;if(pend.kills||pend.casts||(party.code&&SC.zi>=0&&SC.mode==='farm'&&!document.hidden))flushTick();}
    if(!demo&&(beatT+=dt)>(peers.length?(ws&&ws.readyState===1?4:2.5):5)){beatT=0;beat();}
    if(!demo&&ws&&ws.readyState===1&&SC.mode==='farm'&&!SC.ev&&(mvT+=dt)>.08){const h=SC.hero,at=SC.t-(h.lastAtk||-9)<1.5,x=Math.round(h.x),v=Math.round(clamp((x-mvLast[0])/mvT,-1200,1200)),hpq=Math.round(clamp(h.hp/Math.max(1,C.hp),0,1)*20)*5;hitT+=.08;const say=hitOut[0]>0&&hitT>.3;if(peers.length&&(say||x!==mvLast[0]||at!==mvLast[1]||h.face!==mvLast[2]||v!==mvLast[3]||hpq!==mvLast[4])){mvLast=[x,at,h.face,v,hpq];const m={t:'mv',z:SC.zi,fl:SC.fl,x:x,f:h.face,a:at,v:v,p:hpq};if(say){m.h=hitOut[0];m.c=hitOut[1];hitT=0;}netSend(m);}if(say||!peers.length)hitOut=[0,0];mvT=0;}}
  else if((saveT+=dt)>8){saveT=0;if(localDirty){localDirty=false;saveLocal();}}
  updateTut(dt);updateAnnounce(dt);
  if(SC.mode==='farm'&&SC.zi>=0&&S&&!demo){if((killRateT-=dt)<=0){killRateT=1;killRate=maxKps(S,SC.ev?clamp(S.evZ|0,0,ZONES.length-1):SC.zi,auras,SC.ev?1:0);}killBudget=Math.min(100,killBudget+dt*killRate*.97);}
  if(SC.ev&&SC.evWait){SC.mons=[];if(Date.now()>=SC.evStart){SC.evWait=false;enterZone(SC.zi,'L',0,true);snd('boss');announce('המצודה נפתחה! השער ננעל',true);}else if((keepT+=dt)>25){keepT=0;send('tick',{ev:1,kills:0});}}
  if(SC.ev&&Date.now()>SC.evEnd+1500&&!busy){flushTick().then(()=>{if(SC.ev)leaveKeep(true);});SC.evEnd+=8000;}
}
document.addEventListener('visibilitychange',()=>{if(document.hidden&&A&&!demo){if(ONLINE)flushTick();else saveLocal();}});
window.addEventListener('pagehide',()=>{if(A&&!demo)saveLocal();});

function startDemo(){ // a live scene behind the first dialog
  demo=true;A=newAccount();const d=bind(A,newChar('גיבור','blade'));d.lvl=60;d.zone=0;d.eq.w={id:0,s:'w',t:3,r:3,p:9,z:0,af:[]};d.eq.g={id:0,s:'g',t:2,r:2,p:7,z:0,af:[]};
  A.chars=[d];S=d;C=calc(S,auras);enterZone(0,'L');SC.hero.hp=C.hp;renderHud();renderPanel();
}
async function boot(){
  loadSprites();resize();if(window.ResizeObserver)new ResizeObserver(resize).observe($('stage'));setNet(true);
  startDemo();requestAnimationFrame(t=>{lastT=t;requestAnimationFrame(loop);});
  if(!ONLINE){
    const o=loadLocal();if(!o){showCreate(false);return;}
    A=o;S=A.chars[A.cur];demo=false;const r=await send('sync',{});enterGame(r);saveLocal();return;
  }
  initServer();
  if(!session){showAuth();return;}
  openModal('<h3>מעגל הנצח</h3><p class="hint">מתחבר לשרת...</p>');
  await startOnline();
}
if(typeof window!=='undefined')window.EC={startArena,wbForce:v=>{wbForce=!!v;},brJoin,syncElite,spawnBoss,castArt,ARTS,duelAct,netSend,get peers(){return peers;},get ws(){return ws;},get A(){return A;},get S(){return S;},get C(){return C;},set C(v){C=v;},SC,G,send,act,frame,enterZone,pend,flushTick,syncBoss,spawnBoss,touch,get demo(){return demo;}};
startLang();
boot();

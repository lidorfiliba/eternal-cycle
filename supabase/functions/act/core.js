// Game rules shared by the browser client and the server function.
// Pure module: no DOM, no network. Randomness and time are injected with setEnv().
let _rnd=Math.random,_now=Date.now;
function setEnv(rnd,now){_rnd=rnd||Math.random;_now=now||Date.now;}

const CAP=400, BAG=30;
// Maps. The main road has twenty-four: the eight original regions, each followed by two more. Eight reset maps follow.
// [name, monster, lowest level, sprite, recolor (client only), kind, color, sky top, sky bottom, silhouette, light]
const ZRAW=[
 ['יער הלחישות','פטריית טחב',1,'mush',null,'blob','#7bd66a','#0f2a2b','#1d4a3a','#0a1c1c','#c8ff8a'],
 ['חורשת הפטריות','פטריית ארגמן',10,'mush','#e0527a','blob','#e86a8f','#2a0f24','#4a1d3a','#1c0a16','#ffb0d0'],
 ['שדה הזחלים','זחל ביצה',20,'worm','#6fd24a','crawler','#8fe05a','#102a14','#2a5a22','#0a1c0c','#d8ff9a'],
 ['מערות האבק','גובלין מערות',30,'gob',null,'crawler','#b49a7a','#1a1420','#3a2c33','#120d16','#d9c7a8'],
 ['המכרה הנטוש','כורה אבוד',43,'gob','#6a8fb0','brute','#8aa8c4','#10161f','#2a3a4a','#0a0f16','#b8d4ea'],
 ['נקיק העטלפים','עין מערות',56,'eye','#a8743a','ghost','#c08a4a','#1c120a','#40291a','#120b06','#e8c08a'],
 ['ביצת הערפל','עין מרחפת',70,'eye',null,'ghost','#8fe0d0','#0c1f2a','#24505a','#081419','#9ff5e6'],
 ['אגם הדמדומים','פטריית ביצה',86,'mush','#2fb8a8','blob','#4ad0c0','#0a1a26','#1f4a5c','#06121a','#8aeaf0'],
 ['החורבות הטבועות','שלד טבוע',103,'skel','#4a9a6a','brute','#6ab88a','#0a1c18','#1f4a3c','#061410','#a0f0c8'],
 ['חולות הזעם','תולעת אש',120,'worm',null,'crawler','#e0a044','#3a1c1a','#a8572a','#24100f','#ffd58a'],
 ['נווה השרב','שודד חולות',140,'gob','#d8a85a','crawler','#e8bc6a','#3a2a12','#b0803a','#241a0a','#ffe6a8'],
 ['קבר המלכים','שומר קבר',160,'skel','#d4b04a','brute','#e0c05a','#2a2010','#7a5c24','#1a1408','#fff0b0'],
 ['מצודת הכפור','שלד כפור',180,'skel_f',null,'brute','#9fd0ff','#0d1838','#3d6aa8','#0a1026','#ffffff'],
 ['מעבר הסופות','תולעת סופה',200,'worm_i','#b0e8ff','crawler','#b8ecff','#0c1c30','#4a86b0','#081420','#f0fbff'],
 ['אגם הקרח','עין כפור',220,'eye','#7ac8ff','ghost','#8ad4ff','#081830','#2a6ab0','#051020','#d8f2ff'],
 ['הר הגחלים','גובלין גחלת',240,'gob_r',null,'ghost','#ff6a3d','#1f0a0c','#7a1f14','#120506','#ffb066'],
 ['נהר הלבה','תולעת לבה',260,'worm','#ff4a2a','crawler','#ff5a3a','#240806','#9a2410','#160403','#ffa060'],
 ['כבשן הענקים','שלד גחלת',280,'skel','#ff8a3a','brute','#ff9a4a','#200c06','#8a3a12','#140703','#ffc890'],
 ['מגדל הצללים','עין צל',300,'eye_p',null,'brute','#a487ff','#0c0820','#3a2378','#070414','#c9b3ff'],
 ['ספריית הלחשים','עין אסורה',316,'eye_p','#ff6ad8','ghost','#e07aff','#140822','#4a1f70','#0b0416','#f0b8ff'],
 ['גשר הנשמות','גובלין רפאים',333,'gob','#9a7aff','ghost','#b09aff','#0a0a24','#2a2a78','#060616','#d0c8ff'],
 ['שער הנצח','שלד נצח',350,'skel_g',null,'drake','#f2c14e','#1a1030','#8a5a2a','#0f081c','#fff0b0'],
 ['גן הכוכבים','פטריית כוכב',367,'mush','#ffd75e','blob','#ffe07a','#10102e','#4a3a8a','#0a0a1e','#fff6c8'],
 ['כס הנצח','נחש נצח',384,'worm','#ffe08a','drake','#fff0a0','#201408','#a8782a','#140c04','#ffffe0'],
 // Reset maps: open only to characters that have reset. Far tougher monsters, more experience and gold. [.., resets needed]
 ['מעמקי השכחה','פטריית תהום',100,'mush_d',null,'blob','#b07cff','#12062a','#3b1466','#0a0318','#d6b3ff',1],
 ['יער הקוצים האפל','גובלין קוצים',150,'gob','#8a4ad0','crawler','#a060e0','#140a26','#3a1a66','#0c0618','#d0a8ff',1],
 ['קרחון האלים','תולעת קרח',200,'worm_i',null,'crawler','#8fe6ff','#061a2e','#2f7fa8','#04101c','#e8fbff',2],
 ['מפלי הדם','עין דם',250,'eye','#ff3a4a','ghost','#ff5a6a','#240408','#8a1420','#160205','#ffb0b8',3],
 ['היכל הזהב','גובלין זהב',300,'gob_g',null,'brute','#ffd24a','#2a1a05','#b8862a','#1a1003','#fff3c4',4],
 ['ארמון המראות','אביר מראה',340,'skel','#7af0ff','brute','#9af4ff','#06202a','#2a8aa0','#04141a','#e8ffff',5],
 ['לב המעגל','שלד דם',380,'skel_d',null,'brute','#ff5c5c','#1f0306','#8f1420','#120204','#ffb0b0',7],
 ['קצה העולם','תולעת ריק',392,'worm','#e0d0ff','drake','#f0e8ff','#0a0614','#3a2a5a','#06040c','#ffffff',10],
 // Far reset maps, for those who keep going: fifteen resets and beyond.
 ['שדות האפר','גובלין אפר',300,'gob','#9a9a9a','brute','#c8c8c8','#101010','#4a4a4a','#080808','#f0f0f0',15],
 ['מצולות הזמן','עין הזמן',340,'eye','#5affd0','ghost','#7affdc','#04201c','#1a8a70','#021410','#d8fff4',20],
 ['כור ההיתוך','שלד מותך',370,'skel','#ff5a1a','brute','#ff7a3a','#2a0a02','#b83a0a','#1a0601','#ffd0a0',30],
 ['לב הנצח','נחש הבריאה',395,'worm','#ffffff','drake','#fff8e0','#18102a','#7a5ac8','#0c0818','#ffffff',50]
];
const BASEZ=24,REGION=3;
// Reset maps are built for characters that kept their stats through resets: [life, damage] multipliers by the resets a map needs.
const RESET_TOUGH={1:[4,4],2:[4.5,6],3:[5,8],4:[5.5,11],5:[6.5,14],7:[10.5,20],10:[15,28],15:[34,70],20:[42,95],30:[65,165],50:[130,400]};
const SIGS=['xp','gold','hp','crit','aspd','cdmg','drop','dmg'],RSIGS=['xp','dmg','gold','cdmg','aspd','crit'];
const ZONES=ZRAW.map((q,i)=>{
  const min=q[2],req=q[11]||0,base=i<BASEZ,j=i-BASEZ,z={n:q[0],m:q[1],min:min,spr:q[3],tint:q[4],kind:q[5],c:q[6],sky:[q[7],q[8]],sil:q[9],amb:q[10],fly:q[3].indexOf('eye')===0};
  z.sig=base?SIGS[Math.floor(i/REGION)]:RSIGS[Math.floor(j/2)];
  z.hp=Math.round(90+9*min+.018*min*min);z.atk=Math.round(13+.84*min);z.xp=Math.round(10*Math.pow(1+min/50,1.6));z.gold=Math.round(3+.19*min);
  if(base){const w=[0,0,1,0,2,0,3,4][Math.floor(i/REGION)];if(w)z.wing=w;}
  else{const t=RESET_TOUGH[req]||[4,2.2];z.req=req;z.wing=5+Math.floor(j/2);z.xp=Math.round(z.xp*1.7);z.gold=Math.round(48+(min-100)*.314);z.hp=Math.round(z.hp*1.55*t[0]);z.atk=Math.round(z.atk*1.4*t[1]);}
  return z;});
// Gear tier of what a map drops: the main road climbs one tier per region (1 to 8), reset maps hold tiers 9 to 12.
const tierOf=zi=>zi<BASEZ?1+Math.floor(zi/REGION):9+Math.floor((zi-BASEZ)/2);
const MHP=ZONES.map(z=>z.hp),MATK=ZONES.map(z=>z.atk),ZSPR=ZONES.map(z=>z.spr),ZMON=ZONES.map(z=>z.m);
const CLS={
 blade:{n:'לוחם להב',main:'str',coef:1.5,combo:'סערת להבים',c:'#ff8a4d',wn:'להב',range:50,sk:['סערת להבים','שרשרת ברזל','זעם הקרב','מכת מחץ','חומת פלדה','אלף להבים'],al:{str:.6,agi:.15,vit:.25}},
 storm:{n:'מכשפת סער',main:'ene',coef:1.5,combo:'ברק שרשרת',c:'#6fd3ff',wn:'מטה',range:175,sk:['ברק שרשרת','מערבולת','הארת סער','כדור אש','מגן קסם','מטר מטאורים'],al:{ene:.6,agi:.15,vit:.25}},
 hunter:{n:'צייד צללים',main:'agi',coef:0.62,combo:'מטר חניתות',c:'#8be28b',wn:'חנית',range:235,sk:['מטר חניתות','רשת צללים','עין הנץ','חנית חודרת','צעד צל','מטח הציידים'],al:{agi:.7,vit:.3}}
};
const STATN={str:['כוח','נזק ללוחם להב'],agi:['זריזות','מהירות, קריטי, הגנה'],vit:['חיוניות','חיים והגנה'],ene:['אנרגיה','נזק למכשפת סער']};
const RAR=[{n:'רגיל',c:'#b9b4c7',m:1},{n:'קסום',c:'#5aa9ff',m:1.25},{n:'נדיר',c:'#c77dff',m:1.6},{n:'אגדי',c:'#ffb23e',m:2.1},{n:'עתיק',c:'#3df5c8',m:2.8}];
const TIERN=['חניך','ברזל','כסף ירח','חול זועם','כפור','גחלת','צל','נצח','תהום','קרחון','זהב טהור','מעגל','אפר הזמן','בריאה'];
// Fifty ranks of wings, each stronger than the one before. Monsters drop only the first eight; every rank above
// is reached by evolving a +15 wing with season feathers (see wingEvolve), so the top of the ladder takes months.
const WING_MAX=50,WING_FAM=['דרקון','צללים','כוכבים','סופה','עידן','אינסוף'],WING_GR=['','מחוזקות','נעלות','מלכותיות','קדומות','שמימיות','אלוהיות'];
const WINGN=['כנפי עלה','כנפי סער','כנפי להבה','כנפי נצח','כנפי תהום','כנפי קרחון','כנפי זהב','כנפי המעגל'];
for(let i=9;i<=WING_MAX;i++)WINGN.push('כנפי '+WING_FAM[Math.floor((i-9)/7)]+(WING_GR[(i-9)%7]?' '+WING_GR[(i-9)%7]:''));
const wingBase=t=>t<=8?6+6*t:54+1.6*(t-8);
const wingFeathers=t=>1+Math.floor(t/4),wingChance=t=>clamp(1-t*.014,.32,1); // to go from rank t to t+1
const AFF={dmg:['נזק',3,8],crit:['סיכוי קריטי',1,4],cdmg:['נזק קריטי',8,20],aspd:['מהירות תקיפה',2,6],hp:['חיים',4,10],def:['הגנה',4,10],xp:['ניסיון',3,8],gold:['זהב',5,15],drop:['סיכוי שלל',2,6]};
const POOL={w:['dmg','crit','cdmg','aspd','xp','gold','drop'],a:['hp','def','xp','gold','drop','crit'],g:['dmg','hp','xp','aspd','cdmg'],
  h:['hp','def','xp','crit','drop','cdmg'],p:['hp','def','xp','gold','drop','crit'],l:['aspd','crit','hp','def','drop','gold'],b:['hp','def','xp','gold','drop','aspd'],
  r:['dmg','crit','cdmg','aspd','xp'],q:['hp','def','xp','gold','drop'],n:['crit','cdmg','aspd','drop','gold','xp']};
const SLOTS=['w','h','a','p','l','b','g','r','q','n'],DROPS=['w','h','a','p','l','b'],ARM={h:.35,a:.6,p:.4,l:.3,b:.35};
// Jewelry: a ring of might (damage), a ring of life (health) and a necklace (some of both). Not part of any set.
const JEW=['r','q','n'],JEWV={r:[1,0],q:[0,1],n:[.55,.55]},jewBase=t=>1+.6*t;
const SLOTN={w:'נשק',h:'קסדה',a:'שריון',p:'מכנסיים',l:'כפפות',b:'מגפיים',g:'כנפיים',r:'טבעת עוצמה',q:'טבעת חיים',n:'שרשרת'};
const SETN=['שומרי היער','חופרי האבק','ילדי הערפל','זעם החולות','לב הכפור','גחלת נצחית','צל המגדל','כתר הנצח','בני התהום','נסיכי הקרח','אוצר ההיכל','לב המעגל','שומרי הזמן','יוצרי העולם'];
const SETB=[[2,'hp',10],[3,'dmg',12],[4,'cdmg',25],[5,'aspd',8],[6,'dmg',25],[6,'xp',20]];
// Every gear tier has two ancient sets: the first hits harder, the second (v:1) holds the line and finds more.
const SETN2=['ציידי הלילה','אבירי האבן','קוראי הסערה','נוודי השמש','שומרי הקרחון','בני הלהבה','לוחשי הצל','מלכי הנצח','שליטי המעמקים','אדוני הסופה','שומרי האוצר','חותמי המעגל','נוסעי הזמן','אבות הבריאה'];
const SETB2=[[2,'def',12],[3,'hp',15],[4,'crit',5],[5,'drop',10],[6,'hp',30],[6,'gold',25]];
const setKey=it=>(it.t-1)+(it.v?'b':''),setName=k=>(String(k).slice(-1)==='b'?SETN2:SETN)[parseInt(k)],setTable=k=>String(k).slice(-1)==='b'?SETB2:SETB;
const rslot=()=>DROPS[Math.floor(_rnd()*DROPS.length)];
const isSet=it=>it&&it.r===4&&DROPS.indexOf(it.s)>=0&&it.z>=0;
function setCounts(s){const c={};for(const k of DROPS){const it=s.eq[k];if(isSet(it)){const k=setKey(it);c[k]=(c[k]||0)+1;}}return c;} // a set is its gear tier: pieces from any map of that tier belong together
const UPCH=[.75,.65,.55,.5,.45,.4,.35,.3,.25];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const need=L=>Math.round((4+0.07*L)/1.5*10*Math.pow(1+L/50,1.6)*(1+1.25*Math.min(1,L/100)));
const pois=x=>{let n=Math.floor(x);if(_rnd()<x-n)n++;return n;};
function tzParts(){const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jerusalem',year:'numeric',month:'numeric',day:'numeric'}).formatToParts(new Date(_now()));const o={};for(const x of p)o[x.type]=x.value;return o;}
const dayKey=()=>{const o=tzParts();return o.year+'-'+(+o.month)+'-'+(+o.day);};
// A season lasts two months (Jan-Feb, Mar-Apr, ...); its key is the first of the two.
const seasonKey=()=>{const o=tzParts(),m=+o.month;return o.year+'-'+(m%2?m:m-1);};
// The pass is long, not hard: 60 levels, and playing (kills, resets, arena wins) feeds it only up to a daily
// amount, so the fastest finish takes weeks. Daily tasks are on top of that amount.
const PASS_MAX=60,PASS_STEP=200,PASS_DAY=250;
function passAdd(s,n){const g=Math.max(0,Math.min(n,PASS_DAY-(s.daily.pxp||0)));s.daily.pxp=(s.daily.pxp||0)+g;s.pass.xp+=g;}

const AFK=.7, SKLV=[1,20,60,110,180,260], SKCD=[4,12,30,10,25,45];
const SHARED=['gold','gems','cred','coins','boxes','sboxes','charms','bless','bonusPts','boost','inv','nid','kills','killAcc','pass','day','daily','rating','tickets','autoEq','autoSell','open','zk','login','jewels','prem','vip','shards','keys','feathers','pick','week','sq','eggs','areset'];
function newAccount(){
  return {v:2,gold:0,gems:3,cred:0,coins:0,boxes:1,sboxes:0,charms:0,bless:0,bonusPts:0,boost:0,inv:[],nid:1,kills:0,killAcc:0,
    pass:{key:seasonKey(),xp:0,claimed:0},day:dayKey(),daily:{kills:0,resets:0,wins:0,ups:0,boss:0,ev:0,done:{}},rating:1000,tickets:5,
    autoEq:true,autoSell:1,zv:2,open:0,zk:{},bossM:{},q:0,casts:0,wins:0,boss7:0,maxLvl:1,chars:[],cur:0,last:_now()};
}
function newChar(name,cls){
  return {name:name,cls:cls,lvl:1,xp:0,resets:0,pts:0,stats:{str:15,agi:15,vit:15,ene:15},zone:-1,floor:0,autoPts:true,auto:true,eq:{w:null,h:null,a:null,p:null,l:null,b:null,g:null,r:null,q:null,n:null},last:_now()};
}
function bind(A,ch){
  for(const k of SHARED)Object.defineProperty(ch,k,{get(){return A[k];},set(v){A[k]=v;},enumerable:false,configurable:true});
  return ch;
}
// A reward for showing up: seven days in a row, each better than the last. Missing a day, or not collecting, starts over.
const LOGIN_RW=[{t:'3 אבני נשמה',gems:3},{t:'תיבת אוצר',boxes:1},{t:'5 אבני נשמה',gems:5},{t:'מגילת ניסיון לחצי שעה',boost:1},{t:'2 תיבות אוצר',boxes:2},{t:'8 אבני נשמה וקמע הגנה',gems:8,charms:1},{t:'תיבת עונה ו-30 מטבעות עונה',sboxes:1,coins:30}];
const dayNum=()=>{const o=tzParts();return Math.round(Date.UTC(+o.year,+o.month-1,+o.day)/864e5);};
function loginDay(A){const dn=dayNum();let lg=A.login;if(!lg||typeof lg!=='object')lg=A.login={n:0,s:0,got:1};
  if(lg.n!==dn){lg.s=lg.n===dn-1&&lg.got?(clamp(lg.s|0,1,7)%7)+1:1;lg.n=dn;lg.got=0;}}
function ensureDay(s){
  if(s.day!==dayKey()){s.day=dayKey();s.daily={kills:0,resets:0,wins:0,ups:0,boss:0,ev:0,done:{}};s.tickets=Math.max(s.tickets,5);}
  if(s.pass.key!==seasonKey())s.pass={key:seasonKey(),xp:0,claimed:0};
}
function itemVals(it){
  const m=RAR[it.r].m*(1+0.08*it.p)*(it.pf?PERFECT_M:1);
  if(it.s==='w')return {atk:Math.round((20+25*it.t)*m)};
  if(ARM[it.s])return {hp:Math.round((80+110*it.t)*m*ARM[it.s]),def:Math.round((8+9*it.t)*m*ARM[it.s])};
  if(JEWV[it.s]){const j=jewBase(it.t)*(1+0.06*it.p)*(1+0.1*it.r)*(it.pf?PERFECT_M:1),o={};if(JEWV[it.s][0])o.wd=Math.round(j*JEWV[it.s][0]*10)/10;if(JEWV[it.s][1])o.wh=Math.round(j*JEWV[it.s][1]*10)/10;return o;}
  const w=wingBase(it.t)*(1+0.06*it.p)*(1+0.1*it.r);
  return {wd:Math.round(w*10)/10,wh:Math.round(w*5)/10};
}
function itemName(it,cls){
  if(it.s==='g')return (it.ex?(isFull(it)?'אקסלנט מלא · ':'אקסלנט · '):'')+(it.season?'כנפי העונה':WINGN[it.t-1]);
  return (it.pf?'עתיק מושלם · ':it.ex?(isFull(it)?'אקסלנט מלא · ':'אקסלנט · '):'')+(it.s==='w'?CLS[cls].wn:SLOTN[it.s])+(isSet(it)?' · '+setName(setKey(it)):' '+TIERN[it.t-1]);
}
function itemScore(it){
  const v=itemVals(it);let b=it.s==='w'?v.atk:ARM[it.s]?v.hp+v.def*10:((v.wd||0)+(v.wh||0)*(JEWV[it.s]?1:0))*100;if(isSet(it))b*=1.15;
  let a=0;for(const f of it.af)a+=f[1]/(AFF[f[0]][2]);
  return b*(1+a*0.12);
}
// What each class gives to party members fighting on the same map.
const AURAS={blade:{n:'זעקת קרב',d:'12% נזק'},storm:{n:'רוח סער',d:'10% מהירות תקיפה'},hunter:{n:'עין הצייד',d:'8% קריטי ו-15% נפילות'}};
const cleanAuras=l=>Array.isArray(l)?[...new Set(l.filter(k=>typeof k==='string'&&AURAS[k]))]:[];
// The rank of the Cycle: it never ends. Every monster the account has ever killed counts, each rank asks for more
// kills than the one before, and each gives a little damage and health to every character on the account.
const MASTERY_PCT=1,mastery=k=>Math.floor(Math.pow(Math.max(0,k|0)/2000,.6)),masteryNeed=l=>Math.ceil(2000*Math.pow(l,1/.6));
function calc(s,au){
  const c=CLS[s.cls],st=s.stats,a={dmg:0,crit:0,cdmg:0,aspd:0,hp:0,def:0,xp:0,gold:0,drop:0};
  let atk=0,ahp=0,adef=0,wd=0,wh=0;
  for(const k of SLOTS){const it=s.eq[k];if(!it)continue;const v=itemVals(it);
    atk+=v.atk||0;ahp+=v.hp||0;adef+=v.def||0;wd+=v.wd||0;wh+=v.wh||0;for(const f of it.af)a[f[0]]+=f[1];}
  const sc=setCounts(s);for(const z in sc)for(const b of setTable(z))if(sc[z]>=b[0])a[b[1]]+=b[2];
  const main=st[c.main];
  const base=10+main*c.coef+(st.str+st.agi+st.ene-main)*0.15+atk;
  const ml=mastery(s.kills);
  let dmg=base*(1+0.04*s.resets)*(1+a.dmg/100)*(1+wd/100)*(1+ml*MASTERY_PCT/100);
  let aspd=Math.min(3.2,(1.1+st.agi/500)*(1+a.aspd/100));
  let crit=Math.min(.6,.05+st.agi/3000+a.crit/100);
  const cdmg=2+a.cdmg/100;
  const hp=(120+st.vit*10+s.lvl*6+ahp)*(1+a.hp/100)*(1+wh/100)*(1+ml*MASTERY_PCT/100);
  const def=(st.agi*.15+st.vit*.1+adef)*(1+a.def/100);
  if(au&&au.length){if(au.includes('blade'))dmg*=1.12;if(au.includes('storm'))aspd*=1.1;if(au.includes('hunter'))crit=Math.min(.75,crit+.08);}
  const dps=dmg*aspd*(1+crit*(cdmg-1))*1.3;
  const boost=s.boost>(s._now||_now())?1.5:1,vip=(s.vip||0)>(s._now||_now())?1.15:1;
  return {dmg,aspd,crit,cdmg,hp,def,dps,power:Math.round(dps*.6+hp*.25+def*2),
    xpM:(1+a.xp/100)*(1+0.05*s.bless)*boost*vip,goldM:1+a.gold/100,dropM:(1+a.drop/100)*vip};
}
// Every map has floors: each deeper floor has tougher monsters, more XP and gold, and a better drop chance.
const FLOORS=3;
function floorMin(z,f){
  const d=ZONES[z];if(f<=0)return d.min;let nxt=CAP;
  for(const o of ZONES)if(!!o.req===!!d.req&&o.min>d.min&&o.min<nxt)nxt=o.min;
  return d.min+Math.round(f*(nxt-d.min)/FLOORS);
}
// A map is the same for everyone on it, whatever their resets, so a veteran can fight beside a newcomer.
// The challenge for players who have reset is in the reset maps (see RESET_TOUGH).
const STAT_MAX=32767,PARTY_SHARE=.5;
function zs(z,f){const d=ZONES[z];f=clamp(f|0,0,FLOORS-1);return {hp:Math.round(d.hp*(1+.4*f)),atk:Math.round(d.atk*(1+.3*f)),xp:Math.round(d.xp*(1+.3*f)),gold:1+.3*f,drop:1+.15*f};}
function canFloor(s,z,f){return z<0?f===0:(f>=0&&f<FLOORS&&canEnter(s,z)&&s.lvl>=floorMin(z,f));}
function afkFloor(s,z){let f=z===s.zone?clamp(s.floor|0,0,FLOORS-1):0;while(f>0&&s.lvl<floorMin(z,f))f--;return f;}
function zoneInfo(zi,c,f,fl){
  const z=zs(zi,fl),kt=z.hp/c.dps+0.55,taken=z.atk*300/(300+c.def);
  const e=clamp(c.hp/(taken*20),.3,1),kps=e/kt*(f||1);
  return {kps,xps:kps*z.xp*c.xpM,taken,e};
}
// May this character stand in this map? Story maps open by beating bosses; reset maps open by reset count.
function canEnter(s,z){
  if(z<0)return true;const d=ZONES[z];if(!d||d.min>s.lvl)return false;
  return d.req?s.resets>=d.req:z<=s.open;
}
function afkZone(s){
  if(s.zone<0)return -1;if(canEnter(s,s.zone))return s.zone;
  let z=Math.min(s.zone,s.open,BASEZ-1);while(z>0&&ZONES[z].min>s.lvl)z--;return z;
}
// What a piece asks of its wearer, as in MU: stats, never level, so gear stays wearable after a reset.
// A weapon and wings ask for the class's main stat, armor for vitality and some of the main stat; the numbers follow
// the level of the first map that drops the tier, and each + adds 3%. A character that lets the game place its points
// always meets the requirements of gear from maps it can reach.
const _tl={};
function tierLvl(t){if(t>8)return CAP+(t-9)*120; // gear of the reset maps asks for what only a reset gives
  if(_tl[t]==null){let m=1;for(let i=0;i<ZONES.length;i++)if(tierOf(i)===t){m=ZONES[i].min;break;}_tl[t]=m;}return _tl[t];}
function reqOf(it,cls){
  const main=CLS[cls].main,k=1+.03*(it.p|0),L=(it.s==='g'?Math.min(CAP,it.t*8):tierLvl(it.t))-1,q={};
  if(JEWV[it.s]){q[main]=Math.round(15+L*k);return q;}
  if(ARM[it.s]){q.vit=Math.round(15+.9*L*k);q[main]=Math.max(q[main]||0,Math.round(15+1.2*L*k));}
  else q[main]=Math.round(15+2.2*L*k);
  return q;
}
function canWear(s,it){const q=reqOf(it,s.cls);for(const k in q)if(s.stats[k]<q[k])return false;return true;}
function lacks(s,it){const q=reqOf(it,s.cls),o=[];for(const k in q)if(s.stats[k]<q[k])o.push(STATN[k][0]+' '+q[k]);return o.join(', ');}
function autoAlloc(s){
  if(s.pts<=0)return;const al=CLS[s.cls].al;let left=s.pts;
  const put=(k,n)=>{n=Math.max(0,Math.min(n,left,STAT_MAX-s.stats[k]));s.stats[k]+=n;left-=n;};
  // first whatever the gear it owns asks for, smallest gap first; then the class's usual split
  {const want={};for(const it of Object.values(s.eq).concat(s.inv||[])){if(!it)continue;const q=reqOf(it,s.cls);for(const k in q)want[k]=Math.max(want[k]||0,q[k]);}
    const gaps=Object.keys(want).map(k=>[k,want[k]-s.stats[k]]).filter(g=>g[1]>0).sort((a,b)=>a[1]-b[1]);for(const g of gaps)if(g[1]<=left)put(g[0],g[1]);}
  const pool=left;
  for(const k in al)put(k,Math.floor(pool*al[k]));
  for(const k of [CLS[s.cls].main,'vit','agi','ene','str'])if(left>0)put(k,left); // whatever a full stat cannot take goes to the next one
  s.pts=left;
}
function addXp(s,x){
  if(s.lvl>=CAP)return 0;let ups=0;s.xp+=x;
  while(s.lvl<CAP&&s.xp>=need(s.lvl)){s.xp-=need(s.lvl);s.lvl++;s.pts+=5;ups++;}
  if(s.lvl>=CAP)s.xp=0;
  if(ups&&s.autoPts)autoAlloc(s);
  return ups;
}
function rollAff(slot,t,sig,n){
  const pool=POOL[slot].slice(),out=[];
  const one=k=>{const d=AFF[k];let v=(d[1]+_rnd()*(d[2]-d[1]))*(0.7+0.06*t);out.push([k,Math.round(v*10)/10]);pool.splice(pool.indexOf(k),1);};
  if(n>0&&sig&&pool.indexOf(sig)>=0)one(sig);
  while(out.length<n&&pool.length)one(pool[Math.floor(_rnd()*pool.length)]);
  return out;
}
// Excellent items, as in MU: beyond their rarity they carry extra options, up to every option their slot can have ("full").
// How many they drop with: one is common, full is very rare. A perfection stone adds one missing option.
const EXW=[50,28,13,6,2.4,.6];
function addOpt(it){const have=it.af.map(f=>f[0]),pool=POOL[it.s].filter(k=>have.indexOf(k)<0);if(!pool.length)return false;
  const k=pool[Math.floor(_rnd()*pool.length)],d=AFF[k];it.af.push([k,Math.round((d[1]+_rnd()*(d[2]-d[1]))*(0.7+0.06*it.t)*10)/10]);return true;}
function makeExcellent(it){const max=POOL[it.s].length,i=rollRar(EXW),n=i===5?max:Math.min(max,it.af.length+i+1);it.ex=1;while(it.af.length<n&&addOpt(it));return it;}
const isFull=it=>!!(it&&it.ex&&it.af.length>=POOL[it.s].length);
function makeItem(s,slot,t,r,zi,extra){
  const it={id:s.nid++,s:slot,t:t,r:r,p:0,z:zi,af:rollAff(slot,t,zi>=0?ZONES[zi].sig:null,r)};
  if(r===4&&DROPS.indexOf(slot)>=0&&zi>=0&&(it.id*7+zi)%2)it.v=1;
  if(extra)Object.assign(it,extra);return it;
}
// The rarest thing in the game: an ancient set piece with every option it can hold and stronger base numbers.
// It only falls from bosses, champions and high tower floors, at odds that make a full set a matter of months.
const PERFECT_M=1.3,PERFECT_BOSS=.0003,PERFECT_ELITE=.0015,PERFECT_TOWER=.003,PERFECT_FLOOR=20;
function perfectDrop(S,zi,rep,ch){if(!(_rnd()<ch))return null;const it=makeItem(S,rslot(),tierOf(zi),4,zi);it.ex=1;while(addOpt(it));it.pf=1;gainItem(S,it,rep);if(rep){(rep.notable=rep.notable||[]).unshift(it);rep.perfect=1;}return it;}
function rollRar(tab){let x=_rnd()*100;for(let i=0;i<tab.length;i++){x-=tab[i];if(x<0)return i;}return 0;}
const sellVal=it=>Math.round(20*(it.s==='g'?it.t*3:it.t)*(it.r+1)*(it.r+1)*(1+it.p*.3)*(it.ex?3:1)*(it.pf?20:1));
// What the character bends down for. Gold, soul stones, boxes and shards are always taken; gear is taken by rarity,
// with ancient-set pieces, wings and excellent items as their own switches. What is not picked up stays on the ground.
const PICK_KEYS=['0','1','2','3','4','set','g','ex'];
const pickOf=A=>{const p=A.pick||{},o={};for(const k of PICK_KEYS)o[k]=p[k]!==false;return o;};
function picks(s,it){const p=pickOf(s);if(it.pf)return true;if(it.ex)return p.ex;if(it.s==='g')return p.g;if(isSet(it))return p.set;return p[it.r];}
const dropNote=(rep,it,cls,left)=>{if(rep){const l=rep.names=rep.names||[];if(l.length<8)l.push([itemName(it,cls),it.pf?6:it.ex?5:it.r,left?1:0]);}};
function stash(s,it,rep){
  if(it.pf){s.inv.push(it);return true;} // never sold on the way in, even with a full bag
  const weak=it.r<s.autoSell&&!it.ex;
  if(weak||s.inv.length>=BAG){const g=sellVal(it);s.gold+=g;if(rep){rep.sold=(rep.sold||0)+1;rep.gold=(rep.gold||0)+g;}return false;}
  s.inv.push(it);return true;
}
function gainItem(s,it,rep){
  if(rep&&!picks(s,it)){rep.left=(rep.left||0)+1;dropNote(rep,it,s.cls,true);return 'left';}
  dropNote(rep,it,s.cls,false);const cur=s.eq[it.s];
  if(s.autoEq&&canWear(s,it)&&(!cur||itemScore(it)>itemScore(cur))){s.eq[it.s]=it;if(rep)rep.equipped=(rep.equipped||0)+1;if(cur)stash(s,cur,rep);return 'eq';}
  return stash(s,it,rep)?'bag':'sold';
}
const JEW_RATE=.0003;
function jewelDrop(s,zi,rep,tab,exc){const it=makeItem(s,JEW[Math.floor(_rnd()*JEW.length)],tierOf(zi),rollRar(tab),zi);if(_rnd()<(exc||0))makeExcellent(it);const where=gainItem(s,it,rep);if(rep&&where!=='left'&&where!=='sold')(rep.notable=rep.notable||[]).push(it);return it;}
function rollLoot(s,zi,kills,c,rep){
  const z=ZONES[zi];
  const g=Math.round(kills*z.gold*c.goldM*(0.8+_rnd()*.4));s.gold+=g;rep.gold=(rep.gold||0)+g;
  const ng=pois(kills*.008);s.gems+=ng;rep.gems=(rep.gems||0)+ng;
  const nb=pois(kills*.0012);s.boxes+=nb;rep.boxes=(rep.boxes||0)+nb;
  const ni=Math.min(80,pois(kills*.03*c.dropM));
  const exc=z.req?.03:.012;
  for(let i=0;i<ni;i++){const it=makeItem(s,rslot(),tierOf(zi),rollRar([62,25,9,3.3,.7]),zi);if(_rnd()<exc)makeExcellent(it);
    const where=gainItem(s,it,rep);if(where!=='left')rep.items=(rep.items||0)+1;if((it.r>=2||it.ex)&&where!=='sold'&&where!=='left'){(rep.notable=rep.notable||[]).push(it);}}
  if(z.wing){const nw=Math.min(4,pois(kills*.0006*c.dropM));
    for(let i=0;i<nw;i++){const it=makeItem(s,'g',z.wing,rollRar([62,28,8,1.7,.3]),zi);if(_rnd()<exc*2)makeExcellent(it);gainItem(s,it,rep);(rep.notable=rep.notable||[]).push(it);}}
  {const nj=Math.min(3,pois(kills*JEW_RATE*c.dropM));for(let i=0;i<nj;i++)jewelDrop(s,zi,rep,[55,28,12,4,1],exc);}
  {const ns=pois(kills*.012);if(ns){s.shards=(s.shards||0)+ns;rep.shards=(rep.shards||0)+ns;}}
  s.kills+=kills;s.daily.kills+=kills;if(s.week)s.week.kills=(s.week.kills||0)+kills;s.killAcc+=kills;s.zk[zi]=(s.zk[zi]||0)+kills;
  if(s.killAcc>=100){const n=Math.floor(s.killAcc/100);s.killAcc-=n*100;passAdd(s,n*5);}
}
function offline(s,secs){
  ensureDay(s);
  const rep={secs:secs,kills:0,levels:0};let left=Math.min(secs,12*3600),now=s.last,guard=0;
  const perZone={};
  if(afkZone(s)<0)return rep;
  while(left>0.5&&guard++<(s.areset>0?6000:900)){
    s._now=now;const c=calc(s),zi=afkZone(s),zf=zoneInfo(zi,c,AFK,afkFloor(s,zi));
    let step=left;
    if(s.boost>now)step=Math.min(step,(s.boost-now)/1000+0.01);
    if(s.lvl<CAP){const t=(need(s.lvl)-s.xp)/zf.xps;if(t<step)step=t+1e-6;}
    perZone[zi]=(perZone[zi]||0)+zf.kps*step;
    rep.levels+=addXp(s,zf.xps*step);
    left-=step;now+=step*1000;
    if(s.lvl>=CAP&&(s.areset|0)>0&&left>1){autoReset(s);rep.resets=(rep.resets||0)+1;}
  }
  delete s._now;
  const c=calc(s),fz=zs(0,afkFloor(s,afkZone(s)));c.goldM*=fz.gold;c.dropM*=fz.drop;
  for(const zi in perZone){const k=Math.floor(perZone[zi]);if(k>0){rep.kills+=k;rollLoot(s,+zi,k,c,rep);}}
  return rep;
}
function canReset(s){return s.lvl>=CAP;}
function resetGain(s){return 10+2*Math.min(s.resets+1,10);}
function doReset(s){
  if(!canReset(s))return false;const g=resetGain(s);
  // Stats and unspent points stay: every run through the levels adds five points a level on top of what was there.
  s.resets++;s.lvl=1;s.xp=0;s.cred+=g;s.coins+=5;passAdd(s,150);s.daily.resets++;if(s.week)s.week.resets=(s.week.resets||0)+1;s.zone=-1;s.floor=0;
  if(s.autoPts)autoAlloc(s);return true;
}
// A bought auto reset: used only while the player is away. The character resets by itself at the top level, stays on
// its map and keeps training (the map falls back to what a low level can fight, and climbs again). It pays half the marks.
const ARESET_PACK=3,ARESET_MAX=30;
function autoReset(s){const z=s.zone,f=s.floor,c0=s.cred;if(!doReset(s))return false;s.cred=c0+Math.floor((s.cred-c0)/2);s.zone=z;s.floor=f;s.areset=(s.areset|0)-1;return true;}
// How many seconds of training away from the game until the current character stands at the top level with no auto
// reset left to spend, or null if that will not happen within the away limit. Works on a copy; changes nothing.
function afkEta(A){
  const o=adopt(JSON.parse(JSON.stringify(A)));if(!o)return null;const s=o.chars[o.cur];if(!s||afkZone(s)<0)return null;let t=0,guard=0;
  while(guard++<6000){if(s.lvl>=CAP){if((s.areset|0)>0){autoReset(s);continue;}return t;}
    const c=calc(s),zi=afkZone(s),zf=zoneInfo(zi,c,AFK,afkFloor(s,zi));if(!(zf.xps>0))return null;t+=(need(s.lvl)-s.xp)/zf.xps;if(t>12*3600)return null;addXp(s,need(s.lvl)-s.xp+1e-6);}
  return null;
}
function upCost(it){return {gems:1+Math.floor(it.p/3),gold:500*(it.s==='g'?it.t*2:it.t)*(it.p+1)};}
function upChance(it){return it.p<6?1:UPCH[it.p-6];}
function upgrade(s,it){
  if(it.p>=15)return 'max';const c=upCost(it);if(s.gems<c.gems||s.gold<c.gold)return 'poor';
  s.gems-=c.gems;s.gold-=c.gold;s.daily.ups++;
  if(_rnd()<upChance(it)){it.p++;return 'ok';}
  if(it.p>=7){if(s.charms>0){s.charms--;return 'saved';}it.p--;return 'down';}
  return 'fail';
}
function openBox(s,kind){
  const zi=Math.min(s.open,BASEZ-1);
  if(kind==='a'){const it=makeItem(s,rslot(),tierOf(zi),_rnd()<.25?4:3,zi);if(_rnd()<.2)makeExcellent(it);return {it:it,where:gainItem(s,it)};}
  if(kind==='s'){const it=makeItem(s,rslot(),tierOf(zi),rollRar([0,0,55,30,15]),zi);if(_rnd()<.08)makeExcellent(it);return {it:it,where:gainItem(s,it)};}
  const x=_rnd();
  if(x<.55){const it=makeItem(s,rslot(),tierOf(zi),rollRar([0,45,35,16,4]),zi);if(_rnd()<.02)makeExcellent(it);return {it:it,where:gainItem(s,it)};}
  if(x<.85){const n=3+Math.floor(_rnd()*4);s.gems+=n;return {txt:n+' אבני נשמה'};}
  const g=Math.round(ZONES[zi].gold*400*(0.8+_rnd()*.6));s.gold+=g;return {txt:g+' זהב'};
}
function passReward(lv){
  if(lv===60)return {t:'כנפי העונה',wing:[4,4,true]};
  if(lv===40)return {t:'6 נוצות נצח',feathers:6};
  if(lv===20)return {t:'3 נוצות נצח',feathers:3};
  if(lv===30||lv===50)return {t:'2 נוצות נצח',feathers:2};
  if(lv%10===0)return {t:'2 תיבות עונה',sboxes:2};
  if(lv%5===0)return {t:'תיבת עונה',sboxes:1};
  if(lv%2===0)return {t:(3+Math.floor(lv/10))+' אבני נשמה',gems:3+Math.floor(lv/10)};
  return {t:'15 מטבעות עונה',coins:15};
}
const passLevel=s=>Math.min(PASS_MAX,Math.floor(s.pass.xp/PASS_STEP));
const RESPEC_COST=15;
// A champion: now and then one monster of the pack is far stronger than the rest and carries a sure rare drop.
const ELITE_RATE=.004,ELITE_HP=9,ELITE_LIFE=180000;
// The Tower of Eternity: one boss a floor, each stronger than the last, with no top. Fought by hand in the arena,
// with the arena's moves. A floor is the same for everyone; only the first time through each floor pays.
const TOWER_TRIES=6;
const TRIAL_TRIES=3,TRIAL_T=[30,45],TRIAL_RW=[{gems:6,coins:15,boxes:1},{gems:4,coins:8},{gems:2,coins:4}],TRIAL_MOD=['זועם','משוריין','מהיר'],TRIAL_MEDAL=['זהב','כסף','ארד'];
const towerBoss=f=>({hp:Math.round(9000*Math.pow(1.2,f-1)),atk:Math.round(60*Math.pow(1.13,f-1))});
function towerReward(f){const rw={gems:2+Math.floor(f/4),gold:800*f};if(f%3===0)rw.coins=6+Math.floor(f/3);if(f%5===0)rw.sboxes=1;if(f%10===0)rw.feathers=1+Math.floor(f/20);return rw;}
const towerText=r=>[r.gems?r.gems+' אבני נשמה':'',r.gold?r.gold+' זהב':'',r.coins?r.coins+' מטבעות עונה':'',r.sboxes?'תיבת עונה':'',r.feathers?r.feathers+' נוצות נצח':''].filter(Boolean).join(', ');
// The world boss: health per player around when the first blow lands, and what a share of the damage is worth.
const WORLD_BASE=120000;
function worldReward(share,rank,killed){
  if(!killed)return {coins:3+Math.round(share*20)};
  if(rank===1)return {feathers:3,sboxes:2,coins:30};if(share>=.1)return {feathers:2,sboxes:1,coins:20};if(share>=.01)return {feathers:1,coins:10};return {coins:5};
}
const rewardText=r=>[r.feathers?r.feathers+' נוצות נצח':'',r.sboxes?r.sboxes+' תיבות עונה':'',r.coins?r.coins+' מטבעות עונה':''].filter(Boolean).join(', ');
const TASKS=[{k:'kills',n:1500,t:'חסל 1,500 מפלצות',xp:60},{k:'resets',n:1,t:'בצע ריסט',xp:100},{k:'wins',n:2,t:'נצח 2 קרבות זירה',xp:60},{k:'ups',n:3,t:'נסה 3 שדרוגים',xp:40},
  {k:'boss',n:3,t:'הבס 3 בוסים',xp:0,rw:{gems:6},rt:'6 אבני נשמה'},{k:'ev',n:2,t:'אסוף פרס מ-2 אירועים',xp:0,rw:{coins:12},rt:'12 מטבעות עונה'},{k:'big',f:'kills',n:6000,t:'חסל 6,000 מפלצות',xp:0,rw:{boxes:1,gold:3000},rt:'תיבת אוצר ו-3,000 זהב'}];
// Weekly tasks: larger, for the week (Sunday to Saturday, Israel time), paid in what the long chase needs.
const WEEKLY=[{k:'kills',n:40000,t:'חסל 40,000 מפלצות',rw:{feathers:1,gems:15},rt:'נוצת נצח ו-15 אבני נשמה'},{k:'resets',n:5,t:'בצע 5 ריסטים',rw:{cred:25,sboxes:1},rt:'25 אותות ריסט ותיבת עונה'},
  {k:'boss',n:25,t:'הבס 25 בוסים',rw:{feathers:1,boxes:2},rt:'נוצת נצח ו-2 תיבות אוצר'},{k:'wins',n:12,t:'נצח 12 קרבות זירה',rw:{coins:40},rt:'40 מטבעות עונה'},{k:'ev',n:10,t:'אסוף פרס מ-10 אירועים',rw:{sboxes:1,coins:20},rt:'תיבת עונה ו-20 מטבעות עונה'}];
const weekKey=()=>String(Math.floor((dayNum()+4)/7));
function ensureWeek(A){if(!A.week||A.week.key!==weekKey())A.week={key:weekKey(),kills:0,resets:0,boss:0,wins:0,ev:0,done:{}};return A.week;}
const bump=(A,k,n)=>{A.daily[k]=(A.daily[k]||0)+n;ensureWeek(A)[k]=(A.week[k]||0)+n;};
// Side quests turn up on the road: now and then, while fighting, a stranger asks for something in the map you are in.
// One at a time, with a deadline; ignoring it costs nothing.
const SIDEQ=[{k:'hunt',t:'ציד מהיר',d:n=>'חסל '+n+' מפלצות במפה הזו',n:[250,400,600],min:12,rw:m=>({gems:4+m*2,gold:1500*(m+1)})},
  {k:'boss',t:'ראש הלהקה',d:()=>'הבס את הבוס של המפה הזו',n:[1,1,1],min:15,rw:m=>({boxes:1,coins:6+m*3})},
  {k:'rare',t:'אספן',d:n=>'מצא '+n+' פריטים נדירים ומעלה במפה הזו',n:[2,3,4],min:20,rw:m=>({sboxes:m>1?1:0,gems:6+m*3,coins:5})}];
function sideOffer(A,zi,now){const i=Math.floor(_rnd()*SIDEQ.length),q=SIDEQ[i],m=Math.floor(_rnd()*3);A.sq={i:i,m:m,z:zi,n:q.n[m],have:0,until:now+q.min*60000};return A.sq;}
function sideAdd(A,k,zi,n,now,r){const q=A.sq;if(!q||q.done||n<=0)return;if(now>q.until){A.sq=null;if(r)r.sqLost=true;return;}if(q.z!==zi||SIDEQ[q.i].k!==k)return;q.have=Math.min(q.n,q.have+n);if(q.have>=q.n){q.done=1;if(r)r.sqDone=true;}}
// Hidden finds. Each pays once per account; the game never lists them.
const EGGS={moon:{rw:{gems:7},t:'הירח קרץ לך. 7 אבני נשמה'},dawn:{rw:{coins:15},t:'מי שקם בארבע בבוקר מקבל 15 מטבעות עונה'},circle:{rw:{gold:7777},t:'אמרת את מילת המעגל. 7,777 זהב'},
  lucky:{rw:{sboxes:1},t:'7,777 חיסולים בדיוק ביד. תיבת עונה'},still:{rw:{gems:5},t:'עמדת בשקט בכפר והקשבת. 5 אבני נשמה'}};
function fighter(s){const c=calc(s);const g=it=>it?[it.t,it.r,it.p,it.season?1:0,it.ex?(isFull(it)?2:1):0]:null;let mn=99,sum=0;for(const k in ARM){const p=s.eq[k]?s.eq[k].p|0:0;sum+=p;if(p<mn)mn=p;}
  return {n:s.name,c:s.cls,l:s.lvl,r:s.resets,p:c.power,d:Math.round(c.dmg),a:Math.round(c.aspd*100)/100,h:Math.round(c.hp),f:Math.round(c.def),cr:Math.round(c.crit*100)/100,cd:Math.round(c.cdmg*100)/100,w:g(s.eq.w),ar:g(s.eq.a),g:g(s.eq.g),rt:s.rating,sp:[mn===99?0:mn,Math.round(sum/5)],pf:SLOTS.reduce((n,k)=>n+(s.eq[k]&&s.eq[k].pf?1:0),0)};} // sp: lowest and average armor upgrade, for the glow others see
function simDuel(A,B){
  const f=[{hp:A.h*5,n:0,t:.2,o:A},{hp:B.h*5,n:0,t:.35,o:B}],ev=[];let guard=0;
  while(f[0].hp>0&&f[1].hp>0&&guard++<600){
    const i=f[0].t<=f[1].t?0:1,me=f[i],en=f[1-i];me.n++;
    const crit=_rnd()<me.o.cr,combo=me.n%6===0;
    let d=me.o.d*(crit?me.o.cd:1)*(combo?3:1)*300/(300+en.o.f)*(0.9+_rnd()*.2);
    d=Math.max(1,Math.round(d));en.hp-=d;ev.push({t:me.t,who:i,d:d,crit:crit,combo:combo});
    me.t+=1/Math.max(.3,me.o.a);
  }
  const win=f[1].hp<=0?0:f[0].hp<=0?1:(f[0].hp/(A.h*5)>=f[1].hp/(B.h*5)?0:1);
  return {ev:ev,win:win,ma:A.h*5,mb:B.h*5};
}

/* ---------- the manual duel: rounds in which both sides choose at once ----------
   Nothing is automatic. Each round a fighter picks one action, both are revealed together and the server settles them:
     a  attack   - the ordinary hit; builds the combo and 20 energy
     h  heavy    - 2.2x for 40 energy; goes through a guard, but an ordinary attack lands first and weakens it
     g  guard    - takes a quarter of an attack and strikes back; useless against a heavy blow
     c  combo    - 3.2x, needs three landed hits in a row
     u  ultimate - 4.5x for 100 energy
     p  potion   - restores 30% health, three a duel, and leaves the drinker open
   Health is a share of the fighter's own pool. Gear and stats set how much of it a hit removes; the square root
   keeps a stronger fighter clearly ahead without making the choices irrelevant. The same engine runs a duel
   against an absent player (the server picks his actions) and one between two players who are both present. */
// The live duel: what each move does, in units of a fighter's `base` (the share of the enemy's health one
// second and a half of ordinary attacking removes). The device runs the fight; the server knows these numbers too.
const DUEL_LIVE={time:75,pots:3,heal:.3,sk:[{m:.9,cd:5},{m:1.6,cd:9,stun:.8},{cd:14,dur:3,cut:.6},{m:2.8,cd:22}],dash:{cd:4,inv:.45,d:150},potCd:5,maxRate:(1.5/1.5)+.9/5+1.6/9+2.8/22};
// One set of rules for the live duel, used by the browser (against a fighter the game plays) and by the server
// (between two players who are both connected, where the server alone decides what a move did).
// Positions are in arena units: LIVE_W across, depth z from 0 to 1. Times are seconds on the duel's own clock D.t.
const LIVE_W=400,LIVE_RNG={blade:62,storm:185,hunter:235},LIVE_LANE=.3;
function liveFrom(L,ca,cb){
  const mk=(i,cls)=>({x:i?LIVE_W*.76:LIVE_W*.24,z:.5,hp:1,cls:CLS[cls]?cls:'blade',at:{atk:.4,s0:1,s1:2,s2:0,s3:6,dash:0,pot:0},stun:0,sh:0,inv:0,pots:DUEL_LIVE.pots,chain:0});
  return {f:[mk(0,ca),mk(1,cb)],b:L.b.slice(0,2),cr:L.cr.slice(0,2),T:L.T.slice(0,2),pool:L.pool.slice(0,2),t:0,over:0,win:-1};
}
function liveNew(A,B){const D=duelNew(A,B),T=x=>clamp(1/Math.max(.3,x.a),.3,1.2);return liveFrom({b:[D.f[0].base,D.f[1].base],cr:[D.f[0].cr,D.f[1].cr],T:[T(A),T(B)],pool:[A.h*5,B.h*5]},A.c,B.c);}
// One move by side i. Returns what happened, or null if the move was not possible right now.
function liveAct(D,i,k,rnd){
  if(D.over)return null;const me=D.f[i],en=D.f[1-i],t=D.t,K=DUEL_LIVE,dist=Math.abs(en.x-me.x),rng=LIVE_RNG[me.cls],lane=Math.abs(en.z-me.z)<=LIVE_LANE;
  if(me.stun>t||!(k in me.at)||me.at[k]>t)return null;
  const o={by:i,k:k,dm:0,crit:false,miss:null,stun:false,fin:false,heal:0};
  const hit=mult=>{if(!lane){o.miss='lane';return;}if(en.inv>t){o.miss='inv';return;}o.crit=rnd()<D.cr[i];let dm=D.b[i]*mult*(o.crit?1.5:1)*(.9+rnd()*.2);if(en.sh>t){dm*=1-K.sk[2].cut;o.guard=true;}en.hp-=dm;o.dm=dm;};
  if(k==='atk'){if(dist>rng+14)return null;const T=D.T[i];me.at.atk=t+T;me.chain=(me.chain+1)%4;o.fin=me.chain===0;hit(T/1.5*(o.fin?1.5:.84));}
  else if(k==='s0'){if(dist>rng+40)return null;me.at.s0=t+K.sk[0].cd;hit(K.sk[0].m);}
  else if(k==='s1'){if(dist>rng+20)return null;me.at.s1=t+K.sk[1].cd;hit(K.sk[1].m);if(!o.miss&&!o.guard){en.stun=t+K.sk[1].stun;o.stun=true;}}
  else if(k==='s2'){me.at.s2=t+K.sk[2].cd;me.sh=t+K.sk[2].dur;}
  else if(k==='s3'){if(dist>rng+60)return null;me.at.s3=t+K.sk[3].cd;hit(K.sk[3].m);}
  else if(k==='dash'){me.at.dash=t+K.dash.cd;me.inv=t+K.dash.inv;}
  else if(k==='pot'){if(me.pots<1)return null;me.at.pot=t+K.potCd;me.pots--;me.hp=Math.min(1,me.hp+K.heal);o.heal=K.heal;}
  o.hp=[D.f[0].hp,D.f[1].hp];liveOver(D);return o;
}
function liveOver(D){if(!D.over&&(D.f[0].hp<=0||D.f[1].hp<=0||D.t>=DUEL_LIVE.time)){D.over=1;D.win=D.f[1].hp<=0?0:D.f[0].hp<=0?1:(D.f[0].hp>=D.f[1].hp?0:1);}return D.over;}
// The Last Circle: a live battle royale of up to eight, held on the game server for players who are connected and came
// to the arena during sign-up. Empty places are taken by fighters the server plays. Everyone starts equal, whatever
// they wear outside: strength comes from what is found on the ground (weapons, armor, boots, potions). The field is
// a wide round plain; a circle closes on its middle and burns whoever is outside. Positions are x,y from the middle.
const BR={R:700,MAX:8,FILL:6,TIME:150,HOLD:20,END:60,SIGN:2,pots:1,ring:.1,hit:.032,T:.6,spd:150,pick:30,loot0:24,every:6,drop:40,
  cls:{blade:1,storm:.75,hunter:.7},wMax:3,aMax:3,bMax:2,pMax:4};
const brDist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const brSpeed=f=>BR.spd*(1+.12*(f.bt|0));
function brSpot(B,rnd,rad){const a=rnd()*6.2832,r=Math.sqrt(rnd())*rad;return [Math.round(Math.cos(a)*r),Math.round(Math.sin(a)*r)];}
function brLoot(B,rnd,k,x,y){const q=rnd(),it={id:B.lid++,x:x,y:y,k:k||(q<.3?'w':q<.6?'a':q<.85?'p':'b')};B.loot.push(it);return it;}
function brNew(ps,rnd){
  const n=ps.length,ord=ps.map((_,i)=>i);for(let i=n-1;i>0;i--){const j=Math.floor(rnd()*(i+1)),t=ord[i];ord[i]=ord[j];ord[j]=t;}
  const B={t:-4,over:0,out:[],loot:[],lid:1,nextLoot:BR.every,dropped:false,f:ps.map((p,i)=>{const a=ord[i]/n*6.2832+rnd()*.3;return {id:p.id,n:p.n,c:CLS[p.c]?p.c:'blade',bot:!!p.bot,x:Math.round(Math.cos(a)*BR.R*.78),y:Math.round(Math.sin(a)*BR.R*.78),hp:1,
    at:{atk:0,s0:1,s1:3,s2:0,s3:8,dash:0,pot:0},stun:0,sh:0,inv:0,alive:true,kills:0,pots:BR.pots,chain:0,face:1,think:rnd()*.6,w:0,ar:0,bt:0};})};
  for(let i=0;i<BR.loot0;i++){const p=brSpot(B,rnd,BR.R*.7);brLoot(B,rnd,null,p[0],p[1]);}
  return B;
}
const brAlive=B=>B.f.filter(f=>f.alive).length;
function brRing(B){const u=clamp((B.t-BR.HOLD)/(BR.TIME-20-BR.HOLD),0,1);return BR.R+(BR.END-BR.R)*u;} // the circle's radius now
function brKill(B,j,by){const e=B.f[j];if(!e.alive)return;e.alive=false;e.hp=0;B.out.push(j);if(by>=0&&B.f[by])B.f[by].kills++;
  B.loot.push({id:B.lid++,x:Math.round(e.x),y:Math.round(e.y),k:e.w>0?'w':e.ar>0?'a':'p'});B.fresh=(B.fresh||[]).concat([B.loot[B.loot.length-1]]);if(brAlive(B)<=1)B.over=1;}
// What a fighter may take: nothing he already has at its limit, so it stays for someone else.
const brCan=(f,k)=>k==='w'?f.w<BR.wMax:k==='W'?f.w<BR.wMax||f.ar<BR.aMax:k==='a'?f.ar<BR.aMax:k==='p'?f.pots<BR.pMax:f.bt<BR.bMax;
function brTake(f,k){if(k==='w')f.w++;else if(k==='W'){f.w=BR.wMax;f.ar=Math.min(BR.aMax,f.ar+1);}else if(k==='a')f.ar++;else if(k==='p')f.pots++;else f.bt++;}
function brAct(B,i,k,rnd){
  const me=B.f[i],t=B.t,K=DUEL_LIVE;if(B.over||t<0||!me||!me.alive||me.stun>t||!(k in me.at)||me.at[k]>t)return null;
  const o={by:i,k:k,to:-1,dm:0,crit:false,miss:false,stun:false,dead:false,heal:0};
  if(k==='s2'){me.at.s2=t+K.sk[2].cd;me.sh=t+K.sk[2].dur;return o;}
  if(k==='dash'){me.at.dash=t+K.dash.cd;me.inv=t+K.dash.inv;return o;}
  if(k==='pot'){if(me.pots<1)return null;me.at.pot=t+K.potCd;me.pots--;me.hp=Math.min(1,me.hp+K.heal);o.heal=K.heal;return o;}
  const rng=LIVE_RNG[me.c]+(k==='atk'?14:k==='s3'?60:k==='s0'?40:20);let j=-1,bd=1e9;
  B.f.forEach((e,q)=>{if(q===i||!e.alive)return;const d=brDist(e,me);if(d<=rng&&d<bd){bd=d;j=q;}});if(j<0)return null;
  const e=B.f[j];let mult;if(k==='atk'){me.at.atk=t+BR.T;me.chain=(me.chain+1)%4;mult=me.chain===0?1.5:1;}else{const sk=K.sk[k==='s0'?0:k==='s1'?1:3];me.at[k]=t+sk.cd;mult=sk.m*1.6;}
  o.to=j;if(Math.abs(e.x-me.x)>4)me.face=e.x>=me.x?1:-1;if(e.inv>t){o.miss=true;return o;}
  o.crit=rnd()<.12;let dm=BR.hit*BR.cls[me.c]*(1+.35*me.w)*(1-.15*e.ar)*mult*(o.crit?1.5:1)*(.9+rnd()*.2);if(e.sh>t){dm*=1-K.sk[2].cut;o.guard=true;}
  e.hp-=dm;o.dm=dm;if(k==='s1'&&!o.guard){e.stun=t+K.sk[1].stun;o.stun=true;}if(e.hp<=0){brKill(B,j,i);o.dead=true;}return o;
}
// One step of the server's clock: new finds appear, whoever walks over one takes it, the circle burns whoever is
// outside, and the server's own fighters look for gear, close in and fight.
function brStep(B,dt,rnd){
  const ev=[];if(B.over)return ev;B.t+=dt;if(B.t<0)return ev;const R=brRing(B),t=B.t;
  if(B.fresh){for(const it of B.fresh)ev.push({k:'spawn',l:[it.id,it.x,it.y,it.k]});B.fresh=null;}
  if(t>=B.nextLoot){B.nextLoot=t+BR.every;const p=brSpot(B,rnd,R*.85),it=brLoot(B,rnd,null,p[0],p[1]);ev.push({k:'spawn',l:[it.id,it.x,it.y,it.k]});}
  if(!B.dropped&&t>=BR.drop){B.dropped=true;const it=brLoot(B,rnd,'W',0,0);ev.push({k:'spawn',l:[it.id,0,0,'W'],big:1});}
  B.f.forEach((f,i)=>{if(!f.alive)return;
    for(let q=B.loot.length-1;q>=0;q--){const it=B.loot[q];if(Math.abs(it.x-f.x)<BR.pick&&Math.abs(it.y-f.y)<BR.pick&&brCan(f,it.k)){brTake(f,it.k);B.loot.splice(q,1);ev.push({k:'pick',by:i,id:it.id,it:it.k});}}
    if(Math.hypot(f.x,f.y)>R){f.hp-=BR.ring*dt;if(f.hp<=0){brKill(B,i,-1);ev.push({by:-1,k:'ring',to:i,dead:true});}}});
  B.f.forEach((f,i)=>{if(!f.alive||!f.bot||B.over||f.stun>t)return;let j=-1,bd=1e9;B.f.forEach((e,q)=>{if(q===i||!e.alive)return;const d=brDist(e,f);if(d<bd){bd=d;j=q;}});if(j<0)return;
    const e=B.f[j],rng=LIVE_RNG[f.c],sp=brSpeed(f)*.9*dt,far=Math.hypot(f.x,f.y);let tx=e.x,ty=e.y,go=bd>rng*.85,back=false;
    let li=null,ld=1e9;for(const it of B.loot){if(!brCan(f,it.k)||Math.hypot(it.x,it.y)>R)continue;const d=brDist(it,f);if(d<ld){ld=d;li=it;}}
    if(far>R-30){tx=0;ty=0;go=true;}                                            // first of all, stay inside
    else if(li&&(t<30&&bd>rng||ld<260&&bd>rng*1.1||f.w<1&&ld<bd)){tx=li.x;ty=li.y;go=true;}      // gear nearby, or unarmed: fetch it
    else if(f.hp<.3&&f.pots<1&&e.w>=f.w){tx=f.x-(e.x-f.x);ty=f.y-(e.y-f.y);go=true;back=true;} // hurt and outgunned: run
    else if(rng>100&&bd<rng*.4){tx=f.x-(e.x-f.x);ty=f.y-(e.y-f.y);go=true;back=true;}
    else if(bd>420&&t<70){if(li){tx=li.x;ty=li.y;go=true;}else go=false;}                 // nobody near yet: keep gearing up
    if(go){const dx=tx-f.x,dy=ty-f.y,d=Math.hypot(dx,dy)||1,st=Math.min(d,sp);f.x+=dx/d*st;f.y+=dy/d*st;if(Math.abs(dx)>4)f.face=(back?-dx:dx)>=0?1:-1;const fr=Math.hypot(f.x,f.y);if(fr>BR.R){f.x*=BR.R/fr;f.y*=BR.R/fr;}}
    if((f.think-=dt)>0)return;f.think=.2+rnd()*.3;
    const tryK=k=>{const o=brAct(B,i,k,rnd);if(o)ev.push(o);return !!o;};
    if(f.hp<.4&&f.pots>0&&tryK('pot'))return;if(f.hp<.5&&bd<rng&&rnd()<.25&&tryK('s2'))return;
    if(rnd()<.3&&(tryK('s3')||tryK('s1')||tryK('s0')))return;tryK('atk');});
  if(!B.over&&B.t>=BR.TIME){B.over=1;}
  return ev;
}
// Places, winner first: whoever still stands (most health first), then the fallen from last to first.
function brRank(B){const a=B.f.map((f,i)=>i).filter(i=>B.f[i].alive).sort((x,y)=>B.f[y].hp-B.f[x].hp);return a.concat(B.out.slice().reverse());}
function brBots(ps,n,rnd){const cl=Object.keys(CLS),out=[];
  for(let i=0;i<n;i++)out.push({id:'bot'+i,bot:true,n:BOTN[i%BOTN.length],c:cl[Math.floor(rnd()*cl.length)],l:ps[0]?ps[0].l:1,r:0,p:ps[0]?ps[0].p:1,d:10,a:1,h:100,f:0,cr:.05,cd:2,w:null,ar:null,g:null,rt:1000,sp:[0,0]});return out;}
// The prize, by place. An ancient chest opens on the spot: a sure ancient set piece when at least two players fought
// (legendary or ancient when the winner was alone with the server's fighters), plus a jewel.
function brReward(A,place,humans){
  const S=A.chars[A.cur];if(!S)return '';ensureDay(A);const zi=clamp(A.open|0,0,ZONES.length-1),parts=[];A.brN=(A.brN||0)+1;
  if(place===0){A.brW=(A.brW||0)+1;const it=makeItem(S,rslot(),tierOf(zi),humans>=2?4:rollRar([0,0,0,70,30]),zi);if(_rnd()<.15)makeExcellent(it);if(humans>=3&&_rnd()<.01){it.r=4;it.ex=1;while(addOpt(it));it.pf=1;}
    if(it.pf||S.inv.length<BAG)S.inv.push(it);else S.gold+=sellVal(it);const jw=jewelDrop(S,zi,null,[0,0,50,35,15],.15);A.coins+=40;A.feathers=(A.feathers||0)+1;passAdd(A,60);
    parts.push('תיבה עתיקה: '+itemName(it,S.cls),itemName(jw,S.cls),'40 מטבעות עונה','נוצת נצח');}
  else if(place===1){A.sboxes+=1;A.coins+=20;passAdd(A,30);parts.push('תיבת עונה','20 מטבעות עונה');}
  else if(place===2){A.boxes+=1;A.coins+=12;passAdd(A,20);parts.push('תיבת אוצר','12 מטבעות עונה');}
  else{A.coins+=5;passAdd(A,10);parts.push('5 מטבעות עונה');}
  return parts.join(', ');
}
function brWindow(now){const w=evWindows(now,0).find(x=>x.e.br);if(!w)return null;const start=w.end-w.e.dur*60000,signEnd=start+BR.SIGN*60000;return {key:w.key,phase:now<signEnd?'sign':'fight',signEnd:signEnd,end:w.end};}
const DUEL_ROUNDS=30,DUEL_POTS=3,DUEL_MULT={a:1,h:2.2,c:3.2,u:4.5,g:0,p:0};
function duelNew(A,B){
  const raw=(x,y)=>x.d*Math.max(.3,x.a)*300/(300+y.f)/Math.max(1,y.h*5),K=.09/Math.sqrt(Math.max(1e-12,raw(A,B)*raw(B,A)));
  const mk=(x,y)=>({hp:1,en:0,pots:DUEL_POTS,combo:0,base:clamp(raw(x,y)*K,.03,.3),cr:clamp(+x.cr||0,0,.75)});
  return {f:[mk(A,B),mk(B,A)],n:0,over:0,win:-1};
}
const duelCan=(f,a)=>a==='a'||a==='g'||(a==='h'&&f.en>=40)||(a==='c'&&f.combo>=3)||(a==='u'&&f.en>=100)||(a==='p'&&f.pots>0);
function duelRound(D,a0,a1){
  if(D.over)return null;const f=D.f,act=[duelCan(f[0],a0)?a0:'a',duelCan(f[1],a1)?a1:'a'],d=[0,0],crit=[false,false],ctr=[0,0];
  for(let i=0;i<2;i++)if(act[i]==='p'){f[i].pots--;f[i].hp=Math.min(1,f[i].hp+.3);}
  for(let i=0;i<2;i++){const me=f[i],x=act[i],y=act[1-i];let m=DUEL_MULT[x];if(!m)continue;
    if(x==='h'&&y==='a')m*=.7;
    if(y==='g'){m*=x==='a'?.25:x==='h'?.9:x==='c'?.4:.55;if(x==='a')ctr[1-i]=f[1-i].base*.6;}
    crit[i]=_rnd()<me.cr;d[i]=me.base*m*(crit[i]?1.5:1)*(.9+_rnd()*.2);}
  for(let i=0;i<2;i++){const me=f[i],en=f[1-i],x=act[i],y=act[1-i],landed=d[i]>0&&y!=='g';
    en.hp-=d[i]+ctr[i];
    if(x==='a'){me.en=Math.min(100,me.en+20);me.combo=landed?me.combo+1:0;}
    else if(x==='h'){me.en-=40;me.combo++;}
    else if(x==='c')me.combo=0;else if(x==='u'){me.en=0;me.combo=0;}
    else if(x==='g')me.en=Math.min(100,me.en+12);else me.combo=0;
    if((x==='h'||x==='c'||x==='u')&&y!=='g')en.combo=0;}
  D.n++;
  if(f[0].hp<=0||f[1].hp<=0||D.n>=DUEL_ROUNDS){D.over=1;D.win=f[0].hp>=f[1].hp?0:1;}
  return {a:act,d:[d[0],d[1]],crit:crit,ctr:ctr};
}
// What the server plays for a fighter who is not there. It reads the same state a player sees.
function duelAI(D,i){
  const me=D.f[i],op=D.f[1-i],r=_rnd();
  if(me.hp<.38&&me.pots>0&&r<.65)return 'p';
  if(me.en>=100&&r<.8)return 'u';
  if(me.combo>=3&&r<.75)return 'c';
  if((op.combo>=3||op.en>=100)&&r<.5)return 'g';
  if(me.en>=40&&r<.38)return 'h';
  return r<.78?'a':'g';
}
// Rating, coins and the rest for the account that fought as side `side`.
function duelSettle(A,now,won,oppRt){
  let gain=0;
  if(won){gain=clamp(Math.round(24-(A.rating-(oppRt||A.rating))/25),8,40);A.rating+=gain;A.coins+=8;passAdd(A,15);A.daily.wins++;ensureWeek(A).wins++;A.wins=(A.wins||0)+1;evAdd(A,now,'w',1);}
  else{A.rating=Math.max(0,A.rating-12);A.coins+=2;}
  return gain;
}

/* ---------- economy tables ---------- */
const BOSSN=40;
const GUILD_FEE=20000; // gold to found a guild
const SECRET_Q=['שם חיית המחמד הראשונה שלך','שם בית הספר היסודי שלך','העיר שבה נולדה אמא שלך','הכינוי שלך בילדות'];
// Weekly guild siege: Saturday 21:00 to 21:30, Israel time. `key` names the last siege that has ended.
const _sgFmt=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Jerusalem',weekday:'short',hour:'numeric',minute:'numeric',hourCycle:'h23'});
function siegeInfo(now){
  const o={};for(const x of _sgFmt.formatToParts(new Date(now)))o[x.type]=x.value;
  const cur=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(o.weekday)*1440+(+o.hour%24)*60+(+o.minute),S0=6*1440+21*60,W=10080;
  const on=cur>=S0&&cur<S0+30,since=((cur-(S0+30))%W+W)%W;
  return {on:on,left:on?S0+30-cur:0,next:on?0:((S0-cur)%W+W)%W,key:'s'+Math.floor((now-since*60000)/3600000)};
}
const PARTY_XP=.05; // extra XP for each active party member on the same map beyond the second player, party of up to 5
const partyXp=n=>PARTY_XP*Math.max(0,Math.min(4,n|0)-1); // extra XP per active party member in the same map, up to 3
const GOLD_SHOP=[{k:'gem',t:'אבן נשמה',d:'חומר לשדרוג ציוד',cost:5000},{k:'box',t:'תיבת אוצר',d:'פריט מהמפה הגבוהה שפתחת, אבנים או זהב',cost:40000},{k:'ticket',t:'כרטיס זירה',d:'קרב נוסף',cost:10000},{k:'scroll',t:'מגילת ניסיון',d:'50% יותר ניסיון למשך 30 דקות',cost:25000}];
const RESET_SHOP=[{k:'charm',t:'3 קמעות הגנה',d:'שדרוג שנכשל לא מוריד דרגה',cost:4},{k:'bless',t:'ברכת נצח',d:'5% יותר ניסיון לתמיד לכל הדמויות, עד 10 פעמים',cost:8},{k:'pts',t:'50 נקודות סטט',d:'לדמות הנוכחית, נשארות לתמיד',cost:10},{k:'jewel',t:'אבן שלמות',d:'מוסיפה אופציה חסרה לפריט אקסלנט',cost:6},{k:'abox',t:'תיבה עתיקה',d:'פריט אגדי או עתיק מהמפה הגבוהה שפתחת',cost:12},{k:'feather',t:'נוצת נצח',d:'מפתחת כנפיים +15 לדרגה הבאה',cost:12},{k:'areset',t:'3 ריסטים אוטומטיים',d:'כשהדמות מגיעה לרמה 400 בזמן שאתה לא מחובר, היא עושה ריסט לבד וממשיכה להתאמן. ריסט כזה נותן חצי מהאותות',cost:15}];
// Paid credits: the packs on sale (price in shekels) and what credits buy. Credits are added only by the server, after a payment is confirmed.
const PACKS=[{k:'p1',credits:100,ils:10,note:''},{k:'p2',credits:550,ils:50,note:'10% תוספת'},{k:'p3',credits:1200,ils:100,note:'20% תוספת'},{k:'p4',credits:2600,ils:200,note:'30% תוספת'}];
const PREM_SHOP=[{k:'vip7',t:'מעמד נצח לשבוע',d:'15% יותר ניסיון ו-15% יותר שלל, 7 ימים',cost:300},{k:'scroll3',t:'3 מגילות ניסיון',d:'שעה וחצי של 50% יותר ניסיון',cost:60},
 {k:'sbox',t:'תיבת עונה',d:'נדיר 55%, אגדי 30%, חלק סט עתיק 15%. מתוכם 8% אקסלנט',cost:80},{k:'abox',t:'תיבה עתיקה',d:'אגדי 75%, עתיק 25%. מתוכם 20% אקסלנט',cost:150},
 {k:'jewel',t:'אבן שלמות',d:'מוסיפה אופציה חסרה לפריט אקסלנט',cost:120},{k:'charm',t:'3 קמעות הגנה',d:'שדרוג שנכשל לא מוריד דרגה',cost:50}];
const SEASON_SHOP=[{k:'feather',t:'נוצת נצח',d:'מפתחת כנפיים +15 לדרגה הבאה',cost:40},{k:'sbox',t:'תיבת עונה',d:'15% לחלק סט עתיק, אחרת נדיר או אגדי',cost:60},{k:'jewel',t:'אבן שלמות',d:'מוסיפה אופציה חסרה לפריט אקסלנט',cost:45},{k:'box',t:'תיבת אוצר',d:'',cost:30},{k:'gem5',t:'5 אבני נשמה',d:'',cost:20},{k:'ticket',t:'כרטיס זירה',d:'',cost:10}];
const totalResets=A=>A.chars.reduce((n,c)=>n+c.resets,0);
const slotsOpen=A=>1+((A.maxLvl||1)>=50?1:0)+(totalResets(A)>=1?1:0);
const anyEq=(A,f)=>A.chars.some(c=>SLOTS.some(k=>c.eq[k]&&f(c.eq[k])));
const QUESTS=[
 {t:'צא מהכפר דרך השער וחסל 20 פטריות טחב',p:(A,S)=>[A.zk[0]||0,20],rw:{gold:500},rt:'500 זהב'},
 {t:'לבש נשק ועוד חלק ציוד',p:(A,S)=>[(S.eq.w?1:0)+(DROPS.some(k=>k!=='w'&&S.eq[k])?1:0),2],rw:{gems:2},rt:'2 אבני נשמה'},
 {t:'הפעל כישורים 5 פעמים בעצמך',p:(A,S)=>[A.casts||0,5],rw:{boxes:1},rt:'תיבת אוצר'},
 {t:'הבס את הבוס של יער הלחישות',p:(A,S)=>[A.open>=1?1:0,1],rw:{gems:5},rt:'5 אבני נשמה'},
 {t:'שדרג פריט לדרגה 3',p:(A,S)=>[anyEq(A,it=>it.p>=3)?1:0,1],rw:{gold:3000},rt:'3,000 זהב'},
 {t:'הגע לרמה 70',p:(A,S)=>[A.maxLvl||1,70],rw:{boxes:1},rt:'תיבת אוצר'},
 {t:'הבס את הבוס של ביצת הערפל',p:(A,S)=>[A.open>=7?1:0,1],rw:{wing:[1,1]},rt:'כנפי עלה קסומות'},
 {t:'נצח קרב בזירה',p:(A,S)=>[A.wins||0,1],rw:{coins:20},rt:'20 מטבעות עונה'},
 {t:'הגע לרמה 200',p:(A,S)=>[A.maxLvl||1,200],rw:{gems:10},rt:'10 אבני נשמה'},
 {t:'הגע לרמה 400 ובצע ריסט ראשון',p:(A,S)=>[totalResets(A),1],rw:{cred:10},rt:'10 אותות ריסט'},
 {t:'צור דמות שנייה',p:(A,S)=>[A.chars.length,2],rw:{boxes:2},rt:'2 תיבות אוצר'},
 {t:'הבס את הבוס של כס הנצח, המפה האחרונה',p:(A,S)=>[A.boss7?1:0,1],rw:{cred:20},rt:'20 אותות ריסט'}
];
function give(A,S,r){
  if(r.sboxes)A.sboxes+=r.sboxes;if(r.gold)A.gold+=r.gold;if(r.cred)A.cred+=r.cred;if(r.coins)A.coins+=r.coins;if(r.gems)A.gems+=r.gems;if(r.boxes)A.boxes+=r.boxes;if(r.feathers)A.feathers=(A.feathers||0)+r.feathers;
  if(r.wing){const it=makeItem(S,'g',r.wing[0],r.wing[1],-1,r.wing[2]?{season:true}:null);const cur=S.eq.g;
    if(canWear(S,it)&&(!cur||itemScore(it)>itemScore(cur))){S.eq.g=it;if(cur&&A.inv.length<BAG)A.inv.push(cur);}else if(A.inv.length<BAG)A.inv.push(it);else if(canWear(S,it))S.eq.g=it;}
}

/* ---------- timed events (server clock, Asia/Jerusalem) ---------- */
// Bonuses and objectives count only while playing; AFK progress never gets them.
const EVENTS=[
 {id:'crimson',n:'מצודת הארגמן',d:'נחיל אדיר של מפלצות. הכניסה עם מפתח, רק ב-3 הדקות הראשונות. חסל 400 לפני שהמצודה נסגרת. שבע דרגות לפי רמה',when:'כל שעה עגולה',every:60,at:0,dur:12,obj:['k',400],tiered:1,rw:{lv:4,gems:3,coins:5},rt:'לפי הדרגה'},
 {id:'square',n:'כיכר התוהו',d:'ניסיון כפול לכולם. חסל 150 מפלצות לפרס',when:'כל שעתיים, בחצי',every:120,at:30,dur:15,mod:{xp:2},obj:['k',150],rw:{lv:6,boxes:1},rt:'6 רמות ותיבת אוצר'},
 {id:'invasion',n:'פלישת הזהב',d:'זהב כפול מכל מפלצת. חסל 60 לפרס',when:'כל שעה, ב-20',every:60,at:20,dur:8,mod:{gold:2},obj:['k',60],rw:{gems:2,coins:4},rt:'2 אבני נשמה ו-4 מטבעות עונה'},
 {id:'world',n:'בוס העולם',d:'בוס אחד לכל השרת. כל חיסול שלך, בכל מפה, פוגע בו, לפי הכוח שלך. הפרס לפי החלק שלך בנזק',when:'כל שלוש שעות, ב-45',every:180,at:45,dur:12,world:1,rt:'נוצות נצח, תיבות עונה ומטבעות'},
 {id:'last',n:'המעגל האחרון',d:'קרב הישרדות חי של עד שמונה לוחמים בשדה עגול ורחב. משתתף רק מי שמחובר ומשתגר לזירה בשתי הדקות הראשונות. כולם מתחילים שווים, הציוד מפוזר על הרצפה, המעגל נסגר, והאחרון שנשאר עומד זוכה',when:'כל שעתיים, ב-10',every:120,at:10,dur:6,br:1,rt:'תיבה עתיקה, תכשיט, נוצת נצח ו-40 מטבעות עונה'},
 {id:'rift',n:'קרע המעמקים',d:'סיכוי השלל גדל בחצי. חסל 70 לפרס',when:'כל שעה, ב-33',every:60,at:33,dur:8,mod:{drop:1.5},obj:['k',70],rw:{boxes:1},rt:'תיבת אוצר'},
 {id:'storm',n:'טירת הסערה',d:'הבס בוס מפה בזמן האירוע',when:'כל שעה, רבע לפני',every:60,at:45,dur:10,obj:['b',1],rw:{sboxes:1,gems:2},rt:'תיבת עונה ו-2 אבני נשמה'},
 {id:'quiz',n:'חידון המעגל',d:'שאלה אחת על המשחק, ניסיון אחד',when:'כל שלוש שעות, ורבע',every:180,at:15,dur:6,obj:['q',1],rw:{gems:4,coins:6},rt:'4 אבני נשמה ו-6 מטבעות עונה'},
 {id:'bounty',n:'שעת השפע',d:'סיכוי השלל כפול',when:'12:00, 18:00, 22:00',daily:[720,1080,1320],dur:30,mod:{drop:2}},
 {id:'golden',n:'שעת הזהב',d:'50% יותר ניסיון',when:'כל יום ב-20:00',daily:[1200],dur:60,mod:{xp:1.5}},
 {id:'royale',n:'קרב אחרון',d:'קרבות זירה בלי כרטיסים. נצח 3 קרבות לפרס',when:'כל יום ב-21:30',daily:[1290],dur:15,obj:['w',3],rw:{sboxes:1,coins:20},rt:'תיבת עונה ו-20 מטבעות עונה'}
];
const QUIZ=[
 {q:'באיזו רמה אפשר לבצע ריסט?',o:['300','350','400','450'],c:2},
 {q:'כמה חלקים יש בסט עתיק מלא?',o:['4','5','6','7'],c:2},
 {q:'כמה ניסיון מוסיף כל חבר פארטי פעיל באותה מפה?',o:['5%','8%','10%','15%'],c:1},
 {q:'אחרי כמה חיסולים מופיע בוס המפה?',o:['20','30','40','60'],c:2},
 {q:'מה דרגת השדרוג המרבית לפריט?',o:['9','11','13','15'],c:3},
 {q:'כמה אחוזים מהמחיר מקבל המוכר בשוק השחקנים?',o:['90%','95%','98%','100%'],c:1},
 {q:'כמה שחקנים יכולים להיות בפארטי?',o:['3','4','5','6'],c:1},
 {q:'מאיזו דרגת שדרוג כישלון מוריד דרגה?',o:['5','7','9','11'],c:1},
 {q:'באיזה קצב מתקדמת דמות שלא משחקים בה?',o:['50%','60%','70%','100%'],c:2},
 {q:'כמה ריסטים פותחים את מפת קרחון האלים?',o:['1','2','4','7'],c:1}
];
const _evFmt=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Jerusalem',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
function localMin(t){const o={};for(const x of _evFmt.formatToParts(new Date(t)))o[x.type]=+x.value;return {m:(o.hour%24)*60+o.minute,s:o.second};}
function evStart(e,m){ // start minute of the window that contains local minute m, or null
  if(e.daily){for(const s of e.daily)if(m>=s&&m<s+e.dur)return s;return null;}
  const s=m-((((m-e.at)%e.every)+e.every)%e.every);return m-s<e.dur?s:null;
}
// Windows that are live now; with `grace`, also ones that ended up to that many minutes ago (for collecting a reward).
function evWindows(now,grace){
  const lm=localMin(now),out=[];
  for(const e of EVENTS){
    let s=evStart(e,lm.m),live=s!==null;
    for(let g=1;s===null&&g<=(grace||0);g++)s=evStart(e,lm.m-g);
    if(s===null)continue;
    const start=now-((lm.m-s)*60+lm.s)*1000;
    out.push({e:e,key:e.id+':'+Math.round(start/60000),live:live,end:start+e.dur*60000});
  }
  return out;
}
// A bonus a game master switched on for everyone, for a limited time. It lives in the server's memory; the server
// tells the browsers about it so they can show it. Limits are enforced here, whatever was asked for.
let _boost=null;
function setBoost(b){_boost=b&&b.until>0?{xp:clamp(Number(b.xp)||1,1,3),drop:clamp(Number(b.drop)||1,1,3),until:Number(b.until)}:null;return _boost;}
const boostNow=now=>_boost&&_boost.until>now?_boost:null;
function evMods(now){const m={xp:1,drop:1,gold:1};for(const w of evWindows(now,0))if(w.e.mod){m.xp*=w.e.mod.xp||1;m.drop*=w.e.mod.drop||1;m.gold*=w.e.mod.gold||1;}const b=boostNow(now);if(b){m.xp*=b.xp;m.drop*=b.drop;}return m;}
function evNext(e,now){const lm=localMin(now);for(let i=1;i<=1440;i++){const m=(lm.m+i)%1440;if(evStart(e,m)===m)return i*60-lm.s;}return 86400;}
function quizFor(key){let h=0;for(let i=0;i<key.length;i++)h=(h*31+key.charCodeAt(i))>>>0;return QUIZ[h%QUIZ.length];}
function evRec(A,key){
  A.ev=A.ev||{};if(!A.ev[key]){const lim=Math.round(_now()/60000)-240;for(const k in A.ev)if(+k.split(':')[1]<lim)delete A.ev[k];A.ev[key]={k:0,b:0,w:0,q:0};}
  return A.ev[key];
}
// Level brackets, as in Blood Castle: which tier of a tiered event a character enters. Higher tiers pay more,
// so the race is to reach the next bracket before the gate opens. Below the first bracket there is no entry.
const TIER_MIN=[15,81,131,181,231,281,331],TIER_LV=[3,4,5,6,7,8,10];
const evTier=l=>{let t=0;for(const m of TIER_MIN)if(l>=m)t++;return t;};
const tierRange=t=>[TIER_MIN[t-1],t<TIER_MIN.length?TIER_MIN[t]-1:CAP];
const tierReward=t=>({lv:TIER_LV[t-1],gems:2+t,coins:4+t});
// The tier is fixed by the level at the moment of entry, not at collection.
// A tiered event is fought inside its own keep: kills count only for a character that went in (see evEnter).
// Inside, the monsters come as a horde: each one is weak (KEEP_HP of its normal health) and pays the normal
// experience, so levels come from the number killed. The gate takes entries only for the first KEEP_GATE minutes;
// after that, and after a reset during the opening, the next keep is the earliest way in.
const KEY_SHARDS=5,KEY_GOLD=2000,KEEP_GATE=3,KEEP_HP=.3;
const keepOpen=(w,now)=>now<w.end-(w.e.dur-KEEP_GATE)*60000;
const evZoneFor=l=>{let z=0;for(let i=0;i<BASEZ;i++)if(ZONES[i].min<=l)z=i;return z;};
function evAdd(A,now,f,n,inEv){if(n>0)for(const w of evWindows(now,0))if(w.e.obj&&w.e.obj[0]===f){
  if(w.e.tiered){if(!inEv)continue;const rec=evRec(A,w.key);if(rec.in)rec[f]+=n;}else evRec(A,w.key)[f]+=n;}}

/* ---------- state helpers ---------- */
const numOr=(v,d,lo,hi)=>{v=Number(v);return isFinite(v)?clamp(v,lo,hi):d;};
const int=(v,lo,hi)=>{v=Math.floor(Number(v));return isFinite(v)?clamp(v,lo,hi):lo;};
const gearOr=g=>Array.isArray(g)?[numOr(g[0],1,1,50)|0,numOr(g[1],0,0,4)|0,numOr(g[2],0,0,15)|0,g[3]?1:0,numOr(g[4],0,0,2)|0]:null;
function cleanPlayer(id,o){
  o=o||{};
  return {id:String(id),n:String(o.n||'אלמוני').slice(0,14),c:CLS[o.c]?o.c:'blade',l:numOr(o.l,1,1,CAP)|0,r:numOr(o.r,0,0,99999)|0,p:numOr(o.p,1,1,1e9)|0,
    d:numOr(o.d,10,1,1e8),a:numOr(o.a,1,.3,3.2),h:numOr(o.h,100,1,1e9),f:numOr(o.f,0,0,1e7),cr:numOr(o.cr,.05,0,.6),cd:numOr(o.cd,2,1,10),
    w:gearOr(o.w),ar:gearOr(o.ar),g:gearOr(o.g),rt:numOr(o.rt,1000,0,99999)|0,sp:Array.isArray(o.sp)?[numOr(o.sp[0],0,0,15)|0,numOr(o.sp[1],0,0,15)|0]:[0,0],pf:numOr(o.pf,0,0,10)|0};
}
function cleanItem(o){
  if(!o||SLOTS.indexOf(o.s)<0)return null;
  const it={id:0,s:o.s,t:numOr(o.t,1,1,o.s==='g'?WING_MAX:TIERN.length)|0,r:numOr(o.r,0,0,4)|0,p:numOr(o.p,0,0,15)|0,z:numOr(o.z,-1,-1,ZONES.length-1)|0,af:[]};
  if(o.season&&o.s==='g')it.season=true;if(o.ex)it.ex=1;if(o.v&&it.r===4&&DROPS.indexOf(it.s)>=0)it.v=1;if(o.pf&&it.r===4&&it.ex)it.pf=1;
  if(Array.isArray(o.af))for(const f of o.af.slice(0,it.ex?POOL[it.s].length:4))if(Array.isArray(f)&&AFF[f[0]]&&POOL[it.s].indexOf(f[0])>=0)it.af.push([f[0],Math.round(numOr(f[1],0,0,AFF[f[0]][2]*1.6)*10)/10]);
  return it;
}
// Turn a stored JSON object back into a live account (shared fields are accessors on each character).
function adopt(o){
  if(!o||o.v!==2||!Array.isArray(o.chars))return null;
  o.bossM=o.bossM||{};o.zk=o.zk||{};o.sboxes=o.sboxes||0;o.inv=o.inv||[];
  if(o.zv===1&&o.pass){o.pass.xp=(o.pass.xp|0)*2;o.zv=2;} // a pass level used to cost half as much: keep the level reached
  if(!o.zv){ // saved before the map list grew: old map i is now map 3i on the main road, old reset map i is 24+2(i-8)
    const mz=z=>z<0||z==null?z:z<8?z*3:z<12?24+(z-8)*2:z,mk=m=>{const n={};for(const k in m)n[mz(+k)]=m[k];return n;};
    if(o.chars.length||o.inv.length||o.open){o.open=Math.min(23,(o.open|0)*3);o.zk=mk(o.zk);o.bossM=mk(o.bossM);o.boss7=0;o.bossAt=null;
      for(const it of o.inv)if(it&&it.z>=0)it.z=mz(it.z);
      for(const ch of o.chars){ch.zone=mz(ch.zone|0);ch.evIn=null;for(const k in ch.eq||{})if(ch.eq[k]&&ch.eq[k].z>=0)ch.eq[k].z=mz(ch.eq[k].z);}}
    if(o.pass)o.pass.xp=(o.pass.xp|0)*2;o.zv=2;}
  o.chars.forEach(c=>{bind(o,c);c.floor=c.floor|0;for(const k of SLOTS)if(!(k in c.eq))c.eq[k]=null;});
  o.cur=o.chars.length?clamp(o.cur|0,0,o.chars.length-1):0;return o;
}
function findIt(A,S,id){for(const k of SLOTS)if(S.eq[k]&&S.eq[k].id===id)return {it:S.eq[k],eq:k};const i=A.inv.findIndex(x=>x.id===id);return i>=0?{it:A.inv[i],i:i}:null;}
// Highest kill rate a legitimate client can reach in a zone, skills and buffs included.
function maxKps(S,zi,au,keep){const c=calc(S,au),z=zs(zi,keep?0:afkFloor(S,zi));return keep?Math.min(6,1/Math.max(.15,z.hp*KEEP_HP/(c.dps*2.8)+.12)):Math.min(2.1,1/Math.max(.35,z.hp/(c.dps*2.8)+.3));}
const BOTN=['שומר השער','נודד האפר','בת הסער','צל ראשון','להב שקט','עין הנץ'];
function buildOpps(A,S,players,selfId){
  const me=fighter(S),out=[];
  const real=(players||[]).filter(p=>p.id!==selfId).sort((a,b)=>Math.abs(a.p-me.p)-Math.abs(b.p-me.p)).slice(0,4);
  for(const p of real){const q=Object.assign({},p);delete q.id;out.push(q);}
  const fs=[.75,.95,1.1,1.3];let i=0;
  while(out.length<4){const f=fs[i%4]*(0.95+_rnd()*.1),cl=Object.keys(CLS)[Math.floor(_rnd()*3)];
    out.push({bot:true,n:BOTN[(i+A.kills)%BOTN.length],c:cl,l:S.lvl,r:S.resets,p:Math.round(me.p*f),d:me.d*Math.sqrt(f),a:me.a,h:me.h*Math.sqrt(f),f:me.f,cr:me.cr,cd:me.cd,
      w:me.w||[1,0,0,0],ar:me.ar||[1,0,0,0],g:me.g,rt:Math.round(A.rating+(f-1)*300)});i++;}
  return out;
}

/* ---------- the single entry point for every state change ---------- */
// apply() is the only code that may change an account. The server runs it on the stored
// state; the client runs it only in local (unprotected) mode. Arguments are untrusted.
function apply(A,kind,args,ctx){
  args=args||{};ctx=ctx||{};const now=_now(),r={ok:true};loginDay(A);ensureWeek(A);
  const fail=m=>({ok:false,msg:m});
  if(kind==='create'){
    const nm=String(args.name||'').replace(/[<>&"'\u2605\u0000-\u001f]/g,'').trim().slice(0,14)||'גיבור',cls=CLS[args.cls]?args.cls:'blade';
    if(A.chars.length>=3||(A.chars.length&&A.chars.length>=slotsOpen(A)))return fail('אין מקום לדמות נוספת');
    if(A.chars.length)A.chars[A.cur].last=now;
    A.chars.push(bind(A,newChar(nm,cls)));A.cur=A.chars.length-1;A.allow=0;A.tk=now;A.bossAt=null;A.opps=null;return r;
  }
  if(!A.chars.length)return fail('אין דמות');
  let S=A.chars[A.cur];ensureDay(S);
  // Time since the previous call decides how many kills may be claimed (token bucket) or, after a long gap, AFK progress.
  const el=Math.max(0,(now-(A.tk||now))/1000);A.tk=now;
  if(el>90){S.last=now-el*1000;const rep=offline(S,el);A.allow=0;A.bossAt=null;if(rep.kills>0)r.afk=[{name:S.name,zone:S.zone,rep:rep}];}
  else if(S.evIn)A.allow=Math.min(100,(A.allow||0)+el*maxKps(S,clamp(S.evZ|0,0,BASEZ-1),cleanAuras(ctx.auras),1));
  else if(S.zone>=0)A.allow=Math.min(40,(A.allow||0)+el*maxKps(S,afkZone(S),cleanAuras(ctx.auras)));
  if(el>90)S.evIn=null;
  S.last=now;
  switch(kind){
    case 'sync':{
      A.chars.forEach((ch,i)=>{if(i===A.cur)return;const gap=(now-(ch.last||now))/1000;if(gap>5){const rep=offline(ch,gap);if(rep.kills>0)(r.afk=r.afk||[]).push({name:ch.name,zone:ch.zone,rep:rep});}ch.last=now;});
      break;}
    case 'switch':{
      const i=int(args.i,0,2);if(i===A.cur||!A.chars[i])return fail('דמות לא קיימת');
      A.cur=i;S=A.chars[i];const gap=(now-(S.last||now))/1000;
      if(gap>5){const rep=offline(S,gap);if(rep.kills>0)r.afk=[{name:S.name,zone:S.zone,rep:rep}];}
      S.last=now;A.allow=0;A.bossAt=null;A.opps=null;break;}
    // Friends and blocked players are kept by the short key the server hands out for a player, with the name as it was then.
    case 'friend':case 'block':{const k=String(args.k||''),n=String(args.n||'').replace(/[<>&"'\u2605\u0000-\u001f]/g,'').trim().slice(0,14),key=kind==='friend'?'friends':'blocked',max=kind==='friend'?40:60;
      if(!/^[0-9a-f]{10}$/.test(k)||!n)return fail('שחקן לא מוכר');const list=(A[key]||[]).filter(x=>x&&x.k!==k);
      if(args.on){if(list.length>=max)return fail('הרשימה מלאה');list.push({k:k,n:n});if(kind==='block')A.friends=(A.friends||[]).filter(x=>x.k!==k);}
      A[key]=list;r.list=list;break;}
    case 'report':{const k=String(args.k||''),n=String(args.n||'').replace(/[<>&"'\u0000-\u001f]/g,'').trim().slice(0,14),why=String(args.why||'').replace(/[<>\u0000-\u001f]/g,'').trim().slice(0,100);
      if(!/^[0-9a-f]{10}$/.test(k)||!n||why.length<3)return fail('כתוב בקצרה מה קרה');if(now-(A.repAt||0)<60000)return fail('אפשר לדווח פעם בדקה');A.repAt=now;r.report={k:k,n:n,why:why};break;}
    case 'gcreate':{if(A.gold<GUILD_FEE)return fail('פתיחת גילדה עולה '+GUILD_FEE+' זהב');A.gold-=GUILD_FEE;break;}
    case 'travel':{
      S.evIn=null;const z=int(args.z,-1,ZONES.length-1),f=z<0?0:int(args.f,0,FLOORS-1);if(!canEnter(S,z))return fail('המפה נעולה');
      if(!canFloor(S,z,f))return fail('צריך רמה '+floorMin(z,f)+' לקומה הזו');
      if(z!==S.zone||f!==(S.floor|0)){S.zone=z;S.floor=f;A.bossAt=null;A.allow=Math.min(A.allow||0,3);}break;}
    case 'tick':{
      if(S.evIn&&!evWindows(now,0).some(w=>w.key===S.evIn)){S.evIn=null;r.evOver=true;} // the keep has closed
      const inEv=!!(args.ev&&S.evIn);if(args.ev&&!inEv){r.evOver=true;r.rep={};break;}
      const z=inEv?clamp(S.evZ|0,0,BASEZ-1):int(args.z,-1,ZONES.length-1);
      if(z<0){if(S.zone!==-1){S.zone=-1;S.floor=0;A.bossAt=null;}break;}
      const f=inEv?0:int(args.f,0,FLOORS-1);
      if(!inEv){
        if(!canEnter(S,z))return fail('המפה נעולה');
        if(!canFloor(S,z,f))return fail('צריך רמה '+floorMin(z,f)+' לקומה הזו');
        if(z!==S.zone||f!==(S.floor|0)){S.zone=z;S.floor=f;A.bossAt=null;A.allow=Math.min(A.allow||0,3);}}
      const zd=zs(z,f),rep={},em=evMods(now),au=cleanAuras(ctx.auras),c=calc(S,au),pn=int(ctx.partyN,0,4),gl=int(ctx.guildLvl,0,10),cs=ctx.castle?1:0,pb=(1+partyXp(pn))*em.xp*(1+gl*.01+cs*.1);c.dropM*=em.drop*zd.drop*(au.includes('hunter')?1.15:1);r.auras=au;c.goldM*=zd.gold*(1+cs*.1)*em.gold;r.partyN=pn;r.guildLvl=gl;r.castle=cs;
      const k=Math.min(int(args.kills,0,1000),Math.floor(A.allow||0));r.claimed=int(args.kills,0,1000);r.kills=k;
      A.casts=(A.casts||0)+int(args.casts,0,30);
      {const sh=Math.max(0,Math.min(Number(ctx.shareXp)||0,5e7));if(sh>0){r.shared=Math.round(sh);rep.levels=(rep.levels||0)+addXp(S,sh);}} // from party members' kills here; the server supplies it
      r.base=k*zd.xp;
      if(k>0){const l0=S.lvl;A.allow-=k;rep.levels=(rep.levels||0)+addXp(S,k*zd.xp*c.xpM*pb);rollLoot(S,z,k,c,rep);evAdd(A,now,'k',k,inEv);ensureWeek(A);
        {const ww=evWindows(now,0).find(w=>w.e.world);if(ww)r.world={key:ww.key,dmg:Math.round(k*Math.sqrt(Math.max(1,c.power)))};}
        if(!inEv){sideAdd(A,'hunt',z,k,now,r);if(rep.notable)sideAdd(A,'rare',z,rep.notable.length,now,r);
          if(!A.sq&&S.lvl>=20&&now-(A.sqAt||0)>25*60000&&_rnd()<k*.0009){A.sqAt=now;r.sqNew=sideOffer(A,z,now);}}
        if(!inEv&&!A.elite&&_rnd()<k*ELITE_RATE){A.elite={z:z,f:f,t:now};r.elite=true;} // a champion steps out of the pack
        if(!A.bossAt&&!inEv){A.bossM[z]=(A.bossM[z]||0)+k;if(A.bossM[z]>=BOSSN){A.bossM[z]=0;A.bossAt={z:z,t:now};}}}
      if(A.elite&&(now-A.elite.t>ELITE_LIFE||A.elite.z!==z||A.elite.f!==f)){A.elite=null;r.eliteGone=true;}
      if(args.elite&&A.elite){ // enough time must have passed to deal its health in damage, as with a boss
        if((now-A.elite.t)/1000*c.dps*2.8>=zd.hp*ELITE_HP*.9){A.elite=null;rep.levels=(rep.levels||0)+addXp(S,zd.xp*15*c.xpM*pb);
          const it=makeItem(S,rslot(),tierOf(z),rollRar([0,0,74,22,4]),z);if(_rnd()<.06)makeExcellent(it);gainItem(S,it,rep);(rep.notable=rep.notable||[]).push(it);
          const g=1+Math.floor(_rnd()*2);A.gems+=g;rep.gems=(rep.gems||0)+g;const sh=1+Math.floor(_rnd()*2);A.shards=(A.shards||0)+sh;rep.shards=(rep.shards||0)+sh;rep.elite=true;A.elites=(A.elites||0)+1;jewelDrop(S,z,rep,[0,0,60,30,10],.1);perfectDrop(S,z,rep,PERFECT_ELITE);}
        else rep.eliteDenied=true;}
      if(args.boss){
        const b=A.bossAt;
        // The boss must have been spawned by the server, and enough time must have passed to deal its HP in damage.
        if(b&&b.z===z&&(now-b.t)/1000*c.dps*2.8>=zd.hp*30*.9){
          if(_rnd()<.08){A.jewels=(A.jewels||0)+1;rep.jewel=1;}
          if(_rnd()<.05){A.feathers=(A.feathers||0)+1;rep.feather=1;}
          A.bossAt=null;rep.levels=(rep.levels||0)+addXp(S,zd.xp*40*c.xpM*pb);rollLoot(S,z,1,c,rep);
          perfectDrop(S,z,rep,PERFECT_BOSS);
          if(args.clean){A.gems+=1;rep.gems=(rep.gems||0)+1;rep.clean=1;A.cleans=(A.cleans||0)+1;} // none of its marked moves landed: only the client can know, so the bonus is small
          const it=makeItem(S,rslot(),tierOf(z),rollRar([0,0,70,25,5]),z);gainItem(S,it,rep);(rep.notable=rep.notable||[]).push(it);
          const g=2+Math.floor(_rnd()*3);A.gems+=g;rep.gems=(rep.gems||0)+g;if(_rnd()<.3){A.boxes++;rep.boxes=(rep.boxes||0)+1;}
          if(z===BASEZ-1)A.boss7=1;if(A.open===z&&z<BASEZ-1){A.open=z+1;rep.opened=z+1;}rep.boss=true;evAdd(A,now,'b',1);bump(A,'boss',1);sideAdd(A,'boss',z,1,now,r);
        }else rep.bossDenied=true;
      }
      r.rep=rep;break;}
    case 'pt':{
      const k=String(args.k);if(['str','agi','vit','ene'].indexOf(k)<0)return fail('סטט לא קיים');
      const n=Math.min(args.n==='all'?S.pts:Math.min(S.pts,int(args.n,0,100000)),STAT_MAX-S.stats[k]);if(n<=0)return fail(S.stats[k]>=STAT_MAX?'הסטט הזה מלא':'אין נקודות לחלק');S.stats[k]+=n;S.pts-=n;break;}
    case 'autoPts':S.autoPts=!S.autoPts;if(S.autoPts)autoAlloc(S);break;
    case 'pick':{const k=String(args.k);if(PICK_KEYS.indexOf(k)<0)return fail('אין קטגוריה כזו');const p=pickOf(A);p[k]=!p[k];A.pick=p;break;}
    case 'respec':{ // all placed points come back; costs reset marks
      const spent=S.stats.str+S.stats.agi+S.stats.vit+S.stats.ene-60;if(spent<=0)return fail('אין נקודות להחזיר');if(A.cred<RESPEC_COST)return fail('צריך '+RESPEC_COST+' אותות ריסט');
      A.cred-=RESPEC_COST;S.stats={str:15,agi:15,vit:15,ene:15};S.pts+=spent;r.pts=spent;if(S.autoPts)autoAlloc(S);break;}
    case 'autoEq':A.autoEq=!A.autoEq;break;
    case 'autoSell':A.autoSell=((A.autoSell|0)+1)%3;break;
    case 'setAuto':S.auto=!!args.on;break;
    case 'reset':{if(!canReset(S))return fail('צריך רמה 400');r.gain=resetGain(S);doReset(S);S.evIn=null;for(const w of evWindows(now,0))if(w.e.tiered)evRec(A,w.key).no=1;A.bossAt=null;A.allow=0;r.resets=S.resets;break;}
    case 'equip':{const f=findIt(A,S,int(args.id,0,1e12));if(!f||f.i==null)return fail('הפריט לא בתיק');if(!canWear(S,f.it))return fail('חסר לך: '+lacks(S,f.it));A.inv.splice(f.i,1);const old=S.eq[f.it.s];S.eq[f.it.s]=f.it;if(old)A.inv.push(old);break;}
    case 'unequip':{const f=findIt(A,S,int(args.id,0,1e12));if(!f||!f.eq)return fail('הפריט לא לבוש');if(A.inv.length>=BAG)return fail('התיק מלא');S.eq[f.eq]=null;A.inv.push(f.it);break;}
    case 'sell':{const f=findIt(A,S,int(args.id,0,1e12));if(!f||f.i==null)return fail('הפריט לא בתיק');A.inv.splice(f.i,1);A.gold+=sellVal(f.it);break;}
    case 'craftKey':{if((A.shards||0)<KEY_SHARDS)return fail('צריך '+KEY_SHARDS+' שברי ארגמן. יש לך '+(A.shards||0));if(A.gold<KEY_GOLD)return fail('צריך '+KEY_GOLD+' זהב');
      A.shards-=KEY_SHARDS;A.gold-=KEY_GOLD;A.keys=(A.keys||0)+1;r.keys=A.keys;break;}
    case 'evEnter':{const w=evWindows(now,0).find(x=>x.e.tiered&&x.e.id===String(args.id));if(!w)return fail('השער סגור. המצודה נפתחת בכל שעה עגולה');
      if(!keepOpen(w,now))return fail('הכניסה נסגרה. נכנסים רק ב-'+KEEP_GATE+' הדקות הראשונות. חכה למצודה הבאה');
      const t=evTier(S.lvl);if(!t)return fail('הכניסה מרמה '+TIER_MIN[0]);const rec=evRec(A,w.key);if(rec.no)return fail('אחרי ריסט נכנסים רק למצודה הבאה');
      if(!rec.in){if(!(A.keys>0))return fail('אין לך מפתח מצודה. יוצרים אותו בלשונית אירועים');A.keys--;rec.in=1;rec.tr=t;} // going back in during the same opening is free
      S.evIn=w.key;S.evZ=evZoneFor(S.lvl);S.zone=-1;S.floor=0;A.bossAt=null;A.allow=Math.min(A.allow||0,3);r.z=S.evZ;r.tier=rec.tr;r.end=w.end;break;}
    case 'evLeave':{S.evIn=null;break;}
    case 'bestEq':{ // wear the strongest piece in the bag for every slot; what was worn goes back to the bag
      const p0=calc(S).power;let n=0;
      for(const sl of SLOTS){let bi=-1,bs=S.eq[sl]?itemScore(S.eq[sl]):0;A.inv.forEach((it,i)=>{if(it.s===sl&&canWear(S,it)){const sc=itemScore(it);if(sc>bs){bs=sc;bi=i;}}});
        if(bi>=0){const it=A.inv[bi],old=S.eq[sl];if(old)A.inv[bi]=old;else A.inv.splice(bi,1);S.eq[sl]=it;n++;}}
      r.n=n;r.gain=calc(S).power-p0;break;}
    case 'sellRar':{const q=int(args.r,0,4);let g=0,n=0;A.inv=A.inv.filter(it=>{if(it.r===q&&it.s!=='g'&&!it.ex){g+=sellVal(it);n++;return false;}return true;});if(!n)return fail('אין פריטים כאלה בתיק');A.gold+=g;r.gold=g;r.n=n;break;}
    case 'sellJunk':{let g=0;A.inv=A.inv.filter(it=>{if(it.r<=1&&it.s!=='g'){g+=sellVal(it);return false;}return true;});A.gold+=g;r.gold=g;break;}
    case 'wingEvolve':{const f=findIt(A,S,int(args.id,0,1e12));if(!f||f.it.s!=='g')return fail('הפריט לא נמצא');const it=f.it;
      if(it.t>=WING_MAX)return fail('אלו הכנפיים הגבוהות ביותר');if(it.p<15)return fail('רק כנפיים +15 מתפתחות');
      const n=wingFeathers(it.t);if((A.feathers||0)<n)return fail('צריך '+n+' נוצות נצח. יש לך '+(A.feathers||0));
      A.feathers-=n;r.need=n;if(_rnd()<wingChance(it.t)){it.t++;it.p=0;r.evolved=true;r.t=it.t;}else r.evolved=false;break;} // the wing itself is never lost; the new rank starts at +0 and is upgraded again
    case 'upgrade':{const f=findIt(A,S,int(args.id,0,1e12));if(!f)return fail('הפריט לא נמצא');r.code=upgrade(S,f.it);r.p=f.it.p;r.r=f.it.r;break;}
    case 'openBox':{const sk=args.k==='s';if((sk?A.sboxes:A.boxes)<1)return fail('אין תיבות');if(sk)A.sboxes--;else A.boxes--;r.box=openBox(S,sk?'s':'');break;}
    case 'buy':{
      const shop=String(args.shop),k=String(args.k),list=shop==='gold'?GOLD_SHOP:shop==='reset'?RESET_SHOP:shop==='season'?SEASON_SHOP:shop==='prem'?PREM_SHOP:null,cur=shop==='gold'?'gold':shop==='reset'?'cred':shop==='prem'?'prem':'coins';
      const o=list&&list.find(x=>x.k===k);if(!o)return fail('המוצר לא קיים');if(!((A[cur]||0)>=o.cost))return fail('אין מספיק');
      if(k==='abox'){A[cur]-=o.cost;r.box=openBox(S,'a');}
      else{
        if(k==='bless'&&A.bless>=10)return fail('הגעת למקסימום');if(k==='areset'&&(A.areset|0)+ARESET_PACK>ARESET_MAX)return fail('הגעת למקסימום');
        A[cur]-=o.cost;
        if(k==='areset')A.areset=(A.areset|0)+ARESET_PACK;else if(k==='feather')A.feathers=(A.feathers||0)+1;else if(k==='gem')A.gems++;else if(k==='gem5')A.gems+=5;else if(k==='sbox')A.sboxes++;else if(k==='box')A.boxes++;else if(k==='ticket')A.tickets++;
        else if(k==='scroll')A.boost=Math.max(A.boost,now)+18e5;else if(k==='charm')A.charms+=3;else if(k==='bless')A.bless++;else if(k==='jewel')A.jewels=(A.jewels||0)+1;
        else if(k==='scroll3')A.boost=Math.max(A.boost,now)+3*18e5;else if(k==='vip7')A.vip=Math.max(A.vip||0,now)+7*864e5;
        else if(k==='pts'){A.bonusPts+=50;S.pts+=50;if(S.autoPts)autoAlloc(S);}
        r.bought=o.t;}
      break;}
    case 'claimPass':{if(passLevel(S)<=A.pass.claimed)return fail('אין פרס לאיסוף');A.pass.claimed++;const rw=passReward(A.pass.claimed);give(A,S,rw);r.t=rw.t;break;}
    case 'exAdd':{const f=findIt(A,S,int(args.id,0,1e9));if(!f)return fail('הפריט לא נמצא');const it=f.it;
      if(!it.ex)return fail('אבן שלמות עובדת רק על פריט אקסלנט');if(!(A.jewels>0))return fail('אין לך אבן שלמות');
      if(!addOpt(it))return fail('לפריט כבר יש את כל האופציות');A.jewels--;r.opt=it.af[it.af.length-1];r.full=isFull(it);break;}
    case 'claimLogin':{const lg=A.login;if(!lg||lg.got)return fail('את הפרס של היום כבר אספת');const day=clamp(lg.s|0,1,7),rw=LOGIN_RW[day-1];lg.got=1;
      A.gems+=rw.gems||0;A.boxes+=rw.boxes||0;A.sboxes+=rw.sboxes||0;A.coins+=rw.coins||0;A.charms+=rw.charms||0;if(rw.boost)A.boost=Math.max(A.boost,now)+18e5;r.t=rw.t;r.day=day;break;}
    case 'claimTask':{const t=TASKS.find(x=>x.k===args.k);if(!t||(A.daily[t.f||t.k]||0)<t.n||A.daily.done[t.k])return fail('המשימה לא הושלמה');A.daily.done[t.k]=1;A.pass.xp+=t.xp;r.xp=t.xp;if(t.rw){give(A,S,t.rw);r.rt=t.rt;}break;}
    case 'claimWorld':{const w=ctx.wshare;if(!w)return fail('אין פרס לאסוף');const rw=worldReward(Math.max(0,Math.min(1,+w.share||0)),w.rank|0,!!w.killed);give(A,S,rw);bump(A,'ev',1);r.rt=rewardText(rw);r.rank=w.rank|0;r.share=+w.share||0;break;}
    case 'claimWeek':{const w=ensureWeek(A),t=WEEKLY.find(x=>x.k===args.k);if(!t||(w[t.k]||0)<t.n||w.done[t.k])return fail('המשימה לא הושלמה');w.done[t.k]=1;give(A,S,t.rw);A.pass.xp+=120;r.rt=t.rt;break;}
    case 'sqClaim':{const q=A.sq;if(!q||!q.done)return fail('אין משימת צד שהושלמה');const rw=SIDEQ[q.i].rw(q.m);give(A,S,rw);A.sq=null;A.sqN=(A.sqN||0)+1;r.rw=rw;break;}
    case 'sqDrop':{A.sq=null;break;}
    case 'egg':{const k=String(args.k),e=EGGS[k];if(!e)return fail('אין כאן כלום');A.eggs=A.eggs||{};if(A.eggs[k])return fail('כבר מצאת את זה');
      if(k==='dawn'&&localMin(now).m>=300||k==='dawn'&&localMin(now).m<240)return fail('אין כאן כלום');if(k==='lucky'&&A.kills%10000<7777)return fail('אין כאן כלום');
      A.eggs[k]=1;give(A,S,e.rw);r.t=e.t;r.found=Object.keys(A.eggs).length;break;}
    case 'claimQuest':{const q=QUESTS[A.q|0];if(!q)return fail('אין משימה');const p=q.p(A,S);if(p[0]<p[1])return fail('המשימה לא הושלמה');give(A,S,q.rw);A.q=(A.q|0)+1;r.rt=q.rt;break;}
    case 'opps':A.opps=buildOpps(A,S,ctx.players,ctx.uid);break;
    case 'duel':return fail('אין יותר קרב אוטומטי. הקרב בזירה ידני');
    case 'duelStart':{
      if(A.pd&&A.pd.tower)A.pd=null;
      if(A.pd&&now-A.pd.t>600000){duelSettle(A,now,false,A.pd.o.rt);A.pd=null;} // walked away from a duel: it counts as lost
      if(!A.pd){let o=null;if(args.k!=null){if(!ctx.target)return fail('השחקן הזה כבר לא כאן');o=Object.assign({},ctx.target);delete o.id;}else o=A.opps&&A.opps[int(args.i,0,3)];if(!o)return fail('רענן את רשימת היריבים');
        const free=evWindows(now,0).some(w=>w.e.id==='royale');if(!free&&A.tickets<1)return fail('אין כרטיסים');
        if(!free)A.tickets--;A.opps=null;const me=fighter(S),D=duelNew(me,o);
        // The live duel is fought on the player's device. The server fixes the numbers of both sides here and, at the
        // end, accepts a win only if enough time has passed to have dealt that much damage (see duelEnd).
        A.pd={o:o,D:D,t:now,live:{b:[D.f[0].base,D.f[1].base],cr:[D.f[0].cr,D.f[1].cr],T:[clamp(1/Math.max(.3,me.a),.3,1.2),clamp(1/Math.max(.3,o.a),.3,1.2)],pool:[me.h*5,o.h*5]}};}
      r.pd=A.pd;break;}
    case 'towerStart':{
      const tw=A.tower=A.tower||{best:0};if((A.daily.tw|0)>=TOWER_TRIES)return fail('נגמרו הניסיונות למגדל להיום');
      const f=(tw.best|0)+1,b=towerBoss(f),me=fighter(S),c=calc(S);A.daily.tw=(A.daily.tw|0)+1;
      // the same screen and moves as a duel: how much of the boss one and a half seconds of my attacking removes, and of me his
      const L={b:[clamp(c.dps*1.5/b.hp,.004,.6),clamp(b.atk*1.5*300/(300+c.def)/(c.hp*1.6),.01,.9)],cr:[clamp(c.crit,0,.75),0],T:[clamp(1/Math.max(.3,c.aspd),.3,1.2),1.5],pool:[c.hp*1.6,b.hp]};
      A.pd={tower:f,t:now,live:L,o:{n:'שומר קומה '+f,c:'blade',l:f,r:0,p:b.hp,bossZ:(f*5)%BASEZ}};r.pd=A.pd;r.left=TOWER_TRIES-A.daily.tw;break;}
    // The day's trial: one guardian sized to the character's own strength, so the medal is about how well the fight
    // was played and not about gear. The server times the fight itself; a better medal pays only the difference.
    case 'trialStart':{
      if((A.daily.tr|0)>=TRIAL_TRIES)return fail('נגמרו הניסיונות לאתגר היום');const c=calc(S),m=dayNum()%3,hp=Math.max(50,c.dps*(m===1?30:22));A.daily.tr=(A.daily.tr|0)+1;
      const L={b:[clamp(c.dps*1.5/hp,.004,.6),m===1?.05:.075],cr:[clamp(c.crit,0,.75),0],T:[clamp(1/Math.max(.3,c.aspd),.3,1.2),m===2?1:1.5],pool:[c.hp*1.6,hp]};
      A.pd={tower:1,trial:m+1,t:now,live:L,o:{n:'שומר היום',c:'blade',l:S.lvl,r:0,p:Math.round(hp),bossZ:(dayNum()*7)%BASEZ}};r.pd=A.pd;r.left=TRIAL_TRIES-A.daily.tr;break;}
    case 'trialEnd':{
      const pd=A.pd;if(!pd||!pd.trial)return fail('אין קרב פעיל');const el=(now-pd.t)/1000;let win=!!args.win;
      if(win&&el<1/(pd.live.b[0]*DUEL_LIVE.maxRate)*.8){win=false;r.denied=true;}
      A.pd=null;r.win=win;r.el=Math.round(el);
      if(win){const tier=el<=TRIAL_T[0]?0:el<=TRIAL_T[1]?1:2,best=A.daily.trB;r.tier=tier;A.trials=(A.trials||0)+1;
        if(best==null||tier<best){const rw=TRIAL_RW[tier],old=best==null?{}:TRIAL_RW[best],d={};for(const k in rw){const v=rw[k]-(old[k]||0);if(v>0)d[k]=v;}give(A,S,d);A.daily.trB=tier;r.rt=[d.gems?d.gems+' אבני נשמה':'',d.coins?d.coins+' מטבעות עונה':'',d.boxes?'תיבת אוצר':''].filter(Boolean).join(', ');}}
      break;}
    case 'towerEnd':{
      const pd=A.pd;if(!pd||!pd.tower||pd.trial)return fail('אין קרב פעיל');const el=(now-pd.t)/1000,f=pd.tower;let win=!!args.win;
      if(win&&el<1/(pd.live.b[0]*DUEL_LIVE.maxRate)*.8){win=false;r.denied=true;}
      A.pd=null;r.win=win;r.f=f;if(win){A.daily.tw=Math.max(0,(A.daily.tw|0)-1);A.tower.best=Math.max(A.tower.best|0,f);const rw=towerReward(f);give(A,S,rw);r.rt=towerText(rw);if(f>=PERFECT_FLOOR){const it=perfectDrop(S,clamp(A.open|0,0,ZONES.length-1),null,PERFECT_TOWER);if(it){r.perfect=1;r.notable=[it];}}}break;}
    case 'duelEnd':{
      const pd=A.pd;if(!pd||!pd.live||pd.tower)return fail('אין קרב פעיל');const el=(now-pd.t)/1000,claim=!!args.win;
      // fastest possible kill: ordinary hits with every crit landing plus every skill on cooldown
      const minT=1/(pd.live.b[0]*DUEL_LIVE.maxRate);let win=claim;
      if(claim&&el<minT*.8){win=false;r.denied=true;}
      r.win=win;r.gain=duelSettle(A,now,win,pd.o.rt);A.pd=null;break;}
    case 'duelAct':{
      const pd=A.pd;if(!pd)return fail('אין קרב פעיל');const a=String(args.a),D=pd.D;
      if(!duelCan(D.f[0],a))return fail('הפעולה הזו לא זמינה עכשיו');
      r.round=duelRound(D,a,duelAI(D,1));r.D=D;
      if(D.over){r.win=D.win===0;r.gain=duelSettle(A,now,r.win,pd.o.rt);A.pd=null;}break;}
    case 'answer':{
      const w=evWindows(now,0).find(x=>x.e.id==='quiz');if(!w)return fail('החידון לא פעיל עכשיו');
      const rec=evRec(A,w.key);if(rec.t)return fail('כבר ענית על השאלה');
      rec.t=1;r.correct=int(args.a,-1,9)===quizFor(w.key).c;if(r.correct)rec.q=1;break;}
    case 'claimEvent':{
      const w=evWindows(now,10).find(x=>x.e.id===String(args.id)&&x.e.obj);if(!w)return fail('האירוע לא פעיל');
      const rec=evRec(A,w.key),e=w.e;if(rec.c)return fail('הפרס כבר נאסף');if((rec[e.obj[0]]||0)<e.obj[1])return fail('המשימה לא הושלמה');
      const rw=e.tiered?tierReward(clamp(rec.tr|0,1,7)):e.rw;
      rec.c=1;bump(A,'ev',1);if(rw.lv){let xp=0;for(let l=S.lvl;l<Math.min(CAP,S.lvl+rw.lv);l++)xp+=need(l);r.levels=addXp(S,xp);}
      give(A,S,rw);r.rt=e.tiered?rw.lv+' רמות, '+rw.gems+' אבני נשמה ו-'+rw.coins+' מטבעות עונה':e.rt;break;}
    default:return fail('פעולה לא מוכרת');
  }
  A.maxLvl=Math.max(A.maxLvl||1,S.lvl);
  return r;
}

export {brDist,brSpeed,brCan,afkEta,ARESET_PACK,ARESET_MAX,autoReset,TRIAL_TRIES,TRIAL_T,TRIAL_RW,TRIAL_MOD,TRIAL_MEDAL,dayNum,setBoost,boostNow,brKill,JEW,JEWV,jewBase,JEW_RATE,jewelDrop,BR,brNew,brAct,brStep,brRing,brRank,brBots,brReward,brWindow,brAlive,SETN2,SETB2,setKey,setName,setTable,PERFECT_M,PERFECT_BOSS,PERFECT_ELITE,PERFECT_TOWER,PERFECT_FLOOR,perfectDrop,mastery,masteryNeed,MASTERY_PCT,ELITE_HP,TOWER_TRIES,towerBoss,towerReward,LIVE_W,LIVE_RNG,LIVE_LANE,liveFrom,liveNew,liveAct,liveOver,WORLD_BASE,worldReward,DUEL_LIVE,RESPEC_COST,WEEKLY,SIDEQ,EGGS,pickOf,PICK_KEYS,ensureWeek,reqOf,canWear,lacks,WING_MAX,wingFeathers,wingChance,DUEL_ROUNDS,DUEL_POTS,duelNew,duelCan,duelRound,duelAI,duelSettle,PASS_MAX,PASS_STEP,PASS_DAY,tierOf,REGION,KEY_SHARDS,KEY_GOLD,KEEP_GATE,KEEP_HP,keepOpen,PACKS,PREM_SHOP,TIER_MIN,evTier,tierRange,tierReward,isFull,makeExcellent,addOpt,STAT_MAX,PARTY_SHARE,LOGIN_RW,AURAS,cleanAuras,partyXp,GUILD_FEE,SECRET_Q,siegeInfo,FLOORS,floorMin,zs,canFloor,afkFloor,EVENTS,QUIZ,localMin,evWindows,evMods,evNext,quizFor,BASEZ,canEnter,PARTY_XP,setEnv,CAP,ZONES,MHP,ZSPR,CLS,STATN,RAR,TIERN,WINGN,AFF,POOL,SLOTS,SLOTN,SETN,SETB,rslot,isSet,setCounts,UPCH,clamp,need,pois,tzParts,dayKey,seasonKey,AFK,SHARED,newAccount,newChar,bind,ensureDay,itemVals,itemName,itemScore,calc,zoneInfo,afkZone,autoAlloc,addXp,rollAff,makeItem,rollRar,sellVal,stash,gainItem,rollLoot,offline,canReset,resetGain,doReset,upCost,upChance,upgrade,openBox,passReward,passLevel,TASKS,fighter,simDuel,BOSSN,GOLD_SHOP,RESET_SHOP,SEASON_SHOP,totalResets,slotsOpen,anyEq,QUESTS,give,numOr,int,gearOr,cleanPlayer,cleanItem,adopt,findIt,maxKps,BOTN,buildOpps,apply,BAG,MATK,SKLV,SKCD,DROPS,ARM};

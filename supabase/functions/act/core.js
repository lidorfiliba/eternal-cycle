// Game rules shared by the browser client and the server function.
// Pure module: no DOM, no network. Randomness and time are injected with setEnv().
let _rnd=Math.random,_now=Date.now;
function setEnv(rnd,now){_rnd=rnd||Math.random;_now=now||Date.now;}

const CAP=400, BAG=30;
const ZONES=[
 {n:'יער הלחישות',m:'זחלן טחב',min:1,kind:'blob',c:'#7bd66a',sky:['#0f2a2b','#1d4a3a'],sil:'#0a1c1c',amb:'#c8ff8a',sig:'xp'},
 {n:'מערות האבק',m:'עכביש אבן',min:30,kind:'crawler',c:'#b49a7a',sky:['#1a1420','#3a2c33'],sil:'#120d16',amb:'#d9c7a8',sig:'gold'},
 {n:'ביצת הערפל',m:'רפאי ביצה',min:70,kind:'ghost',c:'#8fe0d0',sky:['#0c1f2a','#24505a'],sil:'#081419',amb:'#9ff5e6',sig:'hp',wing:1},
 {n:'חולות הזעם',m:'עקרב חול',min:120,kind:'crawler',c:'#e0a044',sky:['#3a1c1a','#a8572a'],sil:'#24100f',amb:'#ffd58a',sig:'crit'},
 {n:'מצודת הכפור',m:'גולם קרח',min:180,kind:'brute',c:'#9fd0ff',sky:['#0d1838','#3d6aa8'],sil:'#0a1026',amb:'#ffffff',sig:'aspd',wing:2},
 {n:'הר הגחלים',m:'שד גחלת',min:240,kind:'ghost',c:'#ff6a3d',sky:['#1f0a0c','#7a1f14'],sil:'#120506',amb:'#ffb066',sig:'cdmg'},
 {n:'מגדל הצללים',m:'אביר צל',min:300,kind:'brute',c:'#a487ff',sky:['#0c0820','#3a2378'],sil:'#070414',amb:'#c9b3ff',sig:'drop',wing:3},
 {n:'שער הנצח',m:'דרקון נצח',min:350,kind:'drake',c:'#f2c14e',sky:['#1a1030','#8a5a2a'],sil:'#0f081c',amb:'#fff0b0',sig:'dmg',wing:4},
 // Reset maps: open only to characters that have reset, stronger monsters and better rewards for the same level.
 {n:'מעמקי השכחה',wing:5,m:'פטריית תהום',min:100,req:1,kind:'blob',c:'#b07cff',sky:['#12062a','#3b1466'],sil:'#0a0318',amb:'#d6b3ff',sig:'xp',xpo:99,go:48},
 {n:'קרחון האלים',wing:6,m:'תולעת קרח',min:200,req:2,kind:'crawler',c:'#8fe6ff',sky:['#061a2e','#2f7fa8'],sil:'#04101c',amb:'#e8fbff',sig:'dmg',xpo:223,go:82},
 {n:'היכל הזהב',wing:7,m:'גובלין זהב',min:300,req:4,kind:'brute',c:'#ffd24a',sky:['#2a1a05','#b8862a'],sil:'#1a1003',amb:'#fff3c4',sig:'gold',xpo:383,go:112},
 {n:'לב המעגל',wing:8,m:'שלד דם',min:380,req:7,kind:'brute',c:'#ff5c5c',sky:['#1f0306','#8f1420'],sil:'#120204',amb:'#ffb0b0',sig:'cdmg',xpo:532,go:136}
];
const BASEZ=8;
const MHP=[90,400,880,1540,2420,3400,4480,5450,1900,4100,6700,9000], MATK=[13,37,71,113,164,214,265,307,135,253,371,462];
const ZSPR=['mush','gob','eye','worm','skel_f','gob_r','eye_p','skel_g','mush_d','worm_i','gob_g','skel_d'],ZMON=['פטריית טחב','גובלין מערות','עין מרחפת','תולעת אש','שלד כפור','גובלין גחלת','עין צל','שלד נצח','פטריית תהום','תולעת קרח','גובלין זהב','שלד דם'];
// Reset maps are built for characters that kept their stats through resets: [life, damage] multipliers by the resets a map needs.
const RESET_TOUGH={1:[4,2.2],2:[4.5,2.6],4:[5.5,3],7:[7,3.5]};
ZONES.forEach((z,i)=>{z.spr=ZSPR[i];z.m=ZMON[i];z.fly=ZSPR[i].indexOf('eye')===0;z.hp=MHP[i];z.atk=MATK[i];z.xp=Math.round(10*Math.pow(1+z.min/50,1.6));z.gold=Math.round(3*Math.pow(i+1,1.5));if(z.req){z.xp=z.xpo;z.gold=z.go;const t=RESET_TOUGH[z.req]||[1,1];z.hp=Math.round(z.hp*t[0]);z.atk=Math.round(z.atk*t[1]);}});
const CLS={
 blade:{n:'לוחם להב',main:'str',coef:1.5,combo:'סערת להבים',c:'#ff8a4d',wn:'להב',range:50,sk:['סערת להבים','שרשרת ברזל','זעם הקרב','מכת מחץ','חומת פלדה','אלף להבים'],al:{str:.6,agi:.15,vit:.25}},
 storm:{n:'מכשפת סער',main:'ene',coef:1.5,combo:'ברק שרשרת',c:'#6fd3ff',wn:'מטה',range:175,sk:['ברק שרשרת','מערבולת','הארת סער','כדור אש','מגן קסם','מטר מטאורים'],al:{ene:.6,agi:.15,vit:.25}},
 hunter:{n:'צייד צללים',main:'agi',coef:0.62,combo:'מטר חניתות',c:'#8be28b',wn:'חנית',range:235,sk:['מטר חניתות','רשת צללים','עין הנץ','חנית חודרת','צעד צל','מטח הציידים'],al:{agi:.7,vit:.3}}
};
const STATN={str:['כוח','נזק ללוחם להב'],agi:['זריזות','מהירות, קריטי, הגנה'],vit:['חיוניות','חיים והגנה'],ene:['אנרגיה','נזק למכשפת סער']};
const RAR=[{n:'רגיל',c:'#b9b4c7',m:1},{n:'קסום',c:'#5aa9ff',m:1.25},{n:'נדיר',c:'#c77dff',m:1.6},{n:'אגדי',c:'#ffb23e',m:2.1},{n:'עתיק',c:'#3df5c8',m:2.8}];
const TIERN=['חניך','ברזל','כסף ירח','חול זועם','כפור','גחלת','צל','נצח','תהום','קרחון','זהב טהור','מעגל'];
const WINGN=['כנפי עלה','כנפי סער','כנפי להבה','כנפי נצח','כנפי תהום','כנפי קרחון','כנפי זהב','כנפי המעגל'];
const AFF={dmg:['נזק',3,8],crit:['סיכוי קריטי',1,4],cdmg:['נזק קריטי',8,20],aspd:['מהירות תקיפה',2,6],hp:['חיים',4,10],def:['הגנה',4,10],xp:['ניסיון',3,8],gold:['זהב',5,15],drop:['סיכוי שלל',2,6]};
const POOL={w:['dmg','crit','cdmg','aspd','xp','gold','drop'],a:['hp','def','xp','gold','drop','crit'],g:['dmg','hp','xp','aspd','cdmg'],
  h:['hp','def','xp','crit','drop','cdmg'],p:['hp','def','xp','gold','drop','crit'],l:['aspd','crit','hp','def','drop','gold'],b:['hp','def','xp','gold','drop','aspd']};
const SLOTS=['w','h','a','p','l','b','g'],DROPS=['w','h','a','p','l','b'],ARM={h:.35,a:.6,p:.4,l:.3,b:.35};
const SLOTN={w:'נשק',h:'קסדה',a:'שריון',p:'מכנסיים',l:'כפפות',b:'מגפיים',g:'כנפיים'};
const SETN=['שומרי היער','חופרי האבק','ילדי הערפל','זעם החולות','לב הכפור','גחלת נצחית','צל המגדל','כתר הנצח','בני התהום','נסיכי הקרח','אוצר ההיכל','לב המעגל'];
const SETB=[[2,'hp',10],[3,'dmg',12],[4,'cdmg',25],[5,'aspd',8],[6,'dmg',25],[6,'xp',20]];
const rslot=()=>DROPS[Math.floor(_rnd()*DROPS.length)];
const isSet=it=>it&&it.r===4&&it.s!=='g'&&it.z>=0;
function setCounts(s){const c={};for(const k of DROPS){const it=s.eq[k];if(isSet(it))c[it.z]=(c[it.z]||0)+1;}return c;}
const UPCH=[.75,.65,.55,.5,.45,.4,.35,.3,.25];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const need=L=>Math.round((4+0.07*L)/1.5*10*Math.pow(1+L/50,1.6)*(1+1.25*Math.min(1,L/100)));
const pois=x=>{let n=Math.floor(x);if(_rnd()<x-n)n++;return n;};
function tzParts(){const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jerusalem',year:'numeric',month:'numeric',day:'numeric'}).formatToParts(new Date(_now()));const o={};for(const x of p)o[x.type]=x.value;return o;}
const dayKey=()=>{const o=tzParts();return o.year+'-'+(+o.month)+'-'+(+o.day);};
const seasonKey=()=>{const o=tzParts();return o.year+'-'+(+o.month);};

const AFK=.7, SKLV=[1,20,60,110,180,260], SKCD=[4,12,30,10,25,45];
const SHARED=['gold','gems','cred','coins','boxes','sboxes','charms','bless','bonusPts','boost','inv','nid','kills','killAcc','pass','day','daily','rating','tickets','autoEq','autoSell','open','zk','login'];
function newAccount(){
  return {v:2,gold:0,gems:3,cred:0,coins:0,boxes:1,sboxes:0,charms:0,bless:0,bonusPts:0,boost:0,inv:[],nid:1,kills:0,killAcc:0,
    pass:{key:seasonKey(),xp:0,claimed:0},day:dayKey(),daily:{kills:0,resets:0,wins:0,ups:0,done:{}},rating:1000,tickets:5,
    autoEq:true,autoSell:1,open:0,zk:{},bossM:{},q:0,casts:0,wins:0,boss7:0,maxLvl:1,chars:[],cur:0,last:_now()};
}
function newChar(name,cls){
  return {name:name,cls:cls,lvl:1,xp:0,resets:0,pts:0,stats:{str:15,agi:15,vit:15,ene:15},zone:-1,floor:0,autoPts:true,auto:true,eq:{w:null,h:null,a:null,p:null,l:null,b:null,g:null},last:_now()};
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
  if(s.day!==dayKey()){s.day=dayKey();s.daily={kills:0,resets:0,wins:0,ups:0,done:{}};s.tickets=Math.max(s.tickets,5);}
  if(s.pass.key!==seasonKey())s.pass={key:seasonKey(),xp:0,claimed:0};
}
function itemVals(it){
  const m=RAR[it.r].m*(1+0.08*it.p);
  if(it.s==='w')return {atk:Math.round((20+25*it.t)*m)};
  if(ARM[it.s])return {hp:Math.round((80+110*it.t)*m*ARM[it.s]),def:Math.round((8+9*it.t)*m*ARM[it.s])};
  const w=(6+6*it.t)*(1+0.06*it.p)*(1+0.1*it.r);
  return {wd:Math.round(w*10)/10,wh:Math.round(w*5)/10};
}
function itemName(it,cls){
  if(it.s==='g')return it.season?'כנפי העונה':WINGN[it.t-1];
  return (it.s==='w'?CLS[cls].wn:SLOTN[it.s])+(isSet(it)?' · '+SETN[it.z]:' '+TIERN[it.t-1]);
}
function itemScore(it){
  const v=itemVals(it);let b=it.s==='w'?v.atk:ARM[it.s]?v.hp+v.def*10:v.wd*100;if(isSet(it))b*=1.15;
  let a=0;for(const f of it.af)a+=f[1]/(AFF[f[0]][2]);
  return b*(1+a*0.12);
}
// What each class gives to party members fighting on the same map.
const AURAS={blade:{n:'זעקת קרב',d:'12% נזק'},storm:{n:'רוח סער',d:'10% מהירות תקיפה'},hunter:{n:'עין הצייד',d:'8% קריטי ו-15% נפילות'}};
const cleanAuras=l=>Array.isArray(l)?[...new Set(l.filter(k=>typeof k==='string'&&AURAS[k]))]:[];
function calc(s,au){
  const c=CLS[s.cls],st=s.stats,a={dmg:0,crit:0,cdmg:0,aspd:0,hp:0,def:0,xp:0,gold:0,drop:0};
  let atk=0,ahp=0,adef=0,wd=0,wh=0;
  for(const k of SLOTS){const it=s.eq[k];if(!it)continue;const v=itemVals(it);
    atk+=v.atk||0;ahp+=v.hp||0;adef+=v.def||0;wd+=v.wd||0;wh+=v.wh||0;for(const f of it.af)a[f[0]]+=f[1];}
  const sc=setCounts(s);for(const z in sc)for(const b of SETB)if(sc[z]>=b[0])a[b[1]]+=b[2];
  const main=st[c.main];
  const base=10+main*c.coef+(st.str+st.agi+st.ene-main)*0.15+atk;
  let dmg=base*(1+0.04*s.resets)*(1+a.dmg/100)*(1+wd/100);
  let aspd=Math.min(3.2,(1.1+st.agi/500)*(1+a.aspd/100));
  let crit=Math.min(.6,.05+st.agi/3000+a.crit/100);
  const cdmg=2+a.cdmg/100;
  const hp=(120+st.vit*10+s.lvl*6+ahp)*(1+a.hp/100)*(1+wh/100);
  const def=(st.agi*.15+st.vit*.1+adef)*(1+a.def/100);
  if(au&&au.length){if(au.includes('blade'))dmg*=1.12;if(au.includes('storm'))aspd*=1.1;if(au.includes('hunter'))crit=Math.min(.75,crit+.08);}
  const dps=dmg*aspd*(1+crit*(cdmg-1))*1.3;
  const boost=s.boost>(s._now||_now())?1.5:1;
  return {dmg,aspd,crit,cdmg,hp,def,dps,power:Math.round(dps*.6+hp*.25+def*2),
    xpM:(1+a.xp/100)*(1+0.05*s.bless)*boost,goldM:1+a.gold/100,dropM:1+a.drop/100};
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
function autoAlloc(s){
  if(s.pts<=0)return;const al=CLS[s.cls].al;let left=s.pts;
  const put=(k,n)=>{n=Math.max(0,Math.min(n,STAT_MAX-s.stats[k]));s.stats[k]+=n;left-=n;};
  for(const k in al)put(k,Math.floor(s.pts*al[k]));
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
function makeItem(s,slot,t,r,zi,extra){
  const it={id:s.nid++,s:slot,t:t,r:r,p:0,z:zi,af:rollAff(slot,t,zi>=0?ZONES[zi].sig:null,r)};
  if(extra)Object.assign(it,extra);return it;
}
function rollRar(tab){let x=_rnd()*100;for(let i=0;i<tab.length;i++){x-=tab[i];if(x<0)return i;}return 0;}
const sellVal=it=>Math.round(20*(it.s==='g'?it.t*3:it.t)*(it.r+1)*(it.r+1)*(1+it.p*.3));
function stash(s,it,rep){
  const weak=it.r<s.autoSell;
  if(weak||s.inv.length>=BAG){const g=sellVal(it);s.gold+=g;if(rep){rep.sold=(rep.sold||0)+1;rep.gold=(rep.gold||0)+g;}return false;}
  s.inv.push(it);return true;
}
function gainItem(s,it,rep){
  const cur=s.eq[it.s];
  if(s.autoEq&&(!cur||itemScore(it)>itemScore(cur))){s.eq[it.s]=it;if(rep)rep.equipped=(rep.equipped||0)+1;if(cur)stash(s,cur,rep);return 'eq';}
  return stash(s,it,rep)?'bag':'sold';
}
function rollLoot(s,zi,kills,c,rep){
  const z=ZONES[zi];
  const g=Math.round(kills*z.gold*c.goldM*(0.8+_rnd()*.4));s.gold+=g;rep.gold=(rep.gold||0)+g;
  const ng=pois(kills*.008);s.gems+=ng;rep.gems=(rep.gems||0)+ng;
  const nb=pois(kills*.0012);s.boxes+=nb;rep.boxes=(rep.boxes||0)+nb;
  const ni=Math.min(80,pois(kills*.03*c.dropM));
  for(let i=0;i<ni;i++){const it=makeItem(s,rslot(),zi+1,rollRar([62,25,9,3.3,.7]),zi);
    const where=gainItem(s,it,rep);rep.items=(rep.items||0)+1;if(it.r>=2&&where!=='sold'){(rep.notable=rep.notable||[]).push(it);}}
  if(z.wing){const nw=Math.min(4,pois(kills*.0015*c.dropM));
    for(let i=0;i<nw;i++){const it=makeItem(s,'g',z.wing,rollRar([50,30,14,5,1]),zi);gainItem(s,it,rep);(rep.notable=rep.notable||[]).push(it);}}
  s.kills+=kills;s.daily.kills+=kills;s.killAcc+=kills;s.zk[zi]=(s.zk[zi]||0)+kills;
  if(s.killAcc>=100){const n=Math.floor(s.killAcc/100);s.killAcc-=n*100;s.pass.xp+=n*5;}
}
function offline(s,secs){
  ensureDay(s);
  const rep={secs:secs,kills:0,levels:0};let left=Math.min(secs,12*3600),now=s.last,guard=0;
  const perZone={};
  if(afkZone(s)<0)return rep;
  while(left>0.5&&guard++<900){
    s._now=now;const c=calc(s),zi=afkZone(s),zf=zoneInfo(zi,c,AFK,afkFloor(s,zi));
    let step=left;
    if(s.boost>now)step=Math.min(step,(s.boost-now)/1000+0.01);
    if(s.lvl<CAP){const t=(need(s.lvl)-s.xp)/zf.xps;if(t<step)step=t+1e-6;}
    perZone[zi]=(perZone[zi]||0)+zf.kps*step;
    rep.levels+=addXp(s,zf.xps*step);
    left-=step;now+=step*1000;
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
  s.resets++;s.lvl=1;s.xp=0;s.cred+=g;s.coins+=5;s.pass.xp+=150;s.daily.resets++;s.zone=-1;s.floor=0;
  if(s.autoPts)autoAlloc(s);return true;
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
  if(kind==='a'){const it=makeItem(s,rslot(),zi+1,_rnd()<.25?4:3,zi);return {it:it,where:gainItem(s,it)};}
  if(kind==='s'){const it=makeItem(s,rslot(),zi+1,rollRar([0,0,55,30,15]),zi);return {it:it,where:gainItem(s,it)};}
  const x=_rnd();
  if(x<.55){const it=makeItem(s,rslot(),zi+1,rollRar([0,45,35,16,4]),zi);return {it:it,where:gainItem(s,it)};}
  if(x<.85){const n=3+Math.floor(_rnd()*4);s.gems+=n;return {txt:n+' אבני נשמה'};}
  const g=Math.round(ZONES[zi].gold*400*(0.8+_rnd()*.6));s.gold+=g;return {txt:g+' זהב'};
}
function passReward(lv){
  if(lv===30)return {t:'כנפי העונה',wing:[4,4,true]};
  if(lv===20)return {t:'כנפי להבה אגדיות',wing:[3,3]};
  if(lv===10)return {t:'כנפי סער נדירות',wing:[2,2]};
  if(lv%5===0)return {t:'תיבת עונה',sboxes:1};
  if(lv%2===0)return {t:(3+Math.floor(lv/5))+' אבני נשמה',gems:3+Math.floor(lv/5)};
  return {t:'15 מטבעות עונה',coins:15};
}
const passLevel=s=>Math.min(30,Math.floor(s.pass.xp/100));
const TASKS=[{k:'kills',n:1500,t:'חסל 1,500 מפלצות',xp:60},{k:'resets',n:1,t:'בצע ריסט',xp:100},{k:'wins',n:2,t:'נצח 2 קרבות זירה',xp:60},{k:'ups',n:3,t:'נסה 3 שדרוגים',xp:40}];
function fighter(s){const c=calc(s);const g=it=>it?[it.t,it.r,it.p,it.season?1:0]:null;
  return {n:s.name,c:s.cls,l:s.lvl,r:s.resets,p:c.power,d:Math.round(c.dmg),a:Math.round(c.aspd*100)/100,h:Math.round(c.hp),f:Math.round(c.def),cr:Math.round(c.crit*100)/100,cd:Math.round(c.cdmg*100)/100,w:g(s.eq.w),ar:g(s.eq.a),g:g(s.eq.g),rt:s.rating};}
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
const RESET_SHOP=[{k:'charm',t:'3 קמעות הגנה',d:'שדרוג שנכשל לא מוריד דרגה',cost:4},{k:'bless',t:'ברכת נצח',d:'5% יותר ניסיון לתמיד לכל הדמויות, עד 10 פעמים',cost:8},{k:'pts',t:'50 נקודות סטט',d:'לדמות הנוכחית, נשארות לתמיד',cost:10},{k:'abox',t:'תיבה עתיקה',d:'פריט אגדי או עתיק מהמפה הגבוהה שפתחת',cost:12},{k:'wing',t:'כנפיים בדרגה הבאה',d:'כנפיים נדירות, דרגה אחת מעל הלבושות',cost:25}];
const SEASON_SHOP=[{k:'sbox',t:'תיבת עונה',d:'15% לחלק סט עתיק, אחרת נדיר או אגדי',cost:60},{k:'box',t:'תיבת אוצר',d:'',cost:30},{k:'gem5',t:'5 אבני נשמה',d:'',cost:20},{k:'ticket',t:'כרטיס זירה',d:'',cost:10}];
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
 {t:'הבס את הבוס של ביצת הערפל',p:(A,S)=>[A.open>=3?1:0,1],rw:{wing:[1,1]},rt:'כנפי עלה קסומות'},
 {t:'נצח קרב בזירה',p:(A,S)=>[A.wins||0,1],rw:{coins:20},rt:'20 מטבעות עונה'},
 {t:'הגע לרמה 200',p:(A,S)=>[A.maxLvl||1,200],rw:{gems:10},rt:'10 אבני נשמה'},
 {t:'הגע לרמה 400 ובצע ריסט ראשון',p:(A,S)=>[totalResets(A),1],rw:{cred:10},rt:'10 אותות ריסט'},
 {t:'צור דמות שנייה',p:(A,S)=>[A.chars.length,2],rw:{boxes:2},rt:'2 תיבות אוצר'},
 {t:'הבס את הבוס של שער הנצח',p:(A,S)=>[A.boss7?1:0,1],rw:{cred:20},rt:'20 אותות ריסט'}
];
function give(A,S,r){
  if(r.sboxes)A.sboxes+=r.sboxes;if(r.gold)A.gold+=r.gold;if(r.cred)A.cred+=r.cred;if(r.coins)A.coins+=r.coins;if(r.gems)A.gems+=r.gems;if(r.boxes)A.boxes+=r.boxes;
  if(r.wing){const it=makeItem(S,'g',r.wing[0],r.wing[1],-1,r.wing[2]?{season:true}:null);const cur=S.eq.g;
    if(!cur||itemScore(it)>itemScore(cur)){S.eq.g=it;if(cur&&A.inv.length<BAG)A.inv.push(cur);}else if(A.inv.length<BAG)A.inv.push(it);else S.eq.g=it;}
}

/* ---------- timed events (server clock, Asia/Jerusalem) ---------- */
// Bonuses and objectives count only while playing; AFK progress never gets them.
const EVENTS=[
 {id:'crimson',n:'מצודת הארגמן',d:'חסל 80 מפלצות לפני שהשער נסגר',when:'כל שעה עגולה',every:60,at:0,dur:12,obj:['k',80],rw:{lv:4,gems:3,coins:5},rt:'4 רמות, 3 אבני נשמה ו-5 מטבעות עונה'},
 {id:'square',n:'כיכר התוהו',d:'ניסיון כפול לכולם. חסל 150 מפלצות לפרס',when:'כל שעתיים, בחצי',every:120,at:30,dur:15,mod:{xp:2},obj:['k',150],rw:{lv:6,boxes:1},rt:'6 רמות ותיבת אוצר'},
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
function evMods(now){const m={xp:1,drop:1};for(const w of evWindows(now,0))if(w.e.mod){m.xp*=w.e.mod.xp||1;m.drop*=w.e.mod.drop||1;}return m;}
function evNext(e,now){const lm=localMin(now);for(let i=1;i<=1440;i++){const m=(lm.m+i)%1440;if(evStart(e,m)===m)return i*60-lm.s;}return 86400;}
function quizFor(key){let h=0;for(let i=0;i<key.length;i++)h=(h*31+key.charCodeAt(i))>>>0;return QUIZ[h%QUIZ.length];}
function evRec(A,key){
  A.ev=A.ev||{};if(!A.ev[key]){const lim=Math.round(_now()/60000)-240;for(const k in A.ev)if(+k.split(':')[1]<lim)delete A.ev[k];A.ev[key]={k:0,b:0,w:0,q:0};}
  return A.ev[key];
}
function evAdd(A,now,f,n){if(n>0)for(const w of evWindows(now,0))if(w.e.obj&&w.e.obj[0]===f)evRec(A,w.key)[f]+=n;}

/* ---------- state helpers ---------- */
const numOr=(v,d,lo,hi)=>{v=Number(v);return isFinite(v)?clamp(v,lo,hi):d;};
const int=(v,lo,hi)=>{v=Math.floor(Number(v));return isFinite(v)?clamp(v,lo,hi):lo;};
const gearOr=g=>Array.isArray(g)?[numOr(g[0],1,1,12)|0,numOr(g[1],0,0,4)|0,numOr(g[2],0,0,15)|0,g[3]?1:0]:null;
function cleanPlayer(id,o){
  o=o||{};
  return {id:String(id),n:String(o.n||'אלמוני').slice(0,14),c:CLS[o.c]?o.c:'blade',l:numOr(o.l,1,1,CAP)|0,r:numOr(o.r,0,0,99999)|0,p:numOr(o.p,1,1,1e9)|0,
    d:numOr(o.d,10,1,1e8),a:numOr(o.a,1,.3,3.2),h:numOr(o.h,100,1,1e9),f:numOr(o.f,0,0,1e7),cr:numOr(o.cr,.05,0,.6),cd:numOr(o.cd,2,1,10),
    w:gearOr(o.w),ar:gearOr(o.ar),g:gearOr(o.g),rt:numOr(o.rt,1000,0,99999)|0};
}
function cleanItem(o){
  if(!o||SLOTS.indexOf(o.s)<0)return null;
  const it={id:0,s:o.s,t:numOr(o.t,1,1,o.s==='g'?8:12)|0,r:numOr(o.r,0,0,4)|0,p:numOr(o.p,0,0,15)|0,z:numOr(o.z,-1,-1,ZONES.length-1)|0,af:[]};
  if(o.season&&o.s==='g')it.season=true;
  if(Array.isArray(o.af))for(const f of o.af.slice(0,4))if(Array.isArray(f)&&AFF[f[0]]&&POOL[it.s].indexOf(f[0])>=0)it.af.push([f[0],Math.round(numOr(f[1],0,0,AFF[f[0]][2]*1.3)*10)/10]);
  return it;
}
// Turn a stored JSON object back into a live account (shared fields are accessors on each character).
function adopt(o){
  if(!o||o.v!==2||!Array.isArray(o.chars))return null;
  o.bossM=o.bossM||{};o.zk=o.zk||{};o.sboxes=o.sboxes||0;o.inv=o.inv||[];
  o.chars.forEach(c=>{bind(o,c);c.floor=c.floor|0;for(const k of SLOTS)if(!(k in c.eq))c.eq[k]=null;});
  o.cur=o.chars.length?clamp(o.cur|0,0,o.chars.length-1):0;return o;
}
function findIt(A,S,id){for(const k of SLOTS)if(S.eq[k]&&S.eq[k].id===id)return {it:S.eq[k],eq:k};const i=A.inv.findIndex(x=>x.id===id);return i>=0?{it:A.inv[i],i:i}:null;}
// Highest kill rate a legitimate client can reach in a zone, skills and buffs included.
function maxKps(S,zi,au){const c=calc(S,au),z=zs(zi,afkFloor(S,zi));return Math.min(2.1,1/Math.max(.35,z.hp/(c.dps*2.8)+.3));}
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
  args=args||{};ctx=ctx||{};const now=_now(),r={ok:true};loginDay(A);
  const fail=m=>({ok:false,msg:m});
  if(kind==='create'){
    const nm=String(args.name||'').replace(/[<>&"'\u0000-\u001f]/g,'').trim().slice(0,14)||'גיבור',cls=CLS[args.cls]?args.cls:'blade';
    if(A.chars.length>=3||(A.chars.length&&A.chars.length>=slotsOpen(A)))return fail('אין מקום לדמות נוספת');
    if(A.chars.length)A.chars[A.cur].last=now;
    A.chars.push(bind(A,newChar(nm,cls)));A.cur=A.chars.length-1;A.allow=0;A.tk=now;A.bossAt=null;A.opps=null;return r;
  }
  if(!A.chars.length)return fail('אין דמות');
  let S=A.chars[A.cur];ensureDay(S);
  // Time since the previous call decides how many kills may be claimed (token bucket) or, after a long gap, AFK progress.
  const el=Math.max(0,(now-(A.tk||now))/1000);A.tk=now;
  if(el>90){S.last=now-el*1000;const rep=offline(S,el);A.allow=0;A.bossAt=null;if(rep.kills>0)r.afk=[{name:S.name,zone:S.zone,rep:rep}];}
  else if(S.zone>=0)A.allow=Math.min(40,(A.allow||0)+el*maxKps(S,afkZone(S),cleanAuras(ctx.auras)));
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
    case 'gcreate':{if(A.gold<GUILD_FEE)return fail('פתיחת גילדה עולה '+GUILD_FEE+' זהב');A.gold-=GUILD_FEE;break;}
    case 'travel':{
      const z=int(args.z,-1,ZONES.length-1),f=z<0?0:int(args.f,0,FLOORS-1);if(!canEnter(S,z))return fail('המפה נעולה');
      if(!canFloor(S,z,f))return fail('צריך רמה '+floorMin(z,f)+' לקומה הזו');
      if(z!==S.zone||f!==(S.floor|0)){S.zone=z;S.floor=f;A.bossAt=null;A.allow=Math.min(A.allow||0,3);}break;}
    case 'tick':{
      const z=int(args.z,-1,ZONES.length-1);
      if(z<0){if(S.zone!==-1){S.zone=-1;S.floor=0;A.bossAt=null;}break;}
      const f=int(args.f,0,FLOORS-1);
      if(!canEnter(S,z))return fail('המפה נעולה');
      if(!canFloor(S,z,f))return fail('צריך רמה '+floorMin(z,f)+' לקומה הזו');
      if(z!==S.zone||f!==(S.floor|0)){S.zone=z;S.floor=f;A.bossAt=null;A.allow=Math.min(A.allow||0,3);}
      const zd=zs(z,f),rep={},em=evMods(now),au=cleanAuras(ctx.auras),c=calc(S,au),pn=int(ctx.partyN,0,4),gl=int(ctx.guildLvl,0,10),cs=ctx.castle?1:0,pb=(1+partyXp(pn))*em.xp*(1+gl*.01+cs*.1);c.dropM*=em.drop*zd.drop*(au.includes('hunter')?1.15:1);r.auras=au;c.goldM*=zd.gold*(1+cs*.1);r.partyN=pn;r.guildLvl=gl;r.castle=cs;
      const k=Math.min(int(args.kills,0,1000),Math.floor(A.allow||0));r.claimed=int(args.kills,0,1000);r.kills=k;
      A.casts=(A.casts||0)+int(args.casts,0,30);
      {const sh=Math.max(0,Math.min(Number(ctx.shareXp)||0,5e7));if(sh>0){r.shared=Math.round(sh);rep.levels=(rep.levels||0)+addXp(S,sh);}} // from party members' kills here; the server supplies it
      r.base=k*zd.xp;
      if(k>0){A.allow-=k;rep.levels=(rep.levels||0)+addXp(S,k*zd.xp*c.xpM*pb);rollLoot(S,z,k,c,rep);evAdd(A,now,'k',k);
        if(!A.bossAt){A.bossM[z]=(A.bossM[z]||0)+k;if(A.bossM[z]>=BOSSN){A.bossM[z]=0;A.bossAt={z:z,t:now};}}}
      if(args.boss){
        const b=A.bossAt;
        // The boss must have been spawned by the server, and enough time must have passed to deal its HP in damage.
        if(b&&b.z===z&&(now-b.t)/1000*c.dps*2.8>=zd.hp*30*.9){
          A.bossAt=null;rep.levels=(rep.levels||0)+addXp(S,zd.xp*40*c.xpM*pb);rollLoot(S,z,1,c,rep);
          const it=makeItem(S,rslot(),z+1,rollRar([0,0,70,25,5]),z);gainItem(S,it,rep);(rep.notable=rep.notable||[]).push(it);
          const g=2+Math.floor(_rnd()*3);A.gems+=g;rep.gems=(rep.gems||0)+g;if(_rnd()<.3){A.boxes++;rep.boxes=(rep.boxes||0)+1;}
          if(z===7)A.boss7=1;if(A.open===z&&z<BASEZ-1){A.open=z+1;rep.opened=z+1;}rep.boss=true;evAdd(A,now,'b',1);
        }else rep.bossDenied=true;
      }
      r.rep=rep;break;}
    case 'pt':{
      const k=String(args.k);if(['str','agi','vit','ene'].indexOf(k)<0)return fail('סטט לא קיים');
      const n=Math.min(args.n==='all'?S.pts:Math.min(S.pts,int(args.n,0,100000)),STAT_MAX-S.stats[k]);if(n<=0)return fail(S.stats[k]>=STAT_MAX?'הסטט הזה מלא':'אין נקודות לחלק');S.stats[k]+=n;S.pts-=n;break;}
    case 'autoPts':S.autoPts=!S.autoPts;if(S.autoPts)autoAlloc(S);break;
    case 'autoEq':A.autoEq=!A.autoEq;break;
    case 'autoSell':A.autoSell=((A.autoSell|0)+1)%3;break;
    case 'setAuto':S.auto=!!args.on;break;
    case 'reset':{if(!canReset(S))return fail('צריך רמה 400');r.gain=resetGain(S);doReset(S);A.bossAt=null;A.allow=0;r.resets=S.resets;break;}
    case 'equip':{const f=findIt(A,S,int(args.id,0,1e12));if(!f||f.i==null)return fail('הפריט לא בתיק');A.inv.splice(f.i,1);const old=S.eq[f.it.s];S.eq[f.it.s]=f.it;if(old)A.inv.push(old);break;}
    case 'unequip':{const f=findIt(A,S,int(args.id,0,1e12));if(!f||!f.eq)return fail('הפריט לא לבוש');if(A.inv.length>=BAG)return fail('התיק מלא');S.eq[f.eq]=null;A.inv.push(f.it);break;}
    case 'sell':{const f=findIt(A,S,int(args.id,0,1e12));if(!f||f.i==null)return fail('הפריט לא בתיק');A.inv.splice(f.i,1);A.gold+=sellVal(f.it);break;}
    case 'sellJunk':{let g=0;A.inv=A.inv.filter(it=>{if(it.r<=1&&it.s!=='g'){g+=sellVal(it);return false;}return true;});A.gold+=g;r.gold=g;break;}
    case 'upgrade':{const f=findIt(A,S,int(args.id,0,1e12));if(!f)return fail('הפריט לא נמצא');r.code=upgrade(S,f.it);r.p=f.it.p;r.r=f.it.r;break;}
    case 'openBox':{const sk=args.k==='s';if((sk?A.sboxes:A.boxes)<1)return fail('אין תיבות');if(sk)A.sboxes--;else A.boxes--;r.box=openBox(S,sk?'s':'');break;}
    case 'buy':{
      const shop=String(args.shop),k=String(args.k),list=shop==='gold'?GOLD_SHOP:shop==='reset'?RESET_SHOP:shop==='season'?SEASON_SHOP:null,cur=shop==='gold'?'gold':shop==='reset'?'cred':'coins';
      const o=list&&list.find(x=>x.k===k);if(!o)return fail('המוצר לא קיים');if(A[cur]<o.cost)return fail('אין מספיק');
      if(k==='wing'){const t=(S.eq.g?S.eq.g.t:0)+1;if(t>4)return fail('כבר בדרגה המרבית');if(A.inv.length>=BAG)return fail('התיק מלא');A[cur]-=o.cost;const it=makeItem(S,'g',t,2,-1);r.box={it:it,where:gainItem(S,it)};}
      else if(k==='abox'){A[cur]-=o.cost;r.box=openBox(S,'a');}
      else{
        if(k==='bless'&&A.bless>=10)return fail('הגעת למקסימום');
        A[cur]-=o.cost;
        if(k==='gem')A.gems++;else if(k==='gem5')A.gems+=5;else if(k==='sbox')A.sboxes++;else if(k==='box')A.boxes++;else if(k==='ticket')A.tickets++;
        else if(k==='scroll')A.boost=Math.max(A.boost,now)+18e5;else if(k==='charm')A.charms+=3;else if(k==='bless')A.bless++;
        else if(k==='pts'){A.bonusPts+=50;S.pts+=50;if(S.autoPts)autoAlloc(S);}
        r.bought=o.t;}
      break;}
    case 'claimPass':{if(passLevel(S)<=A.pass.claimed)return fail('אין פרס לאיסוף');A.pass.claimed++;const rw=passReward(A.pass.claimed);give(A,S,rw);r.t=rw.t;break;}
    case 'claimLogin':{const lg=A.login;if(!lg||lg.got)return fail('את הפרס של היום כבר אספת');const day=clamp(lg.s|0,1,7),rw=LOGIN_RW[day-1];lg.got=1;
      A.gems+=rw.gems||0;A.boxes+=rw.boxes||0;A.sboxes+=rw.sboxes||0;A.coins+=rw.coins||0;A.charms+=rw.charms||0;if(rw.boost)A.boost=Math.max(A.boost,now)+18e5;r.t=rw.t;r.day=day;break;}
    case 'claimTask':{const t=TASKS.find(x=>x.k===args.k);if(!t||A.daily[t.k]<t.n||A.daily.done[t.k])return fail('המשימה לא הושלמה');A.daily.done[t.k]=1;A.pass.xp+=t.xp;r.xp=t.xp;break;}
    case 'claimQuest':{const q=QUESTS[A.q|0];if(!q)return fail('אין משימה');const p=q.p(A,S);if(p[0]<p[1])return fail('המשימה לא הושלמה');give(A,S,q.rw);A.q=(A.q|0)+1;r.rt=q.rt;break;}
    case 'opps':A.opps=buildOpps(A,S,ctx.players,ctx.uid);break;
    case 'duel':{
      const o=A.opps&&A.opps[int(args.i,0,3)];if(!o)return fail('רענן את רשימת היריבים');
      const free=evWindows(now,0).some(w=>w.e.id==='royale');if(!free&&A.tickets<1)return fail('אין כרטיסים');
      if(!free)A.tickets--;const sim=simDuel(fighter(S),o),win=sim.win===0;let gain=0;
      if(win){gain=clamp(Math.round(24-(A.rating-o.rt)/25),8,40);A.rating+=gain;A.coins+=8;A.pass.xp+=15;A.daily.wins++;A.wins=(A.wins||0)+1;evAdd(A,now,'w',1);}
      else{A.rating=Math.max(0,A.rating-12);A.coins+=2;}
      A.opps=null;r.duel={ev:sim.ev,win:sim.win,ma:sim.ma,mb:sim.mb,opp:o,gain:gain};break;}
    case 'answer':{
      const w=evWindows(now,0).find(x=>x.e.id==='quiz');if(!w)return fail('החידון לא פעיל עכשיו');
      const rec=evRec(A,w.key);if(rec.t)return fail('כבר ענית על השאלה');
      rec.t=1;r.correct=int(args.a,-1,9)===quizFor(w.key).c;if(r.correct)rec.q=1;break;}
    case 'claimEvent':{
      const w=evWindows(now,10).find(x=>x.e.id===String(args.id)&&x.e.obj);if(!w)return fail('האירוע לא פעיל');
      const rec=evRec(A,w.key),e=w.e;if(rec.c)return fail('הפרס כבר נאסף');if((rec[e.obj[0]]||0)<e.obj[1])return fail('המשימה לא הושלמה');
      rec.c=1;if(e.rw.lv){let xp=0;for(let l=S.lvl;l<Math.min(CAP,S.lvl+e.rw.lv);l++)xp+=need(l);r.levels=addXp(S,xp);}
      give(A,S,e.rw);r.rt=e.rt;break;}
    default:return fail('פעולה לא מוכרת');
  }
  A.maxLvl=Math.max(A.maxLvl||1,S.lvl);
  return r;
}

export {STAT_MAX,PARTY_SHARE,LOGIN_RW,AURAS,cleanAuras,partyXp,GUILD_FEE,SECRET_Q,siegeInfo,FLOORS,floorMin,zs,canFloor,afkFloor,EVENTS,QUIZ,localMin,evWindows,evMods,evNext,quizFor,BASEZ,canEnter,PARTY_XP,setEnv,CAP,ZONES,MHP,ZSPR,CLS,STATN,RAR,TIERN,WINGN,AFF,POOL,SLOTS,SLOTN,SETN,SETB,rslot,isSet,setCounts,UPCH,clamp,need,pois,tzParts,dayKey,seasonKey,AFK,SHARED,newAccount,newChar,bind,ensureDay,itemVals,itemName,itemScore,calc,zoneInfo,afkZone,autoAlloc,addXp,rollAff,makeItem,rollRar,sellVal,stash,gainItem,rollLoot,offline,canReset,resetGain,doReset,upCost,upChance,upgrade,openBox,passReward,passLevel,TASKS,fighter,simDuel,BOSSN,GOLD_SHOP,RESET_SHOP,SEASON_SHOP,totalResets,slotsOpen,anyEq,QUESTS,give,numOr,int,gearOr,cleanPlayer,cleanItem,adopt,findIt,maxKps,BOTN,buildOpps,apply,BAG,MATK,SKLV,SKCD,DROPS,ARM};

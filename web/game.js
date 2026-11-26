import * as G from './core.js';
const BUILD='20261126164912';
const {RESPEC_COST,WEEKLY,SIDEQ,pickOf,reqOf,canWear,WING_MAX,wingFeathers,wingChance,DUEL_LIVE,PASS_MAX,PASS_STEP,PASS_DAY,tierOf,REGION,KEY_SHARDS,KEY_GOLD,KEEP_GATE,KEEP_HP,keepOpen,PACKS,PREM_SHOP,TIER_MIN,evTier,tierRange,tierReward,isFull,STAT_MAX,PARTY_SHARE,LOGIN_RW,AURAS,partyXp,GUILD_FEE,SECRET_Q,siegeInfo,FLOORS,floorMin,zs,canFloor,afkFloor,EVENTS,QUIZ,localMin,evWindows,evMods,evNext,quizFor,BASEZ,canEnter,PARTY_XP,setEnv,CAP,ZONES,MHP,ZSPR,CLS,STATN,RAR,TIERN,WINGN,AFF,POOL,SLOTS,SLOTN,SETN,SETB,rslot,isSet,setCounts,UPCH,clamp,need,pois,tzParts,dayKey,seasonKey,AFK,SHARED,newAccount,newChar,bind,ensureDay,itemVals,itemName,itemScore,calc,zoneInfo,afkZone,autoAlloc,addXp,rollAff,makeItem,rollRar,sellVal,stash,gainItem,rollLoot,offline,canReset,resetGain,doReset,upCost,upChance,upgrade,openBox,passReward,passLevel,TASKS,fighter,simDuel,BOSSN,GOLD_SHOP,RESET_SHOP,SEASON_SHOP,totalResets,slotsOpen,anyEq,QUESTS,give,numOr,int,gearOr,cleanPlayer,cleanItem,adopt,findIt,maxKps,BOTN,buildOpps,apply,BAG,MATK,SKLV,SKCD,DROPS,ARM}=G;
const CFG=window.EC_CONFIG||{},ONLINE=!!CFG.url;


/* ---------- state, storage, server ---------- */
const KEY='eternal-cycle-v2',PKEY='eternal-cycle-prefs';
let A=null,S=null,C=null,statsDirty=true,panelDirty=true,tab='char',demo=false,busy=false,localDirty=false;
let prefs={mute:false};try{Object.assign(prefs,JSON.parse(localStorage.getItem(PKEY)||'{}'));}catch(e){}
const savePrefs=()=>{try{localStorage.setItem(PKEY,JSON.stringify(prefs));}catch(e){}};
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
let session=null,chain=Promise.resolve(),players=[],market=[],party={code:'',members:[]},partyN=0,auras=[];
// Online accounts: username + password. After sign-in the server hands back a signed session token kept in this browser.
const SKEY='eternal-cycle-session';
function initServer(){
  if(window.EC_MOCK){session={token:'mock',user:'mock'};return;}
  try{const o=JSON.parse(localStorage.getItem(SKEY)||'null');if(o&&o.token)session=o;}catch(e){}
}
function setSession(o){session=o;try{if(o)localStorage.setItem(SKEY,JSON.stringify(o));else localStorage.removeItem(SKEY);}catch(e){}}
async function post(body,token){
  const h={'Content-Type':'application/json'};if(CFG.anon)h.apikey=CFG.anon;if(token)h['x-ec-token']=token;
  const res=await fetch(CFG.url+'/functions/v1/act',{method:'POST',headers:h,body:JSON.stringify(body)});
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
  const run=async()=>{
    if(!ONLINE){const r=apply(A,kind,args,{});S=A.chars[A.cur]||S;touch();localDirty=true;return r;}
    const j=await rpc(kind,args);
    if(j.state)setState(j.state);if(j.players)players=j.players;if(j.market){market=j.market;panelDirty=true;}if(j.party){party=j.party;panelDirty=true;}if(j.guild){guild=j.guild;panelDirty=true;}if(j.top){topList=j.top;panelDirty=true;}if(j.banned)showBanned(j.result&&j.result.msg);
    setNet(true);return j.result||{ok:false,msg:j.error||''};
  };
  const p=chain.then(run);chain=p.catch(()=>{});
  return p.catch(()=>{setNet(false);return {ok:false,msg:'net'};});
}
const pend={kills:0,casts:0,boss:false,t:0};
function flushTick(){
  if(!ONLINE||demo||!S)return Promise.resolve();
  if(!pend.kills&&!pend.casts&&!pend.boss&&!(party.code&&SC.zi>=0))return chain; // in a party, keep checking in: that is how shared experience arrives
  const a={z:SC.zi,f:SC.fl,kills:pend.kills,casts:pend.casts,boss:pend.boss,ev:SC.ev?1:0},l0=S.lvl;pend.kills=0;pend.casts=0;pend.boss=false;pend.t=0;
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
function lookOf(s){const g=it=>it?[it.t,it.r,it.p,it.season?1:0,it.ex?(isFull(it)?2:1):0]:null,o={c:s.cls,w:g(s.eq.w),ar:g(s.eq.a),g:g(s.eq.g),sp:armorPlus(s),r:A&&A.chars&&A.chars.includes(s)?totalResets(A):s.resets|0};
  const sc=setCounts(s);let bz=-1,bn=0;for(const z in sc)if(sc[z]>bn){bn=sc[z];bz=+z;}if(bn>=4)o.set=[bn,TCOL[clamp(bz,0,11)]];return o;}
function glowAmt(p,r,t){let g=p>=13?24:p>=11?16+5*Math.sin(t*6):p>=9?12:p>=7?7:0;if(r>=3)g=Math.max(g,6);return g;}
function gearColor(g,t,fallback){if(!g)return fallback;if(g[2]>=15)return 'hsl('+((t*90)%360)+',95%,68%)';return RAR[g[1]].c;}
const WPAL={1:['#2f7a45','#b6ef86'],2:['#2260c9','#a8e8ff'],3:['#c42d18','#ffbe55'],4:['#caa02e','#fff8d2'],5:['#35106b','#d596ff'],6:['#1b6ea8','#effcff'],7:['#a8740a','#fff1a8'],8:['#ff4fa3','#7df9ff'],s:['#a637ee','#62f3e2']};
const SPR={"mh":{"w":128,"h":69,"ax":28,"ay":69,"bh":52,"a":{"idle":[0,8],"run":[1,8],"atk":[2,6],"atk2":[3,6],"hit":[4,4],"die":[5,6]}},"ew":{"w":94,"h":69,"ax":26,"ay":69,"bh":58,"a":{"idle":[0,8],"run":[1,8],"atk":[2,8],"hit":[3,4],"die":[4,5]}},"hu":{"w":91,"h":66,"ax":42,"ay":66,"bh":42,"a":{"idle":[0,8],"run":[1,8],"atk":[2,7],"atk2":[3,5],"hit":[4,3],"die":[5,8]}},"mush":{"w":71,"h":45,"ax":32,"ay":45,"bh":37,"a":{"idle":[0,4],"run":[1,8],"atk":[2,8],"hit":[3,4],"die":[4,4]}},"gob":{"w":88,"h":46,"ax":44,"ay":46,"bh":36,"a":{"idle":[0,4],"run":[1,8],"atk":[2,8],"hit":[3,4],"die":[4,4]}},"skel":{"w":98,"h":59,"ax":32,"ay":57,"bh":51,"a":{"idle":[0,4],"run":[1,4],"atk":[2,8],"hit":[3,4],"die":[4,4]}},"eye":{"w":56,"h":41,"ax":27,"ay":33,"bh":33,"a":{"idle":[0,8],"atk":[1,8],"hit":[2,4],"die":[3,4]}},"worm":{"w":77,"h":54,"ax":30,"ay":54,"bh":45,"a":{"idle":[0,9],"run":[1,9],"atk":[2,16],"hit":[3,3],"die":[4,8]}},"skel_f":{"w":98,"h":59,"ax":32,"ay":57,"bh":51,"a":{"idle":[0,4],"run":[1,4],"atk":[2,8],"hit":[3,4],"die":[4,4]}},"gob_r":{"w":88,"h":46,"ax":44,"ay":46,"bh":36,"a":{"idle":[0,4],"run":[1,8],"atk":[2,8],"hit":[3,4],"die":[4,4]}},"eye_p":{"w":56,"h":41,"ax":27,"ay":33,"bh":33,"a":{"idle":[0,8],"atk":[1,8],"hit":[2,4],"die":[3,4]}},"skel_g":{"w":98,"h":59,"ax":32,"ay":57,"bh":51,"a":{"idle":[0,4],"run":[1,4],"atk":[2,8],"hit":[3,4],"die":[4,4]}},"n_smith":{"w":128,"h":69,"ax":28,"ay":69,"bh":52,"a":{"idle":[0,8]}},"n_merch":{"w":91,"h":66,"ax":42,"ay":66,"bh":42,"a":{"idle":[0,8]}},"n_guard":{"w":94,"h":69,"ax":26,"ay":69,"bh":58,"a":{"idle":[0,8]}},"n_herald":{"w":91,"h":66,"ax":42,"ay":66,"bh":42,"a":{"idle":[0,8]}},"n_arena":{"w":128,"h":69,"ax":28,"ay":69,"bh":52,"a":{"idle":[0,8]}},"mush_d":{"w":71,"h":45,"ax":32,"ay":45,"bh":37,"a":{"idle":[0,4],"run":[1,8],"atk":[2,8],"hit":[3,4],"die":[4,4]}},"worm_i":{"w":77,"h":54,"ax":30,"ay":54,"bh":45,"a":{"idle":[0,9],"run":[1,9],"atk":[2,16],"hit":[3,3],"die":[4,8]}},"gob_g":{"w":88,"h":46,"ax":44,"ay":46,"bh":36,"a":{"idle":[0,4],"run":[1,8],"atk":[2,8],"hit":[3,4],"die":[4,4]}},"skel_d":{"w":98,"h":59,"ax":32,"ay":57,"bh":51,"a":{"idle":[0,4],"run":[1,4],"atk":[2,8],"hit":[3,4],"die":[4,4]}}};
const IMG={},CLSSPR={blade:'mh',storm:'ew',hunter:'hu'};
function loadSprites(){for(const k in SPR){const im=new Image();if(k==='mh'||k==='ew'||k==='hu')im.onload=()=>measureBody(k);im.src='assets/'+k+'.png';IMG[k]=im;}}
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
function spr(key,an,fi,x,y,k,flip,glowC,glowB,alpha,sheet){
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
const WING_AT={blade:[5,.7],storm:[3,.72],hunter:[4,.76]}; // where the wings meet the back: pixels behind the middle, share of body height
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
function drawWings(x,y,g,t,k,flip,cls,bh,mv,anim){
  const R=clamp(g[0]|0,1,WING_MAX),hi=R>8,fam=hi?Math.floor((R-9)/7):0,gr=hi?(R-9)%7:0,T=hi?[3,5,6,2,7,8][fam]:R,c=wctx,at=WING_AT[cls]||WING_AT.blade,f=flip?-1:1;let pal=g[3]?WPAL.s:WPAL[T];
  if(hi&&!g[3]){const h=([8,268,205,172,44,318][fam]+gr*7)%360;pal=['hsl('+h+',88%,'+(34+gr*3)+'%)','hsl('+((h+26)%360)+',100%,'+(72+gr*3)+'%)'];if(fam===5){const hh=(t*90+gr*40)%360;pal=['hsl('+hh+',92%,56%)','hsl('+((hh+150)%360)+',100%,84%)'];}}
  k*=hi?1.06+fam*.035+gr*.012:1;
  if(T===8&&!g[3]&&!hi){const h=(t*70)%360;pal=['hsl('+h+',90%,55%)','hsl('+((h+120)%360)+',95%,80%)'];}
  const flap=Math.sin(t*(mv?7:2.6))*(mv?1.5:1),lean=(mv?.22:0)-(anim>0?anim*.35:0),OX=130,OY=185; // beat faster on the run, trail back, open on a strike
  c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,340,280);
  c.save();c.translate(OX-14,OY-4);c.rotate(-.42+flap*.11+lean*.7);c.scale(.74,.74);c.globalAlpha=.72;wingShape(c,T,pal,t+.4,true);c.restore(); // far wing, behind and higher
  c.save();c.translate(OX,OY);c.rotate(flap*.14+lean);c.globalAlpha=1;wingShape(c,T,pal,t,false);c.restore();
  if(T===4||T>=7){c.save();c.strokeStyle=T===8?pal[1]:'#fff3b0';c.lineWidth=5;c.globalAlpha=.85;c.beginPath();c.ellipse(OX-(at[0]+3)*2,OY-bh*2*(1-at[1])-20,22,6.5,0,0,7);c.stroke();c.restore();}
  const u=k*.5,ax=x-f*at[0]*k,ay=y-bh*k*at[1];
  ctx.save();ctx.translate(Math.round(ax),Math.round(ay));ctx.scale(-f*u,u);ctx.imageSmoothingEnabled=true;
  const gl=Math.max(glowAmt(g[2],g[1],t),hi?14+fam*2+gr:T>=4?6+T:3);ctx.shadowColor=pal[1];ctx.shadowBlur=gl;
  ctx.drawImage(wcv,-OX,-OY);ctx.restore();
  if(hi&&!calm&&Math.random()<.12+fam*.05)SC.parts.push({x:ax-f*(10+Math.random()*60)*k*.5,y:ay-Math.random()*60*k*.5,vx:-f*14,vy:-26,life:.8,c:Math.random()<.3?'#fff':pal[1],s:2+(gr>3?1:0)});
  if(T>=6&&!calm&&Math.random()<.22)SC.parts.push({x:ax-f*(10+Math.random()*50)*k*.5,y:ay-Math.random()*50*k*.5,vx:0,vy:T===6?16:-18,life:.7,c:pal[1],s:2});
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
function armorSheet(key,look){const a=look.ar;if(!a||look.spr||a[0]<3&&a[1]<4)return null;return a[1]===4?tintedSheet(key,look.set?look.set[1]:RAR[4].c,.6):tintedSheet(key,TCOL[clamp(a[0],1,12)-1],.42);}
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
const TCOL=['#9aa3ad','#c9d2dc','#bfe3ff','#e8c27a','#9fe8ff','#ff8a4d','#a487ff','#ffd75e','#b07cff','#8fe6ff','#ffe27a','#ff6b8a'];
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
  }else if(look.c==='storm'){
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
function drawHero(x,y,sc,look,t,anim,flip,dead,mv,fury){
  const key=look.spr||CLSSPR[look.c],m=SPR[key],k=2*sc,cl=CLS[look.c]||CLS.blade;
  const maxP=Math.max(look.w?look.w[2]:0,look.ar?look.ar[2]:0,look.g?look.g[2]:0);
  const gc=fury?'#ffd75e':gearColor(look.w||look.ar||look.g,t,cl.c);
  if((maxP>=11||fury)&&!dead){const gr=ctx.createRadialGradient(0,0,2,0,0,50);gr.addColorStop(0,gc);gr.addColorStop(1,'transparent');
    ctx.save();ctx.translate(x,y);ctx.globalCompositeOperation='lighter';ctx.globalAlpha=.4+.15*Math.sin(t*5);ctx.scale(1,.3);ctx.fillStyle=gr;ctx.beginPath();ctx.arc(0,0,50,0,7);ctx.fill();ctx.restore();}
  ctx.fillStyle='rgba(0,0,0,.35)';ctx.beginPath();ctx.ellipse(x,y+1,20*sc,5*sc,0,0,7);ctx.fill();
  if(look.set&&!dead)drawSetAura(x,y,sc,look.set,t);
  if(!dead&&!look.spr&&petTier(look.r|0))drawPet(x-(flip?-1:1)*38*sc,y-m.bh*k*.92,sc,petTier(look.r|0),t+(look.c==='storm'?1:0),flip);
  let an='idle',fi=Math.floor(t*8);
  if(dead){an='die';fi=Math.min(frames(key,'die')-1,Math.floor((dead===true?9:dead)*8));}
  else if(anim>0){an=look.sk&&m.a.atk2?'atk2':'atk';fi=Math.floor((1-anim)*frames(key,an));}
  else if(mv){an='run';fi=Math.floor(t*12)%frames(key,'run');}
  else fi=fi%frames(key,'idle');
  const bs=look.spr||dead?[0,0]:bodyShift(key,an,fi),bx=x+(flip?-1:1)*bs[0]*k,by=y+bs[1]*k; // the body's place in this frame
  if(look.g&&!dead)drawWings(bx,by,look.g,t,k,flip,look.c,m.bh,mv,anim);
  if(look.w&&!dead&&!look.spr)drawBackWeapon(bx-(flip?-1:1)*7*k,by-m.bh*k*.5,look,t,k,flip);
  let gl=0;if(look.w)gl=Math.max(gl,glowAmt(look.w[2],look.w[1],t));if(look.ar)gl=Math.max(gl,glowAmt(look.ar[2],look.ar[1],t)*.7);if(fury)gl=Math.max(gl,14);
  const sheet=armorSheet(key,look),gt=look.spr||dead?0:glowTier(look.sp),ac=gt?armorGlowColor(look,t,gt):null;
  if(gt)drawArmorAura(key,an,fi,x,y,k,flip,gt,ac,t,m.bh);if(gt>=13)drawOrbit(bx,by,k,m.bh,t,gt,ac,false);
  if(mv&&maxP>=11&&!dead&&!calm)spr(key,an,fi-1,x-(flip?-1:1)*12*sc,y,k,flip,null,0,.28,sheet); // afterimage at +11
  spr(key,an,fi,x,y,k,flip,gt>=7?ac:gc,dead?0:Math.max(anim>0?Math.min(gl,6):gl,gt>=13?12:gt>=9?11:gt>=7?9:0),null,sheet);
  if(gt)drawArmorShine(key,an,fi,x,y,k,flip,gt,t,m.bh);if(gt>=13)drawOrbit(bx,by,k,m.bh,t,gt,ac,true);
  if(look.lu>0&&!dead){const u=look.lu,sil=silhouette(key,'#ffd75e'),w=silhouette(key,'#ffffff'); // level up: the body flares gold for a second
    if(sil&&w){ctx.save();ctx.globalCompositeOperation='lighter';ctx.shadowColor='#ffd75e';ctx.shadowBlur=22;const e=1-u;
      sprFrame(w,key,an,fi,x,y,k,flip,u*u*.3);for(let i=1;i<=3;i++)sprFrame(sil,key,an,fi,x,y,k,flip,u*.32/i,0,-e*i*5,1+(.06+e*.22)*i,1+(.05+e*.2)*i);ctx.restore();}
    if(!calm)for(let n=0;n<2;n++)SC.parts.push({x:x+(Math.random()-.5)*46*sc,y:y-Math.random()*m.bh*k,vx:(Math.random()-.5)*30,vy:-90-Math.random()*70,life:.6,c:Math.random()<.4?'#fff':'#ffd75e',s:2+Math.random()*2});}
  if(maxP>=13&&!dead&&!calm&&Math.random()<.35)SC.parts.push({x:x+(Math.random()-.5)*44*sc,y:y-Math.random()*m.bh*k,vx:0,vy:-20,life:.8,c:gc,s:2});
}
function drawMon(m,zi,t,flip,sc){
  const z=ZONES[zi],key=z.spr,sm=SPR[key],fl=SC.mode==='farm'&&!SC.ev?SC.fl:0,fc=fl===2?'#b46bff':fl===1?'#ff9a4a':null,sheet=z.tint?tintedSheet(key,z.tint,.55):null,k=(m.boss?3.6:2)*sc*(1+fl*.08),lift=z.fly?(26+Math.sin(t*3+m.ph)*5)*sc*(m.boss?1.6:1):0,y=m.y-lift;
  ctx.fillStyle='rgba(0,0,0,.35)';ctx.beginPath();ctx.ellipse(m.x,m.y+1,(m.boss?36:18)*sc,(m.boss?8:4)*sc,0,0,7);ctx.fill();
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
    ctx.lineTo(W+8,g0);ctx.fill();}
  ctx.globalAlpha=1;
  const gg=ctx.createLinearGradient(0,g0,0,H);gg.addColorStop(0,z.sil);gg.addColorStop(1,'#050409');ctx.fillStyle=gg;ctx.fillRect(0,g0-1,W,H-g0+1);
  if(SC.fl>0&&zi>=0){ctx.fillStyle='rgba(0,0,0,'+(.16*SC.fl)+')';ctx.fillRect(0,0,W,H);}
  ctx.strokeStyle='rgba(255,255,255,.07)';ctx.lineWidth=1;for(let x=-(SC.cam%60);x<W;x+=60){ctx.beginPath();ctx.moveTo(x,g0+6);ctx.lineTo(x+22,g0+6);ctx.stroke();}
  ctx.fillStyle=z.amb;
  for(const a of amb){a.y-=a.v*.016*(zi===4?-1.5:1);if(a.y<0)a.y=1;if(a.y>1)a.y=0;ctx.globalAlpha=.25+.35*Math.abs(Math.sin(t*2+a.x*20));ctx.beginPath();ctx.arc(a.x*W+Math.sin(t+a.y*9)*6,a.y*g0,a.s,0,7);ctx.fill();}
  ctx.globalAlpha=1;
}
function label(txt,x,y,c,size){ctx.font='700 '+(size||12)+'px Assistant,Arial';ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='rgba(0,0,0,.75)';ctx.strokeText(txt,x,y);ctx.fillStyle=c||'#fff';ctx.fillText(txt,x,y);}
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
function attackFx(cls,hx,hy,face,targets,combo,c){
  for(const tg of targets){
    if(cls==='blade')SC.fx.push({k:'slash',x:tg.x-6*face,y:tg.y-28,rot:Math.random()*1.2-.6+(face<0?3.14:0),life:.22,c:c,big:combo});
    else if(cls==='storm'){if(combo){const pts=[];let px=tg.x+(Math.random()-.5)*30,py=0;while(py<tg.y-20){pts.push([px,py]);px+=(Math.random()-.5)*26;py+=18;}pts.push([tg.x,tg.y-24]);SC.fx.push({k:'bolt',pts:pts,life:.28,c:c});}
      else SC.fx.push({k:'line',x1:hx+16*face,y1:hy-96,x2:tg.x,y2:tg.y-26,life:.16,c:c,w:4});}
    else{if(combo){for(let i=0;i<4;i++)SC.fx.push({k:'line',x1:tg.x-60+i*14+Math.random()*10,y1:-10,x2:tg.x-10+i*6,y2:tg.y-18,life:.2+i*.04,c:c,w:2});}
      else SC.fx.push({k:'line',x1:hx+18*face,y1:hy-58,x2:tg.x,y2:tg.y-26,life:.14,c:c,w:2});}
    burst(tg.x,tg.y-26,c,combo?12:5);
    SC.fx.push({k:'flash',x:tg.x,y:tg.y-26,r:combo?44:22,life:.2,d:.2,c:c});if(combo&&!calm)SC.fx.push({k:'star',x:tg.x,y:tg.y-28,r:26,rot:Math.random()*3,life:.28,d:.28,c:c});
  }
  if(combo){SC.fx.push({k:'ring',x:targets[0]?targets[0].x:hx,y:hy-20,life:.4,c:c});if(!calm)SC.shake=.25;}
}
function drawFx(dt){
  ctx.save();ctx.globalCompositeOperation='lighter';
  SC.fx=SC.fx.filter(f=>(f.life-=dt)>0);if(SC.fx.length>150)SC.fx.splice(0,SC.fx.length-150);
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
    else if(f.k==='line'){ctx.globalAlpha=clamp(f.life/.15,0,1);ctx.lineCap='round';ctx.lineWidth=f.w+1;ctx.beginPath();ctx.moveTo(f.x1,f.y1);ctx.lineTo(f.x2,f.y2);ctx.stroke();ctx.strokeStyle='#fff';ctx.lineWidth=Math.max(1,f.w*.4);ctx.beginPath();ctx.moveTo(f.x1+(f.x2-f.x1)*.45,f.y1+(f.y2-f.y1)*.45);ctx.lineTo(f.x2,f.y2);ctx.stroke();}
    else if(f.k==='bolt'){ctx.globalAlpha=clamp(f.life/.2,0,1);for(const [w,col] of [[5,f.c],[1.6,'#fff']]){ctx.strokeStyle=col;ctx.lineWidth=w;ctx.beginPath();f.pts.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.stroke();}ctx.strokeStyle=f.c;ctx.lineWidth=1.5;ctx.beginPath();f.pts.forEach((p,i)=>{if(i&&i%3===0){ctx.moveTo(p[0],p[1]);ctx.lineTo(p[0]+((i*37)%40-20),p[1]+22);}});ctx.stroke();}
    else if(f.k==='ring'){const a=Math.min(1,f.life/.4),R=f.r||90;ctx.globalAlpha=a;ctx.lineWidth=4*a+1;ctx.beginPath();ctx.ellipse(f.x,f.y,(1-a)*R+10,((1-a)*R+10)*.35,0,0,7);ctx.stroke();}
    else if(f.k==='beam'){const a=clamp(f.life/1.2,0,1);ctx.globalAlpha=a*.8;const g=ctx.createLinearGradient(0,0,0,f.y);g.addColorStop(0,'transparent');g.addColorStop(1,f.c);ctx.fillStyle=g;ctx.fillRect(f.x-7,0,14,f.y);}
    else if(f.k==='lvl'){const a=f.life/.9;ctx.globalAlpha=a;ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(f.x,f.y-(1-a)*80,30,9,0,0,7);ctx.stroke();}
  }
  ctx.shadowBlur=0;
  SC.parts=SC.parts.filter(p=>(p.life-=dt)>0);if(SC.parts.length>260)SC.parts.splice(0,SC.parts.length-260);
  for(const p of SC.parts){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=160*dt;ctx.globalAlpha=clamp(p.life*2,0,1);ctx.fillStyle=p.c;ctx.fillRect(p.x,p.y,p.s,p.s);}
  // loot orbs fly to the hero
  const h=SC.hero;SC.drops=SC.drops.filter(d=>d.life>0);
  for(const d of SC.drops){d.life-=dt;d.age+=dt;if(d.age<.45+(d.lie||0)){if(d.age>.45){d.vx=0;}d.x+=d.vx*dt;d.y+=d.vy*dt;d.vy+=500*dt;if(d.y>gy()-6){d.y=gy()-6;d.vy=0;d.vx=0;}}
    else{const dx=h.x-d.x,dy=gy()-45-d.y,dist=Math.hypot(dx,dy);if(dist<16){d.life=0;continue;}const v=Math.min(dist,520*dt*(1+d.age));d.x+=dx/dist*v;d.y+=dy/dist*v;}
    ctx.globalAlpha=d.left?clamp(d.life,0,.55):1;ctx.fillStyle=d.c;ctx.shadowColor=d.c;ctx.shadowBlur=10;ctx.beginPath();ctx.arc(d.x,d.y,d.s,0,7);ctx.fill();
    if(d.txt&&d.age>.3&&d.age<.45+(d.lie||0)+.15){ctx.shadowBlur=0;ctx.font='700 10.5px system-ui';ctx.textAlign='center';const tw=ctx.measureText(d.txt).width+8;ctx.fillStyle='rgba(8,6,20,.72)';ctx.fillRect(d.x-tw/2,d.y-22-(d.row||0)*13,tw,12.5);ctx.fillStyle=d.left?'#8d87a8':d.c;ctx.fillText(d.txt,d.x,d.y-12.5-(d.row||0)*13);}}
  ctx.restore();
  SC.nums=SC.nums.filter(n=>(n.life-=dt)>0);ctx.textAlign='center';
  for(const n of SC.nums){n.y-=38*dt;ctx.globalAlpha=clamp(n.life*2.2,0,1);ctx.font='800 '+n.s+'px Assistant,Arial';ctx.lineWidth=3;ctx.strokeStyle='rgba(0,0,0,.75)';ctx.strokeText(n.txt,n.x,n.y);ctx.fillStyle=n.c;ctx.fillText(n.txt,n.x,n.y);}
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
  const h=SC.hero;SC.ev=!!ev;SC.zi=z;SC.fl=z<0?0:clamp(f|0,0,FLOORS-1);SC.mons=[];SC.boss=null;SC.drops=[];SC.fx=[];SC.nums=[];SC.parts=[];h.tgt=null;h.goal=null;h.tx=null;h.manual=0;
  h.x=side==='R'?mapW()-110:110;h.face=side==='R'?-1:1;
  if(h.climb&&h.climb.ph==='wait'){h.climb.ph='in';h.climb.t=.45;h.x=side==='R'?mapW()-50:50;}else h.climb=null;
  if(z>=0){const n=ev?22:8,gap=ev?52:140;for(let i=0;i<n;i++)SC.mons.push(newMon((ev?240:300)+i*gap+Math.random()*(ev?30:50),z));}
  h.up=0;h.lift=0;if(hasDeck(z))for(const i of [2,3,4]){const m=SC.mons[i];m.up=1;m.home=clamp(m.home,DECK.x0+50,DECK.x1-50);m.x=m.home;}
  if(z<0&&ONLINE&&!demo)loadMarket();
  if(z<0||z!==S.zone){auras=[];partyN=0;}statsDirty=true;panelDirty=true;syncBoss();peers=[];beatT=99;
}
function spawnBoss(){
  const zi=SC.zi,z=ZONES[zi];if(SC.boss||zi<0)return;
  const b=newMon(MW-280,zi);b.boss=true;b.hp=b.max=zs(zi,SC.fl).hp*30;b.slamT=4;b.wind=0;SC.boss=b;SC.mons.push(b);snd('boss');toast('הבוס של '+z.n+' הופיע בקצה המפה');
}
function dropOrbs(m,rep){
  const add=(c,s)=>SC.drops.push({x:m.x,y:m.y-24,vx:(Math.random()-.5)*160,vy:-160-Math.random()*90,c:c,s:s,age:0,life:4});
  snd(rep.notable?'rare':'kill');if(!rep.notable&&(rep.items||rep.gems))snd('coin');
  add('#f2c14e',3);if(rep.gems)add('#5fd4ff',4);if(rep.boxes)add('#ff6b3d',5);
  { // what fell lies on the ground for a moment with its name, then the character picks up what it was told to
    let row=0;const lay=(txt,c,left)=>{if(SC.drops.length>70)return;SC.drops.push({x:m.x+(Math.random()-.5)*90,y:m.y-24,vx:(Math.random()-.5)*120,vy:-170-Math.random()*60,c:c,s:left?3:4.5,age:0,life:left?4.5:5,lie:left?4:1.5+row*.12,txt:txt,left:left,row:row%3});row++;};
    if(rep.gold>0)lay(fmt(rep.gold)+' זהב','#f2c14e',false);if(rep.gems>0)lay(rep.gems+' אבני נשמה','#5fd4ff',false);if(rep.shards>0)lay(rep.shards+' שברי ארגמן','#ff5c7a',false);if(rep.feather)lay('נוצת נצח','#ffd75e',false);
    if(rep.names)for(const n of rep.names)lay(n[0],n[1]>=5?'#7dffb0':RAR[n[1]].c,!!n[2]);}
  if(rep.notable)for(const it of rep.notable){add(RAR[it.r].c,5.5);SC.fx.push({k:'beam',x:m.x,y:m.y,life:1.2,c:RAR[it.r].c});toast((it.ex?'':RAR[it.r].n+': ')+itemName(it,S.cls),it.ex?4:it.r);}
  if(rep.jewel)toast('אבן שלמות נפלה מהבוס',4);
  if(rep.shards&&(A.shards||0)>=KEY_SHARDS&&(A.shards||0)-rep.shards<KEY_SHARDS)toast('יש לך מספיק שברים למפתח מצודה',3);
  else if(rep.items)add('#b9b4c7',4);
}
function afterXp(ups){
  if(!(ups>0))return;snd('lvl');statsDirty=true;panelDirty=true;const h=SC.hero;
  h.luAt=SC.t;SC.fx.push({k:'lvl',x:h.x,y:gy(),life:.9,c:'#f2c14e'});SC.fx.push({k:'rune',x:h.x,y:gy()-2,r:64,life:1,d:1,c:'#ffd75e'});SC.fx.push({k:'pillar',x:h.x,y:gy(),life:.7,d:.7,c:'#ffd75e'});addNum(h.x,gy()-120,'רמה '+S.lvl,'#f2c14e',true);
  for(let i=0;i<6;i++)if(S.lvl>=SKLV[i]&&S.lvl-ups<SKLV[i]&&i>0)toast('כישור חדש: '+CLS[S.cls].sk[i]);
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
  if(!r||!r.ok){bossPending=false;if(r&&r.msg&&r.msg!=='net')send('sync',{}).then(()=>syncBoss());return;}
  if(r.afk)showOffline(r.afk);
  if(r.evOver&&SC.ev){leaveKeep(true);return;}
  if(r.sqNew){const d=SIDEQ[r.sqNew.i];snd('portal');announce('משימת צד: '+d.t+' · '+d.d(r.sqNew.n),true);panelDirty=true;}if(r.sqDone){snd('rare');announce('משימת הצד הושלמה. אסוף את הפרס בלשונית אירועים',true);panelDirty=true;}if(r.sqLost)toast('משימת הצד פגה');
  const rep=r.rep||{},src=m||{x:SC.hero.x+SC.hero.face*26,y:gy()};
  if(!ONLINE||rep.items||rep.gems||rep.boxes||rep.notable)dropOrbs(src,rep);
  if(rep.items||rep.boxes)panelDirty=true;
  if(rep.boss||rep.bossDenied){bossPending=false;if(rep.opened!=null)toast('השער אל '+ZONES[rep.opened].n+' נפתח');if(rep.bossDenied)toast('השרת לא אישר את הניצחון על הבוס');}
  if(r.shared>0)addNum(SC.hero.x,gy()-150,'+'+fmt(r.shared)+' ניסיון מהפארטי','#8be28b',true);
  if(r.partyN!=null)partyN=r.partyN;if(r.auras&&r.auras.join()!==auras.join()){auras=r.auras;statsDirty=true;panelDirty=true;}
  if(S.lvl>l0)afterXp(S.lvl-l0);
  statsDirty=true;syncBoss();
}
function onKill(m,zi){
  const z=ZONES[zi];
  if(demo){burst(m.x,m.y-24,z.c,10);if(m.boss)SC.boss=null;return;}
  if(m.boss){snd('bossdie');
    SC.boss=null;bossPending=true;burst(m.x,m.y-40,'#f2c14e',40);if(!calm)SC.shake=.4;addNum(m.x,m.y-150,'הבוס הובס!','#f2c14e',true);
    if(ONLINE){pend.boss=true;flushTick();}else{const l0=S.lvl;afterTick(localTick({z:zi,kills:0,boss:true}),m,l0);}
    return;
  }
  burst(m.x,m.y-24,z.c,10);
  if(ONLINE){ // predict XP now; loot and the real numbers arrive with the next server tick
    pend.kills++;snd('kill');SC.drops.push({x:m.x,y:m.y-24,vx:(Math.random()-.5)*160,vy:-200,c:'#f2c14e',s:3,age:0,life:4});
    const l0=S.lvl;addXp(S,zs(zi,SC.fl).xp*C.xpM);afterXp(S.lvl-l0);if(pend.kills>=25)flushTick();
  }else{const l0=S.lvl;afterTick(localTick({z:zi,kills:1}),m,l0);}
}
async function travelTo(z,side,f){
  if(busy){SC.hero.climb=null;return;}busy=true;const r=await act('travel',{z:z,f:f|0});busy=false;
  if(!r.ok){SC.hero.climb=null;toast(r.msg==='net'?'אין חיבור לשרת':r.msg);return;}
  snd('portal');enterZone(z,side,f|0);saveLocal();
}
function strike(m,mult,col,big){
  const crit=Math.random()<C.crit,d=Math.round(C.dmg*(crit?C.cdmg:1)*mult*(.9+Math.random()*.2));
  snd(crit?'crit':'hit');m.hp-=d;m.hit=1;m.ag=true;addNum(m.x,m.y-(m.boss?130:60),fmt(d),crit?'#ffd75e':big?col:'#fff',crit||big);
  if(m.hp<=0&&m.die<=0){m.die=.45;m.dead=true;onKill(m,SC.zi);}
}
const alive=()=>SC.mons.filter(m=>m.die<=0&&m.resp<=0);
// Every ordinary hit also reaches monsters near the target: the blade cleaves, lightning chains, the spear goes through.
// More of them with level (one from 30, two from 120, three from 250, four from 350), each for 60% of the hit.
const splashN=l=>l>=350?4:l>=250?3:l>=120?2:l>=30?1:0;
function splash(m,col){
  const n=splashN(S.lvl);if(!n||m.boss)return;const h=SC.hero,cls=S.cls,R=cls==='blade'?80:cls==='storm'?130:170;
  const near=alive().filter(o=>o!==m&&!o.boss&&(cls==='hunter'?(o.x-m.x)*h.face>0&&Math.abs(o.x-m.x)<R:Math.abs(o.x-m.x)<R)).sort((a,b)=>Math.abs(a.x-m.x)-Math.abs(b.x-m.x)).slice(0,n);
  let px=m.x;for(const o of near){
    if(cls==='storm')SC.fx.push({k:'bolt',pts:[[px,m.y-28],[(px+o.x)/2+(Math.random()-.5)*14,m.y-40-Math.random()*14],[o.x,o.y-26]],life:.2,c:col});
    else if(cls==='hunter')SC.fx.push({k:'line',x1:px,y1:m.y-26,x2:o.x,y2:o.y-26,life:.14,c:col,w:2});
    else SC.fx.push({k:'slash',x:o.x-6*h.face,y:o.y-28,rot:Math.random()*1.2-.6+(h.face<0?3.14:0),life:.2,c:col});
    SC.fx.push({k:'flash',x:o.x,y:o.y-26,r:16,life:.16,d:.16,c:col});px=o.x;strike(o,.6,col,false);}
}
function cast(i,auto){
  const h=SC.hero;if(SC.mode!=='farm'||SC.zi<0||h.dead>0||h.climb||S.lvl<SKLV[i]||h.cds[i]>0)return false;
  const col=gearColor(lookOf(S).w,SC.t,CLS[S.cls].c),melee=S.cls==='blade';
  if(i===0){const cx=melee||!h.tgt?h.x+(melee?0:h.face*120):h.tgt.x,R=melee?135:120,ts=alive().filter(m=>Math.abs(m.x-cx)<R*(m.boss?1.4:1));
    if(!ts.length&&auto)return false;snd('skill');h.anim=1;h.skA=.3;attackFx(S.cls,h.x,hY(),h.face,ts,true,col);SC.fx.push({k:'rune',x:h.x,y:gy()-2,r:70,life:.6,d:.6,c:col});if(melee)for(const d of [-1,1])SC.fx.push({k:'wave',x:h.x+d*20,y:gy(),dir:d,dist:120,h:70,life:.32,d:.32,c:col});if(!ts.length)SC.fx.push({k:'ring',x:cx,y:gy()-20,life:.4,c:col});
    SC.nums.push({x:h.x,y:gy()-135,txt:CLS[S.cls].sk[0]+'!',c:col,s:18,life:1});for(const m of ts)strike(m,3,col,true);}
  else if(i===1){snd('pull');for(const m of alive()){if(m.boss||Math.abs(m.x-h.x)>380)continue;m.pull=h.x+(m.x>h.x?1:-1)*(34+Math.random()*44);m.stun=1.8;m.ag=true;}
    SC.fx.push({k:'ring',x:h.x,y:gy()-20,life:.4,c:'#5fd4ff',r:300});SC.fx.push({k:'rune',x:h.x,y:gy()-2,r:150,life:.7,d:.7,c:'#5fd4ff'});SC.nums.push({x:h.x,y:gy()-135,txt:CLS[S.cls].sk[1]+'!',c:'#5fd4ff',s:18,life:1});}
  else if(i===3){const r=CLS[S.cls].range*1.4+40;let m=h.tgt&&h.tgt.die<=0&&!h.tgt.resp?h.tgt:null;
    if(!m){let bd=r;for(const o of alive()){const d=Math.abs(o.x-h.x);if(d<bd){bd=d;m=o;}}}
    if(!m){if(!auto)toast('אין מטרה בטווח');return false;}
    snd('skill');h.face=m.x>=h.x?1:-1;h.anim=1;h.skA=.35;attackFx(S.cls,h.x,hY(),h.face,[m],true,col);burst(m.x,gy()-50,col,26);SC.fx.push({k:'ring',x:m.x,y:gy()-30,life:.35,c:col,r:70});
    SC.fx.push({k:'pillar',x:m.x,y:gy(),life:.45,d:.45,c:col});SC.fx.push({k:'flash',x:m.x,y:gy()-40,r:90,life:.3,d:.3,c:col});SC.fx.push({k:'star',x:m.x,y:gy()-44,r:48,rot:.4,life:.4,d:.4,c:col});SC.fx.push({k:'rune',x:m.x,y:gy()-2,r:60,life:.6,d:.6,c:col});if(melee)SC.fx.push({k:'cres',x:m.x,y:gy()-40,R:52,rot:h.face<0?3.14:0,sp:.9*h.face,life:.3,d:.3,c:col});
    SC.nums.push({x:h.x,y:gy()-135,txt:CLS[S.cls].sk[3]+'!',c:col,s:18,life:1});strike(m,8,col,true);}
  else if(i===4){snd('fury');h.shield=5;h.hp=Math.min(C.hp,h.hp+C.hp*.3);SC.fx.push({k:'ring',x:h.x,y:gy()-40,life:.5,c:'#9fe8ff',r:90});SC.fx.push({k:'rune',x:h.x,y:gy()-2,r:80,life:1,d:1,c:'#9fe8ff'});SC.fx.push({k:'pillar',x:h.x,y:gy(),life:.6,d:.6,c:'#9fe8ff'});burst(h.x,gy()-50,'#9fe8ff',20);
    addNum(h.x,gy()-100,'+'+fmt(C.hp*.3),'#6fe39a',true);SC.nums.push({x:h.x,y:gy()-135,txt:CLS[S.cls].sk[4]+'!',c:'#9fe8ff',s:18,life:1});}
  else if(i===5){const ts=alive().filter(m=>Math.abs(m.x-h.x)<560);if(!ts.length&&auto)return false;
    snd('ult');h.anim=1;h.skA=.5;SC.fx.push({k:'rune',x:h.x,y:gy()-2,r:210,life:1.1,d:1.1,c:col});if(!calm){SC.fx.push({k:'screen',life:.3,d:.3,c:col});SC.shake=.45;}for(const d of [-1,1])SC.fx.push({k:'wave',x:h.x+d*30,y:gy(),dir:d,dist:520,h:110,life:.6,d:.6,c:col});for(let k=0;k<5;k++)SC.fx.push({k:'ring',x:h.x+(k-2)*200,y:gy()-20,life:.35+k*.06,c:col,r:150});
    if(S.cls==='blade')for(let k=0;k<9;k++)SC.fx.push({k:'cres',x:h.x+(k-4)*95+Math.random()*30,y:gy()-30-Math.random()*50,R:40+Math.random()*24,rot:Math.random()*6.28,sp:(Math.random()<.5?-1:1)*1.6,life:.3+k*.05,d:.3+k*.05,c:col});
    else if(S.cls==='storm'){const tg=ts.length?ts:[{x:h.x+h.face*160}];for(let k=0;k<Math.max(7,tg.length);k++){const tx=tg[k%tg.length].x+(k>=tg.length?(Math.random()-.5)*240:0),d=.35+k*.07;SC.fx.push({k:'met',x0:tx+170,y0:-30,x:tx,y:gy()-14,life:d,d:d,c:k%2?'#ff8a4d':col});}}
    else for(let k=0;k<26;k++){const tx=h.x-520+k*40+Math.random()*30;SC.fx.push({k:'line',x1:tx+70,y1:-10,x2:tx,y2:gy()-8,life:.18+k*.02,c:col,w:2});}
    for(const m of ts){burst(m.x,gy()-40,col,14);SC.fx.push({k:'flash',x:m.x,y:gy()-36,r:60,life:.35,d:.35,c:col});strike(m,6,col,true);}
    SC.nums.push({x:h.x,y:gy()-150,txt:CLS[S.cls].sk[5]+'!',c:'#ffd75e',s:21,life:1.2});}
  else{snd('fury');h.buff=8;SC.fx.push({k:'ring',x:h.x,y:gy()-20,life:.4,c:'#ffd75e',r:120});SC.fx.push({k:'rune',x:h.x,y:gy()-2,r:90,life:1,d:1,c:'#ffd75e'});SC.fx.push({k:'pillar',x:h.x,y:gy(),life:.6,d:.6,c:'#ffd75e'});SC.fx.push({k:'star',x:h.x,y:gy()-70,r:40,rot:0,life:.5,d:.5,c:'#ffd75e'});burst(h.x,gy()-50,'#ffd75e',24);SC.nums.push({x:h.x,y:gy()-135,txt:CLS[S.cls].sk[2]+'!',c:'#ffd75e',s:18,life:1});}
  h.cds[i]=SKCD[i];if(!auto)pend.casts++;return true;
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
  for(let i=0;i<6;i++)h.cds[i]=Math.max(0,h.cds[i]-dt);h.shield=Math.max(0,(h.shield||0)-dt);
  h.buff=Math.max(0,h.buff-dt);h.manual=Math.max(0,h.manual-dt);h.autoSk=Math.max(0,h.autoSk-dt);h.anim=Math.max(0,h.anim-dt*4);h.skA=Math.max(0,(h.skA||0)-dt);h.atkT-=dt;h.mv=false;
  // monsters
  for(const m of SC.mons){
    if(m.die>0){m.die-=dt;if(m.die<=0){if(m.boss)m.gone=true;else m.resp=SC.ev?.9:3.5;}continue;}
    if(m.resp>0){m.resp-=dt;if(m.resp<=0){m.hp=m.max;m.x=m.home;m.dead=false;m.stun=0;m.pull=null;m.ag=false;}continue;}
    m.hit=Math.max(0,m.hit-dt*4);m.atkA=Math.max(0,(m.atkA||0)-dt);m.mv=false;
    if(m.pull!=null){m.x+=(m.pull-m.x)*Math.min(1,dt*9);if(Math.abs(m.pull-m.x)<3)m.pull=null;}
    if(m.stun>0){m.stun-=dt;continue;}
    if(m.boss&&m.wind>0){m.wind-=dt;m.atkA=.5*clamp(m.wind/1.2,0,1);if(m.wind<=0){SC.fx.push({k:'ring',x:m.slamX,y:gy()-10,life:.4,c:'#ff5c7a',r:130});if(!calm)SC.shake=.3;snd('slam');
        if(h.dead<=0&&Math.abs(h.x-m.slamX)<125){const d=C.hp*.45*(h.shield>0?.3:1);h.hp-=d;addNum(h.x,gy()-100,'-'+fmt(d),'#ff5c7a',true);}m.slamT=6;}continue;}
    const dx=h.x-m.x,ad=Math.abs(dx),reach=m.boss?70:36;
    if(ad>420)m.ag=false;
    const same=m.boss||(m.up?1:0)===(h.up?1:0);if(!same)m.ag=false;
    if(same&&h.dead<=0&&(m.boss?ad<340:(m.ag||ad<110))){
      if(ad>reach){m.x+=Math.sign(dx)*(m.boss?45:58)*dt;m.mv=true;}
      else if((m.atkT-=dt)<=0){m.atkT=m.boss?1.2:1;m.atkA=.5;const taken=zs(zi,SC.fl).atk*(m.boss?2:1)*300/(300+C.def)*(h.shield>0?.3:1);h.hp-=taken;snd('hurt');addNum(h.x,gy()-100,'-'+fmt(taken),'#ff5c7a');}
      if(m.boss&&(m.slamT-=dt)<=0&&ad<210){m.wind=1.2;m.slamX=m.x;snd('growl');}
    }else if(Math.abs(m.x-m.home)>4){m.x+=Math.sign(m.home-m.x)*40*dt;m.mv=true;m.back=true;}else m.back=false;
    if(m.up)m.x=clamp(m.x,DECK.x0+18,DECK.x1-18);
  }
  SC.mons=SC.mons.filter(m=>!m.gone);
  if(h.dead>0){h.dead-=dt;if(h.dead<=0){h.hp=C.hp;h.x=110;h.up=0;h.lift=0;h.tgt=null;h.tx=null;h.goal=null;}return;}
  if(h.hp<=0){h.dead=3;h.tgt=null;addNum(h.x,gy()-120,'נפלת','#ff5c7a',true);return;}
  h.hp=Math.min(C.hp,h.hp+C.hp*.05*dt);
  // hero
  const live=alive(),range=CLS[S.cls].range,spd=190*(1+(S.eq.g?S.eq.g.t*.08:0))*(h.buff>0?1.5:1);
  if(h.tgt&&(h.tgt.die>0||h.tgt.resp>0||h.tgt.gone))h.tgt=null;
  if(h.dir){h.tgt=null;h.tx=null;h.goal=null;h.manual=.5;h.face=h.dir;h.mv=true;h.x=clamp(h.x+h.dir*spd*dt,30,mw-30);
    const atL=h.dir<0&&h.x<=66&&zi>=0,atR=h.dir>0&&h.x>=mw-66&&!!portalState(1);
    if(atL||atR){h.edgeT=(h.edgeT||0)+dt;if(h.edgeT>.3){h.edgeT=-1.5;arrive({dir:h.dir});SC.cam=clamp(h.x-W*.4,0,Math.max(0,mapW()-W));return;}}else if(h.edgeT>0)h.edgeT=0;
  }
  if(zi>=0&&!h.tgt&&h.manual<=0&&h.tx==null){
    const mel=S.cls==='blade',lv=m=>(m.up?1:0)!==(h.up?1:0);
    if(S.auto){let best=null,bd=1e9;for(const m of live){const d=Math.abs(m.x-h.x)*(m.boss?.5:1)+(mel&&lv(m)?240:0);if(d<bd){bd=d;best=m;}}h.tgt=best;}
    else{for(const m of live)if(Math.abs(m.x-h.x)<=range+(m.boss?40:0)&&!(mel&&lv(m))){h.tgt=m;break;}}
  }
  if(h.tgt&&h.tx==null){const m=h.tgt,dx=m.x-h.x,r=range+(m.boss?40:0),mu=m.up?1:0,hu=h.up?1:0;h.face=dx>=0?1:-1;
    if(S.cls==='blade'&&mu!==hu){ // a blade goes to the nearest ladder to climb, or to the nearest edge to drop
      const a=mu?DECK.x0+16:DECK.x0-14,b=mu?DECK.x1-16:DECK.x1+14,gx=Math.abs(h.x-a)<Math.abs(h.x-b)?a:b,d=gx-h.x;h.face=d>=0?1:-1;
      if(Math.abs(d)>7){h.x+=Math.sign(d)*Math.min(Math.abs(d),spd*dt);h.mv=true;}else if(mu){h.up=1;snd('click');}}
    else if(Math.abs(dx)>r){h.x+=Math.sign(dx)*spd*dt;h.mv=true;}
    else{
      if(S.auto&&h.autoSk<=0&&h.cds[0]<=0&&S.lvl>=SKLV[0]&&cast(0,true))h.autoSk=8;
      if(h.atkT<=0){h.atkT=1/(C.aspd*(h.buff>0?2:1));h.anim=1;h.lastAtk=SC.t;const col=gearColor(lookOf(S).w,SC.t,CLS[S.cls].c);h.chain=SC.t-(h.chainT||0)>2.5?1:(h.chain||0)+1;h.chainT=SC.t;const step=h.chain%4; // the ordinary attack is a four-beat chain: jab, cross, jab, finisher
        if(step===0){attackFx(S.cls,h.x,hY(),h.face,[m],true,col);h.skA=.25;
          if(S.cls==='blade'){SC.fx.push({k:'cres',x:m.x,y:gy()-38,R:50,rot:h.face<0?3.14:0,sp:1.4*h.face,life:.28,d:.28,c:col});SC.fx.push({k:'wave',x:h.x+h.face*20,y:gy(),dir:h.face,dist:150,h:64,life:.3,d:.3,c:col});}
          else if(S.cls==='storm'){SC.fx.push({k:'pillar',x:m.x,y:gy(),life:.35,d:.35,c:col});SC.fx.push({k:'rune',x:m.x,y:gy()-2,r:44,life:.5,d:.5,c:col});}
          else for(let q=-1;q<=1;q++)SC.fx.push({k:'line',x1:h.x+18*h.face,y1:gy()-58+q*10,x2:m.x,y2:m.y-26+q*14,life:.16+Math.abs(q)*.04,c:col,w:2.5});
          strike(m,1.8,col,true);}
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
window.addEventListener('keydown',e=>{if(!SC.duel||e.target&&e.target.tagName==='INPUT')return;if(e.key==='ArrowUp'||e.key==='w'){SC.hero.dz=-1;e.preventDefault();}else if(e.key==='ArrowDown'||e.key==='s'){SC.hero.dz=1;e.preventDefault();}});
window.addEventListener('keyup',e=>{if((e.key==='ArrowUp'||e.key==='w')&&SC.hero.dz<0||(e.key==='ArrowDown'||e.key==='s')&&SC.hero.dz>0)SC.hero.dz=0;});
{const bar=$('duelBar');bar.addEventListener('pointerdown',e=>{const b=e.target.closest('button');if(!b||b.disabled||!SC.duel)return;e.preventDefault();initAudio();if(b.dataset.a==='atk')SC.duel.holdAtk=true;duelAct(b.dataset.a);});
  for(const ev of ['pointerup','pointercancel','pointerleave'])bar.addEventListener(ev,()=>{if(SC.duel)SC.duel.holdAtk=false;});bar.addEventListener('contextmenu',e=>e.preventDefault());
  const DK={' ':'atk','1':'s0','2':'s1','3':'s2','4':'s3','q':'dash','e':'pot','/':'dash'};
  window.addEventListener('keydown',e=>{if(!SC.duel||e.target&&e.target.tagName==='INPUT')return;const k=DK[e.key.toLowerCase()];if(!k)return;e.preventDefault();if(k==='atk')SC.duel.holdAtk=true;duelAct(k);});
  window.addEventListener('keyup',e=>{if(SC.duel&&e.key===' ')SC.duel.holdAtk=false;});}
window.addEventListener('keydown',e=>{if(e.target&&e.target.tagName==='INPUT')return;const k=e.key;if(k==='ArrowLeft'||k==='a')SC.hero.dir=-1;else if(k==='ArrowRight'||k==='d')SC.hero.dir=1;else if(k>='1'&&k<='6'&&S&&!demo)cast(+k-1,false);});
window.addEventListener('keyup',e=>{const k=e.key;if((k==='ArrowLeft'||k==='a')&&SC.hero.dir<0||(k==='ArrowRight'||k==='d')&&SC.hero.dir>0)SC.hero.dir=0;});
window.addEventListener('blur',()=>{SC.hero.dir=0;});
cv.addEventListener('pointerdown',e=>{
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
  for(const m of SC.mons){if(m.resp>0)continue;m.y=g0-(m.up?deckH():0);
    if(m.boss&&m.wind>0){ctx.save();ctx.globalAlpha=.25+.3*(1-m.wind/1.2);ctx.fillStyle='#ff5c7a';ctx.beginPath();ctx.ellipse(m.slamX,g0,125,16,0,0,7);ctx.fill();ctx.restore();}
    drawMon(m,zi,SC.t,m.back?m.home<m.x:h.x<m.x,sc);}
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
  if(SC.boss){hpBar(W*.2,92,W*.6,SC.boss.hp/SC.boss.max,'#ff5c7a','בוס: '+monName(zi,SC.ev?0:SC.fl));}
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
function sideCard(){
  const q=A.sq;if(!q)return '<h2>משימת צד</h2><p class="hint">אין כרגע. משימות צד צצות מדי פעם תוך כדי לחימה במפות, מרמה 20.</p>';
  const d=SIDEQ[q.i],left=Math.max(0,(q.until-Date.now())/1000);
  return '<h2>משימת צד</h2><div class="card shop task"><div class="z"><b>'+d.t+' · '+zoneName(q.z)+'</b><div class="bar'+(q.done?' gold':'')+'"><i style="width:'+Math.round(q.have/q.n*100)+'%"></i></div><small>'+d.d(q.n)+' · '+L(q.have+'/'+q.n)+(q.done?'':' · נשארו '+L(mmss(left)))+'</small></div>'+
    (q.done?'<button class="btn sm pri glow" data-act="sqClaim">אסוף</button>':'<button class="btn sm" data-act="sqDrop">ותר</button>')+'</div>';
}
// Hidden finds: the client notices the moment, the server decides whether it counts and pays once.
const egg={moon:0,still:0,tried:{}};
async function tryEgg(k){if(!S||demo||egg.tried[k]||(A.eggs&&A.eggs[k]))return;egg.tried[k]=1;const r=await send('egg',{k:k});if(r&&r.ok){snd('rare');announce('\u2726 '+r.t,true);toast('מצאת סוד נסתר ('+r.found+'/5)',4);}}
/* ---------- the arena: a live duel. You walk, strike, cast, guard, dash and drink; nothing happens by itself. ---------- */
const DRNG={blade:62,storm:185,hunter:235},DLANE=.3; // the arena has depth: a blow lands only on someone standing in about the same lane
const dy=f=>gy()-(1-f.z)*84,dsc=f=>.8+f.z*.2;
const DBTN=['atk','s0','s1','s3','s2','dash','pot'];
function startDuel(pd){
  const o=pd.o,L=pd.live,mk=(x,cls,i)=>({x:x,z:.5,hp:1,face:i?-1:1,atkT:.4,cd:{s0:1,s1:2,s2:0,s3:6,dash:0,pot:0},stun:0,sh:0,inv:0,pots:DUEL_LIVE.pots,anim:0,mv:false,cls:cls,chain:0,hitT:0});
  SC.duel={opp:o,L:L,f:[mk(W*.24,S.cls,0),mk(W*.76,o.c,1)],t:0,end:0,win:null,gain:0,sent:false,ai:{t:.6,threat:0},holdAtk:false,go:1.2};
  SC.mode='duel';SC.fx=[];SC.nums=[];SC.drops=[];SC.hero.dir=0;SC.hero.dz=0;renderDuelBar();
}
function renderDuelBar(){
  const d=SC.duel,bar=$('duelBar');if(!d){bar.style.display='none';return;}bar.style.display='grid';const me=d.f[0],off=d.end>0||d.go>0;
  bar.querySelectorAll('button').forEach((b,i)=>{const k=DBTN[i],cd=k==='atk'?0:me.cd[k],nm=k==='atk'?'תקיפה':k==='dash'?'צעד':k==='pot'?'שיקוי ×'+me.pots:CLS[S.cls].sk[k==='s0'?0:k==='s1'?3:k==='s2'?4:5],
    t=nm+'<small>'+(cd>0?Math.ceil(cd)+' שנ׳':k==='pot'&&!me.pots?'נגמר':k==='s2'?'מגן':k==='s3'?'מכה סופית':k==='s1'?'מהמם':k==='dash'?'חמיקה':'&nbsp;')+'</small>';
    if(b.dataset.h!==t){b.dataset.h=t;b.innerHTML=t;}const dis=off||cd>0||(k==='pot'&&!me.pots);if(b.disabled!==dis)b.disabled=dis;b.classList.toggle('rdy',!dis&&k==='s3');});
}
function dHit(d,ai,mult,big,col){ // side ai strikes the other side
  const a=d.f[ai],v=d.f[1-ai],g=dy(v),pool=d.L.pool[1-ai],off=Math.abs(a.z-v.z)>DLANE;a.anim=1;a.face=v.x>=a.x?1:-1;
  attackFx(a.cls,a.x,dy(a),a.face,[{x:v.x,y:(off?dy(a):g)-10}],big,col);
  if(off){addNum(v.x,g-110,'החטיא','#c9c2ea',false);return;}
  if(v.inv>0){addNum(v.x,g-110,'חמק!','#9fe8ff',true);return;}
  const crit=Math.random()<d.L.cr[ai];let dm=d.L.b[ai]*mult*(crit?1.5:1)*(.9+Math.random()*.2);if(v.sh>0){dm*=1-DUEL_LIVE.sk[2].cut;SC.fx.push({k:'ring',x:v.x,y:g-40,life:.3,c:'#9fe8ff',r:50});}
  v.hp-=dm;v.hitT=.18;snd(crit?'crit':big?'skill':'hit');addNum(v.x,g-92,fmt(Math.round(dm*pool)),crit?'#ffd75e':big?col:'#fff',crit||big);if(big&&!calm)SC.shake=.18;
}
function dAct(d,i,k){ // one move by side i; returns whether it happened
  const me=d.f[i],en=d.f[1-i],g=dy(me),ge=dy(en),col=gearColor((i?d.opp:lookOf(S)).w,SC.t,CLS[me.cls].c),dist=Math.abs(en.x-me.x),rng=DRNG[me.cls],K=DUEL_LIVE;
  if(d.end>0||d.go>0||me.stun>0)return false;
  if(k==='atk'){if(me.atkT>0||dist>rng+14)return false;const T=d.L.T[i];me.atkT=T;me.chain=(me.chain+1)%4;const fin=me.chain===0;dHit(d,i,T/1.5*(fin?1.5:.84),fin,col);return true;}
  if(me.cd[k]>0)return false;
  if(k==='s0'){if(dist>rng+40)return false;me.cd.s0=K.sk[0].cd;SC.fx.push({k:'rune',x:me.x,y:g-2,r:64,life:.6,d:.6,c:col});if(me.cls==='blade')SC.fx.push({k:'wave',x:me.x+me.face*20,y:g,dir:en.x>=me.x?1:-1,dist:150,h:70,life:.32,d:.32,c:col});dHit(d,i,K.sk[0].m,true,col);}
  else if(k==='s1'){if(dist>rng+20)return false;me.cd.s1=K.sk[1].cd;SC.fx.push({k:'pillar',x:en.x,y:ge,life:.45,d:.45,c:col});SC.fx.push({k:'star',x:en.x,y:ge-44,r:46,rot:.4,life:.4,d:.4,c:col});const dodged=en.inv>0||Math.abs(en.z-me.z)>DLANE,guarded=en.sh>0;dHit(d,i,K.sk[1].m,true,col);if(!dodged&&!guarded){en.stun=K.sk[1].stun;addNum(en.x,ge-128,'הלם','#ffd75e',false);}}
  else if(k==='s2'){me.cd.s2=K.sk[2].cd;me.sh=K.sk[2].dur;snd('fury');SC.fx.push({k:'rune',x:me.x,y:g-2,r:70,life:.9,d:.9,c:'#9fe8ff'});SC.fx.push({k:'pillar',x:me.x,y:g,life:.5,d:.5,c:'#9fe8ff'});}
  else if(k==='s3'){if(dist>rng+60)return false;me.cd.s3=K.sk[3].cd;snd('ult');SC.fx.push({k:'rune',x:me.x,y:g-2,r:150,life:1,d:1,c:col});if(!calm)SC.fx.push({k:'screen',life:.3,d:.3,c:col});for(const q of [-1,1])SC.fx.push({k:'wave',x:me.x+q*30,y:g,dir:q,dist:420,h:110,life:.55,d:.55,c:col});SC.fx.push({k:'flash',x:en.x,y:ge-40,r:90,life:.35,d:.35,c:col});dHit(d,i,K.sk[3].m,true,col);if(!calm)SC.shake=.4;}
  else if(k==='dash'){me.cd.dash=K.dash.cd;me.inv=K.dash.inv;const side=i===0?(!SC.hero.dir&&SC.hero.dz?SC.hero.dz:0):(Math.random()<.5?(me.z>.5?-1:1):0),dir=side?0:i===0&&SC.hero.dir?SC.hero.dir:(me.cls==='blade'?(en.x>=me.x?1:-1):(en.x>=me.x?-1:1));for(let q=0;q<4;q++)SC.parts.push({x:me.x,y:g-20-q*14,vx:-dir*90,vy:0,life:.4,c:'#9fe8ff',s:3});me.x=clamp(me.x+dir*K.dash.d,34,W-34);me.z=clamp(me.z+side*.55,0,1);snd('whoosh');}
  else if(k==='pot'){if(me.pots<1)return false;me.cd.pot=K.potCd;me.pots--;me.hp=Math.min(1,me.hp+K.heal);burst(me.x,g-50,'#6fe39a',18);addNum(me.x,g-112,'+30%','#6fe39a',true);snd('fury');}
  else return false;
  if(i===0){renderDuelBar();if(k==='s1'||k==='s3')d.ai.threat=.5;}
  return true;
}
function duelAct(k){const d=SC.duel;if(d)dAct(d,0,k);}
function duelAI(d,dt){ // the absent player, played here with his own numbers and the same moves
  const me=d.f[1],en=d.f[0],ai=d.ai,rng=DRNG[me.cls],dist=Math.abs(en.x-me.x),dir=en.x>=me.x?1:-1;me.mv=false;if(me.stun>0)return;
  const want=me.cls==='blade'?rng*.8:rng*.86,sp=me.cls==='blade'?150:128;
  if(dist>want+8){me.x+=dir*sp*dt;me.mv=true;}else if(me.cls!=='blade'&&dist<want*.55&&me.x>50&&me.x<W-50){me.x-=dir*sp*.8*dt;me.mv=true;}
  me.x=clamp(me.x,34,W-34);me.face=dir;
  {const dz=en.z-me.z;if(Math.abs(dz)>.1){me.z=clamp(me.z+Math.sign(dz)*.62*dt,0,1);me.mv=true;}}
  if(ai.threat>0){const was=ai.threat;ai.threat-=dt;if(was>.25&&ai.threat<=.25){if(Math.random()<.4)dAct(d,1,'dash');else if(Math.random()<.45)dAct(d,1,'s2');}}
  if((ai.t-=dt)>0){if(dist<=rng+14&&Math.abs(en.z-me.z)<=DLANE)dAct(d,1,'atk');return;}
  ai.t=.3+Math.random()*.25;const r=Math.random();
  if(me.hp<.36&&me.pots>0&&r<.75){dAct(d,1,'pot');return;}
  if(me.hp<.6&&me.sh<=0&&r<.3&&dAct(d,1,'s2'))return;
  if(Math.abs(en.z-me.z)>DLANE)return; // not lined up yet: no point swinging
  if(r<.5&&dAct(d,1,'s3'))return;if(r<.7&&dAct(d,1,'s1'))return;if(r<.8&&dAct(d,1,'s0'))return;
  dAct(d,1,'atk');
}
function updateDuel(dt){
  const d=SC.duel,me=d.f[0];
  for(const f of d.f){f.anim=Math.max(0,f.anim-dt*3.2);f.atkT=Math.max(0,f.atkT-dt);f.stun=Math.max(0,f.stun-dt);f.sh=Math.max(0,f.sh-dt);f.inv=Math.max(0,f.inv-dt);f.hitT=Math.max(0,f.hitT-dt);for(const k in f.cd)f.cd[k]=Math.max(0,f.cd[k]-dt);}
  if(d.end>0){d.end-=dt;if(d.end<=0)finishDuel();return;}
  if(d.go>0){d.go-=dt;if(d.go<=0){renderDuelBar();snd('boss');}return;}
  d.t+=dt;me.mv=false;if(me.stun<=0&&SC.hero.dir){me.x=clamp(me.x+SC.hero.dir*(me.cls==='blade'?165:145)*dt,34,W-34);me.mv=true;me.face=SC.hero.dir;}
  if(me.stun<=0&&SC.hero.dz){me.z=clamp(me.z+SC.hero.dz*.95*dt,0,1);me.mv=true;}
  if(d.holdAtk)dAct(d,0,'atk');
  duelAI(d,dt);
  if((d.bt=(d.bt||0)+dt)>.25){d.bt=0;renderDuelBar();}
  if(me.hp<=0||d.f[1].hp<=0||d.t>=DUEL_LIVE.time)endDuel(d.f[1].hp<=0?true:me.hp<=0?false:me.hp>=d.f[1].hp);
}
async function endDuel(win){
  const d=SC.duel;if(!d||d.sent)return;d.sent=true;d.end=9;d.holdAtk=false;d.local=win;renderDuelBar();
  const r=await send('duelEnd',{win:win});if(SC.duel!==d)return;
  d.win=r&&r.ok?!!r.win:win;d.gain=r&&r.ok?r.gain|0:0;d.denied=!!(r&&r.denied);d.end=2.4;
  SC.nums.push({x:W/2,y:H*.4,txt:d.win?'ניצחון!':'הפסד',c:d.win?'#f2c14e':'#ff5c7a',s:34,life:2.4});snd(d.win?'rare':'slam');
}
function finishDuel(){
  const d=SC.duel,win=d.win;
  toast(d.denied?'השרת לא אישר את הניצחון':win?'ניצחון. הדירוג עלה ב-'+d.gain+', קיבלת 8 מטבעות עונה':'הפסד. הדירוג ירד ב-12');
  SC.mode='farm';SC.duel=null;SC.fx=[];SC.nums=[];SC.hero.dir=0;SC.hero.dz=0;renderDuelBar();touch();
}
function drawDuel(dt){
  const d=SC.duel,sc=clamp(H/300,.8,1.45),f=d.f,g=gy(),lost=d.sent?(d.win!=null?!d.win:!d.local):null,dead=d.sent?Math.min(2.4,d.end>2.4?(9-d.end):2.4-d.end+.6):0,looks=[lookOf(S),d.opp];
  { // the floor, seen at an angle: far edge narrower, lines running into the distance
    const y0=g-84,y1=g+6,in0=W*.13;ctx.save();const gr=ctx.createLinearGradient(0,y0,0,y1);gr.addColorStop(0,'rgba(60,44,110,.55)');gr.addColorStop(1,'rgba(120,90,190,.38)');ctx.fillStyle=gr;
    ctx.beginPath();ctx.moveTo(in0,y0);ctx.lineTo(W-in0,y0);ctx.lineTo(W-6,y1);ctx.lineTo(6,y1);ctx.closePath();ctx.fill();ctx.strokeStyle='rgba(255,215,94,.22)';ctx.lineWidth=1;
    for(let q=0;q<=8;q++){const u=q/8;ctx.beginPath();ctx.moveTo(in0+(W-2*in0)*u,y0);ctx.lineTo(6+(W-12)*u,y1);ctx.stroke();}
    for(let q=0;q<=4;q++){const u=q/4,y=y0+(y1-y0)*u*u,ins=in0+(6-in0)*u*u;ctx.beginPath();ctx.moveTo(ins,y);ctx.lineTo(W-ins,y);ctx.stroke();}
    ctx.strokeStyle='rgba(255,215,94,.6)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(in0,y0);ctx.lineTo(W-in0,y0);ctx.lineTo(W-6,y1);ctx.lineTo(6,y1);ctx.closePath();ctx.stroke();ctx.restore();}
  for(const i of (f[0].z<=f[1].z?[0,1]:[1,0])){const a=f[i],ya=dy(a),s2=sc*dsc(a),x=a.x+(a.hitT>0?(Math.random()-.5)*5:0),down=lost!=null&&(i===0?lost:!lost);
    ctx.fillStyle='rgba(0,0,0,.4)';ctx.beginPath();ctx.ellipse(a.x,ya+2,22*s2,6*s2,0,0,7);ctx.fill();
    if(Math.abs(f[0].z-f[1].z)<=DLANE&&i===1&&!d.sent){ctx.strokeStyle='rgba(255,92,122,.55)';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(a.x,ya+2,28*s2,8*s2,0,0,7);ctx.stroke();}
    if(a.sh>0){ctx.save();ctx.globalCompositeOperation='lighter';ctx.strokeStyle='#9fe8ff';ctx.shadowColor='#9fe8ff';ctx.shadowBlur=12;ctx.globalAlpha=.5+.3*Math.sin(SC.t*9);ctx.lineWidth=2.5;ctx.beginPath();ctx.ellipse(a.x,ya-44*s2,30*s2,50*s2,0,0,7);ctx.stroke();ctx.restore();}
    ctx.save();if(a.inv>0)ctx.globalAlpha=.45;drawHero(x,ya,s2,looks[i],SC.t+i*1.7,a.anim,a.face<0,down?Math.max(.01,dead):0,a.mv,false);ctx.restore();
    if(a.stun>0)for(let q=0;q<3;q++){const an=SC.t*6+q*2.1;label('\u2726',a.x+Math.cos(an)*16,ya-128*s2+Math.sin(an)*5,'#ffd75e',12);}}
  const side=(x,a,c,nm)=>{hpBar(x-60,26,120,a.hp,c,nm);label('שיקויים '+a.pots+(a.sh>0?' · מגן':'')+(a.stun>0?' · המום':''),x,48,'#c9c2ea',10.5);};
  side(W*.26,f[0],'#6fe39a',S.name);side(W*.74,f[1],'#ff5c7a',d.opp.n);
  label(d.go>0?'היכון...':mmss(Math.max(0,DUEL_LIVE.time-d.t)),W/2,32,d.go>0?'#ffd75e':'#fff',d.go>0?18:13);
  if(d.go<=0&&!d.sent){const far=Math.abs(f[1].x-f[0].x)>DRNG[f[0].cls]+14,offl=Math.abs(f[1].z-f[0].z)>DLANE;if(far||offl)label(offl?'עמוד מולו כדי לפגוע':'התקרב כדי לתקוף',f[0].x,dy(f[0])-150*sc*dsc(f[0]),'#ffd75e',11);}
  const hx0=SC.hero.x;SC.hero.x=f[0].x;drawFx(dt);SC.hero.x=hx0;
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
 g:'<svg viewBox="0 0 40 40"><path d="M20 30C12 30 3 22 3 8c6 2 11 6 17 16C26 14 31 10 37 8c0 14-9 22-17 22z" fill="currentColor"/><path d="M20 24v10" stroke="#fff8" stroke-width="2"/></svg>'
};
const gcls=p=>p>=13?' g13':p>=11?' g11':p>=9?' g9':p>=7?' g7':'';
function mainLine(it){const v=itemVals(it);return it.s==='w'?'נזק '+fmt(v.atk):ARM[it.s]?'חיים '+fmt(v.hp)+' · הגנה '+v.def:'נזק '+L('+'+v.wd+'%');}
function itemCard(it){
  return '<button class="it r'+it.r+gcls(it.p)+(it.ex?(isFull(it)?' ex full':' ex'):'')+'" data-act="item" data-id="'+it.id+'" style="color:var(--r'+it.r+')">'+SVG[it.s]+
    '<span class="nm">'+esc(itemName(it,S.cls))+(it.p?' '+L('+'+it.p):'')+'</span><span class="sub">'+mainLine(it)+'</span></button>';
}
function findItem(id){for(const k of SLOTS)if(S.eq[k]&&S.eq[k].id===id)return {it:S.eq[k],eq:k};const i=A.inv.findIndex(x=>x.id===id);return i>=0?{it:A.inv[i],i:i}:null;}
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
  {const kw=!duel&&!SC.ev&&S&&!demo?keepWin():null,kb=$('keepBtn');kb.style.display=kw?'':'none';if(kw){const t=(A.keys>0||(A.ev&&A.ev[kw.key]&&A.ev[kw.key].in)?'שגר למצודה':'המצודה פתוחה · אין מפתח')+' · הכניסה נסגרת בעוד '+mmss((kw.end-(kw.e.dur-KEEP_GATE)*60000-Date.now())/1000);if(kb.textContent!==t)kb.textContent=t;}}
  $('resetNow').style.display=canReset(S)&&!duel?'block':'none';
  $('autoBtn').style.display=$('skills').style.display=duel||zi<0?'none':'';$('paceTag').style.visibility=$('bigBtn').style.visibility=$('sndBtn').style.visibility=$('fsBtn').style.visibility=duel?'hidden':'';if(duel)renderDuelBar();$('mv').style.display='';$('mvU').style.display=$('mvD').style.display=duel?'':'none';$('stage').classList.toggle('duel',duel);
  $('sndBtn').textContent=prefs.mute?'צליל כבוי':'צליל פעיל';$('sndBtn').classList.toggle('on',!prefs.mute);
  $('autoBtn').textContent='אוטומטי: '+(S.auto?'פעיל':'כבוי');$('autoBtn').classList.toggle('on',!!S.auto);
  const bs=$('skills').children,h=SC.hero;
  for(let i=0;i<6;i++){const lock=S.lvl<SKLV[i],cd=h.cds[i];bs[i].className=lock?'lock':cd>0?'cd':'';
    const txt=lock?'רמה '+SKLV[i]:cd>0?Math.ceil(cd)+' שנ׳':'מוכן';if(bs[i].dataset.s!==txt+S.cls){bs[i].dataset.s=txt+S.cls;bs[i].innerHTML=esc(CLS[S.cls].sk[i])+'<b>'+txt+'</b>';}}
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
   '<div class="kv"><span>טווח תקיפה</span><b>'+(S.cls==='blade'?'קרוב':'רחוק')+'</b></div></div></div>';
  h+='<h2>נקודות סטט: '+L(S.pts)+'</h2><div class="card">';const spentPts=S.stats.str+S.stats.agi+S.stats.vit+S.stats.ene-60;
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
  h+='<p class="hint">ציורי הדמויות והמפלצות: LuizMelo, ברישיון חופשי.</p>';
  return h;
}
function setLines(z,n){return SETB.map(b=>'<div class="kv"'+(n>=b[0]?' style="color:var(--r4)"':'')+'><span style="color:inherit">'+L(b[0])+' חלקים</span><b>'+AFF[b[1]][0]+' '+L('+'+b[2]+'%')+'</b></div>').join('');}
function renderGear(){
  const sp=armorPlus(S),gtier=glowTier(sp),gn=GLOW_NAME.find(x=>gtier>=x[0]);
  const res=[['זהב',fmt(A.gold),'var(--gold)'],['אבני נשמה',A.gems,'var(--arc)'],['אותות ריסט',A.cred,'var(--ember)'],['מטבעות עונה',A.coins,'var(--r2)'],['קרדיטים',fmt(A.prem||0),'#7df9ff'],['נוצות נצח',A.feathers||0,'#ffd75e'],['אבני שלמות',A.jewels||0,'#7dffb0'],
    ['קמעות הגנה',A.charms,'#ffd75e'],['שברי ארגמן',A.shards||0,'#ff6b8a'],['מפתחות מצודה',A.keys||0,'#ffb23e'],['תיבות אוצר',A.boxes,'#c9a66b'],['תיבות עונה',A.sboxes,'#c77dff'],['כרטיסי זירה',A.tickets,'#8fd3ff']];
  let h='<h2>מה יש לך</h2><div class="card resgrid">'+res.map(x=>'<div><i class="dot" style="background:'+x[2]+'"></i><span>'+x[0]+'</span><b class="num">'+L(x[1])+'</b></div>').join('')+'</div><h2>ציוד לבוש</h2><button class="btn pri" data-act="bestEq">הלבש את הציוד הכי חזק מהתיק</button><p class="hint">בודק את התיק ומחליף כל חלק בחזק ממנו. ציוד שלבוש על דמות אחרת בחשבון לא זז ממנה. כדי להעביר אותו, צריך קודם להסיר אותו שם.</p><div class="card"><div class="kv"><span>זוהר השריון</span><b style="color:var(--gold)">'+(gn?gn[1]:'עדיין אין')+'</b></div><p class="hint">חמשת חלקי השריון קובעים את הזוהר על הגוף. ממוצע השדרוג שלך '+L('+'+sp[1])+', והחלק הנמוך ביותר '+L('+'+sp[0])+'. נצנוץ בממוצע '+L('+7')+', זוהר ב-'+L('+9')+', זוהר פועם ב-'+L('+11')+'. כשכל החלקים ב-'+L('+13')+' נדלקת הילת להבה סביב כל הגוף, וב-'+L('+15')+' היא מחליפה צבעים.</p>'+
    '<div class="kv" style="margin-top:6px"><span>אבני שלמות</span><b class="num" style="color:#7dffb0">'+L(A.jewels||0)+'</b></div><p class="hint">פריט אקסלנט נופל לעיתים רחוקות ונושא אופציות נוספות, עד כל האופציות של החלק. אבן שלמות מוסיפה לו אופציה חסרה. האבנים נופלות מבוסים ונמכרות בחנות הריסט ובחנות העונה.</p></div><div class="items">';
  for(const k of SLOTS)h+=S.eq[k]?itemCard(S.eq[k]):'<div class="it empty">'+SLOTN[k]+'</div>';
  h+='</div>';
  const sc=setCounts(S);for(const z in sc)h+='<div class="card r4"><b style="color:var(--r4)">סט עתיק: '+SETN[z]+' · '+L(sc[z]+'/6')+'</b>'+setLines(z,sc[z])+'</div>';
  h+='<div class="card" style="display:flex;flex-direction:column;gap:8px">'+tog('לבש אוטומטית ציוד חזק יותר',A.autoEq,'autoEq')+
    '<div><span style="font-size:13px">מה להרים מהרצפה</span><div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:5px">'+[['0','רגיל'],['1','קסום'],['2','נדיר'],['3','אגדי'],['4','עתיק'],['set','חלקי סט'],['g','כנפיים'],['ex','אקסלנט']].map(x=>'<button class="btn sm'+(pickOf(A)[x[0]]?' on':'')+'" data-act="pick" data-k="'+x[0]+'">'+x[1]+'</button>').join('')+'</div><p class="hint" style="margin-top:4px">זהב, אבני נשמה, תיבות ושברים נאספים תמיד. מה שכבוי נשאר על הרצפה.</p></div>'+
    '<div class="tog"><span>מכירה אוטומטית</span><button class="btn sm" data-act="autoSell">'+['כבויה','רגיל','רגיל וקסום'][A.autoSell]+'</button></div>'+
    '<div class="tog"><span>תיבות אוצר: '+L(A.boxes)+'</span><button class="btn sm pri" data-act="openBox" data-k=""'+(A.boxes?'':' disabled')+'>פתח תיבה</button></div>'+
    '<div class="tog"><span>תיבות עונה: '+L(A.sboxes)+' · 15% לחלק סט עתיק</span><button class="btn sm pri" data-act="openBox" data-k="s"'+(A.sboxes?'':' disabled')+'>פתח תיבה</button></div>'+
    '<div class="kv"><span>קמעות הגנה</span><b>'+L(A.charms)+'</b></div></div>';
  h+='<h2>תיק משותף '+L(A.inv.length+'/'+BAG)+'</h2>';
  if(!A.inv.length)h+='<p class="hint">התיק ריק. פריטים נופלים ממפלצות ומבוסים. פריט עתיק שייך לסט של המפה שבה נפל, ושישה חלקים נותנים את כל בונוסי הסט.</p>';
  else{const inv=A.inv.slice().sort((a,b)=>b.r-a.r||b.t-a.t||b.p-a.p);h+='<div class="items">'+inv.map(it=>itemCard(it)).join('')+'</div><p class="hint">מכירה מהירה לפי צבע. תופיע בקשת אישור לפני המכירה. פריטי אקסלנט וכנפיים לא נמכרים כך.</p><div class="sellrow">'+
    RAR.map((q,i)=>{const n=A.inv.filter(it=>it.r===i&&it.s!=='g'&&!it.ex).length;return '<button class="btn sm" data-act="sellAsk" data-r="'+i+'" style="border-color:var(--r'+i+');color:var(--r'+i+')"'+(n?'':' disabled')+'>'+q.n+' · '+L(n)+'</button>';}).join('')+'</div>';}
  return h;
}
function renderZones(){
  let h='<p class="hint">בכל מפה שלוש קומות: בכל קומה המפלצות חזקות יותר, ויש יותר ניסיון, זהב וסיכוי לשלל. עוברים בין קומות ומפות דרך השערים שבקצוות, או בקפיצה מכאן. שער חדש נפתח אחרי ניצחון על הבוס של המפה. הבוס מופיע אחרי '+L(BOSSN)+' חיסולים כשאתה משחק בעצמך.</p>';
  h+='<div class="card zone'+(SC.zi<0?' cur':'')+'"><div class="sw" style="background:linear-gradient('+TOWN.sky[0]+','+TOWN.sky[1]+')"></div><div class="z"><b>'+TOWN.n+'</b><small>נפח, סוחרת, שומר המעגל, כרוז העונה, שער הזירה</small></div><button class="btn sm" data-act="zone" data-i="-1"'+(SC.zi<0?' disabled':'')+'>'+(SC.zi<0?'כאן':'קפוץ')+'</button></div>';
  ZONES.forEach((z,i)=>{const opened=z.req?S.resets>=z.req:i<=A.open,lv=z.min<=S.lvl,zf=zoneInfo(i,C,AFK),cur=SC.zi===i;
    if(i<BASEZ&&i%REGION===0)h+='<h2>אזור '+L(i/REGION+1)+' · ציוד '+TIERN[tierOf(i)-1]+'</h2>';
    if(i===BASEZ)h+='<h2>מפות ריסט</h2><p class="hint">נפתחות לפי מספר הריסטים של הדמות. המפלצות חזקות יותר, הניסיון והזהב גבוהים יותר, והציוד בדרגות חדשות עם סטים עתיקים משלו. נכנסים אליהן מכאן.</p>';
    h+='<div class="card zone'+(cur?' cur':'')+(opened&&lv?'':' lock')+'"><div class="sw" style="background:linear-gradient('+z.sky[0]+','+z.sky[1]+')"></div><div class="z"><b>'+z.n+'</b>'+
      '<small>'+z.m+' · מרמה '+L(z.min)+(opened&&lv?' · '+L(fmt(zf.xps*60))+' ניסיון לדקה בלי לשחק'+(zf.e<1?' · מסוכן':''):'')+'</small>'+
      '<small>שלל: ציוד '+TIERN[tierOf(i)-1]+' עם בונוס '+AFF[z.sig][0]+(z.wing?' · '+WINGN[z.wing-1]:'')+' · סט '+SETN[tierOf(i)-1]+'</small>'+
      (!opened?'<small style="color:var(--bad)">'+(z.req?'נפתח אחרי '+L(z.req)+' ריסטים של הדמות (יש '+L(S.resets)+')':'נעול: הבס את הבוס של '+ZONES[i-1].n)+'</small>':!lv?'<small style="color:var(--bad)">צריך רמה '+z.min+'</small>':'')+'</div>'+
      (opened&&lv?'<div style="display:flex;flex-direction:column;gap:4px">'+[0,1,2].map(f=>{const ok=S.lvl>=floorMin(i,f),here=cur&&SC.fl===f;return '<button class="btn sm" data-act="zone" data-i="'+i+'" data-f="'+f+'"'+(ok&&!here?'':' disabled')+'>'+(here?'כאן':'קומה '+(f+1)+(ok?'':' · '+L(floorMin(i,f))))+'</button>';}).join('')+'</div>':'')+'</div>';});
  return h;
}
function shopList(name,list,have,curName){
  return list.map(o=>{let dis=have<o.cost;if(o.k==='bless'&&A.bless>=10)dis=true;
    return '<div class="card shop"><div class="z"><b>'+o.t+'</b>'+(o.d?'<small>'+o.d+'</small>':'')+'</div><button class="btn sm'+(dis?'':' pri')+'" data-act="buy" data-s="'+name+'" data-k="'+o.k+'"'+(dis?' disabled':'')+'>'+L(fmt(o.cost))+' '+curName+'</button></div>';}).join('');
}
function renderShop(){
  let h=renderCredits()+renderMarket()+'<h2>חנות אותות ריסט</h2><p class="hint">אותות מקבלים רק מריסט. יש לך '+L(A.cred)+'.</p>'+shopList('reset',RESET_SHOP,A.cred,'אותות');
  h+='<h2>חנות זהב</h2>'+(A.boost>Date.now()?'<p class="hint">מגילת ניסיון פעילה עוד '+fmtT((A.boost-Date.now())/1000)+'.</p>':'')+shopList('gold',GOLD_SHOP,A.gold,'זהב');
  h+='<h2>חנות העונה</h2><p class="hint">מטבעות עונה מקבלים מהפס, מריסטים ומהזירה.</p>'+shopList('season',SEASON_SHOP,A.coins,'מטבעות');
  return h;
}
const mmss=s=>{s=Math.max(0,Math.round(s));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');};
const OBJN={k:'חיסולים',b:'בוסים',w:'ניצחונות',q:'תשובה נכונה'};
function renderEvents(){
  const now=Date.now(),wins=evWindows(now,10),ev=A.ev||{};
  let h='<h2>אירועים</h2><p class="hint">האירועים רצים לפי השעון, בשעון ישראל. בונוסים ומשימות נספרים רק כשמשחקים בפועל.</p>';
  for(const e of EVENTS){
    const w=wins.find(x=>x.e.id===e.id),rec=w&&ev[w.key]||{},live=w&&w.live;
    let tierLine='',tn='';
    if(e.tiered){const t=rec.tr||evTier(S.lvl),nx=evTier(S.lvl)+1;
      if(!t)tierLine='<p class="hint" style="color:var(--bad)">הכניסה מרמה '+L(TIER_MIN[0])+'. חסרות לך '+L(TIER_MIN[0]-S.lvl)+' רמות.</p>';
      else{const rg=tierRange(t),rw=tierReward(t);tn=' '+t;
        tierLine='<div class="tiers">'+TIER_MIN.map((m,i)=>'<i class="'+(i+1===t?'on':i+1<t?'past':'')+'">'+(i+1)+'</i>').join('')+'</div><p class="hint"><b style="color:var(--gold)">דרגה '+L(t)+'</b> · רמות '+L(rg[0]+'-'+rg[1])+' · פרס: '+L(rw.lv)+' רמות, '+L(rw.gems)+' אבני נשמה, '+L(rw.coins)+' מטבעות עונה</p>'+
          (nx<=7&&!rec.tr?'<p class="hint" style="color:#8fd3ff">עוד '+L(TIER_MIN[nx-1]-S.lvl)+' רמות לדרגה '+L(nx)+', שנותנת '+L(tierReward(nx).lv)+' רמות. תגיע לפני שהשער נפתח.</p>':'');}}
    h+='<div class="card'+(live?' zone cur':'')+'" style="display:block"><div class="kv"><b'+(live?' style="color:var(--gold)"':'')+'>'+e.n+tn+'</b><b class="num" style="color:var(--'+(live?'good':'dim')+')">'+(live?'פעיל · '+L(mmss((w.end-now)/1000)):'בעוד '+fmtT(evNext(e,now)))+'</b></div>'+
      '<p class="hint">'+e.d+' · '+e.when+(e.rt&&!e.tiered?' · פרס: '+e.rt:'')+'</p>'+tierLine+(e.tiered?keepCard(e,w,rec,live):'');
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
    '<button class="btn pri" data-act="pcreate">צור פארטי</button><input type="text" id="pcode" maxlength="6" placeholder="קוד פארטי של חבר" autocomplete="off" dir="ltr"><button class="btn" data-act="pjoin">הצטרף עם קוד</button></div>';
  h+='<div class="card"><div class="kv"><span>קוד להזמנת חברים</span><b class="num" dir="ltr" style="letter-spacing:2px;color:var(--gold)">'+esc(party.code)+'</b></div>';
  for(const m of party.members)h+='<div class="kv"><span><i class="dot" style="background:var(--'+(m.active?'good':'line')+')"></i>'+esc(m.n)+(m.me?' (אתה)':'')+(m.leader?' · מוביל':'')+'</span><b>רמה '+L(m.l)+' · '+esc(zoneName(clamp(m.zone|0,-1,ZONES.length-1)))+'</b></div>';
  return h+'<div style="margin-top:6px">'+rules+'</div><p class="hint" style="margin-top:6px">איתך במפה עכשיו: '+L(partyN)+' חברים. בונוס ניסיון: '+L(Math.round(partyXp(partyN)*100)+'%')+'.</p><button class="btn sm" data-act="pleave">עזוב פארטי</button></div>';
}
function renderArena(){
  const arenaOpps=A.opps||[];
  let h=renderTop()+renderGuild()+renderParty()+'<h2>זירה</h2><div class="card"><div class="grid2"><div class="kv"><span>דירוג</span><b class="num" style="color:var(--gold)">'+A.rating+'</b></div><div class="kv"><span>כרטיסים היום</span><b class="num">'+A.tickets+'</b></div></div>'+
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
    (it.ex?'<p class="extag">'+(isFull(it)?'אקסלנט מלא · כל ':'אקסלנט · ')+L(it.af.length+'/'+POOL[it.s].length)+' אופציות</p>':'')+'<div>';
  if(it.s==='w')h+='<div class="kv"><span>נזק נשק</span><b class="num">'+fmt(v.atk)+'</b></div>';
  if(ARM[it.s])h+='<div class="kv"><span>חיים</span><b class="num">'+fmt(v.hp)+'</b></div><div class="kv"><span>הגנה</span><b class="num">'+v.def+'</b></div>';
  if(it.s==='g')h+='<div class="kv"><span>נזק</span><b class="num">'+L('+'+v.wd+'%')+'</b></div><div class="kv"><span>חיים</span><b class="num">'+L('+'+v.wh+'%')+'</b></div><div class="kv"><span>מהירות הליכה</span><b class="num">'+L('+'+it.t*8+'%')+'</b></div>';
  for(const a of it.af)h+='<div class="kv aff"><span style="color:inherit">'+AFF[a[0]][0]+'</span><b class="num">'+L('+'+a[1]+'%')+'</b></div>';
  h+=diff+'</div>';
  if(isSet(it)){const n=setCounts(S)[it.t-1]||0;h+='<div class="card r4"><b style="color:var(--r4)">סט עתיק: '+SETN[it.t-1]+' · לבושים '+L(n+'/6')+'</b>'+setLines(it.t-1,n)+'</div>';}
  if(it.s==='g'&&it.t<WING_MAX){const n=wingFeathers(it.t),ok=it.p>=15&&(A.feathers||0)>=n;
    h+='<button class="btn'+(ok?' pri glow':'')+'" data-act="wingEvolve" data-id="'+it.id+'"'+(ok?'':' disabled')+' style="width:100%;margin-bottom:6px">פתח ל'+WINGN[it.t]+' · '+L(n)+' נוצות · '+L(Math.round(wingChance(it.t)*100)+'%')+'</button>'+
      '<p class="hint" style="margin-bottom:6px">'+(it.p<15?'כנפיים מתפתחות לדרגה הבאה רק ב-'+L('+15')+'. ':'')+'יש לך '+L(A.feathers||0)+' נוצות נצח. קונים אותן בחנות העונה, ומקבלים בפס העונה ולעיתים מבוסים. כישלון שורף את הנוצות, הכנפיים נשארות. דרגה '+L(it.t+'/'+WING_MAX)+'.</p>';}
  if(it.ex&&!isFull(it))h+='<button class="btn'+(A.jewels>0?' pri':'')+'" data-act="exAdd" data-id="'+it.id+'"'+(A.jewels>0?'':' disabled')+' style="width:100%;margin-bottom:6px">הוסף אופציה · אבני שלמות: '+L(A.jewels||0)+'</button>';
  if(it.p<15)h+='<p class="hint">שדרוג לדרגה '+L('+'+(it.p+1))+': '+L(uc.gems)+' אבני נשמה ו-'+L(fmt(uc.gold))+' זהב · סיכוי '+L(Math.round(upChance(it)*100)+'%')+(it.p>=7?' · כישלון מוריד דרגה אחת'+(A.charms?' (יש קמע הגנה)':''):'')+'</p>';
  {const q=reqOf(it,S.cls);h+='<div class="kv" style="margin-bottom:6px"><span>דרישות</span><b>'+Object.keys(q).map(k=>'<span style="color:'+(S.stats[k]>=q[k]?'var(--good)':'#ff5c7a')+'">'+STATN[k][0]+' '+L(fmt(q[k]))+'</span>').join(' · ')+'</b></div>';}
  h+='<div class="acts">'+(f.eq!=null?'<button class="btn" data-act="unequip" data-id="'+it.id+'">הסר</button>':'<button class="btn pri" data-act="equip" data-id="'+it.id+'"'+(canWear(S,it)?'':' disabled')+'>'+(canWear(S,it)?'לבש':'חסרים סטטים')+'</button>')+
    '<button class="btn" data-act="upgrade" data-id="'+it.id+'"'+(it.p>=15||A.gems<uc.gems||A.gold<uc.gold?' disabled':'')+'>'+(it.p>=15?'דרגה מרבית':'שדרג')+'</button>'+
    (f.eq==null?'<button class="btn" data-act="sell" data-id="'+it.id+'">מכור ב-'+L(fmt(sellVal(it)))+'</button>':'')+
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
  h+='<div class="kv"><span>מפלצות שחוסלו</span><b class="num">'+fmt(sum('kills'))+'</b></div><div class="kv"><span>זהב</span><b class="num">'+L('+'+fmt(sum('gold')))+'</b></div>'+
    '<div class="kv"><span>אבני נשמה</span><b class="num">'+L('+'+sum('gems'))+'</b></div><div class="kv"><span>תיבות אוצר</span><b class="num">'+L('+'+sum('boxes'))+'</b></div>'+
    '<div class="kv"><span>פריטים שנפלו</span><b class="num">'+sum('items')+' ('+sum('sold')+' נמכרו)</b></div></div>';
  const nb=[];for(const x of list)if(x.rep.notable)for(const it of x.rep.notable)nb.push(it);
  if(nb.length)h+='<p class="hint">שלל בולט: '+nb.slice(-6).map(it=>'<b style="color:var(--r'+it.r+')">'+esc(itemName(it,S.cls))+'</b>').join(', ')+'</p>';
  h+='<p class="hint">בלי לשחק הקצב הוא 70%, ובוסים מופיעים רק כשאתה במפה.</p><div class="acts"><button class="btn pri" data-act="closeModal">המשך</button></div>';openModal(h);
}
let pickCls='blade';
function showCreate(extra){
  const cl=k=>'<button data-act="pick" data-k="'+k+'" data-x="'+(extra?1:'')+'" class="'+(pickCls===k?'on':'')+'">'+CLS[k].n+'<small>'+(k==='blade'?'קרב קרוב':'קרב מרחוק')+'</small></button>';
  openModal('<h3>'+(extra?'דמות חדשה':'מעגל הנצח')+'</h3><p class="hint">'+(extra?'הדמות החדשה מתחילה בכפר וחולקת איתך זהב, תיק ושערים.':'לוחצים על המסך כדי ללכת, על מפלצת כדי לתקוף, ומפעילים כישורים. מביסים בוסים, פותחים מפות, מגיעים לרמה 400 ועושים ריסט.')+'</p>'+
    '<label for="nm" class="hint">שם הדמות</label><input type="text" id="nm" maxlength="14" value="'+esc($('nm')?$('nm').value:'')+'" placeholder="עד 14 תווים" autocomplete="off">'+
    '<div class="cls">'+cl('blade')+cl('storm')+cl('hunter')+'</div><div class="acts"><button class="btn pri" data-act="create" data-x="'+(extra?1:'')+'">'+(extra?'צור דמות':'צא לדרך')+'</button>'+(extra?'<button class="btn" data-act="closeModal">ביטול</button>':'')+'</div>');
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
setInterval(paceTick,5000);setInterval(checkVersion,60000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(checkVersion,1500);});setTimeout(checkVersion,8000);

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
  if(r.it)toast(RAR[r.it.r].n+' · '+itemName(r.it,S.cls)+(r.where==='eq'?' (נלבש)':r.where==='sold'?' (נמכר)':''),r.it.r);else toast('מהתיבה: '+r.txt);
  if(SC.mode!=='farm')return;SC.fx.push({k:'beam',x:h.x+30*h.face,y:gy(),life:1.2,c:c});burst(h.x+30*h.face,gy()-10,c,26);
  for(let i=0;i<5;i++)SC.drops.push({x:h.x+30*h.face,y:gy()-10,vx:(Math.random()-.5)*220,vy:-200-Math.random()*120,c:c,s:4.5,age:0,life:4});
}
function accountHtml(){return installHtml()+accountHtml2();}
function accountHtml2(){
  if(!ONLINE)return '<h2>העברה בין מכשירים</h2><div class="card" style="display:flex;flex-direction:column;gap:8px"><p class="hint">מצב מקומי: ההתקדמות שמורה במכשיר הזה. קוד השמירה מעביר אותה למכשיר אחר, וטעינה מחליפה את מה שיש כאן.</p><button class="btn" data-act="expSave">העתק קוד שמירה</button><input type="text" id="impCode" placeholder="הדבק כאן קוד שמירה" autocomplete="off"><button class="btn" data-act="impSave">טען קוד שמירה</button></div>';
  return '<h2>חשבון</h2><div class="card" style="display:flex;flex-direction:column;gap:8px"><p class="hint">מחובר כ-<b dir="auto">'+esc(session&&session.user||'')+'</b>. אפשר להיכנס עם אותו שם וסיסמה מכל מכשיר.</p>'+
    (me.secret?'':'<p class="hint" style="color:var(--bad)">עוד לא הוגדרה שאלת שחזור. בלעדיה אי אפשר לשחזר סיסמה שנשכחה.</p>')+
    '<button class="btn'+(me.secret?'':' pri')+'" data-act="acct" data-k="secret">שאלת שחזור</button><button class="btn" data-act="acct" data-k="pass">שינוי סיסמה</button>'+
    (me.admin?'<a class="btn" href="admin.html" style="text-align:center;text-decoration:none;color:inherit">מסך ניהול</a>':'')+
    '<button class="btn" data-act="logout">התנתק</button><button class="btn sm" data-act="acct" data-k="del" style="color:var(--bad)">מחיקת חשבון</button>'+
    '<p class="hint"><a href="terms.html" target="_blank" rel="noopener">תקנון</a> · <a href="privacy.html" target="_blank" rel="noopener">פרטיות</a></p></div>';
}
let authMode='login';
function showAuth(msg){
  const reg=authMode==='register';
  openModal('<h3>מעגל הנצח</h3><p class="hint">'+(reg?'בחר שם משתמש וסיסמה. איתם נכנסים לחשבון מכל מכשיר.':'היכנס עם שם המשתמש והסיסמה שלך.')+'</p>'+
    '<label for="auUser" class="hint">שם משתמש</label><input type="text" id="auUser" maxlength="16" autocomplete="username" autocapitalize="none" placeholder="3 עד 16 תווים">'+
    '<label for="auPass" class="hint">סיסמה</label><input type="password" id="auPass" maxlength="72" autocomplete="'+(reg?'new-password':'current-password')+'" placeholder="לפחות 8 תווים">'+
    (reg?'<label for="auQ" class="hint">שאלת שחזור, למקרה שתשכח את הסיסמה</label>'+qSelect('auQ')+'<input type="text" id="auA" maxlength="60" placeholder="התשובה שלך" autocomplete="off">':'')+
    (msg?'<p class="hint" style="color:var(--bad)">'+esc(msg)+'</p>':'')+
    '<div class="acts"><button class="btn pri" data-act="authGo">'+(reg?'הרשמה':'כניסה')+'</button></div>'+
    '<button class="btn sm" data-act="authSwap">'+(reg?'יש לי כבר חשבון':'אין לי חשבון, הרשמה')+'</button>'+(reg?'':' <button class="btn sm" data-act="forgot">שכחתי סיסמה</button>')+
    '<p class="hint" style="margin-top:8px">'+(reg?'בהרשמה אתה מאשר את ':'')+'<a href="terms.html" target="_blank" rel="noopener">התקנון</a> '+(reg?'ואת ':'· ')+'<a href="privacy.html" target="_blank" rel="noopener">מדיניות הפרטיות</a></p>');
}
async function authGo(){
  const user=($('auUser').value||'').trim(),pass=$('auPass').value||'';
  if(user.length<3){showAuth('שם משתמש קצר מדי');return;}if(pass.length<8){showAuth('הסיסמה צריכה לפחות 8 תווים');return;}
  const reg=authMode==='register',q=reg?+$('auQ').value:0,ans=reg?($('auA').value||'').trim():'';
  if(reg&&ans.length<2){showAuth('כתוב תשובה לשאלת השחזור');return;}
  openModal('<h3>מעגל הנצח</h3><p class="hint">מתחבר...</p>');
  let r=null;try{r=await post({kind:authMode,args:{user:user,pass:pass,q:q,a:ans}});}catch(e){}
  if(!r||!r.j){showAuth('אין חיבור לשרת. נסה שוב');return;}
  if(!r.j.ok){showAuth(r.j.msg||'הפעולה נכשלה');return;}
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
  if(a==='acctGo'){acctGo(b.dataset.k);return;}
  if(a==='tut'){tutNext();return;}
  if(a==='keepGo'){enterKeep();return;}
  if(a==='credBuy'){loadOrders().then(()=>showPacks());return;}
  if(a==='ordSend'){ordSend();return;}
  if(a==='ordCancel'){rpc('ocancel',{id:+b.dataset.id}).then(j=>{if(j.orders)myOrders=j.orders;renderPanel();}).catch(()=>{});return;}
  if(a==='sellAsk'){const q=+b.dataset.r,list=A.inv.filter(it=>it.r===q&&it.s!=='g'&&!it.ex),gold=list.reduce((x,it)=>x+sellVal(it),0),up=list.filter(it=>it.p>0).length;if(!list.length)return;
    openModal('<h3 style="color:var(--r'+q+')">למכור את כל ה'+RAR[q].n+'?</h3><p class="hint">'+L(list.length)+' פריטים יימכרו תמורת '+L(fmt(gold))+' זהב. אי אפשר לבטל אחרי המכירה.</p>'+
      (up?'<p class="hint" style="color:var(--bad)">שים לב: '+L(up)+' מהם משודרגים.</p>':'')+(q>=3?'<p class="hint" style="color:var(--bad)">אלה פריטים '+(q===4?'עתיקים':'אגדיים')+'. ודא שאתה לא צריך אותם.</p>':'')+
      '<div class="acts"><button class="btn" data-act="closeModal">ביטול</button><button class="btn pri" data-act="sellRar" data-r="'+q+'">מכור '+L(list.length)+' פריטים</button></div>');return;}
  if(a==='respecAsk'){openModal('<h3>לאפס את נקודות הסטט?</h3><p class="hint">כל הנקודות שחילקת חוזרות אליך ואפשר לחלק אותן מחדש. המחיר: '+L(RESPEC_COST)+' אותות ריסט. יש לך '+L(A.cred)+'. ציוד שכבר לבוש נשאר עליך.'+(S.autoPts?' החלוקה האוטומטית פעילה ותחלק אותן מיד מחדש. כבה אותה קודם אם אתה רוצה לחלק לבד.':'')+'</p><div class="acts"><button class="btn" data-act="closeModal">ביטול</button><button class="btn pri" data-act="respec">אפס נקודות</button></div>');return;}
  if(a==='big'){setBig(!prefs.big);return;}
  if(a==='fs'){fsToggle();return;}
  if(a==='install'){if(installEvt){const ev=installEvt;installEvt=null;ev.prompt();}renderPanel();return;}
  if(a==='say'){say();return;}
  if(a==='topBy'){topBy=b.dataset.k==='power'?'power':'resets';renderPanel();return;}
  if(a==='chatCh'){chatCh=b.dataset.c==='g'?'g':'w';renderPanel();return;}
  if(a==='logout'){setSession(null);location.reload();return;}
  if(a==='create'){
    if(clickBusy)return;clickBusy=true;const nm=($('nm').value||'').trim().slice(0,14)||'גיבור',extra=!!b.dataset.x;
    const keep=A,wasDemo=demo;if(!extra){demo=false;if(!ONLINE)A=newAccount();}
    const r=await send('create',{name:nm,cls:pickCls});clickBusy=false;
    if(!r.ok){if(!extra){A=keep;demo=wasDemo;S=A.chars[0];}const d=document.createElement('p');d.className='hint';d.style.color='var(--bad)';d.textContent=r.msg==='net'?'אין חיבור לשרת. נסה שוב.':r.msg;$('modalBox').appendChild(d);return;}
    closeModal();enterGame(r);saveLocal();toast('בהצלחה, '+S.name);return;}
  if(!S||demo)return;
  if(a==='sk'){cast(+b.dataset.i,false);renderHud();return;}
  if(a==='auto'){S.auto=!S.auto;SC.hero.tgt=null;renderHud();send('setAuto',{on:S.auto});return;}
  if(a==='mute'){prefs.mute=!prefs.mute;savePrefs();renderHud();return;}
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
    else if(a==='pcreate'||a==='pleave'){r=await act(a,{});if(r.ok&&a==='pleave'){partyN=0;auras=[];statsDirty=true;}}
    else if(a==='pjoin'){r=await act('pjoin',{code:($('pcode').value||'').trim()});if(r.ok)toast('הצטרפת לפארטי');}
    else if(a==='mbuy'){await buyListing(b.dataset.m);}
    else if(a==='mcancel'){await cancelListing(b.dataset.m);}
    else if(a==='mrefresh'){loadMarket();}
    else if(a==='zone'){if(SC.mode==='farm'){clickBusy=false;await travelTo(+b.dataset.i,'L',+(b.dataset.f||0));}}
    else if(a==='reset'){if(SC.mode==='farm'&&canReset(S)){r=await act('reset',{});if(r.ok){enterZone(-1,'L',0);C=calc(S,auras);SC.hero.hp=C.hp;if(!calm)SC.shake=.4;burst(SC.hero.x,gy()-50,'#f2c14e',40);snd('lvl');toast('ריסט '+r.resets+'. קיבלת '+r.gain+' אותות ריסט');}}}
    else if(a==='equip'||a==='unequip'||a==='sell'){r=await act(a,{id:id});closeSheet();}
    else if(a==='craftKey'){r=await act('craftKey',{});if(r.ok){snd('rare');toast('נוצר מפתח מצודה. יש לך '+r.keys);}}
    else if(a==='bestEq'){$('spin').classList.add('on');await new Promise(z=>setTimeout(z,3000));r=await act('bestEq',{});$('spin').classList.remove('on');
      if(r.ok){snd(r.n?'rare':'ok');toast(r.n?'הוחלפו '+r.n+' חלקים. כוח הלחימה עלה ב-'+fmt(r.gain):'כבר לבוש עליך הציוד הכי חזק שיש בתיק');}}
    else if(a==='sellRar'){closeModal();r=await act('sellRar',{r:+b.dataset.r});if(r.ok){snd('coin');toast(r.n+' פריטים נמכרו ב-'+fmt(r.gold)+' זהב');}}
    else if(a==='sellJunk'){r=await act('sellJunk',{});if(r.ok)toast('נמכר ב-'+fmt(r.gold)+' זהב');}
    else if(a==='upgrade'){r=await act('upgrade',{id:id});if(r.ok){const c=r.code;snd(c==='ok'?'ok':c==='poor'||c==='max'?'click':'fail');
        toast(c==='ok'?'השדרוג הצליח. דרגה '+r.p:c==='saved'?'נכשל. קמע ההגנה שמר על הדרגה':c==='down'?'נכשל. הדרגה ירדה ל-'+r.p:c==='fail'?'השדרוג נכשל':'חסרים חומרים',c==='ok'?r.r:null);touch();C=calc(S,auras);openSheet(id);}}
    else if(a==='openBox'){r=await act('openBox',{k:b.dataset.k});if(r.ok)boxFx(r.box);}
    else if(a==='buy'){r=await act('buy',{shop:b.dataset.s,k:b.dataset.k});if(r.ok){if(r.box)boxFx(r.box);else{snd('coin');toast('נקנה: '+r.bought);}}}
    else if(a==='claimPass'){for(let n=0;n<PASS_MAX&&passLevel(S)>A.pass.claimed;n++){r=await act('claimPass',{});if(!r.ok)break;snd('rare');toast('פרס עונה: '+r.t);}passScroll=null;}
    else if(a==='claimEvent'){r=await act('claimEvent',{id:b.dataset.k});if(r.ok){snd('rare');toast('פרס האירוע: '+r.rt);if(r.levels)afterXp(r.levels);}}
    else if(a==='answer'){r=await act('answer',{a:+b.dataset.i});if(r.ok){snd(r.correct?'ok':'fail');toast(r.correct?'תשובה נכונה. אסוף את הפרס':'תשובה שגויה');}}
    else if(a==='wingEvolve'){const id=+b.dataset.id;r=await act('wingEvolve',{id:id});if(r.ok){if(r.evolved){snd('rare');toast('הכנפיים התפתחו: '+WINGN[r.t-1],4);announce('הכנפיים שלך התפתחו ל'+WINGN[r.t-1],true);}else{snd('slam');toast('הפיתוח נכשל. '+r.need+' נוצות נשרפו');}openSheet(id);}else toast(r.msg);}
    else if(a==='exAdd'){const id=+b.dataset.id;r=await act('exAdd',{id:id});if(r.ok){snd('rare');toast(r.full?'הפריט הגיע לאקסלנט מלא':'נוספה אופציה: '+AFF[r.opt[0]][0]+' '+r.opt[1]+'%',4);openSheet(id);}}
    else if(a==='claimLogin'){r=await act('claimLogin',{});if(r.ok){snd('rare');closeModal();toast('פרס יום '+r.day+': '+r.t);}}
    else if(a==='claimTask'){r=await act('claimTask',{k:b.dataset.k});if(r.ok){snd('coin');toast(r.rt?'קיבלת '+r.rt:r.xp+' ניסיון לפס');}}
    else if(a==='claimWeek'){r=await act('claimWeek',{k:b.dataset.k});if(r.ok){snd('rare');toast('פרס שבועי: '+r.rt,4);}}
    else if(a==='sqClaim'){r=await act('sqClaim',{});if(r.ok){snd('rare');toast('משימת הצד הושלמה. הפרס אצלך',4);}}
    else if(a==='sqDrop'){r=await act('sqDrop',{});}
    else if(a==='pick'){r=await act('pick',{k:b.dataset.k});}
    else if(a==='respec'){closeModal();r=await act('respec',{});if(r.ok){snd('rare');toast(fmt(r.pts)+' נקודות חזרו אליך');}else toast(r.msg);}
    else if(a==='fight'){if(SC.mode==='farm'&&(A.tickets>0||A.pd)){r=await act('duelStart',{i:+b.dataset.i});if(r.ok)startDuel(r.pd);}}
    else if(a==='da'){return;}
    else if(a==='challenge'){closeModal();r=await act('duelStart',{k:b.dataset.k});if(r.ok)startDuel(r.pd);else toast(r.msg==='net'?'אין חיבור לשרת':r.msg);}
    else if(a==='pinvite'){closeModal();try{const j=await rpc('say',{m:b.dataset.n+', בוא לפארטי שלי. הקוד: '+party.code,g:false});toast(j&&j.result&&j.result.ok?'ההזמנה נשלחה בצ\'אט':'ההזמנה לא נשלחה');beatT=99;}catch(e){}r={ok:true};}
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
    '<div class="grid2" style="margin-top:10px"><button class="btn pri" data-act="challenge" data-k="'+esc(p.k)+'"'+(A.tickets>0&&SC.mode==='farm'?'':' disabled')+'>אתגר לדו-קרב</button><button class="btn" data-act="pinvite" data-n="'+esc(s.n)+'"'+(party.code?'':' disabled')+'>'+(party.code?'שלח קוד פארטי':'אין לך פארטי')+'</button></div>'+
    '<p class="hint" style="margin-top:6px">בדו-קרב אתה נלחם בדמות שלו עם הציוד האמיתי שלה, והיא מופעלת על ידי המשחק. עולה כרטיס זירה.</p>'+
    '<div class="acts"><button class="btn" data-act="closeModal">סגור</button></div>');
}
/* ---------- the keep: a tiered event fought in its own place, entered with a crafted key ---------- */
const keepWin=()=>{const n=Date.now();return evWindows(n,0).find(w=>w.e.tiered&&w.live&&keepOpen(w,n)&&!(A&&A.ev&&A.ev[w.key]&&A.ev[w.key].no));};
async function enterKeep(){
  if(busy||SC.ev||SC.mode!=='farm'||!S||demo)return;busy=true;const r=await act('evEnter',{id:'crimson'});busy=false;
  if(!r.ok){toast(r.msg==='net'?'אין חיבור לשרת':r.msg);if(!(A.keys>0))openTab('pass');return;}
  snd('portal');enterZone(r.z,'L',0,true);SC.evEnd=r.end;SC.evTier=r.tier;announce('נכנסת למצודת הארגמן '+r.tier+'. נחיל מפלצות. חסל 400 לפני הסגירה',true);saveLocal();
}
async function leaveKeep(told){
  if(!SC.ev)return;SC.ev=false;if(!told){await flushTick();await send('evLeave',{});}
  enterZone(-1,'L',0);if(S.zone!==-1&&!ONLINE)S.zone=-1;toast(told?'השער נסגר. חזרת לכפר':'יצאת מהמצודה');saveLocal();
}
function keepCard(e,w,rec,live){
  const sh=A.shards||0,keys=A.keys||0,open=!!keepWin();
  let h='<div class="kv" style="margin-top:6px"><span>מפתחות מצודה</span><b class="num" style="color:var(--gold)">'+L(keys)+'</b></div><div class="kv"><span>שברי ארגמן</span><b class="num">'+L(sh+'/'+KEY_SHARDS)+'</b></div>'+
    '<p class="hint"><b>איך נכנסים:</b> שברי ארגמן נופלים ממפלצות בכל מפה. מ-'+L(KEY_SHARDS)+' שברים ו-'+L(fmt(KEY_GOLD))+' זהב יוצרים מפתח. כשהשער נפתח, בשעה עגולה, המפתח משגר אותך לתוך המצודה. בפנים מחכה נחיל אדיר של מפלצות חלשות עם ניסיון רגיל, כך שעולים רמות מהר בזכות הכמות. <b>הכניסה פתוחה רק ב-'+L(KEEP_GATE)+' הדקות הראשונות.</b> מי שפספס, יצא, התנתק או עשה ריסט באמצע מחכה למצודה הבאה.</p>'+
    '<div class="grid2"><button class="btn sm'+(sh>=KEY_SHARDS&&A.gold>=KEY_GOLD?' pri':'')+'" data-act="craftKey"'+(sh>=KEY_SHARDS&&A.gold>=KEY_GOLD?'':' disabled')+'>צור מפתח</button>'+
    '<button class="btn sm'+(open&&!SC.ev&&(keys>0||rec.in)?' pri glow':'')+'" data-act="keepGo"'+(open&&!SC.ev&&(keys>0||rec.in)?'':' disabled')+'>'+(SC.ev?'אתה בפנים':open?'שגר למצודה':live?'הכניסה נסגרה':'השער סגור')+'</button></div>';
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
    '<p class="hint">קרדיטים ופריטים הם חלק מהמשחק בלבד ואין להם ערך כספי. פרטים ב<a href="terms.html" target="_blank" rel="noopener">תקנון</a>.</p>'+
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
  if(!rows.some(r=>r.me))h+='<div class="trow me"><i>-</i><div><b>'+esc(S.name)+'</b><small>עוד לא בעשרים הראשונים</small></div><span class="num">'+(topBy==='power'?L(fmt(C.power))+'<small>כוח</small>':L(totalResets(A))+'<small>ריסטים</small>')+'</span></div>';
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
    p.k=k;p.s=G.cleanPlayer(k,o.s);if(p.s.ar&&p.s.ar[1]===4)p.s.set=[4,RAR[4].c];p.tx=x;p.f=o.f<0?-1:1;p.a=!!o.a;p.g=String(o.g||'').slice(0,4);return p;});
}
function updatePeers(dt){
  for(const p of peers){const d=p.tx-p.x;p.mv=Math.abs(d)>4;
    if(p.mv){p.x+=Math.sign(d)*Math.min(Math.abs(d),Math.max(190,Math.abs(d)*1.2)*dt);p.dir=d<0?-1:1;}
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
  for(const p of peers){ctx.save();ctx.globalAlpha=.9;drawHero(p.x,g0,sc,p.s,SC.t+p.k.charCodeAt(0),p.an,(p.mv?p.dir:p.f)<0,0,p.mv,false);ctx.restore();
    nameTag(p.x,g0-SPR[CLSSPR[p.s.c]].bh*2*sc-10,p.s.n,p.s.r,p.g,false);if(p.say&&p.say.t>SC.t)bubble(p.x,g0-SPR[CLSSPR[p.s.c]].bh*2*sc-40,p.say.m);}
}
function addChat(list){
  const first=chatSince===0;if(!first&&list.length)chatAt=Date.now();
  for(const m of list){const i=+m.i;if(!(i>chatSince))continue;chatSince=i;const sys=m.n==='\u2605';chatLog.push({c:m.c==='g'?'g':'w',n:String(m.n||''),g:String(m.g||''),m:String(m.m||''),me:!!m.me,sys:sys});if(!sys&&!first){const who=m.me?SC.hero:peers.find(p=>p.s&&p.s.n===m.n);if(who)who.say={m:String(m.m||'').slice(0,60),t:SC.t+6};}if(sys){if(!first)announce('\u2605 '+String(m.m||''));}else if(!first&&tab!=='chat'&&!m.me)chatUnread++;}
  if(chatLog.length>120)chatLog.splice(0,chatLog.length-120);
  const l=$('chatList');if(l){l.innerHTML=chatRows();l.scrollTop=l.scrollHeight;}
}
function chatRows(){
  const rows=chatLog.filter(m=>m.c===chatCh).slice(-60);
  if(!rows.length)return '<p class="hint">'+(chatCh==='g'?'עוד אין הודעות בגילדה.':'עוד אין הודעות. תהיה הראשון.')+'</p>';
  return rows.map(m=>m.sys?'<div class="cl" style="color:var(--gold)">\u2605 <span dir="auto">'+esc(m.m)+'</span></div>':'<div class="cl'+(m.me?' me':'')+'"><b>'+(m.g?'['+esc(m.g)+'] ':'')+esc(m.n)+'</b> <span dir="auto">'+esc(m.m)+'</span></div>').join('');
}
function renderChat(){
  if(!ONLINE)return '<h2>צ\'אט</h2><p class="hint">הצ\'אט עובד רק במצב מקוון, מול השרת.</p>';
  chatUnread=0;
  return '<div class="seg"><button class="btn sm'+(chatCh==='w'?' pri':'')+'" data-act="chatCh" data-c="w">כולם</button><button class="btn sm'+(chatCh==='g'?' pri':'')+'" data-act="chatCh" data-c="g">גילדה</button><span class="hint">'+L(onlineN)+' מחוברים עכשיו</span></div>'+
    '<div id="chatList">'+chatRows()+'</div><div class="chatSend"><input type="text" id="chatIn" maxlength="160" placeholder="כתוב הודעה" autocomplete="off" enterkeyhint="send"><button class="btn pri" data-act="say">שלח</button></div>'+
    '<p class="hint">שמור על שפה מכבדת. קללות, הטרדה ופרסום מביאים להשתקה.</p>';
}
async function say(){
  const el=$('chatIn');if(!el)return;const m=el.value.trim();if(!m)return;el.value='';if(m==='מעגל הנצח'){tryEgg('circle');return;}
  let j=null;try{j=await rpc('say',{m:m,g:chatCh==='g'});}catch(e){}
  const r=j&&j.result;if(!r||!r.ok){toast(r&&r.msg||'ההודעה לא נשלחה');if(!el.value)el.value=m;return;}
  beatT=99;
}
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target&&e.target.id==='chatIn'){e.preventDefault();say();}});
function renderChatBar(){
  const el=$('chatBar');if(!el)return;if(!ONLINE||demo||!S){el.style.display='none';return;}el.style.display='';
  const m=Date.now()-chatAt<180000?chatLog[chatLog.length-1]:null,t=(chatUnread?'('+chatUnread+') ':'')+(m?(m.g?'['+m.g+'] ':'')+m.n+': '+m.m:'צ\'אט · '+onlineN+' מחוברים עכשיו');
  if(el.textContent!==t)el.textContent=t;
}
function loadGuild(){if(ONLINE&&!demo)send('gget',{});}
function siegeLine(){
  const s=siegeInfo(Date.now());
  return s.on?'המצור פעיל עכשיו, נשארו '+s.left+' דקות. כל חיסול של חבר גילדה נספר.':'המצור הבא בשבת ב-21:00, בעוד '+(s.next>=1440?Math.floor(s.next/1440)+' ימים':s.next>=60?Math.floor(s.next/60)+' שעות':s.next+' דקות')+'.';
}
function renderGuild(){
  let h='<h2>גילדה</h2>';if(!ONLINE)return h+'<p class="hint">גילדות עובדות רק במצב מקוון, מול השרת.</p>';
  const g=guild.mine,hold=guild.holder;
  h+='<div class="card"><p class="hint"><b>מצור הטירה</b> · '+siegeLine()+' הגילדה שמחסלת הכי הרבה בחצי השעה הזו מחזיקה בטירה שבוע, וכל חבריה מקבלים '+L('+10%')+' ניסיון וזהב.</p><div class="kv"><span>מחזיקה בטירה</span><b>'+(hold?esc(hold.name)+' ['+esc(hold.tag)+']':'אף גילדה')+'</b></div></div>';
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
    :'<p class="hint">ענה על השאלה כדי לקבוע סיסמה חדשה:</p><p><b>'+esc(SECRET_Q[fg.q]||'')+'</b></p><input type="text" id="fgA" maxlength="60" placeholder="התשובה שלך" autocomplete="off">'+pwInput('fgP','סיסמה חדשה, לפחות 8 תווים','new-password'))+
    (msg?'<p class="hint" style="color:var(--bad)">'+esc(msg)+'</p>':'')+'<div class="acts"><button class="btn" data-act="authBack">חזרה</button><button class="btn pri" data-act="forgotGo">המשך</button></div>');
}
async function forgotGo(){
  let r=null;
  if(fg.q==null){const u=($('fgUser').value||'').trim();if(u.length<3){showForgot('שם משתמש קצר מדי');return;}
    try{r=await post({kind:'forgot',args:{user:u}});}catch(e){}
    if(!r||!r.j||!r.j.ok){showForgot('אין חיבור לשרת. נסה שוב');return;}fg={user:u,q:r.j.q};showForgot();return;}
  const a=$('fgA').value||'',p=$('fgP').value||'';if(p.length<8){showForgot('הסיסמה צריכה לפחות 8 תווים');return;}
  try{r=await post({kind:'recover',args:{user:fg.user,a:a,pass:p}});}catch(e){}
  if(!r||!r.j){showForgot('אין חיבור לשרת. נסה שוב');return;}if(!r.j.ok){showForgot(r.j.msg||'הפעולה נכשלה');return;}
  setSession({token:r.j.token,user:r.j.user});fg={user:'',q:null};openModal('<h3>מעגל הנצח</h3><p class="hint">מתחבר...</p>');await startOnline();
}
function loadMe(){
  if(!ONLINE||window.EC_MOCK||!session)return;
  post({kind:'whoami',args:{}},session.token).then(r=>{if(r.j&&r.j.ok){me={secret:!!r.j.secret,admin:!!r.j.admin};panelDirty=true;}}).catch(()=>{});
}

/* ---------- event announcements in the middle of the screen ---------- */
// From five minutes before an event, once a minute, and once more when it opens.
const annPrev={},annMark={},annLive={},annQ=[];let annT=0,annShow=0,annAge=99,annGap=0,annRemind=200;
function announce(txt,live){annQ.push({t:txt,live:!!live});if(annQ.length>4)annQ.shift();}
function updateAnnounce(dt){
  const el=$('annc');if(!el)return;
  // A message starts a little below the middle, drifts up for most of a minute and fades. A newer one may replace it after a few seconds.
  if(annShow>0){annShow-=dt;annAge+=dt;if(annShow<=0||(annQ.length&&annAge>6)){el.classList.remove('on');annShow=0;annGap=.7;}}
  else if((annGap-=dt)<=0&&annQ.length&&S&&!demo){const a=annQ.shift();el.textContent=a.t;el.classList.toggle('live',a.live);
    el.style.transition='none';el.style.transform='translateY(0)';void el.offsetWidth;el.style.transition='opacity .7s, transform 52s linear';el.style.transform='translateY(-'+Math.round(H*.26)+'px)';
    el.classList.add('on');annShow=50;annAge=0;snd(a.live?'boss':'ok');}
  if(!S||demo||(annT+=dt)<1)return;annT=0;
  const now=Date.now(),list=EVENTS.map(e=>{const t=e.tiered?evTier(S.lvl):0;return {id:e.id,n:e.n+(t?' '+t:''),s:evNext(e,now),d:e.d,t:t,tiered:e.tiered};}),sg=siegeInfo(now);
  list.push({id:'siege',n:'מצור הטירה',s:sg.on?1e9:sg.next*60-new Date(now).getSeconds(),d:'כל חיסול של חבר גילדה נספר'});
  for(const e of list){const prev=annPrev[e.id];annPrev[e.id]=e.s;
    if(prev!=null&&prev<=90&&e.s>prev+120){annMark[e.id]=0;announce(e.tiered?e.n+' נפתחה! '+(A.keys>0?'לחץ על שגר למצודה':'צריך מפתח כדי להיכנס'):e.n+' התחיל! '+String(e.d).split('.')[0],true);continue;}
    if(e.s<=300&&e.s>5){const m=Math.ceil(e.s/60);if(annMark[e.id]!==m&&prev!=null){annMark[e.id]=m;announce(e.n+' מתחיל בעוד '+(m===1?'דקה':m+' דקות'));
      if(e.tiered&&m===4&&e.t&&!(A.keys>0))announce('אין לך מפתח למצודה. '+((A.shards||0)>=KEY_SHARDS?'צור אחד באירועים':'חסרים '+(KEY_SHARDS-(A.shards||0))+' שברי ארגמן'));
      if(e.tiered&&(m===5||m===2)){if(!e.t)announce('הכניסה ל'+e.n+' מרמה '+TIER_MIN[0]+'. חסרות לך '+(TIER_MIN[0]-S.lvl)+' רמות');else if(e.t<7)announce('עוד '+(TIER_MIN[e.t]-S.lvl)+' רמות לדרגה '+(e.t+1)+'. תספיק?');}}}}
  // While an event runs: how much is left, the moment its goal is reached, and what was missed when it closes.
  const ev=A.ev||{},wins=evWindows(now,1);
  for(const w of wins){const e=w.e;if(!e.obj)continue;const rec=ev[w.key]||{},have=Math.min(rec[e.obj[0]]||0,e.obj[1])+(e.obj[0]==='k'&&w.live?0:0),done=have>=e.obj[1],st=annLive[w.key]||(annLive[w.key]={});
    if(done&&!rec.c&&!st.done){st.done=1;announce('השלמת את '+e.n+'! הפרס מחכה באירועים',true);}
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
  if(ONLINE){pend.t+=dt;if(pend.t>8){pend.t=0;if(pend.kills||pend.casts||(party.code&&SC.zi>=0&&SC.mode==='farm'&&!document.hidden))flushTick();}
    if(!demo&&(beatT+=dt)>(peers.length?2.5:5)){beatT=0;beat();}}
  else if((saveT+=dt)>8){saveT=0;if(localDirty){localDirty=false;saveLocal();}}
  updateTut(dt);updateAnnounce(dt);
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
if(typeof window!=='undefined')window.EC={duelAct,get A(){return A;},get S(){return S;},get C(){return C;},set C(v){C=v;},SC,G,send,act,frame,enterZone,pend,flushTick,syncBoss,spawnBoss,touch,get demo(){return demo;}};
boot();

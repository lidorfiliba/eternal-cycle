import * as G from './core.js';
const {AURAS,partyXp,GUILD_FEE,SECRET_Q,siegeInfo,FLOORS,floorMin,zs,canFloor,afkFloor,EVENTS,QUIZ,localMin,evWindows,evMods,evNext,quizFor,BASEZ,canEnter,PARTY_XP,setEnv,CAP,ZONES,MHP,ZSPR,CLS,STATN,RAR,TIERN,WINGN,AFF,POOL,SLOTS,SLOTN,SETN,SETB,rslot,isSet,setCounts,UPCH,clamp,need,pois,tzParts,dayKey,seasonKey,AFK,SHARED,newAccount,newChar,bind,ensureDay,itemVals,itemName,itemScore,calc,zoneInfo,afkZone,autoAlloc,addXp,rollAff,makeItem,rollRar,sellVal,stash,gainItem,rollLoot,offline,canReset,resetGain,doReset,upCost,upChance,upgrade,openBox,passReward,passLevel,TASKS,fighter,simDuel,BOSSN,GOLD_SHOP,RESET_SHOP,SEASON_SHOP,totalResets,slotsOpen,anyEq,QUESTS,give,numOr,int,gearOr,cleanPlayer,cleanItem,adopt,findIt,maxKps,BOTN,buildOpps,apply,BAG,MATK,SKLV,SKCD,DROPS,ARM}=G;
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
    if(j.state)setState(j.state);if(j.players)players=j.players;if(j.market){market=j.market;panelDirty=true;}if(j.party){party=j.party;panelDirty=true;}if(j.guild){guild=j.guild;panelDirty=true;}if(j.banned)showBanned(j.result&&j.result.msg);
    setNet(true);return j.result||{ok:false,msg:j.error||''};
  };
  const p=chain.then(run);chain=p.catch(()=>{});
  return p.catch(()=>{setNet(false);return {ok:false,msg:'net'};});
}
const pend={kills:0,casts:0,boss:false,t:0};
function flushTick(){
  if(!ONLINE||demo||!S)return Promise.resolve();
  if(!pend.kills&&!pend.casts&&!pend.boss)return chain;
  const a={z:SC.zi,f:SC.fl,kills:pend.kills,casts:pend.casts,boss:pend.boss},l0=S.lvl;pend.kills=0;pend.casts=0;pend.boss=false;pend.t=0;
  return send('tick',a).then(r=>afterTick(r,null,l0));
}
async function act(kind,args){await flushTick();return send(kind,args);}
function localTick(a){a.f=SC.fl;a.casts=pend.casts;pend.casts=0;const r=apply(A,'tick',a,{});localDirty=true;return r;}

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
const cv=$('cv'),ctx=cv.getContext('2d');let W=360,H=260,DPR=1;
const calm=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function resize(){const r=cv.getBoundingClientRect();DPR=Math.min(window.devicePixelRatio||1,2);W=Math.max(200,r.width);H=Math.max(140,r.height);cv.width=W*DPR;cv.height=H*DPR;}
window.addEventListener('resize',resize);if(prefs.big)document.getElementById('app').classList.add('wide');if(prefs.big)document.getElementById('bigBtn').textContent='הקטן';
const MW=1500,TW=1150;
const TOWN={n:'כפר המעגל',sky:['#141033','#4a3a78'],sil:'#0c0a20',amb:'#ffe9a8',kind:'town'};
const NPCS=[{x:270,n:'הנפח',tab:'gear',c:'blade',col:'#ff8a4d',spr:'n_smith'},{x:440,n:'הסוחרת',tab:'shop',c:'hunter',col:'#f2c14e',spr:'n_merch'},{x:610,n:'שומר המעגל',tab:'char',c:'storm',col:'#8be28b',spr:'n_guard'},{x:780,n:'כרוז העונה',tab:'pass',c:'hunter',col:'#5fd4ff',spr:'n_herald'},{x:950,n:'שומר הזירה',tab:'arena',c:'blade',col:'#6fe39a',spr:'n_arena'}];
const SC={t:0,cam:0,mons:[],boss:null,hero:{x:110,face:1,dir:0,hp:1,atkT:0,anim:0,dead:0,mAtk:1,tgt:null,tx:null,goal:null,manual:0,buff:0,shield:0,cds:[0,0,0,0,0,0],autoSk:0,mv:false},fx:[],parts:[],nums:[],drops:[],shake:0,mode:'farm',duel:null,zi:-1,fl:0};
const amb=[];for(let i=0;i<26;i++)amb.push({x:Math.random(),y:Math.random(),s:.5+Math.random()*1.5,v:.02+Math.random()*.05});
const mapW=()=>SC.zi<0?TW:MW, gy=()=>Math.min(H*.8,H-112);
function lookOf(s){const g=it=>it?[it.t,it.r,it.p,it.season?1:0]:null,o={c:s.cls,w:g(s.eq.w),ar:g(s.eq.a),g:g(s.eq.g),r:A&&A.chars&&A.chars.includes(s)?totalResets(A):s.resets|0};
  const sc=setCounts(s);let bz=-1,bn=0;for(const z in sc)if(sc[z]>bn){bn=sc[z];bz=+z;}if(bn>=4&&ZONES[bz])o.set=[bn,ZONES[bz].c];return o;}
function glowAmt(p,r,t){let g=p>=13?24:p>=11?16+5*Math.sin(t*6):p>=9?12:p>=7?7:0;if(r>=3)g=Math.max(g,6);return g;}
function gearColor(g,t,fallback){if(!g)return fallback;if(g[2]>=15)return 'hsl('+((t*90)%360)+',95%,68%)';return RAR[g[1]].c;}
const WPAL={1:['#2f7a45','#b6ef86'],2:['#2260c9','#a8e8ff'],3:['#c42d18','#ffbe55'],4:['#caa02e','#fff8d2'],5:['#35106b','#d596ff'],6:['#1b6ea8','#effcff'],7:['#a8740a','#fff1a8'],8:['#ff4fa3','#7df9ff'],s:['#a637ee','#62f3e2']};
const SPR={"mh":{"w":128,"h":69,"ax":28,"ay":69,"bh":52,"a":{"idle":[0,8],"run":[1,8],"atk":[2,6],"atk2":[3,6],"hit":[4,4],"die":[5,6]}},"ew":{"w":94,"h":69,"ax":26,"ay":69,"bh":58,"a":{"idle":[0,8],"run":[1,8],"atk":[2,8],"hit":[3,4],"die":[4,5]}},"hu":{"w":91,"h":66,"ax":42,"ay":66,"bh":42,"a":{"idle":[0,8],"run":[1,8],"atk":[2,7],"atk2":[3,5],"hit":[4,3],"die":[5,8]}},"mush":{"w":71,"h":45,"ax":32,"ay":45,"bh":37,"a":{"idle":[0,4],"run":[1,8],"atk":[2,8],"hit":[3,4],"die":[4,4]}},"gob":{"w":88,"h":46,"ax":44,"ay":46,"bh":36,"a":{"idle":[0,4],"run":[1,8],"atk":[2,8],"hit":[3,4],"die":[4,4]}},"skel":{"w":98,"h":59,"ax":32,"ay":57,"bh":51,"a":{"idle":[0,4],"run":[1,4],"atk":[2,8],"hit":[3,4],"die":[4,4]}},"eye":{"w":56,"h":41,"ax":27,"ay":33,"bh":33,"a":{"idle":[0,8],"atk":[1,8],"hit":[2,4],"die":[3,4]}},"worm":{"w":77,"h":54,"ax":30,"ay":54,"bh":45,"a":{"idle":[0,9],"run":[1,9],"atk":[2,16],"hit":[3,3],"die":[4,8]}},"skel_f":{"w":98,"h":59,"ax":32,"ay":57,"bh":51,"a":{"idle":[0,4],"run":[1,4],"atk":[2,8],"hit":[3,4],"die":[4,4]}},"gob_r":{"w":88,"h":46,"ax":44,"ay":46,"bh":36,"a":{"idle":[0,4],"run":[1,8],"atk":[2,8],"hit":[3,4],"die":[4,4]}},"eye_p":{"w":56,"h":41,"ax":27,"ay":33,"bh":33,"a":{"idle":[0,8],"atk":[1,8],"hit":[2,4],"die":[3,4]}},"skel_g":{"w":98,"h":59,"ax":32,"ay":57,"bh":51,"a":{"idle":[0,4],"run":[1,4],"atk":[2,8],"hit":[3,4],"die":[4,4]}},"n_smith":{"w":128,"h":69,"ax":28,"ay":69,"bh":52,"a":{"idle":[0,8]}},"n_merch":{"w":91,"h":66,"ax":42,"ay":66,"bh":42,"a":{"idle":[0,8]}},"n_guard":{"w":94,"h":69,"ax":26,"ay":69,"bh":58,"a":{"idle":[0,8]}},"n_herald":{"w":91,"h":66,"ax":42,"ay":66,"bh":42,"a":{"idle":[0,8]}},"n_arena":{"w":128,"h":69,"ax":28,"ay":69,"bh":52,"a":{"idle":[0,8]}},"mush_d":{"w":71,"h":45,"ax":32,"ay":45,"bh":37,"a":{"idle":[0,4],"run":[1,8],"atk":[2,8],"hit":[3,4],"die":[4,4]}},"worm_i":{"w":77,"h":54,"ax":30,"ay":54,"bh":45,"a":{"idle":[0,9],"run":[1,9],"atk":[2,16],"hit":[3,3],"die":[4,8]}},"gob_g":{"w":88,"h":46,"ax":44,"ay":46,"bh":36,"a":{"idle":[0,4],"run":[1,8],"atk":[2,8],"hit":[3,4],"die":[4,4]}},"skel_d":{"w":98,"h":59,"ax":32,"ay":57,"bh":51,"a":{"idle":[0,4],"run":[1,4],"atk":[2,8],"hit":[3,4],"die":[4,4]}}};
const IMG={},CLSSPR={blade:'mh',storm:'ew',hunter:'hu'};
function loadSprites(){for(const k in SPR){const im=new Image();im.src='assets/'+k+'.png';IMG[k]=im;}}
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
const wcv=document.createElement('canvas');wcv.width=144;wcv.height=112;const wctx=wcv.getContext('2d');
// Eight wing styles by tier: leaf, storm feathers, flame, angel, bat, ice shards, double golden, energy blades with a halo.
function drawWings(x,y,g,t,k){
  const T=clamp(g[0]|0,1,8),c=wctx,flap=Math.sin(t*3)*.16;let pal=g[3]?WPAL.s:WPAL[T];
  if(T===8&&!g[3]){const h=(t*70)%360;pal=['hsl('+h+',90%,58%)','hsl('+((h+120)%360)+',95%,78%)'];}
  c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,144,112);c.translate(72,72);c.scale(.5,.5);
  const grad=(len,a,b)=>{const gr=c.createLinearGradient(0,0,len,0);gr.addColorStop(0,a||pal[0]);gr.addColorStop(1,b||pal[1]);return gr;};
  const feather=(len,w)=>{c.beginPath();c.moveTo(0,0);c.quadraticCurveTo(len*.5,-w,len,-2);c.quadraticCurveTo(len*.55,w*.8,0,3);c.fill();};
  for(const side of [-1,1]){c.save();c.scale(side,1);
    if(T===5){ // bat membrane with finger bones
      c.save();c.rotate(-.5+flap*1.4);c.fillStyle=grad(86);c.beginPath();c.moveTo(0,0);c.lineTo(34,-46);c.lineTo(86,-34);
      c.quadraticCurveTo(70,-16,78,2);c.quadraticCurveTo(58,-2,56,20);c.quadraticCurveTo(38,10,30,28);c.quadraticCurveTo(18,10,0,6);c.fill();
      c.strokeStyle=pal[1];c.lineWidth=2.5;c.beginPath();for(const p of [[86,-34],[78,2],[56,20],[30,28]]){c.moveTo(34,-46);c.lineTo(p[0],p[1]);}c.moveTo(0,0);c.lineTo(34,-46);c.stroke();c.restore();
    }else if(T===6){ // ice shards
      for(let i=5;i>=0;i--){c.save();c.rotate(-(.05+i*.27)+flap*(1+i*.2));const len=34+i*9;c.fillStyle=grad(len);c.beginPath();c.moveTo(0,-2);c.lineTo(len*.55,-9-i);c.lineTo(len,0);c.lineTo(len*.5,6);c.lineTo(0,3);c.fill();
        c.strokeStyle='rgba(255,255,255,.75)';c.lineWidth=1.5;c.beginPath();c.moveTo(4,0);c.lineTo(len-3,0);c.stroke();c.restore();}
    }else if(T===8){ // energy blades
      for(let i=6;i>=0;i--){c.save();c.rotate(-(.0+i*.26)+flap*(1+i*.3));const len=42+i*9;c.fillStyle=grad(len);c.globalAlpha=.9;c.beginPath();c.moveTo(6,-3);c.lineTo(len,-1);c.lineTo(len+10,0);c.lineTo(len,1);c.lineTo(6,3);c.fill();
        c.globalAlpha=1;c.fillStyle='#fff';c.fillRect(8,-.8,len-8,1.6);c.restore();}
    }else{ // feathered families: leaf, storm, flame, angel, golden double
      const n=T===1?3:T===2?5:T===3?5:T===4?7:8,layers=T===7?2:1;
      for(let L=layers-1;L>=0;L--)for(let i=n-1;i>=0;i--){c.save();
        const wob=T===3?Math.sin(t*9+i*1.7)*.08:0;c.rotate(-(.15+i*(T===1?.42:.26))+flap*(1+i*.25)+wob+L*.5);
        const len=(T===1?26:T===3?30:24)+i*(T>=4?8:6)+T*3-L*14;c.fillStyle=L?grad(len,pal[1],'#fff'):grad(len);
        if(T===3){c.beginPath();c.moveTo(0,0);c.bezierCurveTo(len*.3,-16,len*.6,6,len,-10+Math.sin(t*12+i)*4);c.bezierCurveTo(len*.7,10,len*.3,2,0,4);c.fill();}
        else feather(len,T===1?15:T>=4?12:11);
        c.restore();}
    }
    c.restore();}
  if(T===8||T===4||T===7){c.strokeStyle=pal[1];c.lineWidth=T===8?4:3;c.globalAlpha=T===8?.9:.6;c.beginPath();c.ellipse(0,-64,20,6,0,0,7);c.stroke();c.globalAlpha=1;}
  ctx.save();ctx.imageSmoothingEnabled=false;const gl=Math.max(glowAmt(g[2],g[1],t),T>=5?5+T:0);if(gl){ctx.shadowColor=pal[1];ctx.shadowBlur=gl;}
  ctx.globalAlpha=.95;ctx.drawImage(wcv,Math.round(x-72*k),Math.round(y-72*k),144*k,112*k);ctx.restore();
  if(T>=6&&!calm&&Math.random()<.2)SC.parts.push({x:x+(Math.random()-.5)*60*k,y:y-Math.random()*30*k,vx:0,vy:T===6?14:-16,life:.7,c:pal[1],s:2});
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
// The weapon carried on the back: its shape follows the item tier (six designs per class), its glow the upgrade level.
const TCOL=['#9aa3ad','#c9d2dc','#bfe3ff','#e8c27a','#9fe8ff','#ff8a4d','#a487ff','#ffd75e','#b07cff','#8fe6ff','#ffe27a','#ff6b8a'];
function drawBackWeapon(x,y,look,t,k,flip){
  const w=look.w;if(!w)return;const tier=clamp(w[0]|0,1,12),st=Math.floor((tier-1)/2),p=w[2]|0,base=TCOL[tier-1],edge=p>=15?'hsl('+((t*90)%360)+',95%,72%)':RAR[w[1]].c,gl=glowAmt(p,w[1],t);
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
  if(p>=9&&!calm&&Math.random()<(p>=13?.3:.12))SC.parts.push({x:x+(flip?1:-1)*(4+Math.random()*10)*k,y:y-(6+Math.random()*22)*k,vx:0,vy:-14,life:.6,c:edge,s:2});
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
  if(look.g&&!dead)drawWings(x-(flip?-1:1)*5*k,y-m.bh*k*.62,look.g,t,k);
  if(look.w&&!dead&&!look.spr)drawBackWeapon(x-(flip?-1:1)*7*k,y-m.bh*k*.5,look,t,k,flip);
  let an='idle',fi=Math.floor(t*8);
  if(dead){an='die';fi=Math.min(frames(key,'die')-1,Math.floor((dead===true?9:dead)*8));}
  else if(anim>0){an=look.sk&&m.a.atk2?'atk2':'atk';fi=Math.floor((1-anim)*frames(key,an));}
  else if(mv){an='run';fi=Math.floor(t*12)%frames(key,'run');}
  else fi=fi%frames(key,'idle');
  let gl=0;if(look.w)gl=Math.max(gl,glowAmt(look.w[2],look.w[1],t));if(look.ar)gl=Math.max(gl,glowAmt(look.ar[2],look.ar[1],t)*.7);if(fury)gl=Math.max(gl,14);
  const sheet=armorSheet(key,look);
  if(mv&&maxP>=11&&!dead&&!calm)spr(key,an,fi-1,x-(flip?-1:1)*12*sc,y,k,flip,null,0,.28,sheet); // afterimage at +11
  spr(key,an,fi,x,y,k,flip,gc,dead?0:anim>0?Math.min(gl,6):gl,null,sheet);
  if(maxP>=13&&!dead&&!calm&&Math.random()<.35)SC.parts.push({x:x+(Math.random()-.5)*44*sc,y:y-Math.random()*m.bh*k,vx:0,vy:-20,life:.8,c:gc,s:2});
}
function drawMon(m,zi,t,flip,sc){
  const z=ZONES[zi],key=z.spr,sm=SPR[key],k=(m.boss?3.6:2)*sc,lift=z.fly?(26+Math.sin(t*3+m.ph)*5)*sc*(m.boss?1.6:1):0,y=m.y-lift;
  ctx.fillStyle='rgba(0,0,0,.35)';ctx.beginPath();ctx.ellipse(m.x,m.y+1,(m.boss?36:18)*sc,(m.boss?8:4)*sc,0,0,7);ctx.fill();
  if(m.boss){ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=.3+.12*Math.sin(t*4);const R=sm.bh*k*.8,gr=ctx.createRadialGradient(m.x,y-sm.bh*k*.5,4,m.x,y-sm.bh*k*.5,R);gr.addColorStop(0,'#ff5c7a');gr.addColorStop(1,'transparent');ctx.fillStyle=gr;ctx.beginPath();ctx.arc(m.x,y-sm.bh*k*.5,R,0,7);ctx.fill();ctx.restore();}
  let an='idle',fi=Math.floor(t*8+m.ph);
  if(m.die>0){an='die';fi=Math.floor((1-m.die/.45)*frames(key,'die'));}
  else if(m.hit>.45){an='hit';fi=Math.floor((1-m.hit)/.55*frames(key,'hit'));}
  else if(m.atkA>0){an='atk';fi=Math.floor((1-m.atkA/.5)*frames(key,'atk'));}
  else if(m.mv&&sm.a.run){an='run';fi=Math.floor(t*10+m.ph)%frames(key,'run');}
  else fi=fi%frames(key,'idle');
  spr(key,an,fi,m.x,y,k,flip,m.hit>.6?'#fff':m.boss?'#ff5c7a':null,m.hit>.6?10:m.boss?8:0,m.die>0?clamp(m.die/.2,0,1):null);
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
      if(z.kind==='brute'||z.kind==='town'||zi===6)y=Math.round(y*3)/3;
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
  }
  if(combo){SC.fx.push({k:'ring',x:targets[0]?targets[0].x:hx,y:hy-20,life:.4,c:c});if(!calm)SC.shake=.25;}
}
function drawFx(dt){
  ctx.save();ctx.globalCompositeOperation='lighter';
  SC.fx=SC.fx.filter(f=>(f.life-=dt)>0);
  for(const f of SC.fx){ctx.strokeStyle=f.c;ctx.fillStyle=f.c;ctx.shadowColor=f.c;ctx.shadowBlur=12;
    if(f.k==='slash'){const a=clamp(f.life/.22,0,1);ctx.globalAlpha=a;ctx.lineWidth=(f.big?7:4)*a+1;ctx.beginPath();ctx.arc(f.x,f.y,f.big?42:26,f.rot-1.1,f.rot+1.1);ctx.stroke();}
    else if(f.k==='cres'){const a=clamp(f.life/f.d,0,1),R=f.R*(1.25-a*.25);ctx.globalAlpha=a;ctx.save();ctx.translate(f.x,f.y);ctx.rotate(f.rot+(1-a)*f.sp);ctx.beginPath();ctx.arc(0,0,R,-1.2,1.2);ctx.arc(-R*.35,0,R*.82,.95,-.95,true);ctx.closePath();ctx.fill();ctx.restore();}
    else if(f.k==='met'){const u=1-clamp(f.life/f.d,0,1),x=f.x0+(f.x-f.x0)*u,y=f.y0+(f.y-f.y0)*u;ctx.globalAlpha=1;ctx.lineWidth=7;ctx.lineCap='round';const gr=ctx.createLinearGradient(x-(f.x-f.x0)*.25,y-(f.y-f.y0)*.25,x,y);gr.addColorStop(0,'transparent');gr.addColorStop(1,f.c);ctx.strokeStyle=gr;ctx.beginPath();ctx.moveTo(x-(f.x-f.x0)*.25,y-(f.y-f.y0)*.25);ctx.lineTo(x,y);ctx.stroke();ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x,y,5,0,7);ctx.fill();
      if(f.life<dt*1.5&&!f.hit){f.hit=1;burst(f.x,f.y,f.c,16);SC.fx.push({k:'ring',x:f.x,y:f.y+6,life:.35,c:f.c,r:60});}}
    else if(f.k==='pillar'){const a=clamp(f.life/f.d,0,1);ctx.globalAlpha=a*.85;const w=(10+26*(1-a));const gr=ctx.createLinearGradient(f.x-w,0,f.x+w,0);gr.addColorStop(0,'transparent');gr.addColorStop(.5,f.c);gr.addColorStop(1,'transparent');ctx.fillStyle=gr;ctx.fillRect(f.x-w,0,w*2,f.y);ctx.fillStyle='#fff';ctx.globalAlpha=a*.6;ctx.fillRect(f.x-2,0,4,f.y);}
    else if(f.k==='line'){ctx.globalAlpha=clamp(f.life/.15,0,1);ctx.lineWidth=f.w;ctx.beginPath();ctx.moveTo(f.x1,f.y1);ctx.lineTo(f.x2,f.y2);ctx.stroke();}
    else if(f.k==='bolt'){ctx.globalAlpha=clamp(f.life/.2,0,1);ctx.lineWidth=3;ctx.beginPath();f.pts.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.stroke();}
    else if(f.k==='ring'){const a=Math.min(1,f.life/.4),R=f.r||90;ctx.globalAlpha=a;ctx.lineWidth=4*a+1;ctx.beginPath();ctx.ellipse(f.x,f.y,(1-a)*R+10,((1-a)*R+10)*.35,0,0,7);ctx.stroke();}
    else if(f.k==='beam'){const a=clamp(f.life/1.2,0,1);ctx.globalAlpha=a*.8;const g=ctx.createLinearGradient(0,0,0,f.y);g.addColorStop(0,'transparent');g.addColorStop(1,f.c);ctx.fillStyle=g;ctx.fillRect(f.x-7,0,14,f.y);}
    else if(f.k==='lvl'){const a=f.life/.9;ctx.globalAlpha=a;ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(f.x,f.y-(1-a)*80,30,9,0,0,7);ctx.stroke();}
  }
  ctx.shadowBlur=0;
  SC.parts=SC.parts.filter(p=>(p.life-=dt)>0);if(SC.parts.length>260)SC.parts.splice(0,SC.parts.length-260);
  for(const p of SC.parts){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=160*dt;ctx.globalAlpha=clamp(p.life*2,0,1);ctx.fillStyle=p.c;ctx.fillRect(p.x,p.y,p.s,p.s);}
  // loot orbs fly to the hero
  const h=SC.hero;SC.drops=SC.drops.filter(d=>d.life>0);
  for(const d of SC.drops){d.life-=dt;d.age+=dt;if(d.age<.45){d.x+=d.vx*dt;d.y+=d.vy*dt;d.vy+=500*dt;if(d.y>gy()-6){d.y=gy()-6;d.vy=0;d.vx=0;}}
    else{const dx=h.x-d.x,dy=gy()-45-d.y,dist=Math.hypot(dx,dy);if(dist<16){d.life=0;continue;}const v=Math.min(dist,520*dt*(1+d.age));d.x+=dx/dist*v;d.y+=dy/dist*v;}
    ctx.globalAlpha=1;ctx.fillStyle=d.c;ctx.shadowColor=d.c;ctx.shadowBlur=10;ctx.beginPath();ctx.arc(d.x,d.y,d.s,0,7);ctx.fill();}
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
const SFX={pull:['whoosh'],ult:['ult'],hit:['hit0','hit1','hit2'],crit:['crit0','crit1'],skill:['skill0','skill1'],hurt:['hurt0','hurt1'],kill:['kill'],coin:['coin'],rare:['rare'],boss:['roar'],slam:['slam']};
const SFXVOL={pull:.6,ult:.8,hit:.5,crit:.75,skill:.6,hurt:.35,kill:.4,coin:.3,rare:.6,boss:.7,slam:.8},sfxBuf={};let sfxAsked=false;
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
function newMon(home,zi){const z=zs(zi,SC.fl);return {home:home,x:home,y:gy(),hp:z.hp,max:z.hp,hit:0,die:0,ph:Math.random()*6,resp:0,stun:0,atkT:1,pull:null};}
function enterZone(z,side,f){
  const h=SC.hero;SC.zi=z;SC.fl=z<0?0:clamp(f|0,0,FLOORS-1);SC.mons=[];SC.boss=null;SC.drops=[];SC.fx=[];SC.nums=[];SC.parts=[];h.tgt=null;h.goal=null;h.tx=null;h.manual=0;
  h.x=side==='R'?mapW()-110:110;h.face=side==='R'?-1:1;
  if(h.climb&&h.climb.ph==='wait'){h.climb.ph='in';h.climb.t=.45;h.x=side==='R'?mapW()-50:50;}else h.climb=null;
  if(z>=0)for(let i=0;i<8;i++)SC.mons.push(newMon(300+i*140+Math.random()*50,z));
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
  if(rep.notable)for(const it of rep.notable){add(RAR[it.r].c,5.5);SC.fx.push({k:'beam',x:m.x,y:m.y,life:1.2,c:RAR[it.r].c});toast(RAR[it.r].n+': '+itemName(it,S.cls),it.r);}
  else if(rep.items)add('#b9b4c7',4);
}
function afterXp(ups){
  if(!(ups>0))return;snd('lvl');statsDirty=true;panelDirty=true;const h=SC.hero;
  SC.fx.push({k:'lvl',x:h.x,y:gy(),life:.9,c:'#f2c14e'});addNum(h.x,gy()-120,'רמה '+S.lvl,'#f2c14e',true);
  for(let i=0;i<6;i++)if(S.lvl>=SKLV[i]&&S.lvl-ups<SKLV[i]&&i>0)toast('כישור חדש: '+CLS[S.cls].sk[i]);
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
  const rep=r.rep||{},src=m||{x:SC.hero.x+SC.hero.face*26,y:gy()};
  if(!ONLINE||rep.items||rep.gems||rep.boxes||rep.notable)dropOrbs(src,rep);
  if(rep.items||rep.boxes)panelDirty=true;
  if(rep.boss||rep.bossDenied){bossPending=false;if(rep.opened!=null)toast('השער אל '+ZONES[rep.opened].n+' נפתח');if(rep.bossDenied)toast('השרת לא אישר את הניצחון על הבוס');}
  if(r.partyN!=null)partyN=r.partyN;if(r.auras&&r.auras.join()!==auras.join()){auras=r.auras;statsDirty=true;panelDirty=true;}
  if(S.lvl>l0)afterXp(S.lvl-l0);
  statsDirty=true;syncBoss();
}
function onKill(m,zi){
  const z=ZONES[zi];
  if(demo){burst(m.x,m.y-24,z.c,10);if(m.boss)SC.boss=null;return;}
  if(m.boss){
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
function cast(i,auto){
  const h=SC.hero;if(SC.mode!=='farm'||SC.zi<0||h.dead>0||h.climb||S.lvl<SKLV[i]||h.cds[i]>0)return false;
  const col=gearColor(lookOf(S).w,SC.t,CLS[S.cls].c),melee=S.cls==='blade';
  if(i===0){const cx=melee||!h.tgt?h.x+(melee?0:h.face*120):h.tgt.x,R=melee?135:120,ts=alive().filter(m=>Math.abs(m.x-cx)<R*(m.boss?1.4:1));
    if(!ts.length&&auto)return false;snd('skill');h.anim=1;h.skA=.3;attackFx(S.cls,h.x,gy(),h.face,ts,true,col);if(!ts.length)SC.fx.push({k:'ring',x:cx,y:gy()-20,life:.4,c:col});
    SC.nums.push({x:h.x,y:gy()-135,txt:CLS[S.cls].sk[0]+'!',c:col,s:18,life:1});for(const m of ts)strike(m,3,col,true);}
  else if(i===1){snd('pull');for(const m of alive()){if(m.boss||Math.abs(m.x-h.x)>380)continue;m.pull=h.x+(m.x>h.x?1:-1)*(34+Math.random()*44);m.stun=1.8;m.ag=true;}
    SC.fx.push({k:'ring',x:h.x,y:gy()-20,life:.4,c:'#5fd4ff',r:300});SC.nums.push({x:h.x,y:gy()-135,txt:CLS[S.cls].sk[1]+'!',c:'#5fd4ff',s:18,life:1});}
  else if(i===3){const r=CLS[S.cls].range*1.4+40;let m=h.tgt&&h.tgt.die<=0&&!h.tgt.resp?h.tgt:null;
    if(!m){let bd=r;for(const o of alive()){const d=Math.abs(o.x-h.x);if(d<bd){bd=d;m=o;}}}
    if(!m){if(!auto)toast('אין מטרה בטווח');return false;}
    snd('skill');h.face=m.x>=h.x?1:-1;h.anim=1;h.skA=.35;attackFx(S.cls,h.x,gy(),h.face,[m],true,col);burst(m.x,gy()-50,col,26);SC.fx.push({k:'ring',x:m.x,y:gy()-30,life:.35,c:col,r:70});
    SC.fx.push({k:'pillar',x:m.x,y:gy(),life:.45,d:.45,c:col});if(melee)SC.fx.push({k:'cres',x:m.x,y:gy()-40,R:52,rot:h.face<0?3.14:0,sp:.9*h.face,life:.3,d:.3,c:col});
    SC.nums.push({x:h.x,y:gy()-135,txt:CLS[S.cls].sk[3]+'!',c:col,s:18,life:1});strike(m,8,col,true);}
  else if(i===4){snd('fury');h.shield=5;h.hp=Math.min(C.hp,h.hp+C.hp*.3);SC.fx.push({k:'ring',x:h.x,y:gy()-40,life:.5,c:'#9fe8ff',r:90});burst(h.x,gy()-50,'#9fe8ff',20);
    addNum(h.x,gy()-100,'+'+fmt(C.hp*.3),'#6fe39a',true);SC.nums.push({x:h.x,y:gy()-135,txt:CLS[S.cls].sk[4]+'!',c:'#9fe8ff',s:18,life:1});}
  else if(i===5){const ts=alive().filter(m=>Math.abs(m.x-h.x)<560);if(!ts.length&&auto)return false;
    snd('ult');h.anim=1;h.skA=.5;for(let k=0;k<5;k++)SC.fx.push({k:'ring',x:h.x+(k-2)*200,y:gy()-20,life:.35+k*.06,c:col,r:150});
    if(S.cls==='blade')for(let k=0;k<9;k++)SC.fx.push({k:'cres',x:h.x+(k-4)*95+Math.random()*30,y:gy()-30-Math.random()*50,R:40+Math.random()*24,rot:Math.random()*6.28,sp:(Math.random()<.5?-1:1)*1.6,life:.3+k*.05,d:.3+k*.05,c:col});
    else if(S.cls==='storm'){const tg=ts.length?ts:[{x:h.x+h.face*160}];for(let k=0;k<Math.max(7,tg.length);k++){const tx=tg[k%tg.length].x+(k>=tg.length?(Math.random()-.5)*240:0),d=.35+k*.07;SC.fx.push({k:'met',x0:tx+170,y0:-30,x:tx,y:gy()-14,life:d,d:d,c:k%2?'#ff8a4d':col});}}
    else for(let k=0;k<26;k++){const tx=h.x-520+k*40+Math.random()*30;SC.fx.push({k:'line',x1:tx+70,y1:-10,x2:tx,y2:gy()-8,life:.18+k*.02,c:col,w:2});}
    for(const m of ts){burst(m.x,gy()-40,col,14);strike(m,6,col,true);}
    SC.nums.push({x:h.x,y:gy()-150,txt:CLS[S.cls].sk[5]+'!',c:'#ffd75e',s:21,life:1.2});}
  else{snd('fury');h.buff=8;SC.fx.push({k:'ring',x:h.x,y:gy()-20,life:.4,c:'#ffd75e',r:120});burst(h.x,gy()-50,'#ffd75e',24);SC.nums.push({x:h.x,y:gy()-135,txt:CLS[S.cls].sk[2]+'!',c:'#ffd75e',s:18,life:1});}
  h.cds[i]=SKCD[i];if(!auto)pend.casts++;return true;
}
function portalState(dir){ // what stands at the left (-1) or right (+1) end of the current floor
  const zi=SC.zi,fl=SC.fl;
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
    if(m.die>0){m.die-=dt;if(m.die<=0){if(m.boss)m.gone=true;else m.resp=3.5;}continue;}
    if(m.resp>0){m.resp-=dt;if(m.resp<=0){m.hp=m.max;m.x=m.home;m.dead=false;m.stun=0;m.pull=null;m.ag=false;}continue;}
    m.hit=Math.max(0,m.hit-dt*4);m.atkA=Math.max(0,(m.atkA||0)-dt);m.mv=false;
    if(m.pull!=null){m.x+=(m.pull-m.x)*Math.min(1,dt*9);if(Math.abs(m.pull-m.x)<3)m.pull=null;}
    if(m.stun>0){m.stun-=dt;continue;}
    if(m.boss&&m.wind>0){m.wind-=dt;m.atkA=.5*clamp(m.wind/1.2,0,1);if(m.wind<=0){SC.fx.push({k:'ring',x:m.slamX,y:gy()-10,life:.4,c:'#ff5c7a',r:130});if(!calm)SC.shake=.3;snd('slam');
        if(h.dead<=0&&Math.abs(h.x-m.slamX)<125){const d=C.hp*.45*(h.shield>0?.3:1);h.hp-=d;addNum(h.x,gy()-100,'-'+fmt(d),'#ff5c7a',true);}m.slamT=6;}continue;}
    const dx=h.x-m.x,ad=Math.abs(dx),reach=m.boss?70:36;
    if(ad>420)m.ag=false;
    if(h.dead<=0&&(m.boss?ad<340:(m.ag||ad<110))){
      if(ad>reach){m.x+=Math.sign(dx)*(m.boss?45:58)*dt;m.mv=true;}
      else if((m.atkT-=dt)<=0){m.atkT=m.boss?1.2:1;m.atkA=.5;const taken=zs(zi,SC.fl).atk*(m.boss?2:1)*300/(300+C.def)*(h.shield>0?.3:1);h.hp-=taken;snd('hurt');addNum(h.x,gy()-100,'-'+fmt(taken),'#ff5c7a');}
      if(m.boss&&(m.slamT-=dt)<=0&&ad<210){m.wind=1.2;m.slamX=m.x;}
    }else if(Math.abs(m.x-m.home)>4){m.x+=Math.sign(m.home-m.x)*40*dt;m.mv=true;m.back=true;}else m.back=false;
  }
  SC.mons=SC.mons.filter(m=>!m.gone);
  if(h.dead>0){h.dead-=dt;if(h.dead<=0){h.hp=C.hp;h.x=110;h.tgt=null;h.tx=null;h.goal=null;}return;}
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
    if(S.auto){let best=null,bd=1e9;for(const m of live){const d=Math.abs(m.x-h.x)*(m.boss?.5:1);if(d<bd){bd=d;best=m;}}h.tgt=best;}
    else{for(const m of live)if(Math.abs(m.x-h.x)<=range+(m.boss?40:0)){h.tgt=m;break;}}
  }
  if(h.tgt&&h.tx==null){const m=h.tgt,dx=m.x-h.x,r=range+(m.boss?40:0);h.face=dx>=0?1:-1;
    if(Math.abs(dx)>r){h.x+=Math.sign(dx)*spd*dt;h.mv=true;}
    else{
      if(S.auto&&h.autoSk<=0&&h.cds[0]<=0&&S.lvl>=SKLV[0]&&cast(0,true))h.autoSk=8;
      if(h.atkT<=0){h.atkT=1/(C.aspd*(h.buff>0?2:1));h.anim=1;h.lastAtk=SC.t;const col=gearColor(lookOf(S).w,SC.t,CLS[S.cls].c);attackFx(S.cls,h.x,gy(),h.face,[m],false,col);strike(m,1,col,false);if(m.dead)h.atkT=Math.max(h.atkT,.3);}
    }
  }else if(h.tx!=null){const dx=h.tx-h.x;h.face=dx>=0?1:-1;
    if(Math.abs(dx)<6){h.tx=null;if(h.goal){const g=h.goal;h.goal=null;arrive(g);}}else{h.x+=Math.sign(dx)*Math.min(Math.abs(dx),spd*dt);h.mv=true;}}
  h.x=clamp(h.x,30,mw-30);
  SC.cam=clamp(h.x-W*.4,0,Math.max(0,mw-W));
}
function holdBtn(id,d){const b=$(id);const on=e=>{e.preventDefault();initAudio();SC.hero.dir=d;b.classList.add('hold');},off=()=>{if(SC.hero.dir===d)SC.hero.dir=0;b.classList.remove('hold');};
  b.addEventListener('pointerdown',on);for(const ev of ['pointerup','pointercancel','pointerleave'])b.addEventListener(ev,off);b.addEventListener('contextmenu',e=>e.preventDefault());}
holdBtn('mvL',-1);holdBtn('mvR',1);
window.addEventListener('keydown',e=>{if(e.target&&e.target.tagName==='INPUT')return;const k=e.key;if(k==='ArrowLeft'||k==='a')SC.hero.dir=-1;else if(k==='ArrowRight'||k==='d')SC.hero.dir=1;else if(k>='1'&&k<='6'&&S&&!demo)cast(+k-1,false);});
window.addEventListener('keyup',e=>{const k=e.key;if((k==='ArrowLeft'||k==='a')&&SC.hero.dir<0||(k==='ArrowRight'||k==='d')&&SC.hero.dir>0)SC.hero.dir=0;});
window.addEventListener('blur',()=>{SC.hero.dir=0;});
cv.addEventListener('pointerdown',e=>{
  if(!S||demo||busy||SC.mode!=='farm'||SC.hero.dead>0||SC.hero.climb)return;
  const r=cv.getBoundingClientRect(),wx=e.clientX-r.left+SC.cam,py=e.clientY-r.top,h=SC.hero,g0=gy();
  h.tgt=null;h.goal=null;h.tx=null;
  if(py>g0-170){
    for(const m of alive())if(Math.abs(wx-m.x)<(m.boss?60:32)&&py>g0-(m.boss?170:95)){h.tgt=m;return;}
    if(SC.zi<0)for(const n of NPCS)if(Math.abs(wx-n.x)<32){h.tx=n.x-60;h.goal={npc:n};return;}
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
  for(const m of SC.mons){if(m.resp>0)continue;m.y=g0;
    if(m.boss&&m.wind>0){ctx.save();ctx.globalAlpha=.25+.3*(1-m.wind/1.2);ctx.fillStyle='#ff5c7a';ctx.beginPath();ctx.ellipse(m.slamX,g0,125,16,0,0,7);ctx.fill();ctx.restore();}
    drawMon(m,zi,SC.t,m.back?m.home<m.x:h.x<m.x,sc);}
  if(h.tx!=null&&!h.goal){ctx.strokeStyle='rgba(255,255,255,.5)';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(h.tx,g0,9,3,0,0,7);ctx.stroke();}
  if(h.tgt){ctx.strokeStyle='#ffd75e';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(h.tgt.x,g0+1,h.tgt.boss?40:22,h.tgt.boss?8:5,0,0,7);ctx.stroke();}
  drawPeers(g0,sc);
  const cl=h.climb;
  if(cl){const u=cl.ph==='wait'?1:cl.ph==='out'?1-cl.t/.45:cl.t/.45,above=(cl.kind==='up')===(cl.ph!=='in');
    ctx.save();ctx.globalAlpha=clamp(1-u*u,0,1);drawHero(h.x,g0+(above?-u*170:u*46),sc,lk,SC.t,0,h.face<0,0,true,false);ctx.restore();}
  else{
    if(h.shield>0){ctx.save();ctx.globalCompositeOperation='lighter';ctx.strokeStyle='#9fe8ff';ctx.shadowColor='#9fe8ff';ctx.shadowBlur=14;ctx.globalAlpha=.45+.25*Math.sin(SC.t*9);ctx.lineWidth=2.5;ctx.beginPath();ctx.ellipse(h.x,g0-hk.bh*sc,34*sc,hk.bh*sc+8,0,0,7);ctx.stroke();ctx.restore();}
    drawHero(h.x,g0,sc,lk,SC.t,h.anim,h.face<0,h.dead>0?3-h.dead:0,h.mv,h.buff>0);
    hpBar(h.x-30,g0-hk.bh*2*sc-16,60,h.hp/C.hp,'#6fe39a');nameTag(h.x,g0-hk.bh*2*sc-22,S.name,lk.r,guild.mine?guild.mine.tag:'',!!(guild.mine&&guild.mine.castle));}
  drawFx(SC.dt);ctx.restore();
  if(window.EC&&window.EC.gallery)window.EC.gallery(drawHero,ctx); // debug hook for looking at gear art
  if(SC.boss){hpBar(W*.2,92,W*.6,SC.boss.hp/SC.boss.max,'#ff5c7a','בוס: '+ZONES[zi].m);}
}

/* ---------- arena duel ---------- */
function startDuel(du){
  const tot=du.ev.length?du.ev[du.ev.length-1].t:1;
  SC.duel={opp:du.opp,r:du,i:0,t:0,ts:Math.max(1,tot/7),ha:du.ma,hb:du.mb,end:0,an:[0,0]};SC.mode='duel';SC.fx=[];SC.nums=[];SC.drops=[];
}
function updateDuel(dt){
  const d=SC.duel;d.an[0]=Math.max(0,d.an[0]-dt*4);d.an[1]=Math.max(0,d.an[1]-dt*4);
  if(d.end>0){d.end-=dt;if(d.end<=0)finishDuel();return;}
  d.t+=dt*d.ts;const ax=W*.26,bx=W*.74;
  while(d.i<d.r.ev.length&&d.r.ev[d.i].t<=d.t){const e=d.r.ev[d.i++];d.an[e.who]=1;
    const tx=e.who?ax:bx,sx=e.who?bx:ax,look=e.who?d.opp:lookOf(S),cls=e.who?d.opp.c:S.cls,col=gearColor(look.w,SC.t,CLS[cls].c);
    attackFx(cls,sx,gy(),e.who?-1:1,[{x:tx,y:gy()-10}],e.combo,col);
    snd(e.crit?'crit':'hit');if(e.who)d.ha-=e.d;else d.hb-=e.d;addNum(tx,gy()-90,fmt(e.d),e.crit?'#ffd75e':'#fff',e.crit||e.combo);}
  if(d.i>=d.r.ev.length){d.end=1.8;SC.nums.push({x:W/2,y:H*.4,txt:d.r.win===0?'ניצחון!':'הפסד',c:d.r.win===0?'#f2c14e':'#ff5c7a',s:34,life:1.8});}
}
function finishDuel(){
  const d=SC.duel,win=d.r.win===0;
  toast(win?'ניצחון. הדירוג עלה ב-'+d.r.gain+', קיבלת 8 מטבעות עונה':'הפסד. הדירוג ירד ב-12');
  SC.mode='farm';SC.duel=null;SC.fx=[];SC.nums=[];touch();
}
function frame(dt){
  SC.t+=dt;SC.dt=dt;if(statsDirty){C=calc(S,auras);statsDirty=false;}
  if(SC.mode==='farm'){updateWorld(dt);updatePeers(dt);}else updateDuel(dt);
  ctx.setTransform(DPR,0,0,DPR,0,0);
  ctx.save();if(SC.shake>0){SC.shake-=dt;ctx.translate((Math.random()-.5)*7,(Math.random()-.5)*5);}
  const cam=SC.cam;if(SC.mode==='duel')SC.cam=0;
  drawBg(SC.zi,SC.t);
  if(SC.mode==='farm')drawWorld();
  else{const d=SC.duel,sc=clamp(H/300,.8,1.45);
    drawHero(W*.26,gy(),sc,lookOf(S),SC.t,d.an[0],false,d.end>0&&d.r.win===1?1.8-d.end:0);
    drawHero(W*.74,gy(),sc,d.opp,SC.t+1.7,d.an[1],true,d.end>0&&d.r.win===0?1.8-d.end:0);
    hpBar(W*.26-45,22,90,d.ha/d.r.ma,'#6fe39a',S.name);hpBar(W*.74-45,22,90,d.hb/d.r.mb,'#ff5c7a',d.opp.n);
    const hx0=SC.hero.x;SC.hero.x=W*.26;drawFx(dt);SC.hero.x=hx0;}
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
  return '<button class="it r'+it.r+gcls(it.p)+'" data-act="item" data-id="'+it.id+'" style="color:var(--r'+it.r+')">'+SVG[it.s]+
    '<span class="nm">'+esc(itemName(it,S.cls))+(it.p?' '+L('+'+it.p):'')+'</span><span class="sub">'+mainLine(it)+'</span></button>';
}
function findItem(id){for(const k of SLOTS)if(S.eq[k]&&S.eq[k].id===id)return {it:S.eq[k],eq:k};const i=A.inv.findIndex(x=>x.id===id);return i>=0?{it:A.inv[i],i:i}:null;}
function tog(lbl,on,act){return '<div class="tog"><span>'+lbl+'</span><button class="btn sm'+(on?' on':'')+'" data-act="'+act+'">'+(on?'פעיל':'כבוי')+'</button></div>';}
const zoneName=z=>z<0?TOWN.n:ZONES[z].n;

function renderHud(){
  $('hName').textContent=S.name;$('hCls').textContent=CLS[S.cls].n;$('hLv').textContent=S.lvl;$('hRs').textContent=S.resets;
  $('hXp').style.width=(S.lvl>=CAP?100:S.xp/need(S.lvl)*100)+'%';
  $('cGold').textContent=fmt(A.gold);$('cGem').textContent=fmt(A.gems);$('cCred').textContent=fmt(A.cred);$('cCoin').textContent=fmt(A.coins);
  const duel=SC.mode==='duel',zi=SC.zi;
  $('zoneTag').textContent=duel?'זירה':zoneName(zi)+(zi>=0?' · קומה '+(SC.fl+1):'')+(partyN>0&&zi>=0?' · פארטי '+(partyN+1)+(partyXp(partyN)?' · '+Math.round(partyXp(partyN)*100)+'%+':''):'');
  $('rateTag').textContent=duel||zi<0?'':SC.boss?'בוס במפה':'בוס: '+(A.bossM[zi]||0)+'/'+BOSSN;
  $('resetNow').style.display=canReset(S)&&!duel?'block':'none';
  $('autoBtn').style.display=$('skills').style.display=duel||zi<0?'none':'';$('mv').style.display=duel?'none':'';
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
  if(passSeen<0)passSeen=passLevel(S);else if(passLevel(S)>passSeen){passSeen=passLevel(S);announce('פס העונה: רמה '+passSeen+'! '+passReward(passSeen).t+' מחכה לך',true);panelDirty=true;}
  const plv=passLevel(S),pb=evReady||plv>A.pass.claimed||TASKS.some(t=>A.daily[t.k]>=t.n&&!A.daily.done[t.k]);
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
  h+='<h2>נקודות סטט: '+L(S.pts)+'</h2><div class="card">';
  for(const k of ['str','agi','vit','ene'])h+='<div class="stat"><div class="n">'+STATN[k][0]+'<small>'+STATN[k][1]+'</small></div><b class="num">'+S.stats[k]+'</b>'+
    '<button class="btn sm" data-act="pt" data-k="'+k+'" data-n="1"'+(S.pts<1?' disabled':'')+'>'+L('+1')+'</button>'+
    '<button class="btn sm" data-act="pt" data-k="'+k+'" data-n="10"'+(S.pts<10?' disabled':'')+'>'+L('+10')+'</button>'+
    '<button class="btn sm" data-act="pt" data-k="'+k+'" data-n="all"'+(S.pts<1?' disabled':'')+'>הכל</button></div>';
  h+='</div><div class="card">'+tog('חלוקת נקודות אוטומטית',S.autoPts,'autoPts')+'</div>';
  h+='<h2>ריסט</h2><div class="card"><p class="hint">ברמה 400 חוזרים לרמה 1 בכפר ושומרים את כל הציוד והשערים הפתוחים. הריסט הבא נותן: '+L('+4%')+' נזק לתמיד, '+L(100*Math.min(S.resets+1,30)+A.bonusPts)+' נקודות סטט בהתחלה, '+L(resetGain(S))+' אותות ריסט.</p>'+
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
  let h='<h2>ציוד לבוש</h2><div class="items">';
  for(const k of SLOTS)h+=S.eq[k]?itemCard(S.eq[k]):'<div class="it empty">'+SLOTN[k]+'</div>';
  h+='</div>';
  const sc=setCounts(S);for(const z in sc)h+='<div class="card r4"><b style="color:var(--r4)">סט עתיק: '+SETN[z]+' · '+L(sc[z]+'/6')+'</b>'+setLines(z,sc[z])+'</div>';
  h+='<div class="card" style="display:flex;flex-direction:column;gap:8px">'+tog('לבש אוטומטית ציוד חזק יותר',A.autoEq,'autoEq')+
    '<div class="tog"><span>מכירה אוטומטית</span><button class="btn sm" data-act="autoSell">'+['כבויה','רגיל','רגיל וקסום'][A.autoSell]+'</button></div>'+
    '<div class="tog"><span>תיבות אוצר: '+L(A.boxes)+'</span><button class="btn sm pri" data-act="openBox" data-k=""'+(A.boxes?'':' disabled')+'>פתח תיבה</button></div>'+
    '<div class="tog"><span>תיבות עונה: '+L(A.sboxes)+' · 15% לחלק סט עתיק</span><button class="btn sm pri" data-act="openBox" data-k="s"'+(A.sboxes?'':' disabled')+'>פתח תיבה</button></div>'+
    '<div class="kv"><span>קמעות הגנה</span><b>'+L(A.charms)+'</b></div></div>';
  h+='<h2>תיק משותף '+L(A.inv.length+'/'+BAG)+'</h2>';
  if(!A.inv.length)h+='<p class="hint">התיק ריק. פריטים נופלים ממפלצות ומבוסים. פריט עתיק שייך לסט של המפה שבה נפל, ושישה חלקים נותנים את כל בונוסי הסט.</p>';
  else{const inv=A.inv.slice().sort((a,b)=>b.r-a.r||b.t-a.t||b.p-a.p);h+='<div class="items">'+inv.map(it=>itemCard(it)).join('')+'</div><button class="btn" data-act="sellJunk">מכור את כל הרגילים והקסומים</button>';}
  return h;
}
function renderZones(){
  let h='<p class="hint">בכל מפה שלוש קומות: בכל קומה המפלצות חזקות יותר, ויש יותר ניסיון, זהב וסיכוי לשלל. עוברים בין קומות ומפות דרך השערים שבקצוות, או בקפיצה מכאן. שער חדש נפתח אחרי ניצחון על הבוס של המפה. הבוס מופיע אחרי '+L(BOSSN)+' חיסולים כשאתה משחק בעצמך.</p>';
  h+='<div class="card zone'+(SC.zi<0?' cur':'')+'"><div class="sw" style="background:linear-gradient('+TOWN.sky[0]+','+TOWN.sky[1]+')"></div><div class="z"><b>'+TOWN.n+'</b><small>נפח, סוחרת, שומר המעגל, כרוז העונה, שער הזירה</small></div><button class="btn sm" data-act="zone" data-i="-1"'+(SC.zi<0?' disabled':'')+'>'+(SC.zi<0?'כאן':'קפוץ')+'</button></div>';
  ZONES.forEach((z,i)=>{const opened=z.req?S.resets>=z.req:i<=A.open,lv=z.min<=S.lvl,zf=zoneInfo(i,C,AFK),cur=SC.zi===i;
    if(i===BASEZ)h+='<h2>מפות ריסט</h2><p class="hint">נפתחות לפי מספר הריסטים של הדמות. המפלצות חזקות יותר, הניסיון והזהב גבוהים יותר, והציוד בדרגות חדשות עם סטים עתיקים משלו. נכנסים אליהן מכאן.</p>';
    h+='<div class="card zone'+(cur?' cur':'')+(opened&&lv?'':' lock')+'"><div class="sw" style="background:linear-gradient('+z.sky[0]+','+z.sky[1]+')"></div><div class="z"><b>'+z.n+'</b>'+
      '<small>'+z.m+' · מרמה '+L(z.min)+(opened&&lv?' · '+L(fmt(zf.xps*60))+' ניסיון לדקה בלי לשחק'+(zf.e<1?' · מסוכן':''):'')+'</small>'+
      '<small>שלל: ציוד '+TIERN[i]+' עם בונוס '+AFF[z.sig][0]+(z.wing?' · '+WINGN[z.wing-1]:'')+' · סט '+SETN[i]+'</small>'+
      (!opened?'<small style="color:var(--bad)">'+(z.req?'נפתח אחרי '+L(z.req)+' ריסטים של הדמות (יש '+L(S.resets)+')':'נעול: הבס את הבוס של '+ZONES[i-1].n)+'</small>':!lv?'<small style="color:var(--bad)">צריך רמה '+z.min+'</small>':'')+'</div>'+
      (opened&&lv?'<div style="display:flex;flex-direction:column;gap:4px">'+[0,1,2].map(f=>{const ok=S.lvl>=floorMin(i,f),here=cur&&SC.fl===f;return '<button class="btn sm" data-act="zone" data-i="'+i+'" data-f="'+f+'"'+(ok&&!here?'':' disabled')+'>'+(here?'כאן':'קומה '+(f+1)+(ok?'':' · '+L(floorMin(i,f))))+'</button>';}).join('')+'</div>':'')+'</div>';});
  return h;
}
function shopList(name,list,have,curName){
  return list.map(o=>{let dis=have<o.cost;if(o.k==='bless'&&A.bless>=10)dis=true;if(o.k==='wing'&&S.eq.g&&S.eq.g.t>=4)dis=true;
    return '<div class="card shop"><div class="z"><b>'+o.t+'</b>'+(o.d?'<small>'+o.d+'</small>':'')+'</div><button class="btn sm'+(dis?'':' pri')+'" data-act="buy" data-s="'+name+'" data-k="'+o.k+'"'+(dis?' disabled':'')+'>'+L(fmt(o.cost))+' '+curName+'</button></div>';}).join('');
}
function renderShop(){
  let h=renderMarket()+'<h2>חנות אותות ריסט</h2><p class="hint">אותות מקבלים רק מריסט. יש לך '+L(A.cred)+'.</p>'+shopList('reset',RESET_SHOP,A.cred,'אותות');
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
    h+='<div class="card'+(live?' zone cur':'')+'" style="display:block"><div class="kv"><b'+(live?' style="color:var(--gold)"':'')+'>'+e.n+'</b><b class="num" style="color:var(--'+(live?'good':'dim')+')">'+(live?'פעיל · '+L(mmss((w.end-now)/1000)):'בעוד '+fmtT(evNext(e,now)))+'</b></div>'+
      '<p class="hint">'+e.d+' · '+e.when+(e.rt?' · פרס: '+e.rt:'')+'</p>';
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
  const lv=passLevel(S),d=new Date(),end=new Date(d.getFullYear(),d.getMonth()+1,1),days=Math.ceil((end-d)/864e5),xp=lv>=30?100:A.pass.xp%100,wait=lv-A.pass.claimed;
  let nextBig=0;for(const m of [10,20,30])if(m>A.pass.claimed){nextBig=m;break;}
  let h=renderEvents()+'<h2>פס העונה</h2><div class="passHead"><div class="plv"><small>רמה</small><b>'+lv+'</b><small>מתוך 30</small></div><div class="pinfo">'+
    '<div class="kv"><span>'+(lv>=30?'הגעת לרמה המרבית':'ניסיון לרמה '+(lv+1))+'</span><b class="num">'+L(lv>=30?'100%':xp+'/100')+'</b></div>'+
    '<div class="bar gold big"><i style="width:'+xp+'%"></i></div>'+
    '<small>'+(nextBig?'הפרס הגדול הבא: <b>'+passReward(nextBig).t+'</b> ברמה '+nextBig+(nextBig>lv?', עוד '+(nextBig-lv)+' רמות':', מחכה לאיסוף')+' · ':'')+'נשארו '+L(days)+' ימים לעונה</small></div></div>';
  h+='<div class="track" id="passTrack">';
  for(let i=1;i<=30;i++){const rw=passReward(i),got=i<=A.pass.claimed,open=!got&&i<=lv,cur=i===lv+1,big=!!rw.wing,ic=rw.wing?'wing':rw.sboxes?'sboxes':rw.gems?'gems':'coins';
    h+='<div class="tier'+(got?' got':open?' open':cur?' cur':'')+(big?' big':'')+'"><b>'+i+'</b><span class="pic">'+PICON[ic]+'</span><em>'+rw.t+'</em><i>'+(got?'נאסף':open?'מוכן':cur?L(xp+'%'):'נעול')+'</i></div>';}
  h+='</div>';
  h+='<button class="btn pri'+(wait>0?' glow':'')+'" data-act="claimPass"'+(wait>0?'':' disabled')+'>'+(wait>1?'אסוף '+wait+' פרסים':wait===1?'אסוף פרס רמה '+(A.pass.claimed+1):'אין פרס לאיסוף כרגע')+'</button>';
  h+='<h2>משימות יומיות</h2><p class="hint">כל משימה מקדמת את הפס. המשימות מתאפסות בחצות.</p>';
  for(const t of TASKS){const v=Math.min(A.daily[t.k],t.n),done=A.daily.done[t.k],ready=v>=t.n&&!done;
    h+='<div class="card shop task'+(done?' done':'')+'"><div class="z"><b>'+t.t+'</b><div class="bar'+(ready||done?' gold':'')+'"><i style="width:'+Math.round(v/t.n*100)+'%"></i></div><small>'+L(fmt(v)+'/'+fmt(t.n))+' · '+L('+'+t.xp)+' ניסיון לפס</small></div><button class="btn sm'+(ready?' pri glow':'')+'" data-act="claimTask" data-k="'+t.k+'"'+(ready?'':' disabled')+'>'+(done?'נאסף':'אסוף')+'</button></div>';}
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
  const rules='<p class="hint">עד חמישה שחקנים. כל מקצוע נותן באף משלו לחברי הפארטי שנלחמים איתו באותה מפה, גם מול בוסים. מהשחקן השלישי באותה מפה, כל חבר מוסיף '+L(per+'%')+' ניסיון, עד '+L(per*3+'%')+'.</p>'+buffs;
  if(!party.code)return h+'<div class="card" style="display:flex;flex-direction:column;gap:8px">'+rules+'<p class="hint">חברי פארטי יכולים גם למכור פריטים ישירות זה לזה.</p>'+
    '<button class="btn pri" data-act="pcreate">צור פארטי</button><input type="text" id="pcode" maxlength="6" placeholder="קוד פארטי של חבר" autocomplete="off" dir="ltr"><button class="btn" data-act="pjoin">הצטרף עם קוד</button></div>';
  h+='<div class="card"><div class="kv"><span>קוד להזמנת חברים</span><b class="num" dir="ltr" style="letter-spacing:2px;color:var(--gold)">'+esc(party.code)+'</b></div>';
  for(const m of party.members)h+='<div class="kv"><span><i class="dot" style="background:var(--'+(m.active?'good':'line')+')"></i>'+esc(m.n)+(m.me?' (אתה)':'')+(m.leader?' · מוביל':'')+'</span><b>רמה '+L(m.l)+' · '+esc(zoneName(clamp(m.zone|0,-1,ZONES.length-1)))+'</b></div>';
  return h+'<div style="margin-top:6px">'+rules+'</div><p class="hint" style="margin-top:6px">איתך במפה עכשיו: '+L(partyN)+' חברים. בונוס ניסיון: '+L(Math.round(partyXp(partyN)*100)+'%')+'.</p><button class="btn sm" data-act="pleave">עזוב פארטי</button></div>';
}
function renderArena(){
  const arenaOpps=A.opps||[];
  let h=renderGuild()+renderParty()+'<h2>זירה</h2><div class="card"><div class="grid2"><div class="kv"><span>דירוג</span><b class="num" style="color:var(--gold)">'+A.rating+'</b></div><div class="kv"><span>כרטיסים היום</span><b class="num">'+A.tickets+'</b></div></div>'+
    '<p class="hint" style="margin-top:6px">הקרב אוטומטי, מול הדמות השמורה של היריב. '+(ONLINE?'הדמות שלך שמורה בשרת ומופיעה לשחקנים אחרים.':'מצב מקומי: יוצגו רק דמויות אימון.')+'</p></div><h2>יריבים</h2>';
  arenaOpps.forEach((o,i)=>{h+='<div class="card opp"><div class="z"><b>'+esc(o.n)+'</b>'+(o.bot?'<span class="tag">דמות אימון</span>':'')+
    '<small>'+CLS[o.c].n+' · רמה '+L(o.l)+' · ריסטים '+L(o.r)+' · כוח '+L(fmt(o.p))+'</small></div><button class="btn sm pri" data-act="fight" data-i="'+i+'"'+(A.tickets>0&&SC.mode==='farm'?'':' disabled')+'>הילחם</button></div>';});
  if(!arenaOpps.length)h+='<p class="hint">טוען יריבים...</p>';
  h+='<button class="btn" data-act="reroll">החלף יריבים</button><h2>טבלת ריסטים</h2>';
  const rows=players.filter(p=>!p.me).map(p=>({n:p.n,r:p.r,l:p.l}));rows.push({n:S.name,r:totalResets(A),l:S.lvl,me:true});
  rows.sort((a,b)=>b.r-a.r||b.l-a.l);
  h+='<div class="card"><ol class="lb">'+rows.slice(0,10).map(r=>'<li'+(r.me?' style="color:var(--gold);font-weight:700"':'')+'>'+esc(r.n)+' · '+L(r.r)+' ריסטים · רמה '+L(r.l)+'</li>').join('')+'</ol></div>';
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
    '<p class="hint">'+RAR[it.r].n+' · דרגה '+L(it.t)+(it.z>=0?' · מקור: '+ZONES[it.z].n:'')+'</p><div>';
  if(it.s==='w')h+='<div class="kv"><span>נזק נשק</span><b class="num">'+fmt(v.atk)+'</b></div>';
  if(ARM[it.s])h+='<div class="kv"><span>חיים</span><b class="num">'+fmt(v.hp)+'</b></div><div class="kv"><span>הגנה</span><b class="num">'+v.def+'</b></div>';
  if(it.s==='g')h+='<div class="kv"><span>נזק</span><b class="num">'+L('+'+v.wd+'%')+'</b></div><div class="kv"><span>חיים</span><b class="num">'+L('+'+v.wh+'%')+'</b></div><div class="kv"><span>מהירות הליכה</span><b class="num">'+L('+'+it.t*8+'%')+'</b></div>';
  for(const a of it.af)h+='<div class="kv aff"><span style="color:inherit">'+AFF[a[0]][0]+'</span><b class="num">'+L('+'+a[1]+'%')+'</b></div>';
  h+=diff+'</div>';
  if(isSet(it)){const n=setCounts(S)[it.z]||0;h+='<div class="card r4"><b style="color:var(--r4)">סט עתיק: '+SETN[it.z]+' · לבושים '+L(n+'/6')+'</b>'+setLines(it.z,n)+'</div>';}
  if(it.p<15)h+='<p class="hint">שדרוג לדרגה '+L('+'+(it.p+1))+': '+L(uc.gems)+' אבני נשמה ו-'+L(fmt(uc.gold))+' זהב · סיכוי '+L(Math.round(upChance(it)*100)+'%')+(it.p>=7?' · כישלון מוריד דרגה אחת'+(A.charms?' (יש קמע הגנה)':''):'')+'</p>';
  h+='<div class="acts">'+(f.eq!=null?'<button class="btn" data-act="unequip" data-id="'+it.id+'">הסר</button>':'<button class="btn pri" data-act="equip" data-id="'+it.id+'">לבש</button>')+
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
function setBig(on){prefs.big=!!on;savePrefs();$('app').classList.toggle('wide',prefs.big);$('bigBtn').textContent=prefs.big?'הקטן':'הגדל';resize();}
function openTab(name){
  if(prefs.big)setBig(false);
  tab=name;document.querySelectorAll('#tabs button').forEach(b=>b.classList.toggle('on',b.dataset.tab===tab));
  if(tab==='arena'){loadArena();if(ONLINE&&!demo){send('pget',{});loadGuild();}}if(tab==='shop')loadMarket();passScroll=null;renderPanel();$('panel').scrollTop=0;
}
function loadArena(){if(!demo&&S)act('opps',{}).then(()=>{panelDirty=true;});}
function enterGame(r){
  S=A.chars[A.cur];C=calc(S,auras);enterZone(S.zone,'L',S.floor);SC.hero.hp=C.hp;SC.hero.dead=0;SC.hero.cds=[0,0,0,0,0,0];SC.hero.climb=null;SC.hero.shield=0;touch();renderHud();renderPanel();
  if(r&&r.afk)showOffline(r.afk);
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
function accountHtml(){
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
  if(a==='big'){setBig(!prefs.big);return;}
  if(a==='say'){say();return;}
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
    else if(a==='sellJunk'){r=await act('sellJunk',{});if(r.ok)toast('נמכר ב-'+fmt(r.gold)+' זהב');}
    else if(a==='upgrade'){r=await act('upgrade',{id:id});if(r.ok){const c=r.code;snd(c==='ok'?'ok':c==='poor'||c==='max'?'click':'fail');
        toast(c==='ok'?'השדרוג הצליח. דרגה '+r.p:c==='saved'?'נכשל. קמע ההגנה שמר על הדרגה':c==='down'?'נכשל. הדרגה ירדה ל-'+r.p:c==='fail'?'השדרוג נכשל':'חסרים חומרים',c==='ok'?r.r:null);touch();C=calc(S,auras);openSheet(id);}}
    else if(a==='openBox'){r=await act('openBox',{k:b.dataset.k});if(r.ok)boxFx(r.box);}
    else if(a==='buy'){r=await act('buy',{shop:b.dataset.s,k:b.dataset.k});if(r.ok){if(r.box)boxFx(r.box);else{snd('coin');toast('נקנה: '+r.bought);}}}
    else if(a==='claimPass'){for(let n=0;n<30&&passLevel(S)>A.pass.claimed;n++){r=await act('claimPass',{});if(!r.ok)break;snd('rare');toast('פרס עונה: '+r.t);}passScroll=null;}
    else if(a==='claimEvent'){r=await act('claimEvent',{id:b.dataset.k});if(r.ok){snd('rare');toast('פרס האירוע: '+r.rt);if(r.levels)afterXp(r.levels);}}
    else if(a==='answer'){r=await act('answer',{a:+b.dataset.i});if(r.ok){snd(r.correct?'ok':'fail');toast(r.correct?'תשובה נכונה. אסוף את הפרס':'תשובה שגויה');}}
    else if(a==='claimTask'){r=await act('claimTask',{k:b.dataset.k});if(r.ok)toast(r.xp+' ניסיון לפס');}
    else if(a==='fight'){if(SC.mode==='farm'&&A.tickets>0){r=await act('duel',{i:+b.dataset.i});if(r.ok)startDuel(r.duel);}}
    else if(a==='reroll'){loadArena();}
    else if(a==='pt'){r=await act('pt',{k:b.dataset.k,n:b.dataset.n});}
    else if(a==='autoPts'||a==='autoEq'||a==='autoSell'){r=await act(a,{});}
    failTxt(r);
  }finally{clickBusy=false;}
  touch();if(S){C=calc(S,auras);statsDirty=false;}renderHud();renderPanel();saveLocal();
});

/* ---------- other players, chat, guilds ---------- */
let peers=[],chatLog=[],chatSince=0,chatCh='w',chatUnread=0,onlineN=0,guild={mine:null,top:[],holder:null},me={secret:true,admin:false},beatT=0,beatBusy=false,banned=false;
async function beat(){
  if(beatBusy||!ONLINE||demo||!S||document.hidden||SC.mode!=='farm')return;beatBusy=true;
  try{const h=SC.hero,j=await rpc('beat',{x:Math.round(h.x),f:h.face,a:SC.t-(h.lastAtk||-9)<3,s:chatSince}),b=j&&j.beat;
    if(b){if(b.banned){location.reload();return;}
      if(b.peers)mergePeers(b.peers);if(b.chat&&b.chat.length)addChat(b.chat);if(b.online!=null)onlineN=b.online;renderChatBar();}
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
function drawPeers(g0,sc){
  for(const p of peers){ctx.save();ctx.globalAlpha=.9;drawHero(p.x,g0,sc,p.s,SC.t+p.k.charCodeAt(0),p.an,(p.mv?p.dir:p.f)<0,0,p.mv,false);ctx.restore();
    nameTag(p.x,g0-SPR[CLSSPR[p.s.c]].bh*2*sc-10,p.s.n,p.s.r,p.g,false);}
}
function addChat(list){
  const first=chatSince===0;
  for(const m of list){const i=+m.i;if(!(i>chatSince))continue;chatSince=i;chatLog.push({c:m.c==='g'?'g':'w',n:String(m.n||''),g:String(m.g||''),m:String(m.m||''),me:!!m.me});if(!first&&tab!=='chat'&&!m.me)chatUnread++;}
  if(chatLog.length>120)chatLog.splice(0,chatLog.length-120);
  const l=$('chatList');if(l){l.innerHTML=chatRows();l.scrollTop=l.scrollHeight;}
}
function chatRows(){
  const rows=chatLog.filter(m=>m.c===chatCh).slice(-60);
  if(!rows.length)return '<p class="hint">'+(chatCh==='g'?'עוד אין הודעות בגילדה.':'עוד אין הודעות. תהיה הראשון.')+'</p>';
  return rows.map(m=>'<div class="cl'+(m.me?' me':'')+'"><b>'+(m.g?'['+esc(m.g)+'] ':'')+esc(m.n)+'</b> <span dir="auto">'+esc(m.m)+'</span></div>').join('');
}
function renderChat(){
  if(!ONLINE)return '<h2>צ\'אט</h2><p class="hint">הצ\'אט עובד רק במצב מקוון, מול השרת.</p>';
  chatUnread=0;
  return '<div class="seg"><button class="btn sm'+(chatCh==='w'?' pri':'')+'" data-act="chatCh" data-c="w">כולם</button><button class="btn sm'+(chatCh==='g'?' pri':'')+'" data-act="chatCh" data-c="g">גילדה</button><span class="hint">'+L(onlineN)+' מחוברים עכשיו</span></div>'+
    '<div id="chatList">'+chatRows()+'</div><div class="chatSend"><input type="text" id="chatIn" maxlength="160" placeholder="כתוב הודעה" autocomplete="off" enterkeyhint="send"><button class="btn pri" data-act="say">שלח</button></div>'+
    '<p class="hint">שמור על שפה מכבדת. קללות, הטרדה ופרסום מביאים להשתקה.</p>';
}
async function say(){
  const el=$('chatIn');if(!el)return;const m=el.value.trim();if(!m)return;el.value='';
  let j=null;try{j=await rpc('say',{m:m,g:chatCh==='g'});}catch(e){}
  const r=j&&j.result;if(!r||!r.ok){toast(r&&r.msg||'ההודעה לא נשלחה');if(!el.value)el.value=m;return;}
  beatT=99;
}
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target&&e.target.id==='chatIn'){e.preventDefault();say();}});
function renderChatBar(){
  const el=$('chatBar');if(!el)return;if(!ONLINE||demo||!S){el.style.display='none';return;}el.style.display='';
  const m=chatLog[chatLog.length-1],t=(chatUnread?'('+chatUnread+') ':'')+(m?(m.g?'['+m.g+'] ':'')+m.n+': '+m.m:'צ\'אט · '+onlineN+' מחוברים עכשיו');
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
const annPrev={},annMark={},annQ=[];let annT=0,annShow=0;
function announce(txt,live){annQ.push({t:txt,live:!!live});if(annQ.length>4)annQ.shift();}
function updateAnnounce(dt){
  const el=$('annc');if(!el)return;
  if(annShow>0){annShow-=dt;if(annShow<=0)el.classList.remove('on');}
  else if(annQ.length&&S&&!demo){const a=annQ.shift();el.textContent=a.t;el.classList.toggle('live',a.live);el.classList.add('on');annShow=4.2;snd(a.live?'boss':'ok');}
  if(!S||demo||(annT+=dt)<1)return;annT=0;
  const now=Date.now(),list=EVENTS.map(e=>({id:e.id,n:e.n,s:evNext(e,now),d:e.d})),sg=siegeInfo(now);
  list.push({id:'siege',n:'מצור הטירה',s:sg.on?1e9:sg.next*60-new Date(now).getSeconds(),d:'כל חיסול של חבר גילדה נספר'});
  for(const e of list){const prev=annPrev[e.id];annPrev[e.id]=e.s;
    if(prev!=null&&prev<=90&&e.s>prev+120){annMark[e.id]=0;announce(e.n+' התחיל! '+e.d,true);continue;}
    if(e.s<=300&&e.s>5){const m=Math.ceil(e.s/60);if(annMark[e.id]!==m&&prev!=null){annMark[e.id]=m;announce(e.n+' מתחיל בעוד '+(m===1?'דקה':m+' דקות'));}}}
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
  el.style.display=SC.mode==='farm'&&annShow<=0&&!$('modal').classList.contains('on')?'':'none';
  const t=TUT[tutStep];if(el.dataset.t!==t){el.dataset.t=t;el.firstChild.textContent=t;el.lastChild.textContent='הבנתי · '+(tutStep+1)+'/'+TUT.length;}
}
function tutNext(){tutStep++;tutT=0;if(tutStep>=TUT.length){prefs.tut=1;savePrefs();$('tip').style.display='none';}}

/* ---------- loop ---------- */
let lastT=0,hudT=0,saveT=0,evT=0,resyncing=false;
function loop(ts){
  requestAnimationFrame(loop);if(!S)return;
  let dt=(ts-lastT)/1000;lastT=ts;if(!(dt>0))return;
  if(dt>3&&!demo){ // the tab was asleep: let the rules decide what happened meanwhile
    if(!resyncing){resyncing=true;send('sync',{}).then(r=>{resyncing=false;if(!r.ok||SC.mode!=='farm')return;if(S.zone!==SC.zi||(S.floor|0)!==SC.fl)enterZone(S.zone,'L',S.floor);C=calc(S,auras);SC.hero.hp=C.hp;syncBoss();if(r.afk)showOffline(r.afk);saveLocal();});}
    return;
  }
  dt=Math.min(dt,.1);
  frame(dt);
  if((hudT+=dt)>.2){hudT=0;renderHud();const ae=document.activeElement;if(panelDirty&&!$('sheet').classList.contains('on')&&!(ae&&ae.tagName==='INPUT'&&$('panel').contains(ae)))renderPanel();}
  if(tab==='pass'&&(evT+=dt)>1){evT=0;panelDirty=true;}
  if(ONLINE){pend.t+=dt;if(pend.t>8){pend.t=0;if(pend.kills||pend.casts)flushTick();}
    if(!demo&&(beatT+=dt)>(peers.length?2.5:5)){beatT=0;beat();}}
  else if((saveT+=dt)>8){saveT=0;if(localDirty){localDirty=false;saveLocal();}}
  updateTut(dt);updateAnnounce(dt);
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
if(typeof window!=='undefined')window.EC={get A(){return A;},get S(){return S;},get C(){return C;},set C(v){C=v;},SC,G,send,act,frame,enterZone,pend,flushTick,syncBoss,spawnBoss,touch,get demo(){return demo;}};
boot();

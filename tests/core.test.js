import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as G from '../web/core.js';

function clock(t0){let t=t0;const f=()=>t;f.add=s=>{t+=s*1000;};return f;}
function fresh(cls='blade'){const now=clock(1.8e12);G.setEnv(Math.random,now);const A=G.newAccount();const r=G.apply(A,'create',{name:'בדיקה',cls});assert.ok(r.ok);return {A,now};}

test('server and client share one identical rules file',()=>{
  assert.equal(fs.readFileSync('web/core.js','utf8'),fs.readFileSync('supabase/functions/act/core.js','utf8'));
});
test('a forged tick claiming far more kills than time allows is clamped',()=>{
  const {A,now}=fresh();G.apply(A,'travel',{z:0});now.add(10);
  const r=G.apply(A,'tick',{z:0,kills:1000});
  assert.ok(r.ok);assert.ok(r.kills<=21,'10s at <=2.1 kills/s, got '+r.kills);assert.ok(A.kills<=21);
});
test('kills cannot be claimed twice for the same time window',()=>{
  const {A,now}=fresh();G.apply(A,'travel',{z:0});now.add(10);
  const a=G.apply(A,'tick',{z:0,kills:1000}).kills,b=G.apply(A,'tick',{z:0,kills:1000}).kills;
  assert.ok(a>0);assert.equal(b,0);
});
test('idle time cannot be banked without limit',()=>{
  const {A,now}=fresh();G.apply(A,'travel',{z:0});now.add(80);
  assert.ok(G.apply(A,'tick',{z:0,kills:1000}).kills<=40);
});
test('locked or under-level maps are refused',()=>{
  const {A,now}=fresh();now.add(5);
  assert.equal(G.apply(A,'tick',{z:5,kills:5}).ok,false);
  assert.equal(G.apply(A,'travel',{z:1}).ok,false);
  A.open=G.BASEZ-1;assert.equal(G.apply(A,'travel',{z:21}).ok,false,'level gate still holds');
});
test('a boss kill is refused unless the server spawned the boss and time allows the damage',()=>{
  const {A,now}=fresh();G.apply(A,'travel',{z:0});now.add(5);
  let r=G.apply(A,'tick',{z:0,kills:0,boss:true});assert.ok(r.rep.bossDenied);assert.equal(A.open,0);
  for(let i=0;i<40&&!A.bossAt;i++){now.add(8);G.apply(A,'tick',{z:0,kills:16});}
  assert.ok(A.bossAt,'boss spawns after 40 accepted kills');
  r=G.apply(A,'tick',{z:0,kills:0,boss:true});assert.ok(r.rep.bossDenied,'instant boss kill refused');
  now.add(60);r=G.apply(A,'tick',{z:0,kills:0,boss:true});assert.ok(r.rep.boss);assert.equal(A.open,1);
});
test('reset needs level 400; purchases need the currency; boxes need a box',()=>{
  const {A}=fresh();
  assert.equal(G.apply(A,'reset',{}).ok,false);
  assert.equal(G.apply(A,'buy',{shop:'reset',k:'wing'}).ok,false);
  assert.equal(G.apply(A,'buy',{shop:'gold',k:'box'}).ok,false);
  A.boxes=0;assert.equal(G.apply(A,'openBox',{k:''}).ok,false);
  assert.equal(G.apply(A,'openBox',{k:'s'}).ok,false);
  assert.equal(G.apply(A,'claimPass',{}).ok,false);
  assert.equal(G.apply(A,'claimQuest',{}).ok,false);
  assert.equal(G.apply(A,'duel',{i:0}).ok,false,'duel needs a server-built opponent list');
});
test('junk arguments never corrupt the account',()=>{
  const {A,now}=fresh();const junk=[null,undefined,{},{id:'x',z:'9e99',kills:-5,k:'__proto__',n:'NaN',i:{},shop:[],price:1e99},{id:1e308,z:NaN,kills:Infinity}];
  for(const kind of ['tick','travel','pt','equip','unequip','sell','upgrade','openBox','buy','claimTask','switch','duel','nope','sync','sellJunk','setAuto'])
    for(const a of junk){now.add(1);G.apply(A,kind,a);}
  const S=A.chars[0];for(const v of [A.gold,A.gems,A.cred,A.coins,A.boxes,S.lvl,S.xp,S.pts,...Object.values(S.stats)])assert.ok(Number.isFinite(v)&&v>=0);
  assert.ok(G.adopt(JSON.parse(JSON.stringify(A))),'state still serialises and loads');
});
test('character slots are gated and names are sanitised',()=>{
  const {A}=fresh();assert.equal(G.apply(A,'create',{name:'שני',cls:'storm'}).ok,false);
  A.maxLvl=50;const r=G.apply(A,'create',{name:'<img src=x onerror=1>  ארוך מאוד מאוד מאוד',cls:'zzz'});assert.ok(r.ok);
  const c=A.chars[1];assert.ok(c.name.length<=14&&!/[<>&"']/.test(c.name));assert.equal(c.cls,'blade');
});
let DROPS_I=0;
test('AFK-only time to first reset stays in the designed range and sets work',()=>{
  const now=clock(1.8e12);G.setEnv(Math.random,now);const A=G.newAccount();G.apply(A,'create',{name:'x',cls:'blade'});A.open=G.BASEZ-1;const s=A.chars[0];let t=0;
  while(s.lvl<G.CAP&&t<40*3600){let z=0;for(let i=0;i<G.BASEZ;i++)if(G.ZONES[i].min<=s.lvl)z=i;s.zone=z;s.last=now();G.offline(s,300);now.add(300);t+=300;}
  console.log('AFK-only minutes to first reset:',t/60);assert.ok(t/60>200&&t/60<480,'minutes: '+t/60);
  for(const k of G.DROPS)s.eq[k]=G.makeItem(s,k,8,4,21+DROPS_I++%3);
  assert.equal(G.setCounts(s)[7],6,'pieces of one tier form a set, whichever map of the region they came from');const full=G.calc(s).dmg;s.eq.b=null;assert.ok(G.calc(s).dmg<full);
});
test('reset maps open by reset count and level, never by editing the opened-map counter',()=>{
  const {A,now}=fresh();const s=A.chars[0];now.add(5);A.open=G.BASEZ-1;s.lvl=250;s.stats.str=9000;
  assert.equal(G.apply(A,'travel',{z:26}).ok,false,'no resets yet');
  s.resets=2;assert.equal(G.apply(A,'travel',{z:26}).ok,true);
  assert.equal(G.apply(A,'travel',{z:28}).ok,false,'needs 4 resets and level 300');
  now.add(10);const r=G.apply(A,'tick',{z:26,kills:5});assert.ok(r.ok&&r.kills>0);
  assert.equal(G.apply(A,'travel',{z:99}).ok,false);assert.equal(G.apply(A,'travel',{z:-7}).ok,true,'clamped to the village');
});
test('party: experience from the third player on, class buffs from the server context only',()=>{
  const xpFor=(ctx,args)=>{const {A,now}=fresh();G.apply(A,'travel',{z:0});now.add(10);const s=A.chars[0];s.autoPts=false;const before=s.xp;
    G.setEnv(()=>.5,now);const r=G.apply(A,'tick',Object.assign({z:0,kills:1},args||{}),ctx||{});let xp=s.xp;for(let l=1;l<s.lvl;l++)xp+=G.need(l);return xp-before;};
  const solo=xpFor({}),two=xpFor({partyN:1}),three=xpFor({partyN:2}),max=xpFor({partyN:4}),over=xpFor({partyN:50}),forged=xpFor({}, {partyN:4,auras:['blade']});
  assert.equal(two,solo,'a pair gets buffs, not extra experience');assert.ok(Math.abs(three/solo-1.05)<.02,'third player adds 5%: '+three/solo);assert.ok(Math.abs(max/solo-1.15)<.02,'five players: 15%');
  assert.equal(over,max,'capped at a party of five');assert.equal(forged,solo,'client-supplied values are ignored');
  const {A}=fresh(),s=A.chars[0],base=G.calc(s),all=G.calc(s,['blade','storm','hunter','blade']);
  assert.ok(Math.abs(all.dmg/base.dmg-1.12)<1e-9);assert.ok(Math.abs(all.aspd/base.aspd-1.1)<1e-9);assert.ok(Math.abs(all.crit-base.crit-.08)<1e-9);assert.ok(all.dps>base.dps*1.25);
  assert.deepEqual(G.cleanAuras(['blade','blade','nope',7,'hunter']),['blade','hunter']);assert.ok(G.maxKps(s,0,['blade','storm'])>=G.maxKps(s,0));
});
test('floors: deeper floors need more levels, pay more, and cannot be forged',()=>{
  const {A,now}=fresh();const s=A.chars[0];now.add(5);
  assert.deepEqual([0,1,2].map(f=>G.floorMin(0,f)),[1,4,7]);assert.ok(G.zs(0,2).xp>G.zs(0,0).xp&&G.zs(0,2).hp>G.zs(0,0).hp);
  assert.equal(G.apply(A,'travel',{z:0,f:2}).ok,false);assert.equal(G.apply(A,'tick',{z:0,f:2,kills:3}).ok,false);
  s.lvl=8;s.stats.str=200;assert.ok(G.apply(A,'travel',{z:0,f:2}).ok);assert.equal(s.floor,2);
  assert.equal(G.apply(A,'travel',{z:0,f:9}).ok,true,'clamped to the top floor');assert.equal(s.floor,2);
  const xp=f=>{const t=fresh();const c=t.A.chars[0];c.lvl=8;c.stats.str=200;c.autoPts=false;G.apply(t.A,'travel',{z:0,f:f});t.now.add(10);G.setEnv(()=>.5,t.now);G.apply(t.A,'tick',{z:0,f:f,kills:1});return c.xp;};
  assert.ok(xp(2)>xp(0)*1.5);
  G.apply(A,'travel',{z:-1,f:2});assert.equal(s.floor,0,'the village has no floors');
});

test('siege window: Saturday 21:00 to 21:30 Israel time, one key per finished siege',()=>{
  const at=t=>G.siegeInfo(Date.parse(t));
  assert.equal(at('2026-11-28T19:10:00Z').on,true);assert.equal(at('2026-11-28T19:10:00Z').left,20);
  assert.equal(at('2026-11-28T18:59:00Z').on,false);assert.equal(at('2026-11-28T18:59:00Z').next,1);assert.equal(at('2026-11-28T19:30:00Z').on,false);
  const k=at('2026-11-28T19:31:10Z').key;assert.equal(at('2026-12-05T19:29:50Z').key,k);assert.equal(at('2026-12-02T08:00:00Z').key,k);
  assert.notEqual(at('2026-11-28T19:29:00Z').key,k);assert.notEqual(at('2026-12-05T19:30:30Z').key,k);
});

test('the build id in the client matches version.txt',()=>{
  const v=fs.readFileSync('web/version.txt','utf8').trim(),m=/^const BUILD='([0-9]{14})';$/m.exec(fs.readFileSync('web/game.js','utf8'));
  assert.ok(m,'BUILD line present');assert.equal(m[1],v);
});

test('daily login reward: once a day, the streak grows only when collected on consecutive days',()=>{
  const {A,now}=fresh();const day=86400;
  const r1=G.apply(A,'claimLogin',{});assert.ok(r1.ok,r1.msg);assert.equal(r1.day,1);assert.equal(A.gems,3+3);
  assert.equal(G.apply(A,'claimLogin',{}).ok,false,'only once a day');
  now.add(day);const r2=G.apply(A,'claimLogin',{});assert.equal(r2.day,2);assert.equal(A.boxes,1+1);
  now.add(day);G.apply(A,'sync',{});assert.equal(A.login.s,3);assert.equal(A.login.got,0); // seen but not collected
  now.add(day);assert.equal(G.apply(A,'claimLogin',{}).day,1,'an uncollected day breaks the streak');
  now.add(3*day);assert.equal(G.apply(A,'claimLogin',{}).day,1,'so does a gap');
  for(let d=2;d<=7;d++){now.add(day);assert.equal(G.apply(A,'claimLogin',{}).day,d);}
  now.add(day);assert.equal(G.apply(A,'claimLogin',{}).day,1,'after day seven it starts again');
  const old=G.adopt(JSON.parse(JSON.stringify(Object.assign({},A,{login:undefined}))));assert.ok(G.apply(old,'claimLogin',{}).ok,'accounts from before this feature just start at day one');
});

test('resets: stats are kept, maps do not change with resets, a stat fills at its maximum, party experience',()=>{
  const {A}=fresh(),s=A.chars[0];s.lvl=G.CAP;s.stats.str=900;s.pts=37;s.autoPts=false;
  assert.ok(G.apply(A,'reset',{}).ok);assert.equal(s.lvl,1);assert.equal(s.stats.str,900);assert.equal(s.pts,37);assert.equal(s.resets,1);
  assert.deepEqual(G.zs(3,1),G.zs(3,1,9),'a map is the same for everyone');assert.ok(G.ZONES[24].hp>G.ZONES[8].hp*4,'reset maps are the hard content');assert.equal(G.ZONES.length,32);assert.deepEqual([0,3,23,24,31].map(G.tierOf),[1,2,8,9,12]);
  const sx=ctx=>{const B=G.adopt(JSON.parse(JSON.stringify(A)));G.setEnv(()=>.5,()=>B.last+20000);G.apply(B,'travel',{z:0});const r=G.apply(B,'tick',{z:0,kills:0},ctx);return [r.shared||0,B.chars[0].lvl];};
  assert.deepEqual(sx({}),[0,1]);assert.ok(sx({shareXp:5000})[1]>5,'experience handed over by the server levels the character');assert.equal(sx({shareXp:5000})[0],5000);
  s.stats.str=G.STAT_MAX-10;s.pts=50;assert.ok(G.apply(A,'pt',{k:'str',n:'all'}).ok);assert.equal(s.stats.str,G.STAT_MAX);assert.equal(s.pts,40);
  assert.equal(G.apply(A,'pt',{k:'str',n:5}).ok,false,'a full stat takes no more');
  s.autoPts=true;G.apply(A,'autoPts',{});G.apply(A,'autoPts',{});s.pts=40;G.autoAlloc(s);assert.equal(s.stats.str,G.STAT_MAX);assert.equal(s.pts,0,'automatic allocation spills into the other stats');
});

test('excellent items: extra options up to a full set, perfection stones, kept through cleaning',()=>{
  const {A}=fresh(),s=A.chars[0];let full=0,seen=new Set();
  for(let i=0;i<4000;i++){const it=G.makeExcellent(G.makeItem(s,'w',5,1,0));assert.ok(it.ex&&it.af.length>=2&&it.af.length<=7);assert.equal(new Set(it.af.map(f=>f[0])).size,it.af.length,'no option twice');seen.add(it.af.length);if(G.isFull(it))full++;}
  assert.ok(full>0&&full<200,'full is rare: '+full);assert.ok(seen.has(2)&&seen.has(4));
  const it=G.makeItem(s,'a',6,2,0);it.ex=1;A.inv.push(it);const n0=it.af.length;
  assert.equal(G.apply(A,'exAdd',{id:it.id}).ok,false,'needs a stone');A.jewels=10;
  const r=G.apply(A,'exAdd',{id:it.id});assert.ok(r.ok);assert.equal(it.af.length,n0+1);assert.equal(A.jewels,9);
  while(!G.isFull(it))assert.ok(G.apply(A,'exAdd',{id:it.id}).ok);assert.equal(it.af.length,6);assert.equal(G.apply(A,'exAdd',{id:it.id}).ok,false,'nothing left to add');
  assert.match(G.itemName(it,'blade'),/^אקסלנט מלא/);
  const plain=G.makeItem(s,'h',3,1,0);A.inv.push(plain);assert.equal(G.apply(A,'exAdd',{id:plain.id}).ok,false,'only excellent items');
  const c=G.cleanItem(JSON.parse(JSON.stringify(it)));assert.equal(c.ex,1);assert.equal(c.af.length,6);
  const forged=G.cleanItem({s:'h',t:3,r:1,af:[['hp',5],['def',5],['xp',5],['crit',2],['drop',2],['cdmg',9]]});assert.equal(forged.af.length,4,'without the mark the usual limit holds');
  s.autoSell=4;const ex=G.makeExcellent(G.makeItem(s,'b',2,0,0));assert.equal(G.stash(s,ex,{}),true,'never sold automatically');
  assert.ok(G.fighter(Object.assign(s,{eq:Object.assign(s.eq,{w:G.makeExcellent(G.makeItem(s,'w',2,0,0))})})).w[4]>=1);
});

test('selling by rarity leaves wings, excellent items and the other rarities alone',()=>{
  const {A}=fresh(),s=A.chars[0];A.inv=[];
  for(const r of [0,0,1,2,2,2,3])A.inv.push(G.makeItem(s,'h',3,r,0));A.inv.push(G.makeItem(s,'g',2,2,0));A.inv.push(G.makeExcellent(G.makeItem(s,'a',3,2,0)));
  const want=A.inv.filter(it=>it.r===2&&it.s!=='g'&&!it.ex).reduce((x,it)=>x+G.sellVal(it),0),gold=A.gold;
  const r=G.apply(A,'sellRar',{r:2});assert.ok(r.ok);assert.equal(r.n,3);assert.equal(A.gold,gold+want);assert.equal(A.inv.length,6);
  assert.equal(A.inv.filter(it=>it.r===2).length,2,'the wings and the excellent piece stay');assert.equal(G.apply(A,'sellRar',{r:4}).ok,false);
});

test('the keep: a crafted key, entry fixes the bracket, only kills inside count, higher brackets pay more',()=>{
  assert.deepEqual([1,14,15,80,81,330,331,400].map(G.evTier),[0,0,1,1,2,6,7,7]);assert.deepEqual(G.tierRange(7),[331,400]);assert.deepEqual(G.tierRange(1),[15,80]);
  assert.ok(G.tierReward(7).lv>G.tierReward(6).lv&&G.tierReward(2).gems>G.tierReward(1).gems);
  const at=Date.parse('2026-11-26T12:01:00Z'); // one minute into the hourly opening
  const mk=(lvl,t0)=>{const A=G.newAccount();const st={now:t0};G.setEnv(()=>.5,()=>st.now);G.apply(A,'create',{name:'a',cls:'blade'});const s=A.chars[0];s.lvl=lvl;s.stats.str=5000;s.stats.vit=3000;s.autoPts=false;A.open=7;return {A,s,st};};
  {const {A}=mk(100,at);assert.equal(G.apply(A,'craftKey',{}).ok,false,'needs shards');A.shards=7;A.gold=5000;assert.ok(G.apply(A,'craftKey',{}).ok);assert.equal(A.keys,1);assert.equal(A.shards,2);assert.equal(A.gold,5000-G.KEY_GOLD);}
  {const {A}=mk(100,at-10*60000);A.keys=1;assert.equal(G.apply(A,'evEnter',{id:'crimson'}).ok,false,'the gate is shut outside the opening');assert.equal(A.keys,1);}
  {const {A}=mk(10,at);A.keys=1;assert.match(G.apply(A,'evEnter',{id:'crimson'}).msg,/מרמה 15/);}
  {const {A}=mk(100,at);assert.match(G.apply(A,'evEnter',{id:'crimson'}).msg,/מפתח/);}
  const run=(lvl)=>{const {A,s,st}=mk(lvl,at-60000);A.keys=1;st.now=at;
    G.apply(A,'travel',{z:0});for(let i=0;i<3;i++){st.now+=20000;G.apply(A,'tick',{z:0,kills:30});}
    const outside=Object.values(A.ev||{}).reduce((x,r)=>x+(r.k||0),0);
    const e=G.apply(A,'evEnter',{id:'crimson'});const again=G.apply(A,'evEnter',{id:'crimson'});
    for(let i=0;i<10;i++){st.now+=20000;G.apply(A,'tick',{ev:1,kills:60});}
    const rec=Object.values(A.ev).find(r=>r.in),before=s.lvl,r=G.apply(A,'claimEvent',{id:'crimson'});
    st.now+=15*60000;const late=G.apply(A,'tick',{ev:1,kills:5});return {A,s,e,again,outside,rec,r,gained:s.lvl-before,late};};
  const t2=run(100);assert.equal(t2.outside,0,'kills outside the keep do not count');assert.ok(t2.e.ok,t2.e.msg);assert.equal(t2.e.tier,2);assert.ok(t2.again.ok);assert.equal(t2.A.keys,0,'one key per opening, going back in is free');
  assert.ok(t2.rec.k>=400,'kills '+t2.rec.k);assert.ok(t2.r.ok,t2.r.msg);assert.match(t2.r.rt,/^4 רמות/);assert.equal(t2.late.evOver,true,'after closing, the keep throws the player out');assert.equal(t2.s.evIn,null);
  {const {A,s,st}=mk(100,at);A.keys=2;st.now=at+2*60000;assert.match(G.apply(A,'evEnter',{id:'crimson'}).msg,/הכניסה נסגרה/,'four minutes in, the gate is shut');assert.equal(A.keys,2);}
  {const {A,s,st}=mk(100,at);A.keys=1;assert.ok(G.apply(A,'evEnter',{id:'crimson'}).ok);G.apply(A,'evLeave',{});st.now=at+2*60000;assert.equal(G.apply(A,'evEnter',{id:'crimson'}).ok,false,'no way back in once the gate is shut');}
  {const {A,s}=mk(400,at);A.keys=1;assert.ok(G.apply(A,'reset',{}).ok);s.lvl=100;assert.match(G.apply(A,'evEnter',{id:'crimson'}).msg,/ריסט/);assert.equal(A.keys,1);}
  {const a=mk(100,at);a.A.keys=1;G.apply(a.A,'evEnter',{id:'crimson'});a.st.now+=20000;const x=G.apply(a.A,'tick',{ev:1,kills:500}),ez=a.s.evZ;
    const b=mk(100,at);G.apply(b.A,'travel',{z:ez});b.st.now+=20000;const y=G.apply(b.A,'tick',{z:ez,kills:500});
    assert.ok(x.kills>y.kills*1.5,'the horde dies faster: '+x.kills+' vs '+y.kills);assert.ok(Math.abs(x.base/x.kills-y.base/y.kills)<1e-9,'and pays the normal experience per kill');}
  const t7=run(335);assert.ok(t7.r.ok);assert.equal(t7.rec.tr,7);assert.match(t7.r.rt,/^10 רמות/);assert.ok(t7.gained>=9);
});
test('wear the best: strongest piece per slot from the shared bag; gear worn by another character is not touched',()=>{
  const {A}=fresh(),s=A.chars[0];A.inv=[];
  s.eq.w=G.makeItem(s,'w',2,1,0);const strong=G.makeItem(s,'w',9,3,0),weak=G.makeItem(s,'w',1,0,0),helm=G.makeItem(s,'h',5,2,0);A.inv.push(weak,strong,helm);
  const other=G.bind(A,G.newChar('שני','storm'));other.eq.a=G.makeItem(s,'a',12,4,0);A.chars.push(other);
  const old=s.eq.w,r=G.apply(A,'bestEq',{});assert.ok(r.ok);assert.equal(r.n,2);assert.ok(r.gain>0);
  assert.equal(s.eq.w,strong);assert.equal(s.eq.h,helm);assert.equal(s.eq.a,null,'the other character keeps what it wears');assert.ok(other.eq.a);
  assert.ok(A.inv.includes(old)&&A.inv.includes(weak)&&A.inv.length===2);
  assert.equal(G.apply(A,'bestEq',{}).n,0,'nothing better left');
});

test('saved games from the 8 + 4 map list are renumbered once',()=>{
  const old={v:2,gold:5,gems:1,cred:0,coins:0,boxes:0,sboxes:0,charms:0,bless:0,bonusPts:0,boost:0,inv:[{id:1,s:'h',t:3,r:1,p:0,z:2,af:[]},{id:2,s:'a',t:10,r:4,p:0,z:9,af:[]}],nid:3,kills:0,killAcc:0,pass:{key:'x',xp:0,claimed:0},day:'x',daily:{kills:0,resets:0,wins:0,ups:0,done:{}},rating:1000,tickets:5,
    autoEq:true,autoSell:1,open:4,zk:{'2':50,'9':7},bossM:{'4':12},q:0,chars:[{name:'a',cls:'blade',lvl:200,xp:0,resets:2,pts:0,stats:{str:15,agi:15,vit:15,ene:15},zone:4,floor:1,eq:{w:{id:9,s:'w',t:5,r:2,p:3,z:4,af:[]},h:null,a:null,p:null,l:null,b:null,g:null},last:0}],cur:0,last:0};
  const A=G.adopt(JSON.parse(JSON.stringify(old))),s=A.chars[0];
  assert.equal(A.open,12);assert.equal(s.zone,12);assert.equal(G.ZONES[s.zone].n,'מצודת הכפור','the character stands in the same place');
  assert.deepEqual(A.zk,{'6':50,'26':7});assert.deepEqual(A.bossM,{'12':12});assert.equal(A.inv[0].z,6);assert.equal(A.inv[1].z,26);assert.equal(s.eq.w.z,12);assert.equal(s.eq.w.t,5,'tiers are untouched');
  const again=G.adopt(JSON.parse(JSON.stringify(A)));assert.equal(again.open,12,'only once');assert.equal(again.chars[0].zone,12);
});

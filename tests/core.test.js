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
  const {A}=fresh();assert.equal(G.apply(A,'create',{name:'שנית',cls:'storm'}).ok,false);
  A.maxLvl=50;const r=G.apply(A,'create',{name:'<img src=x onerror=1>  ארוך מאוד מאוד מאוד',cls:'zzz'});assert.ok(r.ok);
  const c=A.chars[1];assert.ok(c.name.length<=14&&!/[<>&"']/.test(c.name));assert.equal(c.cls,'blade');
});
let DROPS_I=0;
test('AFK-only time to first reset stays in the designed range and sets work',()=>{
  const now=clock(1.8e12);G.setEnv(Math.random,now);const A=G.newAccount();G.apply(A,'create',{name:'xxxx',cls:'blade'});A.open=G.BASEZ-1;const s=A.chars[0];let t=0;
  while(s.lvl<G.CAP&&t<40*3600){let z=0;for(let i=0;i<G.BASEZ;i++)if(G.ZONES[i].min<=s.lvl)z=i;s.zone=z;s.last=now();G.offline(s,300);now.add(300);t+=300;}
  console.log('AFK-only minutes to first reset:',t/60);assert.ok(t/60>200&&t/60<480,'minutes: '+t/60);
  for(const k of G.DROPS){s.eq[k]=G.makeItem(s,k,8,4,21+DROPS_I++%3);delete s.eq[k].v;}
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

test('siege window: Saturday 21:00 to 22:00 Israel time, one key per finished siege',()=>{
  const at=t=>G.siegeInfo(Date.parse(t));
  assert.equal(at('2026-11-28T19:10:00Z').on,true);assert.equal(at('2026-11-28T19:10:00Z').left,50);assert.equal(at('2026-11-28T19:45:00Z').on,true);
  assert.equal(at('2026-11-28T18:59:00Z').on,false);assert.equal(at('2026-11-28T18:59:00Z').next,1);assert.equal(at('2026-11-28T20:00:00Z').on,false);
  const k=at('2026-11-28T20:01:10Z').key;assert.equal(at('2026-12-05T19:59:50Z').key,k);assert.equal(at('2026-12-02T08:00:00Z').key,k);
  assert.notEqual(at('2026-11-28T19:59:00Z').key,k);assert.notEqual(at('2026-12-05T20:00:30Z').key,k);
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
  assert.deepEqual(G.zs(3,1),G.zs(3,1,9),'a map is the same for everyone');assert.ok(G.ZONES[24].hp>G.ZONES[8].hp*4,'reset maps are the hard content');assert.equal(G.ZONES.length,37);assert.deepEqual([0,3,23,24,31].map(G.tierOf),[1,2,8,9,12]);
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

test('the keep: a crafted key, a five-minute gate before it begins, nobody enters after, the horde is the prize',()=>{
  assert.deepEqual([1,14,15,80,81,330,331,400].map(G.evTier),[0,0,1,1,2,6,7,7]);assert.deepEqual(G.tierRange(7),[331,400]);assert.deepEqual(G.tierRange(1),[15,80]);
  assert.ok(G.tierReward(7).lv===undefined&&G.tierReward(2).gems>G.tierReward(1).gems,'no prize is paid in levels');assert.ok(G.EVENTS.every(e=>!e.rw||e.rw.lv===undefined));
  const start=Date.parse('2026-11-26T12:00:00Z'),at=start-2*60000; // two minutes before the keep begins: the gate is open
  const mk=(lvl,t0)=>{const A=G.newAccount();const st={now:t0};G.setEnv(()=>.5,()=>st.now);G.apply(A,'create',{name:'aaaa',cls:'blade'});const s=A.chars[0];s.lvl=lvl;s.stats.str=5000;s.stats.vit=3000;s.autoPts=false;A.open=7;return {A,s,st};};
  {const {A}=mk(100,at);assert.equal(G.apply(A,'craftKey',{}).ok,false,'needs shards');A.shards=7;A.gold=5000;assert.ok(G.apply(A,'craftKey',{}).ok);assert.equal(A.keys,1);assert.equal(A.shards,2);assert.equal(A.gold,5000-G.KEY_GOLD);}
  {const {A}=mk(100,start-10*60000);A.keys=1;assert.equal(G.apply(A,'evEnter',{id:'crimson'}).ok,false,'the gate opens only five minutes before');assert.equal(A.keys,1);}
  {const {A}=mk(10,at);A.keys=1;assert.match(G.apply(A,'evEnter',{id:'crimson'}).msg,/מרמה 15/);}
  {const {A}=mk(100,at);assert.match(G.apply(A,'evEnter',{id:'crimson'}).msg,/מפתח/);}
  const run=(lvl)=>{const {A,s,st}=mk(lvl,at-80000);A.keys=1;
    G.apply(A,'travel',{z:0});for(let i=0;i<3;i++){st.now+=20000;G.apply(A,'tick',{z:0,kills:30});}
    const e=G.apply(A,'evEnter',{id:'crimson'}),again=G.apply(A,'evEnter',{id:'crimson'});st.now+=20000;const k0=A.kills,w=G.apply(A,'tick',{ev:1,kills:60}),waited=A.kills-k0;
    while(st.now<start-30000){st.now+=25000;G.apply(A,'tick',{ev:1,kills:0});}st.now=start+1000;const before=s.lvl;let got=0;for(let i=0;i<10;i++){st.now+=20000;got+=G.apply(A,'tick',{ev:1,kills:60}).kills||0;}
    const claim=G.apply(A,'claimEvent',{id:'crimson'});st.now+=15*60000;const late=G.apply(A,'tick',{ev:1,kills:5});return {A,s,e,again,w,waited,got,claim,gained:s.lvl-before,late};};
  const t2=run(100);assert.ok(t2.e.ok,t2.e.msg);assert.equal(t2.e.tier,2);assert.equal(t2.e.start,start);assert.ok(t2.again.ok);assert.equal(t2.A.keys,0,'one key per opening');
  assert.ok(t2.w.wait&&t2.waited===0,'nothing can be killed while the count runs');assert.ok(t2.got>=400&&t2.gained>0,'then the horde: '+t2.got);assert.equal(t2.claim.ok,false,'the horde is the prize: there is nothing to collect');
  assert.equal(t2.late.evOver,true,'after closing, the keep throws the player out');assert.equal(t2.s.evIn,null);
  {const {A}=mk(100,start+60000);A.keys=2;assert.match(G.apply(A,'evEnter',{id:'crimson'}).msg,/הכניסה נסגרה/,'once it has begun, nobody enters');assert.equal(A.keys,2);}
  {const {A,st}=mk(100,at);A.keys=1;assert.ok(G.apply(A,'evEnter',{id:'crimson'}).ok);G.apply(A,'evLeave',{});st.now=start+60000;assert.equal(G.apply(A,'evEnter',{id:'crimson'}).ok,false,'no way back in after the start');}
  {const {A,s}=mk(400,at);A.keys=1;assert.ok(G.apply(A,'reset',{}).ok);s.lvl=100;assert.match(G.apply(A,'evEnter',{id:'crimson'}).msg,/ריסט/);assert.equal(A.keys,1);}
  {const a=mk(100,at);a.A.keys=1;G.apply(a.A,'evEnter',{id:'crimson'});while(a.st.now<start-30000){a.st.now+=25000;G.apply(a.A,'tick',{ev:1,kills:0});}a.st.now=start+1000;G.apply(a.A,'tick',{ev:1,kills:0});a.st.now+=20000;const x=G.apply(a.A,'tick',{ev:1,kills:500}),ez=a.s.evZ;
    const b=mk(100,start+1000);G.apply(b.A,'travel',{z:ez});b.st.now+=20000;const y=G.apply(b.A,'tick',{z:ez,kills:500});
    assert.ok(x.kills>y.kills*1.5,'the horde dies faster: '+x.kills+' vs '+y.kills);assert.ok(Math.abs(x.base/x.kills-y.base/y.kills)<1e-9,'and pays the normal experience per kill');}
  const t7=run(335);assert.equal(t7.e.tier,7);assert.ok(t7.got>=400);
});
test('wear the best: strongest piece per slot from the shared bag; gear worn by another character is not touched',()=>{
  const {A}=fresh(),s=A.chars[0];A.inv=[];
  s.stats={str:9000,agi:9000,vit:9000,ene:9000};
  s.eq.w=G.makeItem(s,'w',2,1,0);const strong=G.makeItem(s,'w',9,3,0),weak=G.makeItem(s,'w',1,0,0),helm=G.makeItem(s,'h',5,2,0);A.inv.push(weak,strong,helm);
  const other=G.bind(A,G.newChar('שני','storm'));other.eq.a=G.makeItem(s,'a',12,4,0);A.chars.push(other);
  const old=s.eq.w,r=G.apply(A,'bestEq',{});assert.ok(r.ok);assert.equal(r.n,2);assert.ok(r.gain>0);
  assert.equal(s.eq.w,strong);assert.equal(s.eq.h,helm);assert.equal(s.eq.a,null,'the other character keeps what it wears');assert.ok(other.eq.a);
  assert.ok(A.inv.includes(old)&&A.inv.includes(weak)&&A.inv.length===2);
  assert.equal(G.apply(A,'bestEq',{}).n,0,'nothing better left');
});

test('saved games from the 8 + 4 map list are renumbered once',()=>{
  const old={v:2,gold:5,gems:1,cred:0,coins:0,boxes:0,sboxes:0,charms:0,bless:0,bonusPts:0,boost:0,inv:[{id:1,s:'h',t:3,r:1,p:0,z:2,af:[]},{id:2,s:'a',t:10,r:4,p:0,z:9,af:[]}],nid:3,kills:0,killAcc:0,pass:{key:'x',xp:0,claimed:0},day:'x',daily:{kills:0,resets:0,wins:0,ups:0,done:{}},rating:1000,tickets:5,
    autoEq:true,autoSell:1,open:4,zk:{'2':50,'9':7},bossM:{'4':12},q:0,chars:[{name:'aaaa',cls:'blade',lvl:200,xp:0,resets:2,pts:0,stats:{str:15,agi:15,vit:15,ene:15},zone:4,floor:1,eq:{w:{id:9,s:'w',t:5,r:2,p:3,z:4,af:[]},h:null,a:null,p:null,l:null,b:null,g:null},last:0}],cur:0,last:0};
  const A=G.adopt(JSON.parse(JSON.stringify(old))),s=A.chars[0];
  assert.equal(A.open,12);assert.equal(s.zone,12);assert.equal(G.ZONES[s.zone].n,'מצודת הכפור','the character stands in the same place');
  assert.deepEqual(A.zk,{'6':50,'26':7});assert.deepEqual(A.bossM,{'12':12});assert.equal(A.inv[0].z,6);assert.equal(A.inv[1].z,26);assert.equal(s.eq.w.z,12);assert.equal(s.eq.w.t,5,'tiers are untouched');
  const again=G.adopt(JSON.parse(JSON.stringify(A)));assert.equal(again.open,12,'only once');assert.equal(again.chars[0].zone,12);
});

test('the season pass is long: play feeds it only up to a daily amount, tasks come on top, saved levels survive',()=>{
  const st={now:Date.parse('2026-11-26T12:20:00Z')};G.setEnv(()=>.5,()=>st.now);const A=G.newAccount();G.apply(A,'create',{name:'aaaa',cls:'blade'});const s=A.chars[0];s.lvl=200;s.stats.str=9000;s.stats.vit=5000;s.autoPts=false;
  G.apply(A,'travel',{z:0});for(let i=0;i<600;i++){st.now+=20000;G.apply(A,'tick',{z:0,kills:40});}
  assert.ok(A.kills>10000,'kills '+A.kills);assert.equal(A.pass.xp,G.PASS_DAY,'a whole day of grinding stops at the daily amount');
  A.daily.kills=5000;assert.ok(G.apply(A,'claimTask',{k:'kills'}).ok);assert.equal(A.pass.xp,G.PASS_DAY+60,'tasks are on top of it');
  st.now+=86400000;G.apply(A,'tick',{z:0,kills:0});st.now+=20000;G.apply(A,'tick',{z:0,kills:40});st.now+=60000;for(let i=0;i<8;i++){st.now+=20000;G.apply(A,'tick',{z:0,kills:40});}assert.ok(A.pass.xp>G.PASS_DAY+60,'the next day it moves again');
  assert.ok(G.PASS_MAX*G.PASS_STEP/(G.PASS_DAY+260)>20,'even a perfect player needs more than twenty days');assert.ok(G.passReward(60).wing&&G.passReward(40).feathers&&G.passReward(20).feathers);
  const old=JSON.parse(JSON.stringify(A));old.zv=1;old.pass.xp=1000;const B=G.adopt(old);assert.equal(B.pass.xp,2000);assert.equal(B.zv,2);
});

test('the manual duel: choices decide between equals, gear decides between unequals, and the rules of each action hold',()=>{
  const F=(d,h)=>({d:d,a:1.2,h:h,f:200,cr:0,cd:2,rt:1000});let seed=7;const rnd=()=>{seed=(seed*1103515245+12345)%2147483648;return seed/2147483648;};G.setEnv(rnd,()=>1e12);
  {const D=G.duelNew(F(1000,10000),F(1000,10000));assert.ok(Math.abs(D.f[0].base-.09)<1e-9&&Math.abs(D.f[1].base-.09)<1e-9);
    assert.equal(G.duelCan(D.f[0],'h'),false);assert.equal(G.duelCan(D.f[0],'c'),false);assert.equal(G.duelCan(D.f[0],'u'),false);assert.ok(G.duelCan(D.f[0],'p'));
    const r=G.duelRound(D,'a','g');assert.ok(r.d[0]<.09*.3,'a guarded attack does little');assert.ok(r.ctr[1]>0&&D.f[0].hp<1,'and is struck back');assert.equal(D.f[0].combo,0);
    G.duelRound(D,'a','a');G.duelRound(D,'a','a');assert.equal(D.f[0].combo,2);assert.equal(D.f[0].en,60);
    const h=G.duelRound(D,'h','g');assert.ok(h.d[0]>.09*1.5,'a heavy blow goes through a guard');assert.equal(D.f[0].combo,3);assert.equal(D.f[0].en,20);
    const hp=D.f[1].hp,c=G.duelRound(D,'c','p');assert.ok(c.d[0]>.09*2.5);assert.equal(D.f[0].combo,0);assert.equal(D.f[1].pots,2);assert.ok(D.f[1].hp<hp+.3);
    assert.equal(G.duelRound(D,'u','a').a[0],'a','an action that is not available falls back to an attack');}
  const play=(A,B,p0,p1)=>{let w=0;for(let i=0;i<200;i++){const D=G.duelNew(A,B);while(!D.over)G.duelRound(D,p0(D,0),p1(D,1));if(D.win===0)w++;}return w/200;};
  const spam=()=>'a',even=F(1000,10000);
  assert.ok(play(even,even,G.duelAI,spam)>.7,'thoughtful play beats mashing attack: '+play(even,even,G.duelAI,spam));
  assert.ok(play(F(2500,20000),even,spam,G.duelAI)>.8,'much better gear still wins while mashing');
  const eq=play(even,even,G.duelAI,G.duelAI);assert.ok(eq>.3&&eq<.7,'equals playing the same way split: '+eq);assert.ok(play(F(1250,11500),even,G.duelAI,G.duelAI)>.7,'with equal play the better gear wins');
  const st={now:Date.parse('2026-11-26T12:20:00Z')};G.setEnv(rnd,()=>st.now);const A=G.newAccount();G.apply(A,'create',{name:'aaaa',cls:'blade'});
  assert.equal(G.apply(A,'duelAct',{a:'a'}).ok,false);G.apply(A,'opps',{},{players:[],uid:'x'});const t0=A.tickets,s0=G.apply(A,'duelStart',{i:1});assert.ok(s0.ok);assert.equal(A.tickets,t0-1);
  assert.ok(G.apply(A,'duelStart',{i:0}).ok,'asking again resumes');assert.equal(A.tickets,t0-1);assert.equal(G.apply(A,'duelAct',{a:'u'}).ok,false);
  let r,n=0;const rt=A.rating;do{r=G.apply(A,'duelAct',{a:G.duelAI(A.pd.D,0)});n++;}while(r.ok&&!r.D.over&&n<40);assert.ok(r.D.over);assert.equal(A.pd,null);assert.notEqual(A.rating,rt);
  G.apply(A,'opps',{},{players:[],uid:'x'});G.apply(A,'duelStart',{i:0});st.now+=11*60000;G.apply(A,'opps',{},{players:[],uid:'x'});const r1=A.rating;G.apply(A,'duelStart',{i:0});assert.equal(A.rating,r1-12,'a duel left for ten minutes is lost');
});

test('wings: fifty ranks, each stronger; only +15 wings evolve, with feathers, and a failure costs only the feathers',()=>{
  assert.equal(G.WING_MAX,50);const st={now:Date.parse('2026-11-26T12:20:00Z')};let x=.99;G.setEnv(()=>x,()=>st.now);
  const A=G.newAccount();G.apply(A,'create',{name:'aaaa',cls:'blade'});const s=A.chars[0];
  const mk=(t,p)=>({id:900+t,s:'g',t:t,r:2,p:p,z:-1,af:[]});let prev=0;for(let t=1;t<=50;t++){const v=G.itemVals(mk(t,15)).wd;assert.ok(v>prev,'rank '+t);prev=v;}
  assert.ok(G.itemName(mk(9,0),'blade')!==G.itemName(mk(50,0),'blade'));assert.equal(new Set(Array.from({length:50},(_,i)=>G.itemName(mk(i+1,0),'blade'))).size,50,'fifty different names');
  const w=mk(8,14);A.inv.push(w);A.feathers=10;assert.match(G.apply(A,'wingEvolve',{id:w.id}).msg,/\+15|15/);
  w.p=15;A.feathers=1;assert.match(G.apply(A,'wingEvolve',{id:w.id}).msg,/נוצות/);A.feathers=10;const need=G.wingFeathers(8);
  const fail=G.apply(A,'wingEvolve',{id:w.id});assert.ok(fail.ok);assert.equal(fail.evolved,false);assert.equal(w.t,8);assert.equal(w.p,15);assert.equal(A.feathers,10-need);
  x=.01;const ok=G.apply(A,'wingEvolve',{id:w.id});assert.equal(ok.evolved,true);assert.equal(w.t,9);assert.equal(w.p,0,'the next rank starts at +0');assert.equal(G.apply(A,'wingEvolve',{id:w.id}).ok,false,'and cannot be evolved again until it is back at +15');w.p=15;assert.equal(A.feathers,10-2*need);
  w.t=50;assert.equal(G.apply(A,'wingEvolve',{id:w.id}).ok,false);A.coins=100;assert.ok(G.apply(A,'buy',{shop:'season',k:'feather'}).ok);assert.equal(A.coins,60);
  assert.ok(G.wingChance(1)>G.wingChance(49)&&G.wingFeathers(49)>G.wingFeathers(1));
});

test('gear asks for stats: a weak character cannot wear strong gear, automatic points always can, resets do not strip gear',()=>{
  const st={now:Date.parse('2026-11-26T12:20:00Z')};G.setEnv(()=>.5,()=>st.now);const A=G.newAccount();G.apply(A,'create',{name:'aaaa',cls:'blade'});const s=A.chars[0];
  const top={id:5001,s:'w',t:8,r:3,p:0,z:21,af:[]};A.inv.push(top);s.autoPts=false;assert.match(G.apply(A,'equip',{id:5001}).msg,/כוח/);assert.equal(!!(s.eq.w&&s.eq.w.id===5001),false);
  assert.equal(G.apply(A,'bestEq',{}).n,0,'the button does not put it on either');
  s.pts=5000;G.apply(A,'autoPts',{});assert.ok(G.canWear(s,top),'automatic points go first to what the gear asks');assert.ok(G.apply(A,'equip',{id:5001}).ok);
  assert.ok(G.reqOf({s:'w',t:8,p:15},'blade').str>G.reqOf({s:'w',t:8,p:0},'blade').str);assert.ok(G.reqOf({s:'w',t:9,p:0},'blade').str>G.reqOf({s:'w',t:8,p:0},'blade').str);
  assert.deepEqual(Object.keys(G.reqOf({s:'a',t:3,p:0},'hunter')).sort(),['agi','vit']);assert.deepEqual(Object.keys(G.reqOf({s:'w',t:3,p:0},'storm')),['ene']);
  for(const cls of ['blade','storm','hunter']){const B=G.newAccount();G.apply(B,'create',{name:'bbbb',cls:cls});const c=B.chars[0];
    for(let zi=0;zi<24;zi++){const L=G.ZONES[zi].min;c.stats={str:15,agi:15,vit:15,ene:15};c.pts=5*(L-1);c.autoPts=true;G.apply(B,'autoPts',{});G.apply(B,'autoPts',{});
      for(const sl of ['w','a','h'])assert.ok(G.canWear(c,{s:sl,t:G.tierOf(zi),r:4,p:9,z:zi,af:[]}),cls+' at level '+L+' wears +9 '+sl+' of map '+zi);}}
  s.lvl=400;assert.ok(G.apply(A,'reset',{}).ok);assert.equal(s.eq.w.id,5001);assert.ok(G.canWear(s,top));
});

test('respec, pickup filter, weekly tasks, side quests and hidden finds',()=>{
  const st={now:Date.parse('2026-11-26T12:20:00Z')};let x=.5;G.setEnv(()=>x,()=>st.now);const A=G.newAccount();G.apply(A,'create',{name:'aaaa',cls:'blade'});const s=A.chars[0];
  s.autoPts=false;s.stats.str=500;s.stats.vit=300;assert.match(G.apply(A,'respec',{}).msg,/אותות/);A.cred=20;const r=G.apply(A,'respec',{});assert.ok(r.ok);assert.equal(r.pts,770);assert.equal(s.pts,770);assert.deepEqual(s.stats,{str:15,agi:15,vit:15,ene:15});assert.equal(A.cred,20-G.RESPEC_COST);
  assert.equal(G.apply(A,'respec',{}).ok,false);
  s.lvl=300;s.stats.str=9000;s.stats.vit=9000;A.autoSell=0;A.autoEq=false;assert.ok(G.pickOf(A)['0']);G.apply(A,'pick',{k:'0'});G.apply(A,'pick',{k:'1'});assert.equal(G.pickOf(A)['0'],false);assert.equal(G.apply(A,'pick',{k:'zz'}).ok,false);
  G.apply(A,'travel',{z:0});let left=0,names=0;for(let i=0;i<200;i++){st.now+=20000;x=(i*.6180339)%1;const t=G.apply(A,'tick',{z:0,kills:40});left+=t.rep.left||0;names+=(t.rep.names||[]).length;}x=.5;
  assert.ok(left>20,'left on the ground: '+left);assert.ok(names>0);assert.ok(A.inv.every(it=>it.r>=2||it.ex||it.s==='g'),'nothing common or magic was picked up');
  assert.ok(A.week.kills>5000);A.week.kills=40000;const f0=A.feathers||0;assert.ok(G.apply(A,'claimWeek',{k:'kills'}).ok);assert.equal(A.feathers,f0+1);assert.equal(G.apply(A,'claimWeek',{k:'kills'}).ok,false);
  st.now+=8*86400000;G.apply(A,'sync',{});assert.deepEqual(A.week.done,{},'a new week starts clean');
  A.daily.boss=3;const g0=A.gems;assert.ok(G.apply(A,'claimTask',{k:'boss'}).ok);assert.equal(A.gems,g0+6);A.daily.kills=6000;assert.ok(G.apply(A,'claimTask',{k:'big'}).ok);
  A.sq={i:0,m:0,z:0,n:250,have:0,until:st.now+600000};G.apply(A,'travel',{z:0});let done=false;for(let i=0;i<20&&!done;i++){st.now+=20000;done=!!G.apply(A,'tick',{z:0,kills:40}).sqDone;}assert.ok(done);assert.ok(G.apply(A,'sqClaim',{}).ok);assert.equal(A.sq,null);
  A.sq={i:0,m:0,z:0,n:250,have:0,until:st.now-1};st.now+=20000;assert.ok(G.apply(A,'tick',{z:0,kills:10}).sqLost);
  assert.ok(G.apply(A,'egg',{k:'moon'}).ok);assert.equal(G.apply(A,'egg',{k:'moon'}).ok,false);assert.equal(G.apply(A,'egg',{k:'dawn'}).ok,false,'only at four in the morning');assert.equal(G.apply(A,'egg',{k:'nope'}).ok,false);
});

test('the live duel: the server fixes the numbers and refuses a win claimed faster than it could be earned',()=>{
  const st={now:Date.parse('2026-11-26T12:20:00Z')};G.setEnv(()=>.5,()=>st.now);const A=G.newAccount();G.apply(A,'create',{name:'aaaa',cls:'blade'});
  assert.equal(G.apply(A,'duelEnd',{win:true}).ok,false);G.apply(A,'opps',{},{players:[],uid:'x'});const s0=G.apply(A,'duelStart',{i:1});assert.ok(s0.ok&&s0.pd.live&&s0.pd.live.b[0]>0&&s0.pd.live.pool[1]>0);
  const r0=A.rating;st.now+=1500;const fast=G.apply(A,'duelEnd',{win:true});assert.ok(fast.ok);assert.equal(fast.win,false);assert.ok(fast.denied);assert.equal(A.rating,r0-12);assert.equal(A.pd,null);
  G.apply(A,'opps',{},{players:[],uid:'x'});G.apply(A,'duelStart',{i:1});st.now+=30000;const ok=G.apply(A,'duelEnd',{win:true});assert.equal(ok.win,true);assert.ok(ok.gain>0);
  G.apply(A,'opps',{},{players:[],uid:'x'});G.apply(A,'duelStart',{i:1});st.now+=20000;const lost=G.apply(A,'duelEnd',{win:false});assert.equal(lost.win,false);assert.equal(lost.gain,0);
});

test('a duel against a player seen on the map uses the fighter the server looked up, never one the client sends',()=>{
  const st={now:Date.parse('2026-11-26T12:20:00Z')};G.setEnv(()=>.5,()=>st.now);const A=G.newAccount();G.apply(A,'create',{name:'aaaa',cls:'blade'});
  assert.match(G.apply(A,'duelStart',{k:'0123456789'}).msg,/לא כאן/);
  const t=G.cleanPlayer('u2',{n:'יריב',c:'storm',l:50,r:1,p:900,d:120,a:1.1,h:900,f:60,cr:.1,cd:2,rt:1100});const r=G.apply(A,'duelStart',{k:'0123456789'},{target:t});
  assert.ok(r.ok);assert.equal(r.pd.o.n,'יריב');assert.equal(r.pd.o.id,undefined,'ids never reach the browser');assert.ok(r.pd.live.b[1]>0);
});

test('live duel rules: range, lanes, cooldowns, shield, dodge, stun and potions behave, for either side',()=>{
  const F=(c,d,h)=>({c:c,d:d,a:1,h:h,f:200,cr:0,cd:2});const D=G.liveNew(F('blade',1000,10000),F('storm',1000,10000)),r=()=>.5;
  assert.equal(G.liveAct(D,0,'atk',r),null,'still winding up at the start');D.t=1;assert.equal(G.liveAct(D,0,'atk',r),null,'a blade out of reach cannot hit');
  D.f[1].x-=20;const far=G.liveAct(D,1,'atk',r);assert.ok(far&&far.dm>0,'the mage reaches from afar');assert.ok(D.f[0].hp<1);
  D.f[0].x=D.f[1].x-40;D.f[0].z=.95;const miss=G.liveAct(D,0,'atk',r);assert.equal(miss.miss,'lane');assert.equal(miss.dm,0);
  D.f[0].z=.5;assert.equal(G.liveAct(D,0,'atk',r),null,'the swing is on cooldown');D.t=3;const h0=D.f[1].hp,a=G.liveAct(D,0,'atk',r);assert.ok(a.dm>0&&D.f[1].hp<h0);
  assert.ok(G.liveAct(D,1,'s2',r));const g=G.liveAct(D,0,'s1',r);assert.ok(g.guard&&!g.stun,'a shield stops the stun and most of the blow');assert.equal(G.liveAct(D,0,'s1',r),null);
  D.t=20;const st=G.liveAct(D,0,'s1',r);assert.ok(st.stun);assert.equal(G.liveAct(D,1,'atk',r),null,'stunned');D.t=21.5;assert.ok(G.liveAct(D,1,'dash',r));const dodged=G.liveAct(D,0,'s0',r);assert.equal(dodged.miss,'inv');
  D.f[1].hp=.2;const p=G.liveAct(D,1,'pot',r);assert.equal(p.heal,.3);assert.equal(D.f[1].pots,2);assert.equal(G.liveAct(D,1,'pot',r),null);assert.equal(G.liveAct(D,0,'nope',r),null);
  D.t=40;D.f[1].hp=.01;const k=G.liveAct(D,0,'s3',r);assert.ok(k.dm>0);assert.equal(D.over,1);assert.equal(D.win,0);assert.equal(G.liveAct(D,1,'atk',r),null);
  const E=G.liveNew(F('blade',1000,10000),F('blade',1000,10000));E.t=80;E.f[1].hp=.4;assert.equal(G.liveOver(E),1);assert.equal(E.win,0,'on time, the healthier side wins');
});

test('English: every Hebrew phrase in the game has a translation, and sentences built around names and numbers come out whole',async()=>{
  const fs=await import('node:fs');const {EN}=await import('../web/en.js');
  const RUN=/[֐-׿][֐-׿ "'׳״\-]*[֐-׿]|[֐-׿]/g,miss=new Set();
  for(const f of ['web/core.js','web/game.js','web/index.html','supabase/functions/act/handler.js','server/live.mjs'])
    for(const m of fs.readFileSync(f,'utf8').match(RUN)||[]){const k=m.replace(/\s+/g,' ').replace(/^[ '"\-]+|[ '"\-]+$/g,'');if(k&&EN[k]===undefined)miss.add(k);}
  assert.deepEqual([...miss],[],'phrases without English: add them to web/en.js');
  const store={'eternal-cycle-lang':'en'};globalThis.localStorage={getItem:k=>store[k]||null,setItem(){}};
  const {tr}=await import('../web/i18n.js?en');
  assert.equal(tr('חסל 1,500 מפלצות'),'Kill 1,500 monsters');assert.equal(tr('הבוס של ביצת הערפל הופיע בקצה המפה'),'The boss of Mist Marsh appeared at the edge of the map');
  assert.equal(tr('Santrio · רמה 141'),'Santrio · Level 141');assert.equal(tr('abc 123'),'abc 123');assert.ok(!/[֐-׿]/.test(tr('צריך 5 שברי ארגמן. יש לך 2')));
  assert.equal(tr('עוד 20 רמות'),'20 more levels');assert.equal(tr('נשארו 36 ימים לעונה'),'36 days left in the season');assert.equal(tr('נצח 12 קרבות זירה'),'Win 12 arena fights');assert.equal(tr('מביצת הערפל'),'From Mist Marsh');assert.equal(tr('הדירוג עלה ב-14, קיבלת 8 מטבעות עונה'),'Rating +14, and you received 8 Season Coins');
  delete globalThis.localStorage;
});

test('endless progress: cycle rank from lifetime kills, champions, and the tower',()=>{
  assert.equal(G.mastery(0),0);assert.equal(G.mastery(1999),0);assert.equal(G.mastery(2000),1);for(const l of [1,2,5,20,80]){assert.equal(G.mastery(G.masteryNeed(l)),l);assert.equal(G.mastery(G.masteryNeed(l)-1),l-1);}
  assert.ok(G.masteryNeed(100)>G.masteryNeed(50)*3,'each rank costs more than the last');
  const b1=G.towerBoss(1),b30=G.towerBoss(30);assert.ok(b30.hp>b1.hp*100&&b30.atk>b1.atk*20);assert.ok(G.towerReward(10).feathers>=1&&G.towerReward(3).coins>0&&!G.towerReward(1).coins);
  let t=Date.UTC(2026,10,26,12,20);G.setEnv(()=>.5,()=>t);
  const A=G.newAccount();G.apply(A,'create',{name:'Toww',cls:'blade'},{});
  const s=G.apply(A,'towerStart',{},{});assert.ok(s.ok&&s.pd&&s.pd.tower===1,JSON.stringify(s).slice(0,200));assert.equal(s.left,G.TOWER_TRIES-1);
  assert.ok(!G.apply(A,'duelEnd',{win:true},{}).ok,'a tower fight cannot be closed as an arena fight');
  const fast=G.apply(A,'towerEnd',{win:true},{});assert.ok(!fast.ok||fast.denied||!(A.tower&&A.tower.best),'a win reported instantly is not accepted');
  const s2=G.apply(A,'towerStart',{},{});assert.ok(s2.ok);t+=70000;const g0=A.gems,w=G.apply(A,'towerEnd',{win:true},{});assert.ok(w.ok,JSON.stringify(w).slice(0,200));assert.equal(A.tower.best,1);assert.ok(A.gems>g0);
  const s3=G.apply(A,'towerStart',{},{});assert.equal(s3.pd.tower,2);t+=70000;G.apply(A,'towerEnd',{win:false},{});assert.equal(A.tower.best,1);
  for(let i=0;i<G.TOWER_TRIES+2;i++){const q=G.apply(A,'towerStart',{},{});if(!q.ok)break;t+=70000;G.apply(A,'towerEnd',{win:false},{});}
  assert.ok(!G.apply(A,'towerStart',{},{}).ok,'tries run out for the day');
  G.setEnv(Math.random,Date.now);
});

test('a boss beaten without taking a marked move pays one extra soul stone, and only with an accepted kill',()=>{
  let t=Date.UTC(2026,10,26,12,20);G.setEnv(()=>.5,()=>t);
  const run=clean=>{const A=G.newAccount();G.apply(A,'create',{name:'Clnn',cls:'blade'},{});G.apply(A,'travel',{z:0},{});A.bossAt={z:0,t:t-600000};const g=A.gems,r=G.apply(A,'tick',{z:0,f:0,kills:0,boss:true,clean:clean},{});return [A.gems-g,r.rep];};
  const [a,ra]=run(true),[b,rb]=run(false);assert.ok(ra.boss&&rb.boss,'both kills accepted');assert.equal(a-b,1);assert.ok(ra.clean&&!rb.clean);
  const A=G.newAccount();G.apply(A,'create',{name:'Clnn',cls:'blade'},{});G.apply(A,'travel',{z:0},{});const g=A.gems,r=G.apply(A,'tick',{z:0,f:0,kills:0,boss:true,clean:true},{});assert.ok(!r.rep.clean&&A.gems===g,'no boss, no bonus');
  G.setEnv(Math.random,Date.now);
});

test('two ancient sets per tier, and the perfect ancient piece',()=>{
  G.setEnv(()=>.5,()=>1.8e12);const A=G.newAccount();G.apply(A,'create',{name:'Sett',cls:'blade'},{});const s=A.chars[0];
  for(const k of G.DROPS){s.eq[k]=G.makeItem(s,k,3,4,6);s.eq[k].v=1;}
  assert.equal(G.setCounts(s)['2b'],6);assert.equal(G.setCounts(s)[2],undefined,'the two sets of a tier do not count together');assert.equal(G.setName('2b'),G.SETN2[2]);assert.equal(G.setName('2'),G.SETN[2]);
  const c2=G.calc(s);delete s.eq.w.v;const mixed=G.calc(s);assert.ok(mixed.hp<c2.hp,'breaking the set loses its six-piece bonus');assert.ok(G.itemName(s.eq.h,'blade').includes(G.SETN2[2]));
  let seen=[0,0];for(let i=0;i<200;i++){const it=G.makeItem(s,'h',3,4,6);seen[it.v?1:0]++;}assert.ok(seen[0]>40&&seen[1]>40,'both sets drop');assert.equal(G.makeItem(s,'h',3,3,5).v,undefined);
  let x=.5;G.setEnv(()=>x,()=>1.8e12);assert.equal(G.perfectDrop(s,6,{},G.PERFECT_BOSS),null);x=0;const rep={};const it=G.perfectDrop(s,6,rep,G.PERFECT_BOSS);
  assert.ok(it&&it.pf&&it.r===4&&G.isFull(it)&&rep.perfect===1&&rep.notable[0]===it);assert.ok(G.itemName(it,'blade').startsWith('עתיק מושלם'));
  const plain={...it,pf:0};assert.ok(Math.abs((G.itemVals(it).atk||G.itemVals(it).hp)/(G.itemVals(plain).atk||G.itemVals(plain).hp)-G.PERFECT_M)<.02);
  A.pick={'4':false,set:false,ex:false};A.inv.length=0;for(let i=0;i<60;i++)A.inv.push(G.makeItem(s,'h',1,0,0));const n=A.inv.length;x=0;const it2=G.perfectDrop(s,6,{},1);assert.ok(A.inv.includes(it2)||Object.values(s.eq).includes(it2),'kept even with a full bag and every pickup switch off');
  assert.ok(G.PERFECT_BOSS<=.0005&&G.PERFECT_ELITE<=.002,'the odds stay tiny');
  G.setEnv(Math.random,Date.now);
});

test('jewelry: two rings and a necklace give percent damage and health, drop, upgrade and stay out of sets',()=>{
  G.setEnv(()=>.5,()=>1.8e12);const A=G.newAccount();G.apply(A,'create',{name:'Jeww',cls:'blade'},{});const s=A.chars[0];s.stats.str=5000;
  assert.ok('r' in s.eq&&'q' in s.eq&&'n' in s.eq);const c0=G.calc(s);
  const r=G.makeItem(s,'r',5,3,12),q=G.makeItem(s,'q',5,3,12),n=G.makeItem(s,'n',5,4,12);r.af=[];q.af=[];n.af=[];
  assert.ok(G.itemVals(r).wd>0&&!G.itemVals(r).wh);assert.ok(G.itemVals(q).wh>0&&!G.itemVals(q).wd);assert.ok(G.itemVals(n).wd>0&&G.itemVals(n).wh>0);assert.equal(n.v,undefined);
  s.eq.r=r;const c1=G.calc(s);assert.ok(c1.dmg>c0.dmg*1.04&&Math.abs(c1.hp-c0.hp)<1);s.eq.q=q;const c2=G.calc(s);assert.ok(c2.hp>c1.hp*1.04);s.eq.n=n;assert.equal(Object.keys(G.setCounts(s)).length,0,'a necklace is not a set piece');
  const v0=G.itemVals(r).wd;r.p=15;assert.ok(G.itemVals(r).wd>v0*1.8);assert.ok(G.itemScore(r)>0&&G.itemName(r,'blade').includes('טבעת עוצמה'));
  const it=G.jewelDrop(s,12,{},[0,0,100,0,0],0);assert.ok(G.JEW.includes(it.s)&&it.r===2&&it.t===G.tierOf(12));
  const old=G.adopt(JSON.parse(JSON.stringify(Object.assign({},A,{chars:A.chars.map(c=>({...c,eq:{w:null,h:null,a:null,p:null,l:null,b:null,g:null}}))}))));assert.ok('n' in old.chars[0].eq,'a save from before jewelry gets the new slots');
  const ci=G.cleanItem({s:'a',t:14,r:4,p:3,z:30,v:1,pf:1,ex:1,af:[]});assert.equal(ci.t,14);assert.ok(ci.v&&ci.pf,'trading keeps the tier, the set and the perfect mark');
  G.setEnv(Math.random,Date.now);
});
test('the last circle: an open round field, everyone equal, gear from the ground decides, the circle closes',()=>{
  let seed=11;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};let t=Date.UTC(2026,10,26,10,10,30);G.setEnv(rnd,()=>t);
  const P=(n,m)=>G.cleanPlayer(n,{n:n,c:'blade',l:100,d:400*m,a:1.2,h:5000*m,f:200,cr:.1});
  const hs=[P('a',1),P('b',50)],ps=hs.concat(G.brBots(hs,4,rnd));assert.equal(ps.length,6);assert.ok(ps[5].bot);
  const B=G.brNew(ps,rnd);assert.equal(B.loot.length,G.BR.loot0);assert.ok(B.f.every(f=>Math.hypot(f.x,f.y)<=G.BR.R&&f.w===0&&f.ar===0),'everyone starts inside and bare');
  assert.equal(G.brAct(B,0,'atk',rnd),null,'nothing happens during the countdown');B.t=0;B.loot=[];B.nextLoot=1e9;B.dropped=true;
  const put=(i,x,y)=>{B.f[i].x=x;B.f[i].y=y;};put(0,0,0);put(1,40,20);for(let i=2;i<6;i++){put(i,-500,-300+i*40);B.f[i].think=1e9;B.f[i].bot=false;}
  const o=G.brAct(B,0,'atk',rnd);assert.ok(o&&o.to===1&&o.dm>0,'a hit lands on the nearest fighter in reach, in any direction');assert.equal(G.brAct(B,0,'atk',rnd),null,'the attack has a cooldown');
  B.t=5;const back=G.brAct(B,1,'atk',rnd);assert.ok(Math.abs(back.dm/o.dm-1)<.7,'what a player wears outside does not matter here: '+back.dm+' vs '+o.dm);
  put(1,0,300);B.t=10;assert.equal(G.brAct(B,0,'atk',rnd),null,'out of reach');put(1,40,20);
  // gear from the ground
  B.loot=[{id:900,x:5,y:5,k:'w'},{id:901,x:-5,y:5,k:'a'},{id:902,x:400,y:0,k:'w'}];let ev=G.brStep(B,.1,rnd);assert.equal(ev.filter(e=>e.k==='pick'&&e.by===0).length,2);assert.equal(B.f[0].w,1);assert.equal(B.f[0].ar,1);assert.equal(B.loot.length,1,'a find far away stays');
  B.t=20;B.f[1].hp=1;const armed=G.brAct(B,0,'atk',rnd);B.t=25;B.f[0].hp=1;const bare=G.brAct(B,1,'atk',rnd);assert.ok(armed.dm>bare.dm*1.2,'a weapon hits harder, and armor takes less: '+armed.dm+' vs '+bare.dm);
  B.f[0].w=G.BR.wMax;B.loot=[{id:903,x:0,y:0,k:'w'}];G.brStep(B,.1,rnd);assert.equal(B.loot.length,1,'what I cannot use stays for someone else');
  assert.ok(G.brAct(B,1,'dash',rnd));B.t=40;assert.ok(G.brAct(B,1,'dash',rnd));assert.ok(G.brAct(B,0,'s0',rnd).miss,'a dash dodges');
  B.t=60;B.f[1].hp=.001;B.f[1].w=2;const k=G.brAct(B,0,'s3',rnd);assert.ok(k.dead&&!B.f[1].alive&&B.f[0].kills===1&&B.out[0]===1);assert.ok(B.loot.some(l=>l.k==='w'&&Math.abs(l.x-40)<2),'the fallen drops his weapon');
  assert.equal(G.brRing(Object.assign({},B,{t:0})),G.BR.R);assert.equal(G.brRing(Object.assign({},B,{t:G.BR.TIME})),G.BR.END);
  B.t=G.BR.TIME-30;put(2,-600,0);const h0=B.f[2].hp;G.brStep(B,1,rnd);assert.ok(B.f[2].hp<h0,'outside the circle burns');put(0,0,0);const h1=B.f[0].hp;G.brStep(B,1,rnd);assert.equal(B.f[0].hp,h1);
  for(let i=2;i<6;i++){B.f[i].bot=true;B.f[i].think=0;}let n=0;while(!B.over&&n++<3000)G.brStep(B,.2,rnd);assert.ok(B.over&&B.t<=G.BR.TIME+1);const rank=G.brRank(B);assert.equal(rank.length,6);assert.equal(rank[rank.length-1],1,'the first to fall is last');assert.equal(new Set(rank).size,6);
  { // a whole fight between the server's own fighters: they gear up, the legendary weapon lands, someone wins
    const C=G.brNew(G.brBots([P('x',1)],6,rnd),rnd);let picks=0,big=0,m=0;while(!C.over&&m++<3000)for(const e of G.brStep(C,.2,rnd)){if(e.k==='pick')picks++;if(e.big)big++;}
    assert.ok(C.over&&picks>=6,'picks: '+picks);assert.ok(C.t<G.BR.drop||big===1);assert.ok(C.f.every(f=>Math.hypot(f.x,f.y)<=G.BR.R+1));}
  const A=G.newAccount();G.apply(A,'create',{name:'Winn',cls:'blade'},{});const c0=A.coins,f0=A.feathers||0,rt=G.brReward(A,0,2);assert.ok(rt.includes('תיבה עתיקה'));assert.equal(A.coins,c0+40);assert.equal((A.feathers||0),f0+1);
  const got=A.inv.concat(Object.values(A.chars[0].eq).filter(Boolean));assert.ok(got.some(it=>it.r===4&&G.DROPS.includes(it.s)),'two or more players: the chest holds an ancient piece');assert.ok(got.some(it=>G.JEW.includes(it.s)));
  const A2=G.newAccount();G.apply(A2,'create',{name:'Secc',cls:'blade'},{});const sb=A2.sboxes;G.brReward(A2,1,2);assert.equal(A2.sboxes,sb+1);const c5=A2.coins;G.brReward(A2,4,2);assert.equal(A2.coins,c5+5);
  const w=G.brWindow(Date.UTC(2026,10,26,10,10,30));assert.equal(w.phase,'sign');assert.equal(G.brWindow(Date.UTC(2026,10,26,10,13,0)).phase,'fight');assert.equal(G.brWindow(Date.UTC(2026,10,26,10,40,0)),null);
  G.setEnv(Math.random,Date.now);
});

test('a game master bonus is clamped, ends on time, and multiplies what events give',()=>{
  const t=Date.UTC(2026,10,26,8,29,0);const base=G.evMods(t);
  const b=G.setBoost({xp:50,drop:-4,until:t+60000});assert.equal(b.xp,3,'never more than triple');assert.equal(b.drop,1);
  assert.equal(G.evMods(t).xp,base.xp*3);assert.equal(G.evMods(t+60001).xp,G.evMods(t+60001).xp);assert.equal(G.boostNow(t+60001),null,'over when its time is up');
  G.setBoost({xp:2,drop:2,until:t+1000});assert.equal(G.evMods(t).drop,base.drop*2);G.setBoost(null);assert.equal(G.evMods(t).xp,base.xp);
});

test('what others see of a player carries the count of perfect ancient pieces',()=>{
  G.setEnv(()=>.5,()=>1.8e12);const A=G.newAccount();G.apply(A,'create',{name:'Pfff',cls:'blade'},{});const s=A.chars[0];assert.equal(G.fighter(s).pf,0);
  s.eq.h=G.makeItem(s,'h',1,4,0);s.eq.h.pf=1;s.eq.a=G.makeItem(s,'a',1,4,0);s.eq.a.pf=1;assert.equal(G.fighter(s).pf,2);assert.equal(G.cleanPlayer('x',G.fighter(s)).pf,2);assert.equal(G.cleanPlayer('x',{pf:999}).pf,10);
  G.setEnv(Math.random,Date.now);
});

test("the day's trial: sized to the character, timed by the server, a better medal pays the difference",()=>{
  let t=Date.UTC(2026,10,26,12,20);G.setEnv(()=>.5,()=>t);const A=G.newAccount();G.apply(A,'create',{name:'Trii',cls:'blade'},{});const c=G.calc(A.chars[0]);
  const s=G.apply(A,'trialStart',{},{});assert.ok(s.ok&&s.pd.trial>=1&&s.pd.trial<=3);assert.ok(Math.abs(s.pd.live.pool[1]/c.dps-(s.pd.trial===2?30:22))<.5,'the guardian is a fixed number of seconds of my own damage');
  assert.ok(!G.apply(A,'towerEnd',{win:true},{}).ok,'a trial cannot be closed as a tower floor');assert.ok(!G.apply(A,'duelEnd',{win:true},{}).ok);
  const fast=G.apply(A,'trialEnd',{win:true},{});assert.ok(fast.denied&&A.daily.trB==null,'an instant win is refused');
  G.apply(A,'trialStart',{},{});t+=60000;const g0=A.gems,c0=A.coins,w=G.apply(A,'trialEnd',{win:true},{});assert.equal(w.tier,2);assert.equal(A.gems,g0+2);assert.equal(A.coins,c0+4);
  G.apply(A,'trialStart',{},{});t+=25000;const b0=A.boxes,w2=G.apply(A,'trialEnd',{win:true},{});assert.equal(w2.tier,0);assert.equal(A.gems,g0+6);assert.equal(A.coins,c0+15);assert.equal(A.boxes,b0+1);
  assert.ok(!G.apply(A,'trialStart',{},{}).ok,'three tries a day');t+=86400000;const n=G.apply(A,'trialStart',{},{});assert.ok(n.ok&&A.daily.trB==null,'a new day, a new trial');
  G.setEnv(Math.random,Date.now);
});

test('a bought auto reset: only while away, the character resets at the top, stays on its map and keeps training',()=>{
  const now=clock(1.8e12);G.setEnv(()=>.5,now);const A=G.newAccount();G.apply(A,'create',{name:'Auto',cls:'blade'},{});const s=A.chars[0];A.open=G.BASEZ-1;
  A.cred=74;assert.ok(!G.apply(A,'buy',{shop:'reset',k:'areset'},{}).ok,'it costs marks');A.cred=75;assert.ok(G.apply(A,'buy',{shop:'reset',k:'areset'},{}).ok);assert.equal(A.areset,G.ARESET_PACK);assert.equal(A.cred,0);
  s.lvl=G.CAP-1;s.xp=0;s.stats.str=4000;s.stats.vit=2000;s.zone=20;s.last=now();const r0=s.resets,rep=G.offline(s,6*3600);
  assert.ok(rep.resets>=1,'reset while away: '+JSON.stringify(rep).slice(0,120));assert.equal(s.resets,r0+rep.resets);assert.equal(A.areset,G.ARESET_PACK-rep.resets);assert.equal(s.zone,20,'stays on its map');assert.ok(s.lvl>1&&s.lvl<=G.CAP,'and went on training: '+s.lvl);
  assert.equal(A.cred,Array.from({length:rep.resets},(_,i)=>Math.floor((10+2*Math.min(r0+i+1,10))/2)).reduce((a,b)=>a+b,0),'half the marks of an ordinary reset');
  const B=G.newAccount();G.apply(B,'create',{name:'NoAuto',cls:'blade'},{});const b=B.chars[0];B.open=G.BASEZ-1;b.lvl=G.CAP-1;b.stats.str=4000;b.stats.vit=2000;b.zone=20;b.last=now();const rb=G.offline(b,6*3600);assert.ok(!rb.resets&&b.resets===0&&b.lvl===G.CAP,'without it the character waits at the top');
  A.areset=G.ARESET_MAX-1;A.cred=99;assert.ok(!G.apply(A,'buy',{shop:'reset',k:'areset'},{}).ok,'there is a limit to how many can be held');
  G.setEnv(Math.random,Date.now);
});

test('time until an absent character stands at the reset level',()=>{
  const now=clock(1.8e12);G.setEnv(()=>.5,now);const A=G.newAccount();G.apply(A,'create',{name:'Etaa',cls:'blade'},{});const s=A.chars[0];A.open=G.BASEZ-1;
  assert.equal(G.afkEta(A),null,'in town nothing trains');s.zone=20;s.lvl=G.CAP-1;s.xp=0;s.stats.str=4000;s.stats.vit=2000;const snap=JSON.stringify(A);
  const e1=G.afkEta(A);assert.ok(e1>0&&e1<3600,'one level away: '+e1);assert.equal(JSON.stringify(A),snap,'asking changes nothing');
  s.last=now();const rep=G.offline(s,Math.ceil(e1)+2);assert.equal(s.lvl,G.CAP,'and it is right: the character is there after that long');
  const B=G.adopt(JSON.parse(snap));B.areset=1;const e2=G.afkEta(B);assert.ok(e2>e1*20,'with an auto reset left the message waits for the next time at the top: '+e2);
  const C=G.adopt(JSON.parse(snap));C.chars[0].lvl=G.CAP;assert.equal(G.afkEta(C),0);C.chars[0].lvl=2;C.chars[0].stats.str=15;C.chars[0].zone=0;const far=G.afkEta(C);assert.ok(far===null||far>3600);
  G.setEnv(Math.random,Date.now);
});

test('pets: rare in boxes, timed from the first wear, a small bonus, sell what the filter leaves, tradeable while unworn',()=>{
  let t=1.8e12,x=.5;G.setEnv(()=>x,()=>t);const A=G.newAccount();G.apply(A,'create',{name:'Pett',cls:'blade'},{});const s=A.chars[0];
  assert.ok(G.PET_BOX[4]<=.00005&&G.PET_BOX.reduce((a,b)=>a+b,0)<.04,'pets are rare, the best one almost never');
  x=.999;assert.equal(G.petRoll(s,1),null);x=0;assert.equal(G.petRoll(s,1).r,4);x=G.PET_BOX[4]+G.PET_BOX[3]+G.PET_BOX[2]+G.PET_BOX[1]+.001;assert.equal(G.petRoll(s,1).r,0);
  const base=G.calc(s),p=G.makePet(s,3);assert.equal(G.itemName(p,'blade'),G.PETN[3]);assert.equal(p.until,undefined);A.inv.push(p);
  assert.ok(G.apply(A,'equip',{id:p.id},{}).ok);assert.ok(G.apply(A,'sync',{},{}).ok);assert.equal(s.eq.y.until,t+14*864e5,'its time starts when it is first worn');
  const c=G.calc(s);assert.ok(c.dmg>base.dmg*1.04&&c.hp>base.hp*1.04&&c.goldM>base.goldM);assert.equal(G.apply(A,'upgrade',{id:p.id},{}).ok,false);
  A.pick={'0':false};const junk=G.makeItem(s,'h',1,0,0),g0=A.gold,rep={};assert.equal(G.gainItem(s,junk,rep),'sold','the pet sells what the filter would leave');assert.ok(A.gold>g0&&rep.petGold>0&&!rep.left);
  t+=14*864e5+1000;const r=G.apply(A,'sync',{},{});assert.equal(r.petGone,G.PETN[3]);assert.equal(s.eq.y,null);assert.ok(Math.abs(G.calc(s).dmg-base.dmg)<1);
  const rep2={};assert.equal(G.gainItem(s,G.makeItem(s,'h',1,0,0),rep2),'left','no pet, no fetching');
  const ci=G.cleanItem({s:'y',r:4,t:9,p:15,af:[['dmg',999]],dur:1e15});assert.equal(ci.t,1);assert.equal(ci.p,0);assert.deepEqual(ci.af,G.PET_AF[4]);assert.equal(ci.dur,90*864e5,'a traded pet is rebuilt from its rarity alone');
  x=0;A.boxes=1;const b=G.apply(A,'openBox',{k:''},{});assert.ok(b.ok&&b.box.pet&&b.box.it.s==='y');
  G.setEnv(Math.random,Date.now);
});

test('castle siege: no guards, real strength, walls and gates, switches then the crown, combos, guild buffs, potions',()=>{
  let seed=3;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};G.setEnv(rnd,()=>1.8e12);
  const P=(n,m,c)=>G.cleanPlayer(n,{n:n,c:c||'blade',l:100,d:400*(m||1),a:1.2,h:5000,f:200,cr:0,cd:2});
  const B=G.sgNew(rnd,{});assert.equal(B.f.length,0,'nobody but players: the castle starts empty');assert.equal(B.sg.holder,0);
  const a=G.sgAdd(B,P('a'),7,'AA',rnd),b=G.sgAdd(B,P('b'),7,'AA',rnd),e=G.sgAdd(B,P('e'),9,'BB',rnd),s=G.sgAdd(B,P('s',10),9,'BB',rnd);B.t=0;const fa=B.f[a],fb=B.f[b],fe=B.f[e],fs=B.f[s];fs.x=700;fs.y=1900;
  assert.ok(fa.y>1700,'everyone starts in the far camp');G.sgMove(B,fa,fa.x,0);assert.ok(fa.y>1300,'a rampart crosses the road: the way is through its passes: '+fa.y);fa.x=0;fa.y=200;G.sgMove(B,fa,0,0);assert.ok(fa.y>130&&fa.y<200,'a standing gate stops him: '+fa.y);
  fe.x=fa.x+30;fe.y=fa.y;fb.x=fa.x-30;fb.y=fa.y;const h=G.sgAct(B,a,'atk',rnd);assert.equal(h.to,e,'a guildmate is never hit, an enemy is');
  { // real strength: ten times the damage is ten times the blow
    const X=G.sgNew(rnd,{}),w=G.sgAdd(X,P('w',1),1,'',rnd),st=G.sgAdd(X,P('st',10),2,'',rnd),v=G.sgAdd(X,P('v',1),3,'',rnd);X.t=5;for(const i of [w,st,v]){X.f[i].x=0;X.f[i].y=1900;}X.f[v].x=30;X.f[w].x=-600;
    const big=G.sgAct(X,st,'s0',rnd).dm;X.f[st].x=-600;X.f[w].x=0;const small=G.sgAct(X,w,'s0',rnd).dm;assert.ok(big>small*3,'strength decides between the unequal: strong '+big+' weak '+small);}
  fe.x=fa.x;fe.y=fa.y-90;B.t+=2;assert.ok(G.sgAct(B,a,'atk',rnd).gate===0,'an enemy behind the gate is out of reach: the blow lands on the gate');
  fe.x=600;fe.y=1900;let n=0;while(B.sg.gate[0]>0&&n++<300){B.t+=1.3;G.sgAct(B,a,'atk',rnd);}assert.ok(B.sg.gate[0]<=0&&n>10,'the blows fall on the gate until it breaks: '+n);
  G.sgMove(B,fa,0,0);assert.ok(Math.abs(fa.y)<2,'and then the way is open');G.sgMove(B,fa,-1200,-300);assert.ok(fa.x>-921,'the wall still stands: '+fa.x);
  // switches are pressed, load, and are held only while their taker stands on them
  const L=G.sgAdd(B,P('lead'),7,'AA',rnd,true),fl=B.f[L];fl.x=600;fl.y=1900;
  fa.x=G.SG.sw[0][0];fa.y=G.SG.sw[0][1];fb.x=G.SG.sw[1][0];fb.y=G.SG.sw[1][1];let ev=[];for(let i=0;i<30;i++)ev=ev.concat(G.sgStep(B,.2,rnd));assert.deepEqual(B.sg.sw,[0,0],'standing there is not enough: the switch must be pressed');
  B.t+=2;const u1=G.sgAct(B,a,'use',rnd);assert.ok(u1&&u1.q===0);for(let i=0;i<8;i++)G.sgStep(B,.2,rnd);assert.equal(B.sg.sw[0],0,'it loads first');for(let i=0;i<10;i++)ev=ev.concat(G.sgStep(B,.2,rnd));assert.equal(B.sg.sw[0],7);assert.equal(B.sg.swBy[0],a);assert.ok(ev.some(x=>x.k==='sw'&&x.by===a));
  fa.x+=200;ev=G.sgStep(B,.2,rnd);assert.equal(B.sg.sw[0],0,'walking off the switch gives it up');assert.ok(ev.some(x=>x.k==='swLost'&&x.q===0));fa.x=G.SG.sw[0][0];
  B.t+=2;G.sgAct(B,a,'use',rnd);fa.x+=200;for(let i=0;i<20;i++)G.sgStep(B,.2,rnd);assert.equal(B.sg.sw[0],0,'and leaving while it loads cancels it');fa.x=G.SG.sw[0][0];
  B.t+=2;G.sgAct(B,a,'use',rnd);B.t+=2;G.sgAct(B,b,'use',rnd);for(let i=0;i<20;i++)G.sgStep(B,.2,rnd);assert.deepEqual(B.sg.sw,[7,7]);assert.deepEqual(B.sg.swBy,[a,b]);
  fe.x=fa.x+10;fe.y=fa.y;B.t+=2;assert.equal(G.sgAct(B,e,'use',rnd).no,'held','a held switch cannot be pressed by another');fe.x=600;fe.y=1900;
  // the crown: the leader only, and only while two others hold the switches
  fe.x=G.SG.crown[0];fe.y=G.SG.crown[1];B.t+=2;assert.equal(G.sgAct(B,e,'use',rnd).no,'lead');B.f[e].lead=true;B.t+=2;assert.equal(G.sgAct(B,e,'use',rnd).no,'sw','a leader whose guild does not hold the switches gets nothing');B.f[e].lead=false;fe.x=600;fe.y=1900;
  fl.x=G.SG.crown[0];fl.y=G.SG.crown[1];B.t+=2;const uc=G.sgAct(B,L,'use',rnd);assert.ok(uc&&uc.c===1);for(let i=0;i<60;i++)G.sgStep(B,.2,rnd);assert.ok(B.sg.crown[1]>5&&B.sg.holder===0,'the crown takes half a minute, not less');
  { // the one holding the right switch is killed: the switch is free again and the crown stops
    fe.x=fb.x+20;fe.y=fb.y;fb.hp=.0001;B.t+=30;fe.at.s3=0;const kk=G.sgAct(B,e,'s3',rnd);assert.ok(kk.dead);const e2=G.sgStep(B,.2,rnd);assert.equal(B.sg.sw[1],0);assert.equal(B.sg.crown[1],0);assert.ok(e2.some(x=>x.k==='swLost'&&x.q===1)&&e2.some(x=>x.k==='cstop'));
    fe.x=600;fe.y=1900;fb.alive=true;fb.hp=1;fb.x=G.SG.sw[1][0];fb.y=G.SG.sw[1][1];B.t+=2;G.sgAct(B,b,'use',rnd);for(let i=0;i<20;i++)G.sgStep(B,.2,rnd);assert.deepEqual(B.sg.sw,[7,7]);}
  B.t+=2;G.sgAct(B,L,'use',rnd);ev=[];for(let i=0;i<160;i++)ev=ev.concat(G.sgStep(B,.2,rnd));assert.equal(B.sg.holder,7,'the leader on the crown for long enough, with both switches held: the castle is theirs');assert.ok(ev.some(x=>x.k==='taken'&&x.g===7&&x.by===L));
  assert.deepEqual(B.sg.gate,G.SG.gates.map(()=>G.SG.gateHp),'the gates are whole again');assert.deepEqual(B.sg.sw,[0,0]);
  { // a combo: one order, one rhythm, one enemy
    const fresh=()=>{fe.alive=true;fe.hp=1;fe.x=fa.x+20;fe.y=fa.y;fe.pool=1e9;fe.stun=0;fe.sh=0;fe.wound=0;B.t+=40;fa.at={atk:0,s0:0,s1:0,s2:0,s3:0,dash:0,pot:0,use:0,buf:0};};
    fresh();const h1=G.sgAct(B,a,'atk',rnd);B.t+=.5;const x0=fe.x,h2=G.sgAct(B,a,'s0',rnd);assert.ok(!h2.px&&fe.x===x0,'a plain skill moves nobody: only the shove and the combo do');B.t+=.5;fe.stun=0;const h3=G.sgAct(B,a,'s1',rnd);assert.ok(!h1.combo&&h2.cb===2&&h3.combo&&h3.stun,'blow, quick skill, stunning skill: combo');
    assert.ok(fe.wound>B.t&&G.sgAct(B,e,'pot',rnd)===null,'stunned');fe.stun=0;fe.pots=5;assert.equal(G.sgAct(B,e,'pot',rnd).no,'wound','and no potion for a moment after a combo');
    fresh();const base=G.sgAct(B,a,'s1',rnd);assert.ok(!base.combo&&h3.dm>base.dm*3,'the last blow of a combo takes a good part of anyone: '+h3.dm+' vs '+base.dm);
    fresh();G.sgAct(B,a,'atk',rnd);B.t+=5;assert.equal(G.sgAct(B,a,'s0',rnd).cb,0,'too slow breaks it');
    fresh();G.sgAct(B,a,'atk',rnd);B.t+=.05;assert.equal(G.sgAct(B,a,'s0',rnd),null,'between blows there is one short beat');B.t+=.37;assert.equal(G.sgAct(B,a,'s0',rnd).cb,2);B.t+=.42;assert.ok(G.sgAct(B,a,'s1',rnd).combo,'the order decides, and the fastest hand that keeps it wins');
    fresh();G.sgAct(B,a,'atk',rnd);B.t+=.5;assert.ok(!G.sgAct(B,a,'s1',rnd).combo,'the wrong order is no combo');
    fresh();G.sgAct(B,a,'atk',rnd);B.t+=.5;G.sgAct(B,a,'s0',rnd);B.t+=.5;fa.at.atk=0;G.sgAct(B,a,'atk',rnd);B.t+=.5;fe.x=fa.x+20;assert.ok(!G.sgAct(B,a,'s1',rnd).combo,'a blow in the middle breaks it');
    fresh();fe.sh=B.t+9;const y0=fe.x;G.sgAct(B,a,'atk',rnd);B.t+=.5;const g2=G.sgAct(B,a,'s0',rnd);assert.ok(g2.guard&&!g2.px&&fe.x===y0,'a shield stands firm');fe.sh=0;}
  { // pushes do not pile up, and neither do combo bursts
    const X=G.sgNew(rnd,{}),q1=G.sgAdd(X,P('p1',1),5,'',rnd),q2=G.sgAdd(X,P('p2',1),5,'',rnd),qe=G.sgAdd(X,P('pe',1),6,'',rnd),f1=X.f[q1],f2=X.f[q2],fe=X.f[qe];X.t=50;
    f1.x=0;f1.y=1900;f2.x=0;f2.y=1900;fe.x=20;fe.y=1900;fe.pool=1e9;f1.at.s0=0;f2.at.s0=0;
    f1.at.bash=0;const o1=G.sgAct(X,q1,'bash',rnd),x1=fe.x;assert.ok(o1.px&&x1>20+G.SG.zone-10,'the shove throws an enemy off a switch: '+x1);fe.x=20;const o2=G.sgAct(X,q2,'s0',rnd);assert.ok(!o2.px&&fe.x===20,'a plain skill moves nobody');
    assert.ok(G.SG.pushC<=G.SG.zone,'one whole combo does not throw a player standing in the middle off a switch');
    const cmb=q=>{const f=X.f[q];f.at={atk:0,s0:0,s1:0,s2:0,s3:0,dash:0,pot:0,use:0,buf:0};f.x=fe.x-20;f.y=fe.y;fe.stun=0;G.sgAct(X,q,'atk',rnd);X.t+=.5;f.x=fe.x-20;G.sgAct(X,q,'s0',rnd);X.t+=.5;f.x=fe.x-20;fe.stun=0;return G.sgAct(X,q,'s1',rnd);};
    X.t+=20;fe.hp=1;const c1=cmb(q1);fe.wound=X.t+9;const c2=cmb(q2);assert.ok(c1.combo&&c2.combo&&c2.again&&c1.dm>c2.dm*3,'a second combo on a wounded enemy is a plain blow: '+c1.dm+' '+c2.dm);}
  { // party buffs are cast on those who stand near, and run out
    const X=G.sgNew(rnd,{}),q1=G.sgAdd(X,P('b1',1,'blade'),5,'',rnd),q2=G.sgAdd(X,P('s1',1,'storm'),5,'',rnd),q3=G.sgAdd(X,P('h1',1,'hunter'),5,'',rnd),q4=G.sgAdd(X,P('far',1,'blade'),5,'',rnd);X.t=1;X.f.forEach(f=>{f.x=0;f.y=1900;});X.f[q4].x=600;
    assert.equal(G.sgBuff(X.f[q1],X.t).n,0);const o=G.sgAct(X,q1,'buf',rnd);assert.equal(o.n,3,'the three who stand near');assert.equal(G.sgAct(X,q1,'buf',rnd),null,'it has a cooldown');G.sgAct(X,q2,'buf',rnd);G.sgAct(X,q3,'buf',rnd);
    const bf=G.sgBuff(X.f[q2],X.t);assert.equal(bf.n,7);assert.ok(bf.dmg>1&&bf.def<.8&&bf.spd<1,'life, defense and power, and all three together speed');assert.equal(G.sgBuff(X.f[q4],X.t).n,0,'not the one far away');
    X.t+=G.SG.buf.dur+1;assert.equal(G.sgBuff(X.f[q2],X.t).n,0,'they run out');}
  { // the throne room: the switches and the crown stand behind an inner wall with one way in
    const X=G.sgNew(rnd,{}),q=G.sgAdd(X,P('w'),5,'',rnd),f=X.f[q];f.x=400;f.y=-400;G.sgMove(X,f,400,-800);assert.ok(f.y>-576,'the inner wall stops him: '+f.y);f.x=0;f.y=-400;G.sgMove(X,f,0,-800);assert.ok(f.y>-576&&G.sgShield(X),'while a guardian stone stands a shield bars the door to outsiders: '+f.y);X.sg.holder=5;G.sgMove(X,f,0,-800);assert.ok(f.y<-790,'but not to the castle\'s own');X.sg.holder=0;f.y=-400;for(const q of G.SG.stat)X.sg.gate[q]=0;G.sgMove(X,f,0,-800);assert.ok(f.y<-790,'the door in its middle lets him through');}
  fe.pool=25000;fe.hp=.0001;B.t+=30;fa.at.s3=0;fe.x=fa.x+20;fe.y=fa.y;const k=G.sgAct(B,a,'s3',rnd);assert.ok(k.dead&&!fe.alive&&fe.resp>B.t);
  for(let i=0;i<60;i++)G.sgStep(B,.2,rnd);assert.ok(fe.alive&&fe.hp===1&&fe.y>1700,'the fallen return at their far camp');
  fe.pots=0;fe.x=G.SG.shops[0][0];fe.y=G.SG.shops[0][1];for(let i=0;i<100;i++)G.sgStep(B,.2,rnd);assert.ok(fe.pots>=30&&fe.bought===fe.pots,'a great many potions can be carried: '+fe.pots);
  fe.hp=.1;B.t+=10;fe.wound=0;assert.ok(G.sgAct(B,e,'pot',rnd));B.t+=G.SG.potCd+.1;assert.ok(G.sgAct(B,e,'pot',rnd),'and drunk every few seconds');
  B.sg.time=B.t+1;for(let i=0;i<10;i++)G.sgStep(B,.2,rnd);assert.ok(B.over);
  const A=G.newAccount();G.apply(A,'create',{name:'Sggg',cls:'blade'},{});A.gold=1200;const c0=A.coins;G.sgReward(A,true,2);assert.equal(A.coins,c0+30);assert.equal(A.gold,200);G.sgReward(A,false,5);assert.equal(A.gold,0,'never below nothing');assert.equal(A.coins,c0+40);
  G.setEnv(Math.random,Date.now);
});

test('reset maps give no extra experience, only more ancient set pieces; full excellent pieces have a bonus of their own',()=>{
  const zr=G.ZONES.findIndex(z=>z.req===10),zm=G.BASEZ-1;assert.ok(G.ZONES[zr].xp<G.ZONES[zm].xp*2.2,'no experience bonus beyond what they always had');assert.ok(G.RESET_RAR[4]>=2&&Math.abs(G.RESET_RAR.reduce((a,b)=>a+b,0)-100)<1e-9);
  let seed=5;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};G.setEnv(rnd,()=>1.8e12);
  const count=zi=>{const A=G.newAccount();G.apply(A,'create',{name:'DDDD',cls:'blade'},{});const s=A.chars[0];A.autoSell=0;A.autoEq=false;let n=0;for(let i=0;i<300;i++){A.inv.length=0;const rep={};G.rollLoot(s,zi,600,G.calc(s),rep);n+=A.inv.filter(it=>it.r===4&&G.DROPS.includes(it.s)).length;}return n;};
  const a=count(zr),b=count(zm);assert.ok(a>b*2,'ancient pieces: '+a+' in a reset map against '+b+' on the main road');
  const A=G.newAccount();G.apply(A,'create',{name:'Exxx',cls:'blade'},{});const s=A.chars[0],c0=G.calc(s);assert.equal(G.exCount(s),0);
  for(const k of G.DROPS){const it=G.makeItem(s,k,1,2,0);it.af=[];s.eq[k]=it;}const plain=G.calc(s);
  for(const k of ['w','h']){const it=s.eq[k];it.ex=1;it.af=G.POOL[k].map(x=>[x,0]);}assert.equal(G.exCount(s),2);assert.ok(Math.abs(G.calc(s).crit-plain.crit-.03)<1e-6,'two full excellent pieces: crit');
  for(const k of G.DROPS){const it=s.eq[k];it.ex=1;it.af=G.POOL[k].map(x=>[x,0]);}assert.equal(G.exCount(s),6);assert.ok(G.calc(s).dmg>plain.dmg*1.14);
  G.setEnv(Math.random,Date.now);
});

test('the bank holds items outside the bag, and a full bag does not eat a box',()=>{
  G.setEnv(()=>.5,()=>1.8e12);const A=G.newAccount();G.apply(A,'create',{name:'Bank',cls:'blade'},{});const s=A.chars[0];A.inv.length=0;
  const it=G.makeItem(s,'h',3,2,6);A.inv.push(it);assert.ok(G.apply(A,'bankPut',{id:it.id},{}).ok);assert.equal(A.inv.length,0);assert.equal(A.bank.length,1);assert.equal(G.apply(A,'bankPut',{id:it.id},{}).ok,false);
  assert.equal(G.apply(A,'equip',{id:it.id},{}).ok,false,'what is in the bank cannot be worn from there');assert.equal(G.apply(A,'sell',{id:it.id},{}).ok,false);
  for(let i=0;i<G.BAG;i++)A.inv.push(G.makeItem(s,'h',1,0,0));assert.match(G.apply(A,'bankTake',{id:it.id},{}).msg,/התיק מלא/);
  A.boxes=2;const b=G.apply(A,'openBox',{k:''},{});assert.match(b.msg,/התיק מלא/);assert.equal(A.boxes,2,'the box is kept');
  A.inv.pop();assert.ok(G.apply(A,'bankTake',{id:it.id},{}).ok);assert.equal(A.bank.length,0);assert.ok(A.inv.includes(it));
  A.inv.length=0;for(let i=0;i<G.BANK;i++){const x=G.makeItem(s,'h',1,0,0);A.inv.push(x);assert.ok(G.apply(A,'bankPut',{id:x.id},{}).ok);}const y=G.makeItem(s,'h',1,0,0);A.inv.push(y);assert.match(G.apply(A,'bankPut',{id:y.id},{}).msg,/הבנק מלא/);
  const back=G.adopt(JSON.parse(JSON.stringify(A)));assert.equal(back.bank.length,G.BANK,'the bank is saved with the account');
  G.setEnv(Math.random,Date.now);
});
test('the ancient city: only the guild that holds the castle may enter; ancient pieces a little more often, nothing extreme',()=>{
  G.setEnv(Math.random,()=>1.8e12);const zi=G.ZONES.findIndex(z=>z.castle);assert.ok(zi>=0&&!G.ZONES[zi].req);
  const A=G.newAccount();G.apply(A,'create',{cls:'blade',name:'xxxx'},{});const S=A.chars[A.cur];S.lvl=380;
  assert.equal(G.apply(A,'travel',{z:zi,f:0},{}).ok,false,'not without the castle');assert.equal(G.apply(A,'travel',{z:zi,f:0},{castle:true}).ok,true);assert.equal(S.zone,zi);
  assert.equal(G.apply(A,'tick',{z:zi,f:0,kills:1,dt:5},{}).ok,false,'and out when the castle is lost');
  assert.equal(G.tierOf(zi),G.CITY_TIER);assert.ok(G.CITY_RAR[4]>G.RESET_RAR[4]&&G.CITY_RAR[4]<G.RESET_RAR[4]*1.5,'a little more, not much more');assert.ok(G.CITY_PERFECT>1&&G.CITY_PERFECT<=1.3);
});
test('ancient points: only from the city, capped by the week, spent only in the city shop while the castle is held',()=>{
  G.setEnv(Math.random,()=>1.8e12);const zi=G.ZONES.findIndex(z=>z.castle);
  const A=G.newAccount();G.apply(A,'create',{cls:'blade',name:'xxxx'},{});const S=A.chars[A.cur];S.lvl=380;S.stats.str=40000;S.stats.vit=40000;
  G.apply(A,'tick',{z:0,f:0,kills:40,dt:30},{});assert.equal(A.anc|0,0,'nothing outside the city');
  assert.equal(G.apply(A,'travel',{z:zi,f:0},{castle:true}).ok,true);
  let now=1.8e12;for(let i=0;i<4000&&(A.anc|0)<G.CITY_WEEK;i++){now+=60e3;G.setEnv(Math.random,()=>now);A.inv.length=0;G.apply(A,'tick',{z:zi,f:0,kills:100,dt:60},{castle:true});assert.ok((A.week.anc|0)<=G.CITY_WEEK,'never more than the weekly cap');}
  assert.ok(A.kills>30000,'it took many kills: '+A.kills);assert.ok(A.anc>=G.CITY_WEEK);A.anc=G.CITY_WEEK;A.week.anc=G.CITY_WEEK;now=1.8e12+3e5;
  {const wk=A.week.key;for(let i=0;i<300;i++){now+=60e3;G.setEnv(Math.random,()=>now);A.inv.length=0;G.apply(A,'tick',{z:zi,f:0,kills:100,dt:60},{castle:true});if(A.week.key!==wk)break;assert.equal(A.anc,G.CITY_WEEK,'no more this week');}}
  assert.equal(G.apply(A,'buy',{shop:'city',k:'cpet2'},{}).ok,false,'the shop is shut without the castle');
  A.inv.length=0;const r=G.apply(A,'buy',{shop:'city',k:'cpet2'},{castle:true});assert.ok(r.ok&&A.anc===G.CITY_WEEK-15&&A.inv.some(x=>x.s==='y'&&x.r===2));
  assert.equal(G.apply(A,'buy',{shop:'city',k:'cwep'},{castle:true}).ok,false,'one win does not buy the weapon');
  A.anc=300;const w=G.apply(A,'buy',{shop:'city',k:'cwep'},{castle:true});assert.ok(w.ok&&A.anc===0&&w.item.s==='w'&&w.item.r===4&&w.item.ex&&w.item.t===G.CITY_TIER&&!w.item.pf);
  assert.ok(G.CITY_SHOP.every(o=>o.cost>=8)&&Math.max(...G.CITY_SHOP.map(o=>o.cost))>=G.CITY_WEEK*12);
});

test('the keep: who comes back stronger before the gate shuts enters the keep of his new level',()=>{
  let now=Date.UTC(2026,10,27,9,56,30);G.setEnv(Math.random,()=>now);const w=G.keepGate(now);assert.ok(w,'the gate is open five minutes before the hour');
  const A=G.newAccount();G.apply(A,'create',{cls:'blade',name:'xxxx'},{});const S=A.chars[A.cur];A.keys=1;S.lvl=G.TIER_MIN[2];
  const a=G.apply(A,'evEnter',{id:w.e.id},{});assert.ok(a.ok,a.msg);assert.equal(a.tier,3);G.apply(A,'evLeave',{},{});
  S.lvl=G.TIER_MIN[3];now+=60e3;const b=G.apply(A,'evEnter',{id:w.e.id},{});assert.ok(b.ok,b.msg);assert.equal(b.tier,4,'the higher keep');assert.equal(A.keys,0,'and no second key');
  now=Date.UTC(2026,10,27,10,3,0);S.evIn=null; // dropped by the server, not by choice
  const c=G.apply(A,'evEnter',{id:w.e.id},{});assert.ok(c.ok,'he walks back in while it runs: '+c.msg);
  G.apply(A,'evLeave',{},{});assert.equal(G.apply(A,'evEnter',{id:w.e.id},{}).ok,false,'but not after leaving by choice');
  const B2=G.newAccount();G.apply(B2,'create',{cls:'blade',name:'yyyy'},{});B2.keys=1;B2.chars[0].lvl=300;assert.equal(G.apply(B2,'evEnter',{id:w.e.id},{}).ok,false,'and nobody new gets in after the start');
});
test('moves that move: the leap carries the attacker onto a far enemy, the shove throws him off, a shield stands',()=>{
  const rnd=()=>.5,P=(id,c)=>({id,n:id,c:c||'blade',d:400,a:1.5,h:2700,f:70,cr:0,cd:2});
  const X=G.sgNew(rnd,{}),a=G.sgAdd(X,P('a'),1,'',rnd),e=G.sgAdd(X,P('e'),2,'',rnd),fa=X.f[a],fe=X.f[e];X.t=30;
  fa.x=0;fa.y=1900;fe.x=180;fe.y=1900;fe.pool=1e9;assert.equal(G.sgAct(X,a,'atk',rnd),null,'too far for a blow');
  const o=G.sgAct(X,a,'s3',rnd);assert.ok(o&&o.to===e&&o.jx&&o.dm>0,'the leap reaches');assert.ok(Math.abs(fa.x-fe.x)<40,'and lands beside him: '+fa.x);
  fa.at.bash=0;const x0=fe.x,b=G.sgAct(X,a,'bash',rnd);assert.ok(b.px&&fe.x-x0>=G.SG.bashPush-1,'the shove throws far');assert.ok(b.dm<o.dm/3,'and harms little');
  X.t+=.1;fa.at.s0=0;fa.x=fe.x-20;assert.ok(!G.sgAct(X,a,'s0',rnd).px,'an ordinary push still waits');X.t+=10;fa.at.bash=0;fa.x=fe.x-20;fe.sh=X.t+5;const y0=fe.x,g=G.sgAct(X,a,'bash',rnd);assert.ok(g.guard&&fe.x===y0,'a shield stops the shove');
  assert.ok(g.dm>0,'but not all the harm: he must still refill his health');
  { // the last circle: the same leap, and the quick skill throws back
    const B=G.brNew([{id:'p',n:'p',c:'blade'},{id:'q',n:'q',c:'storm'}],rnd);B.t=5;const p=B.f[0],q=B.f[1];p.x=0;p.y=0;q.x=170;q.y=0;p.at.s3=0;p.at.s0=0;
    const l=G.brAct(B,0,'s3',rnd);assert.ok(l&&l.jx&&Math.abs(p.x-q.x)<40);B.t+=1;G.brAct(B,0,'atk',rnd);B.t+=.45;const s=G.brAct(B,0,'s0',rnd);assert.ok(!s.px&&s.cb===2);B.t+=.45;const qx=q.x,c3=G.brAct(B,0,'s1',rnd);assert.ok(c3.combo&&c3.px&&q.x>qx+20&&c3.stun&&q.wound>B.t,'the circle fights as the siege does: the combo bursts, stuns and throws back');
    q.pots=5;q.stun=0;assert.equal(G.brAct(B,1,'pot',rnd).no,'wound');q.wound=0;const h0=q.hp;assert.ok(G.brAct(B,1,'pot',rnd).heal===G.SG.heal&&q.hp>h0);B.t+=G.SG.potCd+.01;assert.ok(G.brAct(B,1,'pot',rnd),'a potion by the press');}
  { // one skill of each class strikes several, and the enemy he chose comes first
    const B=G.brNew([{id:'p',n:'p',c:'blade'},{id:'q',n:'q',c:'storm'},{id:'r',n:'r',c:'hunter'},{id:'z',n:'z',c:'hunter'}],rnd);B.t=5;const f=B.f;f[0].x=0;f[0].y=0;f[1].x=40;f[1].y=0;f[2].x=-60;f[2].y=0;f[3].x=600;f[3].y=0;
    const near=G.brAct(B,0,'atk',rnd);assert.equal(near.to,1);B.t+=1;const ch=G.brAct(B,0,'atk',rnd,2);assert.equal(ch.to,2,'the chosen enemy is struck, not the nearest');B.t+=1;assert.equal(G.brAct(B,0,'atk',rnd,3).to,1,'one out of reach cannot be chosen');
    B.t+=1;const sw=G.brAct(B,0,'s0',rnd);assert.ok(sw.more&&sw.more.length===1&&sw.more[0][0]===2&&sw.more[0][1]<sw.dm,'the blade sweeps the others around him, for less: '+JSON.stringify(sw.more));B.t+=1;assert.ok(!G.brAct(B,0,'s1',rnd).more,'his other skill strikes one');}
});
test('the game master walks anywhere; nobody else does',()=>{
  G.setEnv(Math.random,()=>1.8e12);const zi=G.ZONES.findIndex(z=>z.castle),far=G.ZONES.length-2;
  const A=G.newAccount();G.apply(A,'create',{cls:'blade',name:'xxxx'},{});
  assert.equal(G.apply(A,'travel',{z:zi,f:0,gm:1},{}).ok,false,'the word of the browser is nothing');assert.equal(G.apply(A,'travel',{z:far,f:0},{}).ok,false);
  assert.equal(G.apply(A,'travel',{z:zi,f:0},{gm:true,castle:true}).ok,true);assert.equal(G.apply(A,'travel',{z:far,f:2},{gm:true}).ok,true);
  assert.equal(G.apply(A,'travel',{z:far,f:0},{}).ok,false,'and the right does not stay behind');
});

test('cheats: a win no numbers allow is refused, clean kills pay a few times a day, a character the map kills at once does not kill at full pace',()=>{
  let now=1.8e12;G.setEnv(Math.random,()=>now);const A=G.newAccount();G.apply(A,'create',{cls:'blade',name:'xxxx'},{});const S=A.chars[A.cur];
  // climbing the tower by claiming wins: it ends where the guardian could have killed the character many times over
  let last=0,refused=0;for(let i=0;i<400&&!refused;i++){const s=G.apply(A,'towerStart',{},{});if(!s.ok){A.daily.tw=0;continue;}const L=s.pd.live,minT=1/(L.b[0]*G.DUEL_LIVE.maxRate);now+=Math.ceil(minT*1000)+1000;const e=G.apply(A,'towerEnd',{win:true},{});if(e.denied)refused=s.pd.tower;else last=e.f;}
  assert.ok(refused>0,'a script that always claims a win is stopped');assert.ok(last>=1&&last<60,'a new character climbs a little, not without end: '+last);
  assert.equal(G.livePlausible({b:[.05,.05]},20),true,'a fair fight');assert.equal(G.livePlausible({b:[.05,.05]},1),false,'too fast');assert.equal(G.livePlausible({b:[.004,.9]},500),false,'not survivable');
  // the kill allowance
  const weak=G.maxKps(S,0,[]),far=G.ZONES.length-2;assert.ok(weak>0);const hard=G.maxKps(S,far,[]);S.stats.str=1e6;const glass=G.maxKps(S,far,[]);S.stats.vit=1e6;const tank=G.maxKps(S,far,[]);
  assert.ok(glass<tank*.5,'all damage and no life: the map kills him, and he kills less: '+glass+' vs '+tank);assert.ok(hard<=glass);
  assert.ok(G.CLEAN_DAY<=10);
});
test('the practice siege: the server\'s own players walk the road, break the gate, press the switches and their leader takes the crown',()=>{
  let s=7;const rnd=()=>{s=(s*16807)%2147483647;return s/2147483647;},P=(id,c)=>({id,n:id,c,d:5000,a:1.6,h:30000,f:800,cr:.2,cd:2,bot:true});
  const B=G.sgNew(rnd,{});B.sg.time=600;['lead','sw0','sw1','fight'].forEach((role,k)=>{const i=G.sgAdd(B,P('a'+k,['blade','storm','hunter'][k%3]),1,'A',rnd,k===0);Object.assign(B.f[i],{role,sk:.7,side:k%2?1:-1,pots:20});});
  B.t=0;let broke=0,sw=0,taken=0;for(let n=0;n<1500&&!taken;n++)for(const o of G.sgStep(B,.2,rnd)){if(o.broke&&!broke)broke=B.t;if(o.k==='sw')sw=B.t;if(o.k==='taken')taken=B.t;}
  assert.ok(broke>10&&broke<120,'the gate falls, and not at once: '+broke);assert.ok(sw>broke,'then a switch');assert.ok(taken>sw+G.SG.crownT-1&&B.sg.holder===1,'then the crown, after its half minute: '+taken);
  // against defenders it is a fight, and a fallen leader keeps half of his time on the crown
  const X=G.sgNew(rnd,{}),a=G.sgAdd(X,P('l','blade'),1,'A',rnd,true);X.t=5;X.sg.crown=[1,20,a];G.sgDown(X,a,-1);assert.equal(X.f[a].cacc,0,'a leader who falls loses all his time on the crown, as in the old sieges');
  assert.ok(G.SG.resp<=5&&G.SG.respIn>G.SG.resp&&G.SG.crownT===30,'attackers are back in a moment; the castle\'s own wait longer; the crown asks half a minute');
  {const Y=G.sgNew(rnd,{}),dq=G.sgAdd(Y,P('dd','blade'),4,'D',rnd),aq=G.sgAdd(Y,P('aa','blade'),6,'A',rnd),f=Y.f[dq],a=Y.f[aq];f.bot=false;a.bot=false;Y.sg.holder=4;Y.t=5;
    assert.deepEqual(G.sgCamp(Y),G.SG.camp);Y.sg.gate[3]=0;assert.deepEqual(G.sgCamp(Y),G.SG.fwd[0],'the camp moves up behind a broken wall');Y.sg.gate[5]=0;Y.sg.gate[0]=0;assert.deepEqual(G.sgCamp(Y),G.SG.fwd[2]);
    G.sgDown(Y,aq,-1);G.sgDown(Y,dq,-1);for(let n=0;n<30&&!a.alive;n++)G.sgStep(Y,.2,rnd);assert.ok(a.alive&&!f.alive&&Math.abs(a.y-G.SG.fwd[2][1])<60&&a.inv>Y.t,'the attacker returns first, at the forward camp, safe for a breath');
    for(let n=0;n<200&&!f.alive;n++)G.sgStep(Y,.2,rnd);assert.ok(f.alive&&f.y<G.SG.hall[3]&&f.y>G.SG.hall[1],'the defender returns inside his walls: '+f.y);
    // the life stone: the castle's own break it, and the attackers are thrown back to the far camp until it grows again
    a.x=900;a.y=1900;f.inv=0;f.x=G.SG.fwd[2][0]+20;f.y=G.SG.fwd[2][1];Y.t+=5;let hits=0,o=null;do{Y.t+=G.SG.skT+.02;o=G.sgAct(Y,dq,'s0',rnd);hits++;}while(o&&o.ls&&!o.broke&&hits<400);assert.ok(o&&o.broke&&hits>20,'it takes a while: '+hits);assert.deepEqual(G.sgCamp(Y),G.SG.camp);
    assert.equal(G.sgAct(Y,aq,'s0',rnd),null,'an attacker cannot strike it');Y.t+=G.SG.lsBack+1;assert.deepEqual(G.sgCamp(Y),G.SG.fwd[2],'and it grows back');}
});
test('many on one: a crowd\'s blows weaken, a stun is not chained without end, and potions keep pace',()=>{
  const rnd=()=>.5,P=(id)=>({id,n:id,c:'blade',d:400,a:1.5,h:2700,f:70,cr:0,cd:2});
  const X=G.sgNew(rnd,{}),a=G.sgAdd(X,P('a'),1,'',rnd),b=G.sgAdd(X,P('b'),1,'',rnd),c=G.sgAdd(X,P('c'),1,'',rnd),e=G.sgAdd(X,P('e'),2,'',rnd),fe=X.f[e];X.t=30;
  X.f.forEach(f=>{f.x=0;f.y=1900;});fe.x=20;fe.pool=1e9;
  const h1=G.sgAct(X,a,'atk',rnd),h2=G.sgAct(X,b,'atk',rnd),h3=G.sgAct(X,c,'atk',rnd);assert.ok(!h1.gang&&h2.gang===2&&h3.gang===3);
  assert.ok(Math.abs(h2.dm/h1.dm-G.SG.gang[0])<.02&&Math.abs(h3.dm/h1.dm-G.SG.gang[1])<.02,'the second and third hit for less: '+h2.dm/h1.dm+' '+h3.dm/h1.dm);
  X.t+=G.SG.gangT+.5;X.f[b].at.atk=0;const h4=G.sgAct(X,b,'atk',rnd);assert.ok(!h4.gang,'alone again, a full blow');
  X.t+=20;const combo=q=>{G.sgAct(X,q,'atk',rnd);X.t+=.6;G.sgAct(X,q,'s0',rnd);fe.x=20;X.t+=.6;const o=G.sgAct(X,q,'s1',rnd);fe.x=20;return o;};
  const lone=G.sgAct(X,c,'s1',rnd);assert.ok(!lone.stun,'a skill alone does not stun: only the combo does');X.t+=5;
  const s1=combo(a);assert.ok(s1.combo&&s1.stun);fe.stun=0;const s2=combo(b);assert.ok(s2.combo&&!s2.stun,'a second stun right after the first does not land');
  X.t+=1;const t0=X.t;assert.ok(G.sgAct(X,a,'s0',rnd)&&!G.sgAct(X,a,'s1',rnd),'the fighting skills share one short beat');X.t=t0+G.SG.skT+.05;assert.ok(G.sgAct(X,a,'s1',rnd),'and wait for nothing more');
  assert.ok(G.SG.heal/G.SG.potCd>=.1,'a potion gives back a tenth of life a second');
});

test('the credits shop sells what is found nowhere else: a pet that stays, a new name, bank room',()=>{
  let t=1.8e12;G.setEnv(()=>.5,()=>t);const A=G.newAccount();G.apply(A,'create',{name:'Shopper',cls:'blade'},{});const s=A.chars[0];
  assert.equal(G.apply(A,'buy',{shop:'prem',k:'ppet'}).ok,false,'not without credits');A.prem=2000;
  const b=G.apply(A,'buy',{shop:'prem',k:'ppet'});assert.ok(b.ok&&b.item.perm&&b.item.r===2);assert.equal(G.itemName(b.item,'blade'),G.PET_PERM);
  assert.equal(G.apply(A,'sell',{id:b.item.id}).ok,false,'never sold by a slip of the finger');
  assert.ok(G.apply(A,'equip',{id:b.item.id}).ok);t+=400*864e5;G.apply(A,'tick',{z:-1,kills:0},{});assert.ok(s.eq.y&&s.eq.y.perm&&!s.eq.y.until,'a year later it is still there');
  assert.equal(G.apply(A,'buy',{shop:'prem',k:'rename',name:'ab'}).ok,false);assert.equal(G.apply(A,'buy',{shop:'prem',k:'rename',name:'GMaster'}).ok,false);
  const p0=A.prem;assert.ok(G.apply(A,'buy',{shop:'prem',k:'rename',name:'Newname'}).ok);assert.equal(s.name,'Newname');assert.ok(A.prem<p0);
  for(let i=0;i<3;i++)assert.ok(G.apply(A,'buy',{shop:'prem',k:'bankx'}).ok);assert.equal(G.bankCap(A),G.BANK+120);assert.equal(G.apply(A,'buy',{shop:'prem',k:'bankx'}).ok,false,'three and no more');
});

test('a duel between players is the same fight: one beat, potions by the press, the combo in its order',()=>{
  const rnd=()=>.5,P=id=>({id,n:id,c:'blade',d:400,a:1.5,h:2700,f:70,cr:0,cd:2});G.setEnv(rnd,()=>1.8e12);
  const D=G.liveNew(P('a'),P('b'),true);assert.ok(D.pvp);D.t=5;D.f[1].x=D.f[0].x+30;D.f[1].z=D.f[0].z;
  const a1=G.liveAct(D,0,'atk',rnd);assert.ok(a1&&a1.cb===1);assert.equal(G.liveAct(D,0,'s0',rnd),null,'one beat between blows');
  D.t+=G.SG.skT+.02;const a2=G.liveAct(D,0,'s0',rnd);assert.equal(a2.cb,2);D.t+=G.SG.skT+.02;const a3=G.liveAct(D,0,'s1',rnd);assert.ok(a3.combo&&a3.stun&&a3.dm>a2.dm*3,'the combo bursts: '+a3.dm+' '+a2.dm);
  D.f[1].stun=0;assert.equal(G.liveAct(D,1,'pot',rnd),null,'no potion for a moment after it');D.t+=G.SG.wound+.01;const h=D.f[1].hp;assert.ok(G.liveAct(D,1,'pot',rnd)&&D.f[1].hp>h);D.t+=G.SG.potCd+.01;assert.ok(G.liveAct(D,1,'pot',rnd),'and again at once');
  D.t+=1;const lone=G.liveAct(D,0,'s1',rnd);assert.ok(lone&&!lone.stun,'the skill alone does not stun');
  const O=G.liveNew(P('a'),P('b'));assert.ok(!O.pvp&&O.f[0].pots===G.DUEL_LIVE.pots,'fights against the game itself are as they were');
});

test('wing looks from the credits shop: a look only, bought once, worn or taken off freely, seen by others',()=>{
  let t=1.8e12;G.setEnv(()=>.5,()=>t);const A=G.newAccount();G.apply(A,'create',{name:'Looker',cls:'blade'},{});const s=A.chars[0];A.prem=500;
  const before=G.calc(s).power;assert.ok(G.apply(A,'buy',{shop:'prem',k:'wsk1'}).ok);assert.equal(A.prem,100);assert.equal(A.wskOn,1);assert.equal(G.calc(s).power,before,'no strength in it');
  const off=G.apply(A,'buy',{shop:'prem',k:'wsk1'});assert.ok(off.ok&&off.free);assert.equal(A.wskOn,0);assert.equal(A.prem,100,'taking it off costs nothing');assert.ok(G.apply(A,'buy',{shop:'prem',k:'wsk1'}).ok);assert.equal(A.wskOn,1);assert.equal(A.prem,100);
  assert.equal(G.apply(A,'buy',{shop:'prem',k:'wsk2'}).ok,false,'the other one is not his');
  assert.equal(G.fighter(s).g,null,'without wings there is nothing to show');s.eq.g={id:99,s:'g',t:3,r:1,p:0,z:1,af:[]};const f=G.fighter(s);assert.equal(f.g[5],1);assert.equal(G.cleanPlayer('x',f).g[5],1,'and it reaches the others');
  assert.equal(G.cleanPlayer('x',Object.assign({},f,{g:[3,1,0,0,0,77]})).g[5],G.WSKIN.length-1,'a made-up look is cut down to a real one');
});

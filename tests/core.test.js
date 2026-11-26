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
  A.open=7;assert.equal(G.apply(A,'travel',{z:7}).ok,false,'level gate still holds');
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
test('AFK-only time to first reset stays in the designed range and sets work',()=>{
  const now=clock(1.8e12);G.setEnv(Math.random,now);const A=G.newAccount();G.apply(A,'create',{name:'x',cls:'blade'});A.open=7;const s=A.chars[0];let t=0;
  while(s.lvl<G.CAP&&t<40*3600){let z=0;for(let i=0;i<8;i++)if(G.ZONES[i].min<=s.lvl)z=i;s.zone=z;s.last=now();G.offline(s,300);now.add(300);t+=300;}
  console.log('AFK-only minutes to first reset:',t/60);assert.ok(t/60>200&&t/60<480,'minutes: '+t/60);
  for(const k of G.DROPS)s.eq[k]=G.makeItem(s,k,8,4,7);
  assert.equal(G.setCounts(s)[7],6);const full=G.calc(s).dmg;s.eq.b=null;assert.ok(G.calc(s).dmg<full);
});
test('reset maps open by reset count and level, never by editing the opened-map counter',()=>{
  const {A,now}=fresh();const s=A.chars[0];now.add(5);A.open=7;s.lvl=250;s.stats.str=900;
  assert.equal(G.apply(A,'travel',{z:9}).ok,false,'no resets yet');
  s.resets=2;assert.equal(G.apply(A,'travel',{z:9}).ok,true);
  assert.equal(G.apply(A,'travel',{z:10}).ok,false,'needs 4 resets and level 300');
  now.add(10);const r=G.apply(A,'tick',{z:9,kills:5});assert.ok(r.ok&&r.kills>0);
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
  assert.deepEqual([0,1,2].map(f=>G.floorMin(0,f)),[1,11,20]);assert.ok(G.zs(0,2).xp>G.zs(0,0).xp&&G.zs(0,2).hp>G.zs(0,0).hp);
  assert.equal(G.apply(A,'travel',{z:0,f:2}).ok,false);assert.equal(G.apply(A,'tick',{z:0,f:2,kills:3}).ok,false);
  s.lvl=25;s.stats.str=200;assert.ok(G.apply(A,'travel',{z:0,f:2}).ok);assert.equal(s.floor,2);
  assert.equal(G.apply(A,'travel',{z:0,f:9}).ok,true,'clamped to the top floor');assert.equal(s.floor,2);
  const xp=f=>{const t=fresh();const c=t.A.chars[0];c.lvl=25;c.stats.str=200;c.autoPts=false;G.apply(t.A,'travel',{z:0,f:f});t.now.add(10);G.setEnv(()=>.5,t.now);G.apply(t.A,'tick',{z:0,f:f,kills:1});return c.xp;};
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

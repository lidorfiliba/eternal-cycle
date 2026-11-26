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
  assert.ok(t/60>100&&t/60<230,'minutes: '+t/60);
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
test('party bonus comes only from the server context and is capped at three members',()=>{
  const xpFor=(ctx,args)=>{const {A,now}=fresh();G.apply(A,'travel',{z:0});now.add(10);const s=A.chars[0];s.autoPts=false;const before=s.xp;
    G.setEnv(()=>.5,now);const r=G.apply(A,'tick',Object.assign({z:0,kills:1},args||{}),ctx||{});let xp=s.xp;for(let l=1;l<s.lvl;l++)xp+=G.need(l);return xp-before;};
  const solo=xpFor({}),two=xpFor({partyN:1}),max=xpFor({partyN:3}),over=xpFor({partyN:50}),forged=xpFor({}, {partyN:3});
  assert.ok(Math.abs(two/solo-1.08)<.02,'one member adds 8%: '+two/solo);assert.ok(Math.abs(max/solo-1.24)<.02);
  assert.equal(over,max,'capped');assert.equal(forged,solo,'a client-supplied bonus is ignored');
});

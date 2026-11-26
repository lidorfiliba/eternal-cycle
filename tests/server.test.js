// Runs the real request handler and the real SQL against an in-process Postgres.
// Only the thin Supabase client is replaced by a small stand-in that speaks the same calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import * as G from '../supabase/functions/act/core.js';
import { makeHandler, makeAuth } from '../supabase/functions/act/handler.js';

const JSONB=new Set(['state','snap','item','detail']);
const enc=(k,v)=>JSONB.has(k)&&v!==null&&typeof v==='object'?JSON.stringify(v):v;
function fakeAdmin(db){
  async function run(st){
    try{
      const p=[];const w=st.where.map(([k,v])=>{p.push(v);return `${k} = $${p.length}`;});
      if(st.or){const parts=st.or.split(',').map(x=>{const [c,op,...rest]=x.split('.');const v=rest.join('.');if(op==='is')return `${c} is null`;p.push(v);return `${c} = $${p.length}`;});w.push('('+parts.join(' or ')+')');}
      const where=w.length?' where '+w.join(' and '):'';
      if(st.op==='select'){const r=await db.query(`select ${st.cols} from ${st.table}${where}${st.order?` order by ${st.order[0]} ${st.order[1]}`:''}${st.limit?` limit ${st.limit}`:''}`,p);return {data:r.rows,error:null};}
      const keys=Object.keys(st.vals);
      if(st.op==='update'){const vp=keys.map(k=>enc(k,st.vals[k]));const set=keys.map((k,i)=>`${k} = $${p.length+i+1}`);const r=await db.query(`update ${st.table} set ${set.join(', ')}${where} returning *`,[...p,...vp]);return {data:st.ret?r.rows:null,error:null};}
      const ph=keys.map((k,i)=>`$${i+1}`),vals=keys.map(k=>enc(k,st.vals[k]));
      const conflict=st.op==='upsert'?` on conflict (user_id) do update set ${keys.filter(k=>k!=='user_id').map(k=>`${k} = excluded.${k}`).join(', ')}`:'';
      await db.query(`insert into ${st.table} (${keys.join(', ')}) values (${ph.join(', ')})${conflict}`,vals);return {data:null,error:null};
    }catch(e){return {data:null,error:{message:e.message}};}
  }
  const from=table=>{const st={table,op:'select',cols:'*',where:[],vals:null,order:null,limit:null,or:null,ret:false};
    const b={select(c){if(st.op==='select')st.cols=c||'*';else st.ret=true;return b;},eq(k,v){st.where.push([k,v]);return b;},or(x){st.or=x;return b;},
      order(c,o){st.order=[c,o&&o.ascending===false?'desc':'asc'];return b;},limit(n){st.limit=n;return b;},
      insert(v){st.op='insert';st.vals=v;return b;},update(v){st.op='update';st.vals=v;return b;},upsert(v){st.op='upsert';st.vals=v;return b;},
      maybeSingle(){return run(st).then(r=>({data:r.data&&r.data[0]||null,error:r.error}));},then(a,c){return run(st).then(a,c);}};
    return b;};
  const rpc=async(fn,args)=>{try{const k=Object.keys(args);const r=await db.query(`select ${fn}(${k.map((x,i)=>`${x} => $${i+1}`).join(', ')}) as v`,k.map(x=>args[x]));return {data:r.rows[0].v,error:null};}catch(e){return {data:null,error:{message:e.message}};}};
  return {from,rpc};
}
const U=n=>'00000000-0000-0000-0000-00000000000'+n;
async function world(){
  const db=new PGlite();
  await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; create schema auth; create table auth.users(id uuid primary key);`);
  for(const f of fs.readdirSync('supabase/migrations').sort())await db.exec(fs.readFileSync('supabase/migrations/'+f,'utf8'));
  for(let i=1;i<=5;i++)await db.query('insert into auth.users values ($1)',[U(i)]);
  let t=1.8e12;const clock=()=>t;clock.add=s=>{t+=s*1000;};
  const handle=makeHandler(fakeAdmin(db),G,Math.random,clock);
  const row=async u=>(await db.query('select state,version,calls from accounts where user_id=$1',[u])).rows[0];
  const poke=async(u,fn)=>{const r=await row(u);fn(r.state);await db.query('update accounts set state=$2 where user_id=$1',[u,JSON.stringify(r.state)]);};
  const auth=makeAuth(fakeAdmin(db),'test-secret',clock);
  return {db,handle,clock,row,poke,auth};
}

test('account lifecycle: unknown user, create, and the stored state is the source of truth',async()=>{
  const {handle,row}=await world();
  assert.equal((await handle(U(1),'sync',{})).result.msg,'new');
  assert.equal((await handle(U(1),'tick',{z:0,kills:50})).result.msg,'new');
  const c=await handle(U(1),'create',{name:'ראשון',cls:'hunter'});assert.ok(c.result.ok);assert.equal(c.state.chars[0].cls,'hunter');
  assert.equal((await handle(U(1),'create',{name:'שני',cls:'blade'})).result.ok,false,'second slot is locked');
  assert.equal((await row(U(1))).state.chars.length,1);
});
test('forged ticks are clamped, logged, and parallel requests cannot double-count',async()=>{
  const {db,handle,clock,row}=await world();await handle(U(1),'create',{name:'a',cls:'blade'});
  await handle(U(1),'travel',{z:0});clock.add(10);
  const r=await handle(U(1),'tick',{z:0,kills:900});assert.ok(r.result.ok);assert.ok(r.result.kills<=21);
  assert.equal((await db.query("select count(*)::int c from audit where kind='clamp'")).rows[0].c,1);
  clock.add(10);const before=(await row(U(1))).state.kills;
  const rs=await Promise.all([1,2,3,4].map(()=>handle(U(1),'tick',{z:0,kills:900})));
  const after=(await row(U(1))).state.kills;assert.ok(after-before<=21,'four parallel claims for one 10s window gave '+(after-before));
  assert.ok(rs.every(x=>x.result),'every request got an answer');
  assert.equal((await handle(U(1),'travel',{z:6})).result.ok,false);
  assert.equal((await handle(U(1),'reset',{})).result.ok,false);
});
test('a refused action leaves the stored account untouched',async()=>{
  const {handle,row}=await world();await handle(U(1),'create',{name:'a',cls:'blade'});
  const v=(await row(U(1))).version;
  for(const [k,a] of [['buy',{shop:'gold',k:'box'}],['reset',{}],['equip',{id:999}],['nope',{}],['duel',{i:0}]])assert.equal((await handle(U(1),k,a)).result.ok,false);
  assert.equal((await row(U(1))).version,v);
});
test('market through the server: listing, hidden direct offers, buying, cancelling',async()=>{
  const {handle,poke,row}=await world();
  for(const n of [1,2,3])await handle(U(n),'create',{name:'שחקן'+n,cls:'blade'});
  await poke(U(1),s=>{s.inv.push({id:s.nid++,s:'w',t:2,r:4,p:3,z:1,af:[['dmg',5]]},{id:s.nid++,s:'h',t:2,r:2,p:0,z:1,af:[]});});
  await poke(U(2),s=>{s.gold=5000;});await poke(U(3),s=>{s.gold=5000;});
  const inv=(await row(U(1))).state.inv;
  let r=await handle(U(1),'mlist',{id:inv[0].id,price:1000});assert.ok(r.result.ok);assert.equal(r.state.inv.length,1);assert.equal(r.market.length,1);assert.ok(r.market[0].mine);
  assert.equal(JSON.stringify(r.market).includes(U(1)),false,'no user ids leak to the browser');
  assert.equal((await handle(U(1),'mlist',{id:inv[1].id,price:50,to:0})).result.ok,false,'direct sale needs a party');
  const p=await handle(U(1),'pcreate',{});await handle(U(2),'pjoin',{code:p.party.code});
  const idx=(await handle(U(1),'pget',{})).party.members.findIndex(m=>!m.me);
  r=await handle(U(1),'mlist',{id:inv[1].id,price:50,to:idx});assert.ok(r.result.ok,r.result.msg);
  assert.equal((await handle(U(3),'mget',{})).market.length,1,'a stranger sees only the public listing');
  const m2=(await handle(U(2),'mget',{})).market;assert.equal(m2.length,2);const direct=m2.find(x=>x.direct),pub=m2.find(x=>!x.direct);
  assert.equal((await handle(U(3),'mbuy',{id:direct.id})).result.ok,false);
  r=await handle(U(2),'mbuy',{id:direct.id});assert.ok(r.result.ok);assert.equal(r.state.gold,4950);assert.equal(r.state.inv.length,1);
  const both=await Promise.all([handle(U(2),'mbuy',{id:pub.id}),handle(U(3),'mbuy',{id:pub.id})]);
  assert.equal(both.filter(x=>x.result.ok).length,1,'exactly one buyer wins a race');
  assert.equal((await row(U(1))).state.gold,Math.floor(50*.95)+950);
  assert.ok(G.adopt((await row(U(2))).state));
});
test('party through the server: bonus only for active members in the same map',async()=>{
  const {handle,clock}=await world();
  for(const n of [1,2])await handle(U(n),'create',{name:'p'+n,cls:'storm'});
  const p=await handle(U(1),'pcreate',{});assert.match(p.party.code,/^[0-9A-F]{6}$/);
  assert.equal((await handle(U(2),'pjoin',{code:'000000'})).result.ok,false);
  const j=await handle(U(2),'pjoin',{code:p.party.code});assert.ok(j.result.ok);assert.equal(j.party.members.length,2);
  assert.equal(JSON.stringify(j.party).includes('0000-0000'),false,'member ids are stripped');
  await handle(U(1),'travel',{z:0});await handle(U(2),'travel',{z:0});clock.add(8);
  // "active" is judged by the database clock, which the stand-in cannot move; both members were just seen.
  assert.equal((await handle(U(1),'tick',{z:0,kills:3,partyN:3})).result.partyN,1,'one other member here; the client-sent value is ignored');
  await handle(U(2),'travel',{z:-1});clock.add(8);
  assert.equal((await handle(U(1),'tick',{z:0,kills:3})).result.partyN,0);
  assert.equal((await handle(U(1),'pleave',{})).party.code,'');
});
test('accounts: register, sign in, signed sessions, brute-force brake, signup throttle',async()=>{
  const {db,auth,clock,handle}=await world();
  assert.equal((await auth.register('ab','longenough1','1.1.1.1')).ok,false,'short name');
  assert.equal((await auth.register('lidor','short','1.1.1.1')).ok,false,'short password');
  assert.equal((await auth.register('bad name!','longenough1','1.1.1.1')).ok,false);
  const r=await auth.register('  Lidor_28 ','correct horse 1','1.1.1.1');assert.ok(r.ok,r.msg);assert.equal(r.user,'lidor_28');
  const uid=await auth.verify(r.token);assert.match(uid,/^[0-9a-f-]{36}$/);
  assert.equal((await auth.register('LIDOR_28','another pass 1','1.1.1.1')).ok,false,'names are unique regardless of case');
  const he=await auth.register('לידור','סיסמה ארוכה 1','1.1.1.1');assert.ok(he.ok,'Hebrew names work');
  const stored=(await db.query('select pass_hash,salt from users where username=$1',['lidor_28'])).rows[0];
  assert.ok(!stored.pass_hash.includes('correct')&&stored.pass_hash.length>=40,'only a hash is stored');
  assert.ok((await handle(uid,'create',{name:'גיבור',cls:'blade'})).result.ok,'the id from the token owns the game account');
  const l=await auth.login('Lidor_28','correct horse 1','2.2.2.2');assert.ok(l.ok);assert.equal(await auth.verify(l.token),uid,'same account from another device');
  assert.equal(await auth.verify(l.token+'x'),null);assert.equal(await auth.verify('abc.def'),null);assert.equal(await auth.verify(''),null);
  const other=makeAuth({from(){},rpc(){}},'another-secret',clock);assert.equal(await other.verify(l.token),null,'a token signed with a different secret is rejected');
  const forged=Buffer.from('00000000-0000-0000-0000-000000000001.'+(clock()+1e9)).toString('base64url')+'.'+l.token.split('.')[1];assert.equal(await auth.verify(forged),null,'payload cannot be swapped');
  clock.add(91*24*3600);assert.equal(await auth.verify(l.token),null,'expired');
  const m1=(await auth.login('lidor_28','wrong','3.3.3.3')).msg,m2=(await auth.login('nobody_here','wrong','3.3.3.3')).msg;assert.equal(m1,m2,'no hint whether the user exists');
  for(let i=0;i<10;i++)await auth.login('lidor_28','wrong'+i,'3.3.3.3');
  assert.equal((await auth.login('lidor_28','correct horse 1','9.9.9.9')).ok,false,'locked after repeated failures, even with the right password');
  const made=[];for(let i=0;i<6;i++)made.push((await auth.register('farm_'+i,'longenough1','7.7.7.7')).ok);
  assert.deepEqual(made,[true,true,true,true,true,false],'five sign-ups per address per hour');
});
test('timed events: bonus XP, objectives, rewards once, quiz once',async()=>{
  const {handle,clock,row}=await world();await handle(U(1),'create',{name:'a',cls:'blade'});
  clock.add((Date.UTC(2026,10,26,8,29,0)-clock())/1000);                 // 10:29 local, nothing live
  await handle(U(1),'travel',{z:0});clock.add(20);const base=await handle(U(1),'tick',{z:0,kills:5});
  assert.equal((await handle(U(1),'claimEvent',{id:'square'})).result.ok,false);
  clock.add(60);                                                          // 10:30:20 — כיכר התוהו: double XP
  let total=0;for(let i=0;i<12&&total<150;i++){clock.add(19);total+=(await handle(U(1),'tick',{z:0,kills:40})).result.kills;}
  const key=Object.keys((await row(U(1))).state.ev).find(k=>k.startsWith('square:'));assert.ok(key);
  assert.ok((await row(U(1))).state.ev[key].k>=150,'progress '+total);
  const lvl=(await row(U(1))).state.chars[0].lvl,c=await handle(U(1),'claimEvent',{id:'square'});assert.ok(c.result.ok,c.result.msg);
  assert.ok(c.state.chars[0].lvl>=lvl+6);assert.equal((await handle(U(1),'claimEvent',{id:'square'})).result.ok,false,'reward only once');
  assert.equal((await handle(U(1),'answer',{a:0})).result.ok,false,'quiz not live');
  clock.add((Date.UTC(2026,10,26,10,16,0)-clock())/1000);                // 12:16 local — quiz + שעת השפע
  const a1=await handle(U(1),'answer',{a:99});assert.ok(a1.result.ok);assert.equal(a1.result.correct,false);
  assert.equal((await handle(U(1),'answer',{a:1})).result.ok,false,'one attempt only');
  assert.equal((await handle(U(1),'claimEvent',{id:'quiz'})).result.ok,false);
  assert.equal((await handle(U(1),'claimEvent',{id:'bounty'})).result.ok,false,'bonus hours have no reward to claim');
});
test('rate limit per account',async()=>{
  const {handle}=await world();await handle(U(1),'create',{name:'a',cls:'blade'});let refused=0;
  for(let i=0;i<260;i++){const r=await handle(U(1),'autoEq',{});if(!r.result.ok)refused++;}
  assert.ok(refused>=15&&refused<=25,'refused '+refused);
});

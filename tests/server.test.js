// Runs the real request handler and the real SQL against an in-process Postgres.
// Only the thin Supabase client is replaced by a small stand-in that speaks the same calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import * as G from '../supabase/functions/_shared/core.js';
import { makeHandler } from '../supabase/functions/act/handler.js';

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
  await db.exec(fs.readFileSync('supabase/migrations/'+fs.readdirSync('supabase/migrations').sort()[0],'utf8'));
  for(let i=1;i<=5;i++)await db.query('insert into auth.users values ($1)',[U(i)]);
  let t=1.8e12;const clock=()=>t;clock.add=s=>{t+=s*1000;};
  const handle=makeHandler(fakeAdmin(db),G,Math.random,clock);
  const row=async u=>(await db.query('select state,version,calls from accounts where user_id=$1',[u])).rows[0];
  const poke=async(u,fn)=>{const r=await row(u);fn(r.state);await db.query('update accounts set state=$2 where user_id=$1',[u,JSON.stringify(r.state)]);};
  return {db,handle,clock,row,poke};
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
test('rate limit per account',async()=>{
  const {handle}=await world();await handle(U(1),'create',{name:'a',cls:'blade'});let refused=0;
  for(let i=0;i<260;i++){const r=await handle(U(1),'autoEq',{});if(!r.result.ok)refused++;}
  assert.ok(refused>=15&&refused<=25,'refused '+refused);
});

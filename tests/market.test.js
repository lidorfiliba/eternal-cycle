// Runs the real migration in an in-process Postgres and attacks the market.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import * as G from '../web/core.js';

const U1='00000000-0000-0000-0000-000000000001',U2='00000000-0000-0000-0000-000000000002',U3='00000000-0000-0000-0000-000000000003';
async function setup(){
  const db=new PGlite();
  await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    grant usage on schema public to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to service_role;`);
  await db.exec(fs.readFileSync(fs.readdirSync('supabase/migrations').map(f=>'supabase/migrations/'+f).sort()[0],'utf8'));
  await db.exec(`grant all on all tables in schema public to service_role; grant usage on all sequences in schema public to service_role;`);
  for(const [u,name,gold] of [[U1,'מוכר',0],[U2,'קונה',5000],[U3,'שלישי',5000]]){
    G.setEnv(Math.random,Date.now);const A=G.newAccount();G.apply(A,'create',{name,cls:'blade'});A.gold=gold;
    if(u===U1)A.inv.push(G.makeItem(A.chars[0],'w',3,4,2));
    await db.query('insert into auth.users values ($1)',[u]);
    await db.query('insert into accounts(user_id,state) values ($1,$2)',[u,JSON.stringify(A)]);
  }
  return db;
}
const state=async(db,u)=>(await db.query('select state,version from accounts where user_id=$1',[u])).rows[0];

test('listing moves the item out of the bag; buying moves gold and item exactly once',async()=>{
  const db=await setup();const itemId=(await state(db,U1)).state.inv[0].id;
  await db.query('select market_list($1,$2,$3)',[U1,itemId,1000]);
  assert.equal((await state(db,U1)).state.inv.length,0);
  const lid=(await db.query('select id,item from listings')).rows[0];assert.equal(lid.item.id,undefined,'stored without the seller-local id');
  await assert.rejects(db.query('select market_buy($1,$2)',[U1,lid.id]),/own/);
  await db.query('select market_buy($1,$2)',[U2,lid.id]);
  await assert.rejects(db.query('select market_buy($1,$2)',[U3,lid.id]),/sold/,'second buyer gets nothing');
  const s1=await state(db,U1),s2=await state(db,U2),s3=await state(db,U3);
  assert.equal(s1.state.gold,950);assert.equal(s2.state.gold,4000);assert.equal(s3.state.gold,5000);
  assert.equal(s2.state.inv.length,1);assert.equal(s2.state.inv[0].r,4);assert.equal(s3.state.inv.length,0);
  assert.ok(G.adopt(s2.state),'buyer state still loads');assert.ok(s2.version>1,'version bumped so a stale server write is rejected');
  assert.equal((await db.query('select count(*)::int c from listings')).rows[0].c,0);
  assert.equal((await db.query("select count(*)::int c from audit where kind='market_buy'")).rows[0].c,1);
});
test('cannot list what you do not own, buy without gold, or exceed the price range',async()=>{
  const db=await setup();const itemId=(await state(db,U1)).state.inv[0].id;
  await assert.rejects(db.query('select market_list($1,$2,$3)',[U2,itemId,10]),/not_found/);
  await assert.rejects(db.query('select market_list($1,$2,$3)',[U1,itemId,0]),/bad_price/);
  await assert.rejects(db.query('select market_list($1,$2,$3)',[U1,itemId,2000000000]),/bad_price/);
  await db.query('select market_list($1,$2,$3)',[U1,itemId,999999]);
  const lid=(await db.query('select id from listings')).rows[0].id;
  await assert.rejects(db.query('select market_buy($1,$2)',[U2,lid]),/no_gold/);
  await assert.rejects(db.query('select market_cancel($1,$2)',[U2,lid]),/sold/,'only the seller can cancel');
  await db.query('select market_cancel($1,$2)',[U1,lid]);
  assert.equal((await state(db,U1)).state.inv.length,1,'item returned to the seller');
});
test('a browser session cannot read or write tables, or call market functions directly',async()=>{
  const db=await setup();
  for(const role of ['anon','authenticated']){
    await db.exec(`set role ${role}`);
    await assert.rejects(db.query('select * from accounts'),/permission denied/);
    await assert.rejects(db.query(`update accounts set state=jsonb_set(state,'{gold}','999999999')`),/permission denied/);
    await assert.rejects(db.query('select * from listings'),/permission denied/);
    await assert.rejects(db.query('insert into audit(kind) values ($1)',['x']),/permission denied/);
    await assert.rejects(db.query('select market_buy($1,$2)',[U2,1]),/permission denied/);
    await assert.rejects(db.query('select market_list($1,$2,$3)',[U1,1,1]),/permission denied/);
    await db.exec('reset role');
  }
  await db.exec('set role service_role');
  assert.equal((await db.query('select count(*)::int c from accounts')).rows[0].c,3,'the server role still works');
});
test('parties: codes, size limit, same-map bonus, leaving',async()=>{
  const db=await setup();const U4='00000000-0000-0000-0000-000000000004',U5='00000000-0000-0000-0000-000000000005';
  for(const u of [U4,U5]){G.setEnv(Math.random,Date.now);const A=G.newAccount();G.apply(A,'create',{name:'x',cls:'storm'});
    await db.query('insert into auth.users values ($1)',[u]);await db.query('insert into accounts(user_id,state) values ($1,$2)',[u,JSON.stringify(A)]);}
  const code=(await db.query('select party_create($1) c',[U1])).rows[0].c;assert.match(code,/^[0-9A-F]{6}$/);
  await assert.rejects(db.query('select party_create($1)',[U1]),/in_party/);
  await assert.rejects(db.query('select party_join($1,$2)',[U2,'ZZZZZZ']),/no_party/);
  for(const u of [U2,U3,U4])await db.query('select party_join($1,$2)',[u,code.toLowerCase()+' ']);
  await assert.rejects(db.query('select party_join($1,$2)',[U5,code]),/full/);
  for(const [u,z] of [[U1,2],[U2,2],[U3,2],[U4,5]])await db.query('insert into arena(user_id,snap,zone) values ($1,$2,$3)',[u,'{}',z]);
  const bonus=async(u,z)=>(await db.query('select party_bonus($1,$2) b',[u,z])).rows[0].b;
  assert.equal(await bonus(U1,2),2);assert.equal(await bonus(U4,5),0);assert.equal(await bonus(U5,2),0,'not a member');assert.equal(await bonus(U1,-1),0,'no bonus in the village');
  await db.query("update arena set seen_at=now()-interval '10 minutes' where user_id=$1",[U2]);
  assert.equal(await bonus(U1,2),1,'inactive members do not count');
  const info=(await db.query('select party_info($1) i',[U3])).rows[0].i;assert.equal(info.members.length,4);assert.equal(info.leader,U1);
  await db.query('select party_leave($1)',[U1]);
  assert.equal((await db.query('select party_info($1) i',[U2])).rows[0].i.leader,U2,'leadership passes on');
  assert.equal((await db.query('select party_info($1) i',[U1])).rows[0]?.i??null,null);
  for(const u of [U2,U3,U4])await db.query('select party_leave($1)',[u]);
  assert.equal((await db.query('select count(*)::int c from parties')).rows[0].c,0,'an empty party is removed');
});
test('a direct sale can only target a party member and only that member can buy it',async()=>{
  const db=await setup();const itemId=(await state(db,U1)).state.inv[0].id;
  await assert.rejects(db.query('select market_list($1,$2,$3,$4)',[U1,itemId,10,U2]),/not_party/);
  const code=(await db.query('select party_create($1) c',[U1])).rows[0].c;await db.query('select party_join($1,$2)',[U2,code]);
  await assert.rejects(db.query('select market_list($1,$2,$3,$4)',[U1,itemId,10,U1]),/not_party/);
  await db.query('select market_list($1,$2,$3,$4)',[U1,itemId,10,U2]);
  const lid=(await db.query('select id from listings')).rows[0].id;
  await assert.rejects(db.query('select market_buy($1,$2)',[U3,lid]),/sold/,'a stranger cannot take a direct offer');
  await db.query('select market_buy($1,$2)',[U2,lid]);
  assert.equal((await state(db,U2)).state.inv.length,1);assert.equal((await state(db,U2)).state.gold,4990);
  await db.exec('set role authenticated');
  for(const q of ["select party_create('"+U3+"')","select party_info('"+U1+"')","select party_bonus('"+U1+"',2)","select * from party_members"])await assert.rejects(db.query(q),/permission denied/);
});

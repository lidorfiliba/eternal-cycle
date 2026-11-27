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
  const rpc=async(fn,args)=>{try{const k=Object.keys(args);const r=await db.query(`select ${fn}(${k.map((x,i)=>`${x} => $${i+1}`).join(', ')}) as v`,k.map(x=>args[x]!==null&&typeof args[x]==='object'?JSON.stringify(args[x]):args[x]));return {data:r.rows[0].v,error:null};}catch(e){if(process.env.DBG)console.log('RPC',fn,e.message);return {data:null,error:{message:e.message}};}};
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
  // The database stamps suspensions with its own clock; move them onto the test clock.
  const rebase=()=>db.query("update accounts set banned_until=banned_until+($1::timestamptz-now()) where banned_until is not null and banned_until<$1::timestamptz+interval '1 minute'",[new Date(clock()).toISOString()]);
  return {db,handle,clock,row,poke,auth,rebase};
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
  assert.equal((await db.query("select count(*)::int c from audit where kind in ('clamp','blatant')")).rows[0].c,1);
  clock.add(10);const before=(await row(U(1))).state.kills;
  const rs=await Promise.all([1,2,3,4].map(()=>handle(U(1),'tick',{z:0,kills:900})));
  const after=(await row(U(1))).state.kills;assert.ok(after-before<=21,'four parallel claims for one 10s window gave '+(after-before));
  assert.ok(rs.every(x=>x.result),'every request got an answer');
  assert.equal((await handle(U(1),'travel',{z:18})).result.ok,false);
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
  assert.equal((await auth.register('ab','longenough1','1.1.1.1',1,'Herzl')).ok,false,'short name');
  assert.equal((await auth.register('lidor','short','1.1.1.1',1,'Herzl')).ok,false,'short password');
  assert.equal((await auth.register('bad name!','longenough1','1.1.1.1',1,'Herzl')).ok,false);
  const r=await auth.register('  Lidor_28 ','correct horse 1','1.1.1.1',1,'Herzl');assert.ok(r.ok,r.msg);assert.equal(r.user,'lidor_28');
  const uid=await auth.verify(r.token);assert.match(uid,/^[0-9a-f-]{36}$/);
  assert.equal((await auth.register('LIDOR_28','another pass 1','1.1.1.1',1,'Herzl')).ok,false,'names are unique regardless of case');
  const he=await auth.register('לידור','סיסמה ארוכה 1','1.1.1.1',1,'Herzl');assert.ok(he.ok,'Hebrew names work');
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
  const made=[];for(let i=0;i<6;i++)made.push((await auth.register('farm_'+i,'longenough1','7.7.7.7',1,'Herzl')).ok);
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
  assert.equal(c.state.chars[0].lvl,lvl,'a prize is never levels');assert.match(c.result.rt,/תיבות אוצר/);assert.equal((await handle(U(1),'claimEvent',{id:'square'})).result.ok,false,'reward only once');
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

test('players on the same floor see each other, and only there',async()=>{
  const {handle}=await world();
  for(const [i,n] of [[1,'אחד'],[2,'שתיים'],[3,'שלוש']]){await handle(U(i),'create',{name:n,cls:'blade'});}
  await handle(U(1),'travel',{z:0});await handle(U(2),'travel',{z:0});
  const b1=(await handle(U(1),'beat',{x:400,f:-1,a:true,s:0})).beat;assert.deepEqual(b1.peers,[],'nobody else has checked in yet');
  const b2=(await handle(U(2),'beat',{x:900,f:1,s:0})).beat;
  assert.equal(b2.peers.length,1);assert.equal(b2.peers[0].s.n,'אחד');assert.equal(b2.peers[0].x,400);assert.equal(b2.peers[0].f,-1);assert.equal(b2.peers[0].a,true);
  assert.ok(!JSON.stringify(b2).includes(U(1)),'account ids never leave the server');
  const b3=(await handle(U(3),'beat',{x:1,s:0})).beat;assert.equal(b3.peers.length,0,'the town is a different place');assert.equal(b3.online,3);
  assert.ok((await handle(U(1),'beat',{x:1,s:0})).beat.skip,'a heartbeat right after another is ignored');
});
test('chat: world and guild channels, pacing, mute',async()=>{
  const {db,handle,poke}=await world();
  for(const i of [1,2,3]){await handle(U(i),'create',{name:'שחקן'+i,cls:'blade'});await poke(U(i),s=>{s.gold=50000;});}
  assert.ok((await handle(U(1),'say',{m:'  שלום\nלכולם  '})).result.ok);
  assert.equal((await handle(U(1),'say',{m:'שוב'})).result.ok,false,'two messages in a row are too fast');
  assert.equal((await handle(U(2),'say',{m:'   '})).result.ok,false);
  const c=(await handle(U(2),'beat',{x:1,s:0})).beat.chat;assert.equal(c.length,1);assert.equal(c[0].m,'שלום לכולם');assert.equal(c[0].n,'שחקן1');assert.equal(c[0].me,false);
  assert.equal((await handle(U(2),'say',{m:'סודי',g:true})).result.ok,false,'no guild, no guild chat');
  assert.ok((await handle(U(2),'gcreate',{name:'אבירים',tag:'AB'})).result.ok);await handle(U(3),'gjoin',{name:'אבירים'});
  assert.ok((await handle(U(2),'say',{m:'סודי',g:true})).result.ok);
  await db.query("update arena set beat_at=null");
  const seen=async u=>(await handle(u,'beat',{x:1,s:0})).beat.chat.map(x=>x.m);
  assert.deepEqual(await seen(U(3)),['שלום לכולם','סודי']);assert.deepEqual(await seen(U(1)),['שלום לכולם'],'outsiders do not get guild chat');
  await db.query("update accounts set muted_until=now()+interval '1 hour' where user_id=$1",[U(3)]);
  assert.match((await handle(U(3),'say',{m:'היי'})).result.msg,/הושתקת/);
});
test('guilds: founding costs gold, members raise the level, leaving hands over the lead',async()=>{
  const {db,handle,poke,row,clock}=await world();
  for(const i of [1,2,3]){await handle(U(i),'create',{name:'ג'+i,cls:'blade'});}
  assert.equal((await handle(U(1),'gcreate',{name:'נשרים',tag:'NS'})).result.ok,false,'not enough gold');
  await poke(U(1),s=>{s.gold=25000;});await poke(U(2),s=>{s.gold=25000;});
  assert.equal((await handle(U(1),'gcreate',{name:'x',tag:'NS'})).result.ok,false,'bad name');assert.equal((await row(U(1))).state.gold,25000,'a refused founding costs nothing');
  const g=await handle(U(1),'gcreate',{name:'נשרים',tag:'NS'});assert.ok(g.result.ok,g.result.msg);assert.equal(g.state.gold,25000-G.GUILD_FEE);assert.equal(g.guild.mine.leader,true);
  assert.equal((await handle(U(2),'gcreate',{name:'נשרים',tag:'ZZ'})).result.ok,false,'name taken');assert.equal((await row(U(2))).state.gold,25000);
  assert.ok((await handle(U(2),'gjoin',{name:'נשרים'})).result.ok);assert.equal((await handle(U(2),'gjoin',{name:'נשרים'})).result.ok,false);
  assert.equal((await handle(U(2),'gkick',{i:0})).result.ok,false,'only the leader removes members');
  await db.query('update guilds set points=7990');
  await handle(U(2),'travel',{z:0});clock.add(20);const t=await handle(U(2),'tick',{z:0,kills:12});assert.ok(t.result.kills>=10);assert.equal(t.result.guildLvl,1,'level read before these kills');
  const info=(await handle(U(1),'gget',{})).guild;assert.equal(info.mine.lvl,2);assert.equal(info.mine.members.length,2);assert.equal(info.mine.members[1].k,t.result.kills);
  await handle(U(3),'gjoin',{name:'נשרים'});assert.ok((await handle(U(1),'gkick',{i:2})).result.ok);assert.equal((await handle(U(1),'gget',{})).guild.mine.members.length,2);
  await handle(U(1),'gleave',{});const after=(await handle(U(2),'gget',{})).guild;assert.equal(after.mine.leader,true,'the next member leads');
  await handle(U(2),'gleave',{});assert.equal((await db.query('select count(*)::int c from guilds')).rows[0].c,0,'an empty guild is closed');
});
test('siege: the guild with the most kills in the window takes the castle and its bonus',async()=>{
  const {db,handle,poke,clock}=await world();
  for(const i of [1,2]){await handle(U(i),'create',{name:'מ'+i,cls:'blade'});await poke(U(i),s=>{s.gold=30000;});await handle(U(i),'gcreate',{name:'גילדה'+i,tag:'G'+i});}
  await db.query("select guild_tick($1,40,true,'s1')",[U(1)]);await db.query("select guild_tick($1,90,true,'s1')",[U(2)]);await db.query("select guild_tick($1,500,false,'s1')",[U(1)]);
  assert.equal((await db.query("select count(*)::int c from castle where siege='s1'")).rows[0].c,1,'the previous siege is closed once');
  await db.query("select guild_tick($1,0,false,'s2')",[U(1)]);await db.query("select guild_tick($1,0,false,'s2')",[U(2)]);
  const c=(await db.query("select g.name,c.pts from castle c join guilds g on g.id=c.guild_id where siege='s2'")).rows[0];assert.equal(c.name,'גילדה2');assert.equal(Number(c.pts),90);
  assert.equal((await db.query('select sum(siege_pts)::int s from guilds')).rows[0].s,0);
  assert.equal((await db.query("select guild_tick($1,0,false,'s2') v",[U(2)])).rows[0].v.castle,true);
  const A=G.newAccount();G.apply(A,'create',{name:'a',cls:'blade'},{});G.apply(A,'travel',{z:0},{});
  const run=(ctx)=>{const B=G.adopt(JSON.parse(JSON.stringify(A)));G.setEnv(()=>.5,()=>B.last+20000);G.apply(B,'tick',{z:0,kills:10},ctx);const c=B.chars[0];let x=c.xp;for(let l=1;l<c.lvl;l++)x+=G.need(l);return {xp:x};};
  assert.ok(run({castle:true,guildLvl:10}).xp>run({}).xp*1.15,'castle and guild level add experience');
});
test('blatant forged claims suspend the account automatically',async()=>{
  const {db,handle,clock,rebase}=await world();await handle(U(1),'create',{name:'a',cls:'blade'});await handle(U(1),'travel',{z:0});
  let last=null;for(let i=0;i<5;i++){clock.add(5);last=await handle(U(1),'tick',{z:0,kills:900});}
  assert.equal(last.banned,true);await rebase();
  const r=await handle(U(1),'sync',{});assert.equal(r.banned,true);assert.match(r.result.msg,/מושעה/);
  assert.equal((await handle(U(1),'beat',{x:1,s:0})).beat.banned,true);
  assert.equal((await db.query('select strikes from accounts')).rows[0].strikes,1);
  clock.add(25*3600);assert.ok((await handle(U(1),'sync',{})).result.ok,'the first suspension lasts a day');
  clock.add(5);const honest=await handle(U(1),'tick',{z:0,kills:30});assert.ok(!honest.banned,'a small overshoot is only clamped');
});
test('recovery question, password change, account deletion, admin tools',async()=>{
  const {db,handle,auth,clock,rebase}=await world();
  assert.equal((await auth.register('dana','longenough1','1.1.1.1')).ok,false,'a recovery answer is required');
  const r=await auth.register('dana','longenough1','1.1.1.1',2,'  Tel  Aviv ');assert.ok(r.ok,r.msg);const s0=await auth.session(r.token);
  await handle(s0.uid,'create',{name:'דנה',cls:'storm'});
  assert.equal((await auth.forgot('DANA')).q,2);assert.equal((await auth.forgot('ghost')).q,(await auth.forgot('ghost')).q,'unknown names get a stable question');
  assert.equal((await auth.recover('dana','haifa','brand new pass','2.2.2.2')).ok,false);
  clock.add(60);const rec=await auth.recover('dana','tel aviv','brand new pass','2.2.2.2');assert.ok(rec.ok,rec.msg);
  assert.equal((await auth.login('dana','longenough1','2.2.2.2')).ok,false);assert.ok((await auth.login('dana','brand new pass','2.2.2.2')).ok);
  assert.equal((await handle(s0.uid,'sync',{},{iat:s0.iat})).expired,true,'sessions from before the change stop working');
  const s1=await auth.session(rec.token);assert.ok((await handle(s1.uid,'sync',{},{iat:s1.iat})).result.ok);
  for(let i=0;i<10;i++)await auth.recover('dana','guess'+i,'whatever pass','5.5.5.5');
  assert.match((await auth.recover('dana','tel aviv','whatever pass','5.5.5.5')).msg,/יותר מדי/,'guessing answers is braked like guessing passwords');
  assert.equal((await auth.chpass(s1.uid,'nope','another pass 2')).ok,false);assert.ok((await auth.chpass(s1.uid,'brand new pass','another pass 2')).ok);
  assert.equal((await auth.setSecret(s1.uid,'another pass 2',0,'rex')).ok,true);assert.equal((await auth.forgot('dana')).q,0);
  const boss=await auth.register('boss','longenough1','3.3.3.3',0,'x1');const bu=(await auth.session(boss.token)).uid;await handle(bu,'create',{name:'מנהל',cls:'blade'});
  assert.equal((await handle(bu,'aview',{})).result.ok,false,'not an admin yet');assert.equal((await auth.adminReset(bu,'dana')).ok,false);
  await db.query("update users set is_admin=true where username='boss'");
  const v=await handle(bu,'aview',{});assert.ok(v.result.ok);assert.equal(v.admin.users,2);
  assert.ok((await handle(bu,'aact',{action:'ban',target:'dana',hours:2})).result.ok);await rebase();assert.equal((await handle(s1.uid,'sync',{})).banned,true);
  assert.ok((await handle(bu,'aact',{action:'unban',target:'dana'})).result.ok);assert.ok((await handle(s1.uid,'sync',{})).result.ok);
  await db.query('delete from login_fails');const tmp=await auth.adminReset(bu,'dana');assert.ok(tmp.ok);assert.ok((await auth.login('dana',tmp.temp,'8.8.8.8')).ok);
  assert.equal((await auth.delacct(s1.uid,'wrong')).ok,false);assert.ok((await auth.delacct(s1.uid,tmp.temp)).ok);
  assert.equal((await db.query("select count(*)::int c from users where username='dana'")).rows[0].c,0);assert.equal((await handle(s1.uid,'sync',{})).result.msg,'new');
});

test('leaderboard: top players by resets then level, and by power, without account ids',async()=>{
  const {db,handle,poke}=await world();
  for(const [i,n] of [[1,'א'],[2,'ב'],[3,'ג']])await handle(U(i),'create',{name:n,cls:'blade'});
  await db.query("update arena set resets=5,power=100,snap=jsonb_set(snap,'{l}','120') where user_id=$1",[U(1)]);
  await db.query("update arena set resets=5,power=900,snap=jsonb_set(snap,'{l}','300') where user_id=$1",[U(2)]);
  await db.query("update arena set resets=1,power=5000 where user_id=$1",[U(3)]);
  const r=await handle(U(1),'top',{});assert.ok(r.result.ok);
  assert.deepEqual(r.top.resets.map(x=>x.n),['ב','א','ג'],'same resets: the higher level leads');assert.deepEqual(r.top.power.map(x=>x.n),['ג','ב','א']);
  assert.equal(r.top.resets[1].me,true);assert.equal(r.top.resets[0].me,false);assert.ok(!JSON.stringify(r).includes(U(2)));
});

test('party training: a member\'s kills hand experience to the others on the same map, once',async()=>{
  const {db,handle,clock,poke,row}=await world();
  for(const [i,n] of [[1,'ותיק'],[2,'חדש'],[3,'רחוק']])await handle(U(i),'create',{name:n,cls:'blade'});
  await poke(U(1),s=>{s.chars[0].lvl=120;s.chars[0].stats.str=6000;s.chars[0].stats.vit=3000;s.open=3;});
  await poke(U(2),s=>{s.chars[0].autoPts=false;});
  const code=(await db.query('select party_create($1) c',[U(1)])).rows[0].c;for(const i of [2,3])await db.query('select party_join($1,$2)',[U(i),code]);
  await handle(U(1),'travel',{z:0});await handle(U(2),'travel',{z:0});await handle(U(3),'travel',{z:-1});
  clock.add(20);const t=await handle(U(1),'tick',{z:0,kills:30});assert.ok(t.result.kills>=20,'kills '+t.result.kills);assert.equal(t.result.partyN,1);
  const waiting=Number((await db.query('select xp from party_share where user_id=$1',[U(2)])).rows[0].xp);assert.equal(waiting,Math.round(Math.round(t.result.base*G.PARTY_SHARE)*.15),'a level 120 training a level 1: the gap leaves 15%');
  await db.query("update arena set snap=jsonb_set(snap,'{l}','110') where user_id=$1",[U(2)]);await db.query('update party_share set xp=0');
  clock.add(20);const t2=await handle(U(1),'tick',{z:0,kills:30});const near=Number((await db.query('select xp from party_share where user_id=$1',[U(2)])).rows[0].xp);
  assert.equal(near,Math.round(t2.result.base*G.PARTY_SHARE),'close levels share in full');const waiting2=near;
  assert.equal((await db.query('select count(*)::int c from party_share where user_id=$1',[U(3)])).rows[0].c,0,'only members on the same map');
  const before=(await row(U(2))).state.chars[0].lvl;
  const got=await handle(U(2),'tick',{z:0,kills:0});assert.equal(got.result.shared,waiting2);assert.ok(got.state.chars[0].lvl>before,'the newcomer levelled without a kill');
  assert.equal((await handle(U(2),'tick',{z:0,kills:0})).result.shared,undefined,'nothing left to take');
  assert.equal(Number((await db.query('select coalesce(sum(xp),0) s from party_share where user_id=$1',[U(1)])).rows[0].s),0,'no kills, nothing shared back');
});

test('paid credits: a request, an admin confirming it once, and spending the credits',async()=>{
  const {db,handle,auth,row}=await world();
  const boss=await auth.register('boss','longenough1','3.3.3.3',0,'x1');const bu=(await auth.session(boss.token)).uid;await handle(bu,'create',{name:'מנהל',cls:'blade'});
  await handle(U(1),'create',{name:'קונה',cls:'blade'});
  assert.match((await handle(U(1),'onew',{pack:'p2',ref:'x'})).result.msg,/עוד לא נפתחו/,'closed until payment details are set');
  assert.equal((await handle(U(1),'aset',{key:'pay_info',value:'hack'})).result.ok,false,'players cannot open the shop');
  await db.query("update users set is_admin=true where username='boss'");
  assert.ok((await handle(bu,'aset',{key:'pay_info',value:'העברה למספר 000'})).result.ok);
  assert.equal((await handle(U(1),'onew',{pack:'nope'})).result.ok,false);
  const o=await handle(U(1),'onew',{pack:'p2',ref:'  דני\n4321 '});assert.ok(o.result.ok,o.result.msg);assert.equal(o.orders.orders[0].credits,550);assert.equal(o.orders.orders[0].price,50);assert.equal(o.orders.pay,'העברה למספר 000');
  assert.match((await handle(U(1),'onew',{pack:'p1'})).result.msg,/ממתינה/,'one open request at a time');
  assert.equal((await row(U(1))).state.prem,undefined,'asking gives nothing');
  const id=o.orders.orders[0].id;
  assert.equal((await handle(U(1),'aodecide',{id,ok:true})).result.ok,false,'a player cannot confirm their own payment');
  const view=await handle(bu,'aorders',{});assert.equal(view.shop.pending.length,1);assert.equal(view.shop.pending[0].ref,'דני 4321');
  const v0=(await row(U(1))).version;
  assert.ok((await handle(bu,'aodecide',{id,ok:true})).result.ok);assert.equal((await row(U(1))).state.prem,550);assert.ok((await row(U(1))).version>v0,'the account version moves so a request in flight cannot overwrite the credits');
  assert.equal((await handle(bu,'aodecide',{id,ok:true})).result.ok,false,'confirming twice adds nothing');assert.equal((await row(U(1))).state.prem,550);
  const b=await handle(U(1),'buy',{shop:'prem',k:'jewel'});assert.ok(b.result.ok,b.result.msg);assert.equal(b.state.prem,430);assert.equal(b.state.jewels,1);
  assert.equal((await handle(U(1),'buy',{shop:'prem',k:'vip7'})).result.ok,true);assert.equal((await handle(U(1),'buy',{shop:'prem',k:'vip7'})).result.ok,false,'not enough credits left');
  const o2=await handle(U(1),'onew',{pack:'p1',ref:''});const id2=o2.orders.orders[0].id;assert.ok((await handle(bu,'aodecide',{id:id2,ok:false})).result.ok);
  assert.equal((await row(U(1))).state.prem,130,'a rejected request adds nothing');
  const s=(await handle(bu,'aorders',{})).shop;assert.equal(Number(s.paid_total),50);assert.equal(s.pending.length,0);
});

test('daily backup: a snapshot of the accounts, and one account put back from it',async()=>{
  const {db,handle,auth,row}=await world();
  const boss=await auth.register('boss','longenough1','3.3.3.3',0,'x1');const bu=(await auth.session(boss.token)).uid;await handle(bu,'create',{name:'מנהל',cls:'blade'});
  const pl=await auth.register('dana','longenough1','4.4.4.4',0,'x1');const pu=(await auth.session(pl.token)).uid;await handle(pu,'create',{name:'דנה',cls:'storm'});
  await db.query("update accounts set state=jsonb_set(state,'{gold}','777') where user_id=$1",[pu]);
  assert.equal((await handle(pu,'abackup',{})).result.ok,false,'players cannot run or read backups');
  await db.query("update users set is_admin=true where username='boss'");
  const b=await handle(bu,'abackup',{});assert.ok(b.result.ok,b.result.msg);assert.equal(b.backups.length,1);assert.equal(b.backups[0].accounts,2);
  const day=(await db.query("select day::text d from backups")).rows[0].d;
  await db.query("update accounts set state=jsonb_set(state,'{gold}','1') where user_id=$1",[pu]);
  assert.equal((await handle(pu,'arestore',{day,user:'dana'})).result.ok,false);
  assert.ok((await handle(bu,'arestore',{day,user:'dana'})).result.ok);assert.equal((await row(pu)).state.gold,777,'the saved game is back');
  assert.equal((await handle(bu,'arestore',{day:'2020-01-01',user:'dana'})).result.ok,false,'no such day');
  await handle(bu,'abackup',{});assert.equal((await db.query('select count(*)::int c from backups')).rows[0].c,1,'one snapshot a day');
  const snap=(await db.query("select data from backups")).rows[0].data;assert.ok(snap.users.length===2&&snap.settings&&snap.orders);
});
test('world boss: everyone\'s kills take from one health pool, and each collects once by share',async()=>{
  const {db,handle,clock,poke}=await world();
  for(const [u,n] of [[U(1),'חזק'],[U(2),'חלש']]){await handle(u,'create',{name:n,cls:'blade'});await handle(u,'travel',{z:0});}
  await poke(U(1),s=>{s.chars[0].stats.str=6000;s.chars[0].stats.vit=3000;s.chars[0].autoPts=false;});
  assert.equal((await handle(U(1),'claimWorld',{})).result.ok,false,'nothing to collect before any opening');
  clock.add(165*60+30);for(const u of [U(1),U(2)])await handle(u,'tick',{z:0,kills:0}); // 12:45 Israel time: the boss is up
  let w1,w2;for(let i=0;i<6;i++){clock.add(15);w1=(await handle(U(1),'tick',{z:0,kills:30})).world;w2=(await handle(U(2),'tick',{z:0,kills:30})).world;}
  assert.ok(w1&&w2,'ticks report the fight');assert.equal(w2.n,2);assert.ok(w2.hp<w2.max);assert.ok(w1.mine>w2.mine*2,'the stronger player hits harder: '+w1.mine+' vs '+w2.mine);assert.equal(w2.top[0].n,'חזק');
  assert.equal((await handle(U(1),'claimWorld',{})).result.msg,'הקרב עוד לא נגמר');
  const g=await handle(U(2),'wget',{});assert.equal(g.world.hp,w2.hp);
  await db.query("update world_boss set hp=0, killed_at=now()");
  const c1=await handle(U(1),'claimWorld',{});assert.ok(c1.result.ok,c1.result.msg);assert.equal(c1.result.rank,1);assert.equal(c1.state.feathers,3);
  assert.equal((await handle(U(1),'claimWorld',{})).result.msg,'הפרס כבר נאסף');assert.equal((await handle(U(1),'wget',{})).world.claimed,true,'and the screen is told, so it stops offering it');assert.equal((await handle(U(2),'wget',{})).world.claimed,false);
  const c2=await handle(U(2),'claimWorld',{});assert.ok(c2.result.ok);assert.equal(c2.result.rank,2);assert.ok(c2.result.share<.5);
  assert.equal((await handle(U(3),'claimWorld',{})).result.ok,false);
});
test('the Node server speaks the same protocol as the edge function',async()=>{
  const {makeServer}=await import('../server/index.mjs');const {db}=await world();
  const srv=makeServer(fakeAdmin(db),'test-secret','https://example.test');await new Promise(r=>srv.listen(0,r));const base='http://127.0.0.1:'+srv.address().port;
  const post=async(body,tok)=>{const r=await fetch(base,{method:'POST',headers:Object.assign({'Content-Type':'application/json'},tok?{'x-ec-token':tok}:{}),body:JSON.stringify(body)});return {status:r.status,j:await r.json(),cors:r.headers.get('access-control-allow-origin')};};
  try{
    assert.equal((await (await fetch(base)).json()).ok,true,'health check');
    assert.equal((await post({kind:'tick',args:{}})).status,401);
    const reg=await post({kind:'register',args:{user:'nodeuser',pass:'correct-horse-9',q:0,a:'rex'}});assert.ok(reg.j.token,JSON.stringify(reg.j));assert.equal(reg.cors,'https://example.test');
    const c=await post({kind:'create',args:{name:'נוד',cls:'blade'}},reg.j.token);assert.ok(c.j.result.ok);assert.equal(c.j.state.chars[0].name,'נוד');
    const l=await post({kind:'login',args:{user:'nodeuser',pass:'correct-horse-9'}});assert.ok(l.j.token);assert.ok((await post({kind:'sync',args:{}},l.j.token)).j.state.chars.length===1);
    assert.equal((await fetch(base,{method:'POST',body:'x'.repeat(5000)})).status,413);
  }finally{srv.close();}
});
test('live duel over the socket: invite, server-decided hits, result written to both accounts',async()=>{
  const {makeServer}=await import('../server/index.mjs');const {WebSocket}=await import('ws');const {createHash}=await import('node:crypto');const {db}=await world();
  const srv=makeServer(fakeAdmin(db),'test-secret');await new Promise(r=>srv.listen(0,r));const port=srv.address().port,base='http://127.0.0.1:'+port;
  const post=async(body,tok)=>(await (await fetch(base,{method:'POST',headers:Object.assign({'Content-Type':'application/json'},tok?{'x-ec-token':tok}:{}),body:JSON.stringify(body)})).json());
  const mkUser=async(n,cls)=>{const r=await post({kind:'register',args:{user:n,pass:'correct-horse-9',q:0,a:'rex'}});await post({kind:'create',args:{name:n,cls:cls}},r.token);await post({kind:'travel',args:{z:0}},r.token);
    const uid=(await db.query('select user_id from users where username=$1',[n])).rows[0].user_id;return {tok:r.token,uid,key:createHash('md5').update(uid+'peer').digest('hex').slice(0,10)};};
  const open=async u=>{const ws=new WebSocket('ws://127.0.0.1:'+port+'/ws');u.q=[];u.wait=t=>new Promise((res,rej)=>{const go=()=>{const i=u.q.findIndex(m=>m.t===t);if(i>=0)return res(u.q.splice(i,1)[0]);setTimeout(go,10);};go();setTimeout(()=>rej(new Error('no '+t+' message')),4000);});
    ws.on('message',d=>u.q.push(JSON.parse(String(d))));await new Promise(r=>ws.on('open',r));ws.send(JSON.stringify({t:'hello',token:u.tok}));await u.wait('hi');u.ws=ws;u.send=m=>ws.send(JSON.stringify(m));};
  const a=await mkUser('alef','blade'),b=await mkUser('bet','blade');
  try{
    const bad=new WebSocket('ws://127.0.0.1:'+port+'/ws');await new Promise(r=>bad.on('open',r));bad.send(JSON.stringify({t:'hello',token:'forged'}));await new Promise(r=>bad.on('close',r));
    await open(a);a.send({t:'challenge',k:b.key});assert.equal((await a.wait('gone')).t,'gone','the other player is not connected');
    await open(b);const st0=async u=>(await db.query('select state from accounts where user_id=$1',[u.uid])).rows[0].state,t0=(await st0(a)).tickets,r0=(await st0(a)).rating;
    a.send({t:'challenge',k:b.key});const inv=await b.wait('invite');assert.equal(inv.from.n,'alef');b.send({t:'answer',id:inv.id,ok:true});
    const sa=await a.wait('start'),sb=await b.wait('start');assert.equal(sa.side,0);assert.equal(sb.side,1);assert.equal(sa.opp.n,'bet');assert.equal(sa.opp.id,undefined);assert.equal((await st0(a)).tickets,t0-1,'the challenger pays the ticket');
    const d=[...srv.live.duels.values()][0];d.t0-=3000; // past the countdown
    a.send({t:'act',k:'atk'});await new Promise(r=>setTimeout(r,150));assert.equal(a.q.filter(m=>m.t==='ev').length,0,'too far apart: the server ignores the swing');
    a.send({t:'pos',x:200,z:.5});b.send({t:'pos',x:240,z:.5});assert.equal((await b.wait('pos')).x,200);
    a.send({t:'act',k:'atk'});const ev=await b.wait('ev');assert.equal(ev.o.by,0);assert.ok(ev.o.dm>0);assert.ok(ev.f[1].hp<1);await a.wait('ev');
    const c=await mkUser('gimel','storm');await open(c);c.send({t:'duels'});const dl=await c.wait('duels');assert.deepEqual(dl.list.map(x=>[x.a,x.b]),[['alef','bet']]);
    c.send({t:'watch',id:dl.list[0].id});const wv=await c.wait('watching');assert.equal(wv.p[0].n,'alef');assert.ok(wv.f[1].hp<1);assert.equal(wv.xz[0][0],200);
    a.send({t:'pos',x:210,z:.5});assert.equal((await c.wait('pos')).s,0);c.send({t:'act',k:'atk'});await new Promise(r=>setTimeout(r,120));assert.equal(c.q.filter(m=>m.t==='ev').length,0,'a spectator cannot act in the fight');
    d.D.f[1].hp=.001;d.t0-=30000;a.send({t:'act',k:'s3'});
    const ea=await a.wait('end'),eb=await b.wait('end');await c.wait('ev');assert.equal((await c.wait('over')).win,0);c.ws.close();assert.equal(ea.win,true);assert.equal(eb.win,false);assert.ok(ea.gain>0);
    assert.ok((await st0(a)).rating>r0);assert.equal((await st0(b)).rating,1000-12);assert.equal(srv.live.duels.size,0);
    assert.ok((await db.query("select count(*)::int c from chat where name='★'")).rows[0].c>=1,'the server hears about it');
    a.send({t:'challenge',k:b.key});const inv2=await b.wait('invite');b.send({t:'answer',id:inv2.id,ok:true});await a.wait('start');await b.wait('start');b.ws.close();assert.equal((await a.wait('end')).win,true,'leaving forfeits');
  }finally{for(const u of [a,b])if(u.ws)u.ws.close();srv.live.close();srv.close();}
});
test('friends, blocking, reports and private messages',async()=>{
  const {makeServer}=await import('../server/index.mjs');const {WebSocket}=await import('ws');const {createHash}=await import('node:crypto');const {db}=await world();
  const srv=makeServer(fakeAdmin(db),'test-secret');await new Promise(r=>srv.listen(0,r));const port=srv.address().port,base='http://127.0.0.1:'+port;
  const post=async(body,tok)=>(await (await fetch(base,{method:'POST',headers:Object.assign({'Content-Type':'application/json'},tok?{'x-ec-token':tok}:{}),body:JSON.stringify(body)})).json());
  const mkUser=async n=>{const r=await post({kind:'register',args:{user:n,pass:'correct-horse-9',q:0,a:'rex'}});if(!r.token)console.log('REG',n,JSON.stringify(r).slice(0,200));await post({kind:'create',args:{name:n,cls:'blade'}},r.token);
    const uid=(await db.query('select user_id from users where username=$1',[n])).rows[0].user_id;return {tok:r.token,uid,key:createHash('md5').update(uid+'peer').digest('hex').slice(0,10)};};
  const open=async u=>{const ws=new WebSocket('ws://127.0.0.1:'+port+'/ws');u.q=[];u.wait=t=>new Promise((res,rej)=>{const go=()=>{const i=u.q.findIndex(m=>m.t===t);if(i>=0)return res(u.q.splice(i,1)[0]);setTimeout(go,10);};go();setTimeout(()=>rej(new Error('no '+t+' message')),4000);});
    ws.on('message',d=>u.q.push(JSON.parse(String(d))));await new Promise(r=>ws.on('open',r));ws.send(JSON.stringify({t:'hello',token:u.tok}));await u.wait('hi');u.ws=ws;u.send=m=>ws.send(JSON.stringify(m));};
  const a=await mkUser('dana'),b=await mkUser('omer');
  try{
    assert.equal((await post({kind:'friend',args:{k:'nope',n:'x',on:true}},a.tok)).result.ok,false);
    const f=await post({kind:'friend',args:{k:b.key,n:'omer',on:true}},a.tok);assert.deepEqual(f.state.friends,[{k:b.key,n:'omer'}]);
    const bl=await post({kind:'block',args:{k:b.key,n:'omer',on:true}},a.tok);assert.equal(bl.state.blocked.length,1);assert.equal(bl.state.friends.length,0,'blocking removes the friendship');
    assert.equal((await post({kind:'report',args:{k:b.key,n:'omer',why:'x'}},a.tok)).result.ok,false);
    assert.ok((await post({kind:'report',args:{k:b.key,n:'omer',why:'קללות בצאט'}},a.tok)).result.ok);assert.match((await post({kind:'report',args:{k:b.key,n:'omer',why:'שוב קללות'}},a.tok)).result.msg,/פעם בדקה/);
    const rep=(await db.query("select name,msg from chat where ch='r'")).rows;assert.equal(rep.length,1);assert.equal(rep[0].name,'dana');assert.match(rep[0].msg,/omer/);
    assert.equal((await post({kind:'beat',args:{x:1,f:1,a:false,s:0}},b.tok)).beat.chat.length,0,'reports never show in the chat of players');
    await open(a);a.send({t:'who',ks:[b.key]});assert.deepEqual((await a.wait('who')).on,[]);a.send({t:'whisper',k:b.key,m:'היי'});await a.wait('offline');
    await open(b);a.send({t:'who',ks:[b.key]});assert.deepEqual((await a.wait('who')).on,[b.key]);
    await new Promise(r=>setTimeout(r,950));a.send({t:'whisper',k:b.key,m:'מה <b>נשמע</b>'});const w=await b.wait('whisper');assert.equal(w.from.n,'dana');assert.equal(w.from.k,a.key);assert.equal(w.m,'מה bנשמע/b');await a.wait('whispered');
    await db.query("update accounts set muted_until=now()+interval '1 hour' where user_id=$1",[a.uid]);await new Promise(r=>setTimeout(r,950));a.send({t:'whisper',k:b.key,m:'עוד'});await a.wait('muted');
  
    { // game-master travel: the flag in the database decides, not the browser's word
      const G2=await import('../web/core.js'),zi=G2.ZONES.findIndex(z=>z.castle),u2=await mkUser('ziva');
      await db.query('update users set is_admin=true where user_id=$1',[u2.uid]);
      assert.equal((await post({kind:'travel',args:{z:zi,f:0,gm:1}},a.tok)).result.ok,false,'a player who claims to be game master gets nothing');
      const t=await post({kind:'travel',args:{z:zi,f:0,gm:1}},u2.tok);assert.equal(t.result.ok,true,t.result.msg);assert.equal(t.state.chars[0].zone,zi);
      assert.equal((await post({kind:'travel',args:{z:zi,f:0}},u2.tok)).result.ok,false,'and even he, only when he asks as game master');
      // the admin gives and takes: only he, first shown then done, within ceilings, never below zero, and written down
      const gold=async()=>Number((await db.query("select state->>'gold' g from accounts where user_id=$1",[a.uid])).rows[0].g);const g0=await gold();
      assert.equal((await post({kind:'agrant',args:{user:'dana',what:'gold',n:5000,go:true}},a.tok)).result.ok,false,'a player cannot give to himself');assert.equal(await gold(),g0);
      const dry=await post({kind:'agrant',args:{user:'dana',what:'gold',n:5000}},u2.tok);assert.ok(dry.result.ok&&!dry.grant.done&&dry.grant.after===g0+5000&&dry.grant.user==='dana');assert.equal(await gold(),g0,'looking changes nothing');
      const go=await post({kind:'agrant',args:{user:'dana',what:'gold',n:5000,go:true}},u2.tok);assert.ok(go.grant.done);assert.equal(await gold(),g0+5000);
      assert.equal((await post({kind:'agrant',args:{user:'dana',what:'gold',n:-1e6,go:true}},u2.tok)).result.ok,false,'not below zero');assert.equal((await post({kind:'agrant',args:{user:'dana',what:'gold',n:2e7,go:true}},u2.tok)).result.ok,false,'not above the ceiling');
      assert.equal((await post({kind:'agrant',args:{user:'dana',what:'state',n:1,go:true}},u2.tok)).result.ok,false,'only what is on the list');assert.equal((await post({kind:'agrant',args:{user:'dana',what:'constructor',n:1,go:true}},u2.tok)).result.ok,false);
      const bo=await post({kind:'agrant',args:{user:'dana',what:'boost',n:30,go:true}},u2.tok);assert.ok(bo.grant.done&&bo.grant.after===30);
      assert.ok(Number((await db.query("select state->>'boost' b from accounts where user_id=$1",[a.uid])).rows[0].b)>Date.now()+29*60000);
      await new Promise(r=>setTimeout(r,200));assert.equal((await post({kind:'alog',args:{}},a.tok)).result.ok,false,'the log is the admin\'s alone');
      const lg=(await post({kind:'alog',args:{}},u2.tok)).log;assert.ok(lg.some(x=>x.kind==='grant'&&x.u==='dana'&&x.d.what==='gold'&&x.d.n===5000&&x.d.by===u2.uid),'who gave what to whom');
      assert.ok(lg.some(x=>x.kind==='log'&&x.d.k==='create'&&x.u==='ziva'),'and what players do');assert.ok(lg.some(x=>x.kind==='log'&&x.d.k==='agrant'&&x.u==='ziva'));
      const one=(await post({kind:'alog',args:{user:'dana',kind:'grant'}},u2.tok)).log;assert.ok(one.length>=2&&one.every(x=>x.u==='dana'&&x.kind==='grant'));}
    { // party invitations: asked, and joined only on a yes
      const c=a,e=b;if(!c.ws||c.ws.readyState!==1)await open(c);if(!e.ws||e.ws.readyState!==1)await open(e);c.q.length=0;e.q.length=0;await new Promise(r=>setTimeout(r,300));
      c.send({t:'pInv',n:'nobody'});assert.equal((await c.wait('pRes')).why,'off','an unknown name');await new Promise(r=>setTimeout(r,2600));
      c.send({t:'pInv',n:'OMER'});assert.equal((await e.wait('pAsk')).n,'dana');assert.equal((await c.wait('pRes')).sent,1);
      assert.equal((await db.query('select count(*)::int n from party_members')).rows[0].n,1,'nobody joins before saying yes');
      e.send({t:'pAns',ok:false});assert.equal((await c.wait('pRes')).why,'no');await new Promise(r=>setTimeout(r,2600));
      c.send({t:'pInv',k:e.key});await e.wait('pAsk');await c.wait('pRes');e.send({t:'pAns',ok:true});assert.equal((await e.wait('pRes')).joined,1);assert.equal((await c.wait('pRes')).acc,1);
      assert.equal((await db.query('select count(*)::int n from party_members')).rows[0].n,2);
      e.send({t:'pAns',ok:true});await new Promise(r=>setTimeout(r,200));assert.equal((await db.query('select count(*)::int n from party_members')).rows[0].n,2,'an answer with no question does nothing');}
  }finally{for(const u of [a,b])if(u.ws)u.ws.close();srv.live.close();srv.close();}
});

test('the last circle over the socket: only connected players who joined fight, the server decides, prizes are written',async()=>{
  const {makeServer}=await import('../server/index.mjs');const {WebSocket}=await import('ws');const {createHash}=await import('node:crypto');const {db}=await world();
  const srv=makeServer(fakeAdmin(db),'test-secret');await new Promise(r=>srv.listen(0,r));const port=srv.address().port,base='http://127.0.0.1:'+port;
  const post=async(body,tok)=>(await (await fetch(base,{method:'POST',headers:Object.assign({'Content-Type':'application/json'},tok?{'x-ec-token':tok}:{}),body:JSON.stringify(body)})).json());
  const mkUser=async(n,cls)=>{const r=await post({kind:'register',args:{user:n,pass:'correct-horse-9',q:0,a:'rex'}});await post({kind:'create',args:{name:n,cls:cls}},r.token);await post({kind:'travel',args:{z:0}},r.token);
    const uid=(await db.query('select user_id from users where username=$1',[n])).rows[0].user_id;return {tok:r.token,uid,key:createHash('md5').update(uid+'peer').digest('hex').slice(0,10)};};
  const open=async u=>{const ws=new WebSocket('ws://127.0.0.1:'+port+'/ws');u.q=[];u.wait=t=>new Promise((res,rej)=>{const go=()=>{const i=u.q.findIndex(m=>m.t===t);if(i>=0)return res(u.q.splice(i,1)[0]);setTimeout(go,10);};go();setTimeout(()=>rej(new Error('no '+t+' message')),4000);});
    ws.on('message',d=>u.q.push(JSON.parse(String(d))));await new Promise(r=>ws.on('open',r));ws.send(JSON.stringify({t:'hello',token:u.tok}));await u.wait('hi');u.ws=ws;u.send=m=>ws.send(JSON.stringify(m));};
  const a=await mkUser('gimel','blade'),b=await mkUser('dalet','storm'),c=await mkUser('hey','hunter');
  try{
    await open(a);await open(b);await open(c);const st=async u=>(await db.query('select state from accounts where user_id=$1',[u.uid])).rows[0].state;
    a.send({t:'brJoin'});assert.equal((await a.wait('brNo')).t,'brNo','no sign-up is open');
    srv.live.brOpen(60000);a.send({t:'brJoin'});assert.equal((await a.wait('brLobby')).n,1);b.send({t:'brJoin'});assert.equal((await b.wait('brLobby')).n,2);
    srv.live.brBegin();const sa=await a.wait('brStart'),sb=await b.wait('brStart');assert.equal(sa.f.length,6,'empty places are filled');assert.equal(sa.me,0);assert.equal(sb.me,1);assert.equal(sa.f[1].id,undefined);assert.equal(sa.f.filter(f=>f.bot).length,4);
    c.send({t:'brJoin'});assert.equal((await c.wait('brNo')).t,'brNo','too late to join');
    const br=srv.live.brNow(),B=br.B;a.send({t:'brAct',k:'atk'});await new Promise(r=>setTimeout(r,120));assert.equal(B.f[1].hp,1,'no hits during the countdown');
    assert.ok(sa.loot.length>=10&&sa.xy.length===6,'the finds on the ground are sent at the start');B.t=1;B.loot=[];for(let i=2;i<6;i++){B.f[i].x=-600;B.f[i].y=-200+i*30;B.f[i].bot=false;}B.f[0].x=0;B.f[0].y=0;B.f[1].x=30;B.f[1].y=10;
    a.send({t:'brAct',k:'atk'});let hit=null;for(let i=0;i<40&&!hit;i++){const m=await a.wait('brS');if(m.ev&&m.ev.some(e=>e.by===0&&e.to===1))hit=m;}assert.ok(hit&&B.f[1].hp<1,'the server applied the hit');
    a.send({t:'brPos',x:9999,y:9999,f:1});await new Promise(r=>setTimeout(r,120));assert.ok(Math.hypot(B.f[0].x,B.f[0].y)<200,'a player cannot jump across the field: '+B.f[0].x);assert.ok(Math.hypot(B.f[0].x,B.f[0].y)>5,'but he does move toward where he says he is');
    B.loot=[{id:77,x:Math.round(B.f[0].x),y:Math.round(B.f[0].y),k:'w'}];let got=null;for(let i=0;i<20&&!got;i++){const m=await a.wait('brS');if(m.ev&&m.ev.some(e=>e.k==='pick'&&e.by===0))got=m;}assert.ok(got&&B.f[0].w===1,'the server gives the find to whoever stands on it');
    const g=(await import('../web/core.js'));for(let i=2;i<6;i++)g.brKill(B,i,-1);B.f[1].hp=.0001;B.f[1].x=B.f[0].x+20;B.f[1].y=B.f[0].y;B.f[0].at.atk=0;a.send({t:'brAct',k:'atk'});
    const ea=await a.wait('brEnd'),eb=await b.wait('brEnd');assert.equal(ea.place,0);assert.equal(eb.place,1);assert.ok(ea.rt.includes('תיבה עתיקה'),ea.rt);
    const A1=await st(a),B1=await st(b);assert.equal(A1.coins,40);assert.equal(A1.brW,1);assert.equal(B1.coins,20);assert.equal(B1.sboxes,1);assert.equal((await st(c)).coins,0,'who did not join gets nothing');assert.equal(srv.live.brNow(),null);
  }finally{for(const u of [a,b,c])if(u.ws)u.ws.close();srv.live.close();srv.close();}
});

test('game master tools: only an account flagged in the database can open events, boost or announce',async()=>{
  const {makeServer}=await import('../server/index.mjs');const {WebSocket}=await import('ws');const {createHash}=await import('node:crypto');const {db}=await world();
  const srv=makeServer(fakeAdmin(db),'test-secret');await new Promise(r=>srv.listen(0,r));const port=srv.address().port,base='http://127.0.0.1:'+port;
  const post=async(body,tok)=>(await (await fetch(base,{method:'POST',headers:Object.assign({'Content-Type':'application/json'},tok?{'x-ec-token':tok}:{}),body:JSON.stringify(body)})).json());
  const mkUser=async(n,cls)=>{const r=await post({kind:'register',args:{user:n,pass:'correct-horse-9',q:0,a:'rex'}});await post({kind:'create',args:{name:n,cls:cls}},r.token);await post({kind:'travel',args:{z:0}},r.token);
    const uid=(await db.query('select user_id from users where username=$1',[n])).rows[0].user_id;return {tok:r.token,uid,key:createHash('md5').update(uid+'peer').digest('hex').slice(0,10)};};
  const open=async u=>{const ws=new WebSocket('ws://127.0.0.1:'+port+'/ws');u.q=[];u.wait=t=>new Promise((res,rej)=>{const go=()=>{const i=u.q.findIndex(m=>m.t===t);if(i>=0)return res(u.q.splice(i,1)[0]);setTimeout(go,10);};go();setTimeout(()=>rej(new Error('no '+t+' message')),4000);});
    ws.on('message',d=>u.q.push(JSON.parse(String(d))));await new Promise(r=>ws.on('open',r));ws.send(JSON.stringify({t:'hello',token:u.tok}));await u.wait('hi');u.ws=ws;u.send=m=>ws.send(JSON.stringify(m));};
  const a=await mkUser('vav','blade'),b=await mkUser('zayin','storm');const G=await import('../supabase/functions/act/core.js');
  try{
    await open(a);await open(b);
    b.send({t:'gm',a:'br',sec:60});b.send({t:'gm',a:'boost',xp:3,drop:3,min:60});await new Promise(r=>setTimeout(r,400));
    assert.equal(srv.live.brNow(),null,'a player without the flag opens nothing');assert.equal(G.boostNow(Date.now()),null);assert.equal(b.q.filter(m=>m.t==='gmRes'||m.t==='brOpen').length,0,'and gets no answer at all');
    await db.query('update users set is_admin=true where user_id=$1',[a.uid]);
    a.send({t:'gm',a:'br',sec:5});const oa=await a.wait('brOpen'),ob=await b.wait('brOpen');assert.equal(oa.left,30000,'the sign-up length is held to its limits');assert.equal(ob.gm,1);assert.ok((await a.wait('gmRes')).ok);assert.ok(srv.live.brNow().gm);
    b.send({t:'brJoin'});assert.equal((await b.wait('brLobby')).n,1);
    await new Promise(r=>setTimeout(r,1100));a.send({t:'gm',a:'brStop'});assert.equal((await b.wait('brCancel')).t,'brCancel');assert.equal(srv.live.brNow(),null);
    await new Promise(r=>setTimeout(r,1100));a.send({t:'gm',a:'boost',xp:9,drop:2,min:999});const bo=await b.wait('boost');assert.equal(bo.xp,3);assert.equal(bo.drop,2);assert.ok(bo.left<=120*60000+5);assert.ok(G.boostNow(Date.now()));
    await new Promise(r=>setTimeout(r,1100));a.send({t:'gm',a:'say',m:'<b>שלום</b> לכולם'});assert.equal((await b.wait('gmSay')).m,'bשלום/b לכולם');
    await db.query('update users set is_admin=false where user_id=$1',[a.uid]);await new Promise(r=>setTimeout(r,1100));a.send({t:'gm',a:'boost',min:0});await new Promise(r=>setTimeout(r,300));assert.ok(G.boostNow(Date.now()),'the right is checked again every time');
  }finally{G.setBoost(null);for(const u of [a,b])if(u.ws)u.ws.close();srv.live.close();srv.close();}
});

test('phone notifications: a subscription is checked, the message goes out once when the absent character reaches the top',async()=>{
  const {makeServer}=await import('../server/index.mjs');const {WebSocket}=await import('ws');const {createHash}=await import('node:crypto');const {db}=await world();
  const sent=[];let fail=0;const srv=makeServer(fakeAdmin(db),'test-secret','*',{push:{sender:async(sub,body)=>{if(fail)throw Object.assign(new Error('gone'),{statusCode:fail});sent.push([sub,JSON.parse(body)]);}}});await new Promise(r=>srv.listen(0,r));const port=srv.address().port,base='http://127.0.0.1:'+port;
  const post=async(body,tok)=>(await (await fetch(base,{method:'POST',headers:Object.assign({'Content-Type':'application/json'},tok?{'x-ec-token':tok}:{}),body:JSON.stringify(body)})).json());
  const mkUser=async(n,cls)=>{const r=await post({kind:'register',args:{user:n,pass:'correct-horse-9',q:0,a:'rex'}});await post({kind:'create',args:{name:n,cls:cls}},r.token);await post({kind:'travel',args:{z:0}},r.token);
    const uid=(await db.query('select user_id from users where username=$1',[n])).rows[0].user_id;return {tok:r.token,uid,key:createHash('md5').update(uid+'peer').digest('hex').slice(0,10)};};
  const open=async u=>{const ws=new WebSocket('ws://127.0.0.1:'+port+'/ws');u.q=[];u.wait=t=>new Promise((res,rej)=>{const go=()=>{const i=u.q.findIndex(m=>m.t===t);if(i>=0)return res(u.q.splice(i,1)[0]);setTimeout(go,10);};go();setTimeout(()=>rej(new Error('no '+t+' message')),4000);});
    ws.on('message',d=>u.q.push(JSON.parse(String(d))));await new Promise(r=>ws.on('open',r));ws.send(JSON.stringify({t:'hello',token:u.tok}));await u.wait('hi');u.ws=ws;u.send=m=>ws.send(JSON.stringify(m));};
  const a=await mkUser('tet','blade');const G=await import('../supabase/functions/act/core.js');
  try{
    const g=await post({kind:'pushget',args:{}},a.tok);assert.ok(g.ok&&!g.on&&g.key.length>80);
    const K={p256dh:'BPk3rXcB1dLxq0c0Yb0mE0aQ0aQ0aQ0aQ0aQ0aQ0aQ0aQ0aQ0aQ0aQ0aQ0aQ0aQ0aQ0aQ0aQ0aQ0aQ0aQ0aQ0aQ0aQ',auth:'abcdefghijklmnop'};
    for(const ep of ['http://fcm.googleapis.com/fcm/send/x','https://evil.example/hook','https://fcm.googleapis.com.evil.example/x','https://127.0.0.1/x'])assert.equal((await post({kind:'pushon',args:{sub:{endpoint:ep,keys:K}}},a.tok)).ok,false,'only real push services are accepted: '+ep);
    assert.ok((await post({kind:'pushon',args:{sub:{endpoint:'https://fcm.googleapis.com/fcm/send/abc123',keys:K},lang:'he'}},a.tok)).ok);assert.ok((await post({kind:'pushget',args:{}},a.tok)).on);
    const st=(await db.query('select state from accounts where user_id=$1',[a.uid])).rows[0].state;st.chars[0].lvl=G.CAP-1;st.chars[0].xp=0;st.chars[0].stats.str=4000;st.chars[0].stats.vit=2000;st.chars[0].zone=0;await db.query('update accounts set state=$1 where user_id=$2',[JSON.stringify(st),a.uid]);
    await open(a);a.ws.close();await new Promise(r=>setTimeout(r,400));const row=async()=>(await db.query('select * from push_subs where user_id=$1',[a.uid])).rows[0];
    const r1=await row();assert.ok(r1.notify_at&&new Date(r1.notify_at).getTime()>Date.now(),'leaving the game schedules the message');assert.equal(r1.name,'tet');
    assert.equal(await srv.push.tick(),0,'not yet');await db.query("update push_subs set notify_at=now()-interval '1 minute' where user_id=$1",[a.uid]);
    assert.equal(await srv.push.tick(),1);assert.equal(sent.length,1);assert.equal(sent[0][0].endpoint,'https://fcm.googleapis.com/fcm/send/abc123');assert.ok(sent[0][1].body.includes('tet')&&sent[0][1].body.includes(String(G.CAP)));assert.equal(await srv.push.tick(),0,'once only');
    await srv.push.away(a.uid);assert.ok((await row()).notify_at);await open(a);await new Promise(r=>setTimeout(r,300));assert.equal((await row()).notify_at,null,'coming back cancels it');
    await db.query("update push_subs set notify_at=now()-interval '1 minute' where user_id=$1",[a.uid]);fail=410;await srv.push.tick();assert.equal((await post({kind:'pushget',args:{}},a.tok)).on,false,'a subscription the push service no longer knows is dropped');
  }finally{if(a.ws)a.ws.close();srv.live.close();srv.close();}
});

test('players on one map see each other\'s hits, held to what the character could do',async()=>{
  const {makeServer}=await import('../server/index.mjs');const {WebSocket}=await import('ws');const {createHash}=await import('node:crypto');const {db}=await world();
  const srv=makeServer(fakeAdmin(db),'test-secret');await new Promise(r=>srv.listen(0,r));const port=srv.address().port,base='http://127.0.0.1:'+port;
  const post=async(body,tok)=>(await (await fetch(base,{method:'POST',headers:Object.assign({'Content-Type':'application/json'},tok?{'x-ec-token':tok}:{}),body:JSON.stringify(body)})).json());
  const mkUser=async(n,cls)=>{const r=await post({kind:'register',args:{user:n,pass:'correct-horse-9',q:0,a:'rex'}});await post({kind:'create',args:{name:n,cls:cls}},r.token);await post({kind:'travel',args:{z:0}},r.token);
    const uid=(await db.query('select user_id from users where username=$1',[n])).rows[0].user_id;return {tok:r.token,uid,key:createHash('md5').update(uid+'peer').digest('hex').slice(0,10)};};
  const open=async u=>{const ws=new WebSocket('ws://127.0.0.1:'+port+'/ws');u.q=[];u.wait=t=>new Promise((res,rej)=>{const go=()=>{const i=u.q.findIndex(m=>m.t===t);if(i>=0)return res(u.q.splice(i,1)[0]);setTimeout(go,10);};go();setTimeout(()=>rej(new Error('no '+t+' message')),4000);});
    ws.on('message',d=>u.q.push(JSON.parse(String(d))));await new Promise(r=>ws.on('open',r));ws.send(JSON.stringify({t:'hello',token:u.tok}));await u.wait('hi');u.ws=ws;u.send=m=>ws.send(JSON.stringify(m));};
  const a=await mkUser('yod','blade'),b=await mkUser('kaf','blade');
  try{
    await open(a);await open(b);b.send({t:'mv',z:0,fl:0,x:100,f:1,a:false,v:0});await new Promise(r=>setTimeout(r,80));
    a.send({t:'mv',z:0,fl:0,x:200,f:1,a:true,v:0,h:1e15,c:1});const m1=await b.wait('mv');assert.equal(m1.h,undefined,'nothing is shown before the server knows his strength');
    await new Promise(r=>setTimeout(r,300));a.send({t:'mv',z:0,fl:0,x:210,f:1,a:true,v:0,h:1e15,c:1});const m2=await b.wait('mv');assert.ok(m2.h>=2&&m2.h<1e6,'a claimed hit is cut to what he could do: '+m2.h);assert.equal(m2.c,1);
    await new Promise(r=>setTimeout(r,80));a.send({t:'mv',z:0,fl:0,x:220,f:1,a:true,v:0,h:5});assert.equal((await b.wait('mv')).h,5);
    await new Promise(r=>setTimeout(r,80));a.send({t:'mv',z:3,fl:0,x:220,f:1,a:true,v:0,h:5});await new Promise(r=>setTimeout(r,150));assert.equal(b.q.filter(m=>m.t==='mv').length,0,'another map hears nothing');
  }finally{for(const u of [a,b])if(u.ws)u.ws.close();srv.live.close();srv.close();}
});

test('castle siege over the socket: guild members join a running siege, the server holds it, the winner is written',async()=>{
  const {makeServer}=await import('../server/index.mjs');const {WebSocket}=await import('ws');const {createHash}=await import('node:crypto');const {db}=await world();
  const srv=makeServer(fakeAdmin(db),'test-secret');await new Promise(r=>srv.listen(0,r));const port=srv.address().port,base='http://127.0.0.1:'+port;
  const post=async(body,tok)=>(await (await fetch(base,{method:'POST',headers:Object.assign({'Content-Type':'application/json'},tok?{'x-ec-token':tok}:{}),body:JSON.stringify(body)})).json());
  const mkUser=async(n,cls)=>{const r=await post({kind:'register',args:{user:n,pass:'correct-horse-9',q:0,a:'rex'}});await post({kind:'create',args:{name:n,cls:cls}},r.token);await post({kind:'travel',args:{z:0}},r.token);
    const uid=(await db.query('select user_id from users where username=$1',[n])).rows[0].user_id;return {tok:r.token,uid,key:createHash('md5').update(uid+'peer').digest('hex').slice(0,10)};};
  const open=async u=>{const ws=new WebSocket('ws://127.0.0.1:'+port+'/ws');u.q=[];u.wait=t=>new Promise((res,rej)=>{const go=()=>{const i=u.q.findIndex(m=>m.t===t);if(i>=0)return res(u.q.splice(i,1)[0]);setTimeout(go,10);};go();setTimeout(()=>rej(new Error('no '+t+' message')),4000);});
    ws.on('message',d=>u.q.push(JSON.parse(String(d))));await new Promise(r=>ws.on('open',r));ws.send(JSON.stringify({t:'hello',token:u.tok}));await u.wait('hi');u.ws=ws;u.send=m=>ws.send(JSON.stringify(m));};
  const a=await mkUser('lamed','blade'),b=await mkUser('mem','storm'),c=await mkUser('nun','blade');let c2=null;const G=await import('../supabase/functions/act/core.js');
  try{
    const gid=(await db.query("insert into guilds (name,tag,leader) values ('אריות','AR',$1) returning id",[a.uid])).rows[0].id;await db.query('insert into guild_members (user_id,guild_id) values ($1,$2),($3,$2)',[a.uid,gid,b.uid]);
    await open(a);await open(b);await open(c);a.send({t:'sgJoin'});assert.equal((await a.wait('sgNo')).why,'closed');
    const x=srv.live.sgOpen(600,false,'s-test-key');assert.equal((await a.wait('sgOpen')).left,600000);
    c.send({t:'sgJoin'});assert.equal((await c.wait('sgNo')).why,'guild','no guild, no siege');
    a.send({t:'sgJoin'});const sa=await a.wait('brStart');assert.ok(sa.sg&&sa.f.length===1,'no guards: only players');assert.equal(sa.f[sa.me].tag,'AR');assert.equal(sa.guilds[0][1],'אריות');
    b.send({t:'sgJoin'});const sb=await b.wait('brStart'),add=await a.wait('sgAdd');assert.equal(add.i,sb.me);assert.equal(add.f.g,Number(gid));
    const B=x.B;B.t=1;const fa=B.f[sa.me],fb=B.f[sb.me];assert.ok(fa.y>1700,'the camp is far from the castle');fa.x=0;fa.y=185;a.send({t:'sgPos',x:0,y:-300,f:1});await new Promise(r=>setTimeout(r,300));a.send({t:'sgPos',x:0,y:-300,f:1});await new Promise(r=>setTimeout(r,150));assert.ok(fa.y>130&&fa.y<185,'he walks, and the gate stops him: '+fa.y);
    assert.equal(sa.lead,1,'the guild leader is known to the server');assert.equal(sb.lead,0);a.send({t:'sgAct',k:'use'});await new Promise(r=>setTimeout(r,200));fa.x=G.SG.crown[0];fa.y=G.SG.crown[1];await new Promise(r=>setTimeout(r,1100));a.send({t:'sgAct',k:'use'});assert.equal((await a.wait('sgHint')).no,'sw','the crown needs both switches held');
    c2=await mkUser('samekh','hunter');await db.query('insert into guild_members (user_id,guild_id) values ($1,$2)',[c2.uid,gid]);await open(c2);c2.send({t:'sgJoin'});const sc=await c2.wait('brStart');const fc=B.f[sc.me];
    fb.x=G.SG.sw[0][0];fb.y=G.SG.sw[0][1];fc.x=G.SG.sw[1][0];fc.y=G.SG.sw[1][1];b.send({t:'sgAct',k:'use'});c2.send({t:'sgAct',k:'use'});await new Promise(r=>setTimeout(r,G.SG.swT*1000+700));assert.deepEqual(B.sg.sw,[Number(gid),Number(gid)]);
    a.send({t:'sgAct',k:'use'});await new Promise(r=>setTimeout(r,500));assert.ok(B.sg.crown[1]>0,'now the leader may take it');B.sg.crown[1]=G.SG.crownT-.3;
    let taken=null;for(let i=0;i<400&&!taken;i++){const m=await b.wait('brS');if(m.ev&&m.ev.some(e=>e.k==='taken'))taken=m;}assert.ok(taken&&taken.sg.holder===Number(gid));
    B.sg.time=B.t+.2;const ea=await a.wait('brEnd'),eb=await b.wait('brEnd');assert.ok(ea.sg&&ea.won===1&&eb.won===1);assert.equal(ea.win,'אריות');
    const row=(await db.query("select * from castle where siege='s-test-key'")).rows[0];assert.equal(String(row.guild_id),String(gid),'the castle is theirs for the week');assert.equal((await db.query('select state from accounts where user_id=$1',[a.uid])).rows[0].state.coins,30);assert.equal(srv.live.sgNow(),null);
  }finally{for(const u of [a,b,c,c2])if(u&&u.ws)u.ws.close();srv.live.close();srv.close();}
});

// A complete local game server for manual and browser checks: the real server code on an in-process Postgres.
// Usage: node tests/_local_server.mjs [port]
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { makeServer } from '../server/index.mjs';
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

const db=new PGlite();
await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; create schema auth; create table auth.users(id uuid primary key);`);
for(const f of fs.readdirSync('supabase/migrations').sort())await db.exec(fs.readFileSync('supabase/migrations/'+f,'utf8'));
const port=Number(process.argv[2])||10777,srv=makeServer(fakeAdmin(db),'local-secret');srv.listen(port,()=>console.log('local server on '+port));
// Hooks for browser checks only: open a Last Circle sign-up now, or end the running fight in favour of the first fighter.
import http from 'node:http';import * as G from '../web/core.js';
http.createServer((q,r)=>{const b=srv.live.brNow();if(q.url.startsWith('/admin='))db.query('update users set is_admin=true where username=$1',[q.url.split('=')[1]]);else if(q.url.startsWith('/open'))srv.live.brOpen(Number(q.url.split('=')[1])||8000);else if(q.url.startsWith('/end')&&b&&b.B){for(let i=1;i<b.B.f.length;i++)G.brKill(b.B,i,0);}r.end(JSON.stringify(b&&b.B?{t:b.B.t,alive:G.brAlive(b.B),f:b.B.f.map(f=>[Math.round(f.x),f.hp,f.alive])}:{phase:b&&b.phase}));}).listen(port+1);

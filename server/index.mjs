// The game server as a plain Node process: the same door as the edge function (supabase/functions/act/index.ts),
// running the same rules and the same handler, for hosting where calls are not metered (Render).
// It needs three settings: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and, optionally, ALLOWED_ORIGIN.
import http from 'node:http';
import { webcrypto } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import * as G from '../supabase/functions/act/core.js';
import { makeAuth, makeHandler } from '../supabase/functions/act/handler.js';
import { attachLive } from './live.mjs';
import { makePush } from './push.mjs';

const crypto = globalThis.crypto || webcrypto;
const rnd = () => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] / 4294967296; };

const LOGGED = new Set(['mlist', 'mbuy', 'mcancel', 'gcreate', 'gjoin', 'gleave', 'gkick', 'pcreate', 'pjoin', 'pleave', 'onew', 'aact', 'aset', 'abackup', 'arestore', 'aodecide', 'agrant']);
export function makeServer(admin, secret, origin = '*', opts = {}) {
  const handle = makeHandler(admin, G, rnd), auth = makeAuth(admin, secret), push = makePush(admin, secret, G, rnd, opts.push);
  const cors = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-ec-token', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Max-Age': '86400' };
  const send = (res, body, status = 200) => { res.writeHead(status, { ...cors, 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
  const server = http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
    if (req.method === 'GET') return send(res, { ok: true, name: 'eternal-cycle', sockets: server.live ? server.live.socks.size : 0, duels: server.live ? server.live.duels.size : 0 }); // health check, with how many live connections
    if (req.method !== 'POST') return send(res, { error: 'method' }, 405);
    try {
      let text = ''; for await (const chunk of req) { text += chunk; if (text.length > 4000) return send(res, { error: 'too_large' }, 413); }
      let body; try { body = JSON.parse(text); } catch { return send(res, { error: 'bad_json' }, 400); }
      const kind = String(body && body.kind || '').slice(0, 20);
      let args = body && body.args && typeof body.args === 'object' && !Array.isArray(body.args) ? body.args : {};
      const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
      if (kind === 'register') return send(res, await auth.register(args.user, args.pass, ip, args.q, args.a));
      if (kind === 'forgot') return send(res, await auth.forgot(args.user));
      if (kind === 'recover') return send(res, await auth.recover(args.user, args.a, args.pass, ip));
      if (kind === 'login') { const r = await auth.login(args.user, args.pass, ip); admin.from('audit').insert({ user_id: null, kind: 'log', detail: { k: r && r.token ? 'login' : 'loginFail', a: { user: String(args.user || '').slice(0, 40) } } }).then(() => {}, () => {}); return send(res, r); }
      const ses = await auth.session(String(req.headers['x-ec-token'] || ''));
      if (!ses) return send(res, { error: 'auth' }, 401);
      const uid = ses.uid;
      if (kind === 'whoami') return send(res, await auth.whoami(uid));
      if (kind === 'setsecret') return send(res, await auth.setSecret(uid, args.pass, args.q, args.a));
      if (kind === 'chpass') return send(res, await auth.chpass(uid, args.pass, args.next));
      if (kind === 'delacct') { const r = await auth.delacct(uid, args.pass); if (r && r.ok) await push.off(uid); return send(res, r); }
      if (kind === 'pushget') return send(res, await push.status(uid));
      if (kind === 'pushon') return send(res, await push.on(uid, args.sub, args.lang));
      if (kind === 'pushoff') return send(res, await push.off(uid));
      if (kind === 'aresetpw') return send(res, await auth.adminReset(uid, args.user));
      // on a map whose monsters are the server's, the kills counted are the ones the server credited, whatever the browser says
      if (args.sv != null) { args = Object.assign({}, args); delete args.sv; } // only the server may say that a count is its own
      if (kind === 'tick' && args) { const z = Math.floor(Number(args.z)), f = args.ev ? 0 : Math.max(0, Math.floor(Number(args.f)) || 0); if (G.ZONES[z] && G.ZONES[z].shared) { // kills, the map's boss and its champion: all three are what the server saw fall
        args = Object.assign({}, args, { kills: server.live.takeKills(uid, z, f, !!args.ev), sv: 1 }); if (args.boss) args.boss = !args.ev && server.live.takeFlag(uid, z, f, 'b'); if (args.elite) args.elite = !args.ev && server.live.takeFlag(uid, z, f, 'e'); } }
      const out = await handle(uid, kind, args, { ip, iat: ses.iat });
      if (out && out.state) server.live.stale(uid); // his saved strength may have changed: the shared monsters will read it again
      // the game's log also keeps what does not pass through the rules module: the market, guilds, parties and what the admin does
      if (LOGGED.has(kind) && out && out.result && out.result.ok && !(kind === 'agrant' && !(args && args.go === true))) { const a = {}; for (const k of ['id', 'code', 'name', 'k', 'price', 'to', 'action', 'target', 'hours', 'user', 'what', 'n', 'day', 'key']) if (args && args[k] != null && typeof args[k] !== 'object') a[k] = String(args[k]).slice(0, 40); admin.from('audit').insert({ user_id: uid, kind: 'log', detail: { k: kind, a } }).then(() => {}, () => {}); }
      if (out && out.expired) return send(res, { error: 'auth' }, 401);
      return send(res, out);
    } catch (e) { console.error(e); return send(res, { error: 'server' }, 500); }
  });
  server.live = attachLive(server, { admin, auth, G, rnd, push });
  // wounds of the players' own bosses, written down by the server that stopped a moment ago
  server.bossSave = async () => { const rows = server.live.ownDump(); if (rows.length) await admin.from('audit').insert({ user_id: null, kind: 'bosshp', detail: { rows } }); return rows.length; };
  (async () => { try { const q = admin.from('audit').select('id,detail'); if (!q || !q.eq) return; const { data } = await q.eq('kind', 'bosshp').gt('at', new Date(Date.now() - 2 * 3600e3).toISOString()); for (const r of data || []) server.live.ownLoad(r.detail && r.detail.rows); const d = admin.from('audit').delete(); if (d && d.eq) await d.eq('kind', 'bosshp'); } catch (_e) { /* a boss at full health is the worst that happens */ } })();
  // the game's log keeps a month
  const logClean = () => { try { const q = admin.from('audit').delete(); if (q && q.eq) q.eq('kind', 'log').lt('at', new Date(Date.now() - 30 * 864e5).toISOString()).then(() => {}, () => {}); } catch (_e) { /* cleaning the log never stops the game */ } }; const logClock = setInterval(logClean, 6 * 3600e3); logClock.unref(); setTimeout(logClean, 60e3).unref(); server.on('close', () => clearInterval(logClock));
  server.push = push; const pushClock = setInterval(() => { push.tick().catch((e) => console.error(e)); }, 60000); pushClock.unref(); server.on('close', () => clearInterval(pushClock));
  return server;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY, port = Number(process.env.PORT) || 10000;
  if (!url || !key || key.length < 30) { // not configured yet: stay up and say so, instead of crashing in a loop
    console.error('SUPABASE_SERVICE_ROLE_KEY is not set yet');
    http.createServer((req, res) => { res.writeHead(req.method === 'GET' ? 200 : 503, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }); res.end(JSON.stringify({ ok: false, need: 'SUPABASE_SERVICE_ROLE_KEY' })); }).listen(port);
  } else {
    const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const srv = makeServer(admin, key, process.env.ALLOWED_ORIGIN || '*'); srv.listen(port, () => console.log('eternal-cycle server on ' + port));
    let stopping = false; process.on('SIGTERM', () => { if (stopping) return; stopping = true; const out = setTimeout(() => process.exit(0), 4000); srv.bossSave().catch((e) => console.error(e)).then(() => { clearTimeout(out); process.exit(0); }); });
  }
}

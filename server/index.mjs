// The game server as a plain Node process: the same door as the edge function (supabase/functions/act/index.ts),
// running the same rules and the same handler, for hosting where calls are not metered (Render).
// It needs three settings: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and, optionally, ALLOWED_ORIGIN.
import http from 'node:http';
import { webcrypto } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import * as G from '../supabase/functions/act/core.js';
import { makeAuth, makeHandler } from '../supabase/functions/act/handler.js';
import { attachLive } from './live.mjs';

const crypto = globalThis.crypto || webcrypto;
const rnd = () => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] / 4294967296; };

export function makeServer(admin, secret, origin = '*') {
  const handle = makeHandler(admin, G, rnd), auth = makeAuth(admin, secret);
  const cors = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-ec-token', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Max-Age': '86400' };
  const send = (res, body, status = 200) => { res.writeHead(status, { ...cors, 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
  const server = http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
    if (req.method === 'GET') return send(res, { ok: true, name: 'eternal-cycle' }); // health check
    if (req.method !== 'POST') return send(res, { error: 'method' }, 405);
    try {
      let text = ''; for await (const chunk of req) { text += chunk; if (text.length > 4000) return send(res, { error: 'too_large' }, 413); }
      let body; try { body = JSON.parse(text); } catch { return send(res, { error: 'bad_json' }, 400); }
      const kind = String(body && body.kind || '').slice(0, 20);
      const args = body && body.args && typeof body.args === 'object' && !Array.isArray(body.args) ? body.args : {};
      const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
      if (kind === 'register') return send(res, await auth.register(args.user, args.pass, ip, args.q, args.a));
      if (kind === 'forgot') return send(res, await auth.forgot(args.user));
      if (kind === 'recover') return send(res, await auth.recover(args.user, args.a, args.pass, ip));
      if (kind === 'login') return send(res, await auth.login(args.user, args.pass, ip));
      const ses = await auth.session(String(req.headers['x-ec-token'] || ''));
      if (!ses) return send(res, { error: 'auth' }, 401);
      const uid = ses.uid;
      if (kind === 'whoami') return send(res, await auth.whoami(uid));
      if (kind === 'setsecret') return send(res, await auth.setSecret(uid, args.pass, args.q, args.a));
      if (kind === 'chpass') return send(res, await auth.chpass(uid, args.pass, args.next));
      if (kind === 'delacct') return send(res, await auth.delacct(uid, args.pass));
      if (kind === 'aresetpw') return send(res, await auth.adminReset(uid, args.user));
      const out = await handle(uid, kind, args, { ip, iat: ses.iat });
      if (out && out.expired) return send(res, { error: 'auth' }, 401);
      return send(res, out);
    } catch (e) { console.error(e); return send(res, { error: 'server' }, 500); }
  });
  server.live = attachLive(server, { admin, auth, G, rnd });
  return server;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY, port = Number(process.env.PORT) || 10000;
  if (!url || !key || key.length < 30) { // not configured yet: stay up and say so, instead of crashing in a loop
    console.error('SUPABASE_SERVICE_ROLE_KEY is not set yet');
    http.createServer((req, res) => { res.writeHead(req.method === 'GET' ? 200 : 503, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }); res.end(JSON.stringify({ ok: false, need: 'SUPABASE_SERVICE_ROLE_KEY' })); }).listen(port);
  } else {
    const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    makeServer(admin, key, process.env.ALLOWED_ORIGIN || '*').listen(port, () => console.log('eternal-cycle server on ' + port));
  }
}

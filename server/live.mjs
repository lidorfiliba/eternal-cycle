// Duels between two players who are both connected, over a WebSocket on the game server.
// The players send only what they try to do (walk here, use this move); the server holds the fight's state,
// decides with its own dice what each move did (rules: liveAct in core.js), tells both sides, and at the end
// writes rating and rewards into both accounts. Nothing a browser claims about damage or the result is used.
import { createHash } from 'node:crypto';
import { WebSocketServer } from 'ws';

const peerKey = (id) => createHash('md5').update(String(id) + 'peer').digest('hex').slice(0, 10);
const plain = (o) => JSON.parse(JSON.stringify(o));

export function attachLive(server, { admin, auth, G, rnd, clock = Date.now, tickMs = 250, inviteMs = 20000 }) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 600 });
  const socks = new Map(), keys = new Map(), invites = new Map(), duels = new Map(), inDuel = new Map(), watching = new Map();
  let nid = 1;
  const send = (uid, m) => { const ws = socks.get(uid); if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); };

  // Change one account under its version check, as the main handler does.
  async function mutate(uid, fn) {
    for (let i = 0; i < 5; i++) {
      const row = (await admin.from('accounts').select('state,version').eq('user_id', uid).maybeSingle()).data; if (!row) return null;
      const A = G.adopt(plain(row.state)); if (!A) return null;
      G.setEnv(rnd, () => clock()); const out = fn(A); if (out === false) return false;
      const upd = await admin.from('accounts').update({ state: plain(A), version: row.version + 1, updated_at: new Date(clock()).toISOString() }).eq('user_id', uid).eq('version', row.version).select('version');
      if (!upd.error && upd.data && upd.data.length) return out == null ? true : out;
    }
    return null;
  }
  const snap = async (uid) => { const r = (await admin.from('arena').select('user_id,snap').eq('user_id', uid).maybeSingle()).data; return r ? G.cleanPlayer(uid, r.snap) : null; };
  const pub = (p) => { const q = Object.assign({}, p); delete q.id; return q; };
  const state = (D) => D.f.map((f) => ({ hp: f.hp, at: f.at, stun: f.stun, sh: f.sh, inv: f.inv, pots: f.pots }));

  async function finish(d, win, why) {
    if (d.done) return; d.done = true; clearInterval(d.timer); duels.delete(d.id);
    for (const w of d.watch) { watching.delete(w); send(w, { t: 'over', win, why: why || '' }); }
    for (let i = 0; i < 2; i++) {
      const uid = d.u[i], won = win === i; inDuel.delete(uid);
      const gain = await mutate(uid, (A) => G.duelSettle(A, clock(), won, d.p[1 - i].rt));
      send(uid, { t: 'end', win: won, gain: typeof gain === 'number' ? gain : 0, why: why || '' });
    }
    try { await admin.from('chat').insert({ ch: 'w', user_id: null, name: '★', tag: '', msg: (d.p[win].n + ' ניצח את ' + d.p[1 - win].n + ' בדו-קרב חי').slice(0, 160) }); } catch (_e) { /* not worth failing for */ }
  }

  async function start(a, b) {
    if (inDuel.has(a) || inDuel.has(b)) return send(a, { t: 'busy' });
    const pa = await snap(a), pb = await snap(b); if (!pa || !pb) return send(a, { t: 'gone' });
    // the challenger pays the arena ticket, as in any arena fight
    const paid = await mutate(a, (A) => { if (!(A.tickets > 0)) return false; A.tickets--; });
    if (paid !== true) return send(a, { t: 'noticket' });
    const D = G.liveNew(pa, pb), d = { id: nid++, u: [a, b], p: [pa, pb], D, t0: clock(), done: false, watch: new Set() };
    duels.set(d.id, d); inDuel.set(a, d); inDuel.set(b, d);
    const L = { b: D.b, cr: D.cr, T: D.T, pool: D.pool };
    for (let i = 0; i < 2; i++) send(d.u[i], { t: 'start', id: d.id, side: i, opp: pub(d.p[1 - i]), L, cls: [pa.c, pb.c] });
    d.timer = setInterval(() => { d.D.t = (clock() - d.t0) / 1000 - 1.2; if (G.liveOver(d.D)) finish(d, d.D.win, 'time'); }, tickMs); d.timer.unref();
  }

  // The Last Circle: a fight of up to eight for whoever is connected and came to the arena during sign-up.
  // The server holds the whole fight (rules: brNew, brAct, brStep in core.js) and plays the empty places itself.
  let br = null;
  const brAll = (m) => { if (!br) return; const s = JSON.stringify(m); for (const uid of br.joined.keys()) { const o = socks.get(uid); if (o && o.readyState === 1) o.send(s); } };
  const brState = (B) => ({ t: 'brS', T: B.t, ring: G.brRing(B).map(Math.round), s: B.f.map((f) => [Math.round(f.x), Math.round(f.z * 100) / 100, Math.round(f.hp * 1000) / 1000, f.alive ? 1 : 0, f.sh > B.t ? 1 : 0, f.stun > B.t ? 1 : 0, f.face < 0 ? -1 : 1, f.kills, f.inv > B.t ? 1 : 0]) });
  async function brFinish(b) {
    if (b.done) return; b.done = true; clearInterval(b.timer); if (br === b) br = null;
    const rank = G.brRank(b.B), humans = b.idx.size, win = b.B.f[rank[0]];
    for (const [uid, i] of b.idx) {
      const place = rank.indexOf(i), rt = await mutate(uid, (A) => G.brReward(A, place, humans));
      send(uid, { t: 'brEnd', place, n: b.B.f.length, rt: typeof rt === 'string' ? rt : '', win: win.n });
    }
    if (!win.bot) { try { await admin.from('chat').insert({ ch: 'w', user_id: null, name: '★', tag: '', msg: (win.n + ' נשאר אחרון במעגל האחרון וזכה בתיבה עתיקה').slice(0, 160) }); } catch (_e) { /* not worth failing for */ } }
  }
  function brStart(b) {
    const hs = [...b.joined.entries()].filter(([uid]) => socks.has(uid) && !inDuel.has(uid)).slice(0, G.BR.MAX);
    if (!hs.length) { if (br === b) br = null; return; }
    const ps = hs.map(([, p]) => p), all = ps.concat(G.brBots(ps, Math.max(0, G.BR.FILL - ps.length), rnd));
    b.phase = 'fight'; b.B = G.brNew(all, rnd); b.joined = new Map(hs); b.idx = new Map(hs.map(([uid], i) => [uid, i]));
    hs.forEach(([uid], i) => send(uid, { t: 'brStart', me: i, f: all.map((p) => Object.assign(pub(p), { bot: p.bot ? 1 : 0 })), T: b.B.t, xz: b.B.f.map((f) => [f.x, f.z]) }));
    b.last = clock();
    b.timer = setInterval(() => { const now = clock(), dt = Math.max(0, Math.min(.5, (now - b.last) / 1000)); b.last = now; const ev = G.brStep(b.B, dt, rnd), m = brState(b.B); if (ev.length) m.ev = ev; brAll(m); if (b.B.over) brFinish(b); }, 200); b.timer.unref();
  }
  const all = (m) => { const s = JSON.stringify(m); for (const o of socks.values()) if (o.readyState === 1) o.send(s); };
  let lastKey = '';
  const brClock = setInterval(() => {
    const w = G.brWindow(clock());
    if (!br && w && w.phase === 'sign' && w.key !== lastKey) { lastKey = w.key; br = { key: w.key, phase: 'sign', joined: new Map(), end: w.signEnd, idx: new Map() }; all({ t: 'brOpen', left: Math.max(0, br.end - clock()) }); }
    else if (br && br.phase === 'sign' && clock() >= br.end) brStart(br);
  }, 1000); brClock.unref();
  // Game-master tools. The right to use them is the is_admin flag on the account in the database, read again on
  // every single request; nothing the browser says about itself is believed, and a refused attempt is logged.
  const isGm = async (uid) => { const r = (await admin.from('users').select('is_admin').eq('user_id', uid).maybeSingle()).data; return !!(r && r.is_admin === true); };
  const gmChat = async (msg) => { try { await admin.from('chat').insert({ ch: 'w', user_id: null, name: '★', tag: '', msg: String(msg).slice(0, 160) }); } catch (_e) { /* not worth failing for */ } };
  async function gmMsg(ws, m) {
    const uid = ws.uid, now = clock(); if (now - (ws.lastGm || 0) < 1000) return; ws.lastGm = now;
    if (!(await isGm(uid))) { console.warn('gm command refused for', uid, String(m.a).slice(0, 12)); return; }
    const a = String(m.a), ok = (msg) => send(uid, { t: 'gmRes', ok: true, msg }), no = (msg) => send(uid, { t: 'gmRes', ok: false, msg });
    console.log('gm', uid, a);
    if (a === 'br') {
      if (br) return no('כבר יש מעגל פתוח או קרב שרץ');
      const sec = Math.max(30, Math.min(300, Math.floor(Number(m.sec)) || 90));
      br = { key: 'gm' + (nid++), phase: 'sign', joined: new Map(), end: now + sec * 1000, idx: new Map(), gm: true };
      all({ t: 'brOpen', left: sec * 1000, gm: 1 }); await gmChat('המעגל האחרון נפתח עכשיו. ההרשמה פתוחה ' + sec + ' שניות'); return ok('ההרשמה נפתחה ל-' + sec + ' שניות');
    }
    if (a === 'brStop') {
      if (!br || br.phase !== 'sign') return no('אין הרשמה פתוחה'); const b = br; br = null; for (const u of b.joined.keys()) send(u, { t: 'brCancel' }); all({ t: 'brOpen', left: 0 }); return ok('ההרשמה בוטלה');
    }
    if (a === 'boost') {
      const min = Math.max(0, Math.min(120, Math.floor(Number(m.min)) || 0)), b = G.setBoost(min ? { xp: m.xp, drop: m.drop, until: now + min * 60000 } : null);
      all({ t: 'boost', xp: b ? b.xp : 1, drop: b ? b.drop : 1, left: b ? b.until - now : 0 });
      if (b) await gmChat('בונוס לכולם ל-' + min + ' דקות: ניסיון ×' + b.xp + ', שלל ×' + b.drop); return ok(b ? 'הבונוס פעיל ל-' + min + ' דקות' : 'הבונוס בוטל');
    }
    if (a === 'say') {
      const text = String(m.m || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 120); if (!text) return no('אין טקסט');
      all({ t: 'gmSay', m: text }); await gmChat('הודעת מנהל: ' + text); return ok('ההודעה נשלחה לכל המחוברים');
    }
    return no('פקודה לא מוכרת');
  }
  async function brMsg(ws, m) {
    const uid = ws.uid, b = br;
    if (m.t === 'brJoin') {
      if (!b || b.phase !== 'sign' || inDuel.has(uid)) return send(uid, { t: 'brNo' });
      const p = await snap(uid); if (!p || br !== b || b.phase !== 'sign') return send(uid, { t: 'brNo' });
      b.joined.set(uid, p); return brAll({ t: 'brLobby', n: b.joined.size, left: Math.max(0, b.end - clock()) });
    }
    if (!b || !b.joined.has(uid)) return;
    if (m.t === 'brLeave') {
      if (b.phase === 'sign') { b.joined.delete(uid); return brAll({ t: 'brLobby', n: b.joined.size, left: Math.max(0, b.end - clock()) }); }
      const i = b.idx.get(uid); if (i != null && b.B.f[i].alive) { G.brKill(b.B, i, -1); if (b.B.over) brFinish(b); } return;
    }
    if (b.phase !== 'fight') return; const i = b.idx.get(uid), B = b.B, f = B.f[i]; if (!f || !f.alive || B.t < 0) return;
    if (m.t === 'brPos') {
      if (f.stun > B.t) return; const now = clock(), el = Math.min(1, (now - (ws.brT || now)) / 1000); ws.brT = now;
      const lim = 240 * el + (f.inv > B.t ? 190 : 24), nx = Number(m.x) || 0, nz = Math.max(0, Math.min(1, Number(m.z) || 0));
      f.x = Math.max(10, Math.min(G.BR.W - 10, f.x + Math.max(-lim, Math.min(lim, nx - f.x)))); f.z += Math.max(-1.4 * el - .05, Math.min(1.4 * el + .05, nz - f.z)); f.face = Number(m.f) < 0 ? -1 : 1; return;
    }
    if (m.t === 'brAct') {
      const o = G.brAct(B, i, String(m.k), rnd); if (!o) return;
      const out = brState(B); out.ev = [o]; brAll(out); send(uid, { t: 'brMe', at: f.at, pots: f.pots, T: B.t });
      if (B.over) brFinish(b);
    }
  }

  async function onMsg(ws, m) {
    const uid = ws.uid, d = inDuel.get(uid), side = d ? d.u.indexOf(uid) : -1;
    if (m.t === 'gm') return gmMsg(ws, m);
    if (typeof m.t === 'string' && m.t.slice(0, 2) === 'br') return brMsg(ws, m);
    if (m.t === 'challenge') {
      const to = keys.get(String(m.k)); if (!to || to === uid || !socks.has(to)) return send(uid, { t: 'gone', k: String(m.k) });
      if (inDuel.has(uid) || inDuel.has(to)) return send(uid, { t: 'busy' });
      const me = await snap(uid); if (!me) return send(uid, { t: 'gone', k: String(m.k) });
      const id = nid++; invites.set(id, { from: uid, to, at: clock() });
      setTimeout(() => { if (invites.delete(id)) send(uid, { t: 'declined' }); }, inviteMs).unref();
      return send(to, { t: 'invite', id, from: { n: me.n, c: me.c, l: me.l, r: me.r, p: me.p } });
    }
    if (m.t === 'answer') {
      const inv = invites.get(Number(m.id)); if (!inv || inv.to !== uid) return; invites.delete(Number(m.id));
      if (!m.ok) return send(inv.from, { t: 'declined' });
      return start(inv.from, inv.to);
    }
    if (m.t === 'mv') { // where I am on my map, passed straight to the others on the same map and floor, between heartbeats
      const now = clock(); if (now - (ws.lastMv || 0) < 55) return; ws.lastMv = now;
      ws.room = (Math.floor(Number(m.z)) || 0) + ':' + (Math.floor(Number(m.fl)) || 0);
      const out = JSON.stringify({ t: 'mv', k: ws.key, x: Math.max(0, Math.min(4000, Math.round(Number(m.x)) || 0)), f: Number(m.f) < 0 ? -1 : 1, a: !!m.a, v: Math.max(-1200, Math.min(1200, Math.round(Number(m.v)) || 0)) });
      for (const o of socks.values()) if (o !== ws && o.room === ws.room && o.readyState === 1) o.send(out);
      return;
    }
    if (m.t === 'emote') { // a reaction shown over my character to whoever shares my map
      const now = clock(); if (now - (ws.lastE || 0) < 800) return; ws.lastE = now; ws.room = (Math.floor(Number(m.z)) || 0) + ':' + (Math.floor(Number(m.fl)) || 0);
      const out = JSON.stringify({ t: 'emote', k: ws.key, e: Math.max(0, Math.min(15, Math.floor(Number(m.e)) || 0)) });
      for (const o of socks.values()) if (o !== ws && o.room === ws.room && o.readyState === 1) o.send(out);
      return;
    }
    if (m.t === 'duels') return send(uid, { t: 'duels', list: [...duels.values()].slice(0, 20).map((x) => ({ id: x.id, a: x.p[0].n, b: x.p[1].n })) });
    if (m.t === 'watch') { // look on at a fight between two other players
      const x = duels.get(Number(m.id)); if (!x || x.done || inDuel.has(uid)) return send(uid, { t: 'gone' });
      const old = watching.get(uid); if (old) old.watch.delete(uid); x.watch.add(uid); watching.set(uid, x); x.D.t = (clock() - x.t0) / 1000 - 1.2;
      return send(uid, { t: 'watching', id: x.id, p: [pub(x.p[0]), pub(x.p[1])], L: { b: x.D.b, cr: x.D.cr, T: x.D.T, pool: x.D.pool }, cls: [x.p[0].c, x.p[1].c], T: x.D.t, f: state(x.D), xz: x.D.f.map((f) => [f.x, f.z]) });
    }
    if (m.t === 'unwatch') { const x = watching.get(uid); if (x) { x.watch.delete(uid); watching.delete(uid); } return; }
    if (m.t === 'who') { // which of these players are connected right now
      const ks = Array.isArray(m.ks) ? m.ks.slice(0, 60).map(String) : []; return send(uid, { t: 'who', on: ks.filter((k) => keys.has(k)) });
    }
    if (m.t === 'whisper') { // a private message to one connected player; never stored
      const now = clock(); if (now - (ws.lastW || 0) < 900) return; ws.lastW = now;
      const text = String(m.m || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 160), to = keys.get(String(m.k)); if (!text) return;
      const acc = (await admin.from('accounts').select('muted_until,banned_until').eq('user_id', uid).maybeSingle()).data;
      if (acc && ((acc.muted_until && new Date(acc.muted_until).getTime() > now) || (acc.banned_until && new Date(acc.banned_until).getTime() > now))) return send(uid, { t: 'muted' });
      if (!to || !socks.has(to)) return send(uid, { t: 'offline', k: String(m.k) });
      if (!ws.name) { const p = await snap(uid); ws.name = p ? p.n : ''; } if (!ws.name) return;
      send(to, { t: 'whisper', from: { k: ws.key, n: ws.name }, m: text }); return send(uid, { t: 'whispered', k: String(m.k), m: text });
    }
    if (!d || d.done) return;
    d.D.t = (clock() - d.t0) / 1000 - 1.2; // the first 1.2 seconds are the countdown
    if (m.t === 'pos') {
      const f = d.D.f[side]; if (d.D.t < 0 || f.stun > d.D.t) return;
      f.x = Math.max(20, Math.min(G.LIVE_W - 20, Number(m.x) || 0)); f.z = Math.max(0, Math.min(1, Number(m.z) || 0));
      for (const w of d.watch) send(w, { t: 'pos', x: f.x, z: f.z, s: side });
      return send(d.u[1 - side], { t: 'pos', x: f.x, z: f.z });
    }
    if (m.t === 'act') {
      if (d.D.t < 0) return; const o = G.liveAct(d.D, side, String(m.k), rnd); if (!o) return;
      const msg = { t: 'ev', o, T: d.D.t, f: state(d.D) }; send(d.u[0], msg); send(d.u[1], msg); for (const w of d.watch) send(w, msg);
      if (d.D.over) finish(d, d.D.win, 'ko');
      return;
    }
    if (m.t === 'leave') return finish(d, 1 - side, 'left');
  }

  server.on('upgrade', (req, sock, head) => {
    if (!String(req.url || '').startsWith('/ws')) { sock.destroy(); return; }
    wss.handleUpgrade(req, sock, head, (ws) => {
      const hello = setTimeout(() => { if (!ws.uid) ws.close(); }, 6000); hello.unref();
      ws.on('message', async (raw) => {
        let m; try { m = JSON.parse(String(raw)); } catch { return; } if (!m || typeof m !== 'object') return;
        try {
          if (!ws.uid) { // the first message must carry the session token
            if (m.t !== 'hello') return ws.close(); const ses = await auth.session(String(m.token || '')); if (!ses) return ws.close();
            clearTimeout(hello); ws.uid = ses.uid; ws.key = peerKey(ses.uid); const old = socks.get(ses.uid); if (old && old !== ws) old.close();
            socks.set(ses.uid, ws); keys.set(ws.key, ses.uid); ws.send(JSON.stringify({ t: 'hi' }));
            if (br && br.phase === 'sign') ws.send(JSON.stringify({ t: 'brOpen', left: Math.max(0, br.end - clock()), quiet: 1 }));
            { const b = G.boostNow(clock()); if (b) ws.send(JSON.stringify({ t: 'boost', xp: b.xp, drop: b.drop, left: b.until - clock(), quiet: 1 })); }
            return;
          }
          await onMsg(ws, m);
        } catch (e) { console.error(e); }
      });
      ws.on('close', () => { if (!ws.uid || socks.get(ws.uid) !== ws) return; socks.delete(ws.uid); keys.delete(ws.key);
        { const x = watching.get(ws.uid); if (x) { x.watch.delete(ws.uid); watching.delete(ws.uid); } }
        if (br && br.joined.has(ws.uid)) { const b = br; if (b.phase === 'sign') b.joined.delete(ws.uid); else { const i = b.idx.get(ws.uid); if (i != null && b.B.f[i].alive) { G.brKill(b.B, i, -1); if (b.B.over) brFinish(b); } } }
        const d = inDuel.get(ws.uid); if (d && !d.done) finish(d, 1 - d.u.indexOf(ws.uid), 'left'); });
      ws.on('error', () => {});
    });
  });
  return { socks, duels, brNow: () => br, brOpen: (ms) => (br = { key: 'manual', phase: 'sign', joined: new Map(), end: clock() + ms, idx: new Map() }), brBegin: () => { if (br && br.phase === 'sign') brStart(br); }, close: () => { for (const d of duels.values()) clearInterval(d.timer); clearInterval(brClock); if (br && br.timer) clearInterval(br.timer); wss.close(); } };
}

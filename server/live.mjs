// Duels between two players who are both connected, over a WebSocket on the game server.
// The players send only what they try to do (walk here, use this move); the server holds the fight's state,
// decides with its own dice what each move did (rules: liveAct in core.js), tells both sides, and at the end
// writes rating and rewards into both accounts. Nothing a browser claims about damage or the result is used.
import { createHash } from 'node:crypto';
import { WebSocketServer } from 'ws';

const peerKey = (id) => createHash('md5').update(String(id) + 'peer').digest('hex').slice(0, 10);
const plain = (o) => JSON.parse(JSON.stringify(o));

export function attachLive(server, { admin, auth, G, rnd, push = null, clock = Date.now, tickMs = 250, inviteMs = 20000 }) {
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
  const state = (D) => D.f.map((f) => ({ hp: f.hp, at: f.at, stun: f.stun, sh: f.sh, inv: f.inv, pots: f.pots, wound: f.wound || 0 }));

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
    const D = G.liveNew(pa, pb, true), d = { id: nid++, u: [a, b], p: [pa, pb], D, t0: clock(), done: false, watch: new Set() };
    duels.set(d.id, d); inDuel.set(a, d); inDuel.set(b, d);
    const L = { b: D.b, cr: D.cr, T: D.T, pool: D.pool, pvp: 1 };
    for (let i = 0; i < 2; i++) send(d.u[i], { t: 'start', id: d.id, side: i, opp: pub(d.p[1 - i]), L, cls: [pa.c, pb.c] });
    d.timer = setInterval(() => { d.D.t = (clock() - d.t0) / 1000 - 1.2; if (G.liveOver(d.D)) finish(d, d.D.win, 'time'); }, tickMs); d.timer.unref();
  }

  // The Last Circle: a fight of up to eight for whoever is connected and came to the arena during sign-up.
  // The server holds the whole fight (rules: brNew, brAct, brStep in core.js) and plays the empty places itself.
  let br = null;
  const brAll = (m) => { if (!br) return; const s = JSON.stringify(m); for (const uid of br.joined.keys()) { const o = socks.get(uid); if (o && o.readyState === 1) o.send(s); } };
  const brState = (B) => ({ t: 'brS', T: B.t, ring: Math.round(G.brRing(B)), s: B.f.map((f) => [Math.round(f.x), Math.round(f.y), Math.round(f.hp * 1000) / 1000, f.alive ? 1 : 0, f.sh > B.t ? 1 : 0, f.stun > B.t ? 1 : 0, f.face < 0 ? -1 : 1, f.kills, f.inv > B.t ? 1 : 0, f.w, f.ar, f.bt, f.pots]) });
  async function brFinish(b) {
    if (b.done) return; b.done = true; clearInterval(b.timer); if (br === b) br = null;
    const rank = G.brRank(b.B), humans = b.idx.size, win = b.B.f[rank[0]];
    admin.from('audit').insert({ user_id: null, kind: 'log', detail: { k: 'lastCircleEnd', a: { players: humans, winner: String(win && win.n || '').slice(0, 20) } } }).then(() => {}, () => {});
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
    hs.forEach(([uid], i) => send(uid, { t: 'brStart', me: i, f: all.map((p) => Object.assign(pub(p), { bot: p.bot ? 1 : 0 })), T: b.B.t, xy: b.B.f.map((f) => [f.x, f.y]), loot: b.B.loot.map((l) => [l.id, l.x, l.y, l.k]) }));
    b.last = clock();
    b.timer = setInterval(() => { const now = clock(), dt = Math.max(0, Math.min(.5, (now - b.last) / 1000)); b.last = now; const ev = G.brStep(b.B, dt, rnd), m = brState(b.B); if (ev.length) m.ev = ev; brAll(m); if (b.B.over) brFinish(b); }, 200); b.timer.unref();
  }
  const all = (m) => { const s = JSON.stringify(m); for (const o of socks.values()) if (o.readyState === 1) o.send(s); };
  let lastKey = '';
  const brClock = setInterval(() => {
    const w = G.brWindow(clock());
    if (!br && w && w.phase === 'sign' && w.key !== lastKey) { lastKey = w.key; br = { key: w.key, phase: 'sign', joined: new Map(), end: w.signEnd, idx: new Map() }; all({ t: 'brOpen', left: Math.max(0, br.end - clock()) }); }
    else if (br && br.phase === 'sign' && clock() >= br.end) brStart(br);
    const si = G.siegeInfo(clock());
    if (!sg && si.on && si.left > 2) { const key = G.siegeInfo(clock() + (si.left + 1) * 60000).key; if (key !== sgDone) { sgDone = key; sgOpen((si.left - 1) * 60, false, key); } }
  }, 1000); brClock.unref();
  // Game-master tools. The right to use them is the is_admin flag on the account in the database, read again on
  // every single request; nothing the browser says about itself is believed, and a refused attempt is logged.
  const isGm = async (uid) => { const r = (await admin.from('users').select('is_admin').eq('user_id', uid).maybeSingle()).data; return !!(r && r.is_admin === true); };
  const gmChat = async (msg) => { try { await admin.from('chat').insert({ ch: 'w', user_id: null, name: '★', tag: '', msg: String(msg).slice(0, 160) }); } catch (_e) { /* not worth failing for */ } };
  async function gmMsg(ws, m) {
    const uid = ws.uid, now = clock(); if (now - (ws.lastGm || 0) < 1000) return; ws.lastGm = now;
    if (!(await isGm(uid))) { console.warn('gm command refused for', uid, String(m.a).slice(0, 12)); return; }
    const a = String(m.a), ok = (msg) => (ws.res ? ws.res({ ok: true, msg }) : send(uid, { t: 'gmRes', ok: true, msg })), no = (msg) => (ws.res ? ws.res({ ok: false, msg }) : send(uid, { t: 'gmRes', ok: false, msg }));
    console.log('gm', uid, a); admin.from('audit').insert({ user_id: uid, kind: 'log', detail: { k: 'gm', a: { a: a.slice(0, 12), min: m.min == null ? '' : String(m.min).slice(0, 6), sec: m.sec == null ? '' : String(m.sec).slice(0, 6) } } }).then(() => {}, () => {});
    if (a === 'br') {
      if (br) return no('כבר יש מעגל פתוח או קרב שרץ');
      const sec = Math.max(30, Math.min(300, Math.floor(Number(m.sec)) || 90));
      br = { key: 'gm' + (nid++), phase: 'sign', joined: new Map(), end: now + sec * 1000, idx: new Map(), gm: true };
      all({ t: 'brOpen', left: sec * 1000, gm: 1 }); await gmChat('המעגל האחרון נפתח עכשיו. ההרשמה פתוחה ' + sec + ' שניות'); return ok('ההרשמה נפתחה ל-' + sec + ' שניות');
    }
    if (a === 'brStop') {
      if (!br || br.phase !== 'sign') return no('אין הרשמה פתוחה'); const b = br; br = null; for (const u of b.joined.keys()) send(u, { t: 'brCancel' }); all({ t: 'brOpen', left: 0 }); return ok('ההרשמה בוטלה');
    }
    if (a === 'siegeBots') { // a practice siege against the server's own players, who hold the castle; the one who opens it leads his side
      if (sg) return no('כבר יש מצור שרץ'); const min = Math.max(3, Math.min(25, Math.floor(Number(m.min)) || 12)), n = Math.max(2, Math.min(6, Math.floor(Number(m.n)) || 4));
      const x = sgOpen(min * 60, true); x.bots = { by: uid, n, sk: Math.max(.2, Math.min(.95, Number(m.sk) || .7)) };
      return ok('מצור אימון נפתח ל-' + min + ' דקות. הצטרף עכשיו');
    }
    if (a === 'siege') {
      if (sg) return no('כבר יש מצור שרץ'); const min = Math.max(3, Math.min(25, Math.floor(Number(m.min)) || 10)); sgOpen(min * 60, true);
      await gmChat('מצור ידידות נפתח ל-' + min + ' דקות. מצטרפים מלשונית הגילדה'); return ok('מצור ידידות נפתח ל-' + min + ' דקות');
    }
    if (a === 'siegeStop') { if (!sg) return no('אין מצור שרץ'); sg.B.over = 1; return ok('המצור ייסגר מיד'); }
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
      if (f.stun > B.t || f.pushT > B.t) return; const now = clock(), el = Math.min(1, (now - (ws.brT || now)) / 1000); ws.brT = now;
      const lim = G.brSpeed(f) * 1.3 * el + (f.inv > B.t ? 190 : 24), dx = (Number(m.x) || 0) - f.x, dy = (Number(m.y) || 0) - f.y, d = Math.hypot(dx, dy) || 1, st = Math.min(d, lim);
      f.x += dx / d * st; f.y += dy / d * st; { const r = Math.hypot(f.x, f.y); if (r > G.BR.R) { f.x *= G.BR.R / r; f.y *= G.BR.R / r; } } f.face = Number(m.f) < 0 ? -1 : 1; return;
    }
    if (m.t === 'brAct') {
      if (m.f !== undefined && B.f[i]) B.f[i].face = Number(m.f) < 0 ? -1 : 1;
      const o = G.brAct(B, i, String(m.k), rnd, Number.isInteger(m.to) ? m.to : -1); if (!o) return; if (o.no) return;
      const out = brState(B); out.ev = [o]; out.s = out.s.map((q, k) => (k === i || k === o.to || (o.more && o.more.some((x) => x[0] === k)) ? q : null)); brAll(out); send(uid, { t: 'brMe', at: f.at, pots: f.pots, T: B.t });
      if (B.over) brFinish(b);
    }
  }

  // Castle siege: one long fight on a walled field, guild against guild, joined at any moment while it runs.
  // Saturday's siege decides who holds the castle; one a game master opens is a friendly match and changes nothing.
  let sg = null, sgDone = '';
  const r3 = (v) => Math.round(v * 1000) / 1000;
  const sgAll = (m) => { if (!sg) return; const s = JSON.stringify(m); for (const uid of sg.idx.keys()) { const o = socks.get(uid); if (o && o.readyState === 1) o.send(s); } };
  const who = (B, i) => (i >= 0 && B.f[i] ? [B.f[i].n, B.f[i].tag] : null);
  const sgView = (B) => ({ ls: [r3(B.sg.lsHp == null ? 1 : B.sg.lsHp), B.sg.lsDown > B.t ? Math.ceil(B.sg.lsDown - B.t) : 0], gate: B.sg.gate.map(r3), sw: B.sg.sw, swn: B.sg.swBy.map((i) => who(B, i)), swp: B.sg.swp.map((p) => [p[0], r3(p[1]), p[2]]), crown: [B.sg.crown[0], r3(B.sg.crown[1]), B.sg.crown[2]], holder: B.sg.holder, left: Math.max(0, Math.round((B.sg.time || G.SG.TIME) - B.t)) });
  const sgState = (B) => ({ t: 'brS', T: B.t, sg: sgView(B), s: B.f.map((f) => [Math.round(f.x), Math.round(f.y), r3(f.hp), f.alive ? 1 : 0, f.sh > B.t ? 1 : 0, f.stun > B.t ? 1 : 0, f.face < 0 ? -1 : 1, f.kills, f.inv > B.t ? 1 : 0, 0, 0, 0, f.pots, G.sgBuff(f, B.t).n, f.wound > B.t ? 1 : 0, f.alive || !f.resp ? 0 : Math.max(1, Math.ceil(f.resp - B.t))]) });
  const sgPub = (B, i, x) => { const f = B.f[i], p = x.prof[i] || {}; return Object.assign(pub(p), { n: f.n, c: f.c, bot: f.bot ? 1 : 0, g: f.g, tag: f.tag }); };
  async function sgFinish(x) {
    if (x.done) return; x.done = true; clearInterval(x.timer); if (sg === x) sg = null; const B = x.B, holder = B.sg.holder, hn = holder > 0 ? (x.names.get(holder) || '') : '';
    admin.from('audit').insert({ user_id: null, kind: 'log', detail: { k: 'siegeEnd', a: { players: x.idx.size, holder: String(hn).slice(0, 20), test: x.test ? 1 : 0, captures: B.sg.caps | 0 } } }).then(() => {}, () => {});
    for (const [uid, i] of x.idx) { const f = B.f[i], won = holder > 0 && f.g === holder, rt = await mutate(uid, (A) => G.sgReward(A, won && !x.test, f.bought)); send(uid, { t: 'brEnd', sg: 1, won: won ? 1 : 0, test: x.test ? 1 : 0, rt: typeof rt === 'string' ? rt : '', win: hn }); }
    all({ t: 'sgOpen', left: 0 });
    try {
      if (!x.test) { const prev = (await admin.from('castle').select('guild_id,at').order('at', { ascending: false }).limit(1)).data; await admin.from('castle').insert({ siege: x.key, guild_id: holder > 0 ? holder : (prev && prev[0] ? prev[0].guild_id : null), pts: B.sg.caps }); }
      await admin.from('chat').insert({ ch: 'w', user_id: null, name: '★', tag: '', msg: (x.test ? 'מצור הידידות נגמר. ' : 'מצור הטירה נגמר. ') + (hn ? 'הטירה בידי ' + hn : 'אף גילדה לא כבשה את הטירה') });
    } catch (e) { console.error(e); }
  }
  function sgOpen(secs, test, key) {
    const B = G.sgNew(rnd, { d: 300, a: 1.2, h: 4000, f: 150 }); B.sg.time = secs;
    const x = { key: key || 'test', test: !!test, B, idx: new Map(), names: new Map(), prof: [], last: clock(), done: false, scaled: true }; sg = x;
    if (!test) (async () => { // Saturday's siege begins with the castle in the hands of whoever holds it now
      const prev = (await admin.from('castle').select('guild_id,at').order('at', { ascending: false }).limit(1)).data, gid = prev && prev[0] && prev[0].guild_id != null ? Number(prev[0].guild_id) : 0; if (!gid || x.done || B.sg.caps) return;
      const g = (await admin.from('guilds').select('id,name').eq('id', gid).maybeSingle()).data; if (!g) return; x.names.set(gid, String(g.name)); B.sg.holder = gid; for (const f of B.f) if (f.g === gid && f.alive) G.sgSpawn(B, f, rnd);
    })().catch((e) => console.error(e));
    x.timer = setInterval(() => { const now = clock(), dt = Math.max(0, Math.min(.5, (now - x.last) / 1000)); x.last = now; const ev = G.sgStep(B, dt, rnd), m = sgState(B); if (ev.length) m.ev = ev; sgAll(m); if (B.over) sgFinish(x); }, 200); x.timer.unref();
    all({ t: 'sgOpen', left: secs * 1000, test: test ? 1 : 0 }); return x;
  }
  async function sgMsg(ws, m) {
    const uid = ws.uid, x = sg;
    if (m.t === 'sgJoin') {
      if (!x || x.done || inDuel.has(uid) || (br && br.joined.has(uid))) return send(uid, { t: 'sgNo', why: 'closed' });
      let i = x.idx.get(uid);
      if (i == null) {
        const boss = !!(x.bots && x.bots.by === uid); // the one who opened a practice siege needs no guild for it, and leads
        const gm = (await admin.from('guild_members').select('guild_id').eq('user_id', uid).maybeSingle()).data; if (!gm && !boss) return send(uid, { t: 'sgNo', why: 'guild' });
        const g = gm ? (await admin.from('guilds').select('id,name,tag,leader').eq('id', gm.guild_id).maybeSingle()).data : { id: 900001, name: 'הצד שלך', tag: 'YOU', leader: uid }, p = await snap(uid); if (!g || !p || sg !== x || x.done) return send(uid, { t: 'sgNo', why: 'closed' });
        if (boss) g.leader = uid;
        if (x.idx.has(uid)) return; const gid = Number(g.id); x.names.set(gid, String(g.name));
        if (!x.scaled) { x.scaled = true; for (const f of x.B.f) if (f.g === 0) { f.d = p.d * .8; f.pool = Math.max(1, p.h * 5 * .9); f.def = p.f * .8; } } // the guards measure up to the first to arrive
        i = G.sgAdd(x.B, p, gid, g.tag, rnd, String(g.leader) === String(uid)); x.idx.set(uid, i); x.prof[i] = p;
        if (boss && !x.botsIn) { // his side and the other, built from his own strength so the fight is even, each with a role
          x.botsIn = true; const B = x.B, n = x.bots.n, eg = 999001, cls = ['lord', 'blade', 'storm', 'hunter'], names = G.BOTN || []; // every class fights in the practice, the warlord on both sides x.names.set(eg, 'שומרי הכתר');
          const mk = (k, c) => Object.assign({}, p, { id: 'sgbot' + k, n: String(names[k % (names.length || 1)] || 'לוחם ' + (k + 1)).slice(0, 14), c, bot: true, d: p.d * (.9 + rnd() * .2), h: p.h * (.9 + rnd() * .2) });
          const put = (k, gg, tag, role, lead) => { const bp = mk(k, cls[k % 4]), q = G.sgAdd(B, bp, gg, tag, rnd, lead); Object.assign(B.f[q], { role, sk: x.bots.sk * (.8 + rnd() * .3), side: k % 2 ? 1 : -1, pots: 40 }); x.prof[q] = bp;
            const add = JSON.stringify({ t: 'sgAdd', i: q, f: sgPub(B, q, x), xy: [B.f[q].x, B.f[q].y] }); for (const u of x.idx.keys()) if (u !== uid) { const o = socks.get(u); if (o && o.readyState === 1) o.send(add); } };
          const mineRoles = ['sw0', 'sw1', 'fight', 'fight', 'fight'], theirRoles = ['lead', 'sw0', 'sw1', 'fight', 'fight', 'fight'];
          for (let k = 0; k < n - 1; k++) put(k, gid, g.tag, mineRoles[k] || 'fight', false);
          B.sg.holder = eg; for (let k = 0; k < n; k++) put(10 + k, eg, 'BOT', theirRoles[k] || 'fight', k === 0);
        }
        const add = JSON.stringify({ t: 'sgAdd', i, f: sgPub(x.B, i, x), xy: [x.B.f[i].x, x.B.f[i].y] }); for (const u of x.idx.keys()) if (u !== uid) { const o = socks.get(u); if (o && o.readyState === 1) o.send(add); }
      }
      return send(uid, { t: 'brStart', sg: sgView(x.B), lead: x.B.f[i].lead ? 1 : 0, test: x.test ? 1 : 0, me: i, f: x.B.f.map((_, q) => sgPub(x.B, q, x)), T: x.B.t, xy: x.B.f.map((f) => [f.x, f.y]), loot: [], guilds: [...x.names.entries()] });
    }
    if (!x || x.done) return; const i = x.idx.get(uid); if (i == null) return; const B = x.B, f = B.f[i];
    if (m.t === 'sgLeave') { x.idx.delete(uid); f.alive = false; f.resp = 0; return; }
    if (!f.alive || B.t < 0) return;
    if (m.t === 'sgPos') {
      if (f.stun > B.t || f.pushT > B.t) return; const now = clock(), el = Math.min(1, (now - (ws.brT || now)) / 1000); ws.brT = now; // a thrown player's old position is not taken back
      const lim = G.BR.spd * 1.3 * el + (f.inv > B.t ? 190 : 24), dx = (Number(m.x) || 0) - f.x, dy = (Number(m.y) || 0) - f.y, d = Math.hypot(dx, dy) || 1, st = Math.min(d, lim);
      G.sgMove(B, f, f.x + dx / d * st, f.y + dy / d * st); f.face = Number(m.f) < 0 ? -1 : 1; return;
    }
    // An action is told to everyone with only the two fighters it touched: with thirty players, a whole picture of everyone on every blow would flood the phones.
    if (m.t === 'sgAct') { if (m.f !== undefined && B.f[i]) B.f[i].face = Number(m.f) < 0 ? -1 : 1; const o = G.sgAct(B, i, String(m.k), rnd, Number.isInteger(m.to) ? m.to : -1); if (!o) return; if (o.no) return send(uid, { t: 'sgHint', no: o.no }); const out = sgState(B); out.ev = [o]; out.s = out.s.map((q, k) => (k === i || k === o.to || (o.more && o.more.some((x) => x[0] === k)) ? q : null)); sgAll(out); return send(uid, { t: 'brMe', at: f.at, pots: f.pots, T: B.t }); }
  }

  // ---- Shared monsters (a pilot on one map). The server holds the monsters of each floor of that map: their health,
  // who hurt them, when they return. A player only says "I strike this one"; the damage is worked out here from his
  // own saved strength, at no more than his own pace, and everyone on the floor sees every blow. A kill is credited
  // to those who hurt the monster, each by his share, and the kill report of that map counts these credits and
  // nothing the browser says. More players on the floor, more monsters.
  const rooms = new Map(), credit = new Map(), flags = new Map();
  const roomSize = (key) => { let n = 0; for (const o of socks.values()) if (o.sroom === key) n++; return n; };
  const roomSend = (key, m) => { const s = JSON.stringify(m); for (const o of socks.values()) if (o.sroom === key && o.readyState === 1) o.send(s); };
  const roomView = (r) => ({ t: 'ss', z: r.z, f: r.f, ev: r.ev ? 1 : 0, hp: r.mons.map((x) => (x.alive ? Math.max(.001, r3(x.hp / r.max)) : 0)) });
  const roomFit = (r, key) => { const n = Math.max(0, roomSize(key) - 1), want = r.ev ? Math.min(40, 22 + 4 * n) : Math.min(24, 8 + 2 * n); while (r.mons.length < want) r.mons.push({ hp: r.max, alive: true, at: 0, dm: new Map() }); };
  // A player's own boss keeps its wounds through a dropped connection, and through a restart of the server: it is his, not the socket's.
  const ownMons = new Map(), OWN_KEEP = 2 * 3600e3;
  const ownDump = () => { const out = [], now = clock(); for (const [u, pm] of ownMons) for (const k in pm) { const m = pm[k]; if (m.alive && m.hp < m.top && now - m.at < OWN_KEEP) out.push([u, k, Math.round(m.hp), Math.round(m.top)]); } return out.slice(0, 2000); };
  const ownLoad = (rows) => { const now = clock(); for (const r of Array.isArray(rows) ? rows : []) { if (!Array.isArray(r) || !(r[2] > 0) || !(r[3] >= r[2])) continue; let pm = ownMons.get(r[0]); if (!pm) ownMons.set(r[0], pm = {}); pm[String(r[1])] = { hp: +r[2], top: +r[3], alive: true, at: now }; } };
  async function sharedMsg(ws, m) {
    const uid = ws.uid, now = clock();
    if (m.t === 'sl') { ws.sroom = null; return; }
    if (m.t === 'sj') {
      if (now - (ws.sjAt || 0) < 400) return; ws.sjAt = now;
      const z = Math.floor(Number(m.z)), ev = !!m.ev, f = ev ? 0 : Math.max(0, Math.min(G.FLOORS - 1, Math.floor(Number(m.f)) || 0)), Z = G.ZONES[z]; if (!Z || !Z.shared || (ev && z >= G.BASEZ)) { ws.sroom = null; return; }
      // a keep is a room of its own: many weak monsters that return fast
      const key = (ev ? 'k' : '') + z + ':' + f; ws.sroom = key; let r = rooms.get(key); if (!r) { r = { z, f, ev, max: Math.max(1, Math.round(G.zs(z, f).hp * (ev ? G.KEEP_HP : 1))), back: ev ? 900 : 2500, mons: [] }; rooms.set(key, r); } roomFit(r, key);
      const p = await snap(uid); ws.sp = p ? { d: p.d, a: p.a, cr: p.cr, cd: p.cd } : null; ws.spAt = now; if (ws.sb == null) { ws.sb = 6; ws.sbT = now; } // the allowance is the player's, not the room's: joining again does not refill it
      return roomSend(key, roomView(r));
    }
    // his strength is read again after anything he does that may have changed it (a level, a piece of gear), and at least every half minute
    if (now - (ws.spAt || 0) > (ws.sp && !ws.spOld ? 30000 : 1200)) { ws.spAt = now; ws.spOld = false; snap(uid).then((q) => { if (q) ws.sp = { d: q.d, a: q.a, cr: q.cr, cd: q.cd }; }).catch(() => {}); }
    const key = ws.sroom, r = key && rooms.get(key), p = ws.sp; if (!r || !p) return; const i = Math.floor(Number(m.i));
    // The boss of a map and its champion are each player's own, but their health is kept here too: -1 the boss, -2 the champion.
    const own = !r.ev && (i === -1 || i === -2), pk = own ? key + (i === -1 ? 'b' : 'e') : '';
    let mon; if (own) { let pm = ownMons.get(uid); if (!pm) ownMons.set(uid, pm = {}); mon = pm[pk]; if (!mon || !mon.alive || now - mon.at > OWN_KEEP) mon = pm[pk] = { hp: r.max * (i === -1 ? 30 : G.ELITE_HP), top: r.max * (i === -1 ? 30 : G.ELITE_HP), alive: true }; mon.at = now; } else mon = r.mons[i];
    if (!mon || !mon.alive) return;
    // his own pace: so many blows' worth a second, a short burst allowed; whatever he asks beyond it is cut down to it
    // Since the maps fight on the siege's beat, a hand that keeps its skills going lands more than plain blows alone: the pace allows for it.
    ws.sb = Math.min(30, (ws.sb || 0) + (now - (ws.sbT || now)) / 1000 * (r.ev ? Math.max(.3, p.a) * 12 : Math.max(.3, p.a) * 2.8 + 8)); ws.sbT = now; if (ws.sb < .2) return;
    let mult = Math.max(.2, Math.min(6, Number(m.m) || 1)); if (mult > ws.sb) mult = ws.sb; ws.sb -= mult;
    const crit = rnd() < p.cr, d = Math.max(1, Math.round(p.d * (crit ? p.cd : 1) * mult * (.9 + rnd() * .2)));
    mon.hp -= d;
    if (own) { // only he sees it; a kill sets a mark that his next kill report may use once
      if (mon.hp > 0) return send(uid, { t: 'sh', i, d, k: ws.key, cr: crit ? 1 : 0, h: r3(mon.hp / mon.top) });
      mon.alive = false; const fl = flags.get(uid) || {}; fl[pk] = now; flags.set(uid, fl); return send(uid, { t: 'sd', i, d, k: ws.key, cr: crit ? 1 : 0 });
    }
    mon.dm.set(uid, (mon.dm.get(uid) || 0) + d);
    if (mon.hp > 0) return roomSend(key, { t: 'sh', i, d, k: ws.key, cr: crit ? 1 : 0, h: r3(mon.hp / r.max) });
    mon.alive = false; mon.at = now + r.back; let tot = 0; for (const v of mon.dm.values()) tot += v; const told = new Set();
    for (const [u, v] of mon.dm) { const c = credit.get(u) || { key, n: 0 }; if (c.key !== key) { c.key = key; c.n = 0; } c.n += v / tot; credit.set(u, c); told.add(u); const o = socks.get(u); if (o && o.sroom === key) send(u, { t: 'sd', i, d, k: ws.key, cr: crit ? 1 : 0, c: r3(v / tot) }); }
    mon.dm = new Map(); const s2 = JSON.stringify({ t: 'sd', i, d, k: ws.key, cr: crit ? 1 : 0 }); for (const [u, o] of socks) if (o.sroom === key && !told.has(u) && o.readyState === 1) o.send(s2);
  }
  const roomClock = setInterval(() => { const now = clock(); for (const [key, r] of rooms) { if (!roomSize(key)) { rooms.delete(key); continue; } r.mons.forEach((x, i) => { if (!x.alive && now >= x.at) { x.alive = true; x.hp = r.max; roomSend(key, { t: 'sr', i }); } }); } if (credit.size > 5000) credit.clear(); if (flags.size > 5000) flags.clear(); }, 300); roomClock.unref();
  const stale = (uid) => { const o = socks.get(uid); if (o) o.spOld = true; };
  const takeFlag = (uid, z, f, what) => { const fl = flags.get(uid), k = z + ':' + f + what; if (!fl || !fl[k]) return false; const ok = clock() - fl[k] < 180000; delete fl[k]; return ok; };
  const takeKills = (uid, z, f, ev) => { const c = credit.get(uid); if (!c || c.key !== (ev ? 'k' : '') + z + ':' + f) return 0; const n = Math.floor(c.n + 1e-9); c.n -= n; return n; };
  // Party invitations: by clicking a player or typing a name. The invited player is asked, and joins only on a yes.
  // The party itself lives in the database as before; this only carries the question and the answer.
  const pInv = new Map(); // invited uid -> { from, code, at }
  async function partyMsg(ws, m) {
    const uid = ws.uid, now = clock(), no = (why) => send(uid, { t: 'pRes', ok: false, why });
    if (m.t === 'pInv') {
      if (now - (ws.lastPI || 0) < 2500) return; ws.lastPI = now;
      let to = m.k != null ? keys.get(String(m.k)) : null; const nm = String(m.n || '').trim().toLowerCase().slice(0, 14);
      if (!to && nm) { let n = 0; for (const [u, sk] of socks) { if (n++ > 200) break; if (!sk.name) { const p = await snap(u); sk.name = p ? p.n : ''; } if (u !== uid && String(sk.name).toLowerCase() === nm) { to = u; break; } } }
      if (!to || to === uid || !socks.has(to)) return no('off');
      let info = (await admin.rpc('party_info', { p_user: uid })).data;
      if (!info || !info.code) { const c = await admin.rpc('party_create', { p_user: uid }); if (c.error) return no('fail'); info = (await admin.rpc('party_info', { p_user: uid })).data; }
      if (!info || !info.code) return no('fail'); const mem = info.members || [];
      if (mem.some((x) => x.id === to)) return no('in'); if (mem.length >= 5) return no('full');
      const cur = pInv.get(to); if (cur && now - cur.at < 20000 && cur.from !== uid) return no('busy');
      if (!ws.name) { const p = await snap(uid); ws.name = p ? p.n : ''; }
      pInv.set(to, { from: uid, code: info.code, at: now }); send(to, { t: 'pAsk', n: String(ws.name || '').slice(0, 14) }); return send(uid, { t: 'pRes', ok: true, sent: 1 });
    }
    const inv = pInv.get(uid); if (!inv) return; pInv.delete(uid); if (now - inv.at > 60000) return;
    if (m.ok !== true) return send(inv.from, { t: 'pRes', ok: false, why: 'no' });
    const j = await admin.rpc('party_join', { p_user: uid, p_code: inv.code }), ok = !j.error;
    send(uid, { t: 'pRes', ok, joined: 1, why: ok ? '' : 'join' }); send(inv.from, { t: 'pRes', ok, acc: 1, why: ok ? '' : 'join' });
  }
  async function onMsg(ws, m) {
    const uid = ws.uid, d = inDuel.get(uid), side = d ? d.u.indexOf(uid) : -1;
    if (m.t === 'gm') return gmMsg(ws, m);
    if (m.t === 'pInv' || m.t === 'pAns') return partyMsg(ws, m);
    if (m.t === 'sj' || m.t === 'sl' || m.t === 'sh') return sharedMsg(ws, m);
    if (typeof m.t === 'string' && m.t.slice(0, 2) === 'sg') return sgMsg(ws, m);
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
      const o = { t: 'mv', k: ws.key, x: Math.max(0, Math.min(4000, Math.round(Number(m.x)) || 0)), f: Number(m.f) < 0 ? -1 : 1, a: !!m.a, v: Math.max(-1200, Math.min(1200, Math.round(Number(m.v)) || 0)) };
      if (m.p != null) o.p = Math.max(0, Math.min(100, Math.round(Number(m.p)) || 0)); // how much life he has left, for his party's list
      if (Number(m.h) > 0) { // the hit he says he landed, shown to the others on his map: held to what his character could do
        if (!ws.hitCap || now - ws.hitAt > 60000) { ws.hitAt = now; ws.hitCap = ws.hitCap || 1; snap(uid).then((p) => { if (p) ws.hitCap = Math.max(1, p.d * p.cd * 9); }).catch(() => {}); }
        o.h = Math.round(Math.min(Number(m.h), ws.hitCap)); o.c = m.c ? 1 : 0; if (o.h < 2) delete o.h;
      }
      const out = JSON.stringify(o);
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
            socks.set(ses.uid, ws); keys.set(ws.key, ses.uid); ws.send(JSON.stringify({ t: 'hi', k: ws.key })); if (push) push.back(ses.uid).catch(() => {});
            if (sg && !sg.done) ws.send(JSON.stringify({ t: 'sgOpen', left: Math.max(0, ((sg.B.sg.time || G.SG.TIME) - sg.B.t) * 1000), test: sg.test ? 1 : 0, quiet: 1 }));
            if (br && br.phase === 'sign') ws.send(JSON.stringify({ t: 'brOpen', left: Math.max(0, br.end - clock()), quiet: 1 }));
            { const b = G.boostNow(clock()); if (b) ws.send(JSON.stringify({ t: 'boost', xp: b.xp, drop: b.drop, left: b.until - clock(), quiet: 1 })); }
            return;
          }
          await onMsg(ws, m);
        } catch (e) { console.error(e); }
      });
      ws.on('close', () => { if (!ws.uid || socks.get(ws.uid) !== ws) return; socks.delete(ws.uid); keys.delete(ws.key); if (push) push.away(ws.uid).catch((e) => console.error(e));
        { const x = watching.get(ws.uid); if (x) { x.watch.delete(ws.uid); watching.delete(ws.uid); } }
        if (sg && sg.idx.has(ws.uid)) { const f = sg.B.f[sg.idx.get(ws.uid)]; sg.idx.delete(ws.uid); f.alive = false; f.resp = 0; }
        if (br && br.joined.has(ws.uid)) { const b = br; if (b.phase === 'sign') b.joined.delete(ws.uid); else { const i = b.idx.get(ws.uid); if (i != null && b.B.f[i].alive) { G.brKill(b.B, i, -1); if (b.B.over) brFinish(b); } } }
        const d = inDuel.get(ws.uid); if (d && !d.done) finish(d, 1 - d.u.indexOf(ws.uid), 'left'); });
      ws.on('error', () => {});
    });
  });
  const gm = async (uid, m) => { let out = { ok: false, msg: 'הפעולה לא מוכרת' }; await gmMsg({ uid, lastGm: 0, res: (r) => { out = r; } }, m || {}); return out; }; // the same actions, asked from the management screen
  return { gm, socks, duels, ownDump, ownLoad, takeKills, takeFlag, stale, rooms, sgNow: () => sg, sgOpen, brNow: () => br, brOpen: (ms) => (br = { key: 'manual', phase: 'sign', joined: new Map(), end: clock() + ms, idx: new Map() }), brBegin: () => { if (br && br.phase === 'sign') brStart(br); }, close: () => { clearInterval(roomClock); for (const d of duels.values()) clearInterval(d.timer); clearInterval(brClock); if (br && br.timer) clearInterval(br.timer); if (sg) clearInterval(sg.timer); wss.close(); } };
}

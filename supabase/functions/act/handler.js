// Request handling for the game, independent of the runtime so it can be tested with a stand-in database.
// `admin` is a Supabase service-role client; `G` is the shared rules module.
const gmSeen = new Map(); // who was last confirmed, or refused, as game master, and when
export function makeHandler(admin, G, rnd, clock = Date.now) {
  const plain = (o) => JSON.parse(JSON.stringify(o));
  const MARKET_MSG = {
    sold: "הפריט כבר נמכר", own: "זה פריט שלך", no_gold: "אין מספיק זהב", bag_full: "התיק מלא",
    limit: "אפשר להציע עד 8 פריטים", not_found: "הפריט לא בתיק", bad_price: "מחיר לא תקין", no_account: "אין חשבון",
    in_guild: "אתה כבר בגילדה", no_guild: "לא נמצאה גילדה בשם הזה", guild_full: "הגילדה מלאה", bad_name: "שם: 3 עד 14 אותיות וספרות. תג: 2 עד 4",
    taken: "השם או התג כבר תפוסים", not_leader: "רק מוביל הגילדה יכול", muted: "הושתקת בצ'אט", order_pending: "יש לך כבר בקשה שממתינה לאישור", order_limit: "יותר מדי בקשות היום. נסה מחר", order_done: "הבקשה כבר טופלה", shop_closed: "התרומות עוד לא נפתחו", not_found: "לא נמצא", slow: "לאט יותר, רגע בין הודעות", empty: "הודעה ריקה", forbidden: "אין הרשאה",
    not_party: "אפשר למכור ישירות רק לחבר פארטי", in_party: "אתה כבר בפארטי", no_party: "לא נמצא פארטי עם הקוד הזה", full: "הפארטי מלא, עד חמישה שחקנים",
  };
  const MAX_CALLS_PER_MIN = 240;
  const errMsg = (res) => MARKET_MSG[String(res.error && res.error.message || "").trim()] || "הפעולה נכשלה";
  const guildView = async (uid, now) => (await admin.rpc("guild_info", { p_user: uid, p_key: G.siegeInfo(now).key })).data || { mine: null, top: [], holder: null };
  const banText = (until) => "החשבון מושעה עד " + new Intl.DateTimeFormat("he-IL", { timeZone: "Asia/Jerusalem", dateStyle: "short", timeStyle: "short" }).format(new Date(until));
  const ARENA_KINDS = new Set(["create", "sync", "travel", "tick", "reset", "duel", "switch", "equip", "unequip", "upgrade"]);

  async function market(uid) {
    const { data } = await admin.from("listings").select("id,seller,seller_name,buyer,item,price")
      .or(`buyer.is.null,buyer.eq.${uid},seller.eq.${uid}`).order("created_at", { ascending: false }).limit(200);
    return (data || []).map((l) => ({ id: String(l.id), sn: l.seller_name, mine: l.seller === uid, direct: !!l.buyer, it: l.item, price: Number(l.price) }));
  }
  // The same short key the heartbeat hands out for other players: md5(user id + 'peer'), first ten hex digits.
  async function peerKey(id) { const { createHash } = await import("node:crypto"); return createHash("md5").update(String(id) + "peer").digest("hex").slice(0, 10); }
  async function board(uid) {
    const { data } = await admin.from("arena").select("user_id,snap").order("resets", { ascending: false }).limit(60);
    return (data || []).map((r) => G.cleanPlayer(r.user_id, r.snap));
  }
  async function saveArena(uid, A) {
    const S = A.chars[A.cur]; if (!S) return;
    const f = G.fighter(S); f.r = G.totalResets(A);
    const t = new Date(clock()).toISOString();
    await admin.from("arena").upsert({ user_id: uid, snap: f, resets: f.r, power: f.p, zone: S.zone, floor: S.zone < 0 ? 0 : S.floor | 0, seen_at: t, updated_at: t });
  }
  // Raw party record (with member ids) for server use, and the id-free view sent to the browser.
  async function partyRaw(uid) {
    const { data } = await admin.rpc("party_info", { p_user: uid });
    return data || null;
  }
  function partyView(uid, p) {
    if (!p) return { code: "", members: [] };
    return { code: p.code, members: (p.members || []).map((m) => {
      const c = G.cleanPlayer(m.id, m.snap);
      return { n: c.n, c: c.c, l: c.l, r: c.r, zone: m.zone, active: !!m.active, me: m.id === uid, leader: m.id === p.leader };
    }) };
  }

  async function handle(uid, kind, args, meta = {}) {
    // Light paths that never load the account: the heartbeat, chat and the admin screen.
    if (kind === "beat") {
      const r = await admin.rpc("beat", { p_user: uid, p_x: Math.round(Number(args.x)) || 0, p_face: Number(args.f) < 0 ? -1 : 1, p_act: !!args.a, p_since: Math.max(0, Math.floor(Number(args.s)) || 0) });
      return { beat: r.data || {} };
    }
    if (kind === "wget") { // where the world boss stands: the live opening, or the one that just ended
      const w = G.evWindows(clock(), 60).find((x) => x.e.world); if (!w) return { world: null };
      const r = await admin.rpc("world_hit", { p_user: uid, p_key: w.key, p_name: "", p_dmg: 0, p_base: G.WORLD_BASE });
      if (r.error || !r.data) return { world: null };
      const hit = (await admin.from("world_hits").select("claimed").eq("key", w.key).eq("user_id", uid).maybeSingle()).data; // so a collected prize is not offered again
      return { world: Object.assign({}, r.data, { claimed: !!(hit && hit.claimed) }) };
    }
    if (kind === "say") {
      const r = await admin.rpc("chat_say", { p_user: uid, p_guild: !!args.g, p_msg: String(args.m == null ? "" : args.m).slice(0, 300) });
      return { result: r.error ? { ok: false, msg: errMsg(r) } : { ok: true } };
    }
    if (kind === "top") { // the leaderboard: top 20 by resets (then level) and by fighting power
      const list = async (col) => ((await admin.from("arena").select("user_id,snap,resets,power").order(col, { ascending: false }).limit(40)).data || []).map((r) => {
        const c = G.cleanPlayer(r.user_id, r.snap);
        return { n: c.n, c: c.c, l: c.l, r: Number(r.resets) || 0, p: Number(r.power) || c.p, me: r.user_id === uid };
      });
      const byResets = (await list("resets")).sort((a, b) => b.r - a.r || b.l - a.l || b.p - a.p).slice(0, 20);
      const byPower = (await list("power")).sort((a, b) => b.p - a.p || b.r - a.r).slice(0, 20);
      return { result: { ok: true }, top: { resets: byResets, power: byPower } };
    }
    // Paid credits: a player's requests, and the admin side that confirms payments.
    if (kind === "oget" || kind === "onew" || kind === "ocancel") {
      let res = { error: null };
      if (kind === "onew") { const pk = G.PACKS.find((x) => x.k === String(args.pack)); if (!pk) return { result: { ok: false, msg: "החבילה לא קיימת" } };
        res = await admin.rpc("order_create", { p_user: uid, p_pack: pk.k, p_credits: pk.credits, p_price: pk.ils, p_ref: String(args.ref == null ? "" : args.ref).slice(0, 120) }); }
      if (kind === "ocancel") res = await admin.rpc("order_cancel", { p_user: uid, p_id: Math.floor(Number(args.id)) || 0 });
      return { result: res.error ? { ok: false, msg: errMsg(res) } : { ok: true }, orders: (await admin.rpc("orders_mine", { p_user: uid })).data || { pay: "", orders: [] } };
    }
    if (kind === "aorders" || kind === "aodecide" || kind === "aset") {
      let res = { error: null };
      if (kind === "aodecide") res = await admin.rpc("order_decide", { p_admin: uid, p_id: Math.floor(Number(args.id)) || 0, p_ok: !!args.ok });
      if (kind === "aset") res = await admin.rpc("admin_setting", { p_admin: uid, p_key: String(args.key || "").slice(0, 20), p_value: String(args.value == null ? "" : args.value).slice(0, 700) });
      const view = await admin.rpc("admin_orders", { p_admin: uid });
      if (view.error) return { result: { ok: false, msg: errMsg(view) } };
      return { result: res.error ? { ok: false, msg: errMsg(res) } : { ok: true }, shop: view.data, backups: (await admin.rpc("admin_backups", { p_admin: uid })).data || [] };
    }
    if (kind === "abackup" || kind === "arestore") { // take a backup now, or put one account back from a given day
      const ok = await admin.rpc("is_admin", { p_user: uid }); if (ok.data !== true) return { result: { ok: false, msg: MARKET_MSG.forbidden } };
      const res = kind === "abackup" ? await admin.rpc("backup_run", {})
        : await admin.rpc("backup_restore_account", { p_admin: uid, p_day: String(args.day || "").slice(0, 10), p_username: String(args.user || "").slice(0, 64) });
      return { result: res.error ? { ok: false, msg: errMsg(res) } : { ok: true }, backups: (await admin.rpc("admin_backups", { p_admin: uid })).data || [] };
    }
    if (kind === "aview") { const r = await admin.rpc("admin_view", { p_user: uid }); if (r.error) return { result: { ok: false, msg: errMsg(r) } };
      const rp = await admin.from("chat").select("id,name,msg,at").eq("ch", "r").order("id", { ascending: false }).limit(40); // players' reports, newest first
      return { result: { ok: true }, admin: Object.assign({}, r.data, { reports: rp.data || [] }) }; }
    if (kind === "aact") {
      const r = await admin.rpc("admin_act", { p_user: uid, p_action: String(args.action || "").slice(0, 12), p_target: String(args.target || "").slice(0, 64), p_hours: Math.floor(Number(args.hours)) || 24 });
      if (r.error) return { result: { ok: false, msg: errMsg(r) } };
      return { result: { ok: true }, admin: (await admin.rpc("admin_view", { p_user: uid })).data };
    }
    let guildMade = false, shareXp = 0, wclaim = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      const now = clock();
      const { data: row, error } = await admin.from("accounts").select("state,version,calls,calls_at,banned_until,pw_at").eq("user_id", uid).maybeSingle();
      if (error) throw error;
      if (row && row.banned_until && Date.parse(row.banned_until) > now) return { result: { ok: false, msg: banText(row.banned_until) }, banned: true, state: null };
      // A session opened before the last password change is no longer valid.
      if (row && row.pw_at && meta.iat && meta.iat < Date.parse(row.pw_at) - 1000) return { result: { ok: false, msg: "auth" }, expired: true, state: null };

      if (!row) {
        if (kind !== "create") return { result: { ok: false, msg: "new" }, state: null };
        G.setEnv(rnd, () => now);
        const A = G.newAccount();
        const r = G.apply(A, "create", args, { uid });
        if (!r.ok) return { result: r, state: null };
        const ins = await admin.from("accounts").insert({ user_id: uid, state: plain(A) });
        if (ins.error) continue; // created by a parallel request; reload and go on
        await saveArena(uid, A);
        return { result: r, state: plain(A) };
      }

      // Rate limit per account.
      let calls = row.calls, at = Date.parse(row.calls_at);
      if (now - at > 60000) { calls = 0; at = now; }
      calls++;
      if (calls > MAX_CALLS_PER_MIN) return { result: { ok: false, msg: "יותר מדי בקשות, נסה בעוד רגע" }, state: row.state };

      // Paths below that do not rewrite the account still count against the rate limit.
      const bump = () => admin.from("accounts").update({ calls, calls_at: new Date(at).toISOString() }).eq("user_id", uid);
      if (kind === "mget") { await bump(); return { result: { ok: true }, market: await market(uid) }; }
      if (kind === "pget") { await bump(); return { result: { ok: true }, party: partyView(uid, await partyRaw(uid)) }; }
      if (kind === "pcreate" || kind === "pjoin" || kind === "pleave") {
        await bump();
        const res = kind === "pcreate" ? await admin.rpc("party_create", { p_user: uid })
          : kind === "pjoin" ? await admin.rpc("party_join", { p_user: uid, p_code: String(args.code || "").slice(0, 12) })
          : await admin.rpc("party_leave", { p_user: uid });
        const key = res.error ? String(res.error.message || "").trim() : "";
        return { result: res.error ? { ok: false, msg: MARKET_MSG[key] || "הפעולה נכשלה" } : { ok: true }, party: partyView(uid, await partyRaw(uid)) };
      }
      if (kind === "gget") { await bump(); return { result: { ok: true }, guild: await guildView(uid, now) }; }
      if (kind === "gjoin" || kind === "gleave" || kind === "gkick" || kind === "gnotice") {
        await bump();
        const res = kind === "gjoin" ? await admin.rpc("guild_join", { p_user: uid, p_name: String(args.name || "").slice(0, 20) })
          : kind === "gleave" ? await admin.rpc("guild_leave", { p_user: uid })
          : kind === "gkick" ? await admin.rpc("guild_kick", { p_user: uid, p_pos: Math.floor(Number(args.i)) || 0 })
          : await admin.rpc("guild_notice", { p_user: uid, p_text: String(args.text || "").slice(0, 200) });
        return { result: res.error ? { ok: false, msg: errMsg(res) } : { ok: true }, guild: await guildView(uid, now) };
      }
      if (kind === "gcreate" && !guildMade) {
        if (!(row.state && row.state.gold >= G.GUILD_FEE)) { await bump(); return { result: { ok: false, msg: "פתיחת גילדה עולה " + G.GUILD_FEE.toLocaleString("en-US") + " זהב" }, state: row.state }; }
        const res = await admin.rpc("guild_create", { p_user: uid, p_name: String(args.name || "").slice(0, 20), p_tag: String(args.tag || "").slice(0, 8) });
        if (res.error) { await bump(); return { result: { ok: false, msg: errMsg(res) }, state: row.state, guild: await guildView(uid, now) }; }
        guildMade = true;
      }
      if (kind === "mlist" || kind === "mbuy" || kind === "mcancel") {
        const id = Math.floor(Number(args.id));
        if (!Number.isFinite(id) || id < 0) return { result: { ok: false, msg: MARKET_MSG.not_found }, state: row.state };
        // A direct sale names a party member by position in the party list; the browser never sees other players' ids.
        let to = null;
        if (kind === "mlist" && args.to != null && args.to !== "") {
          const p = await partyRaw(uid), m = p && p.members[Math.floor(Number(args.to))];
          if (!m || m.id === uid) return { result: { ok: false, msg: MARKET_MSG.not_party }, state: row.state };
          to = m.id;
        }
        if (kind === "mlist") { const it = (row.state.inv || []).find((x) => x && x.id === id); if (it && it.s === "y" && it.until) return { result: { ok: false, msg: "חיית מחמד שכבר ליוותה אותך לא נמכרת" }, state: row.state }; }
        const call = kind === "mlist"
          ? admin.rpc("market_list", { p_user: uid, p_item_id: id, p_price: Math.floor(Number(args.price)) || 0, p_to: to })
          : admin.rpc(kind === "mbuy" ? "market_buy" : "market_cancel", { p_user: uid, p_listing: id });
        await bump();
        const res = await call;
        const key = res.error ? String(res.error.message || "").trim() : "";
        const fresh = await admin.from("accounts").select("state").eq("user_id", uid).maybeSingle();
        return {
          result: res.error ? { ok: false, msg: MARKET_MSG[key] || "הפעולה נכשלה" } : { ok: true },
          state: fresh.data ? fresh.data.state : row.state,
          market: await market(uid),
        };
      }

      const A = G.adopt(plain(row.state));
      if (!A) return { result: { ok: false, msg: "השמירה פגומה" }, state: null };
      const ctx = { uid };
      let players = null;
      if (kind === "opps") { players = await board(uid); ctx.players = players; }
      if (kind === "claimWorld") { // the share is read, and marked collected, once; a retried save reuses it
        if (!wclaim) { const w = G.evWindows(now, 60).find((x) => x.e.world); if (!w) return { result: { ok: false, msg: "אין בוס עולם לאסוף ממנו" }, state: row.state };
          const st = await admin.rpc("world_hit", { p_user: uid, p_key: w.key, p_name: "", p_dmg: 0, p_base: G.WORLD_BASE });
          if (w.live && !(st.data && st.data.dead)) return { result: { ok: false, msg: "הקרב עוד לא נגמר" }, state: row.state };
          const c = await admin.rpc("world_claim", { p_user: uid, p_key: w.key });
          if (c.error) return { result: { ok: false, msg: /claimed/.test(String(c.error.message)) ? "הפרס כבר נאסף" : "לא השתתפת בקרב הזה" }, state: row.state };
          wclaim = c.data; }
        ctx.wshare = wclaim;
      }
      if (kind === "duelStart" && typeof args.k === "string" && /^[0-9a-f]{10}$/.test(args.k)) { // challenge someone seen on the map
        const { data } = await admin.from("arena").select("user_id,snap").order("seen_at", { ascending: false }).limit(300);
        for (const row of data || []) { if (row.user_id !== uid && (await peerKey(row.user_id)) === args.k) { ctx.target = G.cleanPlayer(row.user_id, row.snap); break; } }
      }
      // The game master may walk anywhere, to test. The right is the is_admin flag in the database, asked again at most once a minute; the client's word alone gives nothing.
      if (args.gm === 1 && (kind === "tick" || kind === "travel" || kind === "buy")) { const c = gmSeen.get(uid); let ok = c && c.t > now - 60000 ? c.ok : null; if (ok === null) { const q = await admin.rpc("is_admin", { p_user: uid }); ok = q.data === true; gmSeen.set(uid, { ok, t: now }); if (gmSeen.size > 500) gmSeen.clear(); } if (ok) ctx.gm = true; }
      if (!ctx.gm && ((kind === "buy" && args.shop === "city") || (kind === "travel" && G.ZONES[Math.floor(Number(args.z))] && G.ZONES[Math.floor(Number(args.z))].castle))) { // the ancient city: only for the guild that holds the castle
        const gt = await admin.rpc("guild_tick", { p_user: uid, p_kills: 0, p_siege: false, p_key: G.siegeInfo(now).key }); if (!gt.error && gt.data) ctx.castle = !!gt.data.castle;
      }
      if (ctx.gm) ctx.castle = true;
      if (kind === "tick" && Number(args.z) >= 0) {
        const pm = await admin.rpc("party_mates", { p_user: uid, p_zone: Math.floor(Number(args.z)) });
        const mates = pm.error || !Array.isArray(pm.data) ? [] : pm.data;
        ctx.partyN = mates.length; ctx.auras = mates; // one entry per active member on this map: their class
        // Experience that party members' kills left for this player. Taken once, even if the save below has to be retried.
        if (!shareXp) { const tk = await admin.rpc("party_share_take", { p_user: uid }); shareXp = tk.error ? 0 : Number(tk.data) || 0; }
        ctx.shareXp = shareXp;
        const gt = await admin.rpc("guild_tick", { p_user: uid, p_kills: 0, p_siege: false, p_key: G.siegeInfo(now).key });
        if (!gt.error && gt.data) { ctx.guildLvl = Number(gt.data.lvl) || 0; ctx.castle = ctx.gm || !!gt.data.castle; }
      }
      G.setEnv(rnd, () => now); // set right before the synchronous rules call; no await in between
      const r = G.apply(A, kind, args, ctx);
      if (!r.ok) { await bump(); if (shareXp) await admin.rpc("party_share_back", { p_user: uid, p_xp: shareXp }); return { result: r, state: row.state }; } // a refused action changes nothing

      const next = plain(A);
      const upd = await admin.from("accounts")
        .update({ state: next, version: row.version + 1, calls, calls_at: new Date(at).toISOString(), updated_at: new Date(now).toISOString() })
        .eq("user_id", uid).eq("version", row.version).select("version");
      if (upd.error) throw upd.error;
      if (!upd.data || !upd.data.length) continue; // another request saved first; redo on fresh state

      if (ARENA_KINDS.has(kind)) await saveArena(uid, A);
      if (kind === "report" && r.report) { try { const ch = A.chars[A.cur]; await admin.from("chat").insert({ ch: "r", user_id: uid, name: ch ? String(ch.name).slice(0, 14) : "?", tag: "", msg: ("על " + r.report.n + " [" + r.report.k + "]: " + r.report.why).slice(0, 160) }); } catch (_e) { /* the report is best effort */ } }
      { // feats the whole server hears about; a failure here never fails the action
        const ch = A.chars[A.cur], nm = ch ? String(ch.name).slice(0, 14) : "", rep = r.rep || {}; let feat = "";
        if (kind === "upgrade" && r.code === "ok" && r.p >= 11) feat = nm + " שדרג פריט ל-+" + r.p;
        else if (kind === "wingEvolve" && r.evolved && r.t >= 9) feat = nm + " פיתח את " + G.WINGN[r.t - 1];
        else if (kind === "reset" && r.ok) feat = nm + " השלים ריסט " + r.resets;
        else if (kind === "exAdd" && r.full) feat = nm + " השלים פריט אקסלנט מלא";
        else if (kind === "tick" && rep.notable) { const it = rep.notable.find((x) => x.pf) || rep.notable.find((x) => x.ex || x.r >= 4); if (it) feat = nm + " מצא " + G.itemName(it, ch.cls); }
        else if (kind === "openBox" && r.box && r.box.pet && r.box.it.r >= 2) feat = nm + " מצא בתיבה חיית מחמד: " + G.PETN[r.box.it.r];
        else if (kind === "towerEnd" && r.perfect && r.notable) feat = nm + " מצא " + G.itemName(r.notable[0], ch.cls) + " במגדל הנצח";
        else if (kind === "duelAct" && r.win === true && A.rating >= 1200) feat = nm + " ניצח בזירה והגיע לדירוג " + A.rating;
        if (feat && nm) { try { await admin.from("chat").insert({ ch: "w", user_id: null, name: "\u2605", tag: "", msg: feat.slice(0, 160) }); } catch (_e) { /* not worth failing for */ } }
      }
      const out = { result: r, state: next };
      if (kind === "tick" && r.kills > 0 && r.partyN > 0 && r.base > 0) await admin.rpc("party_share_add", { p_user: uid, p_zone: Math.floor(Number(args.z)), p_xp: Math.round(r.base * G.PARTY_SHARE), p_lvl: A.chars[A.cur].lvl });
      if (kind === "tick" && r.world && r.world.dmg > 0) { const ch = A.chars[A.cur]; const wh = await admin.rpc("world_hit", { p_user: uid, p_key: r.world.key, p_name: ch ? ch.name : "", p_dmg: r.world.dmg, p_base: G.WORLD_BASE }); if (!wh.error) out.world = wh.data; }
      if (kind === "tick" && r.kills > 0) await admin.rpc("guild_tick", { p_user: uid, p_kills: r.kills, p_siege: G.siegeInfo(now).on, p_key: G.siegeInfo(now).key });
      if (kind === "tick" && r.claimed > r.kills + 5) {
        const detail = { claimed: r.claimed, allowed: r.kills, z: args.z };
        // A claim far beyond anything the real client can send counts toward an automatic suspension.
        if (r.claimed >= r.kills * 3 && r.claimed - r.kills >= 50) { const st = await admin.rpc("cheat_strike", { p_user: uid, p_detail: detail }); if (st.data === true) out.banned = true; }
        else await admin.from("audit").insert({ user_id: uid, kind: "clamp", detail });
      }
      if (kind === "gcreate") out.guild = await guildView(uid, now);
      if (players) out.players = players.map((p) => ({ n: p.n, r: p.r, l: p.l, me: p.id === uid }));
      return out;
    }
    return { result: { ok: false, msg: "עומס, נסה שוב" } };
  }
  return handle;
}

// Username + password sign-in. Sessions are stateless tokens signed with a key derived from a server secret.
// Uses only WebCrypto, so the same code runs in the edge runtime and in the tests.
export function makeAuth(admin, secret, clock = Date.now) {
  const ITER = 300000, TTL = 90 * 24 * 3600 * 1000;
  const enc = new TextEncoder(), dec = new TextDecoder();
  const b64 = (u8) => btoa(String.fromCharCode(...u8)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const unb64 = (t) => Uint8Array.from(atob(t.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
  const USER_RE = /^[\p{L}\p{N}_]{3,16}$/u;
  const norm = (u) => String(u == null ? "" : u).normalize("NFKC").trim().toLowerCase();
  const fail = (msg) => ({ ok: false, msg });
  let hkey = null;
  const hmacKey = async () => hkey || (hkey = await crypto.subtle.importKey("raw",
    await crypto.subtle.digest("SHA-256", enc.encode("ec-session:" + secret)), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]));
  async function hashPass(pass, salt) {
    const k = await crypto.subtle.importKey("raw", enc.encode(pass), "PBKDF2", false, ["deriveBits"]);
    return b64(new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: ITER }, k, 256)));
  }
  const same = (a, b) => { let d = a.length ^ b.length; for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0); return d === 0; };
  async function token(uid) {
    const body = uid + "." + (clock() + TTL);
    return b64(enc.encode(body)) + "." + b64(new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(), enc.encode(body))));
  }
  // Returns the account id for a valid, unexpired token, otherwise null.
  async function verify(tok) { const s = await session(tok); return s ? s.uid : null; }
  async function session(tok) {
    try {
      const p = String(tok || "").split("."); if (p.length !== 2 || tok.length > 400) return null;
      const body = dec.decode(unb64(p[0]));
      if (!await crypto.subtle.verify("HMAC", await hmacKey(), unb64(p[1]), enc.encode(body))) return null;
      const [uid, exp] = body.split("."); if (!(+exp > clock())) return null;
      return /^[0-9a-f-]{36}$/.test(uid) ? { uid, iat: +exp - TTL } : null;
    } catch { return null; }
  }
  const normAns = (a) => String(a == null ? "" : a).normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ").slice(0, 60);
  const okQ = (q) => Number.isInteger(q) && q >= 0 && q < 4;
  async function secretCols(q, a) { const salt = crypto.getRandomValues(new Uint8Array(16)); return { secret_q: q, secret_hash: await hashPass(a, salt), secret_salt: b64(salt) }; }
  async function userBy(uid) { return (await admin.from("users").select("username,user_id,pass_hash,salt").eq("user_id", uid).maybeSingle()).data; }
  async function passOk(row, pass) { return !!row && same(await hashPass(String(pass == null ? "" : pass).slice(0, 72), unb64(row.salt)), row.pass_hash); }
  async function setPass(uid, pw) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    await admin.from("users").update({ pass_hash: await hashPass(pw, salt), salt: b64(salt) }).eq("user_id", uid);
    await admin.from("accounts").update({ pw_at: new Date(clock()).toISOString() }).eq("user_id", uid);
  }
  // Which question to show for a username. Unknown names get a stable made-up one, so the answer does not reveal who exists.
  async function forgot(user) {
    const u = norm(user).slice(0, 64);
    const row = (await admin.from("users").select("secret_q").eq("username", u).maybeSingle()).data;
    let q = row && row.secret_q != null ? row.secret_q : null;
    if (q == null) { let h = 0; for (const c of u) h = (h * 31 + c.codePointAt(0)) >>> 0; q = h % 4; }
    return { ok: true, q };
  }
  async function recover(user, answer, pass, ip) {
    const u = norm(user).slice(0, 64), pw = String(pass == null ? "" : pass), a = normAns(answer), addr = String(ip || "unknown").slice(0, 64);
    if (pw.length < 8 || pw.length > 72) return fail("סיסמה: 8 עד 72 תווים");
    const blk = await admin.rpc("login_blocked", { p_user: u, p_ip: addr });
    if (blk.error || blk.data === true) return fail("יותר מדי ניסיונות. נסה שוב בעוד רבע שעה");
    const row = (await admin.from("users").select("user_id,secret_hash,secret_salt").eq("username", u).maybeSingle()).data;
    const has = !!(row && row.secret_hash);
    const h = await hashPass(a, has ? unb64(row.secret_salt) : new Uint8Array(16));
    if (!has || a.length < 2 || !same(h, row.secret_hash)) { await admin.rpc("login_fail", { p_user: u, p_ip: addr }); return fail("התשובה לא נכונה, או שלא הוגדרה שאלת שחזור לחשבון"); }
    await setPass(row.user_id, pw);
    return { ok: true, token: await token(row.user_id), user: u };
  }
  async function setSecret(uid, pass, q, answer) {
    const row = await userBy(uid), a = normAns(answer); q = Number(q);
    if (!await passOk(row, pass)) return fail("הסיסמה שגויה");
    if (!okQ(q) || a.length < 2) return fail("בחר שאלה וכתוב תשובה של 2 תווים לפחות");
    await admin.from("users").update(await secretCols(q, a)).eq("user_id", uid);
    return { ok: true };
  }
  async function chpass(uid, oldPass, newPass) {
    const row = await userBy(uid), pw = String(newPass == null ? "" : newPass);
    if (!await passOk(row, oldPass)) return fail("הסיסמה הנוכחית שגויה");
    if (pw.length < 8 || pw.length > 72) return fail("סיסמה: 8 עד 72 תווים");
    await setPass(uid, pw);
    return { ok: true, token: await token(uid), user: row.username };
  }
  async function delacct(uid, pass) {
    const row = await userBy(uid);
    if (!await passOk(row, pass)) return fail("הסיסמה שגויה");
    const r = await admin.rpc("account_delete", { p_user: uid });
    return r.error ? fail("המחיקה נכשלה") : { ok: true };
  }
  // An admin gives a player a one-time password after checking who they are some other way.
  async function adminReset(adminUid, user) {
    const ok = await admin.rpc("is_admin", { p_user: adminUid });
    if (ok.error || ok.data !== true) return fail("אין הרשאה");
    const row = (await admin.from("users").select("user_id").eq("username", norm(user).slice(0, 64)).maybeSingle()).data;
    if (!row) return fail("המשתמש לא נמצא");
    const temp = b64(crypto.getRandomValues(new Uint8Array(9)));
    await setPass(row.user_id, temp);
    return { ok: true, temp };
  }
  async function whoami(uid) {
    const row = (await admin.from("users").select("username,secret_q,is_admin").eq("user_id", uid).maybeSingle()).data;
    return row ? { ok: true, user: row.username, secret: row.secret_q != null, admin: !!row.is_admin } : fail("auth");
  }
  async function register(user, pass, ip, q, answer) {
    const u = norm(user), pw = String(pass == null ? "" : pass), a = normAns(answer); q = Number(q);
    if (!okQ(q) || a.length < 2) return fail("בחר שאלת שחזור וכתוב תשובה. בלעדיה אי אפשר לשחזר סיסמה");
    if (!USER_RE.test(u)) return fail("שם משתמש: 3 עד 16 תווים, אותיות, ספרות וקו תחתון");
    if (pw.length < 8 || pw.length > 72) return fail("סיסמה: 8 עד 72 תווים");
    const ex = await admin.from("users").select("username").eq("username", u).maybeSingle();
    if (ex.data) return fail("שם המשתמש תפוס");
    const okIp = await admin.rpc("signup_allowed", { p_ip: String(ip || "unknown").slice(0, 64) });
    if (okIp.error || okIp.data !== true) return fail("נוצרו יותר מדי חשבונות מהרשת הזו. נסה שוב בעוד שעה");
    const salt = crypto.getRandomValues(new Uint8Array(16)), uid = crypto.randomUUID();
    const ins = await admin.from("users").insert({ username: u, user_id: uid, pass_hash: await hashPass(pw, salt), salt: b64(salt), ...(await secretCols(q, a)) });
    if (ins.error) return fail("שם המשתמש תפוס");
    return { ok: true, token: await token(uid), user: u };
  }
  async function login(user, pass, ip) {
    const u = norm(user).slice(0, 64), pw = String(pass == null ? "" : pass).slice(0, 72), addr = String(ip || "unknown").slice(0, 64);
    const blk = await admin.rpc("login_blocked", { p_user: u, p_ip: addr });
    if (blk.error || blk.data === true) return fail("יותר מדי ניסיונות. נסה שוב בעוד רבע שעה");
    const row = (await admin.from("users").select("user_id,pass_hash,salt").eq("username", u).maybeSingle()).data;
    // Hash even when the user does not exist, so the answer takes the same time either way.
    const h = await hashPass(pw, row ? unb64(row.salt) : new Uint8Array(16));
    if (!row || !same(h, row.pass_hash)) { await admin.rpc("login_fail", { p_user: u, p_ip: addr }); return fail("שם משתמש או סיסמה שגויים"); }
    return { ok: true, token: await token(row.user_id), user: u };
  }
  return { register, login, verify, session, forgot, recover, setSecret, chpass, delacct, adminReset, whoami };
}

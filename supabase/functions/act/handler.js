// Request handling for the game, independent of the runtime so it can be tested with a stand-in database.
// `admin` is a Supabase service-role client; `G` is the shared rules module.
export function makeHandler(admin, G, rnd, clock = Date.now) {
  const plain = (o) => JSON.parse(JSON.stringify(o));
  const MARKET_MSG = {
    sold: "הפריט כבר נמכר", own: "זה פריט שלך", no_gold: "אין מספיק זהב", bag_full: "התיק מלא",
    limit: "אפשר להציע עד 8 פריטים", not_found: "הפריט לא בתיק", bad_price: "מחיר לא תקין", no_account: "אין חשבון",
    not_party: "אפשר למכור ישירות רק לחבר פארטי", in_party: "אתה כבר בפארטי", no_party: "לא נמצא פארטי עם הקוד הזה", full: "הפארטי מלא",
  };
  const MAX_CALLS_PER_MIN = 240;
  const ARENA_KINDS = new Set(["create", "sync", "travel", "tick", "reset", "duel", "switch", "equip", "unequip", "upgrade"]);

  async function market(uid) {
    const { data } = await admin.from("listings").select("id,seller,seller_name,buyer,item,price")
      .or(`buyer.is.null,buyer.eq.${uid},seller.eq.${uid}`).order("created_at", { ascending: false }).limit(200);
    return (data || []).map((l) => ({ id: String(l.id), sn: l.seller_name, mine: l.seller === uid, direct: !!l.buyer, it: l.item, price: Number(l.price) }));
  }
  async function board(uid) {
    const { data } = await admin.from("arena").select("user_id,snap").order("resets", { ascending: false }).limit(60);
    return (data || []).map((r) => G.cleanPlayer(r.user_id, r.snap));
  }
  async function saveArena(uid, A) {
    const S = A.chars[A.cur]; if (!S) return;
    const f = G.fighter(S); f.r = G.totalResets(A);
    const t = new Date(clock()).toISOString();
    await admin.from("arena").upsert({ user_id: uid, snap: f, resets: f.r, power: f.p, zone: S.zone, seen_at: t, updated_at: t });
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
    for (let attempt = 0; attempt < 4; attempt++) {
      const now = clock();
      const { data: row, error } = await admin.from("accounts").select("state,version,calls,calls_at").eq("user_id", uid).maybeSingle();
      if (error) throw error;

      if (!row) {
        if (kind !== "create") return { result: { ok: false, msg: "new" }, state: null };
        const okIp = await admin.rpc("signup_allowed", { p_ip: String(meta.ip || "unknown").slice(0, 64) });
        if (okIp.error || okIp.data !== true) return { result: { ok: false, msg: "נוצרו יותר מדי חשבונות מהרשת הזו. נסה שוב בעוד שעה" }, state: null };
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
      if (kind === "tick" && Number(args.z) >= 0) {
        const pb = await admin.rpc("party_bonus", { p_user: uid, p_zone: Math.floor(Number(args.z)) });
        ctx.partyN = pb.error ? 0 : Number(pb.data) || 0;
      }
      G.setEnv(rnd, () => now); // set right before the synchronous rules call; no await in between
      const r = G.apply(A, kind, args, ctx);
      if (!r.ok) { await bump(); return { result: r, state: row.state }; } // a refused action changes nothing

      const next = plain(A);
      const upd = await admin.from("accounts")
        .update({ state: next, version: row.version + 1, calls, calls_at: new Date(at).toISOString(), updated_at: new Date(now).toISOString() })
        .eq("user_id", uid).eq("version", row.version).select("version");
      if (upd.error) throw upd.error;
      if (!upd.data || !upd.data.length) continue; // another request saved first; redo on fresh state

      if (ARENA_KINDS.has(kind)) await saveArena(uid, A);
      if (kind === "tick" && r.claimed > r.kills + 5) {
        await admin.from("audit").insert({ user_id: uid, kind: "clamp", detail: { claimed: r.claimed, allowed: r.kills, z: args.z } });
      }
      const out = { result: r, state: next };
      if (players) out.players = players.map((p) => ({ n: p.n, r: p.r, l: p.l, me: p.id === uid }));
      return out;
    }
    return { result: { ok: false, msg: "עומס, נסה שוב" } };
  }
  return handle;
}

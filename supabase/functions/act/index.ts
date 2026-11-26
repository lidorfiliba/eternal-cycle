// The only door into the game. It identifies the caller by their session token, loads the stored
// account, runs the shared rules on it with server time and server randomness, and saves the result.
// Nothing the client sends is trusted beyond "which action" and its arguments.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import * as G from "./core.js";
import { makeAuth, makeHandler } from "./handler.js";

const ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "*";
const cors = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-ec-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const rnd = () => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] / 4294967296; };
const handle = makeHandler(admin, G, rnd);

const auth = makeAuth(admin, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  try {
    const text = await req.text();
    if (text.length > 4000) return json({ error: "too_large" }, 413);
    let body: any; try { body = JSON.parse(text); } catch { return json({ error: "bad_json" }, 400); }
    const kind = String(body && body.kind || "").slice(0, 20);
    const args = body && body.args && typeof body.args === "object" && !Array.isArray(body.args) ? body.args : {};
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim();
    if (kind === "register") return json(await auth.register(args.user, args.pass, ip, args.q, args.a));
    if (kind === "forgot") return json(await auth.forgot(args.user));
    if (kind === "recover") return json(await auth.recover(args.user, args.a, args.pass, ip));
    if (kind === "login") return json(await auth.login(args.user, args.pass, ip));
    const ses = await auth.session(req.headers.get("x-ec-token") || "");
    if (!ses) return json({ error: "auth" }, 401);
    const uid = ses.uid;
    if (kind === "whoami") return json(await auth.whoami(uid));
    if (kind === "setsecret") return json(await auth.setSecret(uid, args.pass, args.q, args.a));
    if (kind === "chpass") return json(await auth.chpass(uid, args.pass, args.next));
    if (kind === "delacct") return json(await auth.delacct(uid, args.pass));
    if (kind === "aresetpw") return json(await auth.adminReset(uid, args.user));
    const out = await handle(uid, kind, args, { ip, iat: ses.iat });
    if (out && out.expired) return json({ error: "auth" }, 401);
    return json(out);
  } catch (e) {
    console.error(e);
    return json({ error: "server" }, 500);
  }
});

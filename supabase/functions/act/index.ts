// The only door into the game. It authenticates the caller, loads their stored account,
// runs the shared rules on it with server time and server randomness, and saves the result.
// Nothing the client sends is trusted beyond "which action" and its arguments.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import * as G from "../_shared/core.js";
import { makeHandler } from "./handler.js";

const ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "*";
const cors = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const rnd = () => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] / 4294967296; };
const handle = makeHandler(admin, G, rnd);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  try {
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data, error } = await admin.auth.getUser(jwt);
    if (error || !data.user) return json({ error: "auth" }, 401);
    const text = await req.text();
    if (text.length > 4000) return json({ error: "too_large" }, 413);
    let body: any; try { body = JSON.parse(text); } catch { return json({ error: "bad_json" }, 400); }
    const kind = String(body && body.kind || "").slice(0, 20);
    const args = body && body.args && typeof body.args === "object" && !Array.isArray(body.args) ? body.args : {};
    return json(await handle(data.user.id, kind, args));
  } catch (e) {
    console.error(e);
    return json({ error: "server" }, 500);
  }
});

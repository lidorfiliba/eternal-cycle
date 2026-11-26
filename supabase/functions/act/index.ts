// The only door into the game. It identifies the caller by their secret account key, loads the stored
// account, runs the shared rules on it with server time and server randomness, and saves the result.
// Nothing the client sends is trusted beyond "which action" and its arguments.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import * as G from "./core.js";
import { makeHandler } from "./handler.js";

const ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "*";
const cors = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-ec-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const rnd = () => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] / 4294967296; };
const handle = makeHandler(admin, G, rnd);

// The account id is the first 128 bits of SHA-256(key), shaped as a UUID. Knowing an id does not reveal the key.
async function accountId(key: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key)));
  const h = Array.from(d.slice(0, 16), (b) => b.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  try {
    const key = req.headers.get("x-ec-key") || "";
    if (key.length < 40 || key.length > 128 || !/^[A-Za-z0-9_-]+$/.test(key)) return json({ error: "auth" }, 401);
    const text = await req.text();
    if (text.length > 4000) return json({ error: "too_large" }, 413);
    let body: any; try { body = JSON.parse(text); } catch { return json({ error: "bad_json" }, 400); }
    const kind = String(body && body.kind || "").slice(0, 20);
    const args = body && body.args && typeof body.args === "object" && !Array.isArray(body.args) ? body.args : {};
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim();
    return json(await handle(await accountId(key), kind, args, { ip }));
  } catch (e) {
    console.error(e);
    return json({ error: "server" }, 500);
  }
});

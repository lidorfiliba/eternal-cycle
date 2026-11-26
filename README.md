# מעגל הנצח (Eternal Cycle)

A Hebrew, mobile-first browser RPG: walk the maps, fight, beat bosses, collect ancient sets, reset at level 400 and come back stronger.

## Layout

- `web/` — the static client (no build step). `web/core.js` is the complete rule set.
- `supabase/functions/_shared/core.js` — the same rule file, byte for byte (`npm run sync` copies it; a test fails if they differ).
- `supabase/functions/act/` — the single server function. `handler.js` holds the logic, `index.ts` is the thin Deno entry.
- `supabase/migrations/` — tables, row-level security, market and party functions.
- `tests/` — `npm test` runs the rules, the SQL and the request handler against an in-process Postgres. `tests/browser_check.py` drives the real client in headless Chrome.

## Two modes

- **Local** (no Supabase configured): everything runs in the browser and is saved on the device. Unprotected, single player.
- **Online**: the server owns every account. The browser sends actions; the server runs the rules with its own clock and randomness and replies with the new state.

See `SETUP.md` (Hebrew) to go online and `SECURITY.md` for what is and is not protected.

## Development

```
npm install
npm test
python3 -m http.server -d web 8080
```

Art: LuizMelo (CC0). Sound credits: `CREDITS.md`.

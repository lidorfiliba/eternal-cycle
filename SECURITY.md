# Security model

## What the server guarantees

- **State cannot be edited from the browser.** All tables have row-level security with no policies, and table and function privileges are revoked from the `anon` and `authenticated` roles. Only the `act` function (service role) reads or writes.
- **Every change goes through `apply()`** in `core.js`, executed on the server against the stored account, with server time and cryptographic randomness. Loot, upgrade rolls, boxes and duels are decided there.
- **Kill claims are bounded.** A token bucket refills at the highest rate a real player can reach for that character in that map, capped at 40 kills. Claims above it are cut and written to `audit` (`suspects` view).
- **Bosses** must be spawned by the server (40 accepted kills) and cannot be reported dead before the character could have dealt the damage.
- **Maps** are gated by level, by beaten bosses, and reset maps by reset count.
- **Market** listing, buying and cancelling are single transactions with row locks; an item is sold once. Direct offers can only target a party member and only that member can buy.
- **Party bonus** is computed by the database from who was recently active in the same map; a value sent by the client is ignored.
- **Concurrency.** Accounts carry a version; a request that loses a race is redone on fresh state.
- **Rate limit:** 240 requests a minute per account. Request bodies over 4 KB are rejected.
- The service-role key exists only in the function's environment. The browser gets the project URL and the anon key, which grant nothing by themselves.

## What it does not stop

- **Bots that play at legitimate speed.** An automated client can claim the maximum allowed rate around the clock; it earns at most about twice what an attentive player does. The `suspects` view helps find them; banning is manual.
- **Multiple accounts.** Anonymous sign-in is free. Enable CAPTCHA for anonymous sign-ins in Supabase before opening the game widely.
- **Real-money trading between players** outside the game.
- **Local mode** is not protected at all, by design.

## Not verified here

The rules, the SQL and the request handler are tested against an in-process Postgres with a stand-in for the Supabase client. The deployed function, real authentication (anonymous and email link) and the GitHub Actions deployment have not been run against a live Supabase project.

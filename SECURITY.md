# Security model

## What the server guarantees

- **Accounts are username + password.** Passwords are stored only as salted PBKDF2-SHA256 hashes (300,000 rounds). Sign-in returns a session token signed with a server-side key (valid 90 days); the game account id comes from that token, never from the client. Ten wrong passwords for a name, or thirty from one address, lock sign-in for 15 minutes. New accounts are limited to 5 per network address per hour. Supabase Auth is not used.
- **Events run on the server clock.** Bonus XP, bonus drops, objectives and their rewards are decided from server time; a reward can be collected once per event window, the quiz allows one answer.
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
- **Multiple accounts.** Creating an account is free; the per-address limit slows mass creation but does not stop it.
- **The quiz answers** are in the shared rules file, so a determined player can look them up.
- **A forgotten password is a lost account.** There is no email on file, so no recovery. Sessions cannot be revoked one by one; changing the server key signs everyone out.
- **Real-money trading between players** outside the game.
- **Local mode** is not protected at all, by design.

## Not verified here

The rules, the SQL and the request handler are tested against an in-process Postgres with a stand-in for the Supabase client. The deployed function and the GitHub Actions deployment have not been run against a live Supabase project.

## Players, chat, guilds and moderation

- **Seeing each other.** The browser sends a heartbeat with the hero's position every 2.5 to 5 seconds and gets back who else stands on the same floor. Name, class, level and gear come from the snapshot the server keeps, never from the other player's browser; only the position is self-reported, and it affects nothing but the picture.
- **Chat.** Messages go through the server, which stamps the character name itself, strips control characters, caps length at 160, and paces each account (2 seconds apart, 12 a minute). The client only ever inserts chat text as escaped text.
- **Guilds and the siege.** Founding, joining, kicking and the weekly castle are SQL functions callable only by the server. Siege points come only from kills the server accepted.
- **Automatic suspensions.** A kill claim at least three times what the server allows, and at least 50 over, is recorded as blatant. Five within an hour suspend the account: a day, then a week, then for good. Smaller overshoots are only clamped and logged.
- **Password recovery.** There is no e-mail. A recovery question is chosen at sign-up and its answer is stored as a salted PBKDF2 hash. Wrong answers count against the same brake as wrong passwords. Changing or recovering a password invalidates sessions opened before it.
- **Admin screen** (`admin.html`). Every admin call is checked on the server against `users.is_admin`, which can only be set from the database: `update users set is_admin = true where username = '...'`.
- **Account deletion** is available to the player in-game and removes the login, the characters and the audit rows.

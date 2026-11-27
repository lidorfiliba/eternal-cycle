-- Two-step sign-in, for whoever wants it: a secret shared with an authenticator app, single-use backup codes (kept as
-- hashes), and the last time step used, so a code seen once cannot be used again.
alter table public.users
  add column if not exists tfa_secret text,
  add column if not exists tfa_on boolean not null default false,
  add column if not exists tfa_codes jsonb,
  add column if not exists tfa_step bigint not null default 0;

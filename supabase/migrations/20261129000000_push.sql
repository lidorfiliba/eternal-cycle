-- Where to send a phone notification when a character that was left training reaches the reset level.
-- One browser subscription per account. Only the game server (service role) reads or writes this table.
create table public.push_subs (
  user_id    uuid primary key,
  endpoint   text not null default '',
  p256dh     text not null default '',
  auth       text not null default '',
  lang       text not null default 'he',
  name       text not null default '',
  notify_at  timestamptz,
  created_at timestamptz not null default now()
);
alter table public.push_subs enable row level security;
create index push_subs_due on public.push_subs (notify_at) where notify_at is not null;
revoke all on public.push_subs from anon, authenticated;
grant all on public.push_subs to service_role;

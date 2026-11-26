-- Username + password accounts. Passwords are stored only as salted PBKDF2-SHA256 hashes.
create table public.users (
  username   text primary key,          -- normalised: NFKC, trimmed, lower case
  user_id    uuid not null unique,
  pass_hash  text not null,
  salt       text not null,
  created_at timestamptz not null default now()
);
create table public.login_fails (
  username text not null,
  ip       text not null,
  at       timestamptz not null default now()
);
create index login_fails_user_idx on public.login_fails (username, at desc);
create index login_fails_ip_idx   on public.login_fails (ip, at desc);

alter table public.users       enable row level security;
alter table public.login_fails enable row level security;
revoke all on public.users, public.login_fails from anon, authenticated;

-- Brute-force brake: 10 wrong passwords per username, or 30 per address, in 15 minutes.
create function public.login_blocked(p_user text, p_ip text) returns boolean
language sql stable set search_path = public as $$
  select (select count(*) from login_fails where username = p_user and at > now() - interval '15 minutes') >= 10
      or (select count(*) from login_fails where ip = p_ip and at > now() - interval '15 minutes') >= 30;
$$;
create function public.login_fail(p_user text, p_ip text) returns void
language plpgsql set search_path = public as $$
begin
  delete from login_fails where at < now() - interval '1 day';
  insert into login_fails (username, ip) values (left(p_user, 64), left(p_ip, 64));
end $$;
revoke execute on function public.login_blocked(text, text), public.login_fail(text, text) from public, anon, authenticated;
grant  execute on function public.login_blocked(text, text), public.login_fail(text, text) to service_role;

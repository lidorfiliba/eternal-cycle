-- A daily copy of everything that cannot be rebuilt: logins, accounts, guilds, parties, donations, settings.
-- Kept inside the same database for seven days. It protects against a bad update, a bug or a mistaken deletion,
-- and lets one account be put back. It does not protect against losing the whole project; that needs a copy elsewhere.
create table public.backups (
  day      date primary key,
  taken_at timestamptz not null default now(),
  accounts integer not null default 0,
  data     jsonb not null
);
alter table public.backups enable row level security;
revoke all on public.backups from anon, authenticated;

create function public.backup_run() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  select count(*) into n from accounts;
  insert into backups (day, accounts, data) values (current_date, n, jsonb_build_object(
      'accounts', (select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) from accounts a),
      'users', (select coalesce(jsonb_agg(to_jsonb(u)), '[]'::jsonb) from users u),
      'guilds', (select coalesce(jsonb_agg(to_jsonb(g)), '[]'::jsonb) from guilds g),
      'guild_members', (select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb) from guild_members m),
      'parties', (select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) from parties p),
      'party_members', (select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb) from party_members m),
      'orders', (select coalesce(jsonb_agg(to_jsonb(o)), '[]'::jsonb) from orders o),
      'castle', (select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) from castle c),
      'settings', (select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) from settings s)))
  on conflict (day) do update set taken_at = now(), accounts = excluded.accounts, data = excluded.data;
  delete from backups where day < current_date - 6;
  return n;
end $$;
-- Put one account's saved game back as it was on a given day. Logins, guilds and donations are not touched.
create function public.backup_restore_account(p_admin uuid, p_day date, p_username text) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid; st jsonb;
begin
  if not is_admin(p_admin) then raise exception 'forbidden'; end if;
  select user_id into uid from users where username = lower(btrim(coalesce(p_username, '')));
  if uid is null then raise exception 'not_found'; end if;
  select x->'state' into st from backups b, jsonb_array_elements(b.data->'accounts') x where b.day = p_day and (x->>'user_id')::uuid = uid;
  if st is null then raise exception 'not_found'; end if;
  update accounts set state = st, version = version + 1, updated_at = now() where user_id = uid;
  insert into audit (user_id, kind, detail) values (uid, 'admin', jsonb_build_object('action', 'restore', 'day', p_day, 'by', p_admin));
end $$;
create function public.admin_backups(p_admin uuid) returns jsonb
language plpgsql set search_path = public as $$
begin
  if not is_admin(p_admin) then raise exception 'forbidden'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('day', day, 'at', taken_at, 'accounts', accounts, 'kb', round(pg_column_size(data) / 1024.0)) order by day desc), '[]'::jsonb) from backups);
end $$;
revoke execute on function public.backup_run(), public.backup_restore_account(uuid, date, text), public.admin_backups(uuid) from public, anon, authenticated;
grant  execute on function public.backup_run(), public.backup_restore_account(uuid, date, text), public.admin_backups(uuid) to service_role;

-- Run it every night at 03:10 Israel time (01:10 UTC), where the scheduler extension exists, and once now.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    execute 'create extension if not exists pg_cron';
    execute $q$select cron.schedule('daily-backup', '10 1 * * *', 'select public.backup_run()')$q$;
  end if;
end $$;
select public.backup_run();

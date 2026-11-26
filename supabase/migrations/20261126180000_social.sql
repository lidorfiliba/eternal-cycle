-- Players seeing each other, chat, guilds with a weekly siege, account recovery, moderation.
-- Same rule as before: Row Level Security on, no policies, only the server function (service role) gets in.

alter table public.accounts add column banned_until timestamptz, add column ban_reason text,
  add column muted_until timestamptz, add column strikes integer not null default 0, add column pw_at timestamptz;
alter table public.users add column secret_q smallint, add column secret_hash text, add column secret_salt text,
  add column is_admin boolean not null default false;

-- Where a player stands right now. Identity and look come from the arena snapshot the server already keeps.
alter table public.arena add column floor integer not null default 0, add column x real not null default 110,
  add column face smallint not null default 1, add column act boolean not null default false, add column beat_at timestamptz;
create index arena_where_idx on public.arena (zone, floor, beat_at desc);

create table public.guilds (
  id         bigint generated always as identity primary key,
  name       text   not null,
  tag        text   not null,
  leader     uuid   not null references public.accounts(user_id) on delete cascade,
  notice     text   not null default '',
  points     bigint not null default 0,   -- lifetime kills by members, sets the guild level
  siege_pts  bigint not null default 0,   -- kills during the current weekly siege
  created_at timestamptz not null default now()
);
create unique index guilds_name_idx on public.guilds (lower(name));
create unique index guilds_tag_idx  on public.guilds (lower(tag));
create table public.guild_members (
  user_id   uuid   primary key references public.accounts(user_id) on delete cascade,
  guild_id  bigint not null references public.guilds(id) on delete cascade,
  contrib   bigint not null default 0,
  joined_at timestamptz not null default now()
);
create index guild_members_guild_idx on public.guild_members (guild_id);
create table public.castle (
  siege      text primary key,            -- key of the siege that was settled
  guild_id   bigint references public.guilds(id) on delete set null,
  pts        bigint not null default 0,
  at         timestamptz not null default now()
);

create table public.chat (
  id      bigint generated always as identity primary key,
  ch      text not null,                  -- 'w' for everyone, 'g<id>' for one guild
  user_id uuid,
  name    text not null,
  tag     text not null default '',
  msg     text not null check (char_length(msg) between 1 and 160),
  at      timestamptz not null default now()
);
create index chat_ch_idx on public.chat (ch, id desc);

alter table public.guilds        enable row level security;
alter table public.guild_members enable row level security;
alter table public.castle        enable row level security;
alter table public.chat          enable row level security;
revoke all on public.guilds, public.guild_members, public.castle, public.chat from anon, authenticated;

create function public.guild_level(p_points bigint) returns integer language sql immutable as $$
  select least(10, floor(sqrt(greatest(p_points, 0) / 2000.0))::int);
$$;
create function public.castle_holder() returns bigint language sql stable set search_path = public as $$
  select guild_id from castle order by at desc limit 1;
$$;
-- Close the siege identified by p_key once: the guild with the most siege kills takes the castle.
create function public.siege_settle(p_key text) returns void language plpgsql set search_path = public as $$
declare g record;
begin
  if p_key is null or p_key = '' or exists (select 1 from castle where siege = p_key) then return; end if;
  select id, siege_pts into g from guilds where siege_pts > 0 order by siege_pts desc, id limit 1;
  insert into castle (siege, guild_id, pts) values (p_key, g.id, coalesce(g.siege_pts, 0)) on conflict do nothing;
  if found then update guilds set siege_pts = 0 where siege_pts <> 0; end if;
end $$;

-- One call per heartbeat: store my position, return who else is on my floor and any new chat lines.
create function public.beat(p_user uuid, p_x real, p_face integer, p_act boolean, p_since bigint) returns jsonb
language plpgsql set search_path = public as $$
declare me record; gid bigint; ban timestamptz; peers jsonb; lines jsonb; online integer;
begin
  select banned_until into ban from accounts where user_id = p_user;
  if ban is not null and ban > now() then return jsonb_build_object('banned', true); end if;
  select zone, floor, beat_at into me from arena where user_id = p_user;
  if not found then return jsonb_build_object('peers', '[]'::jsonb, 'chat', '[]'::jsonb, 'online', 0); end if;
  if me.beat_at is not null and me.beat_at > now() - interval '800 milliseconds' then return jsonb_build_object('skip', true); end if;
  update arena set x = greatest(0, least(4000, coalesce(p_x, 110))), face = case when p_face < 0 then -1 else 1 end,
    act = coalesce(p_act, false), beat_at = now() where user_id = p_user;
  select guild_id into gid from guild_members where user_id = p_user;
  select coalesce(jsonb_agg(jsonb_build_object('k', left(md5(a.user_id::text || 'peer'), 10), 's', a.snap, 'x', a.x, 'f', a.face, 'a', a.act,
      'g', coalesce((select g.tag from guild_members m join guilds g on g.id = m.guild_id where m.user_id = a.user_id), ''))), '[]'::jsonb)
    into peers from (select * from arena where zone = me.zone and floor = me.floor and user_id <> p_user
      and beat_at > now() - interval '12 seconds' order by beat_at desc limit 20) a;
  select coalesce(jsonb_agg(jsonb_build_object('i', c.id, 'c', left(c.ch, 1), 'n', c.name, 'g', c.tag, 'm', c.msg, 'me', c.user_id = p_user) order by c.id), '[]'::jsonb)
    into lines from (select * from chat where id > coalesce(p_since, 0) and (ch = 'w' or ch = 'g' || coalesce(gid, 0)::text)
      order by id desc limit 30) c;
  select count(*) into online from arena where beat_at > now() - interval '30 seconds';
  return jsonb_build_object('peers', peers, 'chat', lines, 'online', online);
end $$;

create function public.chat_say(p_user uuid, p_guild boolean, p_msg text) returns bigint
language plpgsql set search_path = public as $$
declare a record; gid bigint; nm text; tg text := ''; txt text; new_id bigint;
begin
  select banned_until, muted_until into a from accounts where user_id = p_user;
  if not found then raise exception 'no_account'; end if;
  if a.muted_until is not null and a.muted_until > now() then raise exception 'muted'; end if;
  txt := btrim(regexp_replace(coalesce(p_msg, ''), '[[:cntrl:]]+', ' ', 'g'));
  if char_length(txt) < 1 then raise exception 'empty'; end if;
  txt := left(txt, 160);
  if exists (select 1 from chat where user_id = p_user and at > now() - interval '2 seconds') then raise exception 'slow'; end if;
  if (select count(*) from chat where user_id = p_user and at > now() - interval '1 minute') >= 12 then raise exception 'slow'; end if;
  select snap->>'n' into nm from arena where user_id = p_user;
  select g.id, g.tag into gid, tg from guild_members m join guilds g on g.id = m.guild_id where m.user_id = p_user;
  if p_guild and gid is null then raise exception 'no_guild'; end if;
  insert into chat (ch, user_id, name, tag, msg) values (case when p_guild then 'g' || gid::text else 'w' end, p_user, left(coalesce(nm, 'אלמוני'), 14), coalesce(tg, ''), txt)
    returning id into new_id;
  if new_id % 50 = 0 then delete from chat where at < now() - interval '2 days'; end if;
  return new_id;
end $$;

create function public.guild_create(p_user uuid, p_name text, p_tag text) returns bigint
language plpgsql set search_path = public as $$
declare nm text := btrim(coalesce(p_name, '')); tg text := btrim(coalesce(p_tag, '')); gid bigint;
begin
  if not exists (select 1 from accounts where user_id = p_user) then raise exception 'no_account'; end if;
  if exists (select 1 from guild_members where user_id = p_user) then raise exception 'in_guild'; end if;
  if nm !~ '^[[:alnum:] ]{3,14}$' or tg !~ '^[[:alnum:]]{2,4}$' then raise exception 'bad_name'; end if;
  begin
    insert into guilds (name, tag, leader) values (nm, tg, p_user) returning id into gid;
  exception when unique_violation then raise exception 'taken'; end;
  insert into guild_members (user_id, guild_id) values (p_user, gid);
  return gid;
end $$;
create function public.guild_join(p_user uuid, p_name text) returns bigint
language plpgsql set search_path = public as $$
declare gid bigint;
begin
  if not exists (select 1 from accounts where user_id = p_user) then raise exception 'no_account'; end if;
  if exists (select 1 from guild_members where user_id = p_user) then raise exception 'in_guild'; end if;
  select id into gid from guilds where lower(name) = lower(btrim(coalesce(p_name, ''))) for update;
  if gid is null then raise exception 'no_guild'; end if;
  if (select count(*) from guild_members where guild_id = gid) >= 20 then raise exception 'guild_full'; end if;
  insert into guild_members (user_id, guild_id) values (p_user, gid);
  return gid;
end $$;
-- Leaving hands the guild to the longest-standing member; the last one out closes it.
create function public.guild_leave(p_user uuid) returns void
language plpgsql set search_path = public as $$
declare gid bigint; heir uuid;
begin
  select guild_id into gid from guild_members where user_id = p_user;
  if gid is null then return; end if;
  perform 1 from guilds where id = gid for update;
  delete from guild_members where user_id = p_user;
  select user_id into heir from guild_members where guild_id = gid order by joined_at, user_id limit 1;
  if heir is null then delete from guilds where id = gid;
  else update guilds set leader = heir where id = gid and leader = p_user; end if;
end $$;
create function public.guild_kick(p_user uuid, p_pos integer) returns void
language plpgsql set search_path = public as $$
declare gid bigint; target uuid;
begin
  select id into gid from guilds where leader = p_user;
  if gid is null then raise exception 'not_leader'; end if;
  select user_id into target from guild_members where guild_id = gid order by joined_at, user_id offset greatest(p_pos, 0) limit 1;
  if target is null or target = p_user then raise exception 'not_found'; end if;
  delete from guild_members where user_id = target;
end $$;
create function public.guild_notice(p_user uuid, p_text text) returns void
language plpgsql set search_path = public as $$
begin
  update guilds set notice = left(btrim(regexp_replace(coalesce(p_text, ''), '[[:cntrl:]]+', ' ', 'g')), 120) where leader = p_user;
  if not found then raise exception 'not_leader'; end if;
end $$;
-- Called with every accepted batch of kills. Returns the member's guild level and whether the guild holds the castle.
create function public.guild_tick(p_user uuid, p_kills integer, p_siege boolean, p_key text) returns jsonb
language plpgsql set search_path = public as $$
declare gid bigint; pts bigint; k integer := greatest(0, least(coalesce(p_kills, 0), 500));
begin
  perform siege_settle(p_key);
  select guild_id into gid from guild_members where user_id = p_user;
  if gid is null then return jsonb_build_object('lvl', 0, 'castle', false); end if;
  if k > 0 then
    update guild_members set contrib = contrib + k where user_id = p_user;
    update guilds set points = points + k, siege_pts = siege_pts + case when p_siege then k else 0 end where id = gid;
  end if;
  select points into pts from guilds where id = gid;
  return jsonb_build_object('lvl', guild_level(pts), 'castle', coalesce(castle_holder() = gid, false));
end $$;
create function public.guild_info(p_user uuid, p_key text) returns jsonb
language plpgsql set search_path = public as $$
declare gid bigint; g record; mine jsonb := null; top jsonb; holder bigint; hold jsonb := null;
begin
  perform siege_settle(p_key);
  holder := castle_holder();
  select guild_id into gid from guild_members where user_id = p_user;
  if gid is not null then
    select * into g from guilds where id = gid;
    mine := jsonb_build_object('name', g.name, 'tag', g.tag, 'notice', g.notice, 'points', g.points, 'lvl', guild_level(g.points),
      'siege', g.siege_pts, 'leader', g.leader = p_user, 'castle', coalesce(holder = gid, false),
      'members', (select coalesce(jsonb_agg(jsonb_build_object('n', coalesce(a.snap->>'n', 'אלמוני'), 'l', coalesce((a.snap->>'l')::int, 1),
          'r', coalesce(a.resets, 0), 'k', m.contrib, 'on', a.beat_at is not null and a.beat_at > now() - interval '30 seconds',
          'me', m.user_id = p_user, 'ld', m.user_id = g.leader) order by m.joined_at, m.user_id), '[]'::jsonb)
        from guild_members m left join arena a on a.user_id = m.user_id where m.guild_id = gid));
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('name', t.name, 'tag', t.tag, 'lvl', guild_level(t.points), 'n', t.n, 'siege', t.siege_pts, 'castle', coalesce(t.id = holder, false))
      order by t.siege_pts desc, t.points desc), '[]'::jsonb)
    into top from (select gg.*, (select count(*) from guild_members m where m.guild_id = gg.id) n from guilds gg order by gg.siege_pts desc, gg.points desc limit 15) t;
  if holder is not null then select jsonb_build_object('name', name, 'tag', tag) into hold from guilds where id = holder; end if;
  return jsonb_build_object('mine', mine, 'top', top, 'holder', hold);
end $$;

-- Automatic handling of blatant forged kill claims: five within an hour suspends the account,
-- for a day the first time, a week the second, and for good the third.
create function public.cheat_strike(p_user uuid, p_detail jsonb) returns boolean
language plpgsql set search_path = public as $$
declare n integer; s integer;
begin
  insert into audit (user_id, kind, detail) values (p_user, 'blatant', p_detail);
  select count(*) into n from audit where user_id = p_user and kind = 'blatant' and at > now() - interval '1 hour'
    and at > coalesce((select max(at) from audit where user_id = p_user and kind = 'ban'), '-infinity');
  if n < 5 then return false; end if;
  update accounts set strikes = strikes + 1 where user_id = p_user returning strikes into s;
  update accounts set ban_reason = 'auto', banned_until = now() + case when s = 1 then interval '1 day' when s = 2 then interval '7 days' else interval '100 years' end
    where user_id = p_user;
  insert into audit (user_id, kind, detail) values (p_user, 'ban', jsonb_build_object('auto', true, 'strike', s));
  update arena set beat_at = null where user_id = p_user;
  return true;
end $$;

create function public.is_admin(p_user uuid) returns boolean language sql stable set search_path = public as $$
  select coalesce((select is_admin from users where user_id = p_user), false);
$$;
create function public.admin_view(p_user uuid) returns jsonb
language plpgsql set search_path = public as $$
begin
  if not is_admin(p_user) then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'users', (select count(*) from users),
    'online', (select count(*) from arena where beat_at > now() - interval '30 seconds'),
    'day', (select count(*) from accounts where updated_at > now() - interval '1 day'),
    'suspects', (select coalesce(jsonb_agg(x order by (x->>'c')::int desc), '[]'::jsonb) from (
        select jsonb_build_object('u', u.username, 'c', count(*), 'b', count(*) filter (where au.kind = 'blatant'), 'l', (ar.snap->>'l')::int, 'r', ar.resets,
          'ban', ac.banned_until, 's', ac.strikes) x
        from audit au join users u on u.user_id = au.user_id join accounts ac on ac.user_id = au.user_id left join arena ar on ar.user_id = au.user_id
        where au.kind in ('clamp', 'blatant') and au.at > now() - interval '1 day'
        group by u.username, ar.snap, ar.resets, ac.banned_until, ac.strikes order by count(*) desc limit 40) q),
    'banned', (select coalesce(jsonb_agg(jsonb_build_object('u', u.username, 'until', ac.banned_until, 'why', ac.ban_reason, 's', ac.strikes)), '[]'::jsonb)
        from accounts ac join users u on u.user_id = ac.user_id where ac.banned_until > now()),
    'muted', (select coalesce(jsonb_agg(jsonb_build_object('u', u.username, 'until', ac.muted_until)), '[]'::jsonb)
        from accounts ac join users u on u.user_id = ac.user_id where ac.muted_until > now()),
    'chat', (select coalesce(jsonb_agg(jsonb_build_object('i', c.id, 'u', coalesce(u.username, '?'), 'n', c.name, 'm', c.msg, 'c', left(c.ch, 1), 'at', c.at) order by c.id desc), '[]'::jsonb)
        from (select * from chat order by id desc limit 60) c left join users u on u.user_id = c.user_id));
end $$;
create function public.admin_act(p_user uuid, p_action text, p_target text, p_hours integer) returns void
language plpgsql set search_path = public as $$
declare t uuid; h interval := make_interval(hours => greatest(1, least(coalesce(p_hours, 24), 876000)));
begin
  if not is_admin(p_user) then raise exception 'forbidden'; end if;
  if p_action = 'delmsg' then delete from chat where id = p_target::bigint;
  else
    select user_id into t from users where username = lower(btrim(coalesce(p_target, '')));
    if t is null then raise exception 'not_found'; end if;
    if p_action = 'ban' then update accounts set banned_until = now() + h, ban_reason = 'admin' where user_id = t; update arena set beat_at = null where user_id = t;
    elsif p_action = 'unban' then update accounts set banned_until = null, ban_reason = null where user_id = t;
    elsif p_action = 'mute' then update accounts set muted_until = now() + h where user_id = t; delete from chat where user_id = t and at > now() - interval '1 hour';
    elsif p_action = 'unmute' then update accounts set muted_until = null where user_id = t;
    else raise exception 'bad_action'; end if;
  end if;
  insert into audit (user_id, kind, detail) values (p_user, 'admin', jsonb_build_object('action', p_action, 'target', p_target, 'hours', p_hours));
end $$;

-- Removing an account for good, at the player's request.
create function public.account_delete(p_user uuid) returns void
language plpgsql set search_path = public as $$
begin
  perform guild_leave(p_user);
  update chat set user_id = null, name = 'נמחק' where user_id = p_user;
  delete from audit where user_id = p_user;
  delete from accounts where user_id = p_user;
  delete from users where user_id = p_user;
end $$;

revoke execute on all functions in schema public from public, anon, authenticated;
grant  execute on all functions in schema public to service_role;

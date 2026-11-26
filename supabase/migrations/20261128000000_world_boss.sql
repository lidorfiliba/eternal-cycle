-- The world boss: one enemy for the whole server. Every player's kills during the event take from the same
-- health; when it ends, each player collects by the share of the damage that was theirs.
create table public.world_boss (
  key        text primary key,            -- the event opening, as the rules name it
  hp         numeric not null,
  max        numeric not null,
  killed_at  timestamptz,
  created_at timestamptz not null default now()
);
create table public.world_hits (
  key      text not null references public.world_boss(key) on delete cascade,
  user_id  uuid not null,
  name     text not null,
  dmg      numeric not null default 0,
  claimed  boolean not null default false,
  primary key (key, user_id)
);
alter table public.world_boss enable row level security;
alter table public.world_hits enable row level security;
revoke all on public.world_boss, public.world_hits from anon, authenticated;

-- Add this player's damage and return where the fight stands. The boss's health is set when the first blow lands,
-- from how many players are around, so a quiet server can still bring it down and a busy one has to work together.
create function public.world_hit(p_user uuid, p_key text, p_name text, p_dmg numeric, p_base numeric) returns jsonb
language plpgsql set search_path = public as $$
declare b record; n integer; mine numeric; tops jsonb; fighters integer;
begin
  select count(*) into n from arena where beat_at > now() - interval '3 minutes';
  insert into world_boss (key, hp, max) values (p_key, p_base * greatest(1, n), p_base * greatest(1, n)) on conflict (key) do nothing;
  select * into b from world_boss where key = p_key for update;
  if p_dmg > 0 and b.hp > 0 then
    update world_boss set hp = greatest(0, hp - p_dmg), killed_at = case when hp - p_dmg <= 0 then now() else null end where key = p_key returning * into b;
    insert into world_hits (key, user_id, name, dmg) values (p_key, p_user, left(coalesce(p_name, 'אלמוני'), 14), least(p_dmg, b.max))
      on conflict (key, user_id) do update set dmg = world_hits.dmg + excluded.dmg, name = excluded.name;
  end if;
  select dmg into mine from world_hits where key = p_key and user_id = p_user;
  select coalesce(jsonb_agg(jsonb_build_object('n', t.name, 'd', t.dmg) order by t.dmg desc), '[]'::jsonb), (select count(*) from world_hits where key = p_key)
    into tops, fighters from (select name, dmg from world_hits where key = p_key order by dmg desc limit 5) t;
  if (select count(*) from world_boss) > 40 then delete from world_boss where created_at < now() - interval '3 days'; end if;
  return jsonb_build_object('key', p_key, 'hp', b.hp, 'max', b.max, 'mine', coalesce(mine, 0), 'top', tops, 'n', fighters, 'dead', b.killed_at is not null);
end $$;

-- Collect once: returns this player's share and place, and whether the boss fell.
create function public.world_claim(p_user uuid, p_key text) returns jsonb
language plpgsql set search_path = public as $$
declare b record; h record; total numeric; place integer;
begin
  select * into b from world_boss where key = p_key;
  if not found then raise exception 'none'; end if;
  select * into h from world_hits where key = p_key and user_id = p_user for update;
  if not found or h.dmg <= 0 then raise exception 'none'; end if;
  if h.claimed then raise exception 'claimed'; end if;
  update world_hits set claimed = true where key = p_key and user_id = p_user;
  select sum(dmg) into total from world_hits where key = p_key;
  select count(*) + 1 into place from world_hits where key = p_key and dmg > h.dmg;
  return jsonb_build_object('share', h.dmg / greatest(1, total), 'rank', place, 'killed', b.killed_at is not null);
end $$;

revoke execute on function public.world_hit(uuid, text, text, numeric, numeric), public.world_claim(uuid, text) from public, anon, authenticated;
grant  execute on function public.world_hit(uuid, text, text, numeric, numeric), public.world_claim(uuid, text) to service_role;

-- Party experience sharing: kills by one member hand experience to the other members fighting on the same map,
-- so a strong player can train a new one. The share waits here until the receiving player's next request.
create table public.party_share (
  user_id uuid primary key references public.accounts(user_id) on delete cascade,
  xp      bigint not null default 0
);
alter table public.party_share enable row level security;
revoke all on public.party_share from anon, authenticated;

-- Credit p_xp to every other active party member on the map. Returns how many received it.
create function public.party_share_add(p_user uuid, p_zone integer, p_xp bigint) returns integer
language plpgsql set search_path = public as $$
declare n integer;
begin
  if p_xp is null or p_xp <= 0 or p_zone < 0 then return 0; end if;
  insert into party_share (user_id, xp)
    select o.user_id, least(p_xp, 20000000) from party_members me
      join party_members o on o.party_id = me.party_id and o.user_id <> me.user_id
      join arena a on a.user_id = o.user_id
    where me.user_id = p_user and a.zone = p_zone and a.seen_at > now() - interval '2 minutes'
  on conflict (user_id) do update set xp = least(party_share.xp + excluded.xp, 50000000);
  get diagnostics n = row_count;
  return n;
end $$;
-- Take what is waiting for a player (and empty it). p_back returns an amount that could not be used.
create function public.party_share_take(p_user uuid) returns bigint
language plpgsql set search_path = public as $$
declare v bigint;
begin
  update party_share set xp = 0 where user_id = p_user and xp > 0 returning (select xp from party_share where user_id = p_user) into v;
  return coalesce(v, 0);
end $$;
create function public.party_share_back(p_user uuid, p_xp bigint) returns void
language sql set search_path = public as $$
  insert into party_share (user_id, xp) values (p_user, greatest(p_xp, 0)) on conflict (user_id) do update set xp = party_share.xp + excluded.xp;
$$;
revoke execute on function public.party_share_add(uuid, integer, bigint), public.party_share_take(uuid), public.party_share_back(uuid, bigint) from public, anon, authenticated;
grant  execute on function public.party_share_add(uuid, integer, bigint), public.party_share_take(uuid), public.party_share_back(uuid, bigint) to service_role;

-- Shared party experience shrinks with the level gap between the one who killed and the one who receives:
-- full within 15 levels, falling to 15% at a gap of 100 or more.
drop function public.party_share_add(uuid, integer, bigint);
create function public.party_share_add(p_user uuid, p_zone integer, p_xp bigint, p_lvl integer) returns integer
language plpgsql set search_path = public as $$
declare n integer;
begin
  if p_xp is null or p_xp <= 0 or p_zone < 0 then return 0; end if;
  insert into party_share (user_id, xp)
    select o.user_id, greatest(1, round(least(p_xp, 20000000) *
        greatest(0.15, least(1.0, 1.0 - (abs(coalesce((a.snap->>'l')::int, 1) - coalesce(p_lvl, 1)) - 15) / 100.0)))::bigint)
    from party_members me
      join party_members o on o.party_id = me.party_id and o.user_id <> me.user_id
      join arena a on a.user_id = o.user_id
    where me.user_id = p_user and a.zone = p_zone and a.seen_at > now() - interval '2 minutes'
  on conflict (user_id) do update set xp = least(party_share.xp + excluded.xp, 50000000);
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.party_share_add(uuid, integer, bigint, integer) from public, anon, authenticated;
grant  execute on function public.party_share_add(uuid, integer, bigint, integer) to service_role;

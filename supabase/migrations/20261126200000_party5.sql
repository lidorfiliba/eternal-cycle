-- Parties of up to five, and the classes of the members fighting beside the caller (for party buffs).
create or replace function public.party_join(p_user uuid, p_code text) returns void
language plpgsql set search_path = public as $$
declare pid bigint; n integer;
begin
  if not exists (select 1 from accounts where user_id = p_user) then raise exception 'no_account'; end if;
  if exists (select 1 from party_members where user_id = p_user) then raise exception 'in_party'; end if;
  select id into pid from parties where code = upper(trim(coalesce(p_code, ''))) for update;
  if pid is null then raise exception 'no_party'; end if;
  select count(*) into n from party_members where party_id = pid;
  if n >= 5 then raise exception 'full'; end if;
  insert into party_members (user_id, party_id) values (p_user, pid);
end $$;
-- Classes of the other party members who are active on the given map, one entry per member.
create function public.party_mates(p_user uuid, p_zone integer) returns jsonb
language sql stable set search_path = public as $$
  select coalesce(jsonb_agg(coalesce(a.snap->>'c', 'blade')), '[]'::jsonb) from party_members me
    join party_members o on o.party_id = me.party_id and o.user_id <> me.user_id
    join arena a on a.user_id = o.user_id
  where me.user_id = p_user and p_zone >= 0 and a.zone = p_zone and a.seen_at > now() - interval '2 minutes';
$$;
alter function public.guild_level(bigint) set search_path = public;
revoke execute on function public.party_mates(uuid, integer) from public, anon, authenticated;
grant  execute on function public.party_mates(uuid, integer) to service_role;

-- The party's list also says which floor of the map each member is on, so a member who follows another arrives beside him.
create or replace function public.party_info(p_user uuid) returns jsonb
language sql stable set search_path = public as $$
  select jsonb_build_object('code', p.code, 'leader', p.leader, 'members', (
      select jsonb_agg(jsonb_build_object('id', m.user_id, 'snap', a.snap, 'zone', coalesce(a.zone, -1), 'floor', coalesce(a.floor, 0),
               'active', coalesce(a.seen_at > now() - interval '2 minutes', false)) order by m.joined_at)
      from party_members m left join arena a on a.user_id = m.user_id where m.party_id = p.id))
  from party_members me join parties p on p.id = me.party_id where me.user_id = p_user;
$$;

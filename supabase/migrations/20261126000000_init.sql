-- Eternal Cycle: all game state lives here and only the server function may touch it.
-- Row Level Security is on with no policies, so browser clients (anon / authenticated)
-- cannot read or write any of these tables directly. The edge function uses the service role.

create table public.accounts (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  state      jsonb       not null,
  version    bigint      not null default 1,
  calls      integer     not null default 0,
  calls_at   timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.arena (
  user_id    uuid primary key references public.accounts(user_id) on delete cascade,
  snap       jsonb   not null,
  resets     integer not null default 0,
  power      bigint  not null default 0,
  zone       integer not null default -1,
  seen_at    timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index arena_resets_idx on public.arena (resets desc);

create table public.listings (
  id          bigint generated always as identity primary key,
  seller      uuid   not null references public.accounts(user_id) on delete cascade,
  seller_name text   not null,
  buyer       uuid   references public.accounts(user_id) on delete cascade, -- set for a direct sale to one party member
  item        jsonb  not null,
  price       bigint not null check (price between 1 and 1000000000),
  created_at  timestamptz not null default now()
);
create index listings_seller_idx on public.listings (seller);

create table public.audit (
  id      bigint generated always as identity primary key,
  user_id uuid,
  kind    text not null,
  detail  jsonb,
  at      timestamptz not null default now()
);
create index audit_user_idx on public.audit (user_id, at desc);

create table public.parties (
  id         bigint generated always as identity primary key,
  code       text   not null unique,
  leader     uuid   not null references public.accounts(user_id) on delete cascade,
  created_at timestamptz not null default now()
);
create table public.party_members (
  user_id   uuid   primary key references public.accounts(user_id) on delete cascade,
  party_id  bigint not null references public.parties(id) on delete cascade,
  joined_at timestamptz not null default now()
);
create index party_members_party_idx on public.party_members (party_id);

alter table public.parties       enable row level security;
alter table public.party_members enable row level security;
revoke all on public.parties, public.party_members from anon, authenticated;
alter table public.accounts enable row level security;
alter table public.arena    enable row level security;
alter table public.listings enable row level security;
alter table public.audit    enable row level security;
revoke all on public.accounts, public.arena, public.listings, public.audit from anon, authenticated;

-- Market operations are single transactions with row locks, so an item can be sold exactly once.

create function public.market_list(p_user uuid, p_item_id bigint, p_price bigint, p_to uuid default null) returns void
language plpgsql set search_path = public as $$
declare st jsonb; it jsonb; rest jsonb; cnt integer;
begin
  if p_price is null or p_price < 1 or p_price > 1000000000 then raise exception 'bad_price'; end if;
  if p_to is not null and (p_to = p_user or not exists (
       select 1 from party_members a join party_members b on a.party_id = b.party_id
       where a.user_id = p_user and b.user_id = p_to)) then raise exception 'not_party'; end if;
  select state into st from accounts where user_id = p_user for update;
  if st is null then raise exception 'no_account'; end if;
  select count(*) into cnt from listings where seller = p_user;
  if cnt >= 8 then raise exception 'limit'; end if;
  select e into it from jsonb_array_elements(coalesce(st->'inv', '[]'::jsonb)) e
    where (e->>'id')::bigint = p_item_id limit 1;
  if it is null then raise exception 'not_found'; end if;
  select coalesce(jsonb_agg(e), '[]'::jsonb) into rest from jsonb_array_elements(st->'inv') e
    where (e->>'id')::bigint <> p_item_id;
  update accounts set state = jsonb_set(st, '{inv}', rest), version = version + 1, updated_at = now()
    where user_id = p_user;
  insert into listings (seller, seller_name, buyer, item, price)
    values (p_user, left(coalesce(st->'chars'->((st->>'cur')::int)->>'name', ''), 14), p_to, it - 'id', p_price);
end $$;

create function public.market_buy(p_user uuid, p_listing bigint) returns void
language plpgsql set search_path = public as $$
declare l listings%rowtype; bst jsonb; gold numeric; nid bigint; pay bigint;
begin
  select * into l from listings where id = p_listing for update;
  if not found then raise exception 'sold'; end if;
  if l.seller = p_user then raise exception 'own'; end if;
  if l.buyer is not null and l.buyer <> p_user then raise exception 'sold'; end if;
  perform 1 from accounts where user_id in (p_user, l.seller) order by user_id for update;
  select state into bst from accounts where user_id = p_user;
  if bst is null then raise exception 'no_account'; end if;
  gold := (bst->>'gold')::numeric;
  if gold < l.price then raise exception 'no_gold'; end if;
  if jsonb_array_length(coalesce(bst->'inv', '[]'::jsonb)) >= 30 then raise exception 'bag_full'; end if;
  nid := (bst->>'nid')::bigint;
  bst := jsonb_set(bst, '{gold}', to_jsonb(gold - l.price));
  bst := jsonb_set(bst, '{nid}', to_jsonb(nid + 1));
  bst := jsonb_set(bst, '{inv}', coalesce(bst->'inv', '[]'::jsonb) || jsonb_build_array(l.item || jsonb_build_object('id', nid)));
  update accounts set state = bst, version = version + 1, updated_at = now() where user_id = p_user;
  pay := floor(l.price * 0.95);
  update accounts set state = jsonb_set(state, '{gold}', to_jsonb((state->>'gold')::numeric + pay)),
    version = version + 1, updated_at = now() where user_id = l.seller;
  delete from listings where id = p_listing;
  insert into audit (user_id, kind, detail)
    values (p_user, 'market_buy', jsonb_build_object('listing', p_listing, 'seller', l.seller, 'price', l.price, 'item', l.item));
end $$;

create function public.market_cancel(p_user uuid, p_listing bigint) returns void
language plpgsql set search_path = public as $$
declare l listings%rowtype; st jsonb; nid bigint;
begin
  select * into l from listings where id = p_listing for update;
  if not found or l.seller <> p_user then raise exception 'sold'; end if;
  select state into st from accounts where user_id = p_user for update;
  if jsonb_array_length(coalesce(st->'inv', '[]'::jsonb)) >= 30 then raise exception 'bag_full'; end if;
  nid := (st->>'nid')::bigint;
  st := jsonb_set(st, '{nid}', to_jsonb(nid + 1));
  st := jsonb_set(st, '{inv}', coalesce(st->'inv', '[]'::jsonb) || jsonb_build_array(l.item || jsonb_build_object('id', nid)));
  update accounts set state = st, version = version + 1, updated_at = now() where user_id = p_user;
  delete from listings where id = p_listing;
end $$;

-- Functions are executable by PUBLIC by default; without this any signed-in client could call them for any user.
revoke execute on function public.market_list(uuid, bigint, bigint, uuid) from public, anon, authenticated;
revoke execute on function public.market_buy(uuid, bigint)           from public, anon, authenticated;
revoke execute on function public.market_cancel(uuid, bigint)        from public, anon, authenticated;
grant  execute on function public.market_list(uuid, bigint, bigint, uuid) to service_role;
grant  execute on function public.market_buy(uuid, bigint)           to service_role;
grant  execute on function public.market_cancel(uuid, bigint)        to service_role;

-- Parties: up to 4 players. Members who are active in the same map give each other bonus XP.

create function public.party_create(p_user uuid) returns text
language plpgsql set search_path = public as $$
declare c text; pid bigint;
begin
  if not exists (select 1 from accounts where user_id = p_user) then raise exception 'no_account'; end if;
  if exists (select 1 from party_members where user_id = p_user) then raise exception 'in_party'; end if;
  loop
    c := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    exit when not exists (select 1 from parties where code = c);
  end loop;
  insert into parties (code, leader) values (c, p_user) returning id into pid;
  insert into party_members (user_id, party_id) values (p_user, pid);
  return c;
end $$;

create function public.party_join(p_user uuid, p_code text) returns void
language plpgsql set search_path = public as $$
declare pid bigint; n integer;
begin
  if not exists (select 1 from accounts where user_id = p_user) then raise exception 'no_account'; end if;
  if exists (select 1 from party_members where user_id = p_user) then raise exception 'in_party'; end if;
  select id into pid from parties where code = upper(trim(coalesce(p_code, ''))) for update;
  if pid is null then raise exception 'no_party'; end if;
  select count(*) into n from party_members where party_id = pid;
  if n >= 4 then raise exception 'full'; end if;
  insert into party_members (user_id, party_id) values (p_user, pid);
end $$;

create function public.party_leave(p_user uuid) returns void
language plpgsql set search_path = public as $$
declare pid bigint; nxt uuid;
begin
  select party_id into pid from party_members where user_id = p_user;
  if pid is null then return; end if;
  perform 1 from parties where id = pid for update;
  delete from party_members where user_id = p_user;
  select user_id into nxt from party_members where party_id = pid order by joined_at limit 1;
  if nxt is null then delete from parties where id = pid;
  else update parties set leader = nxt where id = pid and leader = p_user; end if;
end $$;

-- Number of OTHER party members who were active in the same map during the last two minutes.
create function public.party_bonus(p_user uuid, p_zone integer) returns integer
language sql stable set search_path = public as $$
  select count(*)::int from party_members me
    join party_members o on o.party_id = me.party_id and o.user_id <> me.user_id
    join arena a on a.user_id = o.user_id
  where me.user_id = p_user and p_zone >= 0 and a.zone = p_zone and a.seen_at > now() - interval '2 minutes';
$$;

-- The caller's party as JSON, or null. Member ids are included for the server only; it strips them before replying.
create function public.party_info(p_user uuid) returns jsonb
language sql stable set search_path = public as $$
  select jsonb_build_object('code', p.code, 'leader', p.leader, 'members', (
      select jsonb_agg(jsonb_build_object('id', m.user_id, 'snap', a.snap, 'zone', coalesce(a.zone, -1),
               'active', coalesce(a.seen_at > now() - interval '2 minutes', false)) order by m.joined_at)
      from party_members m left join arena a on a.user_id = m.user_id where m.party_id = p.id))
  from party_members me join parties p on p.id = me.party_id where me.user_id = p_user;
$$;

revoke execute on function public.party_create(uuid), public.party_join(uuid, text), public.party_leave(uuid),
  public.party_bonus(uuid, integer), public.party_info(uuid) from public, anon, authenticated;
grant execute on function public.party_create(uuid), public.party_join(uuid, text), public.party_leave(uuid),
  public.party_bonus(uuid, integer), public.party_info(uuid) to service_role;

-- Accounts whose kill claims the server had to cut down, most suspicious first.
create view public.suspects with (security_invoker = true) as
  select user_id, count(*) as clamps, max(at) as last_at
  from public.audit where kind = 'clamp' group by user_id order by clamps desc;
revoke all on public.suspects from anon, authenticated;

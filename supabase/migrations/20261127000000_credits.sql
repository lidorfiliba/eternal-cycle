-- Paid credits. A player asks for a pack and pays outside the game (bank app, payment link); an admin confirms the
-- payment and only then are the credits added. Nothing here talks to a payment company; when one is connected,
-- its confirmed-payment message calls order_decide instead of a person.
create table public.orders (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.accounts(user_id) on delete cascade,
  pack       text not null,
  credits    integer not null check (credits between 1 and 1000000),
  price_ils  integer not null check (price_ils between 1 and 100000),
  ref        text not null default '',          -- what the player wrote so the payment can be matched
  status     text not null default 'pending' check (status in ('pending', 'paid', 'rejected', 'cancelled')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid
);
create index orders_user_idx on public.orders (user_id, created_at desc);
create index orders_status_idx on public.orders (status, created_at);
create table public.settings (key text primary key, value text not null default '');
alter table public.orders   enable row level security;
alter table public.settings enable row level security;
revoke all on public.orders, public.settings from anon, authenticated;

create function public.order_create(p_user uuid, p_pack text, p_credits integer, p_price integer, p_ref text) returns bigint
language plpgsql set search_path = public as $$
declare new_id bigint;
begin
  if not exists (select 1 from accounts where user_id = p_user) then raise exception 'no_account'; end if;
  if coalesce((select value from settings where key = 'pay_info'), '') = '' then raise exception 'shop_closed'; end if;
  if exists (select 1 from orders where user_id = p_user and status = 'pending') then raise exception 'order_pending'; end if;
  if (select count(*) from orders where user_id = p_user and created_at > now() - interval '1 day') >= 5 then raise exception 'order_limit'; end if;
  insert into orders (user_id, pack, credits, price_ils, ref)
    values (p_user, left(p_pack, 12), p_credits, p_price, left(btrim(regexp_replace(coalesce(p_ref, ''), '[[:cntrl:]]+', ' ', 'g')), 60))
    returning id into new_id;
  return new_id;
end $$;
create function public.order_cancel(p_user uuid, p_id bigint) returns void
language plpgsql set search_path = public as $$
begin
  update orders set status = 'cancelled', decided_at = now() where id = p_id and user_id = p_user and status = 'pending';
  if not found then raise exception 'order_done'; end if;
end $$;
create function public.orders_mine(p_user uuid) returns jsonb
language sql stable set search_path = public as $$
  select jsonb_build_object('pay', coalesce((select value from settings where key = 'pay_info'), ''),
    'orders', (select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'credits', o.credits, 'price', o.price_ils, 'status', o.status, 'at', o.created_at) order by o.id desc), '[]'::jsonb)
      from (select * from orders where user_id = p_user order by id desc limit 8) o));
$$;
-- Confirm or reject an order. Confirming adds the credits to the account in the same transaction, exactly once.
create function public.order_decide(p_admin uuid, p_id bigint, p_ok boolean) returns void
language plpgsql set search_path = public as $$
declare o record;
begin
  if not is_admin(p_admin) then raise exception 'forbidden'; end if;
  select * into o from orders where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  if o.status <> 'pending' then raise exception 'order_done'; end if;
  if p_ok then
    update accounts set state = jsonb_set(state, '{prem}', to_jsonb(coalesce((state->>'prem')::bigint, 0) + o.credits)), version = version + 1 where user_id = o.user_id;
    if not found then raise exception 'no_account'; end if;
  end if;
  update orders set status = case when p_ok then 'paid' else 'rejected' end, decided_at = now(), decided_by = p_admin where id = p_id;
  insert into audit (user_id, kind, detail) values (o.user_id, 'order', jsonb_build_object('id', p_id, 'paid', p_ok, 'credits', o.credits, 'price', o.price_ils, 'by', p_admin));
end $$;
create function public.admin_orders(p_admin uuid) returns jsonb
language plpgsql set search_path = public as $$
begin
  if not is_admin(p_admin) then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'pay', coalesce((select value from settings where key = 'pay_info'), ''),
    'paid_total', (select coalesce(sum(price_ils), 0) from orders where status = 'paid'),
    'paid_count', (select count(*) from orders where status = 'paid'),
    'pending', (select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'u', coalesce(u.username, '?'), 'n', coalesce(a.snap->>'n', ''), 'credits', o.credits, 'price', o.price_ils, 'ref', o.ref, 'at', o.created_at) order by o.id), '[]'::jsonb)
      from orders o left join users u on u.user_id = o.user_id left join arena a on a.user_id = o.user_id where o.status = 'pending'),
    'recent', (select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'u', coalesce(u.username, '?'), 'credits', o.credits, 'price', o.price_ils, 'status', o.status, 'at', o.decided_at) order by o.decided_at desc), '[]'::jsonb)
      from (select * from orders where status in ('paid', 'rejected') order by decided_at desc limit 20) o left join users u on u.user_id = o.user_id));
end $$;
create function public.admin_setting(p_admin uuid, p_key text, p_value text) returns void
language plpgsql set search_path = public as $$
begin
  if not is_admin(p_admin) then raise exception 'forbidden'; end if;
  if p_key not in ('pay_info') then raise exception 'bad_action'; end if;
  insert into settings (key, value) values (p_key, left(coalesce(p_value, ''), 600)) on conflict (key) do update set value = excluded.value;
  insert into audit (user_id, kind, detail) values (p_admin, 'admin', jsonb_build_object('action', 'setting', 'key', p_key));
end $$;
revoke execute on function public.order_create(uuid, text, integer, integer, text), public.order_cancel(uuid, bigint), public.orders_mine(uuid),
  public.order_decide(uuid, bigint, boolean), public.admin_orders(uuid), public.admin_setting(uuid, text, text) from public, anon, authenticated;
grant execute on function public.order_create(uuid, text, integer, integer, text), public.order_cancel(uuid, bigint), public.orders_mine(uuid),
  public.order_decide(uuid, bigint, boolean), public.admin_orders(uuid), public.admin_setting(uuid, text, text) to service_role;

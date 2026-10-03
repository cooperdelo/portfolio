-- Shop + gated guides (QA). NOT APPLIED YET: until it is, email unlocks still work but emails are not saved.
-- shop_leads: one row per email per kit, written only by /api/kit (service role). Full admin reads.
-- shop_orders: one row per paid Stripe Checkout session, for the admin. Written by the server only.
create table if not exists public.shop_leads (
  id        bigint generated always as identity primary key,
  email     text not null check (length(email) <= 254),
  kit       text not null check (kit ~ '^[a-z0-9-]{2,40}$'),
  source    text not null default '' check (length(source) <= 40),
  created_at timestamptz not null default now(),
  unique (email, kit)
);
create table if not exists public.shop_orders (
  id            bigint generated always as identity primary key,
  stripe_session text not null unique,
  kit           text not null,
  email         text,
  amount_total  integer,
  amount_tax    integer,
  currency      text,
  promo_code    text,
  created_at    timestamptz not null default now()
);
alter table public.shop_leads enable row level security;
alter table public.shop_orders enable row level security;
drop policy if exists shop_leads_full_read on public.shop_leads;
create policy shop_leads_full_read on public.shop_leads for select to authenticated using (public.is_full_admin());
drop policy if exists shop_orders_full_read on public.shop_orders;
create policy shop_orders_full_read on public.shop_orders for select to authenticated using (public.is_full_admin());
revoke all on public.shop_leads, public.shop_orders from anon;
-- limited_role_boundary only loops over tables that existed when it ran; re-apply it to these two.
drop policy if exists limited_role_boundary on public.shop_leads;
create policy limited_role_boundary on public.shop_leads as restrictive for all to authenticated using (coalesce(public.current_admin_role(), '') not in ('acquisition','band'));
drop policy if exists limited_role_boundary on public.shop_orders;
create policy limited_role_boundary on public.shop_orders as restrictive for all to authenticated using (coalesce(public.current_admin_role(), '') not in ('acquisition','band'));

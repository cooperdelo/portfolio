-- Messages from the contact popup on cooperdelo.com. NOT APPLIED YET.
-- Written only by /api/contact (service role). Full admin reads. Until this exists the popup falls back to
-- "copy my email" and a Gmail link, never the visitor's default mail app.
create table if not exists public.site_messages (
  id         bigint generated always as identity primary key,
  at         timestamptz not null default now(),
  kind       text not null check (length(kind) <= 40),
  name       text not null check (length(name) <= 80),
  reply      text not null check (length(reply) <= 120),
  message    text not null check (length(message) <= 2000),
  page       text not null default '' check (length(page) <= 200),
  handled_at timestamptz
);
alter table public.site_messages enable row level security;
drop policy if exists site_messages_full on public.site_messages;
create policy site_messages_full on public.site_messages for all to authenticated using (public.is_full_admin()) with check (public.is_full_admin());
revoke all on public.site_messages from anon;
drop policy if exists limited_role_boundary on public.site_messages;
create policy limited_role_boundary on public.site_messages as restrictive for all to authenticated using (coalesce(public.current_admin_role(), '') not in ('acquisition','band'));

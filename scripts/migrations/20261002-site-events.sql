-- First-party portfolio analytics: what visitors do on cooperdelo.com.
-- NOT APPLIED YET. Until it is, /api/track accepts events and drops them (202).
--
-- Privacy: no cookies, no IP address, no user agent string. `session` is a random id the page keeps
-- in sessionStorage for one tab visit. Visitors with Do Not Track or Global Privacy Control send nothing.
-- Writes come only from /api/track (service role, whitelisted event names). Reads: full admin only.

create table if not exists public.site_events (
  id        bigint generated always as identity primary key,
  at        timestamptz not null default now(),
  session   text not null check (session ~ '^[a-z0-9]{8,32}$'),
  name      text not null check (name in ('page_view','record_pull','record_open','preview_play','motion_beat','showcase_view','brief_drafted','planner_started','planner_download','cta_click','resource_open','gate_view','email_submit','checkout_start','kit_unlock')),
  path      text not null default '' check (length(path) <= 200),
  props     jsonb not null default '{}'::jsonb,
  referrer  text not null default '' check (length(referrer) <= 120),
  source    text not null default '' check (length(source) <= 80),
  device    text not null default '' check (device in ('','phone','tablet','desktop'))
);
create index if not exists site_events_at on public.site_events (at desc);
create index if not exists site_events_session on public.site_events (session);

alter table public.site_events enable row level security;
drop policy if exists site_events_full_read on public.site_events;
create policy site_events_full_read on public.site_events for select to authenticated using (public.is_full_admin());
revoke all on public.site_events from anon;

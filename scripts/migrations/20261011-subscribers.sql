-- One email list for every free giveaway on cooperdelo.com: the /clock (source 'clock') and the guide gates
-- (source 'guide', kit = guide slug). Written only by /api/subscribe and /api/kit through subscribe_signup(),
-- which runs as the service role. Full admin reads (/admin/signups). shop_leads stays as it was (history).
-- Additive: no existing table is changed.
create table if not exists public.subscribers (
  id            bigint generated always as identity primary key,
  email         text not null check (length(email) between 3 and 254 and email = lower(email)),
  source        text not null check (source ~ '^[a-z0-9-]{2,40}$'),
  kit           text not null default '' check (kit = '' or kit ~ '^[a-z0-9-]{2,40}$'),
  utm_source    text check (length(utm_source) <= 100),
  utm_medium    text check (length(utm_medium) <= 100),
  utm_campaign  text check (length(utm_campaign) <= 100),
  utm_content   text check (length(utm_content) <= 100),
  utm_term      text check (length(utm_term) <= 100),
  referrer      text check (length(referrer) <= 200),
  page          text check (length(page) <= 200),
  consent       boolean not null default false,
  consent_text  text check (length(consent_text) <= 300),
  signups       integer not null default 1,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  unsubscribed_at timestamptz,
  unique (email, source, kit)
);
create index if not exists subscribers_created_idx on public.subscribers (created_at desc);

-- Per-IP attempt log for rate limiting. Only a salted one-way hash is kept, and only for 24 hours.
create table if not exists public.subscriber_attempts (
  id      bigint generated always as identity primary key,
  ip_hash text not null check (length(ip_hash) <= 64),
  at      timestamptz not null default now()
);
create index if not exists subscriber_attempts_ip_at on public.subscriber_attempts (ip_hash, at desc);

alter table public.subscribers enable row level security;
alter table public.subscriber_attempts enable row level security;
revoke all on public.subscribers, public.subscriber_attempts from anon, authenticated;
grant select on public.subscribers to authenticated;   -- RLS below limits it to full admin

drop policy if exists subscribers_full_read on public.subscribers;
create policy subscribers_full_read on public.subscribers for select to authenticated using (public.is_full_admin());
-- limited_role_boundary only covered tables that existed when it ran; re-apply it here.
drop policy if exists limited_role_boundary on public.subscribers;
create policy limited_role_boundary on public.subscribers as restrictive for all to authenticated
  using (coalesce(public.current_admin_role(), '') not in ('acquisition','band'));
drop policy if exists limited_role_boundary on public.subscriber_attempts;
create policy limited_role_boundary on public.subscriber_attempts as restrictive for all to authenticated
  using (coalesce(public.current_admin_role(), '') not in ('acquisition','band'));

-- subscribe_signup(p): rate limit (8 tries per IP hash per 10 minutes), then insert or touch the row.
-- First-touch attribution: UTM fields are only filled when empty. Returns {ok, new} or {ok:false, error}.
create or replace function public.subscribe_signup(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_ip text := left(coalesce(p->>'ip_hash',''), 64);
  v_tries int;
  v_new boolean;
begin
  delete from subscriber_attempts where at < now() - interval '24 hours';
  if v_ip <> '' then
    insert into subscriber_attempts (ip_hash) values (v_ip);
    select count(*) into v_tries from subscriber_attempts where ip_hash = v_ip and at > now() - interval '10 minutes';
    if v_tries > 8 then return jsonb_build_object('ok', false, 'error', 'rate_limited'); end if;
  end if;
  insert into subscribers as s (email, source, kit, utm_source, utm_medium, utm_campaign, utm_content, utm_term,
                                referrer, page, consent, consent_text)
  values (lower(p->>'email'), p->>'source', coalesce(p->>'kit',''),
          nullif(left(p->>'utm_source',100),''), nullif(left(p->>'utm_medium',100),''), nullif(left(p->>'utm_campaign',100),''),
          nullif(left(p->>'utm_content',100),''), nullif(left(p->>'utm_term',100),''),
          nullif(left(p->>'referrer',200),''), nullif(left(p->>'page',200),''),
          coalesce((p->>'consent')::boolean, false), nullif(left(p->>'consent_text',300),''))
  on conflict (email, source, kit) do update set
    signups = s.signups + 1, last_seen_at = now(),
    utm_source = coalesce(s.utm_source, excluded.utm_source), utm_medium = coalesce(s.utm_medium, excluded.utm_medium),
    utm_campaign = coalesce(s.utm_campaign, excluded.utm_campaign), utm_content = coalesce(s.utm_content, excluded.utm_content),
    utm_term = coalesce(s.utm_term, excluded.utm_term), consent = s.consent or excluded.consent
  returning (xmax = 0) into v_new;
  return jsonb_build_object('ok', true, 'new', v_new);
end $$;
revoke all on function public.subscribe_signup(jsonb) from public, anon, authenticated;
grant execute on function public.subscribe_signup(jsonb) to service_role;

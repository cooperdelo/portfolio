-- Acquisition board: move the Claude artifact board's records into the admin database.
-- NOT APPLIED YET (an overnight apply was declined; it waits for Cooper). Cutover, in order:
--   1. Set the Claude board to view-only so nothing new lands there.
--   2. Export it fresh (ArtifactData list with out_dir for every collection, plus reference/artists).
--   3. Apply this file, then run scripts/import-acquisition-board.py on that export and execute its SQL.
--      It upserts leads; conversations and activity skip anything already imported by source_id.
--   4. Deploy. /api/acquisition answers not_connected until step 3, so deploying first is safe.
-- Never run the board and these tables as two writable owners.
--
-- Access: tables are readable and writable directly by the full admin only. The acquisition role
-- (Karthik) keeps no direct table access; it reads and writes through /api/acquisition, which checks
-- the role, whitelists fields, and stamps who and when on every change.

create table if not exists public.acq_leads (
  handle         text primary key check (handle ~ '^[a-z0-9._-]{1,80}$'),
  name           text not null default '',
  platform       text not null default 'instagram',
  bucket         text not null default 'review',
  status         text not null default 'new' check (status in ('new','approved','contacted','replied','signed_up','rejected')),
  area           text not null default '',
  followers      integer not null default 0,
  queue_day      text,
  queue_order    integer,
  finder_verdict text check (finder_verdict in ('right','wrong')),
  draft_verdict  text check (draft_verdict in ('approved','rejected')),
  owner          text not null default '',
  data           jsonb not null default '{}'::jsonb,   -- the full board record: bio, reason, drafts, notes, stamps
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  updated_by     text not null default ''
);
create index if not exists acq_leads_queue on public.acq_leads (queue_day, queue_order);
create index if not exists acq_leads_status on public.acq_leads (status);

create table if not exists public.acq_conversations (
  id         uuid primary key default gen_random_uuid(),
  source_id  text unique,                                   -- board document id, so re-imports skip it
  at         timestamptz not null default now(),
  by_email   text not null default '',
  by_name    text not null default '',
  name       text not null check (length(name) between 1 and 200),
  handle     text not null default '',
  kind       text not null default '',
  channel    text not null default '',
  date       date,
  outcome    text not null default '',
  quote      text not null default '' check (length(quote) <= 5000),
  notes      text not null default '' check (length(notes) <= 5000),
  tags       text[] not null default '{}',
  next_step  text not null default '',
  next_date  date
);
create index if not exists acq_conversations_at on public.acq_conversations (at desc);

create table if not exists public.acq_activity (
  id        bigint generated always as identity primary key,
  source_id text unique,
  at        timestamptz not null default now(),
  by_email  text not null default '',
  by_name   text not null default '',
  kind      text not null,
  handle    text not null default '',
  detail    text not null default ''
);
create index if not exists acq_activity_at on public.acq_activity (at desc);

-- drafts, runs, lanes, venue_acts, artists: small reference sets the finder scripts write.
create table if not exists public.acq_reference (
  key        text primary key check (key in ('drafts','runs','lanes','venue_acts','artists')),
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.acq_leads         enable row level security;
alter table public.acq_conversations enable row level security;
alter table public.acq_activity      enable row level security;
alter table public.acq_reference     enable row level security;

drop policy if exists acq_leads_full on public.acq_leads;
create policy acq_leads_full on public.acq_leads for all to authenticated using (public.is_full_admin()) with check (public.is_full_admin());
drop policy if exists acq_conversations_full on public.acq_conversations;
create policy acq_conversations_full on public.acq_conversations for all to authenticated using (public.is_full_admin()) with check (public.is_full_admin());
drop policy if exists acq_activity_full on public.acq_activity;
create policy acq_activity_full on public.acq_activity for all to authenticated using (public.is_full_admin()) with check (public.is_full_admin());
drop policy if exists acq_reference_full on public.acq_reference;
create policy acq_reference_full on public.acq_reference for all to authenticated using (public.is_full_admin()) with check (public.is_full_admin());

revoke all on public.acq_leads, public.acq_conversations, public.acq_activity, public.acq_reference from anon;

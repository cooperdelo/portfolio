-- People in orbit (admin /people). Applied to project eibtnkaoqsgwiqttiwjo 2026-09-28 as migrations:
--   people_orbit_table_and_sync, people_orbit_sync_fix_alias, people_orbit_curated_seed,
--   people_orbit_sync_contact_labels, people_orbit_trunc_shorter
-- The curated seed (family, mentors, bandmates) lives only in the database, never in this repo.
-- Full function bodies: select pg_get_functiondef('public.people_orbit_sync()'::regprocedure);
--
-- How it stays current with zero upkeep:
--   pg_cron job people_orbit_sync runs every 30 min:
--   (a) upserts one row per vault_documents People/*.md (name from frontmatter title,
--       why_they_matter = first line under the H1, last_touch = newest ISO date in the file,
--       next_step = frontmatter next_action, linkedin link, circle from tags/role/status).
--       Dated prep notes (People/<slug>-...-YYYY-MM-DD.md) attach to links.notes.
--   (b) upserts from plugverse_contacts (matched by contact_id, source_vault_path or name):
--       role/stage -> circle, last_contacted -> last_touch, next_step/next_step_due, links.
--   (c) removes synced rows whose source disappeared. Curated rows are never removed.
--   Any column named in people_orbit.locked[] is curated and never overwritten.
--
-- Circles: inner (family + close friends), mentor, asset (valuable, not close friends),
--          team (PlugVerse), pipeline (identified, not talked to yet), orbit (everyone else).

create table if not exists public.people_orbit (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  circle text not null check (circle in ('inner','mentor','asset','team','pipeline','orbit')),
  relationship text,
  org text,
  why_they_matter text,
  last_touch date,
  next_step text,
  next_step_due date,
  links jsonb not null default '{}'::jsonb,
  source_path text,
  contact_id uuid references public.plugverse_contacts(id) on delete set null,
  pinned boolean not null default false,
  status text,
  origin text not null default 'vault' check (origin in ('vault','contact','curated')),
  locked text[] not null default '{}',
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists people_orbit_contact_uq on public.people_orbit(contact_id) where contact_id is not null;
create index if not exists people_orbit_circle_idx on public.people_orbit(circle);

alter table public.people_orbit enable row level security;
create policy people_orbit_full_admin on public.people_orbit for all to authenticated
  using (public.is_full_admin()) with check (public.is_full_admin());

-- helpers: people_orbit_clean, people_orbit_fm, people_orbit_slugify, people_orbit_sentence,
--          people_orbit_trunc, people_orbit_first_line, people_orbit_last_date,
--          people_orbit_circle_from_vault, people_orbit_circle_from_contact
-- sync:    people_orbit_sync() returns jsonb (security definer; execute revoked from anon/authenticated)

select cron.schedule('people_orbit_sync', '*/30 * * * *', $c$select public.people_orbit_sync()$c$);

-- Check (as admin):
-- select circle, count(*) from public.people_orbit group by circle order by 1;

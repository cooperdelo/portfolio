-- Band reviewer v2. NOT APPLIED until Cooper allows it. Supersedes 20261003-band-share.sql (it repeats
-- that file's statements, so either order is safe).
-- Adds: the "keep" verdict, who made the last change, Drive-hosted previews (the free Supabase bucket is full),
-- the original's path on Cooper's SSD, and routing tags (band post / B-roll, shot, subject) for the finish script.
-- Bandmates still write only through /api/band-share (service role, signed link). RLS and limited_role_boundary
-- are unchanged; no new tables.
alter table public.band_media_reviews drop constraint if exists band_media_reviews_verdict_check;
alter table public.band_media_reviews add constraint band_media_reviews_verdict_check
  check (verdict = any (array['unreviewed','keep','favorite','reject']));
alter table public.band_media_reviews add column if not exists updated_by text check (length(updated_by) <= 60);
alter table public.band_media_reviews add column if not exists use_band boolean not null default false;
alter table public.band_media_reviews add column if not exists use_broll boolean not null default false;
alter table public.band_media_reviews add column if not exists shot text check (shot is null or shot ~ '^[a-z]{2,16}$');
alter table public.band_media_reviews add column if not exists subject text check (subject is null or subject ~ '^[a-z]{2,16}$');

-- source_path is relative to G:/ (e.g. Videos/03_GIGS/chiphi_9-12-26/V1-0001_C0309.mp4). Photos that live in
-- Drive use a path relative to the Drive mount (e.g. My Drive/...). Local-only clips use drive_file_id = 'local:' || source_path.
alter table public.band_media_assets add column if not exists source_path text;
alter table public.band_media_assets add column if not exists preview_drive_id text;
alter table public.band_media_assets add column if not exists poster_drive_id text;
create unique index if not exists uq_band_media_source_path on public.band_media_assets (source_path)
  where source_path is not null and retired_at is null;

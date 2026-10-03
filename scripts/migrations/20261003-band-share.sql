-- Shared band reviewer (link-based, no login). NOT APPLIED until Cooper allows it.
-- Adds the "keep" verdict and who made the last change. Bandmates write through /api/band-share only
-- (service role, signed link); RLS and limited_role_boundary are unchanged.
alter table public.band_media_reviews drop constraint if exists band_media_reviews_verdict_check;
alter table public.band_media_reviews add constraint band_media_reviews_verdict_check
  check (verdict = any (array['unreviewed','keep','favorite','reject']));
alter table public.band_media_reviews add column if not exists updated_by text check (length(updated_by) <= 60);

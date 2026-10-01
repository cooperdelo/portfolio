begin;
alter table public.band_media_reviews add constraint band_media_trim_complete check (
 (trim_start is null and trim_end is null) or
 (trim_start is not null and trim_end is not null and trim_end>trim_start)
);
commit;

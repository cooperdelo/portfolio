-- =====================================================================
-- /admin/carousels/_supabase/broll-uploads.sql
-- One-time setup so Cooper can upload photos from his phone into the
-- Carousel Studio's "Choose" library.
-- Run ONCE in the Supabase SQL editor for project eibtnkaoqsgwiqttiwjo
-- (portfolio admin). Safe to re-run.
-- =====================================================================

-- public bucket the Studio uploads phone photos into
insert into storage.buckets (id, name, public) values ('broll-up','broll-up', true)
  on conflict (id) do update set public = true;

-- anyone can READ (public bucket so the rendered images load anywhere)
drop policy if exists broll_up_public_read on storage.objects;
create policy broll_up_public_read on storage.objects
  for select to anon using (bucket_id = 'broll-up');

-- only the admin (Cooper) can UPLOAD
drop policy if exists broll_up_admin_insert on storage.objects;
create policy broll_up_admin_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'broll-up' and public.is_admin());

drop policy if exists broll_up_admin_delete on storage.objects;
create policy broll_up_admin_delete on storage.objects
  for delete to authenticated using (bucket_id = 'broll-up' and public.is_admin());

-- catalog of uploaded photos (the Studio reads this to show them in "Choose")
create table if not exists public.broll_uploads (
  id uuid primary key default gen_random_uuid(),
  media_url text not null,
  description text,
  created_at timestamptz not null default now()
);

alter table public.broll_uploads enable row level security;

drop policy if exists broll_uploads_admin_all on public.broll_uploads;
create policy broll_uploads_admin_all on public.broll_uploads
  for all using (public.is_admin()) with check (public.is_admin());

do $$ begin
  if not exists (select 1 from pg_publication_tables
    where pubname='supabase_realtime' and tablename='broll_uploads') then
    alter publication supabase_realtime add table public.broll_uploads;
  end if;
end $$;

-- Run ONCE in the Supabase SQL editor (portfolio project eibtnkaoqsgwiqttiwjo).
-- Lets the signed-in admin REMOVE (hide) and ADD b-roll from admin/broll.
-- Only adds write policies; does NOT touch the existing read access.

-- hide / un-hide photos (remove from the pool)
drop policy if exists "admin_update_broll_assets" on public.broll_assets;
create policy "admin_update_broll_assets" on public.broll_assets
  for update to authenticated using (true) with check (true);

-- add photos from the camera roll (insert new rows)
drop policy if exists "admin_insert_broll_assets" on public.broll_assets;
create policy "admin_insert_broll_assets" on public.broll_assets
  for insert to authenticated with check (true);

-- allow the camera-roll upload into the existing 'broll' storage bucket
drop policy if exists "admin_upload_broll" on storage.objects;
create policy "admin_upload_broll" on storage.objects
  for insert to authenticated with check (bucket_id = 'broll');

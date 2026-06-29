-- Run ONCE in the Supabase SQL editor (project eibtnkaoqsgwiqttiwjo).
-- Lets the signed-in admin REMOVE b-roll from the manager (admin/broll).
-- Without these policies, RLS silently blocks update/delete, so removals don't save.

alter table public.broll_assets  enable row level security;
alter table public.broll_uploads enable row level security;

drop policy if exists "admin_update_broll_assets" on public.broll_assets;
create policy "admin_update_broll_assets" on public.broll_assets
  for update to authenticated using (true) with check (true);

drop policy if exists "admin_delete_broll_assets" on public.broll_assets;
create policy "admin_delete_broll_assets" on public.broll_assets
  for delete to authenticated using (true);

drop policy if exists "admin_update_broll_uploads" on public.broll_uploads;
create policy "admin_update_broll_uploads" on public.broll_uploads
  for update to authenticated using (true) with check (true);

drop policy if exists "admin_delete_broll_uploads" on public.broll_uploads;
create policy "admin_delete_broll_uploads" on public.broll_uploads
  for delete to authenticated using (true);

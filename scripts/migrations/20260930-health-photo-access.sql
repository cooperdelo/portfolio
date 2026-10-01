begin;
-- Nightly server workers use service_role. Recent health photos must not be
-- readable by anonymous visitors or acquisition collaborators.
drop policy if exists health_photos_nightly_task_recent_read on storage.objects;
create policy health_photos_owner_read on storage.objects for select to authenticated
using(bucket_id='health-food-photos' and public.is_full_admin());
commit;

-- Enable the narrow role only after the September 30 private-data boundary.
-- No recipient is embedded in source control; provision via the existing allowlist.
begin;
do $$ begin
 if not exists(select 1 from pg_policy where polname='limited_role_boundary'
   and polrelid='public.vault_documents'::regclass) then
  raise exception 'Apply and verify limited-admin-boundary first';
 end if;
end $$;
alter table public.admin_allowlist drop constraint admin_allowlist_admin_role_check;
alter table public.admin_allowlist add constraint admin_allowlist_admin_role_check
 check (admin_role in ('full','plugverse','acquisition'));
commit;

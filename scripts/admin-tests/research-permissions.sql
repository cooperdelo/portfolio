begin;
create temporary table research_shape_test (like public.content_plan including constraints) on commit drop;
insert into research_shape_test select * from public.content_plan limit 1;
update research_shape_test set research_brief=$brief${"status":"draft","references":[{"id":"synthetic-test-only"}]}$brief$::jsonb,research_updated_at=now();
do $$ begin
 begin update research_shape_test set research_brief='{}'::jsonb; raise exception 'empty brief accepted'; exception when check_violation then null; end;
 begin update research_shape_test set research_brief='{"status":"approved","references":[{}]}'::jsonb; raise exception 'approval allowed'; exception when check_violation then null; end;
 if not exists(select 1 from pg_class where oid='public.content_plan'::regclass and relrowsecurity) then raise exception 'RLS missing'; end if;
 if not exists(select 1 from pg_class where oid='public.vault_documents'::regclass and relrowsecurity) then raise exception 'RLS missing'; end if;
end $$;
set local role anon;
do $$ declare n int; begin
 begin select count(*) into n from public.vault_documents where path='Projects/personal-brand/reel-intel/admin-research.json'; if n<>0 then raise exception 'research anonymously readable'; end if; exception when insufficient_privilege then null; end;
 begin select count(*) into n from public.content_plan; if n<>0 then raise exception 'plan anonymously readable'; end if; exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'PASS: exact deployed brief constraints reject invalid/approved objects; source and plan enforce RLS; no public rows changed' as result;
rollback;

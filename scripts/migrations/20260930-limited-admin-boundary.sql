-- Existing full/PlugVerse permissions remain; limited roles cannot inherit them.
begin;
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path=public,pg_catalog as $$
 select exists(select 1 from public.admin_allowlist
 where email=(select auth.jwt()->>'email') and admin_role in ('full','plugverse'));
$$;
alter view public.v_content_schedule set (security_invoker=true);
alter table public.task_findings enable row level security;
drop policy if exists full_admin_findings on public.task_findings;
create policy full_admin_findings on public.task_findings to authenticated
 using(public.is_full_admin()) with check(public.is_full_admin());

-- Defense in depth against pre-existing broad authenticated policies.
do $$ declare t record; begin
 for t in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind='r' and c.relrowsecurity and c.relname<>'admin_allowlist'
 loop
  execute format('drop policy if exists limited_role_boundary on public.%I',t.relname);
  execute format('create policy limited_role_boundary on public.%I as restrictive to authenticated using (coalesce(public.current_admin_role(),'''') not in (''acquisition'',''band'')) with check (coalesce(public.current_admin_role(),'''') not in (''acquisition'',''band''))',t.relname);
 end loop;
end $$;
drop policy if exists limited_role_boundary on storage.objects;
create policy limited_role_boundary on storage.objects as restrictive to authenticated
 using(coalesce(public.current_admin_role(),'') not in ('acquisition','band'))
 with check(coalesce(public.current_admin_role(),'') not in ('acquisition','band'));

-- These are internal scheduled/trigger functions, not browser RPCs.
revoke execute on function public.mirror_pillar_block(date) from public,anon,authenticated;
revoke execute on function public.refresh_investment_prices() from public,anon,authenticated;
revoke execute on function public.content_bank_mark_used() from public,anon,authenticated;

-- current_user inside SECURITY DEFINER is the function owner, not the caller.
do $$ declare f text; n text; begin
 foreach n in array array['content_week_roll(date)','content_schedule_sync()'] loop
  select pg_get_functiondef(('public.'||n)::regprocedure) into f;
  f:=replace(f, 'current_user in (''postgres'',''service_role'',''supabase_admin'')',
    '(coalesce(auth.role(),'''') = ''service_role'' or (session_user in (''postgres'',''supabase_admin'') and current_setting(''role'',true) in (''none'',''postgres'',''supabase_admin'')))');
  execute f;
 end loop;
end $$;
commit;

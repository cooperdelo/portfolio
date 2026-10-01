-- Real database permission test. Fixtures and role-constraint change roll back.
begin;
do $$ declare c record; begin
 for c in select conname from pg_constraint where conrelid='public.admin_allowlist'::regclass and contype='c'
 loop execute format('alter table public.admin_allowlist drop constraint %I',c.conname); end loop;
end $$;
insert into public.admin_allowlist(email,admin_role) values ('acquisition-audit@example.invalid','acquisition');
select set_config('request.jwt.claims','{"email":"acquisition-audit@example.invalid","role":"authenticated","sub":"00000000-0000-4000-8000-000000000099"}',true);
set local role authenticated;
do $$ declare t record; n bigint; begin
 if public.is_admin() or public.is_full_admin() or public.is_plugverse_scope() then raise exception 'role escalation'; end if;
 if exists(select 1 from pg_class c join pg_namespace ns on ns.oid=c.relnamespace where ns.nspname='public' and c.relkind='v' and has_table_privilege(c.oid,'select') and not coalesce(c.reloptions && array['security_invoker=true','security_invoker=on'],false)) then raise exception 'Non-invoker view accessible'; end if;
 for t in select c.relname from pg_class c join pg_namespace ns on ns.oid=c.relnamespace
 where ns.nspname='public' and c.relkind='r' and c.relname<>'admin_allowlist' and has_table_privilege(c.oid,'select')
 loop
  begin
   execute format('select count(*) from public.%I',t.relname) into n;
   if n<>0 then raise exception 'Private data accessible in % (% rows)',t.relname,n; end if;
  exception when insufficient_privilege then null;
  end;
 end loop;
 begin perform public.content_schedule_sync(); raise exception 'schedule RPC accepted limited user'; exception when raise_exception then if sqlerrm<>'not allowed' then raise; end if; end;
 begin perform public.content_week_roll(current_date); raise exception 'week RPC accepted limited user'; exception when raise_exception then if sqlerrm<>'not allowed' then raise; end if; end;
 if has_function_privilege('authenticated','public.mirror_pillar_block(date)','execute') then raise exception 'private content RPC exposed'; end if;
 if has_function_privilege('authenticated','public.refresh_investment_prices()','execute') then raise exception 'investment mutation RPC exposed'; end if;
end $$;
reset role;
select 'PASS: limited role reads no private table rows; all accessible views use caller RLS; guarded mutations denied; fixture rolled back' result;
rollback;


begin;
alter table public.content_plan add column if not exists research_brief jsonb;
alter table public.content_plan add column if not exists research_updated_at timestamptz;
-- Existing full-admin RLS remains in force. No new role, anonymous access, or approval-state writes.
do $$ begin
 if not exists(select 1 from pg_constraint where conname='content_research_brief_shape') then
  alter table public.content_plan add constraint content_research_brief_shape check (
   research_brief is null or coalesce((jsonb_typeof(research_brief)='object' and research_brief->>'status'='draft'
    and jsonb_typeof(research_brief->'references')='array' and jsonb_array_length(research_brief->'references') between 1 and 3),false));
 end if;
end $$;
commit;

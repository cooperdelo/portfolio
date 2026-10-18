-- Private nightly diary + life story questions (2026-10-17). Read by /admin/diary (full admin only).
-- Copy one is this table. Copy two is the desktop task DiaryBackup (3:40am daily) writing
-- Private/diary/ in the vault (git-excluded). This repo is public: it holds the schema only.
-- The life_story_questions rows (and their `known` notes) live in the database and the private
-- backup, never here.
--
-- Privacy rule for every agent: diary_entries content is read ONLY where for_content = true and
-- deleted_at is null (the Content desk). Health checks count rows, they never read body.
-- Soft-delete only: authenticated gets no DELETE grant, the page sets deleted_at.

create table if not exists public.life_story_questions (
  id                text primary key check (id ~ '^[a-z0-9-]{2,60}$'),
  chapter           text not null check (chapter in ('childhood','middle-school','high-school','college','family','friends','love','music','sports','academics','turning-point','other')),
  sort              integer not null,
  question          text not null check (length(question) between 5 and 600),
  why               text,
  known             text,
  asked_at          timestamptz,
  answered_entry_id uuid
);

create table if not exists public.diary_entries (
  id          uuid primary key default gen_random_uuid(),
  entry_date  date not null default (now() at time zone 'America/New_York')::date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  kind        text not null default 'night' check (kind in ('night','memory','note')),
  chapter     text check (chapter is null or chapter in ('childhood','middle-school','high-school','college','family','friends','love','music','sports','academics','turning-point','other')),
  question_id text references public.life_story_questions(id),
  body        text not null check (length(btrim(body)) > 0),
  for_content boolean not null default false,
  source      text not null default 'web' check (source in ('web','chat','import')),
  deleted_at  timestamptz
);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'life_story_questions_answered_entry_fk') then
    alter table public.life_story_questions add constraint life_story_questions_answered_entry_fk
      foreign key (answered_entry_id) references public.diary_entries(id) on delete set null;
  end if;
end $$;

create index if not exists diary_entries_date_idx on public.diary_entries (entry_date desc, created_at desc) where deleted_at is null;
create index if not exists diary_entries_question_idx on public.diary_entries (question_id) where question_id is not null;
create index if not exists life_story_questions_sort_idx on public.life_story_questions (sort);

-- updated_at on every edit
create or replace function public.diary_touch_updated_at() returns trigger
language plpgsql set search_path = public, pg_catalog as $$
begin
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists diary_entries_touch on public.diary_entries;
create trigger diary_entries_touch before update on public.diary_entries
  for each row execute function public.diary_touch_updated_at();

-- An entry carrying question_id marks that question answered (web or chat insert, same path).
-- Soft-deleting the answer hands the question to the newest remaining live answer, or reopens it.
create or replace function public.diary_sync_question() returns trigger
language plpgsql set search_path = public, pg_catalog as $$
begin
  if new.question_id is not null and new.deleted_at is null then
    update public.life_story_questions set answered_entry_id = new.id, asked_at = coalesce(asked_at, now())
     where id = new.question_id and answered_entry_id is null;
  end if;
  if tg_op = 'UPDATE' and old.question_id is not null and (new.deleted_at is not null or new.question_id is distinct from old.question_id) then
    update public.life_story_questions q set answered_entry_id = (
      select d.id from public.diary_entries d
       where d.question_id = q.id and d.deleted_at is null and d.id <> new.id
       order by d.created_at desc limit 1)
     where q.id = old.question_id and q.answered_entry_id = new.id;
  end if;
  return new;
end $$;
drop trigger if exists diary_entries_question_sync on public.diary_entries;
create trigger diary_entries_question_sync after insert or update on public.diary_entries
  for each row execute function public.diary_sync_question();
revoke execute on function public.diary_touch_updated_at() from public, anon, authenticated;
revoke execute on function public.diary_sync_question() from public, anon, authenticated;

-- RLS: full admin only, plus the restrictive limited-role boundary (20260930-limited-admin-boundary.sql).
alter table public.diary_entries enable row level security;
alter table public.life_story_questions enable row level security;

drop policy if exists diary_full_admin on public.diary_entries;
create policy diary_full_admin on public.diary_entries to authenticated
  using (public.is_full_admin()) with check (public.is_full_admin());
drop policy if exists life_story_full_admin on public.life_story_questions;
create policy life_story_full_admin on public.life_story_questions to authenticated
  using (public.is_full_admin()) with check (public.is_full_admin());

drop policy if exists limited_role_boundary on public.diary_entries;
create policy limited_role_boundary on public.diary_entries as restrictive to authenticated
  using (coalesce(public.current_admin_role(),'') not in ('acquisition','band'))
  with check (coalesce(public.current_admin_role(),'') not in ('acquisition','band'));
drop policy if exists limited_role_boundary on public.life_story_questions;
create policy limited_role_boundary on public.life_story_questions as restrictive to authenticated
  using (coalesce(public.current_admin_role(),'') not in ('acquisition','band'))
  with check (coalesce(public.current_admin_role(),'') not in ('acquisition','band'));

-- Grants: nothing to anon. Authenticated may read, write and edit, never hard delete.
revoke all on public.diary_entries from public, anon, authenticated;
revoke all on public.life_story_questions from public, anon, authenticated;
grant select, insert, update on public.diary_entries to authenticated;
grant select, update on public.life_story_questions to authenticated;
grant all on public.diary_entries to service_role;
grant all on public.life_story_questions to service_role;

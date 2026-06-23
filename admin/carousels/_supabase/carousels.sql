-- =====================================================================
-- /admin/carousels/_supabase/carousels.sql
-- One-time setup for the Carousel Studio page.
-- Run this ONCE in the Supabase SQL editor for project
--   eibtnkaoqsgwiqttiwjo  (portfolio admin — NOT the Plugverse project).
-- Safe to re-run: guarded with IF NOT EXISTS / CREATE OR REPLACE.
-- =====================================================================

create table if not exists public.carousel_posts (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  title       text not null default 'Untitled',
  pillar      text,                       -- juggling / discipline / behind / perceived / figuring-it-out
  format      text,                       -- statement / one-liner / two-part / stat / value-step / reflective / framework / save-carousel
  caption     text default '',            -- the IG/TikTok caption
  hashtags    text[] default '{}',        -- without the # is fine; UI adds it
  slides      jsonb not null default '[]'::jsonb, -- [{ bg, overlay, handle, blocks:[{text,font,place,italic,size}] }]
  status      text not null default 'queued',     -- queued / approved / posted
  source      text not null default 'manual',     -- manual / agent
  notes       text default ''
);

-- keep updated_at fresh
create or replace function public.touch_carousel_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_carousel_touch on public.carousel_posts;
create trigger trg_carousel_touch
  before update on public.carousel_posts
  for each row execute function public.touch_carousel_updated_at();

-- RLS: admins only (same is_admin() gate every other admin table uses)
alter table public.carousel_posts enable row level security;

drop policy if exists carousel_posts_admin_all on public.carousel_posts;
create policy carousel_posts_admin_all
  on public.carousel_posts
  for all
  using (public.is_admin())
  with check (public.is_admin());

-- realtime (so an open tab refreshes on insert/update)
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'carousel_posts'
  ) then
    alter publication supabase_realtime add table public.carousel_posts;
  end if;
end $$;

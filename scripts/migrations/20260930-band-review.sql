begin;
create table if not exists public.band_media_assets (
 id uuid primary key default gen_random_uuid(),
 drive_file_id text not null unique,
 name text not null, gig text not null,
 mime_type text not null default 'video/mp4',
 duration numeric check(duration>0),
 proxy_path text, source_observed_at timestamptz not null default now(),
 retired_at timestamptz
);
create table if not exists public.band_media_reviews (
 asset_id uuid not null references public.band_media_assets(id),
 reviewer uuid not null,
 revision integer not null default 0,
 verdict text not null default 'unreviewed' check(verdict in ('unreviewed','favorite','reject')),
 note text not null default '' check(length(note)<=4000),
 time_seconds numeric check(time_seconds>=0),
 trim_start numeric check(trim_start>=0), trim_end numeric,
 updated_at timestamptz not null default now(),
 primary key(asset_id,reviewer),
 check((trim_start is null and trim_end is null) or (trim_start is not null and trim_end>trim_start))
);
create table if not exists public.band_media_operations (
 operation_id uuid primary key, reviewer uuid not null, asset_id uuid not null,
 request jsonb not null, result jsonb not null, created_at timestamptz not null default now()
);
alter table public.band_media_assets enable row level security;
alter table public.band_media_reviews enable row level security;
alter table public.band_media_operations enable row level security;
create policy band_assets_owner_read on public.band_media_assets for select to authenticated using(public.is_full_admin());
create policy band_reviews_owner_read on public.band_media_reviews for select to authenticated using(public.is_full_admin());
create policy band_operations_owner_read on public.band_media_operations for select to authenticated using(public.is_full_admin());
revoke all on public.band_media_assets,public.band_media_reviews,public.band_media_operations from anon,authenticated;
grant select on public.band_media_assets,public.band_media_reviews,public.band_media_operations to authenticated;

create or replace function public.band_review_save(p_asset uuid,p_revision integer,p_verdict text,p_note text,p_time numeric,p_start numeric,p_end numeric,p_operation uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_catalog as $$
declare r band_media_reviews; a band_media_assets; op band_media_operations; uid uuid:=auth.uid(); payload jsonb; result jsonb;
begin
 if not coalesce(public.is_full_admin(),false) or uid is null then raise exception 'Access denied' using errcode='42501'; end if;
 if p_operation is null then raise exception 'Operation ID required'; end if;
 payload:=jsonb_build_object('asset',p_asset,'revision',p_revision,'verdict',p_verdict,'note',p_note,'time',p_time,'start',p_start,'end',p_end);
 -- Serialize the operation ID as well as the review to make retries atomic.
 perform pg_advisory_xact_lock(hashtextextended(p_operation::text,0));
 select * into op from band_media_operations where operation_id=p_operation;
 if found then
  if op.reviewer<>uid or op.request<>payload then raise exception 'Operation ID already used for a different update' using errcode='23505'; end if;
  return op.result;
 end if;
 select * into a from band_media_assets where id=p_asset and retired_at is null;
 if not found then raise exception 'Media unavailable'; end if;
 if p_time>a.duration or p_end>a.duration then raise exception 'Time exceeds media duration'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_asset::text||uid::text,1));
 select * into r from band_media_reviews where asset_id=p_asset and reviewer=uid for update;
 if coalesce(r.revision,0)<>p_revision or p_revision is null then raise exception 'Review changed. Reload before saving.' using errcode='40001'; end if;
 insert into band_media_reviews(asset_id,reviewer,revision,verdict,note,time_seconds,trim_start,trim_end)
 values(p_asset,uid,p_revision+1,p_verdict,p_note,p_time,p_start,p_end)
 on conflict(asset_id,reviewer) do update set revision=excluded.revision,verdict=excluded.verdict,note=excluded.note,time_seconds=excluded.time_seconds,trim_start=excluded.trim_start,trim_end=excluded.trim_end,updated_at=now()
 returning * into r;
 result:=to_jsonb(r);
 insert into band_media_operations(operation_id,reviewer,asset_id,request,result) values(p_operation,uid,p_asset,payload,result);
 return result;
end $$;
revoke execute on function public.band_review_save(uuid,integer,text,text,numeric,numeric,numeric,uuid) from public,anon;
grant execute on function public.band_review_save(uuid,integer,text,text,numeric,numeric,numeric,uuid) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('band-review','band-review',false,52428800,array['video/mp4','image/jpeg','image/webp','application/json'])
on conflict(id) do nothing;
commit;

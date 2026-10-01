begin;
insert into public.admin_allowlist(email,admin_role) values('band-audit@example.invalid','full');
insert into public.band_media_assets(id,drive_file_id,name,gig,duration) values('00000000-0000-4000-8000-000000000088','audit-fixture','Test video','Audit fixture',60);
select set_config('request.jwt.claims','{"email":"band-audit@example.invalid","role":"authenticated","sub":"00000000-0000-4000-8000-000000000099"}',true);
set local role authenticated;
do $$ declare a jsonb; b jsonb; n int; begin
 a:=public.band_review_save('00000000-0000-4000-8000-000000000088',0,'favorite','A timestamped note',12,10,20,'00000000-0000-4000-8000-000000000077');
 b:=public.band_review_save('00000000-0000-4000-8000-000000000088',0,'favorite','A timestamped note',12,10,20,'00000000-0000-4000-8000-000000000077');
 if a<>b or (a->>'revision')::int<>1 then raise exception 'Retry did not preserve result'; end if;
 select count(*) into n from public.band_media_operations where asset_id='00000000-0000-4000-8000-000000000088';
 if n<>1 then raise exception 'Duplicate operation'; end if;
 select count(*) into n from public.band_media_reviews where asset_id='00000000-0000-4000-8000-000000000088' and revision=1 and verdict='favorite' and trim_start=10 and trim_end=20;
 if n<>1 then raise exception 'Readback mismatch'; end if;
 begin
  perform public.band_review_save('00000000-0000-4000-8000-000000000088',0,'reject','stale edit',null,null,null,'00000000-0000-4000-8000-000000000066');
  raise exception 'Stale revision accepted';
 exception when raise_exception then if sqlerrm not like 'Review changed.%' then raise; end if; end;
 begin
  perform public.band_review_save('00000000-0000-4000-8000-000000000088',1,'reject','reused operation',null,null,null,'00000000-0000-4000-8000-000000000077');
  raise exception 'Reused operation accepted';
 exception when unique_violation then null; end;
 begin
  perform public.band_review_save('00000000-0000-4000-8000-000000000088',1,'favorite','invalid range',null,20,10,'00000000-0000-4000-8000-000000000055');
  raise exception 'Invalid range accepted';
 exception when check_violation then null; end;
end $$;
reset role;
select set_config('request.jwt.claims','{"email":"unrelated@example.invalid","role":"authenticated","sub":"00000000-0000-4000-8000-000000000044"}',true);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.band_media_assets) or exists(select 1 from public.band_media_reviews) then raise exception 'Unrelated user can read media'; end if;
 begin
  perform public.band_review_save('00000000-0000-4000-8000-000000000088',1,'reject','unauthorized',null,null,null,'00000000-0000-4000-8000-000000000033');
  raise exception 'Unauthorized write accepted';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'PASS: durable readback, same-operation retry, stale revision, operation collision, invalid trim and unrelated-user isolation. Fixtures rolled back.' result;
rollback;

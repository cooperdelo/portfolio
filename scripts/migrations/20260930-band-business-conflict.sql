-- Business revision conflicts must not use PostgreSQL's retryable 40001.
do $$ declare f text; begin
 select pg_get_functiondef('public.band_review_save(uuid,integer,text,text,numeric,numeric,numeric,uuid)'::regprocedure) into f;
 f:=replace(f, 'errcode=''40001''','errcode=''P0001''');
 execute f;
end $$;

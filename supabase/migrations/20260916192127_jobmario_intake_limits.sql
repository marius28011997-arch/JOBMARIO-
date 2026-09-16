create index requests_created_at on jobmario_private.requests(created_at);
create index requests_email_created_at on jobmario_private.requests(email,created_at);
create or replace function public.submit_job(p_request_id uuid, p_data jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
begin
  if p_request_id is null or p_data is null or jsonb_typeof(p_data) <> 'object' or octet_length(p_data::text) > 12000 then
    raise exception 'Invalid submission';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('jobmario_intake',0));
  if exists(select 1 from jobmario_private.requests where id=p_request_id) then
    if exists(select 1 from jobmario_private.requests r where id=p_request_id and
      array[r.category,r.budget,r.description,r.plz,r.city,r.start_window,r.contact_name,r.phone,r.email] =
      array[btrim(p_data->>'category'),btrim(p_data->>'budget'),btrim(p_data->>'description'),btrim(p_data->>'plz'),btrim(p_data->>'city'),btrim(p_data->>'when'),btrim(p_data->>'name'),btrim(p_data->>'phone'),lower(btrim(p_data->>'email'))]) then
      return p_request_id;
    end if;
    raise exception 'request_conflict' using errcode='22023';
  end if;
  if (select count(*) from jobmario_private.requests where created_at > now()-interval '1 hour') >= 30
    or (select count(*) from jobmario_private.requests where created_at > now()-interval '1 day') >= 200
    or (select count(*) from jobmario_private.requests where created_at > now()-interval '30 days') >= 2000
    or (select count(*) from jobmario_private.requests where email=lower(btrim(p_data->>'email')) and created_at > now()-interval '1 day') >= 3 then
    raise exception 'intake_rate_limit';
  end if;
  insert into jobmario_private.requests
    (id,category,budget,description,plz,city,start_window,contact_name,phone,email)
  values (p_request_id,btrim(p_data->>'category'),btrim(p_data->>'budget'),
    btrim(p_data->>'description'),btrim(p_data->>'plz'),btrim(p_data->>'city'),
    btrim(p_data->>'when'),btrim(p_data->>'name'),btrim(p_data->>'phone'),lower(btrim(p_data->>'email')))
  on conflict (id) do nothing;
  return p_request_id;
end;
$$;

revoke all on function public.submit_job(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.submit_job(uuid,jsonb) to service_role;

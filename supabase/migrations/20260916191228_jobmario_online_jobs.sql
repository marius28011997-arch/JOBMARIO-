begin;
create schema if not exists jobmario_private;
revoke all on schema jobmario_private from public, anon, authenticated;

create table jobmario_private.requests (
  id uuid primary key,
  category text not null check (category in ('Trockenbau','Malerarbeiten','Boden / Parkett','Fliesen','Sanitär','Elektro','Abriss','Renovierung','Innenausbau','Sonstiges')),
  budget text not null check (budget in ('Unter 500 €','500 – 1.500 €','1.500 – 5.000 €','5.000 – 10.000 €','Über 10.000 €','Noch offen')),
  description text not null check (length(description) between 10 and 4000),
  plz text not null check (plz ~ '^[0-9]{5}$'),
  city text not null check (length(city) between 2 and 100),
  start_window text not null check (start_window in ('So schnell wie möglich','Innerhalb 2 Wochen','Innerhalb 1 Monat','In 1–3 Monaten','Flexibel')),
  contact_name text not null check (length(contact_name) between 2 and 100),
  phone text not null check (length(phone) between 5 and 40),
  email text not null check (length(email) <= 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  created_at timestamptz not null default now()
);
alter table jobmario_private.requests enable row level security;
revoke all on jobmario_private.requests from public, anon, authenticated;

-- Only the operator can insert reviewed public summaries. Never copy contact
-- details or an unreviewed free-text description into this table.
create table public.published_jobs (
  id uuid primary key references jobmario_private.requests(id) on delete cascade,
  title text not null check (length(title) between 5 and 120),
  category text not null,
  budget text not null,
  plz text not null,
  city text not null,
  start_window text not null,
  published_at timestamptz not null default now()
);
alter table public.published_jobs enable row level security;
revoke all on public.published_jobs from public, anon, authenticated;

create function public.submit_job(p_request_id uuid, p_data jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
begin
  if p_request_id is null or p_data is null or jsonb_typeof(p_data) <> 'object' or octet_length(p_data::text) > 12000 then
    raise exception 'Invalid submission';
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
revoke all on function public.submit_job(uuid,jsonb) from public, anon, authenticated;
grant usage on schema jobmario_private to service_role;
grant select, insert on jobmario_private.requests to service_role;
grant execute on function public.submit_job(uuid,jsonb) to service_role;

create function public.list_jobs()
returns table(id uuid,title text,category text,budget text,plz text,city text,start_window text,published_at timestamptz)
language sql stable security invoker set search_path = '' as $$
  select id,title,category,budget,plz,city,start_window,published_at
  from public.published_jobs order by published_at desc,id desc limit 100;
$$;
revoke all on function public.list_jobs() from public, anon, authenticated;
grant select on public.published_jobs to anon, authenticated;
create policy read_published_jobs on public.published_jobs for select to anon, authenticated using (true);
grant execute on function public.list_jobs() to anon, authenticated;
create index published_jobs_recent on public.published_jobs (published_at desc, id desc);
commit;


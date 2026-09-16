begin;

create table if not exists public.contractor_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  company_name text not null check (length(company_name) between 2 and 120),
  contact_name text not null check (length(contact_name) between 2 and 100),
  phone text not null check (length(phone) between 5 and 40),
  plz text not null check (plz ~ '^[0-9]{5}$'),
  city text not null check (length(city) between 2 and 100),
  trades text[] not null default '{}',
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.contractor_profiles enable row level security;
revoke all on public.contractor_profiles from public, anon;
grant select, insert, update on public.contractor_profiles to authenticated;
create policy contractor_read_own on public.contractor_profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy contractor_insert_own on public.contractor_profiles for insert to authenticated with check ((select auth.uid()) = user_id);
create policy contractor_update_own on public.contractor_profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create table if not exists jobmario_private.lead_access (
  job_id uuid not null references public.published_jobs(id) on delete cascade,
  contractor_id uuid not null references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now(),
  payment_reference text,
  primary key(job_id, contractor_id)
);
alter table jobmario_private.lead_access enable row level security;
revoke all on jobmario_private.lead_access from public, anon, authenticated;
grant select, insert, update, delete on jobmario_private.lead_access to service_role;
create index if not exists lead_access_contractor_idx on jobmario_private.lead_access(contractor_id, granted_at desc);

create function public.get_unlocked_lead(p_job_id uuid)
returns table(job_id uuid, contact_name text, phone text, email text)
language sql stable security definer set search_path = '' as $$
  select r.id, r.contact_name, r.phone, r.email
  from jobmario_private.requests r
  join jobmario_private.lead_access a on a.job_id = r.id
  where r.id = p_job_id and a.contractor_id = (select auth.uid())
  limit 1;
$$;
revoke all on function public.get_unlocked_lead(uuid) from public, anon;
grant execute on function public.get_unlocked_lead(uuid) to authenticated;

commit;

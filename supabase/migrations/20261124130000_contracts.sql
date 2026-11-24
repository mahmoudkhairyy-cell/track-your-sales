-- Contract tracking: every rep logs each contract with status + dates,
-- branch managers monitor their own branch, area managers monitor all
-- their branches. Mirrors the branch_reports pattern (rep pushes through
-- the manager-api edge function, reads are password-gated RPCs).
-- Apply manually after review. Do NOT apply automatically.

create table if not exists public.contracts (
  id text primary key,
  branch_id text not null,
  employee_name text not null,
  branch_name text not null,
  area_manager text not null,
  client_name text not null,
  status text not null check (status in ('sent', 'missing', 'rejected')),
  contract_date date not null,
  sent_date date,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contracts_branch_name_idx on public.contracts (branch_name);
create index if not exists contracts_area_manager_idx on public.contracts (area_manager);
create index if not exists contracts_status_idx on public.contracts (status);

alter table public.contracts enable row level security;
revoke all on public.contracts from anon, authenticated;

-- Rep upserts one of their own contracts. Ownership: an existing row may
-- only be replaced by the same branch_id (device/profile identity), and the
-- area manager must be a real name from manager_areas (same rule as
-- submit_report).
create or replace function public.upsert_contract(
  p_id text,
  p_branch_id text,
  p_employee text,
  p_branch text,
  p_area_manager text,
  p_client text,
  p_status text,
  p_contract_date date,
  p_sent_date date,
  p_note text
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if p_id is null or length(p_id) < 8 or length(p_id) > 80 then
    raise exception 'invalid contract id';
  end if;
  if p_branch_id is null or length(p_branch_id) < 8 or length(p_branch_id) > 80 then
    raise exception 'invalid branch id';
  end if;
  if p_status not in ('sent', 'missing', 'rejected') then
    raise exception 'invalid status';
  end if;
  if p_contract_date is null then
    raise exception 'invalid contract date';
  end if;
  if not exists (select 1 from public.manager_areas where name = p_area_manager) then
    raise exception 'unknown area manager';
  end if;

  if exists (select 1 from public.contracts where id = p_id and branch_id <> p_branch_id) then
    raise exception 'not your contract';
  end if;

  insert into public.contracts as c (
    id, branch_id, employee_name, branch_name, area_manager,
    client_name, status, contract_date, sent_date, note, updated_at
  ) values (
    p_id, p_branch_id,
    left(btrim(p_employee), 80), left(btrim(p_branch), 80), left(btrim(p_area_manager), 80),
    left(btrim(p_client), 120), p_status, p_contract_date, p_sent_date,
    left(coalesce(p_note, ''), 500), now()
  )
  on conflict (id) do update set
    employee_name = excluded.employee_name,
    branch_name = excluded.branch_name,
    area_manager = excluded.area_manager,
    client_name = excluded.client_name,
    status = excluded.status,
    contract_date = excluded.contract_date,
    sent_date = excluded.sent_date,
    note = excluded.note,
    updated_at = now();
end
$function$;

-- Rep deletes one of their own contracts.
create or replace function public.delete_contract(p_id text, p_branch_id text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  delete from public.contracts
  where id = p_id and branch_id = p_branch_id;
end
$function$;

-- Area manager reads every contract across their branches.
-- Mirrors get_reports_for_password (manager_areas.password_hash + crypt()).
create or replace function public.get_contracts_for_area_password(p_password text)
returns setof public.contracts
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  area_name text;
begin
  select name into area_name
  from public.manager_areas
  where password_hash = crypt(p_password, password_hash)
  limit 1;

  if area_name is null then
    raise exception 'wrong password';
  end if;

  return query
    select *
    from public.contracts
    where area_manager = area_name
    order by contract_date desc, updated_at desc;
end
$function$;

-- Area manager deletes a contract that belongs to one of their branches.
create or replace function public.delete_contract_for_area(p_password text, p_id text)
returns void
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  area_name text;
begin
  select name into area_name
  from public.manager_areas
  where password_hash = crypt(p_password, password_hash)
  limit 1;

  if area_name is null then
    raise exception 'wrong password';
  end if;

  delete from public.contracts
  where id = p_id and area_manager = area_name;
end
$function$;

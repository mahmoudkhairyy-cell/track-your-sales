create table if not exists public.branch_manager_monthly (
  branch_name text not null,
  year_month text not null check (year_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  productivity_percent numeric(6,2) not null default 0 check (productivity_percent between 0 and 1000),
  updated_by text not null,
  updated_at timestamptz not null default now(),
  primary key (branch_name, year_month)
);

create table if not exists public.branch_manager_employee_overrides (
  branch_name text not null,
  employee_name text not null,
  year_month text not null check (year_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  quality jsonb not null default '{}'::jsonb,
  updated_by text not null,
  updated_at timestamptz not null default now(),
  primary key (branch_name, employee_name, year_month),
  constraint branch_manager_quality_object check (jsonb_typeof(quality) = 'object')
);

create table if not exists public.branch_manager_audit (
  id bigint generated always as identity primary key,
  branch_name text not null,
  employee_name text,
  year_month text not null,
  field_name text not null,
  old_value jsonb,
  new_value jsonb not null,
  updated_by text not null,
  updated_at timestamptz not null default now()
);

create index if not exists branch_manager_audit_branch_month_idx
  on public.branch_manager_audit (branch_name, year_month, updated_at desc);
create index if not exists branch_manager_employee_overrides_month_idx
  on public.branch_manager_employee_overrides (branch_name, year_month);

alter table public.branch_manager_monthly enable row level security;
alter table public.branch_manager_employee_overrides enable row level security;
alter table public.branch_manager_audit enable row level security;

revoke all on public.branch_manager_monthly from anon, authenticated;
revoke all on public.branch_manager_employee_overrides from anon, authenticated;
revoke all on public.branch_manager_audit from anon, authenticated;

create or replace function public.audit_branch_manager_monthly()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.productivity_percent is distinct from old.productivity_percent then
    insert into public.branch_manager_audit
      (branch_name, employee_name, year_month, field_name, old_value, new_value, updated_by)
    values
      (new.branch_name, null, new.year_month, 'productivity',
       case when tg_op = 'INSERT' then null else to_jsonb(old.productivity_percent) end,
       to_jsonb(new.productivity_percent), new.updated_by);
  end if;
  return new;
end;
$$;

drop trigger if exists branch_manager_monthly_audit on public.branch_manager_monthly;
create trigger branch_manager_monthly_audit
after insert or update on public.branch_manager_monthly
for each row execute function public.audit_branch_manager_monthly();

create or replace function public.audit_branch_manager_employee_override()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  k text;
  old_v jsonb;
  new_v jsonb;
begin
  foreach k in array array['kyc','visits','training','pos','csat'] loop
    old_v := case when tg_op = 'INSERT' then null else old.quality -> k end;
    new_v := new.quality -> k;
    if tg_op = 'INSERT' or old_v is distinct from new_v then
      insert into public.branch_manager_audit
        (branch_name, employee_name, year_month, field_name, old_value, new_value, updated_by)
      values (new.branch_name, new.employee_name, new.year_month, 'quality.' || k,
        old_v, coalesce(new_v, 'null'::jsonb), new.updated_by);
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists branch_manager_employee_override_audit on public.branch_manager_employee_overrides;
create trigger branch_manager_employee_override_audit
after insert or update on public.branch_manager_employee_overrides
for each row execute function public.audit_branch_manager_employee_override();

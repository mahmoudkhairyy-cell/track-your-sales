alter table public.branch_manager_monthly
  drop constraint if exists branch_manager_monthly_year_month_check;
alter table public.branch_manager_monthly
  add constraint branch_manager_monthly_year_month_check
  check (year_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');

alter table public.branch_manager_employee_overrides
  drop constraint if exists branch_manager_employee_overrides_year_month_check;
alter table public.branch_manager_employee_overrides
  add constraint branch_manager_employee_overrides_year_month_check
  check (year_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');

-- Strict manager ownership for employee reports.
-- Apply only after reviewing the matching Edge Function deployment.
create or replace function public.get_reports_for_password(p_password text)
returns setof public.branch_reports
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
    from public.branch_reports
    where nullif(btrim(payload->>'areaManager'), '') = area_name
    order by updated_at desc;
end
$function$;

create or replace function public.delete_report(p_password text, p_branch_id text)
returns void
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  area_name text;
  owner_area text;
begin
  select name into area_name
  from public.manager_areas
  where password_hash = crypt(p_password, password_hash)
  limit 1;

  if area_name is null then
    raise exception 'wrong password';
  end if;

  select payload->>'areaManager' into owner_area
  from public.branch_reports
  where branch_id = p_branch_id
  limit 1;

  if not found or nullif(btrim(owner_area), '') is null or owner_area <> area_name then
    raise exception 'not your report';
  end if;

  delete from public.branch_reports
  where branch_id = p_branch_id
    and payload->>'areaManager' = area_name;
end
$function$;

create or replace function public.submit_report(
  p_branch_id text,
  p_employee text,
  p_branch text,
  p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  manager_name text;
  existing_manager text;
  affected_rows integer;
begin
  if p_branch_id is null or length(p_branch_id) < 8 or length(p_branch_id) > 80 then
    raise exception 'invalid branch id';
  end if;

  if p_employee is null or length(btrim(p_employee)) < 2
     or p_branch is null or length(btrim(p_branch)) < 2 then
    raise exception 'invalid employee or branch';
  end if;

  if p_payload is null or pg_column_size(p_payload) > 200000 then
    raise exception 'payload too large';
  end if;

  if nullif(btrim(p_payload->>'areaManager'), '') is null then
    raise exception 'manager required';
  end if;

  select name into manager_name
  from public.manager_areas
  where name = btrim(p_payload->>'areaManager')
  limit 1;

  if manager_name is null then
    raise exception 'invalid manager';
  end if;

  select payload->>'areaManager' into existing_manager
  from public.branch_reports
  where branch_id = p_branch_id
  for update;

  if found and coalesce(existing_manager, '') <> manager_name then
    raise exception 'manager assignment mismatch';
  end if;

  insert into public.branch_reports as current_report (branch_id, employee_name, branch_name, payload, updated_at)
  values (p_branch_id, left(btrim(p_employee), 80), left(btrim(p_branch), 80), p_payload, now())
  on conflict (branch_id) do update
    set employee_name = excluded.employee_name,
        branch_name = excluded.branch_name,
        payload = excluded.payload,
        updated_at = now()
    where nullif(btrim(current_report.payload->>'areaManager'), '') = manager_name;

  get diagnostics affected_rows = row_count;
  if affected_rows = 0 then
    raise exception 'manager assignment mismatch';
  end if;
end
$function$;

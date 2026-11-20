-- Treat employee report identities as case-insensitive within the same branch and Area Manager.
-- The application migration also reuses an existing branch_id before attempting an insert.

create unique index if not exists branch_reports_employee_identity_uidx
on public.branch_reports (
  lower(regexp_replace(btrim(employee_name), '\\s+', ' ', 'g')),
  branch_name,
  (payload ->> 'areaManager')
)
where nullif(btrim(payload ->> 'areaManager'), '') is not null;

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
  existing_branch_id text;
  effective_branch_id text;
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

  -- Preserve the manager ownership check for a client-provided ID.
  select payload->>'areaManager' into existing_manager
  from public.branch_reports
  where branch_id = p_branch_id
  for update;

  if found and coalesce(existing_manager, '') <> manager_name then
    raise exception 'manager assignment mismatch';
  end if;

  -- Resolve the canonical row using a normalized employee name.
  select branch_id into existing_branch_id
  from public.branch_reports
  where lower(regexp_replace(btrim(employee_name), '\\s+', ' ', 'g')) =
        lower(regexp_replace(btrim(p_employee), '\\s+', ' ', 'g'))
    and branch_name = left(btrim(p_branch), 80)
    and payload->>'areaManager' = manager_name
  order by updated_at desc
  limit 1
  for update;

  effective_branch_id := coalesce(existing_branch_id, p_branch_id);

  insert into public.branch_reports as current_report
    (branch_id, employee_name, branch_name, payload, updated_at)
  values
    (effective_branch_id, left(btrim(p_employee), 80), left(btrim(p_branch), 80), p_payload, now())
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

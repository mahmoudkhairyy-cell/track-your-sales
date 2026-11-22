-- Team Leader access for OB (boutique) branches.
-- A per-branch password, hashed with bcrypt via pgcrypto, separate from the area manager password.
-- Apply manually after review. Do NOT apply automatically.

create table if not exists public.branch_team_leader_access (
  branch_name text primary key,
  password_hash text not null,
  updated_by text not null,
  updated_at timestamptz not null default now()
);

alter table public.branch_team_leader_access enable row level security;
revoke all on public.branch_team_leader_access from anon, authenticated;

-- Area manager sets or changes the team leader password for one branch.
create or replace function public.set_team_leader_password(
  p_area_password text,
  p_branch text,
  p_new_password text,
  p_updated_by text
)
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
  where password_hash = crypt(p_area_password, password_hash)
  limit 1;

  if area_name is null then
    raise exception 'wrong password';
  end if;

  if char_length(coalesce(p_new_password, '')) < 8 then
    raise exception 'new password must be at least 8 characters';
  end if;

  insert into public.branch_team_leader_access (branch_name, password_hash, updated_by, updated_at)
  values (p_branch, crypt(p_new_password, gen_salt('bf')), coalesce(p_updated_by, area_name), now())
  on conflict (branch_name) do update
    set password_hash = excluded.password_hash,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at;
end
$function$;

-- Team leader reads only the reports of their own branch, and only with that branch's password.
create or replace function public.get_branch_team_for_team_leader(p_branch text, p_password text)
returns setof public.branch_reports
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
begin
  if not exists (
    select 1
    from public.branch_team_leader_access
    where branch_name = p_branch
      and password_hash = crypt(p_password, password_hash)
  ) then
    raise exception 'wrong password';
  end if;

  return query
    select *
    from public.branch_reports
    where branch_name = p_branch
    order by updated_at desc;
end
$function$;

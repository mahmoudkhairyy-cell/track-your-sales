-- Branch Manager access: one password per branch, hashed with bcrypt via pgcrypto.
-- Mirrors the area manager pattern (manager_areas.password_hash + crypt()),
-- and sits next to branch_team_leader_access (same shape, different role).
-- Apply manually after review. Do NOT apply automatically.

create table if not exists public.branch_manager_access (
  branch_name text primary key,
  password_hash text not null,
  updated_by text not null default 'admin',
  updated_at timestamptz not null default now()
);

alter table public.branch_manager_access enable row level security;
revoke all on public.branch_manager_access from anon, authenticated;

-- Verify a branch manager password for one branch. Raises 'wrong password' when invalid.
create or replace function public.verify_branch_manager(p_branch text, p_password text)
returns void
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
begin
  if not exists (
    select 1
    from public.branch_manager_access
    where branch_name = p_branch
      and password_hash = crypt(p_password, password_hash)
  ) then
    raise exception 'wrong password';
  end if;
end
$function$;

-- Branch manager changes their own branch password (needs the current one).
create or replace function public.change_branch_manager_password(
  p_branch text,
  p_old text,
  p_new text
)
returns void
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
begin
  if char_length(coalesce(p_new, '')) < 8 then
    raise exception 'new password must be at least 8 characters';
  end if;

  if not exists (
    select 1
    from public.branch_manager_access
    where branch_name = p_branch
      and password_hash = crypt(p_old, password_hash)
  ) then
    raise exception 'wrong password';
  end if;

  update public.branch_manager_access
  set password_hash = crypt(p_new, gen_salt('bf')),
      updated_at = now()
  where branch_name = p_branch;
end
$function$;

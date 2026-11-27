-- Persistent rate limit for the manager-api edge function (wrong-password attempts).
-- The in-memory limiter inside the edge function resets on every cold start;
-- this table keeps the counters in the database so the limit survives restarts.

create table if not exists public.manager_api_attempts (
  attempt_key text primary key,
  fail_count integer not null,
  first_fail_at timestamptz not null
);

alter table public.manager_api_attempts enable row level security;
-- No RLS policies on purpose: only the service role (used by the manager-api
-- edge function) may read or write this table.
revoke all on public.manager_api_attempts from anon, authenticated;

-- Returns true when the key is at or over the failure limit inside its window.
-- Also garbage-collects rows whose window expired so the table stays small.
create or replace function public.manager_api_is_blocked(p_key text, p_max integer, p_window_ms bigint)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  delete from public.manager_api_attempts
  where first_fail_at < now() - (p_window_ms || ' milliseconds')::interval;

  select fail_count into v_count
  from public.manager_api_attempts
  where attempt_key = p_key;

  if not found then
    return false;
  end if;
  return v_count >= p_max;
end;
$$;

-- Records one failed attempt; starts a fresh window when the previous one expired.
create or replace function public.manager_api_record_failure(p_key text, p_window_ms bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.manager_api_attempts (attempt_key, fail_count, first_fail_at)
  values (p_key, 1, now())
  on conflict (attempt_key) do update
  set fail_count = case
        when public.manager_api_attempts.first_fail_at < now() - (p_window_ms || ' milliseconds')::interval then 1
        else public.manager_api_attempts.fail_count + 1
      end,
      first_fail_at = case
        when public.manager_api_attempts.first_fail_at < now() - (p_window_ms || ' milliseconds')::interval then now()
        else public.manager_api_attempts.first_fail_at
      end;
end;
$$;

-- Clears the counter after a successful sign-in.
create or replace function public.manager_api_clear_failures(p_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.manager_api_attempts where attempt_key = p_key;
end;
$$;

revoke all on function public.manager_api_is_blocked(text, integer, bigint) from public, anon, authenticated;
revoke all on function public.manager_api_record_failure(text, bigint) from public, anon, authenticated;
revoke all on function public.manager_api_clear_failures(text) from public, anon, authenticated;
grant execute on function public.manager_api_is_blocked(text, integer, bigint) to service_role;
grant execute on function public.manager_api_record_failure(text, bigint) to service_role;
grant execute on function public.manager_api_clear_failures(text) to service_role;

-- ROLLBACK:
--   drop function if exists public.manager_api_is_blocked(text, integer, bigint);
--   drop function if exists public.manager_api_record_failure(text, bigint);
--   drop function if exists public.manager_api_clear_failures(text);
--   drop table if exists public.manager_api_attempts;
-- then redeploy the previous manager-api code (in-memory limiter only).

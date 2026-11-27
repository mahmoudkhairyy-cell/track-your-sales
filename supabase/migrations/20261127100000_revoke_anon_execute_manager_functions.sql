-- Applied by hand in the Supabase SQL editor on 2026-11-27.
-- These password/contract functions are only called by the manager-api Edge Function (service_role).
-- Before this, anyone with the public key could call them directly: no rate limit, and
-- delete_contract / upsert_contract needed no password at all.
revoke execute on function public.change_branch_manager_password(text,text,text), public.delete_contract(text,text), public.delete_contract_for_area(text,text), public.get_branch_team_for_team_leader(text,text), public.get_contracts_for_area_password(text), public.set_team_leader_password(text,text,text,text), public.upsert_contract(text,text,text,text,text,text,text,date,date,text), public.verify_branch_manager(text,text) from public, anon, authenticated;
grant execute on function public.change_branch_manager_password(text,text,text), public.delete_contract(text,text), public.delete_contract_for_area(text,text), public.get_branch_team_for_team_leader(text,text), public.get_contracts_for_area_password(text), public.set_team_leader_password(text,text,text,text), public.upsert_contract(text,text,text,text,text,text,text,date,date,text), public.verify_branch_manager(text,text) to service_role;
-- ROLLBACK (only if the manager-api function stops working):
-- grant execute on function <same list> to anon, authenticated;

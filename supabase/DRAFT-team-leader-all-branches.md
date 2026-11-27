# DRAFT — Team Leader per-branch passwords for all 43 branches (NOT APPLIED)

User decision (Nov 27, ~3:06 PM, relayed via main): one TL per branch, every TL in
every branch gets his own password, same KPI weights as employee, enters his own
scores by hand (in the employee app), sees his team (in the /tl/ app).

## What already exists (no migration needed)

- Table `public.branch_team_leader_access(branch_name PK, password_hash, updated_by, updated_at)`,
  RLS locked, bcrypt hashes (migration 20261122150000_branch_team_leader_access.sql).
- RPC `set_team_leader_password(p_area_password, p_branch, p_new_password, p_updated_by)` —
  branch-agnostic; only the area manager password authorizes it.
- RPC `get_branch_team_for_team_leader(p_branch, p_password)` — branch-agnostic.
- Both already exposed via the manager-api edge function (team_leader_branch /
  set_team_leader_password). No schema or function change required.

## The actual rollout is operational + client gating

1. Set a TL password for every branch (43 rows). Options:
   a. Area manager sets them one by one — needs a UI. Cheapest safe path: run the
      existing RPC from the Supabase SQL editor, once per branch:
      select public.set_team_leader_password('<AREA_PASSWORD>', '<BRANCH_NAME>', '<NEW_TL_PASSWORD>', 'Mahmoud');
      Generate each NEW_TL_PASSWORD with the vault (never in chat), deliver via vault link.
   b. Or a small admin screen in the area app calling the same RPC (follow-up step).
2. Client gating flip (code, on role-apps branch, deploy only after step 1 covers
   all branches):
   - src/app/(app)/team/page.tsx line ~29: `profile.branch.startsWith("OB.")` → allow
     any branch whose TL password exists. Franchise TLs currently pass with no
     password (they see only themselves); after the flip they need their branch TL
     password. Communicate before flipping.
   - src/app/(app)/target/page.tsx line ~67: same OB gate for TL target entry.
3. The /tl/ app (this branch) signs a TL in with branch + TL password and shows
   his team read-only. His own scores stay in the employee app (same weights) —
   the /tl/ dashboard links to it.

## Backward compatibility

- Nothing above changes existing rows: OB boutique TL passwords keep working.
- The employee-app gate flip (step 2) is the only behavior change and is staged
  after passwords exist for every branch.

## Rollback

- Passwords: delete the branch's row from public.branch_team_leader_access.
- Gate flip: revert the two-line client change.

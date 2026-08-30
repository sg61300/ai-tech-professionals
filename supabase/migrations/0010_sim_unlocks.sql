-- ============================================================================
-- 0010_sim_unlocks — XP sim-unlock ledger (Design/xp-sim-unlock-spec.md §4)
-- A row = the user spent XP to permanently unlock a sim AHEAD of the linear
-- path. The existing isUnlocked gate is OR'd with the presence of a row here, so
-- this table is a purely additive second unlock route (the working path is
-- untouched). unique(user_id, sim_id) gives apply-once + insert-first
-- idempotency (a duplicate insert raises 23505, which the action maps to
-- "already unlocked"). ahead_of_path records whether the spend jumped the path
-- (the headline secondary metric); xp_spent is the audited price at unlock time.
--
-- All writes go through the service-role action only (server-authoritative price
-- + a race-safe conditional deduct); owners may only READ their own rows.
-- ============================================================================

create table if not exists public.sim_unlocks (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  sim_id        text not null,
  xp_spent      int not null check (xp_spent >= 0),   -- audited price at unlock time
  ahead_of_path boolean not null,                     -- did the spend jump the linear path
  unlocked_at   timestamptz not null default now(),
  unique (user_id, sim_id)                            -- apply-once + insert-first idempotency
);
create index if not exists sim_unlocks_user_idx on public.sim_unlocks (user_id);

alter table public.sim_unlocks enable row level security;
-- Read-only to the owner; all writes go through the service-role client.
create policy "own sim_unlocks - select" on public.sim_unlocks
  for select using (auth.uid() = user_id);

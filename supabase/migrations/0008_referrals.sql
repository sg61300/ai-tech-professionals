-- ============================================================================
-- 0008_referrals — referral feature (ADR-020, grilled in Session 21)
-- Share-to-invite: each user has a unique referral_code; a new user can be
-- attributed to a referrer (referred_by). When the INVITEE completes their
-- taste sim, both sides earn REFERRAL_XP into the single visible XP balance
-- (no second currency, R1). Rewards: once per invitee (R4), capped per
-- referrer (R3), server-side + idempotent, awarded via the service-role client
-- (cross-user write: the invitee's session credits the referrer's XP).
--
-- referred_by stores the RESOLVED referrer user id (not the raw code) so joins,
-- the 10-cap, and the self-referral guard are robust to code changes. The
-- referral_rewards ledger doubles as the "referral XP source tag" (R1): total
-- referral-sourced XP per user is derivable from it, so referral XP stays
-- measurable / later-excludable from leveling WITHOUT a global XP ledger.
-- ============================================================================

alter table public.profiles
  add column if not exists referral_code text unique,
  add column if not exists referred_by uuid references auth.users(id) on delete set null;

create index if not exists profiles_referred_by_idx on public.profiles(referred_by);

-- One reward row per activated invitee (unique invitee_id = apply-once +
-- idempotency). Count by referrer_id enforces the per-referrer cap (R3).
create table if not exists public.referral_rewards (
  id           bigint generated always as identity primary key,
  referrer_id  uuid not null references auth.users(id) on delete cascade,
  invitee_id   uuid not null references auth.users(id) on delete cascade,
  xp_each      integer not null,            -- XP granted to EACH side (audit / measurability)
  granted_at   timestamptz not null default now(),
  unique (invitee_id)                        -- an invitee ever triggers at most one reward
);
create index if not exists referral_rewards_referrer_idx on public.referral_rewards(referrer_id);

alter table public.referral_rewards enable row level security;
-- Read-only to either party; all writes go through the service-role client.
create policy "own referral_rewards" on public.referral_rewards for select
  using (auth.uid() = referrer_id or auth.uid() = invitee_id);

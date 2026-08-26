-- ============================================================================
-- 0007_streak_saves — streak insurance ("save my streak")
-- A mercy mechanic (ADR-002): on returning after missing 1–2 days, a user may
-- spend a percentage of their XP to keep their streak alive. XP is the existing
-- currency (profiles.xp) — no banked "freeze tokens" (dropped in S13, no data
-- model). This table is the audit ledger + the idempotency guard (one save per
-- return-day). See lib/streakinsurance.
-- ============================================================================

create table public.streak_saves (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  saved_date  date not null,      -- civil date (user tz) the save was purchased
  gap_days    integer not null,   -- missed days bridged (1 or 2)
  streak_kept integer not null,   -- the streak_count preserved
  xp_spent    integer not null,   -- XP deducted for this save
  created_at  timestamptz not null default now(),
  unique (user_id, saved_date)    -- at most one save per return-day (no double charge)
);
create index streak_saves_user_idx on public.streak_saves(user_id);

alter table public.streak_saves enable row level security;
create policy "own streak_saves" on public.streak_saves for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

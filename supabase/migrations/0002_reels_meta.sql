-- 0002 — Reels feature (PRD/14): display metadata + a 'watch' interaction type.
-- Additive/idempotent. Apply with `pnpm db:migrate`.

-- Display fields the feed overlay needs (title, channel handle, topic tag).
alter table public.reels add column if not exists title   text;
alter table public.reels add column if not exists channel text;
alter table public.reels add column if not exists topic   text;

-- Allow a 'watch' interaction so capped reel-XP can be counted per day and made
-- idempotent per (user, reel). Recreate the CHECK to include it.
alter table public.reel_interactions drop constraint if exists reel_interactions_type_check;
alter table public.reel_interactions
  add constraint reel_interactions_type_check
  check (type in ('like', 'save', 'share', 'report', 'watch'));

-- Fast "did this user watch reels today / which reels interacted" lookups.
create index if not exists reel_interactions_user_type_idx
  on public.reel_interactions (user_id, type);

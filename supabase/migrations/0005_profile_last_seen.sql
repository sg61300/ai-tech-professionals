-- 0005 — session/return tracking (Architecture/05 funnel). last_seen_date is the
-- civil date of the user's most recent session; it lets us fire `session_start`,
-- `signed_up` (first session), and `returned_separate_day` (a session on a new
-- calendar day) exactly once each per day without duplicates. Additive.
alter table public.profiles add column if not exists last_seen_date date;

-- Backfill EXISTING users so they're not mistaken for brand-new signups on their
-- next session. New profiles keep NULL (default) → first session = signup.
update public.profiles set last_seen_date = created_at::date where last_seen_date is null;

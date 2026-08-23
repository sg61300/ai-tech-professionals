-- 0004 — capture the reason a user gives when reporting a reel (PRD/14 curation
-- queue). Nullable; only 'report' rows use it. Additive/idempotent.
alter table public.reel_interactions add column if not exists reason text;

-- 0003 — one row per video: a unique youtube_id lets the seed upsert idempotently
-- and prevents duplicate reels in the feed. Additive/idempotent.
create unique index if not exists reels_youtube_id_key on public.reels (youtube_id);

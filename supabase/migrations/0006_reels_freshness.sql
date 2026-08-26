-- 0006 — Reels freshness (PRD/14): support the "New" tab badge + hourly auto-pull.
-- Additive/idempotent. Apply with `pnpm db:migrate`.

-- When the reel ROW was added to our catalog (distinct from published_at, the
-- video's own upload date). Drives "new since you last looked" + hourly ingest.
alter table public.reels add column if not exists created_at timestamptz not null default now();

-- When this user last opened the Reels feed. If the newest approved reel's
-- created_at is later than this, the Reels tab shows a "New" badge.
alter table public.profiles add column if not exists reels_seen_at timestamptz;

-- Fast "is there anything newer than X" + freshest-first ordering.
create index if not exists reels_status_created_idx on public.reels (status, created_at desc);

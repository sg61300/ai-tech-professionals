-- Seed / curate Reels (PRD/14). The feed reads rows where status='approved'.
-- These are real YouTube SHORTS (vertical, ≤~1–3 min) on AI-for-HR topics —
-- demo curation to replace/extend with your own vetted HR-AI Shorts.
-- `youtube_id` is the 11-char id from a youtube.com/shorts/<id> URL.
-- `published_at` drives feed order (newest first).
--
-- Run:  node scripts/seed-reels.mjs   (loads .env.local, applies this file)
-- Idempotent: existing rows (same youtube_id) are left untouched.

insert into public.reels (youtube_id, title, channel, topic, tags, status, published_at)
values
  ('9wa-u1AUrLo', 'AI tools every HR pro needs in 2025', 'HR Tech',       'AI in HR',    array['ai','hr'],          'approved', now()),
  ('NfpnjEAlzYs', '5 AI tools for HR',                   'HR Tech',       'AI tools',    array['ai','hr'],          'approved', now() - interval '1 hour'),
  ('jJgPKjtkDzw', 'Mastering AI agents for recruiters',  'Talent Lab',    'Recruiting',  array['ai','hr','hiring'], 'approved', now() - interval '2 hours'),
  ('BI7EpyMxzC4', 'The future of hiring: 5 AI tools',    'Talent Lab',    'Hiring',      array['ai','hr','hiring'], 'approved', now() - interval '3 hours'),
  ('wAgezZstDf0', 'AI in HR: how Copilot transforms work','HR Tech',      'AI in HR',    array['ai','hr'],          'approved', now() - interval '4 hours'),
  ('5ijaf7i5TIY', 'Can AI agents replace HR?',           'HR Tech',       'AI in HR',    array['ai','hr'],          'approved', now() - interval '5 hours')
on conflict (youtube_id) do nothing;

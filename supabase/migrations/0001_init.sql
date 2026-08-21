-- ============================================================================
-- 0001_init — AI & Tech for Professionals (v0.1)
-- Data model per IMPLEMENTATION-PLAN §3. All user tables are RLS owner-only.
-- User data lives here ONLY (never git). Content is seeded separately (git wins).
-- ============================================================================

-- updated_at helper -----------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- profiles --------------------------------------------------------------------
create table public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  name                text,
  avatar_name         text,
  mobile              text,
  avatar_key          text,
  profession          text,
  seniority           text,
  ai_proficiency      text,
  timezone            text not null default 'Asia/Kolkata',
  onboarding_complete boolean not null default false,
  xp                  integer not null default 0,
  level               integer not null default 1,
  streak_count        integer not null default 0,
  longest_streak      integer not null default 0,
  last_active_date    date,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create a bare profile when a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name'))
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- lesson_progress -------------------------------------------------------------
create table public.lesson_progress (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  lesson_id    text not null,
  status       text not null default 'available'
                 check (status in ('locked','available','done')),
  score        integer,
  completed_at timestamptz,
  unique (user_id, lesson_id)
);

-- sim_completions -------------------------------------------------------------
create table public.sim_completions (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  sim_id       text not null,
  rubric_json  jsonb,
  artifact_id  bigint,
  is_full      boolean not null default true,   -- taste sim = false
  completed_at timestamptz not null default now()
);
create index sim_completions_user_idx on public.sim_completions(user_id);

-- saved_artifacts (second brain) ---------------------------------------------
create table public.saved_artifacts (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  title      text not null,
  source_sim text,
  body       text not null,
  created_at timestamptz not null default now()
);
create index saved_artifacts_user_idx on public.saved_artifacts(user_id);
alter table public.sim_completions
  add constraint sim_completions_artifact_fk
  foreign key (artifact_id) references public.saved_artifacts(id) on delete set null;

-- daily_activity — powers the streak strip + north-star "returned separate day"
create table public.daily_activity (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users(id) on delete cascade,
  activity_date date not null,                  -- civil date in the user's tz
  unique (user_id, activity_date)
);
create index daily_activity_user_idx on public.daily_activity(user_id);

-- reels (editable approval queue) --------------------------------------------
create table public.reels (
  id           bigint generated always as identity primary key,
  youtube_id   text not null,
  tags         text[] not null default '{}',
  status       text not null default 'queued' check (status in ('queued','approved')),
  published_at timestamptz
);

create table public.reel_interactions (
  id      bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  reel_id bigint not null references public.reels(id) on delete cascade,
  type    text not null check (type in ('like','save','share','report')),
  created_at timestamptz not null default now(),
  unique (user_id, reel_id, type)
);

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.profiles          enable row level security;
alter table public.lesson_progress   enable row level security;
alter table public.sim_completions   enable row level security;
alter table public.saved_artifacts   enable row level security;
alter table public.daily_activity    enable row level security;
alter table public.reels             enable row level security;
alter table public.reel_interactions enable row level security;

-- Owner-only helper policies (select/insert/update/delete keyed to auth.uid()).
create policy "own profile"        on public.profiles          for all
  using (auth.uid() = id)      with check (auth.uid() = id);
create policy "own lesson_progress" on public.lesson_progress for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own sim_completions" on public.sim_completions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own saved_artifacts" on public.saved_artifacts for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own daily_activity"  on public.daily_activity  for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own reel_interactions" on public.reel_interactions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Reels: any authenticated user may read APPROVED reels; writes are service-role
-- only (the approval queue runs server-side, bypassing RLS via the admin client).
create policy "read approved reels" on public.reels for select
  to authenticated using (status = 'approved');

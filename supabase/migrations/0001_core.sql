-- =============================================================================
-- SmartQuiz — 0001_core.sql
-- Core schema: profiles, categories, questions, game sessions, answers,
-- achievements, daily challenges and leaderboard.
--
-- Security rule of this project: `question_options.is_correct` is NEVER
-- readable by the client. The table has RLS enabled with no SELECT policy and
-- the public view `public_question_options` exposes only safe columns.
-- Grading is done server-side (Phase 4 RPCs / service role).
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- utils
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique
    check (char_length(username) between 3 and 24),
  avatar_url text,
  locale text not null default 'fr' check (locale in ('fr', 'ar', 'en')),
  coins integer not null default 0 check (coins >= 0),
  xp integer not null default 0 check (xp >= 0),
  level integer not null default 1 check (level >= 1),
  rp integer not null default 0 check (rp >= 0),
  streak integer not null default 0 check (streak >= 0),
  best_streak integer not null default 0 check (best_streak >= 0),
  last_played_on date,
  adventure_level integer not null default 1 check (adventure_level >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

-- Anyone may read the public part of a profile... but only through the
-- leaderboard view; the raw row (email-derived data) stays private.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Clients may not write their own currency columns: only these are grantable.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (username, avatar_url, locale) on public.profiles to authenticated;

-- -----------------------------------------------------------------------------
-- profile creation (auth.users trigger + backfill helper)
-- -----------------------------------------------------------------------------
create or replace function public.ensure_profile(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_meta jsonb;
  v_base text;
  v_candidate text;
  v_locale text;
  v_n integer := 0;
begin
  if exists (select 1 from public.profiles where id = p_id) then
    return;
  end if;

  select u.email, coalesce(u.raw_user_meta_data, '{}'::jsonb)
    into v_email, v_meta
    from auth.users u
   where u.id = p_id;

  if not found then
    return;
  end if;

  v_base := left(
    regexp_replace(
      coalesce(nullif(v_meta ->> 'username', ''), nullif(split_part(coalesce(v_email, ''), '@', 1), ''), 'player'),
      '[^a-zA-Z0-9_-]', '', 'g'
    ),
    18
  );
  if char_length(v_base) < 3 then
    v_base := 'player';
  end if;

  v_candidate := v_base;
  while exists (select 1 from public.profiles where username = v_candidate) loop
    v_n := v_n + 1;
    v_candidate := v_base || v_n::text;
  end loop;

  v_locale := lower(coalesce(v_meta ->> 'locale', 'fr'));
  if v_locale not in ('fr', 'ar', 'en') then
    v_locale := 'fr';
  end if;

  insert into public.profiles (id, username, avatar_url, locale)
  values (p_id, v_candidate, nullif(v_meta ->> 'avatar_url', ''), v_locale)
  on conflict (id) do nothing;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_profile(new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for accounts created before this migration.
select public.ensure_profile(id)
from auth.users
where id not in (select id from public.profiles);

-- -----------------------------------------------------------------------------
-- categories (ids mirror src/lib/game/categories.ts)
-- -----------------------------------------------------------------------------
create table if not exists public.categories (
  id text primary key,
  emoji text,
  sort_order integer not null default 0,
  is_active boolean not null default true
);

insert into public.categories (id, emoji, sort_order) values
  ('football', '⚽', 1),
  ('histoire', '🏛️', 2),
  ('geographie', '🌍', 3),
  ('sciences', '🔬', 4),
  ('mathematiques', '➗', 5),
  ('informatique', '💻', 6),
  ('litterature', '📚', 7),
  ('cinema', '🎬', 8),
  ('musique', '🎵', 9),
  ('jeux-video', '🎮', 10),
  ('anime-manga', '🌸', 11),
  ('animaux', '🐾', 12),
  ('cuisine', '🍳', 13),
  ('mythologie', '🐉', 14),
  ('espace', '🚀', 15),
  ('medecine', '🩺', 16),
  ('economie', '📈', 17),
  ('politique', '🏛', 18),
  ('inventions', '💡', 19),
  ('arts', '🎨', 20),
  ('langues', '🗣️', 21),
  ('automobile', '🏎️', 22),
  ('technologie', '⚙️', 23),
  ('culture-generale', '🧠', 24)
on conflict (id) do nothing;

alter table public.categories enable row level security;

drop policy if exists "categories_read" on public.categories;
create policy "categories_read" on public.categories
  for select to anon, authenticated
  using (is_active);

grant select on public.categories to anon, authenticated;

-- -----------------------------------------------------------------------------
-- questions / options
-- -----------------------------------------------------------------------------
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  category_id text not null references public.categories (id) on delete cascade,
  locale text not null check (locale in ('fr', 'ar', 'en')),
  prompt text not null,
  explanation text,
  difficulty smallint not null default 1 check (difficulty between 1 and 5),
  question_type text not null default 'qcm'
    check (question_type in ('qcm', 'true_false')),
  is_boss boolean not null default false,
  source text not null default 'manual' check (source in ('manual', 'ai')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists questions_pick_idx
  on public.questions (category_id, locale, difficulty, is_boss);

alter table public.questions enable row level security;

drop policy if exists "questions_read" on public.questions;
create policy "questions_read" on public.questions
  for select to authenticated
  using (true);

grant select on public.questions to authenticated;

create table if not exists public.question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  label text not null,
  is_correct boolean not null default false,
  position smallint not null check (position between 0 and 5),
  unique (question_id, position)
);

-- Exactly one correct option per question.
create unique index if not exists question_options_one_correct
  on public.question_options (question_id)
  where is_correct;

-- No policy at all: no anon/authenticated role can read this table.
alter table public.question_options enable row level security;

revoke all on public.question_options from anon, authenticated;

-- Safe read surface: options without the answer key.
create or replace view public.public_question_options
with (security_invoker = false) as
  select id, question_id, label, position
  from public.question_options;

revoke all on public.public_question_options from anon, authenticated;
grant select on public.public_question_options to authenticated;

-- -----------------------------------------------------------------------------
-- game sessions / answers
-- -----------------------------------------------------------------------------
create table if not exists public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  mode text not null default 'adventure'
    check (mode in ('adventure', 'category', 'daily', 'boss')),
  category_id text references public.categories (id) on delete set null,
  level integer not null default 1 check (level >= 1),
  score integer not null default 0 check (score >= 0),
  total integer not null default 0 check (total >= 0),
  coins_awarded integer not null default 0 check (coins_awarded >= 0),
  xp_awarded integer not null default 0 check (xp_awarded >= 0),
  status text not null default 'in_progress'
    check (status in ('in_progress', 'passed', 'failed', 'abandoned')),
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists game_sessions_user_idx
  on public.game_sessions (user_id, started_at desc);

alter table public.game_sessions enable row level security;

drop policy if exists "game_sessions_select_own" on public.game_sessions;
create policy "game_sessions_select_own" on public.game_sessions
  for select to authenticated
  using (auth.uid() = user_id);

grant select on public.game_sessions to authenticated;

create table if not exists public.answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  option_id uuid references public.question_options (id) on delete set null,
  is_correct boolean not null default false,
  time_ms integer check (time_ms >= 0),
  answered_at timestamptz not null default now(),
  unique (session_id, question_id)
);

alter table public.answers enable row level security;

drop policy if exists "answers_select_own" on public.answers;
create policy "answers_select_own" on public.answers
  for select to authenticated
  using (
    exists (
      select 1 from public.game_sessions s
      where s.id = answers.session_id and s.user_id = auth.uid()
    )
  );

grant select on public.answers to authenticated;

-- -----------------------------------------------------------------------------
-- achievements
-- -----------------------------------------------------------------------------
create table if not exists public.achievements (
  code text primary key,
  xp_reward integer not null default 0 check (xp_reward >= 0),
  coin_reward integer not null default 0 check (coin_reward >= 0)
);

insert into public.achievements (code, xp_reward, coin_reward) values
  ('first_level', 50, 25),
  ('perfect_level', 100, 50),
  ('first_boss', 250, 150),
  ('streak_7', 200, 100),
  ('streak_30', 1000, 500),
  ('level_10', 300, 150),
  ('level_50', 1500, 750),
  ('xp_1000', 0, 200)
on conflict (code) do nothing;

alter table public.achievements enable row level security;
drop policy if exists "achievements_read" on public.achievements;
create policy "achievements_read" on public.achievements
  for select to anon, authenticated using (true);
grant select on public.achievements to anon, authenticated;

create table if not exists public.user_achievements (
  user_id uuid not null references auth.users (id) on delete cascade,
  code text not null references public.achievements (code) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, code)
);

alter table public.user_achievements enable row level security;
drop policy if exists "user_achievements_select_own" on public.user_achievements;
create policy "user_achievements_select_own" on public.user_achievements
  for select to authenticated using (auth.uid() = user_id);
grant select on public.user_achievements to authenticated;

-- -----------------------------------------------------------------------------
-- daily challenge
-- -----------------------------------------------------------------------------
create table if not exists public.daily_challenges (
  challenge_date date primary key,
  category_id text references public.categories (id) on delete set null,
  question_count smallint not null default 10 check (question_count between 1 and 50),
  xp_bonus integer not null default 0 check (xp_bonus >= 0),
  coin_bonus integer not null default 0 check (coin_bonus >= 0)
);

alter table public.daily_challenges enable row level security;
drop policy if exists "daily_challenges_read" on public.daily_challenges;
create policy "daily_challenges_read" on public.daily_challenges
  for select to anon, authenticated using (true);
grant select on public.daily_challenges to anon, authenticated;

create table if not exists public.daily_results (
  user_id uuid not null references auth.users (id) on delete cascade,
  challenge_date date not null references public.daily_challenges (challenge_date) on delete cascade,
  score integer not null default 0 check (score >= 0),
  total integer not null default 0 check (total >= 0),
  completed_at timestamptz not null default now(),
  primary key (user_id, challenge_date)
);

alter table public.daily_results enable row level security;
drop policy if exists "daily_results_select" on public.daily_results;
create policy "daily_results_select" on public.daily_results
  for select to authenticated using (true);
grant select on public.daily_results to authenticated;

-- -----------------------------------------------------------------------------
-- leaderboard (public read model, no private columns)
-- -----------------------------------------------------------------------------
create or replace view public.leaderboard
with (security_invoker = false) as
  select
    p.id,
    p.username,
    p.avatar_url,
    p.level,
    p.xp,
    p.rp,
    rank() over (order by p.xp desc, p.rp desc, p.created_at asc) as rank
  from public.profiles p;

revoke all on public.leaderboard from anon, authenticated;
grant select on public.leaderboard to anon, authenticated;

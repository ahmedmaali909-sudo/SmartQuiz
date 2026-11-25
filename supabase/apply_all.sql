-- SmartQuiz — ALL MIGRATIONS (0001 → 0004) in one run.
-- Paste this whole file in Supabase → SQL Editor → Run. Idempotent: safe to re-run.


-- ===== 0001_core.sql =====

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

-- ===== 0002_game_engine.sql =====

-- =============================================================================
-- SmartQuiz — 0002_game_engine.sql
-- Server-side game engine (no answer key ever leaves the database):
--   * game_start   – draws 10 questions (15 for a boss level, every 10th level)
--   * game_state   – returns the next unanswered question, without is_correct
--   * game_answer  – grades an answer server-side
--   * game_finish  – computes the result, rewards coins/XP/RP and progression
-- All functions are SECURITY DEFINER and only usable by the session owner.
-- =============================================================================

alter table public.game_sessions
  add column if not exists question_ids uuid[] not null default '{}';

-- -----------------------------------------------------------------------------
-- draw a level
-- -----------------------------------------------------------------------------
create or replace function public.game_start(
  p_mode text default 'adventure',
  p_category text default null,
  p_level integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_profile record;
  v_level integer;
  v_target integer;
  v_is_boss boolean;
  v_ids uuid[];
  v_session uuid;
  v_mode text;
begin
  if v_uid is null then
    return jsonb_build_object('error', 'not_authenticated');
  end if;

  select id, adventure_level, locale into v_profile
    from public.profiles where id = v_uid;
  if not found then
    return jsonb_build_object('error', 'profile_missing');
  end if;

  v_mode := coalesce(nullif(p_mode, ''), 'adventure');
  if v_mode not in ('adventure', 'category', 'daily', 'boss') then
    v_mode := 'adventure';
  end if;

  v_level := greatest(coalesce(p_level, v_profile.adventure_level), 1);
  v_is_boss := (v_level % 10) = 0;
  v_target := case when v_is_boss then 15 else 10 end;

  select coalesce(array_agg(s.id), '{}') into v_ids
  from (
    select q.id
    from public.questions q
    where (p_category is null or q.category_id = p_category)
      and q.is_boss = v_is_boss
    order by (q.locale = v_profile.locale) desc, random()
    limit v_target
  ) s;

  if coalesce(array_length(v_ids, 1), 0) = 0 then
    return jsonb_build_object('error', 'no_questions');
  end if;

  insert into public.game_sessions (user_id, mode, category_id, level, total, question_ids)
  values (
    v_uid,
    case when v_is_boss then 'boss' else v_mode end,
    p_category,
    v_level,
    array_length(v_ids, 1),
    v_ids
  )
  returning id into v_session;

  return jsonb_build_object(
    'session_id', v_session,
    'level', v_level,
    'total', array_length(v_ids, 1),
    'is_boss', v_is_boss
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- current question of a session
-- -----------------------------------------------------------------------------
create or replace function public.game_state(p_session uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_session record;
  v_answered integer;
  v_score integer;
  v_qid uuid;
  v_question record;
  v_options jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('error', 'not_authenticated');
  end if;

  select * into v_session
    from public.game_sessions
   where id = p_session and user_id = v_uid;
  if not found then
    return jsonb_build_object('error', 'session_not_found');
  end if;

  select count(*), count(*) filter (where a.is_correct)
    into v_answered, v_score
    from public.answers a
   where a.session_id = p_session;

  select t.qid into v_qid
  from unnest(v_session.question_ids) with ordinality as t(qid, ord)
  where t.qid not in (
    select a.question_id from public.answers a where a.session_id = p_session
  )
  order by t.ord
  limit 1;

  if v_qid is null then
    return jsonb_build_object(
      'session_id', v_session.id,
      'status', v_session.status,
      'level', v_session.level,
      'is_boss', (v_session.level % 10) = 0,
      'total', v_session.total,
      'answered', v_answered,
      'score', v_score,
      'finished', true,
      'question', null
    );
  end if;

  select q.id, q.prompt, q.category_id into v_question
    from public.questions q where q.id = v_qid;

  select coalesce(
           jsonb_agg(jsonb_build_object('id', o.id, 'label', o.label) order by o.position),
           '[]'::jsonb
         )
    into v_options
    from public.question_options o
   where o.question_id = v_qid;

  return jsonb_build_object(
    'session_id', v_session.id,
    'status', v_session.status,
    'level', v_session.level,
    'is_boss', (v_session.level % 10) = 0,
    'total', v_session.total,
    'answered', v_answered,
    'score', v_score,
    'finished', false,
    'question', jsonb_build_object(
      'id', v_question.id,
      'prompt', v_question.prompt,
      'category', v_question.category_id,
      'options', v_options
    )
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- grade one answer
-- -----------------------------------------------------------------------------
create or replace function public.game_answer(
  p_session uuid,
  p_question uuid,
  p_option uuid,
  p_time_ms integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_session record;
  v_correct_option uuid;
  v_is_correct boolean;
  v_explanation text;
  v_score integer;
begin
  if v_uid is null then
    return jsonb_build_object('error', 'not_authenticated');
  end if;

  select * into v_session
    from public.game_sessions
   where id = p_session and user_id = v_uid and status = 'in_progress';
  if not found then
    return jsonb_build_object('error', 'session_not_found');
  end if;

  if not (p_question = any (v_session.question_ids)) then
    return jsonb_build_object('error', 'invalid_question');
  end if;

  if exists (
    select 1 from public.answers a
     where a.session_id = p_session and a.question_id = p_question
  ) then
    return jsonb_build_object('error', 'already_answered');
  end if;

  select o.id into v_correct_option
    from public.question_options o
   where o.question_id = p_question and o.is_correct
   limit 1;

  if v_correct_option is null then
    return jsonb_build_object('error', 'question_has_no_answer');
  end if;

  v_is_correct := (p_option = v_correct_option);

  insert into public.answers (session_id, question_id, option_id, is_correct, time_ms)
  values (
    p_session,
    p_question,
    p_option,
    v_is_correct,
    greatest(coalesce(p_time_ms, 0), 0)
  );

  update public.game_sessions
     set score = score + case when v_is_correct then 1 else 0 end
   where id = p_session
  returning score into v_score;

  select explanation into v_explanation from public.questions where id = p_question;

  return jsonb_build_object(
    'correct', v_is_correct,
    'correct_option', v_correct_option,
    'explanation', v_explanation,
    'score', v_score
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- finish a level: 70% correct required, rewards + progression
-- -----------------------------------------------------------------------------
create or replace function public.game_finish(p_session uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_session record;
  v_threshold integer;
  v_passed boolean;
  v_coins integer;
  v_xp integer;
  v_rp integer;
  v_streak integer;
  v_level integer;
  v_adventure integer;
begin
  if v_uid is null then
    return jsonb_build_object('error', 'not_authenticated');
  end if;

  select * into v_session
    from public.game_sessions
   where id = p_session and user_id = v_uid;
  if not found then
    return jsonb_build_object('error', 'session_not_found');
  end if;

  if v_session.status <> 'in_progress' then
    return jsonb_build_object(
      'status', v_session.status,
      'score', v_session.score,
      'total', v_session.total,
      'coins', v_session.coins_awarded,
      'xp', v_session.xp_awarded,
      'already_finished', true
    );
  end if;

  v_threshold := greatest(1, ceil(v_session.total * 0.7)::integer);
  v_passed := v_session.score >= v_threshold;
  v_coins := v_session.score * 5 + case when v_passed then 20 else 0 end;
  v_xp := v_session.score * 10 + case when v_passed then 50 else 0 end;
  v_rp := v_session.score + case when v_passed then 10 else 0 end;

  update public.game_sessions
     set status = case when v_passed then 'passed' else 'failed' end,
         finished_at = now(),
         coins_awarded = v_coins,
         xp_awarded = v_xp
   where id = p_session;

  update public.profiles p
     set coins = p.coins + v_coins,
         xp = p.xp + v_xp,
         rp = p.rp + v_rp,
         level = greatest(p.level, 1 + ((p.xp + v_xp) / 500)),
         adventure_level = case
           when v_passed and v_session.mode in ('adventure', 'boss')
             then greatest(p.adventure_level, v_session.level + 1)
           else p.adventure_level
         end,
         streak = case
           when p.last_played_on = current_date then p.streak
           when p.last_played_on = current_date - 1 then p.streak + 1
           else 1
         end,
         best_streak = greatest(p.best_streak, case
           when p.last_played_on = current_date then p.streak
           when p.last_played_on = current_date - 1 then p.streak + 1
           else 1
         end),
         last_played_on = current_date
   where p.id = v_uid
  returning p.level, p.adventure_level into v_level, v_adventure;

  insert into public.user_achievements (user_id, code)
  select v_uid, c.code
  from (values ('first_level'), ('perfect_level')) as c(code)
  where (c.code = 'first_level' and v_passed)
     or (c.code = 'perfect_level' and v_session.score = v_session.total)
  on conflict do nothing;

  insert into public.user_achievements (user_id, code)
  select v_uid, c.code
  from (values ('streak_7'), ('streak_30'), ('level_10'), ('level_50')) as c(code)
  where exists (
    select 1 from public.profiles p
    where p.id = v_uid
      and ((c.code = 'streak_7' and p.streak >= 7)
        or (c.code = 'streak_30' and p.streak >= 30)
        or (c.code = 'level_10' and p.level >= 10)
        or (c.code = 'level_50' and p.level >= 50))
  )
  on conflict do nothing;

  return jsonb_build_object(
    'status', case when v_passed then 'passed' else 'failed' end,
    'passed', v_passed,
    'score', v_session.score,
    'total', v_session.total,
    'threshold', v_threshold,
    'coins', v_coins,
    'xp', v_xp,
    'rp', v_rp,
    'level', v_level,
    'adventure_level', v_adventure
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- privileges: authenticated only, never anon
-- -----------------------------------------------------------------------------
revoke all on function public.game_start(text, text, integer) from public, anon;
revoke all on function public.game_state(uuid) from public, anon;
revoke all on function public.game_answer(uuid, uuid, uuid, integer) from public, anon;
revoke all on function public.game_finish(uuid) from public, anon;

grant execute on function public.game_start(text, text, integer) to authenticated;
grant execute on function public.game_state(uuid) to authenticated;
grant execute on function public.game_answer(uuid, uuid, uuid, integer) to authenticated;
grant execute on function public.game_finish(uuid) to authenticated;

-- ===== 0003_seed_demo_questions.sql =====

-- =============================================================================
-- SmartQuiz — 0003_seed_demo_questions.sql
-- DEMO CONTENT ONLY: 15 French questions to exercise the game engine before the
-- AI generation phase. Delete them with:
--   delete from public.questions where category_id = 'culture-generale' and source = 'manual';
-- =============================================================================

with data(prompt, correct, w1, w2, w3, explanation, is_boss) as (
  values
    ('Quelle est la capitale de l''Australie ?', 'Canberra', 'Sydney', 'Melbourne', 'Perth', 'Sydney est la plus grande ville, mais Canberra est la capitale fédérale.', false),
    ('Combien de continents compte la Terre ?', '7', '5', '6', '8', 'Afrique, Amérique du Nord, Amérique du Sud, Antarctique, Asie, Europe, Océanie.', false),
    ('Quel est le plus long fleuve du monde ?', 'Le Nil', 'L''Amazone', 'Le Danube', 'Le Mississippi', 'Le Nil est généralement cité en premier, suivi de près par l''Amazone.', false),
    ('Qui a peint la Joconde ?', 'Léonard de Vinci', 'Michel-Ange', 'Raphaël', 'Botticelli', 'La Joconde est exposée au Louvre, à Paris.', false),
    ('Quel est le symbole chimique de l''or ?', 'Au', 'Ag', 'Or', 'Go', 'Au vient du latin aurum.', false),
    ('En quelle année l''homme a-t-il marché sur la Lune ?', '1969', '1959', '1972', '1965', 'Mission Apollo 11, le 20 juillet 1969.', false),
    ('Combien de joueurs composent une équipe de football sur le terrain ?', '11', '10', '12', '9', 'Dix joueurs de champ et un gardien.', false),
    ('Quelle planète est la plus proche du Soleil ?', 'Mercure', 'Vénus', 'Mars', 'La Terre', 'Mercure boucle son orbite en 88 jours.', false),
    ('Quel océan est le plus vaste ?', 'L''océan Pacifique', 'L''océan Atlantique', 'L''océan Indien', 'L''océan Arctique', 'Le Pacifique couvre environ un tiers de la surface du globe.', false),
    ('Combien de côtés a un hexagone ?', '6', '5', '7', '8', 'Du grec hexa, « six ».', false),
    ('Qui a écrit « Les Misérables » ?', 'Victor Hugo', 'Émile Zola', 'Gustave Flaubert', 'Honoré de Balzac', 'Publié en 1862.', false),
    ('Quel est le plus grand désert chaud du monde ?', 'Le Sahara', 'Le Gobi', 'Le Kalahari', 'L''Atacama', 'Le Sahara s''étend sur environ 9 millions de km².', false),
    ('Quelle est la langue la plus parlée au monde par nombre de locuteurs natifs ?', 'Le mandarin', 'L''anglais', 'L''espagnol', 'L''hindi', 'Plus de 900 millions de locuteurs natifs.', true),
    ('Quel organe produit l''insuline ?', 'Le pancréas', 'Le foie', 'Les reins', 'La thyroïde', 'Les îlots de Langerhans du pancréas la sécrètent.', true),
    ('Quelle est l''unité de mesure de la puissance électrique ?', 'Le watt', 'Le volt', 'L''ampère', 'L''ohm', 'Le watt (W) mesure la puissance, le volt la tension.', true)
),
inserted as (
  insert into public.questions (category_id, locale, prompt, explanation, difficulty, is_boss, source)
  select 'culture-generale', 'fr', d.prompt, d.explanation, 2, d.is_boss, 'manual'
  from data d
  where not exists (
    select 1 from public.questions q
    where q.category_id = 'culture-generale' and q.locale = 'fr' and q.prompt = d.prompt
  )
  returning id, prompt
)
insert into public.question_options (question_id, label, is_correct, position)
select
  i.id,
  o.label,
  o.is_correct,
  ((o.position + char_length(d.prompt)) % 4)::smallint
from inserted i
join data d on d.prompt = i.prompt
cross join lateral (
  values
    (d.correct, true, 0),
    (d.w1, false, 1),
    (d.w2, false, 2),
    (d.w3, false, 3)
) as o(label, is_correct, position);

-- ===== 0004_daily_and_stats.sql =====

-- =============================================================================
-- SmartQuiz — 0004_daily_and_stats.sql
--   * ensure_daily_challenge : creates today's challenge row on demand
--   * category_stats          : public question counts per category
--   * game_finish (v2)        : + daily result recording, achievement rewards,
--                               boss / xp achievements, total rewards returned
-- =============================================================================

-- -----------------------------------------------------------------------------
-- daily challenge: a row per day, created lazily
-- -----------------------------------------------------------------------------
create or replace function public.ensure_daily_challenge(p_date date default current_date)
returns public.daily_challenges
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.daily_challenges;
begin
  insert into public.daily_challenges (challenge_date, category_id, question_count, xp_bonus, coin_bonus)
  values (p_date, null, 10, 100, 40)
  on conflict (challenge_date) do nothing;

  select * into v_row from public.daily_challenges where challenge_date = p_date;
  return v_row;
end;
$$;

revoke all on function public.ensure_daily_challenge(date) from public, anon;
grant execute on function public.ensure_daily_challenge(date) to authenticated;

-- -----------------------------------------------------------------------------
-- question counts per category (safe aggregate, no question content)
-- -----------------------------------------------------------------------------
create or replace view public.category_stats
with (security_invoker = false) as
  select
    q.category_id,
    count(*)::integer as question_count,
    count(*) filter (where q.is_boss)::integer as boss_count
  from public.questions q
  group by q.category_id;

revoke all on public.category_stats from anon, authenticated;
grant select on public.category_stats to anon, authenticated;

-- -----------------------------------------------------------------------------
-- game_finish v2
-- -----------------------------------------------------------------------------
create or replace function public.game_finish(p_session uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_session record;
  v_threshold integer;
  v_passed boolean;
  v_coins integer;
  v_xp integer;
  v_rp integer;
  v_level integer;
  v_adventure integer;
  v_before text[];
  v_axp integer := 0;
  v_acoin integer := 0;
begin
  if v_uid is null then
    return jsonb_build_object('error', 'not_authenticated');
  end if;

  select * into v_session
    from public.game_sessions
   where id = p_session and user_id = v_uid;
  if not found then
    return jsonb_build_object('error', 'session_not_found');
  end if;

  if v_session.status <> 'in_progress' then
    return jsonb_build_object(
      'status', v_session.status,
      'score', v_session.score,
      'total', v_session.total,
      'coins', v_session.coins_awarded,
      'xp', v_session.xp_awarded,
      'already_finished', true
    );
  end if;

  v_threshold := greatest(1, ceil(v_session.total * 0.7)::integer);
  v_passed := v_session.score >= v_threshold;
  v_coins := v_session.score * 5 + case when v_passed then 20 else 0 end;
  v_xp := v_session.score * 10 + case when v_passed then 50 else 0 end;
  v_rp := v_session.score + case when v_passed then 10 else 0 end;

  update public.game_sessions
     set status = case when v_passed then 'passed' else 'failed' end,
         finished_at = now(),
         coins_awarded = v_coins,
         xp_awarded = v_xp
   where id = p_session;

  update public.profiles p
     set coins = p.coins + v_coins,
         xp = p.xp + v_xp,
         rp = p.rp + v_rp,
         level = greatest(p.level, 1 + ((p.xp + v_xp) / 500)),
         adventure_level = case
           when v_passed and v_session.mode in ('adventure', 'boss')
             then greatest(p.adventure_level, v_session.level + 1)
           else p.adventure_level
         end,
         streak = case
           when p.last_played_on = current_date then p.streak
           when p.last_played_on = current_date - 1 then p.streak + 1
           else 1
         end,
         best_streak = greatest(p.best_streak, case
           when p.last_played_on = current_date then p.streak
           when p.last_played_on = current_date - 1 then p.streak + 1
           else 1
         end),
         last_played_on = current_date
   where p.id = v_uid
  returning p.level, p.adventure_level into v_level, v_adventure;

  -- ------------------------------------------------ daily challenge result
  if v_session.mode = 'daily' then
    perform public.ensure_daily_challenge(current_date);
    insert into public.daily_results (user_id, challenge_date, score, total, completed_at)
    values (v_uid, current_date, v_session.score, v_session.total, now())
    on conflict (user_id, challenge_date) do update
      set score = greatest(public.daily_results.score, excluded.score),
          total = excluded.total,
          completed_at = now();
  end if;

  -- ------------------------------------------------ achievements
  select coalesce(array_agg(ua.code), '{}') into v_before
    from public.user_achievements ua where ua.user_id = v_uid;

  insert into public.user_achievements (user_id, code)
  select v_uid, c.code
  from (values ('first_level'), ('perfect_level'), ('first_boss'), ('xp_1000')) as c(code)
  where (c.code = 'first_level' and v_passed)
     or (c.code = 'perfect_level' and v_session.score = v_session.total)
     or (c.code = 'first_boss' and v_passed and v_session.mode = 'boss')
     or (c.code = 'xp_1000' and (select p.xp from public.profiles p where p.id = v_uid) >= 1000)
  on conflict do nothing;

  insert into public.user_achievements (user_id, code)
  select v_uid, c.code
  from (values ('streak_7'), ('streak_30'), ('level_10'), ('level_50')) as c(code)
  where exists (
    select 1 from public.profiles p
    where p.id = v_uid
      and ((c.code = 'streak_7' and p.streak >= 7)
        or (c.code = 'streak_30' and p.streak >= 30)
        or (c.code = 'level_10' and p.level >= 10)
        or (c.code = 'level_50' and p.level >= 50))
  )
  on conflict do nothing;

  select coalesce(sum(a.xp_reward), 0), coalesce(sum(a.coin_reward), 0)
    into v_axp, v_acoin
    from public.achievements a
   where a.code in (
           select ua.code from public.user_achievements ua where ua.user_id = v_uid
         )
     and not (a.code = any (v_before));

  if v_axp > 0 or v_acoin > 0 then
    update public.profiles p
       set xp = p.xp + v_axp,
           coins = p.coins + v_acoin,
           level = greatest(p.level, 1 + ((p.xp + v_axp) / 500))
     where p.id = v_uid
    returning p.level into v_level;
  end if;

  return jsonb_build_object(
    'status', case when v_passed then 'passed' else 'failed' end,
    'passed', v_passed,
    'score', v_session.score,
    'total', v_session.total,
    'threshold', v_threshold,
    'coins', v_coins + v_acoin,
    'xp', v_xp + v_axp,
    'rp', v_rp,
    'achievement_xp', v_axp,
    'achievement_coins', v_acoin,
    'level', v_level,
    'adventure_level', v_adventure
  );
end;
$$;

revoke all on function public.game_finish(uuid) from public, anon;
grant execute on function public.game_finish(uuid) to authenticated;

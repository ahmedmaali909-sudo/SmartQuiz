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

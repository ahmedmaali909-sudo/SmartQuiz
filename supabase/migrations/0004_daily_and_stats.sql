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

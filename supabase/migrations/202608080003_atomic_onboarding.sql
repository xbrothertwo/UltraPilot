-- Saves all onboarding data in one database transaction.
create or replace function public.complete_onboarding(
  p_event_name text,
  p_target_year integer,
  p_event_distance_km integer,
  p_event_elevation_meters integer,
  p_support_mode text,
  p_weekly_distance_goal_km integer,
  p_primary_sport text,
  p_running_sessions_per_week integer,
  p_easy_run_with_cross_training boolean,
  p_before_late_shift_allowed boolean,
  p_after_night_shift_allowed boolean,
  p_workday_max_session_minutes integer,
  p_gym_summer_sessions integer,
  p_gym_winter_sessions integer,
  p_max_heart_rate integer,
  p_resting_heart_rate integer,
  p_ftp_watts integer
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();
  v_profile_rows integer;
begin
  if v_user_id is null then
    raise exception 'Nicht angemeldet.'
      using errcode = '42501';
  end if;

  insert into public.training_goals (
    user_id,
    event_name,
    target_year,
    event_distance_km,
    event_elevation_meters,
    support_mode,
    weekly_distance_goal_km,
    updated_at
  )
  values (
    v_user_id,
    p_event_name,
    p_target_year::smallint,
    p_event_distance_km,
    p_event_elevation_meters,
    p_support_mode,
    p_weekly_distance_goal_km,
    v_now
  )
  on conflict (user_id)
  do update set
    event_name = excluded.event_name,
    target_year = excluded.target_year,
    event_distance_km = excluded.event_distance_km,
    event_elevation_meters =
      excluded.event_elevation_meters,
    support_mode = excluded.support_mode,
    weekly_distance_goal_km =
      excluded.weekly_distance_goal_km,
    updated_at = excluded.updated_at;

  insert into public.training_preferences (
    user_id,
    primary_sport,
    running_sessions_per_week,
    easy_run_with_cross_training,
    before_late_shift_allowed,
    after_night_shift_allowed,
    workday_max_session_minutes,
    gym_summer_sessions,
    gym_winter_sessions,
    updated_at
  )
  values (
    v_user_id,
    p_primary_sport,
    p_running_sessions_per_week::smallint,
    p_easy_run_with_cross_training,
    p_before_late_shift_allowed,
    p_after_night_shift_allowed,
    p_workday_max_session_minutes,
    p_gym_summer_sessions::smallint,
    p_gym_winter_sessions::smallint,
    v_now
  )
  on conflict (user_id)
  do update set
    primary_sport = excluded.primary_sport,
    running_sessions_per_week =
      excluded.running_sessions_per_week,
    easy_run_with_cross_training =
      excluded.easy_run_with_cross_training,
    before_late_shift_allowed =
      excluded.before_late_shift_allowed,
    after_night_shift_allowed =
      excluded.after_night_shift_allowed,
    workday_max_session_minutes =
      excluded.workday_max_session_minutes,
    gym_summer_sessions =
      excluded.gym_summer_sessions,
    gym_winter_sessions =
      excluded.gym_winter_sessions,
    updated_at = excluded.updated_at;

  update public.profiles
  set
    max_heart_rate = p_max_heart_rate::smallint,
    resting_heart_rate =
      p_resting_heart_rate::smallint,
    ftp_watts = p_ftp_watts::smallint,
    onboarding_completed_at = v_now,
    updated_at = v_now
  where id = v_user_id;

  get diagnostics v_profile_rows = row_count;

  if v_profile_rows <> 1 then
    raise exception 'Das Benutzerprofil wurde nicht gefunden.';
  end if;
end;
$$;

revoke execute on function public.complete_onboarding(
  text,
  integer,
  integer,
  integer,
  text,
  integer,
  text,
  integer,
  boolean,
  boolean,
  boolean,
  integer,
  integer,
  integer,
  integer,
  integer,
  integer
) from public;

grant execute on function public.complete_onboarding(
  text,
  integer,
  integer,
  integer,
  text,
  integer,
  text,
  integer,
  boolean,
  boolean,
  boolean,
  integer,
  integer,
  integer,
  integer,
  integer,
  integer
) to authenticated;
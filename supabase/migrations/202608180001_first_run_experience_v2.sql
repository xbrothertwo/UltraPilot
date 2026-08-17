-- First-run profile fields and an atomic onboarding v2 aggregate.
-- This migration is additive apart from widening distance columns from integer
-- to numeric so standard event distances such as 21.1 and 42.195 are preserved.

alter table public.training_goals
  drop constraint if exists training_goals_event_distance_km_check;

alter table public.training_goals
  alter column event_distance_km type numeric(10,3)
    using event_distance_km::numeric,
  alter column weekly_distance_goal_km type numeric(10,1)
    using weekly_distance_goal_km::numeric,
  add column if not exists goal_type text,
  add column if not exists target_time_seconds integer;

update public.training_goals
set goal_type = case
  when event_name is not null then 'cycling_event'
  else 'consistency'
end
where goal_type is null;

alter table public.training_goals
  alter column goal_type set default 'consistency',
  alter column goal_type set not null,
  add constraint training_goals_goal_type_check check (
    goal_type in (
      'running_event', 'cycling_event', 'endurance', 'speed',
      'strength', 'hybrid', 'consistency', 'custom'
    )
  ),
  add constraint training_goals_event_distance_km_check check (
    event_distance_km is null or event_distance_km > 0
  ),
  add constraint training_goals_target_time_seconds_check check (
    target_time_seconds is null or target_time_seconds > 0
  );

alter table public.training_preferences
  add column if not exists selected_sports text[] not null default array['cycling']::text[],
  add column if not exists sport_priority text not null default 'cycling',
  add column if not exists current_weekly_distance_km numeric(10,1),
  add column if not exists cycling_sessions_per_week smallint not null default 3,
  add column if not exists volleyball_sessions_per_week smallint not null default 0,
  add column if not exists available_weekdays smallint[] not null default array[1,2,3,4,5,6,7]::smallint[],
  add column if not exists gym_experience text,
  add column if not exists gym_equipment text[] not null default '{}'::text[];

update public.training_preferences
set selected_sports = case
  when primary_sport = 'running' and greatest(gym_summer_sessions, gym_winter_sessions) > 0
    then array['running', 'strength']::text[]
  when primary_sport = 'cycling' and greatest(gym_summer_sessions, gym_winter_sessions) > 0
    then array['cycling', 'strength']::text[]
  else array[primary_sport]::text[]
end,
sport_priority = primary_sport
where selected_sports = array['cycling']::text[];

alter table public.training_preferences
  add constraint training_preferences_selected_sports_check check (
    cardinality(selected_sports) between 1 and 4
    and selected_sports <@ array['running', 'cycling', 'strength', 'volleyball']::text[]
  ),
  add constraint training_preferences_sport_priority_check check (
    sport_priority in ('running', 'cycling', 'strength', 'balanced')
  ),
  add constraint training_preferences_current_weekly_distance_check check (
    current_weekly_distance_km is null or current_weekly_distance_km between 0 and 2000
  ),
  add constraint training_preferences_cycling_sessions_check check (
    cycling_sessions_per_week between 0 and 7
  ),
  add constraint training_preferences_volleyball_sessions_check check (
    volleyball_sessions_per_week between 0 and 7
  ),
  add constraint training_preferences_available_weekdays_check check (
    cardinality(available_weekdays) between 1 and 7
    and available_weekdays <@ array[1,2,3,4,5,6,7]::smallint[]
  ),
  add constraint training_preferences_gym_experience_check check (
    gym_experience is null or gym_experience in ('beginner', 'intermediate', 'advanced')
  ),
  add constraint training_preferences_gym_equipment_check check (
    cardinality(gym_equipment) <= 20
  );

create or replace function public.complete_onboarding_v2(
  p_goal_type text,
  p_event_name text,
  p_target_date date,
  p_event_distance_km numeric,
  p_event_elevation_meters integer,
  p_target_time_seconds integer,
  p_support_mode text,
  p_weekly_distance_goal_km numeric,
  p_current_weekly_distance_km numeric,
  p_primary_sport text,
  p_selected_sports text[],
  p_sport_priority text,
  p_running_sessions_per_week integer,
  p_cycling_sessions_per_week integer,
  p_volleyball_sessions_per_week integer,
  p_easy_run_with_cross_training boolean,
  p_before_late_shift_allowed boolean,
  p_after_night_shift_allowed boolean,
  p_workday_max_session_minutes integer,
  p_available_weekdays smallint[],
  p_gym_summer_sessions integer,
  p_gym_winter_sessions integer,
  p_gym_experience text,
  p_gym_equipment text[],
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
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  insert into public.training_goals (
    user_id, goal_type, event_name, target_year, target_date,
    event_distance_km, event_elevation_meters, target_time_seconds,
    support_mode, weekly_distance_goal_km, updated_at
  ) values (
    v_user_id, p_goal_type, p_event_name,
    case when p_target_date is null then null else extract(year from p_target_date)::smallint end,
    p_target_date, p_event_distance_km, p_event_elevation_meters,
    p_target_time_seconds, p_support_mode, p_weekly_distance_goal_km, v_now
  )
  on conflict (user_id) do update set
    goal_type = excluded.goal_type,
    event_name = excluded.event_name,
    target_year = excluded.target_year,
    target_date = excluded.target_date,
    event_distance_km = excluded.event_distance_km,
    event_elevation_meters = excluded.event_elevation_meters,
    target_time_seconds = excluded.target_time_seconds,
    support_mode = excluded.support_mode,
    weekly_distance_goal_km = excluded.weekly_distance_goal_km,
    updated_at = excluded.updated_at;

  insert into public.training_preferences (
    user_id, primary_sport, selected_sports, sport_priority,
    current_weekly_distance_km, running_sessions_per_week,
    cycling_sessions_per_week, volleyball_sessions_per_week,
    easy_run_with_cross_training, before_late_shift_allowed,
    after_night_shift_allowed, workday_max_session_minutes,
    available_weekdays, gym_summer_sessions, gym_winter_sessions,
    gym_experience, gym_equipment, updated_at
  ) values (
    v_user_id, p_primary_sport, p_selected_sports, p_sport_priority,
    p_current_weekly_distance_km, p_running_sessions_per_week::smallint,
    p_cycling_sessions_per_week::smallint, p_volleyball_sessions_per_week::smallint,
    p_easy_run_with_cross_training, p_before_late_shift_allowed,
    p_after_night_shift_allowed, p_workday_max_session_minutes,
    p_available_weekdays, p_gym_summer_sessions::smallint,
    p_gym_winter_sessions::smallint, p_gym_experience,
    coalesce(p_gym_equipment, '{}'::text[]), v_now
  )
  on conflict (user_id) do update set
    primary_sport = excluded.primary_sport,
    selected_sports = excluded.selected_sports,
    sport_priority = excluded.sport_priority,
    current_weekly_distance_km = excluded.current_weekly_distance_km,
    running_sessions_per_week = excluded.running_sessions_per_week,
    cycling_sessions_per_week = excluded.cycling_sessions_per_week,
    volleyball_sessions_per_week = excluded.volleyball_sessions_per_week,
    easy_run_with_cross_training = excluded.easy_run_with_cross_training,
    before_late_shift_allowed = excluded.before_late_shift_allowed,
    after_night_shift_allowed = excluded.after_night_shift_allowed,
    workday_max_session_minutes = excluded.workday_max_session_minutes,
    available_weekdays = excluded.available_weekdays,
    gym_summer_sessions = excluded.gym_summer_sessions,
    gym_winter_sessions = excluded.gym_winter_sessions,
    gym_experience = excluded.gym_experience,
    gym_equipment = excluded.gym_equipment,
    updated_at = excluded.updated_at;

  update public.profiles set
    max_heart_rate = p_max_heart_rate::smallint,
    resting_heart_rate = p_resting_heart_rate::smallint,
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

revoke all on function public.complete_onboarding_v2(
  text, text, date, numeric, integer, integer, text, numeric, numeric,
  text, text[], text, integer, integer, integer, boolean, boolean,
  boolean, integer, smallint[], integer, integer, text, text[],
  integer, integer, integer
) from public, anon;

grant execute on function public.complete_onboarding_v2(
  text, text, date, numeric, integer, integer, text, numeric, numeric,
  text, text[], text, integer, integer, integer, boolean, boolean,
  boolean, integer, smallint[], integer, integer, text, text[],
  integer, integer, integer
) to authenticated;

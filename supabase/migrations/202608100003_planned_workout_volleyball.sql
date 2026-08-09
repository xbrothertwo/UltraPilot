-- Volleyball becomes a real sport_type for planned workouts, matching
-- activities.sport_type. Planning must recognize it structurally, not by
-- matching the word "Volleyball" in a workout's title.
alter table public.planned_workouts
  drop constraint if exists planned_workouts_sport_type_check;
alter table public.planned_workouts
  add constraint planned_workouts_sport_type_check
  check (sport_type in ('cycling', 'running', 'strength', 'volleyball', 'mobility', 'recovery', 'other'));

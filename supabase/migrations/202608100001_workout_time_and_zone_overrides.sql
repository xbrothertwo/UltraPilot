-- Optional preferred start time and manual HF-/power-zone overrides for
-- planned workouts, independent of the intensity-derived defaults.
alter table public.planned_workouts
  add column if not exists preferred_start_time time,
  add column if not exists target_heart_rate_zone text,
  add column if not exists target_power_zone text;

alter table public.planned_workouts
  add constraint planned_workouts_target_heart_rate_zone_check check (target_heart_rate_zone is null or target_heart_rate_zone in ('Z1', 'Z2', 'Z3', 'Z4', 'Z5'));
alter table public.planned_workouts
  add constraint planned_workouts_target_power_zone_check check (target_power_zone is null or target_power_zone in ('Z1', 'Z2', 'Z3', 'Z4', 'Z5', 'Z6', 'Z7'));

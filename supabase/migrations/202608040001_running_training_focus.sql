-- Per-user training focus and running workouts in the deterministic calendar.
alter table public.training_preferences
  add column if not exists primary_sport text not null default 'cycling';

alter table public.training_preferences
  drop constraint if exists training_preferences_primary_sport_check;

alter table public.training_preferences
  add constraint training_preferences_primary_sport_check
  check (primary_sport in ('cycling', 'running'));

alter table public.planned_workouts
  drop constraint if exists planned_workouts_sport_type_check;

alter table public.planned_workouts
  add constraint planned_workouts_sport_type_check
  check (sport_type in ('cycling', 'running', 'strength', 'mobility', 'recovery', 'other'));

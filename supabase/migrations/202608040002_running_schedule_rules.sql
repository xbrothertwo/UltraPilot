-- Personal running frequency and safe same-day cross-training preference.
alter table public.training_preferences
  add column if not exists running_sessions_per_week smallint not null default 3,
  add column if not exists easy_run_with_cross_training boolean not null default false;

alter table public.training_preferences
  drop constraint if exists training_preferences_running_sessions_check;

alter table public.training_preferences
  add constraint training_preferences_running_sessions_check
  check (running_sessions_per_week between 1 and 7);

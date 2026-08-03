-- Adds ultracycling-specific subjective feedback fields without changing existing data.
alter table public.subjective_feedback
  add column stomach_tolerance smallint check (stomach_tolerance between 1 and 10),
  add column sleep_quality smallint check (sleep_quality between 1 and 10);


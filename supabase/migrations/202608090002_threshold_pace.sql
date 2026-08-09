alter table public.profiles
  add column if not exists threshold_pace_seconds_per_km integer;

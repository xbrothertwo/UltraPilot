-- Allow Apple Health workouts while keeping imports idempotent.
alter table public.activities
  drop constraint if exists activities_sport_type_check;

alter table public.activities
  add constraint activities_sport_type_check
  check (sport_type in ('cycling', 'running', 'strength', 'volleyball', 'other'));

alter table public.activities
  add column if not exists external_id text;

create unique index if not exists activities_user_source_external_idx
  on public.activities(user_id, source, external_id)
  where external_id is not null;


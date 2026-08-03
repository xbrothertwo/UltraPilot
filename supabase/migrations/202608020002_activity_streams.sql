-- Adds multi-source time series for Garmin + Apple Watch activity fusion.
alter table public.activity_files
  add column file_role text not null default 'primary' check (file_role in ('primary', 'heart_rate_supplement')),
  add column source_device text;

create table public.activity_streams (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  stream_type text not null check (stream_type in ('heart_rate', 'power', 'cadence', 'speed', 'altitude')),
  source text not null check (source in ('garmin_edge', 'apple_watch', 'gpx')),
  unit text not null check (unit in ('bpm', 'watt', 'rpm', 'mps', 'meter')),
  sample_count integer not null check (sample_count > 0),
  start_time timestamptz not null,
  end_time timestamptz not null,
  samples jsonb not null check (jsonb_typeof(samples) = 'array'),
  created_at timestamptz not null default now(),
  unique (activity_id, stream_type, source),
  check (start_time <= end_time)
);

create index activity_streams_activity_idx on public.activity_streams(activity_id, stream_type);
alter table public.activity_streams enable row level security;
create policy "activity_streams_owner_all" on public.activity_streams
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

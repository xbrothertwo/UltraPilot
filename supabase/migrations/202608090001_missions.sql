-- Stores user-created and automatically derived missions.
create table public.missions (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  source text not null
    check (source in ('derived', 'custom')),

  derived_key text,

  title text not null
    check (char_length(title) between 1 and 200),

  description text
    check (
      description is null
      or char_length(description) <= 2000
    ),

  sport_type text not null
    check (sport_type in ('cycling', 'running')),

  status text not null default 'draft'
    check (
      status in (
        'draft',
        'planned',
        'completed',
        'archived'
      )
    ),

  target_date date,

  start_at timestamptz,

  distance_km numeric(8,1) not null
    check (
      distance_km > 0
      and distance_km <= 10000
    ),

  elevation_meters integer not null default 0
    check (
      elevation_meters >= 0
      and elevation_meters <= 100000
    ),

  average_speed_kmh numeric(5,2)
    check (
      average_speed_kmh is null
      or average_speed_kmh between 2 and 60
    ),

  pace_seconds_per_km integer
    check (
      pace_seconds_per_km is null
      or pace_seconds_per_km between 120 and 1800
    ),

  stop_interval_km numeric(8,1) not null
    check (
      stop_interval_km > 0
      and stop_interval_km <= 500
    ),

  stop_duration_minutes integer not null default 0
    check (
      stop_duration_minutes between 0 and 240
    ),

  carbohydrates_per_hour integer not null default 0
    check (
      carbohydrates_per_hour between 0 and 150
    ),

  fluid_milliliters_per_hour integer not null default 0
    check (
      fluid_milliliters_per_hour between 0 and 2000
    ),

  sodium_milligrams_per_hour integer not null default 0
    check (
      sodium_milligrams_per_hour between 0 and 3000
    ),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (
    (
      sport_type = 'cycling'
      and average_speed_kmh is not null
      and pace_seconds_per_km is null
    )
    or
    (
      sport_type = 'running'
      and pace_seconds_per_km is not null
      and average_speed_kmh is null
    )
  )
);

create unique index missions_user_derived_key_idx
  on public.missions (
    user_id,
    derived_key
  )
  where derived_key is not null;

create index missions_user_status_idx
  on public.missions (
    user_id,
    status,
    target_date
  );

alter table public.missions
  enable row level security;

create policy "missions_owner_all"
  on public.missions
  for all
  using (
    auth.uid() = user_id
  )
  with check (
    auth.uid() = user_id
  );
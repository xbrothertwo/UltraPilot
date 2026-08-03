-- Personal RAG goal, schedule imports and deterministic planning preferences.
create table public.training_goals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  event_name text not null default 'Race Across Germany Nord–Süd',
  target_year smallint not null default 2028 check (target_year between 2026 and 2100),
  target_date date,
  event_distance_km integer not null default 1100 check (event_distance_km > 0),
  event_elevation_meters integer not null default 7500 check (event_elevation_meters >= 0),
  support_mode text not null default 'supported' check (support_mode in ('supported', 'nonsupported', 'open')),
  weekly_distance_goal_km integer not null default 125 check (weekly_distance_goal_km between 0 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.training_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  before_late_shift_allowed boolean not null default true,
  after_night_shift_allowed boolean not null default true,
  workday_max_session_minutes integer not null default 90 check (workday_max_session_minutes between 15 and 360),
  gym_summer_sessions smallint not null default 1 check (gym_summer_sessions between 0 and 7),
  gym_winter_sessions smallint not null default 2 check (gym_winter_sessions between 0 and 7),
  indoor_cycling_available_from date,
  strength_plan jsonb not null default '{}'::jsonb check (jsonb_typeof(strength_plan) = 'object'),
  updated_at timestamptz not null default now()
);

create table public.schedule_code_mappings (
  user_id uuid not null references auth.users(id) on delete cascade,
  code text not null check (char_length(code) between 1 and 100),
  event_kind text not null check (event_kind in ('work_early', 'work_late', 'work_night', 'work_day', 'appointment', 'vacation', 'free', 'other')),
  updated_at timestamptz not null default now(),
  primary key (user_id, code)
);

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_key text not null,
  title text not null check (char_length(title) between 1 and 200),
  event_kind text not null check (event_kind in ('work_early', 'work_late', 'work_night', 'work_day', 'appointment', 'vacation', 'free', 'other')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default false,
  source text not null default 'ics' check (source in ('ics', 'manual', 'google')),
  imported_at timestamptz not null default now(),
  unique (user_id, event_key),
  check (starts_at <= ends_at)
);

create index calendar_events_user_start_idx on public.calendar_events(user_id, starts_at);
alter table public.training_goals enable row level security;
alter table public.training_preferences enable row level security;
alter table public.schedule_code_mappings enable row level security;
alter table public.calendar_events enable row level security;
create policy "training_goals_owner_all" on public.training_goals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "training_preferences_owner_all" on public.training_preferences for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "schedule_code_mappings_owner_all" on public.schedule_code_mappings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "calendar_events_owner_all" on public.calendar_events for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


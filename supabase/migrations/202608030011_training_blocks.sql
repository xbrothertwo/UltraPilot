-- Deterministic four-week training blocks for progressive long rides.
create table public.training_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  block_type text not null default 'foundation' check (block_type in ('foundation')),
  start_date date not null,
  end_date date not null,
  base_weekly_distance_km numeric(7,2) not null check (base_weekly_distance_km between 20 and 2000),
  starting_long_ride_km numeric(7,2) not null check (starting_long_ride_km between 10 and 1000),
  recovery_week_percentage smallint not null default 100 check (recovery_week_percentage between 60 and 100),
  status text not null default 'active' check (status in ('active', 'completed', 'archived')),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  check (end_date >= start_date)
);

create unique index training_blocks_one_active_per_user on public.training_blocks(user_id) where status = 'active';

create table public.training_block_weeks (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references public.training_blocks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  week_number smallint not null check (week_number between 1 and 4),
  week_start date not null,
  phase text not null check (phase in ('foundation', 'build', 'peak', 'recovery')),
  target_distance_km numeric(7,2) not null check (target_distance_km between 0 and 2000),
  long_ride_target_km numeric(7,2) not null check (long_ride_target_km between 0 and 1000),
  tempo_session_target smallint not null default 0 check (tempo_session_target between 0 and 2),
  purpose text not null check (char_length(purpose) between 1 and 500),
  unique (block_id, week_number)
);

create index training_block_weeks_user_start_idx on public.training_block_weeks(user_id, week_start);
alter table public.training_blocks enable row level security;
alter table public.training_block_weeks enable row level security;
create policy "training_blocks_owner_all" on public.training_blocks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "training_block_weeks_owner_all" on public.training_block_weeks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

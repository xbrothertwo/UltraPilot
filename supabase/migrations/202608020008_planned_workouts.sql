-- Editable calendar workouts for the personal weekly training planner.
create table public.planned_workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scheduled_date date not null,
  sport_type text not null default 'cycling' check (sport_type in ('cycling', 'strength', 'mobility', 'recovery', 'other')),
  title text not null check (char_length(title) between 1 and 200),
  description text check (description is null or char_length(description) <= 3000),
  intensity text not null default 'endurance' check (intensity in ('recovery', 'easy', 'endurance', 'tempo', 'threshold', 'vo2', 'strength')),
  planned_duration_minutes integer check (planned_duration_minutes is null or planned_duration_minutes between 1 and 1440),
  planned_distance_km numeric(7,2) check (planned_distance_km is null or planned_distance_km between 0 and 2000),
  status text not null default 'planned' check (status in ('planned', 'completed', 'skipped')),
  linked_activity_id uuid references public.activities(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index planned_workouts_user_date_idx on public.planned_workouts(user_id, scheduled_date);
alter table public.planned_workouts enable row level security;
create policy "planned_workouts_owner_all" on public.planned_workouts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

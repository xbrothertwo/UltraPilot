-- UltraPilot initial schema. Run through the Supabase CLI or SQL editor.
create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  timezone text not null default 'Europe/Berlin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sport_type text not null check (sport_type in ('cycling', 'running', 'other')),
  activity_date timestamptz not null,
  title text not null check (char_length(title) between 1 and 200),
  distance_meters double precision not null default 0 check (distance_meters >= 0),
  moving_time_seconds integer not null default 0 check (moving_time_seconds >= 0),
  elapsed_time_seconds integer not null default 0 check (elapsed_time_seconds >= 0),
  elevation_gain_meters double precision not null default 0 check (elevation_gain_meters >= 0),
  average_speed_kmh double precision check (average_speed_kmh >= 0),
  average_heart_rate smallint check (average_heart_rate > 0),
  maximum_heart_rate smallint check (maximum_heart_rate > 0),
  average_power smallint check (average_power >= 0),
  normalized_power smallint check (normalized_power >= 0),
  source text not null default 'upload',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (moving_time_seconds <= elapsed_time_seconds),
  check (average_heart_rate is null or maximum_heart_rate is null or average_heart_rate <= maximum_heart_rate)
);

create table public.activity_files (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique,
  original_filename text not null,
  file_type text not null check (file_type in ('gpx', 'fit', 'tcx')),
  mime_type text,
  size_bytes bigint not null check (size_bytes > 0),
  created_at timestamptz not null default now()
);

create table public.activity_metrics (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null unique references public.activities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  track_point_count integer not null default 0 check (track_point_count >= 0),
  heart_rate_sample_count integer not null default 0 check (heart_rate_sample_count >= 0),
  calculation_version text not null,
  metrics jsonb not null default '{}'::jsonb,
  calculated_at timestamptz not null default now()
);

create table public.subjective_feedback (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null unique references public.activities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  perceived_exertion smallint check (perceived_exertion between 1 and 10),
  fatigue smallint check (fatigue between 1 and 10),
  mood smallint check (mood between 1 and 10),
  pain_notes text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.nutrition_entries (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  consumed_at_seconds integer check (consumed_at_seconds >= 0),
  description text not null,
  carbohydrates_grams numeric(7,2) check (carbohydrates_grams >= 0),
  fluid_milliliters integer check (fluid_milliliters >= 0),
  sodium_milligrams integer check (sodium_milligrams >= 0),
  calories integer check (calories >= 0),
  created_at timestamptz not null default now()
);

create table public.ai_analyses (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  model text,
  prompt_version text,
  analysis jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index activities_user_date_idx on public.activities(user_id, activity_date desc);
create index nutrition_entries_activity_idx on public.nutrition_entries(activity_id, consumed_at_seconds);
create index ai_analyses_activity_idx on public.ai_analyses(activity_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.activities enable row level security;
alter table public.activity_files enable row level security;
alter table public.activity_metrics enable row level security;
alter table public.subjective_feedback enable row level security;
alter table public.nutrition_entries enable row level security;
alter table public.ai_analyses enable row level security;

create policy "profiles_owner_all" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "activities_owner_all" on public.activities for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "activity_files_owner_all" on public.activity_files for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "activity_metrics_owner_all" on public.activity_metrics for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "subjective_feedback_owner_all" on public.subjective_feedback for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "nutrition_entries_owner_all" on public.nutrition_entries for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "ai_analyses_owner_all" on public.ai_analyses for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('activity-files', 'activity-files', false, 20971520, array['application/gpx+xml', 'application/xml', 'text/xml', 'application/octet-stream'])
on conflict (id) do nothing;

create policy "activity_files_storage_read" on storage.objects for select
using (bucket_id = 'activity-files' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "activity_files_storage_insert" on storage.objects for insert
with check (bucket_id = 'activity-files' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "activity_files_storage_delete" on storage.objects for delete
using (bucket_id = 'activity-files' and auth.uid()::text = (storage.foldername(name))[1]);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', new.email));
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

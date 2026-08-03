-- Daily Apple Health recovery metrics and a short subjective readiness check-in.
create table public.apple_health_daily_metrics (
  user_id uuid not null references auth.users(id) on delete cascade,
  metric_date date not null,
  sleep_start timestamptz,
  sleep_end timestamptz,
  asleep_minutes integer not null default 0 check (asleep_minutes between 0 and 1440),
  core_minutes integer not null default 0 check (core_minutes between 0 and 1440),
  deep_minutes integer not null default 0 check (deep_minutes between 0 and 1440),
  rem_minutes integer not null default 0 check (rem_minutes between 0 and 1440),
  awake_minutes integer not null default 0 check (awake_minutes between 0 and 1440),
  sleeping_average_heart_rate numeric(6,2),
  sleeping_minimum_heart_rate numeric(6,2),
  heart_rate_sample_count integer not null default 0 check (heart_rate_sample_count >= 0),
  hrv_sdnn_ms numeric(7,2),
  hrv_sample_count integer not null default 0 check (hrv_sample_count >= 0),
  resting_heart_rate numeric(6,2),
  source text not null default 'apple_health_export' check (source = 'apple_health_export'),
  imported_at timestamptz not null default now(),
  primary key (user_id, metric_date)
);

create table public.daily_readiness_checkins (
  user_id uuid not null references auth.users(id) on delete cascade,
  checkin_date date not null,
  sleep_quality smallint check (sleep_quality between 1 and 10),
  general_fatigue smallint check (general_fatigue between 1 and 10),
  leg_fatigue smallint check (leg_fatigue between 1 and 10),
  motivation smallint check (motivation between 1 and 10),
  pain_or_illness boolean not null default false,
  notes text check (notes is null or char_length(notes) <= 1000),
  updated_at timestamptz not null default now(),
  primary key (user_id, checkin_date)
);

create index apple_health_daily_metrics_user_date_idx on public.apple_health_daily_metrics(user_id, metric_date desc);
alter table public.apple_health_daily_metrics enable row level security;
alter table public.daily_readiness_checkins enable row level security;
create policy "apple_health_daily_metrics_owner_all" on public.apple_health_daily_metrics for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "daily_readiness_checkins_owner_all" on public.daily_readiness_checkins for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Adds user-provided physiological reference values and optional custom zones.
-- Values stay nullable: UltraPilot never estimates max HR, resting HR, or FTP.
alter table public.profiles
  add column max_heart_rate smallint check (max_heart_rate between 80 and 240),
  add column resting_heart_rate smallint check (resting_heart_rate between 25 and 120),
  add column ftp_watts smallint check (ftp_watts between 50 and 1000),
  add column heart_rate_zone_method text not null default 'max_hr'
    check (heart_rate_zone_method in ('max_hr', 'heart_rate_reserve', 'manual')),
  add column custom_heart_rate_boundaries jsonb
    check (custom_heart_rate_boundaries is null or jsonb_typeof(custom_heart_rate_boundaries) = 'array'),
  add column custom_power_boundaries jsonb
    check (custom_power_boundaries is null or jsonb_typeof(custom_power_boundaries) = 'array');


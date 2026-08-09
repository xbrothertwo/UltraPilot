-- A FIT file's actual recording device is not something the app can verify
-- from the file alone, so uploads must stop being labeled "garmin_edge" by
-- default. Adds a neutral "fit" stream source alongside the existing ones.
alter table public.activity_streams drop constraint activity_streams_source_check;
alter table public.activity_streams add constraint activity_streams_source_check check (source in ('garmin_edge', 'apple_watch', 'gpx', 'fit'));

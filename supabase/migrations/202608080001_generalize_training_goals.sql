-- Allow users to train without a predefined event
-- and remove legacy RAG-specific database defaults.

alter table public.training_goals
  alter column event_name drop default,
  alter column event_name drop not null,
  alter column target_year drop default,
  alter column target_year drop not null,
  alter column event_distance_km drop default,
  alter column event_distance_km drop not null,
  alter column event_elevation_meters drop default,
  alter column event_elevation_meters drop not null,
  alter column support_mode drop default,
  alter column support_mode drop not null;
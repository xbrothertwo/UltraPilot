-- Tracks whether a user has completed the first-run onboarding flow.
-- Existing users are backfilled as already onboarded so they are never
-- redirected into a flow they never asked for.
alter table public.profiles
  add column onboarding_completed_at timestamptz;

update public.profiles
  set onboarding_completed_at = now()
  where onboarding_completed_at is null;

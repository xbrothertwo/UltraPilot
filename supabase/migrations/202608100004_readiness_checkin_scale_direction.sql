-- Unify all daily check-in scales to 1 = sehr schlecht, 10 = sehr gut.
-- general_fatigue/leg_fatigue were the opposite direction from
-- sleep_quality/motivation, which was a real usability and
-- readiness-calculation risk. Renamed to match the new, positively framed
-- meaning, and existing values are inverted in place (11 - old_value maps
-- 1<->10, 2<->9, ... exactly) so stored history stays correct rather than
-- being silently reinterpreted.
alter table public.daily_readiness_checkins
  rename column general_fatigue to general_freshness;
alter table public.daily_readiness_checkins
  rename column leg_fatigue to leg_freshness;
update public.daily_readiness_checkins
  set general_freshness = 11 - general_freshness
  where general_freshness is not null;
update public.daily_readiness_checkins
  set leg_freshness = 11 - leg_freshness
  where leg_freshness is not null;

-- New field: overall well-being, same 1-10 direction as the others.
alter table public.daily_readiness_checkins
  add column if not exists wellbeing smallint check (wellbeing between 1 and 10);

-- Pain/illness becomes a severity scale instead of a plain flag, since a
-- yes/no checkbox can't distinguish "slightly sore" from "should not train".
alter table public.daily_readiness_checkins
  add column if not exists symptom_level text;
update public.daily_readiness_checkins
  set symptom_level = case when pain_or_illness then 'significant' else 'none' end
  where symptom_level is null;
alter table public.daily_readiness_checkins
  alter column symptom_level set default 'none',
  alter column symptom_level set not null;
alter table public.daily_readiness_checkins
  add constraint daily_readiness_checkins_symptom_level_check
  check (symptom_level in ('none', 'mild', 'significant', 'unsuitable'));
alter table public.daily_readiness_checkins
  drop column pain_or_illness;

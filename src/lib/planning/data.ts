
import { isDemoMode } from "@/lib/demo-data";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export type PlanningEvent = {
  id: string;
  title: string;
  eventKind: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
};

export type PrimarySport = "cycling" | "running";

export type SupportMode = "supported" | "nonsupported" | "open";

export type PlanningProfile = {
  primarySport: PrimarySport;
  runningSessionsPerWeek: number;
  easyRunWithCrossTraining: boolean;

  eventName: string | null;
  targetYear: number | null;
  eventDistanceKm: number | null;
  eventElevationMeters: number | null;
  supportMode: SupportMode | null;

  weeklyDistanceGoalKm: number;
  beforeLateShiftAllowed: boolean;
  afterNightShiftAllowed: boolean;
  workdayMaxSessionMinutes: number;
  gymSummerSessions: number;
  gymWinterSessions: number;
  indoorCyclingAvailableFrom: string | null;
  strengthPlan: Record<string, unknown>;
};

export const defaultPlanningProfile: PlanningProfile = {
  primarySport: "cycling",
  runningSessionsPerWeek: 3,
  easyRunWithCrossTraining: false,

  eventName: null,
  targetYear: null,
  eventDistanceKm: null,
  eventElevationMeters: null,
  supportMode: null,

  weeklyDistanceGoalKm: 125,
  beforeLateShiftAllowed: true,
  afterNightShiftAllowed: true,
  workdayMaxSessionMinutes: 90,
  gymSummerSessions: 1,
  gymWinterSessions: 2,
  indoorCyclingAvailableFrom: "2026-10-01",
  strengthPlan: {},
};

export async function getPlanningData(range?: {
  from: Date;
  until: Date;
}): Promise<{
  profile: PlanningProfile;
  events: PlanningEvent[];
  ready: boolean;
}> {
  if (isDemoMode) {
    return {
      profile: defaultPlanningProfile,
      events: [],
      ready: false,
    };
  }

  await requireUser();

  const supabase = await createClient();

  if (!supabase) {
    return {
      profile: defaultPlanningProfile,
      events: [],
      ready: false,
    };
  }

  const from = range?.from ?? new Date();
  const until = range?.until ?? new Date();

  if (!range) {
    from.setDate(from.getDate() - 14);
    until.setDate(until.getDate() + 90);
  }

  const [goalResult, preferencesResult, eventsResult] = await Promise.all([
    supabase
      .from("training_goals")
      .select(
        "event_name,target_year,event_distance_km,event_elevation_meters,support_mode,weekly_distance_goal_km",
      )
      .maybeSingle(),

    supabase
      .from("training_preferences")
      .select(
        "primary_sport,running_sessions_per_week,easy_run_with_cross_training,before_late_shift_allowed,after_night_shift_allowed,workday_max_session_minutes,gym_summer_sessions,gym_winter_sessions,indoor_cycling_available_from,strength_plan",
      )
      .maybeSingle(),

    supabase
      .from("calendar_events")
      .select("id,title,event_kind,starts_at,ends_at,all_day")
      .gte("ends_at", from.toISOString())
      .lte("starts_at", until.toISOString())
      .order("starts_at"),
  ]);

  if (
    goalResult.error ||
    preferencesResult.error ||
    eventsResult.error
  ) {
    return {
      profile: defaultPlanningProfile,
      events: [],
      ready: false,
    };
  }

  const goal = goalResult.data;
  const preferences = preferencesResult.data;

  const supportMode: SupportMode | null =
    goal?.support_mode === "supported" ||
    goal?.support_mode === "nonsupported" ||
    goal?.support_mode === "open"
      ? goal.support_mode
      : null;

  return {
    ready: true,

    profile: {
      primarySport:
        preferences?.primary_sport === "running"
          ? "running"
          : "cycling",

      runningSessionsPerWeek:
        preferences?.running_sessions_per_week ?? 3,

      easyRunWithCrossTraining:
        preferences?.easy_run_with_cross_training ?? false,

      eventName: goal?.event_name ?? null,
      targetYear: goal?.target_year ?? null,
      eventDistanceKm: goal?.event_distance_km ?? null,
      eventElevationMeters:
        goal?.event_elevation_meters ?? null,
      supportMode,

      weeklyDistanceGoalKm:
        goal?.weekly_distance_goal_km ?? 125,

      beforeLateShiftAllowed:
        preferences?.before_late_shift_allowed ?? true,

      afterNightShiftAllowed:
        preferences?.after_night_shift_allowed ?? true,

      workdayMaxSessionMinutes:
        preferences?.workday_max_session_minutes ?? 90,

      gymSummerSessions:
        preferences?.gym_summer_sessions ?? 1,

      gymWinterSessions:
        preferences?.gym_winter_sessions ?? 2,

      indoorCyclingAvailableFrom:
        preferences?.indoor_cycling_available_from ??
        "2026-10-01",

      strengthPlan:
        (preferences?.strength_plan as Record<
          string,
          unknown
        > | null) ?? {},
    },

    events: (eventsResult.data ?? []).map((event) => ({
      id: event.id,
      title: event.title,
      eventKind: event.event_kind,
      startsAt: event.starts_at,
      endsAt: event.ends_at,
      allDay: event.all_day,
    })),
  };
}
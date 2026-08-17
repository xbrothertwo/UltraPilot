import { isDemoMode } from "@/lib/demo-data";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { parsePrimarySport, type PrimarySport } from "@/lib/sports";
import type { OnboardingGoalType } from "@/lib/onboarding-input";
import type { OnboardingSport } from "@/lib/onboarding-planning";

export type PlanningEvent = {
  id: string;
  title: string;
  eventKind: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
};

export type SupportMode = "supported" | "nonsupported" | "open";
export type PrimarySportResolution =
  | { status: "valid"; value: PrimarySport }
  | { status: "missing" | "invalid" | "load_error"; value: null };
export type WeeklyGoalResolution =
  | { status: "valid"; value: number }
  | { status: "missing" | "invalid" | "load_error"; value: null };

export function resolvePrimarySport(
  value: unknown,
  loadError = false,
): PrimarySportResolution {
  if (loadError) return { status: "load_error", value: null };
  const primarySport = parsePrimarySport(value);
  if (primarySport) return { status: "valid", value: primarySport };
  return value === null || value === undefined
    ? { status: "missing", value: null }
    : { status: "invalid", value: null };
}

export type PlanningProfile = {
  primarySport: PrimarySport;
  selectedSports: OnboardingSport[];
  sportPriority: "running" | "cycling" | "strength" | "balanced";
  runningSessionsPerWeek: number;
  cyclingSessionsPerWeek: number;
  volleyballSessionsPerWeek: number;
  easyRunWithCrossTraining: boolean;

  goalType: OnboardingGoalType;
  eventName: string | null;
  targetYear: number | null;
  targetDate: string | null;
  eventDistanceKm: number | null;
  eventElevationMeters: number | null;
  targetTimeSeconds: number | null;
  supportMode: SupportMode | null;

  weeklyDistanceGoalKm: number;
  currentWeeklyDistanceKm: number | null;
  beforeLateShiftAllowed: boolean;
  afterNightShiftAllowed: boolean;
  workdayMaxSessionMinutes: number;
  availableWeekdays: number[];
  gymSummerSessions: number;
  gymWinterSessions: number;
  gymExperience: "beginner" | "intermediate" | "advanced" | null;
  gymEquipment: string[];
  indoorCyclingAvailableFrom: string | null;
  strengthPlan: Record<string, unknown>;
};

export const defaultPlanningProfile: PlanningProfile = {
  primarySport: "cycling",
  selectedSports: ["cycling", "strength"],
  sportPriority: "cycling",
  runningSessionsPerWeek: 3,
  cyclingSessionsPerWeek: 3,
  volleyballSessionsPerWeek: 0,
  easyRunWithCrossTraining: false,

  goalType: "cycling_event",
  eventName: null,
  targetYear: null,
  targetDate: null,
  eventDistanceKm: null,
  eventElevationMeters: null,
  targetTimeSeconds: null,
  supportMode: null,

  weeklyDistanceGoalKm: 125,
  currentWeeklyDistanceKm: null,
  beforeLateShiftAllowed: true,
  afterNightShiftAllowed: true,
  workdayMaxSessionMinutes: 90,
  availableWeekdays: [1, 2, 3, 4, 5, 6, 7],
  gymSummerSessions: 1,
  gymWinterSessions: 2,
  gymExperience: null,
  gymEquipment: [],
  indoorCyclingAvailableFrom: "2026-10-01",
  strengthPlan: {},
};
export type PlanningGoalSummary = {
  eventName: string | null;
  targetYear: number | null;
  eventDistanceKm: number | null;
};

export const defaultPlanningGoalSummary: PlanningGoalSummary = {
  eventName: null,
  targetYear: null,
  eventDistanceKm: null,
};

export async function getPlanningGoalSummary(): Promise<PlanningGoalSummary> {
  if (isDemoMode) {
    return defaultPlanningGoalSummary;
  }

  const supabase = await createClient();

  if (!supabase) {
    return defaultPlanningGoalSummary;
  }

  const { data, error } = await supabase
    .from("training_goals")
    .select("event_name,target_year,event_distance_km")
    .maybeSingle();

  if (error || !data) {
    return defaultPlanningGoalSummary;
  }

  return {
    eventName: data.event_name ?? null,
    targetYear: data.target_year ?? null,
    eventDistanceKm:
      data.event_distance_km === null || data.event_distance_km === undefined
        ? null
        : Number(data.event_distance_km),
  };
}

export async function getPlanningData(range?: {
  from: Date;
  until: Date;
}): Promise<{
  profile: PlanningProfile;
  primarySport: PrimarySportResolution;
  weeklyGoal: WeeklyGoalResolution;
  events: PlanningEvent[];
  ready: boolean;
}> {
  if (isDemoMode) {
    return {
      profile: defaultPlanningProfile,
      primarySport: { status: "valid", value: defaultPlanningProfile.primarySport },
      weeklyGoal: { status: "valid", value: defaultPlanningProfile.weeklyDistanceGoalKm },
      events: [],
      ready: false,
    };
  }

  await requireUser();

  const supabase = await createClient();

  if (!supabase) {
    return {
      profile: defaultPlanningProfile,
      primarySport: resolvePrimarySport(undefined, true),
      weeklyGoal: { status: "load_error", value: null },
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
        "goal_type,event_name,target_year,target_date,event_distance_km,event_elevation_meters,target_time_seconds,support_mode,weekly_distance_goal_km",
      )
      .maybeSingle(),

    supabase
      .from("training_preferences")
      .select(
        "primary_sport,selected_sports,sport_priority,current_weekly_distance_km,running_sessions_per_week,cycling_sessions_per_week,volleyball_sessions_per_week,easy_run_with_cross_training,before_late_shift_allowed,after_night_shift_allowed,workday_max_session_minutes,available_weekdays,gym_summer_sessions,gym_winter_sessions,gym_experience,gym_equipment,indoor_cycling_available_from,strength_plan",
      )
      .maybeSingle(),

    supabase
      .from("calendar_events")
      .select("id,title,event_kind,starts_at,ends_at,all_day")
      .gt("ends_at", from.toISOString())
      .lt("starts_at", until.toISOString())
      .order("starts_at"),
  ]);

  if (goalResult.error || preferencesResult.error || eventsResult.error) {
    return {
      profile: defaultPlanningProfile,
      primarySport: resolvePrimarySport(undefined, true),
      weeklyGoal: { status: "load_error", value: null },
      events: [],
      ready: false,
    };
  }

  const goal = goalResult.data;
  const preferences = preferencesResult.data;
  const primarySport = resolvePrimarySport(preferences?.primary_sport);
  const parsedPrimarySport = primarySport.value;
  const rawWeeklyGoal = goal?.weekly_distance_goal_km;
  const weeklyGoal: WeeklyGoalResolution = rawWeeklyGoal === null || rawWeeklyGoal === undefined
    ? { status: "missing", value: null }
    : typeof rawWeeklyGoal === "number" && Number.isFinite(rawWeeklyGoal) && rawWeeklyGoal > 0
      ? { status: "valid", value: rawWeeklyGoal }
      : { status: "invalid", value: null };

  const supportMode: SupportMode | null =
    goal?.support_mode === "supported" ||
    goal?.support_mode === "nonsupported" ||
    goal?.support_mode === "open"
      ? goal.support_mode
      : null;

  return {
    ready: true,
    primarySport,
    weeklyGoal,

    profile: {
      primarySport: parsedPrimarySport ?? defaultPlanningProfile.primarySport,

      selectedSports: Array.isArray(preferences?.selected_sports)
        ? preferences.selected_sports.filter(
            (sport): sport is OnboardingSport =>
              sport === "running" || sport === "cycling" || sport === "strength" || sport === "volleyball",
          )
        : [parsedPrimarySport ?? defaultPlanningProfile.primarySport],

      sportPriority:
        preferences?.sport_priority === "running" ||
        preferences?.sport_priority === "cycling" ||
        preferences?.sport_priority === "strength" ||
        preferences?.sport_priority === "balanced"
          ? preferences.sport_priority
          : parsedPrimarySport ?? defaultPlanningProfile.sportPriority,

      runningSessionsPerWeek: preferences?.running_sessions_per_week ?? 3,

      cyclingSessionsPerWeek: preferences?.cycling_sessions_per_week ?? 3,

      volleyballSessionsPerWeek: preferences?.volleyball_sessions_per_week ?? 0,

      easyRunWithCrossTraining:
        preferences?.easy_run_with_cross_training ?? false,

      goalType:
        goal?.goal_type === "running_event" || goal?.goal_type === "cycling_event" ||
        goal?.goal_type === "endurance" || goal?.goal_type === "speed" ||
        goal?.goal_type === "strength" || goal?.goal_type === "hybrid" ||
        goal?.goal_type === "consistency" || goal?.goal_type === "custom"
          ? goal.goal_type
          : defaultPlanningProfile.goalType,
      eventName: goal?.event_name ?? null,
      targetYear: goal?.target_year ?? null,
      targetDate: goal?.target_date ?? null,
      eventDistanceKm: goal?.event_distance_km === null || goal?.event_distance_km === undefined
        ? null
        : Number(goal.event_distance_km),
      eventElevationMeters: goal?.event_elevation_meters ?? null,
      targetTimeSeconds: goal?.target_time_seconds ?? null,
      supportMode,

      weeklyDistanceGoalKm: goal?.weekly_distance_goal_km === null || goal?.weekly_distance_goal_km === undefined
        ? 125
        : Number(goal.weekly_distance_goal_km),

      currentWeeklyDistanceKm: preferences?.current_weekly_distance_km === null || preferences?.current_weekly_distance_km === undefined
        ? null
        : Number(preferences.current_weekly_distance_km),

      beforeLateShiftAllowed: preferences?.before_late_shift_allowed ?? true,

      afterNightShiftAllowed: preferences?.after_night_shift_allowed ?? true,

      workdayMaxSessionMinutes: preferences?.workday_max_session_minutes ?? 90,

      availableWeekdays: Array.isArray(preferences?.available_weekdays)
        ? preferences.available_weekdays.map(Number).filter((day) => Number.isInteger(day) && day >= 1 && day <= 7)
        : defaultPlanningProfile.availableWeekdays,

      gymSummerSessions: preferences?.gym_summer_sessions ?? 1,

      gymWinterSessions: preferences?.gym_winter_sessions ?? 2,

      gymExperience:
        preferences?.gym_experience === "beginner" ||
        preferences?.gym_experience === "intermediate" ||
        preferences?.gym_experience === "advanced"
          ? preferences.gym_experience
          : null,

      gymEquipment: Array.isArray(preferences?.gym_equipment)
        ? preferences.gym_equipment.filter((item): item is string => typeof item === "string")
        : [],

      indoorCyclingAvailableFrom:
        preferences?.indoor_cycling_available_from ?? "2026-10-01",

      strengthPlan:
        (preferences?.strength_plan as Record<string, unknown> | null) ?? {},
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

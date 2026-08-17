import {
  deriveInitialPlanningTargetKm,
  type OnboardingSport,
} from "@/lib/onboarding-planning";

export const onboardingSports = ["running", "cycling", "strength", "volleyball"] as const;
export const onboardingGoalTypes = [
  "running_event",
  "cycling_event",
  "endurance",
  "speed",
  "strength",
  "hybrid",
  "consistency",
  "custom",
] as const;

export type OnboardingGoalType = (typeof onboardingGoalTypes)[number];
export type OnboardingPriority = "running" | "cycling" | "strength" | "balanced";

export type OnboardingV2RpcArguments = {
  p_goal_type: OnboardingGoalType;
  p_event_name: string | null;
  p_target_date: string | null;
  p_event_distance_km: number | null;
  p_event_elevation_meters: number | null;
  p_target_time_seconds: number | null;
  p_support_mode: "supported" | "nonsupported" | "open" | null;
  p_weekly_distance_goal_km: number;
  p_current_weekly_distance_km: number | null;
  p_primary_sport: "cycling" | "running";
  p_selected_sports: OnboardingSport[];
  p_sport_priority: OnboardingPriority;
  p_running_sessions_per_week: number;
  p_cycling_sessions_per_week: number;
  p_volleyball_sessions_per_week: number;
  p_easy_run_with_cross_training: boolean;
  p_before_late_shift_allowed: boolean;
  p_after_night_shift_allowed: boolean;
  p_workday_max_session_minutes: number;
  p_available_weekdays: number[];
  p_gym_summer_sessions: number;
  p_gym_winter_sessions: number;
  p_gym_experience: "beginner" | "intermediate" | "advanced" | null;
  p_gym_equipment: string[];
  p_max_heart_rate: number | null;
  p_resting_heart_rate: number | null;
  p_ftp_watts: number | null;
};

function values(formData: FormData, name: string): string[] {
  return formData.getAll(name).filter((value): value is string => typeof value === "string");
}

function optionalNumber(formData: FormData, name: string, minimum: number, maximum: number): number | null {
  const raw = formData.get(name);
  if (typeof raw !== "string" || raw.trim() === "") return null;
  const parsed = Number(raw.trim().replace(",", "."));
  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} ist ungültig.`);
  }
  return parsed;
}

function optionalInteger(formData: FormData, name: string, minimum: number, maximum: number): number | null {
  const value = optionalNumber(formData, name, minimum, maximum);
  if (value !== null && !Number.isInteger(value)) throw new Error(`${name} ist ungültig.`);
  return value;
}

function optionalText(formData: FormData, name: string, maximumLength: number): string | null {
  const raw = formData.get(name);
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value) return null;
  if (value.length > maximumLength) throw new Error(`${name} ist zu lang.`);
  return value;
}

function parseTargetDate(formData: FormData): string | null {
  const value = optionalText(formData, "targetDate", 10);
  if (value === null) return null;
  const parsed = new Date(`${value}T12:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    throw new Error("Das Zieldatum ist ungültig.");
  }
  return value;
}

function parseSports(formData: FormData): OnboardingSport[] {
  const selected = [...new Set(values(formData, "sports"))].filter(
    (value): value is OnboardingSport => onboardingSports.includes(value as OnboardingSport),
  );
  if (selected.length === 0) throw new Error("Wähle mindestens eine Sportart.");
  if (selected.every((sport) => sport === "volleyball")) {
    throw new Error("Wähle zusätzlich Laufen, Radfahren oder Krafttraining für deinen Trainingsplan.");
  }
  return selected;
}

function parseGoalType(formData: FormData): OnboardingGoalType {
  const value = formData.get("goalType");
  if (typeof value !== "string" || !onboardingGoalTypes.includes(value as OnboardingGoalType)) {
    throw new Error("Wähle ein Trainingsziel.");
  }
  return value as OnboardingGoalType;
}

function parsePriority(formData: FormData, sports: readonly OnboardingSport[]): OnboardingPriority {
  const value = formData.get("sportPriority");
  if (value === "balanced") return "balanced";
  if ((value === "running" || value === "cycling" || value === "strength") && sports.includes(value)) return value;
  if (sports.includes("running")) return "running";
  if (sports.includes("cycling")) return "cycling";
  if (sports.includes("strength")) return "strength";
  return "balanced";
}

function frequency(formData: FormData, sport: OnboardingSport, selected: readonly OnboardingSport[]): number {
  if (!selected.includes(sport)) return sport === "running" ? 3 : 0;
  return optionalInteger(formData, `${sport}Sessions`, 1, 7) ?? 1;
}

function parseAvailableWeekdays(formData: FormData): number[] {
  const days = [...new Set(values(formData, "availableWeekdays").map(Number))]
    .filter((value) => Number.isInteger(value) && value >= 1 && value <= 7)
    .sort((a, b) => a - b);
  if (days.length === 0) throw new Error("Wähle mindestens einen verfügbaren Trainingstag.");
  return days;
}

function optionalSupportMode(formData: FormData): "supported" | "nonsupported" | "open" | null {
  const value = formData.get("supportMode");
  if (value === null || value === "") return null;
  if (value !== "supported" && value !== "nonsupported" && value !== "open") {
    throw new Error("Unterstützungsmodus ist ungültig.");
  }
  return value;
}

function parseGymExperience(
  formData: FormData,
  sports: readonly OnboardingSport[],
): "beginner" | "intermediate" | "advanced" | null {
  if (!sports.includes("strength")) return null;
  const value = formData.get("gymExperience");
  return value === "intermediate" || value === "advanced" ? value : "beginner";
}

function parseTargetTimeSeconds(formData: FormData): number | null {
  const hours = optionalInteger(formData, "targetTimeHours", 0, 999);
  const minutes = optionalInteger(formData, "targetTimeMinutes", 0, 59);
  if (hours === null && minutes === null) return null;
  const seconds = (hours ?? 0) * 3600 + (minutes ?? 0) * 60;
  if (seconds <= 0) throw new Error("Die Zielzeit ist ungültig.");
  return seconds;
}

export function buildOnboardingV2RpcArguments(formData: FormData): OnboardingV2RpcArguments {
  const sports = parseSports(formData);
  const selectedGoalType = parseGoalType(formData);
  const sportPriority = parsePriority(formData, sports);
  const primarySport: "cycling" | "running" = sportPriority === "cycling"
    ? "cycling"
    : sportPriority === "running"
      ? "running"
      : sports.includes("running")
        ? "running"
        : sports.includes("cycling")
          ? "cycling"
          : "running";
  const runningSessions = frequency(formData, "running", sports);
  const cyclingSessions = frequency(formData, "cycling", sports);
  const strengthSessions = frequency(formData, "strength", sports);
  const volleyballSessions = frequency(formData, "volleyball", sports);
  const currentWeeklyDistanceKm = optionalNumber(formData, "currentWeeklyDistance", 0, 2000);
  const maxHeartRate = optionalInteger(formData, "maxHeartRate", 80, 240);
  const restingHeartRate = optionalInteger(formData, "restingHeartRate", 25, 120);
  if (maxHeartRate !== null && restingHeartRate !== null && restingHeartRate >= maxHeartRate) {
    throw new Error("Der Ruhepuls muss unter dem Maximalpuls liegen.");
  }
  const eventGoal = selectedGoalType === "running_event" || selectedGoalType === "cycling_event";
  const selectedEquipment = [...new Set(values(formData, "gymEquipment"))]
    .map((value) => value.trim())
    .filter((value) => value.length > 0 && value.length <= 100)
    .slice(0, 20);

  return {
    p_goal_type: selectedGoalType,
    p_event_name: eventGoal || selectedGoalType === "custom" ? optionalText(formData, "eventName", 200) : null,
    p_target_date: eventGoal ? parseTargetDate(formData) : null,
    p_event_distance_km: eventGoal ? optionalNumber(formData, "eventDistance", 0.1, 100000) : null,
    p_event_elevation_meters: selectedGoalType === "cycling_event"
      ? optionalInteger(formData, "eventElevation", 0, 1000000)
      : null,
    p_target_time_seconds: selectedGoalType === "running_event" ? parseTargetTimeSeconds(formData) : null,
    p_support_mode: selectedGoalType === "cycling_event" ? optionalSupportMode(formData) : null,
    p_weekly_distance_goal_km: deriveInitialPlanningTargetKm({
      primarySport,
      desiredSessions: primarySport === "running" ? runningSessions : cyclingSessions,
      currentWeeklyDistanceKm,
      enduranceSelected: sports.includes(primarySport),
    }),
    p_current_weekly_distance_km: currentWeeklyDistanceKm,
    p_primary_sport: primarySport,
    p_selected_sports: sports,
    p_sport_priority: sportPriority,
    p_running_sessions_per_week: runningSessions,
    p_cycling_sessions_per_week: cyclingSessions,
    p_volleyball_sessions_per_week: volleyballSessions,
    p_easy_run_with_cross_training: sports.includes("running") &&
      (sports.includes("strength") || sports.includes("volleyball")),
    p_before_late_shift_allowed: formData.get("beforeLate") === "on",
    p_after_night_shift_allowed: formData.get("afterNight") === "on",
    p_workday_max_session_minutes: optionalInteger(formData, "workdayMax", 15, 360) ?? 90,
    p_available_weekdays: parseAvailableWeekdays(formData),
    p_gym_summer_sessions: strengthSessions,
    p_gym_winter_sessions: strengthSessions,
    p_gym_experience: parseGymExperience(formData, sports),
    p_gym_equipment: selectedEquipment,
    p_max_heart_rate: maxHeartRate,
    p_resting_heart_rate: restingHeartRate,
    p_ftp_watts: sports.includes("cycling") ? optionalInteger(formData, "ftpWatts", 50, 1000) : null,
  };
}

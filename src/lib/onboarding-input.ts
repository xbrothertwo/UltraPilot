export type OnboardingRpcArguments = {
  p_event_name: string | null;
  p_target_year: number | null;
  p_event_distance_km: number | null;
  p_event_elevation_meters: number | null;
  p_support_mode: "supported" | "nonsupported" | "open" | null;
  p_weekly_distance_goal_km: number;
  p_primary_sport: "cycling" | "running";
  p_running_sessions_per_week: number;
  p_easy_run_with_cross_training: boolean;
  p_before_late_shift_allowed: boolean;
  p_after_night_shift_allowed: boolean;
  p_workday_max_session_minutes: number;
  p_gym_summer_sessions: number;
  p_gym_winter_sessions: number;
  p_max_heart_rate: number | null;
  p_resting_heart_rate: number | null;
  p_ftp_watts: number | null;
};

function optionalInteger(
  formData: FormData,
  name: string,
  minimum: number,
  maximum: number,
): number | null {
  const raw = formData.get(name);

  if (typeof raw !== "string" || raw.trim() === "") {
    return null;
  }

  const value = Number(raw);

  if (
    !Number.isInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw new Error(`${name} ist ungültig.`);
  }

  return value;
}

function optionalText(
  formData: FormData,
  name: string,
  maximumLength: number,
): string | null {
  const raw = formData.get(name);

  if (typeof raw !== "string") {
    return null;
  }

  const value = raw.trim();

  if (!value) {
    return null;
  }

  if (value.length > maximumLength) {
    throw new Error(`${name} ist zu lang.`);
  }

  return value;
}

function optionalSupportMode(
  formData: FormData,
): "supported" | "nonsupported" | "open" | null {
  const value = formData.get("supportMode");

  if (value === null || value === "") {
    return null;
  }

  if (
    value !== "supported" &&
    value !== "nonsupported" &&
    value !== "open"
  ) {
    throw new Error("Unterstützungsmodus ist ungültig.");
  }

  return value;
}

export function buildOnboardingRpcArguments(
  formData: FormData,
  currentYear = new Date().getFullYear(),
): OnboardingRpcArguments {
  const heroSport = formData.get("primarySport");
  const multiPriority = formData.get("multiPriority");

  const primarySport =
    heroSport === "multi"
      ? multiPriority === "running"
        ? "running"
        : "cycling"
      : heroSport === "running"
        ? "running"
        : "cycling";

  const runningSessions =
    primarySport === "running"
      ? (optionalInteger(
          formData,
          "runningSessions",
          1,
          7,
        ) ?? 3)
      : 3;

  const weeklyDistance =
    optionalInteger(formData, "weeklyDistance", 0, 2000) ?? 0;

  const strengthEnabled =
    formData.get("strengthEnabled") === "on";

  const strengthSessions = strengthEnabled
    ? (optionalInteger(
        formData,
        "strengthSessions",
        0,
        7,
      ) ?? 1)
    : 0;

  const maxHeartRate = optionalInteger(
    formData,
    "maxHeartRate",
    80,
    240,
  );

  const restingHeartRate = optionalInteger(
    formData,
    "restingHeartRate",
    25,
    120,
  );

  const ftpWatts = optionalInteger(
    formData,
    "ftpWatts",
    50,
    1000,
  );

  if (
    maxHeartRate !== null &&
    restingHeartRate !== null &&
    restingHeartRate >= maxHeartRate
  ) {
    throw new Error(
      "Der Ruhepuls muss unter dem Maximalpuls liegen.",
    );
  }

  return {
    p_event_name: optionalText(formData, "eventName", 200),
    p_target_year: optionalInteger(
      formData,
      "targetYear",
      currentYear,
      currentYear + 20,
    ),
    p_event_distance_km: optionalInteger(
      formData,
      "eventDistance",
      1,
      100000,
    ),
    p_event_elevation_meters: optionalInteger(
      formData,
      "eventElevation",
      0,
      1000000,
    ),
    p_support_mode: optionalSupportMode(formData),
    p_weekly_distance_goal_km: weeklyDistance,
    p_primary_sport: primarySport,
    p_running_sessions_per_week: runningSessions,
    p_easy_run_with_cross_training:
      formData.get("volleyball") === "on",
    p_before_late_shift_allowed:
      formData.get("beforeLate") === "on",
    p_after_night_shift_allowed:
      formData.get("afterNight") === "on",
    p_workday_max_session_minutes:
      optionalInteger(formData, "workdayMax", 15, 360) ?? 90,
    p_gym_summer_sessions: strengthSessions,
    p_gym_winter_sessions: strengthSessions,
    p_max_heart_rate: maxHeartRate,
    p_resting_heart_rate: restingHeartRate,
    p_ftp_watts: ftpWatts,
  };
}
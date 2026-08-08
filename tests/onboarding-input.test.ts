import { describe, expect, it } from "vitest";
import { buildOnboardingRpcArguments } from "../src/lib/onboarding-input";

function form(
  values: Record<string, string>,
): FormData {
  const formData = new FormData();

  for (const [key, value] of Object.entries(values)) {
    formData.set(key, value);
  }

  return formData;
}

describe("buildOnboardingRpcArguments", () => {
  it("uses safe defaults for an empty optional onboarding form", () => {
    const result = buildOnboardingRpcArguments(
      new FormData(),
      2026,
    );

    expect(result).toMatchObject({
      p_event_name: null,
      p_target_year: null,
      p_event_distance_km: null,
      p_event_elevation_meters: null,
      p_support_mode: null,
      p_weekly_distance_goal_km: 0,
      p_primary_sport: "cycling",
      p_running_sessions_per_week: 3,
      p_easy_run_with_cross_training: false,
      p_before_late_shift_allowed: false,
      p_after_night_shift_allowed: false,
      p_workday_max_session_minutes: 90,
      p_gym_summer_sessions: 0,
      p_gym_winter_sessions: 0,
    });
  });

  it("maps selected sports and availability settings", () => {
    const result = buildOnboardingRpcArguments(
      form({
        primarySport: "multi",
        multiPriority: "running",
        runningSessions: "4",
        weeklyDistance: "80",
        strengthEnabled: "on",
        strengthSessions: "2",
        volleyball: "on",
        beforeLate: "on",
        afterNight: "on",
        workdayMax: "120",
      }),
      2026,
    );

    expect(result).toMatchObject({
      p_primary_sport: "running",
      p_running_sessions_per_week: 4,
      p_weekly_distance_goal_km: 80,
      p_easy_run_with_cross_training: true,
      p_before_late_shift_allowed: true,
      p_after_night_shift_allowed: true,
      p_workday_max_session_minutes: 120,
      p_gym_summer_sessions: 2,
      p_gym_winter_sessions: 2,
    });
  });

  it("keeps unchecked checkboxes disabled", () => {
    const result = buildOnboardingRpcArguments(
      form({
        primarySport: "cycling",
        strengthSessions: "3",
      }),
      2026,
    );

    expect(result.p_before_late_shift_allowed).toBe(false);
    expect(result.p_after_night_shift_allowed).toBe(false);
    expect(result.p_gym_summer_sessions).toBe(0);
    expect(result.p_gym_winter_sessions).toBe(0);
  });

  it("rejects a resting heart rate at or above maximum heart rate", () => {
    expect(() =>
      buildOnboardingRpcArguments(
        form({
          maxHeartRate: "120",
          restingHeartRate: "120",
        }),
        2026,
      ),
    ).toThrow(
      "Der Ruhepuls muss unter dem Maximalpuls liegen.",
    );
  });
});
import { describe, expect, it } from "vitest";
import type { Activity } from "../src/lib/demo-data";
import { buildDashboardViewModel, selectDashboardMission } from "../src/lib/dashboard-view-model";
import type { SavedMission } from "../src/lib/missions";
import type { ReconciledWorkout } from "../src/lib/planning/reconciliation";
import type { PlannedWorkout } from "../src/lib/planning/workouts";

function activity(id: string, sportType: Activity["sportType"], km: number, seconds: number): Activity {
  return { id, userId: "u", sportType, activityDate: "2026-08-03T10:00:00Z", title: id, distanceMeters: km * 1000, movingTimeSeconds: seconds, elapsedTimeSeconds: seconds, elevationGainMeters: 0, averageSpeedKmh: null, averageHeartRate: null, maximumHeartRate: null, averagePower: null, normalizedPower: null, source: "manual", createdAt: "2026-08-03T10:00:00Z" };
}

function planned(id: string, sportType: "cycling" | "running", date = "2026-08-03"): ReconciledWorkout {
  const workout: PlannedWorkout = { id, scheduledDate: date, sportType, title: id, description: null, personalNote: null, intensity: "easy", plannedDurationMinutes: 60, plannedDistanceKm: 20, status: "planned", linkedActivityId: null, source: "automatic", generationId: "g", locked: false, preferredStartTime: null, targetHeartRateZone: null, targetPowerZone: null };
  return { workout, activity: null, effectiveStatus: "planned", comparison: null };
}

function build(primarySport: "cycling" | "running", activities: Activity[], goal: number | null = 30, workouts: ReconciledWorkout[] = []) {
  return buildDashboardViewModel({ primarySport, weeklyGoalKm: goal, weekActivities: activities, reconciledWorkouts: workouts, today: "2026-08-03", latestActivities: activities });
}

describe("dashboard view model", () => {
  it("builds weighted Cycling KPIs and excludes Running from its goal", () => {
    const result = build("cycling", [activity("ride-a", "cycling", 20, 3600), activity("ride-b", "cycling", 40, 3600), activity("run", "running", 10, 3600)]);
    expect(result.metrics).toEqual([{ label: "Radkilometer", value: "60 km" }, { label: "Fahrzeit", value: "2:00 h" }, { label: "Ø Geschwindigkeit", value: "30 km/h" }]);
    expect(result.weeklyGoal.actualKm).toBe(60);
  });

  it("builds weighted Running pace and excludes Cycling from its goal", () => {
    const result = build("running", [activity("run-a", "running", 5, 1800), activity("run-b", "running", 10, 4200), activity("ride", "cycling", 100, 7200)]);
    expect(result.metrics).toEqual([{ label: "Laufkilometer", value: "15 km" }, { label: "Laufzeit", value: "1:40 h" }, { label: "Ø Pace", value: "6:40 min/km" }]);
    expect(result.weeklyGoal.actualKm).toBe(15);
    expect(result.showFueling).toBe(false);
  });

  it("keeps cross-training visible without adding kilometers and assigns correct icons", () => {
    const result = build("running", [activity("strength", "strength", 5, 3600), activity("volleyball", "volleyball", 3, 5400)]);
    expect(result.weeklyGoal.actualKm).toBe(0);
    expect(result.latestActivities.map((item) => [item.sportLabel, item.icon])).toEqual([["Krafttraining", "strength"], ["Volleyball", "volleyball"]]);
  });

  it("does not invent averages or a weekly goal for empty or invalid values", () => {
    const result = build("running", [activity("empty", "running", 0, 0)], null);
    expect(result.metrics.map((item) => item.value)).toEqual(["–", "–", "–"]);
    expect(result.weeklyGoal).toMatchObject({ targetKm: null, progressPercent: null });
  });

  it.each(["cycling", "running"] as const)("keeps a planned %s workout visible without counting it as completed", (sport) => {
    const workout = planned(`${sport}-planned`, sport);
    const completed = activity(`${sport}-activity`, sport, 8, 2400);
    const result = build(sport, [completed], 30, [workout]);
    expect(result.weeklyGoal.actualKm).toBe(8);
    expect(result.today.map((item) => item.workout.id)).toEqual([workout.workout.id]);
    expect(result.weeklyGoal.actualKm).not.toBe(28);
  });

  it("classifies an incompatible mission only as neutral", () => {
    const mission = { id: "m", sportType: "cycling", status: "planned", title: "Radmission" } as SavedMission;
    expect(selectDashboardMission([mission], "running")).toEqual({ mode: "neutral", mission });
  });

  it.each([0, Number.NaN, Number.POSITIVE_INFINITY])("keeps an incomplete mission with distance %s neutral", (distanceKm) => {
    const mission = { id: "m", sportType: "running", status: "planned", title: "Herbstziel", distanceKm } as SavedMission;
    expect(selectDashboardMission([mission], "running")).toEqual({ mode: "neutral", mission });
  });

  it("keeps Cycling nutrition enabled", () => {
    expect(build("cycling", []).showFueling).toBe(true);
  });
});

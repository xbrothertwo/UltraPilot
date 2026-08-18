import { describe, expect, it } from "vitest";
import { buildActivityDetailMetrics, heartRateSetupState } from "../src/lib/activity-detail";
import { commonDetectedSport, formatFileSize, preferredImportSport } from "../src/lib/activity-import";
import { parseActivityFile } from "../src/lib/activity-files/parser";
import type { Activity } from "../src/lib/demo-data";
import type { GymHistoryItem } from "../src/lib/gym/data";
import { reconcilePlannedWorkouts } from "../src/lib/planning/reconciliation";
import type { PlannedWorkout } from "../src/lib/planning/workouts";
import { buildProgressExperience } from "../src/lib/progress-experience";
import { buildTrainingHistory, filterTrainingHistory } from "../src/lib/training-history";

const activity = (overrides: Partial<Activity> = {}): Activity => ({
  id: "run-1", userId: "user-1", sportType: "running", activityDate: "2026-08-18T08:00:00Z", title: "7 km Progressiv Langer Lauf", distanceMeters: 7_500, movingTimeSeconds: 2_520, elapsedTimeSeconds: 2_600, elevationGainMeters: 111, averageSpeedKmh: 10.714, averageHeartRate: 165, maximumHeartRate: 182, averagePower: null, normalizedPower: null, source: "gpx_upload", createdAt: "2026-08-18T09:00:00Z", ...overrides,
});

const workout = (overrides: Partial<PlannedWorkout> = {}): PlannedWorkout => ({
  id: "workout-1", scheduledDate: "2026-08-18", sportType: "running", title: "Langer ruhiger Lauf", description: null, personalNote: null, intensity: "endurance", plannedDurationMinutes: 38, plannedDistanceKm: 5, status: "planned", linkedActivityId: null, source: "automatic", generationId: "generation-1", locked: false, preferredStartTime: null, targetHeartRateZone: null, targetPowerZone: null, ...overrides,
});

describe("activity import defaults", () => {
  it("uses the only selected endurance sport and otherwise asks explicitly", () => {
    expect(preferredImportSport(["running", "strength"])).toBe("running");
    expect(preferredImportSport(["running", "cycling", "strength"])).toBeNull();
    expect(preferredImportSport(["strength"])).toBeNull();
  });

  it("uses file metadata only when every selected file agrees", () => {
    expect(commonDetectedSport(["running", "running"])).toBe("running");
    expect(commonDetectedSport(["running", "cycling"])).toBeNull();
    expect(commonDetectedSport(["running", null])).toBeNull();
  });

  it("formats selected file sizes without exposing native file-input copy", () => {
    expect(formatFileSize(1_468_006)).toBe("1,4 MB");
    expect(formatFileSize(500_000)).toBe("488 KB");
  });

  it("rejects TCX consistently because no TCX parser exists", async () => {
    await expect(parseActivityFile(new File(["<TrainingCenterDatabase />"], "run.tcx"), "gpx")).rejects.toThrow(/TCX-Parser/);
  });
});

describe("sport-adaptive activity history", () => {
  it("reuses reconciliation and exposes the real plan deviation without duplicating the workout", () => {
    const planned = workout();
    const reconciled = reconcilePlannedWorkouts([planned], [activity()]);
    const history = buildTrainingHistory([activity()], [], reconciled, [planned]);
    expect(history).toHaveLength(1);
    expect(history[0].planMatch).toMatchObject({ status: "deviation", workoutTitle: "Langer ruhiger Lauf", comparison: { distanceDeltaKm: 2.5, durationDeltaMinutes: 4 } });
  });

  it("keeps cycling power and running pace data separate", () => {
    const cycling = activity({ id: "ride", sportType: "cycling", averagePower: 210, normalizedPower: 225, averageSpeedKmh: 28 });
    const entries = buildTrainingHistory([activity(), cycling], [], [], []);
    const run = entries.find((entry) => entry.id === "run-1");
    const ride = entries.find((entry) => entry.id === "ride");
    expect(run?.kind === "activity" && run.averagePower).toBeNull();
    expect(ride?.kind === "activity" && ride.averagePower).toBe(210);
  });

  it("integrates Gym sessions without fake pace or distance", () => {
    const gym: GymHistoryItem = { id: "gym-1", name: "Einheit A", programName: "Sommer", plannedWorkoutId: null, startedAt: "2026-08-17T18:00:00Z", durationSeconds: 3_600, exerciseCount: 6, workingSets: 18 };
    const [entry] = buildTrainingHistory([], [gym], [], []);
    expect(entry).toMatchObject({ kind: "gym", exerciseCount: 6, workingSets: 18 });
    expect("distanceMeters" in entry).toBe(false);
    expect("averageSpeedKmh" in entry).toBe(false);
  });

  it("filters plan status, sport and search deterministically", () => {
    const planned = workout();
    const entries = buildTrainingHistory([activity(), activity({ id: "ride", sportType: "cycling", title: "Easy Ride" })], [], reconcilePlannedWorkouts([planned], [activity()]), [planned]);
    const filtered = filterTrainingHistory(entries, { query: "progressiv", sport: "running", period: "30", plan: "deviation", sort: "newest" }, new Date("2026-08-20T12:00:00Z"));
    expect(filtered.map((entry) => entry.id)).toEqual(["run-1"]);
  });
});

describe("activity detail and progress baseline", () => {
  it("does not render empty power metrics for a normal run but retains cycling power", () => {
    expect(buildActivityDetailMetrics(activity()).map((metric) => metric.label)).toEqual(["Ø Herzfrequenz", "Max. Herzfrequenz"]);
    expect(buildActivityDetailMetrics(activity({ sportType: "cycling", averagePower: 210, normalizedPower: 225 })).map((metric) => metric.label)).toContain("Normalized Power");
  });

  it("explains present heart rate without inventing zones", () => {
    expect(heartRateSetupState({ hasHeartRateData: true, hasHeartRateZones: false })).toBe("needs_reference");
    expect(heartRateSetupState({ hasHeartRateData: false, hasHeartRateZones: false })).toBe("no_data");
  });

  it("shows a useful first-activity baseline and honest load setup", () => {
    const state = buildProgressExperience({ primarySport: "running", activityCount: 1, measuredLoadActivities: 0, averageHeartRate: 165, trackedNights: 0, hasNutrition: false, gymSessionCount: 0, matchedPlanCount: 1 });
    expect(state).toMatchObject({ state: "baseline", loadState: "needs_zones", headline: "Deine Basis entsteht gerade.", showRecoveryModule: false, showNutritionModule: false });
    expect(state.summary).toContain("1 Lauf erfasst");
    expect(state.availableSignals).toContain("Planerfüllung");
    expect(state.buildingSignals).toContain("Persönlicher Belastungstrend");
    expect(buildProgressExperience({ primarySport: "running", activityCount: 2, measuredLoadActivities: 0, averageHeartRate: 165, trackedNights: 0, hasNutrition: false, gymSessionCount: 0, matchedPlanCount: 0 }).summary).toContain("2 Läufe erfasst");
  });

  it("uses an explicit no-data state instead of zero trends", () => {
    const state = buildProgressExperience({ primarySport: "running", activityCount: 0, measuredLoadActivities: 0, averageHeartRate: null, trackedNights: 0, hasNutrition: false, gymSessionCount: 0, matchedPlanCount: 0 });
    expect(state.state).toBe("empty");
    expect(state.availableSignals).toEqual([]);
  });
});

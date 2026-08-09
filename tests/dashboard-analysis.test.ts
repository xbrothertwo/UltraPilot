import { describe, expect, it } from "vitest";
import { buildDashboardSummary } from "../src/lib/dashboard-analysis";
import type { Activity } from "../src/lib/demo-data";
import type { TrainingProfile } from "../src/lib/training-zones";

const profile: TrainingProfile = { maxHeartRate: 200, restingHeartRate: 50, ftpWatts: 300, heartRateZoneMethod: "max_hr", customHeartRateBoundaries: null, customPowerBoundaries: null };

function activity(id: string, date: string, overrides: Partial<Activity> = {}): Activity {
  return { id, userId: "user", sportType: "cycling", activityDate: date, title: id, distanceMeters: 50_000, movingTimeSeconds: 7200, elapsedTimeSeconds: 7500, elevationGainMeters: 500, averageSpeedKmh: 25, averageHeartRate: 140, maximumHeartRate: 170, averagePower: 200, normalizedPower: 240, source: "fit_upload", createdAt: date, ...overrides };
}

describe("dashboard analysis", () => {
  it("aggregates volume, weighted measurements, load, nutrition and feedback", () => {
    const summary = buildDashboardSummary(
      [activity("a", "2026-08-01T08:00:00Z"), activity("b", "2026-08-02T08:00:00Z", { movingTimeSeconds: 3600, distanceMeters: 30_000, averageHeartRate: null, normalizedPower: null })],
      [{ activityId: "a", carbohydratesGrams: 120, fluidMilliliters: 1000, sodiumMilligrams: 600 }],
      [{ activityId: "a", perceivedExertion: 6, fatigue: 7, mood: 8 }, { activityId: "b", perceivedExertion: 8, fatigue: null, mood: 6 }],
      [], profile, "cycling",
    );
    expect(summary.activityCount).toBe(2);
    expect(summary.distanceMeters).toBe(80_000);
    expect(summary.averageHeartRate).toBe(140);
    expect(summary.totalTss).toBeCloseTo(128);
    expect(summary.carbohydratesPerHour).toBe(60);
    expect(summary.fluidPerHour).toBe(500);
    expect(summary.averageRpe).toBe(7);
    expect(summary.averageFatigue).toBe(7);
  });

  it("combines same-day activities for the nutrition trend", () => {
    const summary = buildDashboardSummary(
      [activity("a", "2026-08-01T08:00:00Z", { movingTimeSeconds: 3600 }), activity("b", "2026-08-01T16:00:00Z", { movingTimeSeconds: 3600 })],
      [{ activityId: "a", carbohydratesGrams: 60, fluidMilliliters: 0, sodiumMilligrams: 0 }, { activityId: "b", carbohydratesGrams: 100, fluidMilliliters: 0, sodiumMilligrams: 0 }],
      [], [], profile, "cycling",
    );
    expect(summary.trend).toHaveLength(1);
    expect(summary.trend[0].carbohydratesPerHour).toBe(80);
  });

  it("keeps optional metrics absent instead of treating them as zero", () => {
    const summary = buildDashboardSummary([activity("a", "2026-08-01T08:00:00Z", { averageHeartRate: null, averagePower: null, normalizedPower: null })], [], [], [], { ...profile, ftpWatts: null }, "cycling");
    expect(summary.averageHeartRate).toBeNull();
    expect(summary.averagePower).toBeNull();
    expect(summary.totalTss).toBeNull();
    expect(summary.carbohydratesPerHour).toBeNull();
    expect(summary.averageRpe).toBeNull();
  });

  it("only counts activities matching the primary sport", () => {
    const summary = buildDashboardSummary(
      [activity("a", "2026-08-01T08:00:00Z", { sportType: "running", distanceMeters: 10_000, averageSpeedKmh: 12 }), activity("b", "2026-08-02T08:00:00Z", { sportType: "cycling", distanceMeters: 50_000 })],
      [], [], [], profile, "running",
    );
    expect(summary.primarySport).toBe("running");
    expect(summary.activityCount).toBe(1);
    expect(summary.distanceMeters).toBe(10_000);
    expect(summary.averageSpeedKmh).toBe(12);
  });
});

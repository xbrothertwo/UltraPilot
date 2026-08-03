import { describe, expect, it } from "vitest";
import type { Activity } from "../src/lib/demo-data";
import { calculateActivityLoads, compareLoadToPlan, summarizeTrainingLoad, type LoadStream } from "../src/lib/training-load";
import type { TrainingProfile } from "../src/lib/training-zones";

const profile: TrainingProfile = { maxHeartRate: 200, restingHeartRate: 50, ftpWatts: 200, heartRateZoneMethod: "max_hr", customHeartRateBoundaries: null, customPowerBoundaries: null };
const activity = (overrides: Partial<Activity> = {}): Activity => ({ id: "a1", userId: "u1", sportType: "cycling", activityDate: "2026-08-03T08:00:00Z", title: "Fahrt", distanceMeters: 25_000, movingTimeSeconds: 3600, elapsedTimeSeconds: 3600, elevationGainMeters: 100, averageSpeedKmh: 25, averageHeartRate: null, maximumHeartRate: null, averagePower: null, normalizedPower: null, source: "fit", createdAt: "2026-08-03T09:00:00Z", ...overrides });

function heartRateStream(activityId = "a1", durationSeconds = 600, stepSeconds = 5): LoadStream {
  return { activityId, type: "heart_rate", samples: Array.from({ length: durationSeconds / stepSeconds + 1 }, (_, index) => ({ timestamp: new Date(Date.parse("2026-08-03T08:00:00Z") + index * stepSeconds * 1000).toISOString(), value: 130 })) };
}

describe("deterministic training load", () => {
  it("prefers power TSS when NP and FTP are available", () => {
    const [load] = calculateActivityLoads([activity({ normalizedPower: 200 })], [{ activityId: "a1", perceivedExertion: 9 }], [heartRateStream("a1", 3600)], profile);
    expect(load.method).toBe("power");
    expect(load.points).toBe(100);
  });

  it("uses covered time in personal heart-rate zones", () => {
    const [load] = calculateActivityLoads([activity({ movingTimeSeconds: 600, elapsedTimeSeconds: 600 })], [], [heartRateStream()], profile);
    expect(load.method).toBe("heart_rate");
    expect(load.coveragePercent).toBe(100);
    expect(load.points).toBe(8);
  });

  it("falls back to scaled session RPE when heart-rate coverage is insufficient", () => {
    const [load] = calculateActivityLoads([activity()], [{ activityId: "a1", perceivedExertion: 5 }], [heartRateStream("a1", 60)], profile);
    expect(load.method).toBe("rpe");
    expect(load.points).toBe(60);
  });

  it("does not invent load without a deterministic source", () => {
    const [load] = calculateActivityLoads([activity()], [], [], profile);
    expect(load.method).toBe("unavailable");
    expect(load.points).toBeNull();
  });

  it("summarizes seven-day load against the four-week weekly average", () => {
    const loads = calculateActivityLoads([
      activity({ id: "old", activityDate: "2026-07-15T08:00:00Z", normalizedPower: 100 }),
      activity({ id: "recent", activityDate: "2026-08-03T08:00:00Z", normalizedPower: 200 }),
    ], [], [], profile);
    const summary = summarizeTrainingLoad(loads, 28, "2026-08-03");
    expect(summary.sevenDayLoad).toBe(100);
    expect(summary.fourWeekWeeklyAverage).toBeGreaterThan(0);
    expect(summary.measuredActivities).toBe(2);
  });

  it("compares actual load with the planned duration and intensity", () => {
    expect(compareLoadToPlan(130, "endurance", 120)).toMatchObject({ comparison: "higher", expectedPoints: 96 });
    expect(compareLoadToPlan(95, "endurance", 120).comparison).toBe("as_planned");
    expect(compareLoadToPlan(null, "endurance", 120).comparison).toBe("unavailable");
  });
});

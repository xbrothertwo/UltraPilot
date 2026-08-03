import { describe, expect, it } from "vitest";
import type { Activity } from "../src/lib/demo-data";
import type { PlannedWorkout } from "../src/lib/planning/workouts";
import { reconcilePlannedWorkouts } from "../src/lib/planning/reconciliation";

function workout(overrides: Partial<PlannedWorkout> = {}): PlannedWorkout {
  return { id: "workout-1", scheduledDate: "2026-08-03", sportType: "cycling", title: "Ausdauer", description: null, intensity: "endurance", plannedDurationMinutes: 120, plannedDistanceKm: 50, status: "planned", linkedActivityId: null, source: "automatic", generationId: null, ...overrides };
}

function activity(overrides: Partial<Activity> = {}): Activity {
  return { id: "activity-1", userId: "user", sportType: "cycling", activityDate: "2026-08-03T08:00:00.000Z", title: "Fahrt", distanceMeters: 55_000, movingTimeSeconds: 7_800, elapsedTimeSeconds: 8_000, elevationGainMeters: 300, averageSpeedKmh: 25, averageHeartRate: 135, maximumHeartRate: 160, averagePower: null, normalizedPower: null, source: "gpx", createdAt: "2026-08-03T12:00:00.000Z", ...overrides };
}

describe("planned workout reconciliation", () => {
  it("matches a same-day ride and calculates plan deltas", () => {
    const [result] = reconcilePlannedWorkouts([workout()], [activity()]);
    expect(result.effectiveStatus).toBe("completed");
    expect(result.activity?.id).toBe("activity-1");
    expect(result.comparison?.distanceDeltaKm).toBe(5);
    expect(result.comparison?.durationDeltaMinutes).toBe(10);
  });

  it("uses the closest ride only once when multiple workouts exist", () => {
    const results = reconcilePlannedWorkouts([workout(), workout({ id: "workout-2", plannedDistanceKm: 100 })], [activity()]);
    expect(results.filter((result) => result.activity)).toHaveLength(1);
    expect(results.find((result) => result.activity)?.workout.id).toBe("workout-1");
  });

  it("does not complete skipped workouts or match unrelated dates", () => {
    expect(reconcilePlannedWorkouts([workout({ status: "skipped" })], [activity()])[0].effectiveStatus).toBe("skipped");
    expect(reconcilePlannedWorkouts([workout()], [activity({ activityDate: "2026-08-08T08:00:00.000Z" })])[0].effectiveStatus).toBe("planned");
  });

  it("respects an explicitly linked activity", () => {
    const result = reconcilePlannedWorkouts([workout({ linkedActivityId: "activity-2" })], [activity(), activity({ id: "activity-2", distanceMeters: 100_000 })])[0];
    expect(result.activity?.id).toBe("activity-2");
  });
});

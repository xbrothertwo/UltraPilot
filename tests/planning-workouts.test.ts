import { describe, expect, it } from "vitest";
import { computeStrengthWeekProgress } from "../src/lib/planning/reconciliation";
import type { PlannedWorkout } from "../src/lib/planning/workouts";

function workout(overrides: Partial<PlannedWorkout>): PlannedWorkout {
  return {
    id: "w1",
    scheduledDate: "2026-08-10",
    sportType: "strength",
    title: "Krafttraining A",
    description: null,
    personalNote: null,
    intensity: "strength",
    plannedDurationMinutes: 60,
    plannedDistanceKm: null,
    status: "planned",
    linkedActivityId: null,
    source: "automatic",
    generationId: null,
    locked: false,
    ...overrides,
  };
}

describe("computeStrengthWeekProgress", () => {
  it("returns null when strength is not configured", () => {
    expect(computeStrengthWeekProgress([workout({})], 0, 0)).toBeNull();
  });

  it("counts completed against planned strength workouts", () => {
    const workouts = [
      workout({ id: "a", status: "completed" }),
      workout({ id: "b", status: "planned" }),
    ];

    expect(computeStrengthWeekProgress(workouts, 2, 0)).toEqual({
      completed: 1,
      planned: 2,
    });
  });

  it("excludes skipped workouts and other sports", () => {
    const workouts = [
      workout({ id: "a", status: "completed" }),
      workout({ id: "b", status: "skipped" }),
      workout({
        id: "c",
        sportType: "cycling",
        status: "completed",
      }),
    ];

    expect(computeStrengthWeekProgress(workouts, 2, 0)).toEqual({
      completed: 1,
      planned: 1,
    });
  });
});
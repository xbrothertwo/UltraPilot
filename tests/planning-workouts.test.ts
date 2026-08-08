import { describe, expect, it } from "vitest";
import {
  computeStrengthWeekProgress,
  explainWorkoutPlacement,
} from "../src/lib/planning/reconciliation";
import type { PlannedWorkout } from "../src/lib/planning/workouts";

function workout(overrides: Partial<PlannedWorkout>): PlannedWorkout {
  return {
    id: "w1",
    scheduledDate: "2026-08-10",
    sportType: "strength",
    title: "Krafttraining A",
    description: null,
    intensity: "strength",
    plannedDurationMinutes: 60,
    plannedDistanceKm: null,
    status: "planned",
    linkedActivityId: null,
    source: "automatic",
    generationId: null,
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
      workout({ id: "c", sportType: "cycling", status: "completed" }),
    ];
    expect(computeStrengthWeekProgress(workouts, 2, 0)).toEqual({
      completed: 1,
      planned: 1,
    });
  });
});

describe("explainWorkoutPlacement", () => {
  function placedWorkout(
    overrides: Partial<
      Pick<PlannedWorkout, "source" | "sportType" | "intensity" | "plannedDistanceKm">
    >,
  ) {
    return {
      source: "automatic" as const,
      sportType: "running" as const,
      intensity: "easy" as const,
      plannedDistanceKm: 8,
      ...overrides,
    };
  }

  it("flags manually planned workouts without guessing a rule-based reason", () => {
    const workout = placedWorkout({ source: "manual" });
    expect(explainWorkoutPlacement(workout, "green", [workout])).toBe("Manuell eingeplant.");
  });

  it("identifies the week's longest session for its sport", () => {
    const long = placedWorkout({ intensity: "endurance", plannedDistanceKm: 20 });
    const short = placedWorkout({ plannedDistanceKm: 8 });
    expect(explainWorkoutPlacement(long, "green", [long, short])).toBe(
      "Längste Einheit dieser Woche — auf den Tag mit dem meisten freien Zeitfenster gelegt.",
    );
  });

  it("explains a tempo session and a yellow-readiness easy session differently", () => {
    const tempo = placedWorkout({ intensity: "tempo" });
    expect(explainWorkoutPlacement(tempo, "green", [tempo])).toContain("Tempo");

    const easy = placedWorkout({ intensity: "easy" });
    expect(explainWorkoutPlacement(easy, "yellow", [easy])).toContain("Belastung");
  });
});

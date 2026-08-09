import { describe, expect, it } from "vitest";
import type { PlannedWorkout } from "../src/lib/planning/workouts";
import { explainWorkoutPlan } from "../src/lib/planning/explanations";

function workout(
  overrides: Partial<PlannedWorkout> = {},
): PlannedWorkout {
  return {
    id: "workout-1",
    scheduledDate: "2026-08-03",
    sportType: "cycling",
    title: "Ausdauerfahrt",
    description: null,
    intensity: "endurance",
    plannedDurationMinutes: 120,
    plannedDistanceKm: 50,
    status: "planned",
    linkedActivityId: null,
    source: "automatic",
    generationId: null,
    personalNote: null,
    locked: false,
    preferredStartTime: null,
    targetHeartRateZone: null,
    targetPowerZone: null,
    ...overrides,
  };
}

describe("explainWorkoutPlan", () => {
  it("uses all workouts from the week when identifying the longest session", () => {
    const current = workout({ plannedDistanceKm: 50 });

    const explanations = explainWorkoutPlan(
      current,
      undefined,
      [
        current,
        workout({
          id: "workout-2",
          scheduledDate: "2026-08-06",
          plannedDistanceKm: 100,
        }),
      ],
    );

    expect(
      explanations.some(
        (explanation) => explanation.kind === "week",
      ),
    ).toBe(false);
  });

  it("identifies the actual longest session of the week", () => {
    const longest = workout({
      id: "workout-2",
      scheduledDate: "2026-08-06",
      plannedDistanceKm: 100,
    });

    const explanations = explainWorkoutPlan(
      longest,
      undefined,
      [workout(), longest],
    );

    expect(explanations).toContainEqual(
      expect.objectContaining({
        kind: "week",
        label: "Wochenstruktur",
      }),
    );
  });

  it("does not invent a free-time placement reason", () => {
    const explanations = explainWorkoutPlan(
      workout({ plannedDistanceKm: 100 }),
      undefined,
      [
        workout(),
        workout({
          id: "workout-2",
          plannedDistanceKm: 100,
        }),
      ],
    );

    const text = explanations
      .map((explanation) => explanation.text)
      .join(" ");

    expect(text).not.toContain("meisten freien Zeitfenster");
  });

  it("does not claim unrestricted readiness for a yellow tempo day", () => {
    const explanations = explainWorkoutPlan(
      workout({ intensity: "tempo" }),
      {
        status: "yellow",
        reasons: ["Weniger als 6,5 Stunden Schlaf."],
      },
      [workout({ intensity: "tempo" })],
    );

    expect(explanations).toContainEqual(
      expect.objectContaining({
        kind: "readiness",
        text: expect.stringContaining("gelb"),
      }),
    );

    expect(
      explanations
        .map((explanation) => explanation.text)
        .join(" "),
    ).not.toContain("keine Einschränkung");
  });

  it("clearly labels manually planned workouts", () => {
    const explanations = explainWorkoutPlan(
      workout({ source: "manual" }),
      undefined,
      [],
    );

    expect(explanations).toEqual([
      {
        kind: "user",
        label: "Nutzerentscheidung",
        text: "Diese Einheit wurde manuell eingeplant.",
      },
    ]);
  });

  it("shows missing readiness for an intensive workout", () => {
    const explanations = explainWorkoutPlan(
      workout({ intensity: "threshold" }),
      {
        status: "unknown",
        reasons: [],
      },
      [],
    );

    expect(explanations).toContainEqual(
      expect.objectContaining({
        kind: "readiness",
        text: "Für diesen Tag liegt noch keine bestätigte Tagesform vor.",
      }),
    );
  });
});
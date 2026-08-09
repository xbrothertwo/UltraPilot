import { describe, expect, it } from "vitest";
import { buildRideDebrief } from "../src/lib/ride-debrief";
import type { PlannedWorkout } from "../src/lib/planning/workouts";

const workout: PlannedWorkout = { id: "w", scheduledDate: "2026-08-03", sportType: "cycling", title: "Grundlage", description: null, personalNote: null, intensity: "endurance", plannedDurationMinutes: 120, plannedDistanceKm: 50, status: "planned", linkedActivityId: null, source: "automatic", generationId: null, locked: false, preferredStartTime: null, targetHeartRateZone: null, targetPowerZone: null };
const nutrition = { carbohydratesGrams: 120, fluidMilliliters: 1000, sodiumMilligrams: 500, calories: 500, carbohydratesPerHour: 60, fluidPerHour: 500, sodiumPerHour: 250, gaps: [] };
const feedback = { perceivedExertion: 4, fatigue: 4, mood: 7, stomachTolerance: 8, sleepQuality: 7, painNotes: "", notes: "" };
const comparison = { distanceDeltaKm: 0, durationDeltaMinutes: 0, distanceRatio: 1, durationRatio: 1 };

describe("ride debrief", () => {
  it("keeps the plan after an on-target ride", () => {
    const result = buildRideDebrief({ workout, comparison, load: null, nutrition, nutritionRecorded: true, feedback, heartRateDriftPercent: 3 });
    expect(result.status).toBe("on_track");
    expect(result.nextAction).toBe("keep");
  });

  it("recommends an easy next ride after high drift", () => {
    const result = buildRideDebrief({ workout, comparison, load: null, nutrition, nutritionRecorded: true, feedback, heartRateDriftPercent: 12 });
    expect(result.status).toBe("adjust");
    expect(result.nextAction).toBe("easy");
  });

  it("never labels missing nutrition as underfueling", () => {
    const result = buildRideDebrief({ workout, comparison, load: null, nutrition: { ...nutrition, carbohydratesPerHour: 0 }, nutritionRecorded: false, feedback, heartRateDriftPercent: null });
    expect(result.signals.find((signal) => signal.label === "Verpflegung")?.value).toBe("Nicht protokolliert");
  });

  it("prioritizes recovery when complaints were recorded", () => {
    const result = buildRideDebrief({ workout, comparison, load: null, nutrition, nutritionRecorded: true, feedback: { ...feedback, painNotes: "Knieschmerz" }, heartRateDriftPercent: 3 });
    expect(result.status).toBe("recover");
  });

  it("asks for feedback before giving a final decision", () => {
    expect(buildRideDebrief({ workout, comparison, load: null, nutrition, nutritionRecorded: true, feedback: null, heartRateDriftPercent: 3 }).status).toBe("incomplete");
  });
});

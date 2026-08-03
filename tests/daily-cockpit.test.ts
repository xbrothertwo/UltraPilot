import { describe, expect, it } from "vitest";
import { buildDailyDecision, buildFuelingPreparation } from "../src/lib/daily-cockpit";
import type { PlannedWorkout } from "../src/lib/planning/workouts";
import type { ReadinessResult } from "../src/lib/recovery-readiness";

const workout: PlannedWorkout = {
  id: "ride", scheduledDate: "2026-08-03", sportType: "cycling", title: "Tempo 70 km", description: null,
  intensity: "tempo", plannedDurationMinutes: 180, plannedDistanceKm: 70, status: "planned", linkedActivityId: null,
  source: "automatic", generationId: "generation",
};

function readiness(status: ReadinessResult["status"]): ReadinessResult {
  return { date: "2026-08-03", status, score: status === "red" ? 40 : status === "yellow" ? 65 : 85, reasons: ["Testgrund"], metric: null, checkin: null };
}

describe("daily cockpit", () => {
  it("recommends an easy replacement for a demanding workout after high load", () => {
    const result = buildDailyDecision(readiness("green"), workout, false, true);
    expect(result.level).toBe("adjust");
    expect(result.reasons[0]).toContain("48 Stunden");
  });

  it("prioritizes recovery on a red readiness day", () => {
    expect(buildDailyDecision(readiness("red"), workout, false, false).level).toBe("recover");
  });

  it("does not give green light without recovery data", () => {
    expect(buildDailyDecision(readiness("unknown"), workout, false, false).level).toBe("open");
  });

  it("calculates fueling from duration and the saved product library", () => {
    const result = buildFuelingPreparation(workout, [{ id: "gel", name: "Gel", category: "gel", servingLabel: "1 Gel", carbohydratesGrams: 30, fluidMilliliters: 0, sodiumMilligrams: 0, calories: 120 }], [{ id: "mix", name: "Carb-Flasche", volumeMilliliters: 750, carbohydratesGrams: 60, sodiumMilligrams: 500, calories: 240 }]);
    expect(result).toMatchObject({ carbohydrateRateGrams: 70, totalCarbohydratesGrams: 210, fluidMilliliters: 1500, bottleCount: 2 });
    expect(result?.bottleSuggestion).toMatchObject({ count: 2, carbohydratesGrams: 120 });
    expect(result?.productSuggestion).toMatchObject({ count: 3, carbohydratesGrams: 90 });
  });

  it("does not make a fueling plan for strength training", () => {
    expect(buildFuelingPreparation({ ...workout, sportType: "strength" }, [], [])).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { analyzeNutrition, type NutritionEntry } from "../src/lib/nutrition-analysis";

function entry(id: string, consumedAtSeconds: number, carbohydratesGrams: number, fluidMilliliters: number, sodiumMilligrams: number): NutritionEntry {
  return { id, consumedAtSeconds, description: id, carbohydratesGrams, fluidMilliliters, sodiumMilligrams, calories: 100 };
}

describe("nutrition analysis", () => {
  it("calculates totals and hourly rates from moving time", () => {
    const result = analyzeNutrition([entry("a", 1800, 30, 500, 250), entry("b", 5400, 60, 750, 500)], 7200, 7800);
    expect(result.carbohydratesGrams).toBe(90);
    expect(result.carbohydratesPerHour).toBe(45);
    expect(result.fluidPerHour).toBe(625);
    expect(result.sodiumPerHour).toBe(375);
    expect(result.calories).toBe(200);
  });

  it("detects only log gaps longer than sixty minutes", () => {
    const result = analyzeNutrition([entry("a", 1800, 30, 500, 250), entry("b", 6000, 30, 500, 250)], 7200, 7800);
    expect(result.gaps).toEqual([{ startSeconds: 1800, endSeconds: 6000, durationSeconds: 4200 }]);
  });

  it("clamps timestamps to the activity and handles zero moving time", () => {
    const result = analyzeNutrition([entry("a", 9999, 30, 500, 250)], 0, 3600);
    expect(result.carbohydratesPerHour).toBe(0);
    expect(result.gaps).toEqual([]);
  });
});

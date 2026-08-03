import { describe, expect, it } from "vitest";
import { buildBottleSchedule } from "../src/lib/bottle-schedule";

describe("bottle schedule", () => {
  it("distributes an empty bottle across regular drink events", () => {
    const events = buildBottleSchedule({ firstDrinkSeconds: 1200, lastDrinkSeconds: 3600, intervalMinutes: 20, remainingPercent: 0, volumeMilliliters: 750, carbohydratesGrams: 90, sodiumMilligrams: 800, calories: 360 });
    expect(events.map((event) => event.consumedAtSeconds)).toEqual([1200, 2400, 3600]);
    expect(events.reduce((sum, event) => sum + event.fluidMilliliters, 0)).toBe(750);
    expect(events.reduce((sum, event) => sum + event.carbohydratesGrams, 0)).toBe(90);
    expect(events.reduce((sum, event) => sum + event.sodiumMilligrams, 0)).toBe(800);
  });

  it("adds the declared end when it is not on the interval grid", () => {
    const events = buildBottleSchedule({ firstDrinkSeconds: 600, lastDrinkSeconds: 2500, intervalMinutes: 20, remainingPercent: 20, volumeMilliliters: 500, carbohydratesGrams: 50, sodiumMilligrams: 501, calories: 200 });
    expect(events.map((event) => event.consumedAtSeconds)).toEqual([600, 1800, 2500]);
    expect(events.reduce((sum, event) => sum + event.fluidMilliliters, 0)).toBe(400);
    expect(events.reduce((sum, event) => sum + event.sodiumMilligrams, 0)).toBe(401);
    expect(events.reduce((sum, event) => sum + event.carbohydratesGrams, 0)).toBeCloseTo(40);
  });

  it("rejects invalid or completely untouched bottles", () => {
    const base = { firstDrinkSeconds: 600, lastDrinkSeconds: 300, intervalMinutes: 20, remainingPercent: 0, volumeMilliliters: 500, carbohydratesGrams: 50, sodiumMilligrams: 500, calories: 200 };
    expect(buildBottleSchedule(base)).toEqual([]);
    expect(buildBottleSchedule({ ...base, lastDrinkSeconds: 1200, remainingPercent: 100 })).toEqual([]);
  });
});

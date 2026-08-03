import { describe, expect, it } from "vitest";
import { generateFourWeekBlock } from "../src/lib/planning/block-generator";

describe("four-week training block", () => {
  it("progresses the long ride and keeps the normal weekly target", () => {
    const weeks = generateFourWeekBlock({ startDate: "2026-08-03", weeklyDistanceKm: 125, startingLongRideKm: 50, recoveryWeekPercentage: 100 });
    expect(weeks.map((week) => week.weekStart)).toEqual(["2026-08-03", "2026-08-10", "2026-08-17", "2026-08-24"]);
    expect(weeks.map((week) => week.longRideTargetKm)).toEqual([50, 55, 60, 37.5]);
    expect(weeks.map((week) => week.targetDistanceKm)).toEqual([125, 125, 125, 125]);
    expect(weeks.map((week) => week.tempoSessionTarget)).toEqual([0, 1, 1, 0]);
  });

  it("can reduce only the recovery week when explicitly configured", () => {
    const weeks = generateFourWeekBlock({ startDate: "2026-08-03", weeklyDistanceKm: 125, startingLongRideKm: 50, recoveryWeekPercentage: 80 });
    expect(weeks.slice(0, 3).every((week) => week.targetDistanceKm === 125)).toBe(true);
    expect(weeks[3].targetDistanceKm).toBe(100);
  });

  it("caps the long ride at sixty percent of weekly distance", () => {
    const weeks = generateFourWeekBlock({ startDate: "2026-08-03", weeklyDistanceKm: 100, startingLongRideKm: 90, recoveryWeekPercentage: 100 });
    expect(Math.max(...weeks.map((week) => week.longRideTargetKm))).toBeLessThanOrEqual(60);
  });
});

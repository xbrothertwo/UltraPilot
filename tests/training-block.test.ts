import { describe, expect, it } from "vitest";
import { generateTrainingBlockWeeks } from "../src/lib/planning/block-generator";

describe("training block generation", () => {
  it("progresses the long ride and keeps the normal weekly target over a four-week cycling block", () => {
    const weeks = generateTrainingBlockWeeks({ startDate: "2026-08-03", sportType: "cycling", weekCount: 4, weeklyDistanceKm: 125, startingLongRideKm: 50, recoveryWeekPercentage: 100 });
    expect(weeks.map((week) => week.weekStart)).toEqual(["2026-08-03", "2026-08-10", "2026-08-17", "2026-08-24"]);
    expect(weeks.map((week) => week.phase)).toEqual(["foundation", "build", "peak", "recovery"]);
    expect(weeks.map((week) => week.longRideTargetKm)).toEqual([50, 55, 60, 37.5]);
    expect(weeks.map((week) => week.targetDistanceKm)).toEqual([125, 125, 125, 125]);
    expect(weeks.map((week) => week.tempoSessionTarget)).toEqual([0, 1, 1, 0]);
  });

  it("can reduce only the recovery week when explicitly configured", () => {
    const weeks = generateTrainingBlockWeeks({ startDate: "2026-08-03", sportType: "cycling", weekCount: 4, weeklyDistanceKm: 125, startingLongRideKm: 50, recoveryWeekPercentage: 80 });
    expect(weeks.slice(0, 3).every((week) => week.targetDistanceKm === 125)).toBe(true);
    expect(weeks[3].targetDistanceKm).toBe(100);
  });

  it("caps the long ride at sixty percent of weekly distance", () => {
    const weeks = generateTrainingBlockWeeks({ startDate: "2026-08-03", sportType: "cycling", weekCount: 4, weeklyDistanceKm: 100, startingLongRideKm: 90, recoveryWeekPercentage: 100 });
    expect(Math.max(...weeks.map((week) => week.longRideTargetKm))).toBeLessThanOrEqual(60);
  });

  it("introduces the load phase once there is room for it", () => {
    const weeks = generateTrainingBlockWeeks({ startDate: "2026-08-03", sportType: "cycling", weekCount: 5, weeklyDistanceKm: 100, startingLongRideKm: 40, recoveryWeekPercentage: 100 });
    expect(weeks.map((week) => week.phase)).toEqual(["foundation", "build", "load", "peak", "recovery"]);
  });

  it("scales the phase sequence across a longer block", () => {
    const weeks = generateTrainingBlockWeeks({ startDate: "2026-08-03", sportType: "cycling", weekCount: 8, weeklyDistanceKm: 100, startingLongRideKm: 40, recoveryWeekPercentage: 100 });
    expect(weeks).toHaveLength(8);
    expect(weeks[0].phase).toBe("foundation");
    expect(weeks[6].phase).toBe("peak");
    expect(weeks[7].phase).toBe("recovery");
  });

  it("keeps the shortest block to a hard week and a recovery week", () => {
    const weeks = generateTrainingBlockWeeks({ startDate: "2026-08-03", sportType: "cycling", weekCount: 2, weeklyDistanceKm: 100, startingLongRideKm: 40, recoveryWeekPercentage: 100 });
    expect(weeks.map((week) => week.phase)).toEqual(["peak", "recovery"]);
  });

  it("uses running-specific purpose text for a running block", () => {
    const weeks = generateTrainingBlockWeeks({ startDate: "2026-08-03", sportType: "running", weekCount: 4, weeklyDistanceKm: 60, startingLongRideKm: 20, recoveryWeekPercentage: 100 });
    expect(weeks.every((week) => !week.purpose.includes("Ausfahrt") && !week.purpose.includes("Rad"))).toBe(true);
    expect(weeks.some((week) => week.purpose.includes("Lauf"))).toBe(true);
  });
});

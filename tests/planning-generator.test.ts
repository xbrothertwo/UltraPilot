import { describe, expect, it } from "vitest";
import { calculateRemainingWeeklyDistance, cyclingDescription, generateDeterministicWeek } from "../src/lib/planning/generator";

describe("deterministic weekly planner", () => {
  it("subtracts completed and manually planned distance from the hard weekly goal", () => {
    expect(calculateRemainingWeeklyDistance(125, 35.4, 20)).toBe(69.6);
    expect(calculateRemainingWeeklyDistance(125, 130, 0)).toBe(0);
  });
  it("uses only free days and caps workday duration", () => {
    const result = generateDeterministicWeek({
      days: [
        { date: "2026-08-03", availableMinutes: 240, workday: false, occupied: false },
        { date: "2026-08-04", availableMinutes: 120, workday: true, occupied: false },
        { date: "2026-08-05", availableMinutes: 300, workday: false, occupied: true },
        { date: "2026-08-06", availableMinutes: 30, workday: false, occupied: false },
        { date: "2026-08-07", availableMinutes: 90, workday: false, occupied: false },
      ],
      weeklyGoalKm: 125,
      recentFourWeekDistanceKm: 400,
      recentAverageSpeedKmh: 25,
      workdayMaxMinutes: 75,
      strengthVariants: [],
    });
    expect(result.targetDistanceKm).toBe(125);
    expect(result.workouts).toHaveLength(3);
    expect(result.workouts.some((workout) => workout.scheduledDate === "2026-08-05")).toBe(false);
    expect(result.workouts.find((workout) => workout.scheduledDate === "2026-08-04")?.plannedDurationMinutes).toBeLessThanOrEqual(75);
  });

  it("plans the configured target exactly even without history", () => {
    const result = generateDeterministicWeek({ days: [{ date: "2026-08-03", availableMinutes: 240, workday: false, occupied: false }], weeklyGoalKm: 125, recentFourWeekDistanceKm: 0, recentAverageSpeedKmh: null, workdayMaxMinutes: 90, strengthVariants: [] });
    expect(result.targetDistanceKm).toBe(125);
    expect(result.workouts[0].plannedDistanceKm).toBe(125);
  });

  it("distributes the exact target without rounding drift", () => {
    const days = ["03", "04", "05"].map((day) => ({ date: `2026-08-${day}`, availableMinutes: 300, workday: false, occupied: false }));
    const result = generateDeterministicWeek({ days, weeklyGoalKm: 125, recentFourWeekDistanceKm: 500, recentAverageSpeedKmh: 25, workdayMaxMinutes: 90, strengthVariants: [] });
    expect(result.workouts.reduce((sum, workout) => sum + (workout.plannedDistanceKm ?? 0), 0)).toBe(125);
  });

  it("returns the same plan for identical inputs", () => {
    const input = { days: ["03", "04", "05"].map((day) => ({ date: `2026-08-${day}`, availableMinutes: 240, workday: false, occupied: false })), weeklyGoalKm: 125, recentFourWeekDistanceKm: 500, recentAverageSpeedKmh: 25, workdayMaxMinutes: 90, strengthVariants: [] };
    expect(generateDeterministicWeek(input)).toEqual(generateDeterministicWeek(input));
  });

  it("reserves a separate day for the requested summer strength session", () => {
    const days = ["03", "04", "05"].map((day) => ({ date: `2026-08-${day}`, availableMinutes: 180, workday: false, occupied: false }));
    const result = generateDeterministicWeek({ days, weeklyGoalKm: 125, recentFourWeekDistanceKm: 500, recentAverageSpeedKmh: 25, workdayMaxMinutes: 90, strengthVariants: ["B"] });
    expect(result.workouts.filter((workout) => workout.sportType === "cycling").reduce((sum, workout) => sum + (workout.plannedDistanceKm ?? 0), 0)).toBe(125);
    expect(result.workouts.find((workout) => workout.sportType === "strength")?.title).toBe("Krafttraining B");
  });

  it("creates duration-aware, deterministic ride instructions", () => {
    expect(cyclingDescription("tempo", 60)).toContain("2 × 8 min");
    expect(cyclingDescription("tempo", 90)).toContain("3 × 8 min");
    expect(cyclingDescription("endurance", 180)).toContain("gleichmäßig in Z2");
  });

  it("keeps red readiness days free and removes tempo on yellow days", () => {
    const result = generateDeterministicWeek({
      days: [
        { date: "2026-08-03", availableMinutes: 240, workday: false, occupied: false, readiness: "red" },
        { date: "2026-08-04", availableMinutes: 240, workday: false, occupied: false, readiness: "yellow" },
        { date: "2026-08-05", availableMinutes: 240, workday: false, occupied: false, readiness: "yellow" },
        { date: "2026-08-06", availableMinutes: 240, workday: false, occupied: false, readiness: "yellow" },
      ], weeklyGoalKm: 125, recentFourWeekDistanceKm: 500, recentAverageSpeedKmh: 25, workdayMaxMinutes: 90, strengthVariants: [],
    });
    expect(result.workouts.some((workout) => workout.scheduledDate === "2026-08-03")).toBe(false);
    expect(result.workouts.some((workout) => workout.intensity === "tempo")).toBe(false);
  });

  it("does not place tempo next to strength training", () => {
    const days = ["03", "04", "05", "06"].map((day) => ({ date: `2026-08-${day}`, availableMinutes: 240, workday: false, occupied: false }));
    const result = generateDeterministicWeek({ days, weeklyGoalKm: 125, recentFourWeekDistanceKm: 500, recentAverageSpeedKmh: 25, workdayMaxMinutes: 90, strengthVariants: ["A"] });
    const strength = result.workouts.find((workout) => workout.sportType === "strength");
    const tempo = result.workouts.find((workout) => workout.intensity === "tempo");
    if (strength && tempo) {
      const gap = Math.abs(new Date(`${strength.scheduledDate}T12:00:00Z`).getTime() - new Date(`${tempo.scheduledDate}T12:00:00Z`).getTime()) / 86_400_000;
      expect(gap).toBeGreaterThan(1);
    }
  });

  it("uses the block long-ride target while preserving exact weekly distance", () => {
    const days = ["03", "04", "05"].map((day) => ({ date: `2026-08-${day}`, availableMinutes: 300, workday: false, occupied: false }));
    const result = generateDeterministicWeek({ days, weeklyGoalKm: 125, recentFourWeekDistanceKm: 500, recentAverageSpeedKmh: 25, workdayMaxMinutes: 90, strengthVariants: [], longRideTargetKm: 60, tempoSessionTarget: 0 });
    const rides = result.workouts.filter((workout) => workout.sportType === "cycling");
    expect(rides.find((workout) => workout.title === "Lange ruhige Ausfahrt")?.plannedDistanceKm).toBe(60);
    expect(rides.reduce((sum, workout) => sum + (workout.plannedDistanceKm ?? 0), 0)).toBe(125);
    expect(rides.some((workout) => workout.intensity === "tempo")).toBe(false);
  });

  it("does not create a second long ride when the block target is already covered", () => {
    const days = ["05", "06"].map((day) => ({ date: `2026-08-${day}`, availableMinutes: 240, workday: false, occupied: false }));
    const result = generateDeterministicWeek({ days, weeklyGoalKm: 60, recentFourWeekDistanceKm: 500, recentAverageSpeedKmh: 25, workdayMaxMinutes: 90, strengthVariants: [], longRideTargetKm: 50, longRideCovered: true, tempoSessionTarget: 0 });
    expect(result.workouts.some((workout) => workout.title === "Lange ruhige Ausfahrt")).toBe(false);
  });

  it("uses a requested future date for the first cycling session", () => {
    const days = ["04", "05", "06"].map((day) => ({ date: `2026-08-${day}`, availableMinutes: 240, workday: false, occupied: false }));
    const result = generateDeterministicWeek({ days, weeklyGoalKm: 90, recentFourWeekDistanceKm: 400, recentAverageSpeedKmh: 25, workdayMaxMinutes: 90, strengthVariants: [], preferredCyclingDate: "2026-08-04" });
    expect(result.workouts.some((workout) => workout.sportType === "cycling" && workout.scheduledDate === "2026-08-04")).toBe(true);
  });

  it("creates a deterministic running week with running instructions", () => {
    const days = ["03", "04", "05", "06"].map((day) => ({ date: `2026-08-${day}`, availableMinutes: 120, workday: false, occupied: false }));
    const result = generateDeterministicWeek({ primarySport: "running", days, weeklyGoalKm: 30, recentFourWeekDistanceKm: 100, recentAverageSpeedKmh: 10, workdayMaxMinutes: 75, strengthVariants: [] });
    const runs = result.workouts.filter((workout) => workout.sportType === "running");
    expect(runs).toHaveLength(3);
    expect(runs.reduce((sum, workout) => sum + (workout.plannedDistanceKm ?? 0), 0)).toBe(30);
    expect(runs.some((workout) => workout.title === "Langer ruhiger Lauf")).toBe(true);
    expect(runs.every((workout) => !workout.description.includes("fahren"))).toBe(true);
  });
});

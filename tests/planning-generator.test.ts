import { describe, expect, it } from "vitest";
import { calculateRemainingWeeklyDistance, cyclingDescription, generateDeterministicWeek } from "../src/lib/planning/generator";
import { effectiveSessionCapacityMinutes } from "../src/lib/planning/session-capacity";

describe("effective session capacity", () => {
  it.each([
    { availableMinutes: Number.NaN, expected: 0 },
    { availableMinutes: Number.POSITIVE_INFINITY, expected: 0 },
    { availableMinutes: Number.NEGATIVE_INFINITY, expected: 0 },
  ])("normalizes invalid total availability to zero", ({ availableMinutes, expected }) => {
    expect(effectiveSessionCapacityMinutes({ availableMinutes, workday: false }, 90)).toBe(expected);
  });

  it.each([
    { longestAvailableWindowMinutes: Number.NaN, expected: 0 },
    { longestAvailableWindowMinutes: Number.POSITIVE_INFINITY, expected: 0 },
    { longestAvailableWindowMinutes: Number.NEGATIVE_INFINITY, expected: 0 },
  ])("normalizes an invalid longest window to zero", ({ longestAvailableWindowMinutes, expected }) => {
    expect(effectiveSessionCapacityMinutes({ availableMinutes: 120, longestAvailableWindowMinutes, workday: false }, 90)).toBe(expected);
  });

  it.each([
    { workdayMaxMinutes: Number.NaN, expected: 0 },
    { workdayMaxMinutes: Number.POSITIVE_INFINITY, expected: 0 },
    { workdayMaxMinutes: Number.NEGATIVE_INFINITY, expected: 0 },
  ])("normalizes an invalid workday cap to zero", ({ workdayMaxMinutes, expected }) => {
    expect(effectiveSessionCapacityMinutes({ availableMinutes: 120, workday: true }, workdayMaxMinutes)).toBe(expected);
  });

  it("ignores an invalid workday cap on a free day", () => {
    expect(effectiveSessionCapacityMinutes({ availableMinutes: 120, workday: false }, Number.NaN)).toBe(120);
  });

  it("falls back to total availability when the longest window is missing", () => {
    expect(effectiveSessionCapacityMinutes({ availableMinutes: 120, workday: true }, 90)).toBe(90);
  });
});

describe("deterministic weekly planner", () => {
  it("plans Gym-only weeks even when no endurance distance is open", () => {
    const result = generateDeterministicWeek({
      primarySport: "running",
      runningSessionsPerWeek: 3,
      days: ["03", "04", "05"].map((day) => ({
        date: `2026-08-${day}`,
        availableMinutes: 120,
        workday: false,
        occupied: false,
      })),
      weeklyGoalKm: 0,
      recentFourWeekDistanceKm: 0,
      recentAverageSpeedKmh: null,
      workdayMaxMinutes: 90,
      strengthVariants: ["A", "B", "A"],
    });
    expect(result.workouts).toHaveLength(3);
    expect(result.workouts.every((workout) => workout.sportType === "strength")).toBe(true);
    expect(result.workouts.every((workout) => workout.plannedDistanceKm === null)).toBe(true);
  });

  it("creates a visible three-run plus three-Gym first week", () => {
    const result = generateDeterministicWeek({
      primarySport: "running",
      runningSessionsPerWeek: 3,
      days: ["03", "04", "05", "06", "07", "08", "09"].map((day) => ({
        date: `2026-08-${day}`,
        availableMinutes: 120,
        workday: false,
        occupied: false,
      })),
      weeklyGoalKm: 12,
      recentFourWeekDistanceKm: 0,
      recentAverageSpeedKmh: null,
      workdayMaxMinutes: 90,
      strengthVariants: ["A", "B", "A"],
    });
    expect(result.workouts.filter((workout) => workout.sportType === "running")).toHaveLength(3);
    expect(result.workouts.filter((workout) => workout.sportType === "strength")).toHaveLength(3);
  });

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

  it.each([
    { sport: "cycling" as const, cap: 44, expectedCount: 0, expectedDuration: undefined },
    { sport: "cycling" as const, cap: 45, expectedCount: 1, expectedDuration: 45 },
    { sport: "running" as const, cap: 29, expectedCount: 0, expectedDuration: undefined },
    { sport: "running" as const, cap: 30, expectedCount: 1, expectedDuration: 30 },
  ])(
    "$sport respects a $cap minute workday cap",
    ({ sport, cap, expectedCount, expectedDuration }) => {
      const result = generateDeterministicWeek({
        primarySport: sport,
        runningSessionsPerWeek: 1,
        days: [{ date: "2026-08-03", availableMinutes: 180, workday: true, occupied: false }],
        weeklyGoalKm: 100,
        recentFourWeekDistanceKm: 400,
        recentAverageSpeedKmh: sport === "running" ? 10 : 25,
        workdayMaxMinutes: cap,
        strengthVariants: [],
      });
      const workouts = result.workouts.filter((workout) => workout.sportType === sport);
      expect(workouts).toHaveLength(expectedCount);
      expect(workouts[0]?.plannedDurationMinutes).toBe(expectedDuration);
    },
  );

  it.each([
    { cap: 59, expected: false },
    { cap: 60, expected: true },
  ])("strength eligibility respects a $cap minute workday cap", ({ cap, expected }) => {
    const result = generateDeterministicWeek({
      days: [
        { date: "2026-08-03", availableMinutes: 180, workday: true, occupied: false },
        { date: "2026-08-04", availableMinutes: 240, workday: false, occupied: false },
      ],
      weeklyGoalKm: 50,
      recentFourWeekDistanceKm: 400,
      recentAverageSpeedKmh: 25,
      workdayMaxMinutes: cap,
      strengthVariants: ["A"],
    });
    const strength = result.workouts.find((workout) => workout.sportType === "strength");
    expect(Boolean(strength)).toBe(expected);
    if (expected) expect(strength?.plannedDurationMinutes).toBe(60);
  });

  it("does not apply the workday cap to a free day", () => {
    const result = generateDeterministicWeek({
      days: [{ date: "2026-08-03", availableMinutes: 120, workday: false, occupied: false }],
      weeklyGoalKm: 50,
      recentFourWeekDistanceKm: 400,
      recentAverageSpeedKmh: 25,
      workdayMaxMinutes: 44,
      strengthVariants: [],
    });
    expect(result.workouts[0]?.plannedDurationMinutes).toBe(120);
  });

  it("uses a shorter contiguous window instead of a higher workday cap", () => {
    const result = generateDeterministicWeek({
      days: [{ date: "2026-08-03", availableMinutes: 180, longestAvailableWindowMinutes: 50, workday: true, occupied: false }],
      weeklyGoalKm: 50,
      recentFourWeekDistanceKm: 400,
      recentAverageSpeedKmh: 25,
      workdayMaxMinutes: 90,
      strengthVariants: [],
    });
    expect(result.workouts[0]?.plannedDurationMinutes).toBe(50);
  });
  it("does not combine separate availability windows into one workout", () => {
  const result = generateDeterministicWeek({
    primarySport: "cycling",
    days: [
      {
        date: "2026-08-03",
        availableMinutes: 120,
        longestAvailableWindowMinutes: 60,
        workday: false,
        occupied: false,
      },
    ],
    weeklyGoalKm: 65,
    recentFourWeekDistanceKm: 400,
    recentAverageSpeedKmh: 25,
    workdayMaxMinutes: 90,
    strengthVariants: [],
  });

  const ride = result.workouts.find(
    (workout) => workout.sportType === "cycling",
  );

  expect(ride?.plannedDurationMinutes).toBe(60);
  expect(ride?.plannedDistanceKm).toBe(25);
});
  it("caps cycling distance with a conservative fallback when history is missing", () => {
  const result = generateDeterministicWeek({
    days: [
      {
        date: "2026-08-03",
        availableMinutes: 240,
        workday: false,
        occupied: false,
      },
    ],
    weeklyGoalKm: 125,
    recentFourWeekDistanceKm: 0,
    recentAverageSpeedKmh: null,
    workdayMaxMinutes: 90,
    strengthVariants: [],
  });

  const ride = result.workouts.find(
    (workout) => workout.sportType === "cycling",
  );

  expect(ride?.plannedDurationMinutes).toBe(240);
  expect(ride?.plannedDistanceKm).toBe(88);
  expect(result.ruleSummary).toContain("37");
  expect(result.ruleSummary).toContain("offen");
});

it("reduces running distance when the requested distance does not fit the available time", () => {
  const result = generateDeterministicWeek({
    primarySport: "running",
    runningSessionsPerWeek: 1,
    days: [
      {
        date: "2026-08-03",
        availableMinutes: 75,
        workday: false,
        occupied: false,
      },
    ],
    weeklyGoalKm: 40,
    recentFourWeekDistanceKm: 100,
    recentAverageSpeedKmh: 10,
    workdayMaxMinutes: 75,
    strengthVariants: [],
  });

  const run = result.workouts.find(
    (workout) => workout.sportType === "running",
  );

  expect(run?.plannedDurationMinutes).toBe(75);
  expect(run?.plannedDistanceKm).toBe(12.5);
});

it("reduces cycling distance when the requested distance does not fit the available time", () => {
  const result = generateDeterministicWeek({
    primarySport: "cycling",
    days: [
      {
        date: "2026-08-03",
        availableMinutes: 60,
        workday: false,
        occupied: false,
      },
    ],
    weeklyGoalKm: 65,
    recentFourWeekDistanceKm: 400,
    recentAverageSpeedKmh: 25,
    workdayMaxMinutes: 60,
    strengthVariants: [],
  });

  const ride = result.workouts.find(
    (workout) => workout.sportType === "cycling",
  );

  expect(ride?.plannedDurationMinutes).toBe(60);
  expect(ride?.plannedDistanceKm).toBe(25);
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

  it.each([1, 2, 3, 4, 5, 6, 7])(
  "creates valid distances for %i weekly runs",
  (runningSessionsPerWeek) => {
    const days = ["03", "04", "05", "06", "07", "08", "09"].map((day) => ({
      date: `2026-08-${day}`,
      availableMinutes: 300,
      workday: false,
      occupied: false,
    }));

    const result = generateDeterministicWeek({
      primarySport: "running",
      runningSessionsPerWeek,
      days,
      weeklyGoalKm: 42,
      recentFourWeekDistanceKm: 140,
      recentAverageSpeedKmh: 10,
      workdayMaxMinutes: 75,
      strengthVariants: [],
    });

    const runs = result.workouts.filter(
      (workout) => workout.sportType === "running",
    );

    const distances = runs.map((workout) => workout.plannedDistanceKm);

    expect(runs).toHaveLength(runningSessionsPerWeek);

    expect(
      distances.every(
        (distance) =>
          typeof distance === "number" &&
          Number.isFinite(distance) &&
          distance >= 0,
      ),
    ).toBe(true);

    const totalDistance = distances.reduce<number>(
      (sum, distance) => sum + (distance ?? 0),
      0,
    );

    expect(totalDistance).toBeCloseTo(42, 5);
  },
);
  it("distributes three runs as 50, 35 and 15 percent", () => {
  const result = generateDeterministicWeek({
    primarySport: "running",
    runningSessionsPerWeek: 3,
    days: ["03", "04", "05"].map((day) => ({
      date: `2026-08-${day}`,
      availableMinutes: 300,
      workday: false,
      occupied: false,
    })),
    weeklyGoalKm: 40,
    recentFourWeekDistanceKm: 120,
    recentAverageSpeedKmh: 10,
    workdayMaxMinutes: 75,
    strengthVariants: [],
  });

  const distances = result.workouts
  .filter((workout) => workout.sportType === "running")
  .map((workout) => workout.plannedDistanceKm ?? 0)
  .sort((a, b) => b - a);

  expect(distances).toEqual([20, 14, 6]);
});
  it("forces a same-day cross-training run to stay easy", () => {
    const result = generateDeterministicWeek({
      primarySport: "running",
      runningSessionsPerWeek: 3,
      easyRunWithCrossTraining: true,
      days: [
        { date: "2026-08-03", availableMinutes: 180, workday: false, occupied: false, crossTraining: true },
        { date: "2026-08-04", availableMinutes: 120, workday: false, occupied: false },
        { date: "2026-08-05", availableMinutes: 120, workday: false, occupied: false },
      ],
      weeklyGoalKm: 30,
      recentFourWeekDistanceKm: 120,
      recentAverageSpeedKmh: 10,
      workdayMaxMinutes: 75,
      strengthVariants: [],
    });
    const pairedRun = result.workouts.find((workout) => workout.scheduledDate === "2026-08-03" && workout.sportType === "running");
    expect(pairedRun?.intensity).toBe("easy");
    expect(pairedRun?.title).toBe("Lockerer Dauerlauf");
  });

  it("keeps strength on its own day even with pairing enabled, when enough separate days exist", () => {
    const days = ["03", "04", "05", "06"].map((day) => ({ date: `2026-08-${day}`, availableMinutes: 180, workday: false, occupied: false }));
    const result = generateDeterministicWeek({ primarySport: "running", runningSessionsPerWeek: 3, easyRunWithCrossTraining: true, days, weeklyGoalKm: 30, recentFourWeekDistanceKm: 120, recentAverageSpeedKmh: 10, workdayMaxMinutes: 75, strengthVariants: ["A"] });
    const strength = result.workouts.find((workout) => workout.sportType === "strength");
    const sameDayRun = result.workouts.find((workout) => workout.sportType === "running" && workout.scheduledDate === strength?.scheduledDate);
    expect(sameDayRun).toBeUndefined();
  });

  it("protects tempo from a cross-training day that already exists on the calendar, not just a newly placed one", () => {
    const days = [
      { date: "2026-08-03", availableMinutes: 240, workday: false, occupied: false, crossTraining: true },
      { date: "2026-08-04", availableMinutes: 240, workday: false, occupied: false },
    ];
    const result = generateDeterministicWeek({ days, weeklyGoalKm: 125, recentFourWeekDistanceKm: 500, recentAverageSpeedKmh: 25, workdayMaxMinutes: 90, strengthVariants: [] });
    expect(result.workouts.some((workout) => workout.intensity === "tempo")).toBe(false);
  });

  it("avoids scheduling the long ride the day right after cross-training", () => {
    const days = [
      { date: "2026-08-03", availableMinutes: 240, workday: false, occupied: false, crossTraining: true },
      { date: "2026-08-04", availableMinutes: 300, workday: false, occupied: false },
      { date: "2026-08-05", availableMinutes: 240, workday: false, occupied: false },
    ];
    const result = generateDeterministicWeek({ days, weeklyGoalKm: 90, recentFourWeekDistanceKm: 300, recentAverageSpeedKmh: 25, workdayMaxMinutes: 90, strengthVariants: [], longRideTargetKm: 50, tempoSessionTarget: 0 });
    const longRide = result.workouts.find((workout) => workout.title === "Lange ruhige Ausfahrt");
    expect(longRide?.scheduledDate).not.toBe("2026-08-04");
    expect(longRide?.scheduledDate).toBe("2026-08-05");
  });
});

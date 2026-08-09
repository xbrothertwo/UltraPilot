import { describe, expect, it } from "vitest";
import type { Activity } from "../src/lib/demo-data";
import { calculateRemainingWeeklyDistance, generateDeterministicWeek } from "../src/lib/planning/generator";
import {
  hasBlockingWorkoutOnDate,
  plannedCrossTrainingDates,
  remainingStrengthSessions,
  retainedLongSessionCovered,
  retainedPlannedDistanceKm,
  retainedPlannedWorkouts,
} from "../src/lib/planning/regeneration-accounting";
import { reconcilePlannedWorkouts } from "../src/lib/planning/reconciliation";
import type { PlannedWorkout } from "../src/lib/planning/workouts";

function workout(overrides: Partial<PlannedWorkout> = {}): PlannedWorkout {
  return {
    id: "workout-1",
    scheduledDate: "2026-08-03",
    sportType: "cycling",
    title: "Ausdauer",
    description: null,
    personalNote: null,
    intensity: "endurance",
    plannedDurationMinutes: 120,
    plannedDistanceKm: 40,
    status: "planned",
    linkedActivityId: null,
    source: "automatic",
    generationId: null,
    locked: true,
    preferredStartTime: null,
    targetHeartRateZone: null,
    targetPowerZone: null,
    ...overrides,
  };
}

function activity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: "activity-1",
    userId: "user",
    sportType: "cycling",
    activityDate: "2026-08-03T08:00:00.000Z",
    title: "Fahrt",
    distanceMeters: 50_000,
    movingTimeSeconds: 7_200,
    elapsedTimeSeconds: 7_200,
    elevationGainMeters: 300,
    averageSpeedKmh: 25,
    averageHeartRate: null,
    maximumHeartRate: null,
    averagePower: null,
    normalizedPower: null,
    source: "gpx",
    createdAt: "2026-08-03T12:00:00.000Z",
    ...overrides,
  };
}

describe("locked workout regeneration accounting", () => {
  it("subtracts a retained locked automatic primary-sport distance", () => {
    const retained = retainedPlannedWorkouts(reconcilePlannedWorkouts([workout()], []));
    expect(calculateRemainingWeeklyDistance(100, 0, retainedPlannedDistanceKm(retained, "cycling"))).toBe(60);
  });

  it("does not subtract a skipped locked workout", () => {
    const retained = retainedPlannedWorkouts(reconcilePlannedWorkouts([workout({ status: "skipped" })], []));
    expect(calculateRemainingWeeklyDistance(100, 0, retainedPlannedDistanceKm(retained, "cycling"))).toBe(100);
  });

  it("counts only actual distance when a locked workout is matched", () => {
    const retained = retainedPlannedWorkouts(reconcilePlannedWorkouts([workout()], [activity()]));
    expect(calculateRemainingWeeklyDistance(100, 50, retainedPlannedDistanceKm(retained, "cycling"))).toBe(50);
  });

  it("does not subtract a retained workout from another sport", () => {
    const retained = retainedPlannedWorkouts(reconcilePlannedWorkouts([workout({ sportType: "running", plannedDistanceKm: 10 })], []));
    expect(retainedPlannedDistanceKm(retained, "cycling")).toBe(0);
  });

  it("lets a retained locked long session cover the long-session target", () => {
    const retained = retainedPlannedWorkouts(reconcilePlannedWorkouts([workout({ title: "Lange ruhige Ausfahrt", plannedDistanceKm: 60 })], []));
    const longRideCovered = retainedLongSessionCovered(retained, "cycling", 60);
    const result = generateDeterministicWeek({
      days: [{ date: "2026-08-04", availableMinutes: 240, workday: false, occupied: false }],
      weeklyGoalKm: 40,
      recentFourWeekDistanceKm: 300,
      recentAverageSpeedKmh: 25,
      workdayMaxMinutes: 90,
      strengthVariants: [],
      longRideTargetKm: 60,
      longRideCovered,
    });
    expect(longRideCovered).toBe(true);
    expect(result.workouts.some((item) => item.title === "Lange ruhige Ausfahrt")).toBe(false);
  });

  it("counts a retained locked automatic strength workout", () => {
    const retained = retainedPlannedWorkouts(reconcilePlannedWorkouts([workout({ sportType: "strength", plannedDistanceKm: null })], []));
    expect(remainingStrengthSessions(1, 0, 0, retained)).toBe(0);
  });

  it("does not count a skipped locked strength workout", () => {
    const retained = retainedPlannedWorkouts(reconcilePlannedWorkouts([workout({ sportType: "strength", plannedDistanceKm: null, status: "skipped" })], []));
    expect(remainingStrengthSessions(1, 0, 0, retained)).toBe(1);
  });

  it("activates cross-training and adjacency protection for locked strength", () => {
    const lockedStrength = workout({ sportType: "strength", plannedDistanceKm: null });
    const retained = retainedPlannedWorkouts(reconcilePlannedWorkouts([lockedStrength], []));
    const crossTrainingDates = plannedCrossTrainingDates(retained);
    const result = generateDeterministicWeek({
      days: [
        { date: "2026-08-03", availableMinutes: 240, workday: false, occupied: true, crossTraining: crossTrainingDates.has("2026-08-03") },
        { date: "2026-08-04", availableMinutes: 300, workday: false, occupied: false },
        { date: "2026-08-05", availableMinutes: 240, workday: false, occupied: false },
      ],
      weeklyGoalKm: 90,
      recentFourWeekDistanceKm: 300,
      recentAverageSpeedKmh: 25,
      workdayMaxMinutes: 90,
      strengthVariants: [],
      longRideTargetKm: 50,
      tempoSessionTarget: 1,
    });
    expect(crossTrainingDates.has("2026-08-03")).toBe(true);
    expect(result.workouts.find((item) => item.title === "Lange ruhige Ausfahrt")?.scheduledDate).toBe("2026-08-05");
    expect(result.workouts.some((item) => item.intensity === "tempo")).toBe(false);
  });

  it("keeps the day of a locked workout occupied", () => {
    expect(hasBlockingWorkoutOnDate([workout()], "2026-08-03", () => false)).toBe(true);
  });

  it("preserves existing manual planned-workout accounting", () => {
    const retained = retainedPlannedWorkouts(reconcilePlannedWorkouts([workout({ source: "manual", locked: false })], []));
    expect(retainedPlannedDistanceKm(retained, "cycling")).toBe(40);
    expect(hasBlockingWorkoutOnDate(retained, "2026-08-03", () => false)).toBe(true);
  });
});

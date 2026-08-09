import type { ReconciledWorkout } from "./reconciliation";
import type { PlannedWorkout } from "./workouts";

export function retainedPlannedWorkouts(
  reconciled: ReconciledWorkout[],
): PlannedWorkout[] {
  return reconciled
    .filter(
      (item) =>
        item.effectiveStatus === "planned" &&
        (item.workout.source !== "automatic" || item.workout.locked),
    )
    .map((item) => item.workout);
}

export function retainedPlannedDistanceKm(
  workouts: PlannedWorkout[],
  primarySport: "cycling" | "running",
): number {
  return workouts
    .filter((workout) => workout.sportType === primarySport)
    .reduce((sum, workout) => sum + (workout.plannedDistanceKm ?? 0), 0);
}

export function retainedLongSessionCovered(
  workouts: PlannedWorkout[],
  primarySport: "cycling" | "running",
  targetDistanceKm: number,
): boolean {
  return workouts.some(
    (workout) =>
      workout.sportType === primarySport &&
      (workout.title.toLowerCase().includes("lang") ||
        (workout.plannedDistanceKm ?? 0) >= targetDistanceKm * 0.8),
  );
}

export function remainingStrengthSessions(
  configuredSessions: number,
  manualStrengthCount: number,
  completedAutomaticStrengthCount: number,
  retainedWorkouts: PlannedWorkout[],
): number {
  const retainedLockedAutomaticStrengthCount = retainedWorkouts.filter(
    (workout) =>
      workout.source === "automatic" && workout.sportType === "strength",
  ).length;

  return Math.max(
    0,
    configuredSessions -
      manualStrengthCount -
      completedAutomaticStrengthCount -
      retainedLockedAutomaticStrengthCount,
  );
}

export function plannedCrossTrainingDates(
  workouts: PlannedWorkout[],
): Set<string> {
  return new Set(
    workouts
      .filter(
        (workout) =>
          workout.status !== "skipped" &&
          (workout.sportType === "strength" ||
            workout.sportType === "volleyball"),
      )
      .map((workout) => workout.scheduledDate),
  );
}

export function hasBlockingWorkoutOnDate(
  workouts: PlannedWorkout[],
  date: string,
  canPair: (workout: PlannedWorkout) => boolean,
): boolean {
  return workouts.some(
    (workout) =>
      workout.scheduledDate === date &&
      workout.status !== "skipped" &&
      !canPair(workout),
  );
}

import type { Activity } from "../demo-data";
import type { PlannedWorkout } from "./workouts";

type MatchableWorkout = Pick<PlannedWorkout, "id" | "scheduledDate" | "sportType" | "plannedDurationMinutes" | "plannedDistanceKm" | "status" | "linkedActivityId">;
type MatchableActivity = Pick<Activity, "id" | "sportType" | "activityDate" | "distanceMeters" | "movingTimeSeconds">;

export type WorkoutActivityMatch = { workoutId: string; activityId: string; score: number };
export type PlanComparison = { distanceDeltaKm: number | null; durationDeltaMinutes: number | null; distanceRatio: number | null; durationRatio: number | null };
export type ReconciledWorkout = { workout: PlannedWorkout; activity: Activity | null; effectiveStatus: "planned" | "completed" | "skipped"; comparison: PlanComparison | null };

function activityDateKey(value: string): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}

function dayNumber(value: string): number {
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

function relativeDifference(actual: number, planned: number | null): number | null {
  if (planned === null || planned <= 0) return null;
  return Math.abs(actual - planned) / planned;
}

export function matchPlannedWorkouts(workouts: MatchableWorkout[], activities: MatchableActivity[]): WorkoutActivityMatch[] {
  const usedWorkouts = new Set<string>();
  const usedActivities = new Set<string>();
  const matches: WorkoutActivityMatch[] = [];

  for (const workout of workouts) {
    if (!workout.linkedActivityId) continue;
    const activity = activities.find((candidate) => candidate.id === workout.linkedActivityId);
    if (!activity || usedActivities.has(activity.id)) continue;
    matches.push({ workoutId: workout.id, activityId: activity.id, score: -1 });
    usedWorkouts.add(workout.id);
    usedActivities.add(activity.id);
  }

  const candidates = workouts.flatMap((workout) => {
    if (usedWorkouts.has(workout.id) || workout.status === "skipped" || workout.sportType !== "cycling") return [];
    return activities.flatMap((activity) => {
      if (usedActivities.has(activity.id) || activity.sportType !== "cycling") return [];
      const dayDifference = Math.abs(dayNumber(workout.scheduledDate) - dayNumber(activityDateKey(activity.activityDate)));
      if (dayDifference > 1) return [];
      const distanceDifference = relativeDifference(activity.distanceMeters / 1000, workout.plannedDistanceKm);
      const durationDifference = relativeDifference(activity.movingTimeSeconds / 60, workout.plannedDurationMinutes);
      const hasPlannedMetric = distanceDifference !== null || durationDifference !== null;
      const similarity = (distanceDifference ?? 0) + (durationDifference ?? 0);
      if (dayDifference === 1 && (!hasPlannedMetric || similarity > 1.25)) return [];
      return [{ workoutId: workout.id, activityId: activity.id, score: dayDifference * 3 + similarity }];
    });
  }).sort((a, b) => a.score - b.score || a.workoutId.localeCompare(b.workoutId) || a.activityId.localeCompare(b.activityId));

  for (const candidate of candidates) {
    if (usedWorkouts.has(candidate.workoutId) || usedActivities.has(candidate.activityId)) continue;
    matches.push(candidate);
    usedWorkouts.add(candidate.workoutId);
    usedActivities.add(candidate.activityId);
  }
  return matches;
}

export function comparePlanWithActivity(workout: MatchableWorkout, activity: MatchableActivity): PlanComparison {
  const actualDistanceKm = activity.distanceMeters / 1000;
  const actualDurationMinutes = activity.movingTimeSeconds / 60;
  return {
    distanceDeltaKm: workout.plannedDistanceKm === null ? null : Math.round((actualDistanceKm - workout.plannedDistanceKm) * 10) / 10,
    durationDeltaMinutes: workout.plannedDurationMinutes === null ? null : Math.round(actualDurationMinutes - workout.plannedDurationMinutes),
    distanceRatio: workout.plannedDistanceKm && workout.plannedDistanceKm > 0 ? actualDistanceKm / workout.plannedDistanceKm : null,
    durationRatio: workout.plannedDurationMinutes && workout.plannedDurationMinutes > 0 ? actualDurationMinutes / workout.plannedDurationMinutes : null,
  };
}

export function reconcilePlannedWorkouts(workouts: PlannedWorkout[], activities: Activity[]): ReconciledWorkout[] {
  const matches = new Map(matchPlannedWorkouts(workouts, activities).map((match) => [match.workoutId, match.activityId]));
  return workouts.map((workout) => {
    const activity = activities.find((candidate) => candidate.id === matches.get(workout.id)) ?? null;
    return { workout, activity, effectiveStatus: workout.status === "skipped" ? "skipped" : activity ? "completed" : workout.status, comparison: activity ? comparePlanWithActivity(workout, activity) : null };
  });
}

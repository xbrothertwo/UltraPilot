import type { Activity } from "@/lib/demo-data";
import type { GymHistoryItem } from "@/lib/gym/data";
import {
  isPlanComparisonClose,
  type PlanComparison,
  type ReconciledWorkout,
} from "@/lib/planning/reconciliation";
import type { PlannedWorkout } from "@/lib/planning/workouts";
import type { ActivitySportType } from "@/lib/sports";

export type HistorySport = ActivitySportType | "strength";
export type HistoryPlanStatus = "matched" | "deviation" | "unplanned";

export type HistoryPlanMatch = {
  status: Exclude<HistoryPlanStatus, "unplanned">;
  workoutId: string;
  workoutTitle: string;
  comparison: PlanComparison | null;
};

type HistoryBase = {
  id: string;
  title: string;
  occurredAt: string;
  durationSeconds: number;
  sportType: HistorySport;
  planMatch: HistoryPlanMatch | null;
  href: string;
};

export type ActivityHistoryEntry = HistoryBase & {
  kind: "activity";
  distanceMeters: number;
  averageSpeedKmh: number | null;
  averageHeartRate: number | null;
  maximumHeartRate: number | null;
  averagePower: number | null;
  elevationGainMeters: number;
  source: string;
};

export type GymHistoryEntry = HistoryBase & {
  kind: "gym";
  sportType: "strength";
  exerciseCount: number;
  workingSets: number;
  programName: string | null;
};

export type TrainingHistoryEntry = ActivityHistoryEntry | GymHistoryEntry;

export type HistoryFilters = {
  query: string;
  sport: "all" | HistorySport;
  period: "all" | "30" | "90" | "365";
  plan: "all" | HistoryPlanStatus | "planned";
  sort: "newest" | "oldest" | "distance" | "duration";
};

function planMatch(item: ReconciledWorkout | undefined): HistoryPlanMatch | null {
  if (!item?.activity) return null;
  return {
    status: isPlanComparisonClose(item.comparison) ? "matched" : "deviation",
    workoutId: item.workout.id,
    workoutTitle: item.workout.title,
    comparison: item.comparison,
  };
}

export function buildTrainingHistory(
  activities: readonly Activity[],
  gymSessions: readonly GymHistoryItem[],
  reconciled: readonly ReconciledWorkout[],
  plannedWorkouts: readonly PlannedWorkout[],
): TrainingHistoryEntry[] {
  const matchByActivity = new Map(
    reconciled.flatMap((item) => item.activity ? [[item.activity.id, item] as const] : []),
  );
  const workoutById = new Map(plannedWorkouts.map((workout) => [workout.id, workout]));
  const activityEntries: ActivityHistoryEntry[] = activities.map((activity) => ({
    kind: "activity",
    id: activity.id,
    title: activity.title,
    occurredAt: activity.activityDate,
    durationSeconds: activity.movingTimeSeconds,
    sportType: activity.sportType,
    distanceMeters: activity.distanceMeters,
    averageSpeedKmh: activity.averageSpeedKmh,
    averageHeartRate: activity.averageHeartRate,
    maximumHeartRate: activity.maximumHeartRate,
    averagePower: activity.averagePower,
    elevationGainMeters: activity.elevationGainMeters,
    source: activity.source,
    planMatch: planMatch(matchByActivity.get(activity.id)),
    href: `/activities/${activity.id}`,
  }));
  const gymEntries: GymHistoryEntry[] = gymSessions.map((session) => {
    const workout = session.plannedWorkoutId ? workoutById.get(session.plannedWorkoutId) : null;
    return {
      kind: "gym",
      id: session.id,
      title: session.name,
      occurredAt: session.startedAt,
      durationSeconds: session.durationSeconds ?? 0,
      sportType: "strength",
      exerciseCount: session.exerciseCount,
      workingSets: session.workingSets,
      programName: session.programName,
      planMatch: workout ? {
        status: "matched",
        workoutId: workout.id,
        workoutTitle: workout.title,
        comparison: null,
      } : null,
      href: `/gym/workout/${session.id}`,
    };
  });
  return [...activityEntries, ...gymEntries].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

export function filterTrainingHistory(
  entries: readonly TrainingHistoryEntry[],
  filters: HistoryFilters,
  now: Date,
): TrainingHistoryEntry[] {
  const normalizedQuery = filters.query.trim().toLocaleLowerCase("de-DE");
  const cutoff = filters.period === "all" ? null : now.getTime() - Number(filters.period) * 86_400_000;
  const filtered = entries.filter((entry) => {
    const searchable = `${entry.title} ${entry.kind === "gym" ? entry.programName ?? "" : entry.source}`.toLocaleLowerCase("de-DE");
    if (normalizedQuery && !searchable.includes(normalizedQuery)) return false;
    if (filters.sport !== "all" && entry.sportType !== filters.sport) return false;
    if (cutoff !== null && new Date(entry.occurredAt).getTime() < cutoff) return false;
    const status: HistoryPlanStatus = entry.planMatch?.status ?? "unplanned";
    if (filters.plan === "planned" && status === "unplanned") return false;
    if (filters.plan !== "all" && filters.plan !== "planned" && status !== filters.plan) return false;
    return true;
  });
  return [...filtered].sort((a, b) => {
    if (filters.sort === "oldest") return a.occurredAt.localeCompare(b.occurredAt);
    if (filters.sort === "duration") return b.durationSeconds - a.durationSeconds || b.occurredAt.localeCompare(a.occurredAt);
    if (filters.sort === "distance") {
      const aDistance = a.kind === "activity" ? a.distanceMeters : 0;
      const bDistance = b.kind === "activity" ? b.distanceMeters : 0;
      return bDistance - aDistance || b.occurredAt.localeCompare(a.occurredAt);
    }
    return b.occurredAt.localeCompare(a.occurredAt);
  });
}

export function historyMonthKey(value: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    month: "long",
    year: "numeric",
    timeZone: "Europe/Berlin",
  }).format(new Date(value));
}

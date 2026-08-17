import type { Activity } from "@/lib/demo-data";
import type { ReconciledWorkout } from "@/lib/planning/reconciliation";
import type { PlannedWorkout } from "@/lib/planning/workouts";
import {
  formatPaceTarget,
  getPlannedHeartRateTarget,
  getPlannedPaceTarget,
  getZoneTarget,
  type PaceZone,
  type ZoneDefinition,
} from "@/lib/training-zones";

export type WorkoutDisplayState =
  | "planned"
  | "completed"
  | "skipped"
  | "locked"
  | "adjusted";

export type WorkoutCalendarView = {
  sportLabel: string;
  intensityLabel: string;
  statusLabel: string;
  state: WorkoutDisplayState;
  metrics: string[];
  badges: string[];
};

const sportLabels: Record<PlannedWorkout["sportType"], string> = {
  cycling: "Rad",
  running: "Lauf",
  strength: "Kraft",
  volleyball: "Volleyball",
  mobility: "Mobility",
  recovery: "Regeneration",
  other: "Sonstiges",
};

const intensityLabels: Record<PlannedWorkout["intensity"], string> = {
  recovery: "Regeneration",
  easy: "Locker",
  endurance: "Grundlage",
  tempo: "Tempo",
  threshold: "Schwelle",
  vo2: "VO₂max",
  strength: "Kraft",
};

function distance(value: number): string {
  return `${value.toLocaleString("de-DE", { maximumFractionDigits: 1 })} km`;
}

function pace(secondsPerKilometer: number): string {
  const rounded = Math.round(secondsPerKilometer);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")} min/km`;
}

function statusState(item: ReconciledWorkout): Pick<WorkoutCalendarView, "state" | "statusLabel"> {
  if (item.effectiveStatus === "completed") {
    return { state: "completed", statusLabel: "Absolviert" };
  }
  if (item.effectiveStatus === "skipped") {
    return { state: "skipped", statusLabel: "Ausgefallen" };
  }
  if (item.workout.locked) {
    return { state: "locked", statusLabel: "Gesperrt" };
  }
  if (item.workout.source === "manual" && item.workout.generationId !== null) {
    return { state: "adjusted", statusLabel: "Angepasst" };
  }
  return { state: "planned", statusLabel: "Geplant" };
}

export function buildWorkoutCalendarView(
  item: ReconciledWorkout,
  heartRateZones: ZoneDefinition[] | null,
  paceZones: PaceZone[] | null,
): WorkoutCalendarView {
  const workout = item.workout;
  const metrics: string[] = [];
  const badges: string[] = [];

  if (workout.plannedDurationMinutes !== null) {
    metrics.push(`${workout.plannedDurationMinutes} min`);
  }
  if (
    workout.plannedDistanceKm !== null &&
    (workout.sportType === "cycling" || workout.sportType === "running")
  ) {
    metrics.push(distance(workout.plannedDistanceKm));
  }

  if (workout.sportType === "running") {
    const target = getPlannedPaceTarget(paceZones, workout.intensity);
    if (target) metrics.push(formatPaceTarget(target));
  }

  if (workout.sportType === "cycling" || workout.sportType === "running") {
    const heartRateTarget = workout.targetHeartRateZone
      ? getZoneTarget(heartRateZones, workout.targetHeartRateZone)
      : getPlannedHeartRateTarget(heartRateZones, workout.intensity);
    if (heartRateTarget) badges.push(`HF ${heartRateTarget.label}`);
  }

  if (workout.sportType === "cycling" && workout.targetPowerZone) {
    badges.push(`Power ${workout.targetPowerZone}`);
  }

  if (workout.preferredStartTime) {
    badges.push(`${workout.preferredStartTime} Uhr`);
  }

  if (item.activity) {
    return {
      sportLabel: sportLabels[workout.sportType],
      intensityLabel: intensityLabels[workout.intensity],
      ...statusState(item),
      metrics: buildActivityCalendarMetrics(item.activity),
      badges,
    };
  }

  return {
    sportLabel: sportLabels[workout.sportType],
    intensityLabel: intensityLabels[workout.intensity],
    ...statusState(item),
    metrics,
    badges,
  };
}

export function buildActivityCalendarMetrics(activity: Activity): string[] {
  const metrics: string[] = [];
  const durationMinutes = Math.round(activity.movingTimeSeconds / 60);

  if (
    (activity.sportType === "cycling" || activity.sportType === "running") &&
    activity.distanceMeters > 0
  ) {
    metrics.push(distance(activity.distanceMeters / 1000));
  }

  metrics.push(`${durationMinutes} min`);

  if (activity.sportType === "running" && activity.distanceMeters > 0) {
    metrics.push(
      pace(activity.movingTimeSeconds / (activity.distanceMeters / 1000)),
    );
  } else if (
    activity.sportType === "cycling" &&
    activity.averageSpeedKmh !== null
  ) {
    metrics.push(
      `${activity.averageSpeedKmh.toLocaleString("de-DE", { maximumFractionDigits: 1 })} km/h`,
    );
  }

  return metrics;
}

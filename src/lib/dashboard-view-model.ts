import type { Activity } from "./demo-data";
import { formatDuration, formatPace } from "./format";
import type { ReconciledWorkout } from "./planning/reconciliation";
import type { PlannedWorkout } from "./planning/workouts";
import type { SavedMission } from "./missions";
import { activitySportLabels, type ActivitySportType, type PrimarySport } from "./sports";
import { buildMissionControl, type MissionControl } from "./mission-control";

export type DashboardSportIcon = "bike" | "run" | "strength" | "volleyball" | "activity";

const iconBySport: Record<ActivitySportType, DashboardSportIcon> = {
  cycling: "bike",
  running: "run",
  strength: "strength",
  volleyball: "volleyball",
  other: "activity",
};

const primaryConfig = {
  cycling: {
    sportLabel: "Radfahren",
    weekTitle: "Deine Radwoche",
    distanceLabel: "Radkilometer",
    durationLabel: "Fahrzeit",
    averageLabel: "Ø Geschwindigkeit",
    goalLabel: "Rad-Wochenziel",
    completedVerb: "gefahren",
    emptyText: "Noch keine Radfahrt in dieser Woche.",
    longLabel: "Lange Fahrt",
    windowLabel: "Radfenster",
    easySaved: "Die heutige Fahrt wurde in eine lockere Ausdauerfahrt geändert.",
    shiftSaved: "Die Fahrt wurde auf morgen gelegt und die offene Woche neu verteilt.",
    icon: "bike" as const,
  },
  running: {
    sportLabel: "Laufen",
    weekTitle: "Deine Laufwoche",
    distanceLabel: "Laufkilometer",
    durationLabel: "Laufzeit",
    averageLabel: "Ø Pace",
    goalLabel: "Lauf-Wochenziel",
    completedVerb: "gelaufen",
    emptyText: "Noch kein Lauf in dieser Woche.",
    longLabel: "Langer Lauf",
    windowLabel: "Laufenster",
    easySaved: "Der heutige Lauf wurde in einen lockeren Dauerlauf geändert.",
    shiftSaved: "Der Lauf wurde auf morgen gelegt und die offene Woche neu verteilt.",
    icon: "run" as const,
  },
} satisfies Record<PrimarySport, Record<string, string>>;

export type DashboardWorkoutItem = {
  workout: PlannedWorkout;
  effectiveStatus: ReconciledWorkout["effectiveStatus"];
  sportLabel: string;
  icon: DashboardSportIcon;
};

export type DashboardActivityItem = {
  activity: Activity;
  sportLabel: string;
  icon: DashboardSportIcon;
  metricLabel: string;
  metricValue: string;
};

export type DashboardViewModel = {
  primarySport: PrimarySport;
  sportLabel: string;
  sportIcon: DashboardSportIcon;
  weekTitle: string;
  emptyText: string;
  longLabel: string;
  windowLabel: string;
  savedMessages: { easy: string; shift: string };
  metrics: Array<{ label: string; value: string }>;
  weeklyGoal: {
    label: string;
    targetKm: number | null;
    actualKm: number;
    progressPercent: number | null;
    summary: string;
  };
  today: DashboardWorkoutItem[];
  upcoming: DashboardWorkoutItem[];
  latestActivities: DashboardActivityItem[];
  showFueling: boolean;
};

export type DashboardMissionSelection =
  | { mode: "compatible"; mission: SavedMission }
  | { mode: "neutral"; mission: SavedMission }
  | null;

export function selectDashboardMission(
  missions: SavedMission[],
  primarySport: PrimarySport,
): DashboardMissionSelection {
  const active = missions.filter((mission) => mission.status !== "archived");
  const compatible = active.find((mission) => mission.sportType === primarySport);
  if (compatible && validPositive(compatible.distanceKm)) {
    return { mode: "compatible", mission: compatible };
  }
  const neutralMission = compatible ?? active[0];
  return neutralMission ? { mode: "neutral", mission: neutralMission } : null;
}

export function buildDashboardMissionControl(input: {
  selection: DashboardMissionSelection;
  activities: Activity[];
  today: string;
  supportMode: "supported" | "nonsupported" | "open" | null;
  targetYear: number | null;
  recoveryTrackedNights: number;
}): MissionControl | null {
  if (input.selection?.mode !== "compatible") return null;
  const mission = input.selection.mission;
  return buildMissionControl({
    primarySport: mission.sportType,
    activities: input.activities,
    nutrition: [],
    feedback: [],
    drifts: [],
    weeklyGoalKm: null,
    eventName: mission.title,
    targetDistanceKm: mission.distanceKm,
    supportMode: input.supportMode,
    targetYear: input.targetYear,
    today: input.today,
    recoveryTrackedNights: input.recoveryTrackedNights,
    recoveryStableNights: 0,
  });
}

function validPositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function number(value: number): string {
  return value.toLocaleString("de-DE", { maximumFractionDigits: 1 });
}

export function dashboardSportIcon(sportType: PlannedWorkout["sportType"] | ActivitySportType): DashboardSportIcon {
  if (sportType === "mobility" || sportType === "recovery") return "activity";
  return iconBySport[sportType];
}

function workoutItem(item: ReconciledWorkout): DashboardWorkoutItem {
  const sportType = item.workout.sportType;
  const label = sportType === "mobility" ? "Mobility" : sportType === "recovery" ? "Regeneration" : activitySportLabels[sportType];
  return { workout: item.workout, effectiveStatus: item.effectiveStatus, sportLabel: label, icon: dashboardSportIcon(sportType) };
}

function activityItem(activity: Activity): DashboardActivityItem {
  if (activity.sportType === "running") {
    const speed = validPositive(activity.distanceMeters) && validPositive(activity.movingTimeSeconds)
      ? activity.distanceMeters / 1000 / (activity.movingTimeSeconds / 3600)
      : null;
    return { activity, sportLabel: activitySportLabels.running, icon: "run", metricLabel: "Pace", metricValue: speed === null ? "–" : formatPace(speed) };
  }
  if (activity.sportType === "cycling") {
    const speed = validPositive(activity.distanceMeters) && validPositive(activity.movingTimeSeconds)
      ? activity.distanceMeters / 1000 / (activity.movingTimeSeconds / 3600)
      : null;
    return { activity, sportLabel: activitySportLabels.cycling, icon: "bike", metricLabel: "Geschwindigkeit", metricValue: speed === null ? "–" : `${number(speed)} km/h` };
  }
  return {
    activity,
    sportLabel: activitySportLabels[activity.sportType],
    icon: dashboardSportIcon(activity.sportType),
    metricLabel: "Cross-Training",
    metricValue: validPositive(activity.movingTimeSeconds) ? formatDuration(activity.movingTimeSeconds) : "–",
  };
}

export function buildDashboardViewModel(input: {
  primarySport: PrimarySport;
  weeklyGoalKm: number | null;
  weekActivities: Activity[];
  reconciledWorkouts: ReconciledWorkout[];
  today: string;
  latestActivities: Activity[];
}): DashboardViewModel {
  const config = primaryConfig[input.primarySport];
  const primaryActivities = input.weekActivities.filter((activity) => activity.sportType === input.primarySport);
  const distanceMeters = primaryActivities.reduce((sum, activity) => sum + (validPositive(activity.distanceMeters) ? activity.distanceMeters : 0), 0);
  const movingTimeSeconds = primaryActivities.reduce((sum, activity) => sum + (validPositive(activity.movingTimeSeconds) ? activity.movingTimeSeconds : 0), 0);
  const paired = primaryActivities.filter((activity) => validPositive(activity.distanceMeters) && validPositive(activity.movingTimeSeconds));
  const pairedDistanceKm = paired.reduce((sum, activity) => sum + activity.distanceMeters / 1000, 0);
  const pairedSeconds = paired.reduce((sum, activity) => sum + activity.movingTimeSeconds, 0);
  const averageSpeedKmh = pairedDistanceKm > 0 && pairedSeconds > 0 ? pairedDistanceKm / (pairedSeconds / 3600) : null;
  const actualKm = distanceMeters / 1000;
  const targetKm = typeof input.weeklyGoalKm === "number" && Number.isFinite(input.weeklyGoalKm) && input.weeklyGoalKm > 0 ? input.weeklyGoalKm : null;
  const progressPercent = targetKm === null ? null : Math.min(100, actualKm / targetKm * 100);
  const activeWorkouts = input.reconciledWorkouts.filter((item) => item.effectiveStatus !== "skipped");

  return {
    primarySport: input.primarySport,
    sportLabel: config.sportLabel,
    sportIcon: config.icon,
    weekTitle: config.weekTitle,
    emptyText: config.emptyText,
    longLabel: config.longLabel,
    windowLabel: config.windowLabel,
    savedMessages: { easy: config.easySaved, shift: config.shiftSaved },
    metrics: [
      { label: config.distanceLabel, value: distanceMeters > 0 ? `${number(actualKm)} km` : "–" },
      { label: config.durationLabel, value: movingTimeSeconds > 0 ? formatDuration(movingTimeSeconds) : "–" },
      { label: config.averageLabel, value: averageSpeedKmh === null ? "–" : input.primarySport === "running" ? formatPace(averageSpeedKmh) : `${number(averageSpeedKmh)} km/h` },
    ],
    weeklyGoal: {
      label: config.goalLabel,
      targetKm,
      actualKm,
      progressPercent,
      summary: targetKm === null ? "Noch kein Wochenziel festgelegt." : `${number(actualKm)} von ${number(targetKm)} km ${config.completedVerb}`,
    },
    today: activeWorkouts.filter((item) => item.workout.scheduledDate === input.today).map(workoutItem),
    upcoming: activeWorkouts.filter((item) => item.workout.scheduledDate > input.today).map(workoutItem),
    latestActivities: input.latestActivities.map(activityItem),
    showFueling: input.primarySport === "cycling",
  };
}

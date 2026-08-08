import type { ReadinessResult } from "../recovery-readiness";
import type { PlannedWorkout } from "./workouts";

type ExplanationWorkout = Pick<
  PlannedWorkout,
  | "source"
  | "sportType"
  | "intensity"
  | "plannedDistanceKm"
  | "status"
>;

type ExplanationReadiness = Pick<
  ReadinessResult,
  "status" | "reasons"
>;

export type WorkoutPlanExplanation = {
  kind: "user" | "week" | "training" | "readiness";
  label: string;
  text: string;
};

function distanceLabel(workout: ExplanationWorkout): string {
  if (workout.plannedDistanceKm === null) {
    return "";
  }

  return `${workout.plannedDistanceKm.toLocaleString("de-DE", {
    maximumFractionDigits: 1,
  })} km`;
}

export function explainWorkoutPlan(
  workout: ExplanationWorkout,
  readiness: ExplanationReadiness | undefined,
  weekWorkouts: ExplanationWorkout[],
): WorkoutPlanExplanation[] {
  const explanations: WorkoutPlanExplanation[] = [];

  if (workout.source === "manual") {
    explanations.push({
      kind: "user",
      label: "Nutzerentscheidung",
      text: "Diese Einheit wurde manuell eingeplant.",
    });
  } else {
    const comparableWorkouts = weekWorkouts.filter(
      (item) =>
        item.status !== "skipped" &&
        item.sportType === workout.sportType &&
        item.plannedDistanceKm !== null,
    );

    const longestDistanceKm = comparableWorkouts.reduce(
      (longest, item) =>
        Math.max(longest, item.plannedDistanceKm ?? 0),
      0,
    );

    const isLongest =
      workout.status !== "skipped" &&
      workout.plannedDistanceKm !== null &&
      comparableWorkouts.length > 1 &&
      workout.plannedDistanceKm === longestDistanceKm;

    if (isLongest) {
      explanations.push({
        kind: "week",
        label: "Wochenstruktur",
        text: `${distanceLabel(workout)} machen diese Einheit zur längsten Einheit dieser Sportart in dieser Woche.`,
      });
    }

    if (
      workout.intensity === "tempo" ||
      workout.intensity === "threshold" ||
      workout.intensity === "vo2"
    ) {
      explanations.push({
        kind: "training",
        label: "Trainingsreiz",
        text: "Diese Einheit setzt einen intensiveren Trainingsreiz innerhalb der Wochenstruktur.",
      });
    } else if (
      workout.intensity === "easy" ||
      workout.intensity === "recovery"
    ) {
      explanations.push({
        kind: "training",
        label: "Trainingsreiz",
        text: "Diese Einheit ist als lockere Belastung innerhalb der Wochenstruktur geplant.",
      });
    } else if (workout.intensity === "strength") {
      explanations.push({
        kind: "training",
        label: "Trainingsreiz",
        text: "Diese Einheit bildet den vorgesehenen Kraftanteil der Trainingswoche.",
      });
    } else {
      explanations.push({
        kind: "training",
        label: "Trainingsreiz",
        text: "Diese Einheit ist als Grundlagenbelastung innerhalb der Wochenstruktur geplant.",
      });
    }
  }

  if (readiness?.status === "red") {
    explanations.push({
      kind: "readiness",
      label: "Tagesform",
      text: "Die Tagesform ist rot. Intensität und Durchführung sollten vor dem Training neu bewertet werden.",
    });
  } else if (readiness?.status === "yellow") {
    explanations.push({
      kind: "readiness",
      label: "Tagesform",
      text: "Die Tagesform ist gelb. Umfang und Intensität sollten an das aktuelle Gefühl angepasst werden.",
    });
  } else if (
    readiness?.status === "green" &&
    (workout.intensity === "tempo" ||
      workout.intensity === "threshold" ||
      workout.intensity === "vo2")
  ) {
    explanations.push({
      kind: "readiness",
      label: "Tagesform",
      text: "Die Tagesform ist grün und zeigt aktuell keinen Warnhinweis für die geplante Intensität.",
    });
  } else if (
    (!readiness || readiness.status === "unknown") &&
    (workout.intensity === "tempo" ||
      workout.intensity === "threshold" ||
      workout.intensity === "vo2")
  ) {
    explanations.push({
      kind: "readiness",
      label: "Tagesform",
      text: "Für diesen Tag liegt noch keine bestätigte Tagesform vor.",
    });
  }

  return explanations;
}
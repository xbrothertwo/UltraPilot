import { PERSONAL_LOAD_REFERENCE_MIN_ACTIVITIES } from "@/lib/training-load";
import type { PrimarySport } from "@/lib/sports";

export type ProgressExperience = {
  state: "empty" | "baseline" | "established";
  headline: string;
  summary: string;
  loadState: "available" | "needs_zones" | "needs_input";
  availableSignals: string[];
  buildingSignals: string[];
  showRecoveryModule: boolean;
  showNutritionModule: boolean;
};

export function buildProgressExperience(input: {
  primarySport: PrimarySport;
  activityCount: number;
  measuredLoadActivities: number;
  averageHeartRate: number | null;
  trackedNights: number;
  hasNutrition: boolean;
  gymSessionCount: number;
  matchedPlanCount: number;
}): ProgressExperience {
  const state = input.activityCount === 0 && input.gymSessionCount === 0
    ? "empty"
    : input.activityCount < PERSONAL_LOAD_REFERENCE_MIN_ACTIVITIES
      ? "baseline"
      : "established";
  const sportNoun = input.primarySport === "running" ? "Lauf" : "Fahrt";
  const sportNounPlural = input.primarySport === "running" ? "Läufe" : "Fahrten";
  const loadState = input.measuredLoadActivities > 0
    ? "available"
    : input.averageHeartRate !== null
      ? "needs_zones"
      : "needs_input";
  return {
    state,
    headline: state === "empty" ? "Deine Basis beginnt mit dem ersten Training." : state === "baseline" ? "Deine Basis entsteht gerade." : "Deine Entwicklung wird vergleichbar.",
    summary: state === "empty"
      ? `Importiere deinen ersten ${sportNoun} oder schließe eine Gym-Session ab.`
      : state === "baseline"
        ? `${input.activityCount} ${input.activityCount === 1 ? sportNoun : sportNounPlural} erfasst. Mit weiteren vergleichbaren Trainings werden Entwicklungs- und Belastungstrends aussagekräftiger.`
        : "Umfang, Belastung und Erholung werden aus deinen vorhandenen Daten gegenübergestellt.",
    loadState,
    availableSignals: [
      input.activityCount > 0 ? "Wochenumfang" : null,
      input.activityCount > 0 ? (input.primarySport === "running" ? "Pace & Laufzeit" : "Geschwindigkeit & Fahrzeit") : null,
      input.matchedPlanCount > 0 ? "Planerfüllung" : null,
      input.gymSessionCount > 0 ? "Gym-Progress" : null,
    ].filter((value): value is string => value !== null),
    buildingSignals: [
      input.activityCount < PERSONAL_LOAD_REFERENCE_MIN_ACTIVITIES ? "Entwicklung über vergleichbare Trainings" : null,
      loadState !== "available" ? "Persönlicher Belastungstrend" : null,
      input.trackedNights === 0 ? "Erholung im Trainingskontext" : null,
    ].filter((value): value is string => value !== null),
    showRecoveryModule: input.trackedNights > 0,
    showNutritionModule: input.hasNutrition,
  };
}

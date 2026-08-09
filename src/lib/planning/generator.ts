import { strengthDescription, type StrengthVariant } from "./strength-plan";
import type { PrimarySport } from "../sports";
import { effectiveSessionCapacityMinutes } from "./session-capacity";

export type PlanningDay = {
  date: string;
  availableMinutes: number;
  longestAvailableWindowMinutes?: number;
  workday: boolean;
  occupied: boolean;
  crossTraining?: boolean;
  readiness?: "green" | "yellow" | "red" | "unknown";
  highIntensityAllowed?: boolean;
};
export type GeneratedWorkout = { scheduledDate: string; sportType: PrimarySport | "strength"; title: string; description: string; intensity: "easy" | "endurance" | "tempo" | "strength"; plannedDurationMinutes: number; plannedDistanceKm: number | null };
export type GeneratorInput = { primarySport?: PrimarySport; runningSessionsPerWeek?: number; easyRunWithCrossTraining?: boolean; days: PlanningDay[]; weeklyGoalKm: number; recentFourWeekDistanceKm: number; recentAverageSpeedKmh: number | null; workdayMaxMinutes: number; strengthVariants: StrengthVariant[]; longRideTargetKm?: number; longRideCovered?: boolean; tempoSessionTarget?: number; preferredCyclingDate?: string };

function rounded(value: number): number { return Math.round(value * 10) / 10; }

export function calculateRemainingWeeklyDistance(goalKm: number, completedKm: number, manuallyPlannedKm: number): number {
  return rounded(Math.max(0, goalKm - completedKm - manuallyPlannedKm));
}

export function cyclingDescription(intensity: "easy" | "endurance" | "tempo", durationMinutes: number): string {
  if (intensity === "tempo") {
    const repetitions = durationMinutes >= 75 ? 3 : 2;
    return `Einrollen: 15 min locker in Z1–Z2.\nHauptteil: ${repetitions} × 8 min kontrolliert in Z3, dazwischen 4 min locker.\nAusrollen: verbleibende Zeit locker in Z1.\nDie Herzfrequenzvorgabe hat Vorrang vor der Durchschnittsgeschwindigkeit.`;
  }
  if (intensity === "endurance") {
    return "Einrollen: 10–15 min locker in Z1.\nHauptteil: gleichmäßig in Z2 fahren; an Anstiegen bewusst ruhig bleiben.\nAusrollen: 10 min sehr locker in Z1.\nZiel ist eine kontrollierte, gut verpflegte Ausdauerfahrt ohne Endspurt.";
  }
  return "Durchgehend locker in Z1–Z2 fahren.\nTrittfrequenz angenehm halten und Belastungsspitzen vermeiden.\nDie Einheit soll sich am Ende leichter als am Anfang anfühlen.";
}

export function runningDescription(intensity: "easy" | "endurance" | "tempo", durationMinutes: number): string {
  if (intensity === "tempo") return `Einlaufen: 10–15 min sehr locker in Z1–Z2.\nHauptteil: ${durationMinutes >= 60 ? 3 : 2} × 8 min kontrolliert in Z3, dazwischen 4 min lockeres Traben.\nAuslaufen: verbleibende Zeit locker.\nHerzfrequenz und saubere Lauftechnik haben Vorrang vor der Pace.`;
  if (intensity === "endurance") return "Die ersten 10 min bewusst locker anlaufen.\nHauptteil: gleichmäßig in Z2 laufen; an Anstiegen Tempo reduzieren.\nDie letzten 5–10 min locker auslaufen.\nZiel ist ruhige Ausdauer, kein Endspurt.";
  return "Durchgehend locker in Z1–Z2 laufen.\nEine Unterhaltung sollte jederzeit möglich sein.\nBei schweren Beinen Gehpausen einbauen oder die Einheit kürzen.";
}

function dayGap(first: string, second: string): number { return Math.abs(new Date(`${first}T12:00:00Z`).getTime() - new Date(`${second}T12:00:00Z`).getTime()) / 86_400_000; }
function isDayAfter(candidate: string, reference: string): boolean { return new Date(`${candidate}T12:00:00Z`).getTime() - new Date(`${reference}T12:00:00Z`).getTime() === 86_400_000; }

function spacedDays(available: PlanningDay[], count: number, workdayMaxMinutes: number, preferredDate?: string): PlanningDay[] {
  if (!available.length || count <= 0) return [];
  const dayValue = (day: PlanningDay) =>
  effectiveSessionCapacityMinutes(day, workdayMaxMinutes) -
  (day.readiness === "yellow" ? 180 : 0);
  const preferred = preferredDate ? available.find((day) => day.date === preferredDate) : undefined;
  const selected = [preferred ?? [...available].sort((a, b) => dayValue(b) - dayValue(a) || a.date.localeCompare(b.date))[0]];
  while (selected.length < Math.min(count, available.length)) {
    const remaining = available.filter((day) => !selected.some((chosen) => chosen.date === day.date));
    remaining.sort((a, b) => {
      const score = (day: PlanningDay) => Math.min(...selected.map((chosen) => dayGap(day.date, chosen.date))) * 120 + dayValue(day);
      return score(b) - score(a) || a.date.localeCompare(b.date);
    });
    selected.push(remaining[0]);
  }
  return selected;
}

function distributeEvenly(
  targetDistanceKm: number,
  sessionCount: number,
): number[] {
  if (sessionCount <= 0) return [];

  const distances: number[] = [];
  let allocatedDistance = 0;

  for (let index = 0; index < sessionCount; index += 1) {
    const distance =
      index === sessionCount - 1
        ? rounded(targetDistanceKm - allocatedDistance)
        : rounded(targetDistanceKm / sessionCount);

    distances.push(distance);
    allocatedDistance = rounded(allocatedDistance + distance);
  }

  return distances;
}

function distributeDistance(
  targetDistanceKm: number,
  sessionCount: number,
  longRideTargetKm?: number,
): number[] {
  if (sessionCount <= 0) return [];
  if (sessionCount === 1) return [rounded(targetDistanceKm)];

  if (longRideTargetKm === undefined) {
    if (sessionCount === 2) {
      const first = rounded(targetDistanceKm * 0.6);
      return [first, rounded(targetDistanceKm - first)];
    }

    if (sessionCount === 3) {
      const first = rounded(targetDistanceKm * 0.5);
      const second = rounded(targetDistanceKm * 0.35);

    return [
      first,
      second,
      rounded(targetDistanceKm - first - second),
   ];
  }

    const first = rounded(targetDistanceKm * 0.3);
    const second = rounded(targetDistanceKm * 0.2);
    const remainingDistance = rounded(
      targetDistanceKm - first - second,
    );

    return [
      first,
      second,
      ...distributeEvenly(remainingDistance, sessionCount - 2),
    ];
  }

  const longRide = rounded(
    Math.max(0, Math.min(targetDistanceKm, longRideTargetKm)),
  );
  const remainingDistance = rounded(targetDistanceKm - longRide);

  if (sessionCount === 2) {
    return [longRide, remainingDistance];
  }

  const second = rounded(remainingDistance * 0.6);
  const remainingAfterSecond = rounded(remainingDistance - second);

  return [
    longRide,
    second,
    ...distributeEvenly(remainingAfterSecond, sessionCount - 2),
  ];
}

export function generateDeterministicWeek(input: GeneratorInput): { workouts: GeneratedWorkout[]; targetDistanceKm: number; ruleSummary: string } {
  const primarySport = input.primarySport ?? "cycling";
  const minimumMinutes = primarySport === "running" ? 30 : 45;
  const available = input.days.filter(
  (day) =>
    !day.occupied &&
    day.readiness !== "red" &&
    effectiveSessionCapacityMinutes(day, input.workdayMaxMinutes) >= minimumMinutes,
);
  if (!available.length) return { workouts: [], targetDistanceKm: 0, ruleSummary: `Keine freien Zeitfenster von mindestens ${minimumMinutes} Minuten.` };
  const weeklyRecent = input.recentFourWeekDistanceKm / 4;
  const targetDistanceKm = rounded(Math.max(0, input.weeklyGoalKm));
  if (targetDistanceKm === 0) return { workouts: [], targetDistanceKm: 0, ruleSummary: "Das Wochenziel ist durch absolvierte und manuell geplante Kilometer bereits abgedeckt." };
  const fallbackSpeedKmh = primarySport === "running" ? 8 : 22;
  const referenceSpeedKmh =
  input.recentAverageSpeedKmh &&
  input.recentAverageSpeedKmh > (primarySport === "running" ? 3 : 5)
    ? input.recentAverageSpeedKmh
    : fallbackSpeedKmh;
  // "Easy run on a strength day" pairing is opt-in and running-specific; even
  // when enabled it is only actually used once separate days genuinely don't
  // fit, not as a default — see the fallback check on gymCandidates below.
  const pairCrossTraining = primarySport === "running" && input.easyRunWithCrossTraining === true;
  const reservedStrengthDays = Math.min(input.strengthVariants.length, Math.max(0, available.length - 1));
  const requestedEnduranceCount = primarySport === "running" ? Math.max(1, Math.min(7, input.runningSessionsPerWeek ?? 3)) : 3;
  const enduranceCount = Math.min(requestedEnduranceCount, available.length - reservedStrengthDays);
  const selected = spacedDays(available, enduranceCount, input.workdayMaxMinutes, input.preferredCyclingDate);
  const distances = distributeDistance(targetDistanceKm, enduranceCount, input.longRideTargetKm);
  // Strength or volleyball already on the calendar (recorded or planned,
  // regardless of this run's own gym placement below) — used to keep the
  // long session off of and off the day right after a leg-heavy day.
  const existingCrossTrainingDates = input.days.filter((day) => day.crossTraining).map((day) => day.date);
  const riskyLongDay = (date: string) => existingCrossTrainingDates.some((crossTrainingDate) => crossTrainingDate === date || isDayAfter(date, crossTrainingDate));
  const preferredLongIndex = selected.findIndex((day) => !riskyLongDay(day.date));
  const longIndex = preferredLongIndex === -1 ? 0 : preferredLongIndex;
  const enduranceWorkouts = selected.map((day, index): GeneratedWorkout => {
    const requestedDistance = distances[index];
    const desiredMinutes = Math.ceil(
    (requestedDistance / referenceSpeedKmh) * 60,
    );
    const capacityMinutes = effectiveSessionCapacityMinutes(day, input.workdayMaxMinutes);
    const duration = Math.min(
      Math.max(minimumMinutes, desiredMinutes),
      capacityMinutes,
    );
    const distance = rounded(
      Math.min(
      requestedDistance,
      referenceSpeedKmh * (duration / 60),
    ),
  );
    const isLong = index === longIndex && !input.longRideCovered;
    const tempoRequested = input.tempoSessionTarget === undefined ? weeklyRecent >= (primarySport === "running" ? 15 : 100) : input.tempoSessionTarget > 0;
    const intensity = pairCrossTraining && day.crossTraining ? "easy" : !isLong && tempoRequested && index === 1 && day.readiness !== "yellow" && day.highIntensityAllowed !== false ? "tempo" : isLong ? "endurance" : "easy";
    const description = primarySport === "running" ? runningDescription(intensity, duration) : cyclingDescription(intensity, duration);
    const title = primarySport === "running" ? (isLong ? "Langer ruhiger Lauf" : intensity === "tempo" ? "Kontrollierter Tempolauf" : "Lockerer Dauerlauf") : (isLong ? "Lange ruhige Ausfahrt" : intensity === "tempo" ? "Kontrollierte Tempoeinheit" : "Lockere Ausdauerfahrt");
    return { scheduledDate: day.date, sportType: primarySport, title, description, intensity, plannedDurationMinutes: duration, plannedDistanceKm: distance };
  });
  const usedDates = new Set(enduranceWorkouts.map((workout) => workout.scheduledDate));
  // Separate days from the endurance sessions are the default; combining
  // strength onto an endurance day only happens as a fallback, once there
  // genuinely aren't enough separate days left for it (or the user has
  // explicitly opted into same-day pairing for easy runs).
  const separateGymCandidates = available.filter((day) => !usedDates.has(day.date) && effectiveSessionCapacityMinutes(day, input.workdayMaxMinutes) >= 60);
  const needsFallbackPairing = pairCrossTraining && separateGymCandidates.length < input.strengthVariants.length;
  const gymCandidates = needsFallbackPairing
    ? available.filter((day) => effectiveSessionCapacityMinutes(day, input.workdayMaxMinutes) >= 60)
    : separateGymCandidates;
  const gym = spacedDays(gymCandidates, input.strengthVariants.length, input.workdayMaxMinutes).map((day, index): GeneratedWorkout => { const variant = input.strengthVariants[index]; return { scheduledDate: day.date, sportType: "strength", title: `Krafttraining ${variant}`, description: strengthDescription(variant), intensity: "strength", plannedDurationMinutes: 60, plannedDistanceKm: null }; });
  // Adjacency protection covers both this run's own newly placed strength
  // sessions and whatever strength/volleyball is already on the calendar,
  // so a hard endurance session never lands next to a leg-heavy day either
  // way, for either primary sport.
  const crossTrainingDates = new Set([...gym.map((strength) => strength.scheduledDate), ...existingCrossTrainingDates]);
  const adjustedEndurance = enduranceWorkouts.map((workout) => {
    const sameDayCrossTraining = gym.some((strength) => strength.scheduledDate === workout.scheduledDate) || (available.find((day) => day.date === workout.scheduledDate)?.crossTraining ?? false);
    const crossTrainingAdjacent = [...crossTrainingDates].some((crossTrainingDate) => dayGap(crossTrainingDate, workout.scheduledDate) <= 1);
    if (!sameDayCrossTraining && (workout.intensity !== "tempo" || !crossTrainingAdjacent)) return workout;
    return { ...workout, title: primarySport === "running" ? "Lockerer Dauerlauf" : "Lockere Ausdauerfahrt", intensity: "easy" as const, description: primarySport === "running" ? runningDescription("easy", workout.plannedDurationMinutes) : cyclingDescription("easy", workout.plannedDurationMinutes) };
  });
  const plannedDistanceKm = rounded(
  adjustedEndurance.reduce(
    (sum, workout) => sum + (workout.plannedDistanceKm ?? 0),
    0,
  ),
);

const unplannedDistanceKm = rounded(
  Math.max(0, targetDistanceKm - plannedDistanceKm),
);

const distanceSummary =
  unplannedDistanceKm > 0
    ? `${plannedDistanceKm.toLocaleString("de-DE")} km wurden eingeplant; ${unplannedDistanceKm.toLocaleString("de-DE")} km bleiben wegen der verfügbaren Trainingszeit offen.`
    : `${targetDistanceKm.toLocaleString("de-DE")} km wurden vollständig verteilt.`;

const sessionSummary =
  primarySport === "running"
    ? `${adjustedEndurance.length} Laufeinheiten`
    : `${adjustedEndurance.length} Radeinheiten`;

return {
  workouts: [...adjustedEndurance, ...gym].sort((a, b) =>
    a.scheduledDate.localeCompare(b.scheduledDate),
  ),
  targetDistanceKm,
  ruleSummary: `${distanceSummary} Geplant wurden ${sessionSummary}; die längste Einheit liegt im größten freien Fenster und meidet den Tag nach Kraft oder Volleyball. Arbeitstage sind auf ${input.workdayMaxMinutes} Minuten begrenzt. Rote Readiness-Tage werden freigehalten; gelbe Tage und Tage neben Kraft oder Volleyball erhalten keine Tempoeinheit.`,
};
}

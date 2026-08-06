import { strengthDescription, type StrengthVariant } from "./strength-plan";
import type { PrimarySport } from "./data";

export type PlanningDay = { date: string; availableMinutes: number; workday: boolean; occupied: boolean; crossTraining?: boolean; readiness?: "green" | "yellow" | "red" | "unknown"; highIntensityAllowed?: boolean };
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

function spacedDays(available: PlanningDay[], count: number, preferredDate?: string): PlanningDay[] {
  if (!available.length || count <= 0) return [];
  const dayValue = (day: PlanningDay) => day.availableMinutes - (day.readiness === "yellow" ? 180 : 0);
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
  const available = input.days.filter((day) => !day.occupied && day.readiness !== "red" && day.availableMinutes >= minimumMinutes);
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
  const pairCrossTraining = primarySport === "running" && input.easyRunWithCrossTraining === true;
  const reservedStrengthDays = pairCrossTraining ? 0 : Math.min(input.strengthVariants.length, Math.max(0, available.length - 1));
  const requestedEnduranceCount = primarySport === "running" ? Math.max(1, Math.min(7, input.runningSessionsPerWeek ?? 3)) : 3;
  const enduranceCount = Math.min(requestedEnduranceCount, available.length - reservedStrengthDays);
  const selected = spacedDays(available, enduranceCount, input.preferredCyclingDate);
  const distances = distributeDistance(targetDistanceKm, enduranceCount, input.longRideTargetKm);
  const enduranceWorkouts = selected.map((day, index): GeneratedWorkout => {
    const requestedDistance = distances[index];
    const desiredMinutes = Math.ceil(
    (requestedDistance / referenceSpeedKmh) * 60,
    );
    const cap = day.workday
    ? Math.min(day.availableMinutes, input.workdayMaxMinutes)
    : day.availableMinutes;
    const duration = Math.max(
      minimumMinutes,
      Math.min(desiredMinutes, cap),
    );
    const distance = rounded(
      Math.min(
      requestedDistance,
      referenceSpeedKmh * (duration / 60),
    ),
  );
    const isLong = index === 0 && !input.longRideCovered;
    const tempoRequested = input.tempoSessionTarget === undefined ? weeklyRecent >= (primarySport === "running" ? 15 : 100) : input.tempoSessionTarget > 0;
    const intensity = pairCrossTraining && day.crossTraining ? "easy" : !isLong && tempoRequested && index === 1 && day.readiness !== "yellow" && day.highIntensityAllowed !== false ? "tempo" : isLong ? "endurance" : "easy";
    const description = primarySport === "running" ? runningDescription(intensity, duration) : cyclingDescription(intensity, duration);
    const title = primarySport === "running" ? (isLong ? "Langer ruhiger Lauf" : intensity === "tempo" ? "Kontrollierter Tempolauf" : "Lockerer Dauerlauf") : (isLong ? "Lange ruhige Ausfahrt" : intensity === "tempo" ? "Kontrollierte Tempoeinheit" : "Lockere Ausdauerfahrt");
    return { scheduledDate: day.date, sportType: primarySport, title, description, intensity, plannedDurationMinutes: duration, plannedDistanceKm: distance };
  });
  const usedDates = new Set(enduranceWorkouts.map((workout) => workout.scheduledDate));
  const gymCandidates = available.filter((day) => (pairCrossTraining || !usedDates.has(day.date)) && day.availableMinutes >= 60);
  const gym = spacedDays(gymCandidates, input.strengthVariants.length).map((day, index): GeneratedWorkout => { const variant = input.strengthVariants[index]; return { scheduledDate: day.date, sportType: "strength", title: `Krafttraining ${variant}`, description: strengthDescription(variant), intensity: "strength", plannedDurationMinutes: 60, plannedDistanceKm: null }; });
  const adjustedEndurance = enduranceWorkouts.map((workout) => {
    const sameDayCrossTraining = primarySport === "running" && pairCrossTraining && (gym.some((strength) => strength.scheduledDate === workout.scheduledDate) || available.find((day) => day.date === workout.scheduledDate)?.crossTraining);
    const strengthAdjacent = gym.some((strength) => dayGap(strength.scheduledDate, workout.scheduledDate) <= 1);
    if (!sameDayCrossTraining && (workout.intensity !== "tempo" || !strengthAdjacent)) return workout;
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
  ruleSummary: `${distanceSummary} Geplant wurden ${sessionSummary}; die längste Einheit liegt im größten freien Fenster. Arbeitstage sind auf ${input.workdayMaxMinutes} Minuten begrenzt. Rote Readiness-Tage werden freigehalten; gelbe Tage und Kraft-Nachbartage erhalten keine Tempoeinheit.`,
};
}

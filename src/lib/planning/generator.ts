import { strengthDescription, type StrengthVariant } from "./strength-plan";
import type { PrimarySport } from "./data";

export type PlanningDay = { date: string; availableMinutes: number; workday: boolean; occupied: boolean; readiness?: "green" | "yellow" | "red" | "unknown"; highIntensityAllowed?: boolean };
export type GeneratedWorkout = { scheduledDate: string; sportType: PrimarySport | "strength"; title: string; description: string; intensity: "easy" | "endurance" | "tempo" | "strength"; plannedDurationMinutes: number; plannedDistanceKm: number | null };
export type GeneratorInput = { primarySport?: PrimarySport; days: PlanningDay[]; weeklyGoalKm: number; recentFourWeekDistanceKm: number; recentAverageSpeedKmh: number | null; workdayMaxMinutes: number; strengthVariants: StrengthVariant[]; longRideTargetKm?: number; longRideCovered?: boolean; tempoSessionTarget?: number; preferredCyclingDate?: string };

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

function distributeDistance(targetDistanceKm: number, cyclingCount: number, longRideTargetKm?: number): number[] {
  if (cyclingCount <= 0) return [];
  if (cyclingCount === 1) return [rounded(targetDistanceKm)];
  if (longRideTargetKm === undefined) {
    const shares = cyclingCount === 2 ? [.6, .4] : [.45, .3, .25];
    return shares.map((share, index) => index === shares.length - 1 ? rounded(targetDistanceKm - shares.slice(0, index).reduce((sum, previous) => sum + rounded(targetDistanceKm * previous), 0)) : rounded(targetDistanceKm * share));
  }
  const longRide = rounded(Math.max(0, Math.min(targetDistanceKm, longRideTargetKm)));
  const remaining = rounded(targetDistanceKm - longRide);
  if (cyclingCount === 2) return [longRide, remaining];
  const second = rounded(remaining * .6);
  return [longRide, second, rounded(remaining - second)];
}

export function generateDeterministicWeek(input: GeneratorInput): { workouts: GeneratedWorkout[]; targetDistanceKm: number; ruleSummary: string } {
  const primarySport = input.primarySport ?? "cycling";
  const minimumMinutes = primarySport === "running" ? 30 : 45;
  const available = input.days.filter((day) => !day.occupied && day.readiness !== "red" && day.availableMinutes >= minimumMinutes);
  if (!available.length) return { workouts: [], targetDistanceKm: 0, ruleSummary: `Keine freien Zeitfenster von mindestens ${minimumMinutes} Minuten.` };
  const weeklyRecent = input.recentFourWeekDistanceKm / 4;
  const targetDistanceKm = rounded(Math.max(0, input.weeklyGoalKm));
  if (targetDistanceKm === 0) return { workouts: [], targetDistanceKm: 0, ruleSummary: "Das Wochenziel ist durch absolvierte und manuell geplante Kilometer bereits abgedeckt." };
  const speed = input.recentAverageSpeedKmh && input.recentAverageSpeedKmh > (primarySport === "running" ? 3 : 5) ? input.recentAverageSpeedKmh : null;
  const reservedStrengthDays = Math.min(input.strengthVariants.length, Math.max(0, available.length - 1));
  const enduranceCount = Math.min(3, available.length - reservedStrengthDays);
  const selected = spacedDays(available, enduranceCount, input.preferredCyclingDate);
  const distances = distributeDistance(targetDistanceKm, enduranceCount, input.longRideTargetKm);
  const enduranceWorkouts = selected.map((day, index): GeneratedWorkout => {
    const distance = distances[index];
    const desiredMinutes = speed ? Math.round(distance / speed * 60) : primarySport === "running" ? (index === 0 ? 75 : index === 1 ? 50 : 35) : (index === 0 ? 150 : index === 1 ? 75 : 60);
    const cap = day.workday ? Math.min(day.availableMinutes, input.workdayMaxMinutes) : day.availableMinutes;
    const duration = Math.max(minimumMinutes, Math.min(desiredMinutes, cap));
    const isLong = index === 0 && !input.longRideCovered;
    const tempoRequested = input.tempoSessionTarget === undefined ? weeklyRecent >= (primarySport === "running" ? 15 : 100) : input.tempoSessionTarget > 0;
    const intensity = !isLong && tempoRequested && index === 1 && day.readiness !== "yellow" && day.highIntensityAllowed !== false ? "tempo" : isLong ? "endurance" : "easy";
    const description = primarySport === "running" ? runningDescription(intensity, duration) : cyclingDescription(intensity, duration);
    const title = primarySport === "running" ? (isLong ? "Langer ruhiger Lauf" : intensity === "tempo" ? "Kontrollierter Tempolauf" : "Lockerer Dauerlauf") : (isLong ? "Lange ruhige Ausfahrt" : intensity === "tempo" ? "Kontrollierte Tempoeinheit" : "Lockere Ausdauerfahrt");
    return { scheduledDate: day.date, sportType: primarySport, title, description, intensity, plannedDurationMinutes: duration, plannedDistanceKm: distance };
  });
  const usedDates = new Set(enduranceWorkouts.map((workout) => workout.scheduledDate));
  const gymCandidates = available.filter((day) => !usedDates.has(day.date) && day.availableMinutes >= 60);
  const gym = spacedDays(gymCandidates, input.strengthVariants.length).map((day, index): GeneratedWorkout => { const variant = input.strengthVariants[index]; return { scheduledDate: day.date, sportType: "strength", title: `Krafttraining ${variant}`, description: strengthDescription(variant), intensity: "strength", plannedDurationMinutes: 60, plannedDistanceKm: null }; });
  const adjustedEndurance = enduranceWorkouts.map((workout) => {
    const strengthAdjacent = gym.some((strength) => dayGap(strength.scheduledDate, workout.scheduledDate) <= 1);
    if (workout.intensity !== "tempo" || !strengthAdjacent) return workout;
    return { ...workout, title: primarySport === "running" ? "Lockerer Dauerlauf" : "Lockere Ausdauerfahrt", intensity: "easy" as const, description: primarySport === "running" ? runningDescription("easy", workout.plannedDurationMinutes) : cyclingDescription("easy", workout.plannedDurationMinutes) };
  });
  return { workouts: [...adjustedEndurance, ...gym].sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate)), targetDistanceKm, ruleSummary: `Noch offene ${targetDistanceKm.toLocaleString("de-DE")} km wurden vollständig verteilt: maximal drei ${primarySport === "running" ? "Laufeinheiten" : "Radeinheiten"}, längste Einheit im größten freien Fenster, Arbeitstage auf ${input.workdayMaxMinutes} Minuten begrenzt. Rote Readiness-Tage werden freigehalten; gelbe Tage und Kraft-Nachbartage erhalten keine Tempoeinheit.` };
}

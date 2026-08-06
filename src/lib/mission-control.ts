import type { Activity } from "./demo-data";

export type MissionNutrition = { activityId: string; carbohydratesGrams: number; fluidMilliliters: number };
export type MissionFeedback = { activityId: string; stomachTolerance: number | null; perceivedExertion: number | null };
export type MissionDrift = { activityId: string; percent: number };
export type CapabilityStatus = "starting" | "building" | "solid" | "ready" | "untracked";
export type MissionCapability = { key: string; label: string; status: CapabilityStatus; progressPercent: number | null; evidence: string; nextTarget: string };
export type MissionRequirement = { label: string; met: boolean };
export type MissionMilestone = { key: string; title: string; horizon: string; achieved: boolean; progressPercent: number; evidence: string; purpose: string; requirements: MissionRequirement[] };
export type MissionControl = {
  targetYear: number; targetDistanceKm: number; longestRideKm: number; bestBackToBackKm: number; consistentWeeks: number; qualifyingFuelingRides: number;
  capabilities: MissionCapability[]; milestones: MissionMilestone[]; nextMilestone: MissionMilestone | null; achievedMilestones: number;
};

function rounded(value: number, digits = 0): number { const factor = 10 ** digits; return Math.round(value * factor) / factor; }
function localDate(value: string): string { return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value)); }
function dayNumber(key: string): number { const [year, month, day] = key.split("-").map(Number); return Date.UTC(year, month - 1, day) / 86_400_000; }
function weekStart(key: string): string { const date = new Date(`${key}T12:00:00Z`); const weekday = date.getUTCDay() || 7; date.setUTCDate(date.getUTCDate() - weekday + 1); return date.toISOString().slice(0, 10); }
function progress(value: number, target: number): number { return Math.max(0, Math.min(100, rounded(value / target * 100))); }
function statusFromProgress(value: number | null): CapabilityStatus { return value === null ? "untracked" : value >= 100 ? "ready" : value >= 70 ? "solid" : value >= 30 ? "building" : "starting"; }

export function buildMissionControl(input: {
  activities: Activity[]; nutrition: MissionNutrition[]; feedback: MissionFeedback[]; drifts: MissionDrift[];
  weeklyGoalKm: number; targetYear: number; today: string; recoveryTrackedNights: number; recoveryStableNights: number;
}): MissionControl {
  const rides = input.activities.filter((activity) => activity.sportType === "cycling").sort((a, b) => a.activityDate.localeCompare(b.activityDate));
  const longestRideKm = rounded(Math.max(0, ...rides.map((activity) => activity.distanceMeters / 1000)), 1);
  const byDay = new Map<string, number>();
  for (const ride of rides) { const key = localDate(ride.activityDate); byDay.set(key, (byDay.get(key) ?? 0) + ride.distanceMeters / 1000); }
  let bestBackToBackKm = 0;
  for (const [date, distance] of byDay) { const next = [...byDay].find(([candidate]) => dayNumber(candidate) === dayNumber(date) + 1)?.[1] ?? 0; if (distance >= 40 && next >= 40) bestBackToBackKm = Math.max(bestBackToBackKm, distance + next); }
  bestBackToBackKm = rounded(bestBackToBackKm, 1);

  const currentWeek = weekStart(input.today);
  const weeklyDistances = new Map<string, number>();
  for (const ride of rides) { const week = weekStart(localDate(ride.activityDate)); weeklyDistances.set(week, (weeklyDistances.get(week) ?? 0) + ride.distanceMeters / 1000); }
  const previousWeeks = Array.from({ length: 4 }, (_, index) => { const date = new Date(`${currentWeek}T12:00:00Z`); date.setUTCDate(date.getUTCDate() - (index + 1) * 7); return date.toISOString().slice(0, 10); });
  const consistentWeeks = previousWeeks.filter((week) => (weeklyDistances.get(week) ?? 0) >= input.weeklyGoalKm * .8).length;

  const nutritionTotals = new Map<string, { carbs: number; fluid: number }>();
  for (const entry of input.nutrition) { const current = nutritionTotals.get(entry.activityId) ?? { carbs: 0, fluid: 0 }; current.carbs += entry.carbohydratesGrams; current.fluid += entry.fluidMilliliters; nutritionTotals.set(entry.activityId, current); }
  const qualifyingFuelingRides = rides.filter((ride) => {
    if (ride.movingTimeSeconds < 3 * 3600) return false;
    const totals = nutritionTotals.get(ride.id); if (!totals) return false;
    const carbsPerHour = totals.carbs / (ride.movingTimeSeconds / 3600);
    const stomach = input.feedback.find((item) => item.activityId === ride.id)?.stomachTolerance;
    return carbsPerHour >= 40 && (stomach === null || stomach === undefined || stomach >= 6);
  }).length;
  const nightRides = rides.filter((ride) => { const hour = Number(new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", hour12: false }).format(new Date(ride.activityDate))); return ride.movingTimeSeconds >= 2 * 3600 && (hour >= 21 || hour <= 5); }).length;
  const stableDrifts = input.drifts.filter((item) => item.percent <= 10).length;
  const longRideDrifts = input.drifts.length;

  const capabilities: MissionCapability[] = [
    { key: "consistency", label: "Trainingskonstanz", status: statusFromProgress(progress(consistentWeeks, 4)), progressPercent: progress(consistentWeeks, 4), evidence: `${consistentWeeks} von 4 abgeschlossenen Wochen mit mindestens 80 % des ${input.weeklyGoalKm}-km-Ziels.`, nextTarget: "Vier stabile Wochen ohne Nachholzwang." },
    { key: "long_ride", label: "Langstreckenfähigkeit", status: statusFromProgress(progress(longestRideKm, 300)), progressPercent: progress(longestRideKm, 300), evidence: `Längste gespeicherte Fahrt: ${longestRideKm.toLocaleString("de-DE")} km.`, nextTarget: "Kontrolliert auf den nächsten Distanz-Meilenstein hinarbeiten." },
    { key: "back_to_back", label: "Back-to-back", status: statusFromProgress(progress(bestBackToBackKm, 300)), progressPercent: progress(bestBackToBackKm, 300), evidence: bestBackToBackKm ? `Bestes Wochenende an zwei aufeinanderfolgenden Tagen: ${bestBackToBackKm.toLocaleString("de-DE")} km.` : "Noch keine zwei aufeinanderfolgenden Tage mit jeweils mindestens 40 km.", nextTarget: "Zwei längere Tage mit guter Erholung und Versorgung dokumentieren." },
    { key: "fueling", label: "Verpflegungstoleranz", status: statusFromProgress(progress(qualifyingFuelingRides, 3)), progressPercent: progress(qualifyingFuelingRides, 3), evidence: `${qualifyingFuelingRides} Fahrt(en) über 3 Stunden mit mindestens 40 g KH/h und ohne schlecht bewerteten Magen.`, nextTarget: "Drei reproduzierbare lange Verpflegungsproben." },
    { key: "heart_rate", label: "HF-Stabilität", status: longRideDrifts ? statusFromProgress(progress(stableDrifts, 3)) : "untracked", progressPercent: longRideDrifts ? progress(stableDrifts, 3) : null, evidence: longRideDrifts ? `${stableDrifts} von ${longRideDrifts} auswertbaren Fahrten mit höchstens 10 % Drift.` : "Noch keine langen Fahrten mit gleichzeitig ausreichenden HF- und Leistungsdaten.", nextTarget: "Drei vergleichbare lange Fahrten mit auswertbarer Drift." },
    { key: "night", label: "Nachtfahrerfahrung", status: statusFromProgress(progress(nightRides, 2)), progressPercent: progress(nightRides, 2), evidence: `${nightRides} gespeicherte Fahrt(en) über zwei Stunden mit Start zwischen 21 und 5 Uhr.`, nextTarget: "Nachtfahrten schrittweise und sicher im unterstützten Umfeld testen." },
    { key: "recovery", label: "Erholungsdaten", status: statusFromProgress(progress(input.recoveryTrackedNights, 21)), progressPercent: progress(input.recoveryTrackedNights, 21), evidence: `${input.recoveryTrackedNights} getrackte Nächte in 28 Tagen, davon ${input.recoveryStableNights} ohne rote Readiness.`, nextTarget: "Mindestens 21 Nächte pro Monat als persönliche Vergleichsbasis." },
    { key: "strength", label: "Krafttraining", status: "untracked", progressPercent: null, evidence: "Geplante Gym-Einheiten sind sichtbar, absolvierte Einheiten werden aber noch nicht zuverlässig bestätigt.", nextTarget: "Abschluss-Tracking für Krafttraining ergänzen." },
  ];

  const cap = (key: string) => capabilities.find((item) => item.key === key)!;
  const requirement = (label: string, met: boolean): MissionRequirement => ({ label, met });
  const definitions = [
    { key: "consistency", title: "Vier stabile Trainingswochen", horizon: "Jetzt", achieved: consistentWeeks >= 4, value: consistentWeeks, target: 4, evidence: `${consistentWeeks}/4 Wochen`, purpose: "Konstanz ist die Grundlage, bevor einzelne Extremtage wichtiger werden.", requirements: [requirement("Wochenziel in vier abgeschlossenen Wochen zu mindestens 80 %", consistentWeeks >= 4)] },
    { key: "ride_150", title: "150-km-Ausdauerfahrt", horizon: "Grundlage", achieved: longestRideKm >= 150, value: longestRideKm, target: 150, evidence: `Bestwert ${longestRideKm} km`, purpose: "Erste belastbare Standortbestimmung für Sitzkomfort, Pacing und Versorgung.", requirements: [requirement("Mindestens zwei stabile Trainingswochen", consistentWeeks >= 2), requirement("Verpflegung protokollieren", qualifyingFuelingRides >= 1)] },
    { key: "ride_200", title: "200-km-Fahrt", horizon: "Ausbau", achieved: longestRideKm >= 200, value: longestRideKm, target: 200, evidence: `Bestwert ${longestRideKm} km`, purpose: "Langer, kontrollierter Tag als Brücke zum Ultracycling.", requirements: [requirement("150 km bereits bewältigt", longestRideKm >= 150), requirement("Zwei lange Verpflegungsproben", qualifyingFuelingRides >= 2)] },
    { key: "back_to_back_250", title: "250-km-Back-to-back-Wochenende", horizon: "Ausbau", achieved: bestBackToBackKm >= 250, value: bestBackToBackKm, target: 250, evidence: `Bestwert ${bestBackToBackKm} km`, purpose: "Trainiert erneutes Losfahren mit Vorbelastung, ohne alles an einen Extremtag zu hängen.", requirements: [requirement("Einzelfahrt über 150 km", longestRideKm >= 150), requirement("Erholungsbasis mindestens 14 Nächte", input.recoveryTrackedNights >= 14)] },
    { key: "night", title: "Kontrollierte Nachtfahrt", horizon: "Langdistanz-spezifisch", achieved: nightRides >= 1, value: nightRides, target: 1, evidence: `${nightRides} passende Fahrt(en)`, purpose: "Beleuchtung, Müdigkeit, Kleidung und Verpflegung unter sicheren Bedingungen erproben.", requirements: [requirement("Lange Fahrt über 150 km", longestRideKm >= 150), requirement("Nachtfahrt unterstützt oder mit sicherem Abbruchplan", nightRides >= 1)] },
    { key: "ride_300", title: "300-km-Generalprobe", horizon: "2027", achieved: longestRideKm >= 300, value: longestRideKm, target: 300, evidence: `Bestwert ${longestRideKm} km`, purpose: "Erste echte Generalprobe für Pacing, Kontaktpunkte und dauerhafte Energieaufnahme.", requirements: [requirement("200 km bereits bewältigt", longestRideKm >= 200), requirement("Drei Verpflegungsproben", cap("fueling").progressPercent === 100), requirement("Back-to-back mindestens 200 km", bestBackToBackKm >= 200)] },
    { key: "ride_400", title: "400-km-Fahrt", horizon: "2027", achieved: longestRideKm >= 400, value: longestRideKm, target: 400, evidence: `Bestwert ${longestRideKm} km`, purpose: "Testet einen sehr langen Tag einschließlich Dunkelheit und wiederholter Versorgung.", requirements: [requirement("300-km-Generalprobe", longestRideKm >= 300), requirement("Mindestens eine Nachtfahrt", nightRides >= 1)] },
    { key: "weekend_500", title: "500-km-Ausdauerwochenende", horizon: "2027/28", achieved: bestBackToBackKm >= 500, value: bestBackToBackKm, target: 500, evidence: `Bestwert ${bestBackToBackKm} km`, purpose: "Großer Haltbarkeitstest mit Support-, Schlaf- und Materialabläufen.", requirements: [requirement("400-km-Fahrt", longestRideKm >= 400), requirement("Erholungsdaten stabil erfasst", input.recoveryTrackedNights >= 21)] },
    { key: "ride_600", title: "600-km-Hauptprobe", horizon: "2028", achieved: longestRideKm >= 600, value: longestRideKm, target: 600, evidence: `Bestwert ${longestRideKm} km`, purpose: "Letzte große Standortbestimmung vor der spezifischen Rennvorbereitung.", requirements: [requirement("500-km-Wochenende", bestBackToBackKm >= 500), requirement("Mehrere Nachtfahrten", nightRides >= 2)] },
  ];
  const milestones: MissionMilestone[] = definitions.map((item) => ({ key: item.key, title: item.title, horizon: item.horizon, achieved: item.achieved, progressPercent: progress(item.value, item.target), evidence: item.evidence, purpose: item.purpose, requirements: item.requirements }));
  return { targetYear: input.targetYear, targetDistanceKm: 1100, longestRideKm, bestBackToBackKm, consistentWeeks, qualifyingFuelingRides, capabilities, milestones, nextMilestone: milestones.find((item) => !item.achieved) ?? null, achievedMilestones: milestones.filter((item) => item.achieved).length };
}

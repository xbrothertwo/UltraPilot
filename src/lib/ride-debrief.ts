import type { SubjectiveFeedback } from "@/lib/activity-journal";
import type { NutritionSummary } from "@/lib/nutrition-analysis";
import { isPlanComparisonClose, type PlanComparison } from "@/lib/planning/reconciliation";
import type { PlannedWorkout } from "@/lib/planning/workouts";
import { buildFuelingPreparation } from "./daily-cockpit";
import { compareLoadToPlan, type ActivityLoad } from "./training-load";

export type DebriefTone = "good" | "info" | "warning" | "critical";
export type DebriefSignal = { label: string; value: string; detail: string; tone: DebriefTone };
export type RideDebrief = {
  status: "on_track" | "adjust" | "recover" | "incomplete";
  title: string;
  summary: string;
  signals: DebriefSignal[];
  nextAction: "keep" | "easy" | "recover";
};

const expectedRpe: Record<PlannedWorkout["intensity"], [number, number]> = {
  recovery: [1, 3], easy: [2, 4], endurance: [3, 5], tempo: [5, 7], threshold: [7, 9], vo2: [8, 10], strength: [6, 8],
};

function planSignal(workout: PlannedWorkout | null, comparison: PlanComparison | null, load: ActivityLoad | null): DebriefSignal {
  if (!workout || !comparison) return { label: "Planvergleich", value: "Ungeplante Fahrt", detail: "Die Aktivität konnte keiner geplanten Einheit sicher zugeordnet werden.", tone: "info" };
  const loadComparison = compareLoadToPlan(load?.points ?? null, workout.intensity, workout.plannedDurationMinutes);
  if (loadComparison.comparison === "higher") return { label: "Soll / Ist", value: "Härter als geplant", detail: `Gemessene Last ${load?.points?.toLocaleString("de-DE", { maximumFractionDigits: 0 })} UPL · Soll etwa ${loadComparison.expectedPoints?.toLocaleString("de-DE", { maximumFractionDigits: 0 })} UPL.`, tone: "warning" };
  if (loadComparison.comparison === "lower") return { label: "Soll / Ist", value: "Leichter als geplant", detail: `Distanz ${signed(comparison.distanceDeltaKm, "km")} · Dauer ${signed(comparison.durationDeltaMinutes, "min")}.`, tone: "info" };
  const planClose = isPlanComparisonClose(comparison);
  return { label: "Soll / Ist", value: planClose ? "Plan getroffen" : "Umfang abweichend", detail: `Distanz ${signed(comparison.distanceDeltaKm, "km")} · Dauer ${signed(comparison.durationDeltaMinutes, "min")}.`, tone: planClose ? "good" : "info" };
}

function signed(value: number | null, unit: string): string {
  if (value === null) return "offen";
  return `${value > 0 ? "+" : ""}${value.toLocaleString("de-DE", { maximumFractionDigits: 1 })} ${unit}`;
}

export function buildRideDebrief(input: {
  workout: PlannedWorkout | null;
  comparison: PlanComparison | null;
  load: ActivityLoad | null;
  nutrition: NutritionSummary;
  nutritionRecorded: boolean;
  feedback: SubjectiveFeedback | null;
  heartRateDriftPercent: number | null;
}): RideDebrief {
  const signals: DebriefSignal[] = [planSignal(input.workout, input.comparison, input.load)];
  let critical = false;
  let warning = signals.some((signal) => signal.tone === "warning");

  if (input.heartRateDriftPercent === null) signals.push({ label: "HF-Drift", value: "Nicht messbar", detail: "Benötigt gleichzeitig aufgezeichnete Herzfrequenz und Leistung.", tone: "info" });
  else if (input.heartRateDriftPercent > 10) { signals.push({ label: "HF-Drift", value: `${input.heartRateDriftPercent.toLocaleString("de-DE", { maximumFractionDigits: 1 })} %`, detail: "Deutlicher Effizienzverlust zwischen erster und zweiter Hälfte; im persönlichen Verlauf beobachten.", tone: "warning" }); warning = true; }
  else if (input.heartRateDriftPercent > 5) { signals.push({ label: "HF-Drift", value: `${input.heartRateDriftPercent.toLocaleString("de-DE", { maximumFractionDigits: 1 })} %`, detail: "Leicht erhöhte Drift; Wetter, Strecke und Versorgung mitdenken.", tone: "info" }); }
  else signals.push({ label: "HF-Drift", value: `${input.heartRateDriftPercent.toLocaleString("de-DE", { maximumFractionDigits: 1 })} %`, detail: "Stabile Effizienz über beide Fahrthälften.", tone: "good" });

  const fuelingTarget = buildFuelingPreparation(input.workout, [], []);
  if (!input.nutritionRecorded) signals.push({ label: "Verpflegung", value: "Nicht protokolliert", detail: "Ohne Einträge wird keine Unterversorgung unterstellt.", tone: "info" });
  else if (fuelingTarget && input.nutrition.carbohydratesPerHour < fuelingTarget.carbohydrateRateGrams * .75) { signals.push({ label: "Verpflegung", value: `${Math.round(input.nutrition.carbohydratesPerHour)} g/h · ${Math.round(input.nutrition.fluidPerHour)} ml/h`, detail: `Kohlenhydrate unter dem Trainingsziel von etwa ${fuelingTarget.carbohydrateRateGrams} g/h. Magenverträglichkeit und Energiegefühl mitbewerten.`, tone: "warning" }); warning = true; }
  else signals.push({ label: "Verpflegung", value: `${Math.round(input.nutrition.carbohydratesPerHour)} g/h · ${Math.round(input.nutrition.fluidPerHour)} ml/h`, detail: fuelingTarget ? `Kohlenhydrat-Trainingsziel etwa ${fuelingTarget.carbohydrateRateGrams} g/h; Flüssigkeit wird dokumentiert, aber ohne Wetter- und Schweißdaten nicht bewertet.` : "Protokollierte Aufnahme; ohne zugeordneten Plan erfolgt keine Zielbewertung.", tone: fuelingTarget ? "good" : "info" });

  if (!input.feedback) signals.push({ label: "Körpergefühl", value: "Feedback fehlt", detail: "RPE, Beine, Energie und Magen vervollständigen die Auswertung.", tone: "info" });
  else {
    const range = input.workout ? expectedRpe[input.workout.intensity] : null;
    const rpeHigh = range && input.feedback.perceivedExertion !== null && input.feedback.perceivedExertion > range[1] + 1;
    const pain = input.feedback.painNotes.trim().length > 0;
    const exhausted = (input.feedback.fatigue ?? 0) >= 9 || (input.feedback.mood ?? 10) <= 2;
    const stomachProblem = input.feedback.stomachTolerance !== null && input.feedback.stomachTolerance <= 4;
    critical = pain || exhausted;
    warning = warning || Boolean(rpeHigh) || stomachProblem || (input.feedback.fatigue ?? 0) >= 8;
    const details = [`RPE ${input.feedback.perceivedExertion ?? "–"}/10`, `Beine ${input.feedback.fatigue ?? "–"}/10`, `Energie ${input.feedback.mood ?? "–"}/10`, `Magen ${input.feedback.stomachTolerance ?? "–"}/10`].join(" · ");
    signals.push({ label: "Körpergefühl", value: critical ? "Erholung priorisieren" : warning ? "Belastung nachwirken lassen" : "Unauffällig", detail: pain ? `${details} · Beschwerden wurden notiert.` : details, tone: critical ? "critical" : warning ? "warning" : "good" });
  }

  if (!input.feedback) return { status: "incomplete", title: "Fast fertig – dein Körpergefühl fehlt noch.", summary: "Messwerte und Versorgung sind ausgewertet. Mit dem kurzen Feedback wird daraus eine belastbare Entscheidung für die nächste Einheit.", signals, nextAction: "keep" };
  if (critical) return { status: "recover", title: "Erholung hat jetzt Vorrang.", summary: "Dein subjektives Feedback spricht gegen eine weitere harte Belastung. UltraPilot stellt keine Diagnose; bei anhaltenden oder starken Beschwerden fachlich abklären lassen.", signals, nextAction: "recover" };
  if (warning) return { status: "adjust", title: "Die nächste Fahrt lieber locker.", summary: "Mindestens ein nachvollziehbares Signal lag über dem geplanten oder üblichen Bereich. Eine lockere Folgeeinheit schützt die Konstanz.", signals, nextAction: "easy" };
  return { status: "on_track", title: "Einheit sauber verarbeitet.", summary: "Soll/Ist, Messwerte, Versorgung und Körpergefühl liefern aktuell keinen Grund, den nächsten Trainingsreiz zu verändern.", signals, nextAction: "keep" };
}

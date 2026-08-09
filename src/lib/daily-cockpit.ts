import type { NutritionProduct, BottlePreset } from "@/lib/nutrition-planner";
import type { PlannedWorkout } from "@/lib/planning/workouts";
import type { ReadinessResult } from "@/lib/recovery-readiness";

export type DailyDecisionLevel = "go" | "adjust" | "recover" | "done" | "open";

export type DailyDecision = {
  level: DailyDecisionLevel;
  eyebrow: string;
  title: string;
  summary: string;
  reasons: string[];
};

export type LowReadinessAdaptation = Pick<PlannedWorkout, "sportType" | "title" | "description" | "intensity" | "plannedDurationMinutes" | "plannedDistanceKm">;

export type FuelingPreparation = {
  carbohydrateRateGrams: number;
  totalCarbohydratesGrams: number;
  fluidMilliliters: number;
  bottleCount: number;
  bottleSuggestion: { name: string; count: number; carbohydratesGrams: number } | null;
  productSuggestion: { name: string; count: number; carbohydratesGrams: number } | null;
};

const demandingIntensities = new Set(["tempo", "threshold", "vo2"]);

export function buildDailyDecision(
  readiness: ReadinessResult,
  workout: PlannedWorkout | null,
  completed: boolean,
  highLoadWithin48Hours: boolean,
  largestAvailableWindowMinutes: number | null = null,
): DailyDecision {
  if (completed && workout) {
    return {
      level: "done",
      eyebrow: "Training erledigt",
      title: "Sauber. Jetzt zählt die Erholung.",
      summary: `${workout.title} ist einer Aktivität zugeordnet. Ergänze noch Belastung und Verpflegung, solange es frisch ist.`,
      reasons: ["Die absolvierte Einheit fließt bereits in Wochenumfang und Belastung ein."],
    };
  }

  if (!workout) {
    return {
      level: "open",
      eyebrow: "Heute ohne Einheit",
      title: "Freier Tag – bewusst nutzen.",
      summary: readiness.status === "red" ? "Erholung hat heute Vorrang." : "Im Plan ist heute kein Training vorgesehen.",
      reasons: readiness.reasons.slice(0, 2),
    };
  }

  const demanding = demandingIntensities.has(workout.intensity) || workout.sportType === "strength";
  if (readiness.status === "red") {
    return {
      level: "recover",
      eyebrow: "Heute regenerieren",
      title: demanding ? "Die intensive Einheit heute nicht erzwingen." : "Belastung deutlich reduzieren.",
      summary: "Wähle „Ich fühle mich schlechter“, um die Einheit bewusst durch regenerative Bewegung zu ersetzen.",
      reasons: readiness.reasons.slice(0, 3),
    };
  }

  if (largestAvailableWindowMinutes !== null && workout.plannedDurationMinutes && largestAvailableWindowMinutes < workout.plannedDurationMinutes) {
    const minimumUsefulMinutes = workout.sportType === "running" ? 30 : 45;
    return {
      level: "adjust",
      eyebrow: "Kalender hat sich verändert",
      title: largestAvailableWindowMinutes < minimumUsefulMinutes ? "Die Einheit passt heute nicht mehr sinnvoll hinein." : `${workout.title} heute kürzen oder verschieben.`,
      summary: largestAvailableWindowMinutes < minimumUsefulMinutes ? `Es gibt heute kein zusammenhängendes Trainingsfenster von mindestens ${minimumUsefulMinutes} Minuten.` : `Dein größtes freies Fenster umfasst ${largestAvailableWindowMinutes} Minuten; geplant sind ${workout.plannedDurationMinutes} Minuten.`,
      reasons: ["Neue Arbeitszeiten und Termine haben Vorrang vor einer erzwungenen Einheit.", "Offene Kilometer werden nur in realistisch verfügbare Fenster verteilt."],
    };
  }

  if (readiness.status === "unknown") {
    return {
      level: "open",
      eyebrow: "Kurz einchecken",
      title: `${workout.title} steht im Plan.`,
      summary: "Für eine belastbare Tagesentscheidung fehlen heute noch Schlafdaten oder dein kurzer Tagesform-Check.",
      reasons: readiness.reasons.slice(0, 2),
    };
  }

  if ((readiness.status === "yellow" && demanding) || (highLoadWithin48Hours && demanding)) {
    const strength = workout.sportType === "strength";
    const running = workout.sportType === "running";
    const cycling = workout.sportType === "cycling";
    return {
      level: "adjust",
      eyebrow: "Heute anpassen",
      title: strength
        ? `${workout.title} heute durch Mobility ersetzen.`
        : running
          ? `${workout.title} lieber locker laufen.`
          : cycling
            ? `${workout.title} lieber locker fahren.`
            : `${workout.title} heute deutlich lockerer angehen.`,
      summary: strength
        ? "Heute keine schweren Sätze erzwingen. Eine kurze Mobility-Einheit schützt die Erholung und hält die Routine aufrecht."
        : running
          ? "Behalte den Termin, streiche aber die harten Abschnitte und laufe nur locker."
          : cycling
            ? "Behalte den Termin, streiche aber die harten Abschnitte und fahre im lockeren Grundlagenbereich."
            : "Behalte den Termin nur, wenn du die Belastung klar reduzieren kannst.",
      reasons: highLoadWithin48Hours
        ? ["In den letzten 48 Stunden lag bereits eine hohe Trainingsbelastung.", ...readiness.reasons].slice(0, 3)
        : readiness.reasons.slice(0, 3),
    };
  }

  return {
    level: "go",
    eyebrow: "Grünes Licht",
    title: `${workout.title} wie geplant.`,
    summary: "Tagesform und jüngste Belastung sprechen nicht gegen die vorgesehene Einheit.",
    reasons: readiness.reasons.slice(0, 2),
  };
}

function roundedFive(value: number): number {
  return Math.max(15, Math.round(value / 5) * 5);
}

export function adaptWorkoutForLowReadiness(workout: PlannedWorkout): LowReadinessAdaptation {
  const originalDuration = workout.plannedDurationMinutes ?? 60;
  if (workout.sportType === "cycling") {
    const duration = Math.min(60, roundedFive(originalDuration * .6));
    const distance = workout.plannedDistanceKm === null ? null : Math.round(workout.plannedDistanceKm * duration / Math.max(1, originalDuration) * 10) / 10;
    return {
      sportType: "cycling",
      title: "Sehr lockere Regenerationsfahrt",
      description: "Nur locker in Z1 fahren. Keine Intervalle und keine Belastungsspitzen. Wenn du dich nach 15 Minuten nicht besser fühlst, Einheit beenden.",
      intensity: "recovery",
      plannedDurationMinutes: duration,
      plannedDistanceKm: distance,
    };
  }
  if (workout.sportType === "running") {
    const duration = Math.min(45, roundedFive(originalDuration * .6));
    const distance = workout.plannedDistanceKm === null ? null : Math.round(workout.plannedDistanceKm * duration / Math.max(1, originalDuration) * 10) / 10;
    return {
      sportType: "running",
      title: "Sehr lockerer Regenerationslauf",
      description: "Nur locker laufen, ohne Tempoabschnitte oder Leistungsziel. Bei anhaltender Müdigkeit abbrechen und vollständig pausieren.",
      intensity: "recovery",
      plannedDurationMinutes: duration,
      plannedDistanceKm: distance,
    };
  }
  if (workout.sportType === "strength") {
    return {
      sportType: "recovery",
      title: "Mobility & Regeneration",
      description: "20–30 Minuten lockere Mobility ohne schwere Lasten. Fokus auf Hüfte, Sprunggelenke, Brustwirbelsäule und ruhige Atmung.",
      intensity: "recovery",
      plannedDurationMinutes: 25,
      plannedDistanceKm: null,
    };
  }
  return {
    sportType: "recovery",
    title: "Aktive Regeneration",
    description: "Sehr lockere Bewegung ohne Leistungsziel. Bei anhaltender Müdigkeit vollständig pausieren.",
    intensity: "recovery",
    plannedDurationMinutes: Math.min(30, roundedFive(originalDuration * .5)),
    plannedDistanceKm: null,
  };
}

function carbohydrateRate(workout: PlannedWorkout): number {
  const duration = workout.plannedDurationMinutes ?? 0;
  if (duration <= 60) return 30;
  if (workout.intensity === "tempo" || workout.intensity === "threshold" || workout.intensity === "vo2") return 70;
  if (duration >= 180) return 75;
  return 60;
}

export function buildFuelingPreparation(
  workout: PlannedWorkout | null,
  products: NutritionProduct[],
  presets: BottlePreset[],
): FuelingPreparation | null {
  if (!workout || workout.sportType !== "cycling" || !workout.plannedDurationMinutes || workout.plannedDurationMinutes <= 0) return null;
  const hours = workout.plannedDurationMinutes / 60;
  const rate = carbohydrateRate(workout);
  const totalCarbohydrates = Math.round(rate * hours);
  const fluid = Math.round(hours * 500 / 50) * 50;

  const usablePresets = presets.filter((preset) => preset.volumeMilliliters > 0 && preset.carbohydratesGrams > 0);
  const preset = [...usablePresets].sort((a, b) => Math.abs(b.carbohydratesGrams - rate) - Math.abs(a.carbohydratesGrams - rate))[0] ?? null;
  const presetCount = preset ? Math.min(Math.ceil(fluid / preset.volumeMilliliters), Math.ceil(totalCarbohydrates / preset.carbohydratesGrams)) : 0;
  const presetCarbs = preset ? Math.min(totalCarbohydrates, Math.round(presetCount * preset.carbohydratesGrams)) : 0;
  const remaining = Math.max(0, totalCarbohydrates - presetCarbs);

  const usableProducts = products.filter((product) => product.carbohydratesGrams > 0 && (product.category === "gel" || product.category === "bar" || product.category === "food"));
  const product = [...usableProducts].sort((a, b) => Math.abs(a.carbohydratesGrams - 30) - Math.abs(b.carbohydratesGrams - 30))[0] ?? null;
  const productCount = product && remaining > 0 ? Math.ceil(remaining / product.carbohydratesGrams) : 0;

  return {
    carbohydrateRateGrams: rate,
    totalCarbohydratesGrams: totalCarbohydrates,
    fluidMilliliters: fluid,
    bottleCount: Math.max(1, Math.ceil(fluid / 750)),
    bottleSuggestion: preset ? { name: preset.name, count: presetCount, carbohydratesGrams: presetCarbs } : null,
    productSuggestion: product && productCount > 0 ? { name: product.name, count: productCount, carbohydratesGrams: Math.round(productCount * product.carbohydratesGrams) } : null,
  };
}

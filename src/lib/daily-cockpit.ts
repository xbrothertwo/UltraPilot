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

  if (readiness.status === "unknown") {
    return {
      level: "open",
      eyebrow: "Kurz einchecken",
      title: `${workout.title} steht im Plan.`,
      summary: "Für eine belastbare Tagesentscheidung fehlen heute noch Schlafdaten oder dein kurzer Tagesform-Check.",
      reasons: readiness.reasons.slice(0, 2),
    };
  }

  const demanding = demandingIntensities.has(workout.intensity);
  if (readiness.status === "red") {
    return {
      level: "recover",
      eyebrow: "Heute regenerieren",
      title: demanding ? "Die intensive Einheit heute nicht erzwingen." : "Belastung deutlich reduzieren.",
      summary: "UltraPilot ändert deinen Plan nicht automatisch, empfiehlt heute aber Pause oder sehr lockere Bewegung.",
      reasons: readiness.reasons.slice(0, 3),
    };
  }

  if ((readiness.status === "yellow" && demanding) || (highLoadWithin48Hours && demanding)) {
    return {
      level: "adjust",
      eyebrow: "Heute anpassen",
      title: `${workout.title} lieber locker fahren.`,
      summary: "Behalte den Termin, streiche aber die harten Abschnitte und fahre im lockeren Grundlagenbereich.",
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

export type NutritionEntry = {
  id: string;
  consumedAtSeconds: number | null;
  description: string;
  carbohydratesGrams: number;
  fluidMilliliters: number;
  sodiumMilligrams: number;
  calories: number;
  productId?: string | null;
  quantity?: number;
  entryMethod?: "manual" | "timeline" | "bottle_schedule";
  bottlePlanId?: string | null;
};

export type NutritionSummary = {
  carbohydratesGrams: number;
  fluidMilliliters: number;
  sodiumMilligrams: number;
  calories: number;
  carbohydratesPerHour: number;
  fluidPerHour: number;
  sodiumPerHour: number;
  gaps: Array<{ startSeconds: number; endSeconds: number; durationSeconds: number }>;
};

export function analyzeNutrition(entries: NutritionEntry[], movingTimeSeconds: number, elapsedTimeSeconds: number, gapThresholdSeconds = 3600): NutritionSummary {
  const totals = entries.reduce((sum, entry) => ({
    carbohydratesGrams: sum.carbohydratesGrams + entry.carbohydratesGrams,
    fluidMilliliters: sum.fluidMilliliters + entry.fluidMilliliters,
    sodiumMilligrams: sum.sodiumMilligrams + entry.sodiumMilligrams,
    calories: sum.calories + entry.calories,
  }), { carbohydratesGrams: 0, fluidMilliliters: 0, sodiumMilligrams: 0, calories: 0 });
  const hours = movingTimeSeconds / 3600;
  const timestamps = entries.flatMap((entry) => entry.consumedAtSeconds === null ? [] : [Math.max(0, Math.min(elapsedTimeSeconds, entry.consumedAtSeconds))]).sort((a, b) => a - b);
  const boundaries = [0, ...timestamps, elapsedTimeSeconds];
  const gaps = boundaries.slice(1).flatMap((endSeconds, index) => {
    const startSeconds = boundaries[index];
    const durationSeconds = endSeconds - startSeconds;
    return durationSeconds > gapThresholdSeconds ? [{ startSeconds, endSeconds, durationSeconds }] : [];
  });
  return {
    ...totals,
    carbohydratesPerHour: hours > 0 ? totals.carbohydratesGrams / hours : 0,
    fluidPerHour: hours > 0 ? totals.fluidMilliliters / hours : 0,
    sodiumPerHour: hours > 0 ? totals.sodiumMilligrams / hours : 0,
    gaps,
  };
}

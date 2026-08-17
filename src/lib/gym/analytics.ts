import type { GymPerformanceSet } from "@/lib/gym/types";

export function estimatedOneRepMax(weightKg: number, repetitions: number): number | null {
  if (!Number.isFinite(weightKg) || !Number.isInteger(repetitions) || weightKg <= 0 || repetitions < 1 || repetitions > 12) return null;
  return Math.round((weightKg * (1 + repetitions / 30)) * 10) / 10;
}

export type GymPersonalRecords = {
  highestLoadKg: number | null;
  bestRepetitions: number | null;
  bestEstimatedOneRepMaxKg: number | null;
};

export function derivePersonalRecords(sets: readonly GymPerformanceSet[]): GymPersonalRecords {
  const working = sets.filter((set) => set.completed && set.setType !== "warmup");
  const loads = working.flatMap((set) => set.weightKg === null ? [] : [set.weightKg]);
  const reps = working.flatMap((set) => set.repetitions === null ? [] : [set.repetitions]);
  const estimates = working.flatMap((set) => set.weightKg !== null && set.repetitions !== null ? [estimatedOneRepMax(set.weightKg, set.repetitions)] : []).filter((value): value is number => value !== null);
  return {
    highestLoadKg: loads.length ? Math.max(...loads) : null,
    bestRepetitions: reps.length ? Math.max(...reps) : null,
    bestEstimatedOneRepMaxKg: estimates.length ? Math.max(...estimates) : null,
  };
}

export type ProgressionRecommendation = {
  action: "increase" | "hold" | "reduce";
  suggestedWeightKg: number | null;
  reason: string;
};

export function recommendDoubleProgression(input: {
  sets: readonly Pick<GymPerformanceSet, "completed" | "setType" | "repetitions" | "rir" | "weightKg">[];
  targetSets: number;
  repMin: number;
  repMax: number;
  targetRir: number | null;
  loadIncrementKg: number | null;
}): ProgressionRecommendation {
  const working = input.sets.filter((set) => set.completed && set.setType !== "warmup");
  const currentWeight = working.find((set) => set.weightKg !== null)?.weightKg ?? null;
  if (working.length < input.targetSets) return { action: "hold", suggestedWeightKg: currentWeight, reason: "Noch nicht alle vorgesehenen Arbeitssätze abgeschlossen." };
  const atUpperTarget = working.every((set) => (set.repetitions ?? -1) >= input.repMax && (input.targetRir === null || (set.rir !== null && set.rir >= input.targetRir)));
  if (atUpperTarget && currentWeight !== null && input.loadIncrementKg !== null && input.loadIncrementKg > 0) {
    return { action: "increase", suggestedWeightKg: Math.round((currentWeight + input.loadIncrementKg) * 100) / 100, reason: "Alle Arbeitssätze erreichen das obere Wiederholungsziel bei passender Reserve." };
  }
  const belowTarget = working.every((set) => set.repetitions !== null && set.repetitions < input.repMin);
  if (belowTarget) return { action: "reduce", suggestedWeightKg: currentWeight, reason: "Alle Arbeitssätze liegen unter dem Zielbereich; Technik und Tagesform prüfen, Last bei Bedarf reduzieren." };
  return { action: "hold", suggestedWeightKg: currentWeight, reason: "Im Zielbereich bleiben und die Wiederholungen kontrolliert ausbauen." };
}

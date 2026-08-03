export type BottleScheduleInput = {
  firstDrinkSeconds: number;
  lastDrinkSeconds: number;
  intervalMinutes: number;
  remainingPercent: number;
  volumeMilliliters: number;
  carbohydratesGrams: number;
  sodiumMilligrams: number;
  calories: number;
};

export type BottleScheduleEvent = {
  consumedAtSeconds: number;
  fluidMilliliters: number;
  carbohydratesGrams: number;
  sodiumMilligrams: number;
  calories: number;
};

export function buildBottleSchedule(input: BottleScheduleInput): BottleScheduleEvent[] {
  if (!Number.isFinite(input.firstDrinkSeconds) || !Number.isFinite(input.lastDrinkSeconds) || input.firstDrinkSeconds < 0 || input.lastDrinkSeconds < input.firstDrinkSeconds) return [];
  if (!Number.isFinite(input.intervalMinutes) || input.intervalMinutes <= 0 || input.remainingPercent < 0 || input.remainingPercent > 100) return [];
  if (input.remainingPercent === 100) return [];
  const intervalSeconds = input.intervalMinutes * 60;
  const timestamps: number[] = [];
  for (let timestamp = input.firstDrinkSeconds; timestamp <= input.lastDrinkSeconds; timestamp += intervalSeconds) timestamps.push(timestamp);
  if (timestamps.at(-1) !== input.lastDrinkSeconds) timestamps.push(input.lastDrinkSeconds);
  const consumedFactor = 1 - input.remainingPercent / 100;
  const count = timestamps.length;
  const integerShare = (total: number, index: number) => {
    const consumedTotal = Math.round(total * consumedFactor);
    return Math.floor(consumedTotal / count) + (index < consumedTotal % count ? 1 : 0);
  };
  return timestamps.map((consumedAtSeconds, index) => ({
    consumedAtSeconds,
    fluidMilliliters: integerShare(input.volumeMilliliters, index),
    carbohydratesGrams: input.carbohydratesGrams * consumedFactor / count,
    sodiumMilligrams: integerShare(input.sodiumMilligrams, index),
    calories: integerShare(input.calories, index),
  }));
}

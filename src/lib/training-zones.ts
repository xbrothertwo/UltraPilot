import type { SensorSample } from "@/lib/activity-files/types";

export type HeartRateZoneMethod = "max_hr" | "heart_rate_reserve" | "manual";

export type TrainingProfile = {
  maxHeartRate: number | null;
  restingHeartRate: number | null;
  ftpWatts: number | null;
  heartRateZoneMethod: HeartRateZoneMethod;
  customHeartRateBoundaries: number[] | null;
  customPowerBoundaries: number[] | null;
};

export type ZoneDefinition = {
  name: string;
  lower: number | null;
  upper: number | null;
  color: string;
};

export type ZoneTime = ZoneDefinition & {
  seconds: number;
  percentage: number;
};

export type HeartRateTarget = { label: string; lower: number | null; upper: number | null };

const HR_COLORS = ["#94a3b8", "#38bdf8", "#22c55e", "#f59e0b", "#ef4444"];
const POWER_COLORS = ["#94a3b8", "#60a5fa", "#34d399", "#facc15", "#fb923c", "#f87171", "#a855f7"];

function strictlyAscending(values: number[], expectedLength: number): boolean {
  return values.length === expectedLength && values.every((value, index) => Number.isFinite(value) && value > 0 && (index === 0 || value > values[index - 1]));
}

function definitions(boundaries: number[], colors: string[]): ZoneDefinition[] {
  return boundaries.concat(Number.POSITIVE_INFINITY).map((upper, index) => ({
    name: `Z${index + 1}`,
    lower: index === 0 ? null : boundaries[index - 1] + 1,
    upper: Number.isFinite(upper) ? upper : null,
    color: colors[index],
  }));
}

export function getHeartRateZones(profile: TrainingProfile): ZoneDefinition[] | null {
  if (profile.heartRateZoneMethod === "manual") {
    return profile.customHeartRateBoundaries && strictlyAscending(profile.customHeartRateBoundaries, 4)
      ? definitions(profile.customHeartRateBoundaries, HR_COLORS)
      : null;
  }
  if (profile.maxHeartRate === null) return null;
  if (profile.heartRateZoneMethod === "heart_rate_reserve") {
    if (profile.restingHeartRate === null || profile.restingHeartRate >= profile.maxHeartRate) return null;
    const reserve = profile.maxHeartRate - profile.restingHeartRate;
    return definitions([0.6, 0.7, 0.8, 0.9].map((factor) => Math.round(profile.restingHeartRate! + reserve * factor)), HR_COLORS);
  }
  return definitions([0.6, 0.7, 0.8, 0.9].map((factor) => Math.round(profile.maxHeartRate! * factor)), HR_COLORS);
}

export function getPlannedHeartRateTarget(zones: ZoneDefinition[] | null, intensity: string): HeartRateTarget | null {
  if (!zones?.length || intensity === "strength") return null;
  if (intensity === "easy") return { label: "Z1–Z2", lower: zones[0].lower, upper: zones[1]?.upper ?? zones[0].upper };
  const index = intensity === "recovery" ? 0 : intensity === "endurance" ? 1 : intensity === "tempo" ? 2 : intensity === "threshold" ? 3 : intensity === "vo2" ? 4 : 1;
  const zone = zones[Math.min(index, zones.length - 1)];
  return { label: zone.name, lower: zone.lower, upper: zone.upper };
}

export function formatHeartRateTarget(target: HeartRateTarget): string {
  if (target.lower !== null && target.upper !== null) return `${target.lower}–${target.upper} bpm (${target.label})`;
  if (target.upper !== null) return `bis ${target.upper} bpm (${target.label})`;
  if (target.lower !== null) return `ab ${target.lower} bpm (${target.label})`;
  return target.label;
}

export function getPowerZones(profile: TrainingProfile): ZoneDefinition[] | null {
  if (profile.customPowerBoundaries && strictlyAscending(profile.customPowerBoundaries, 6)) {
    return definitions(profile.customPowerBoundaries, POWER_COLORS);
  }
  if (profile.ftpWatts === null) return null;
  return definitions([0.55, 0.75, 0.9, 1.05, 1.2, 1.5].map((factor) => Math.round(profile.ftpWatts! * factor)), POWER_COLORS);
}

export function calculateTimeInZones(samples: SensorSample[], zones: ZoneDefinition[], maximumGapSeconds = 10): ZoneTime[] {
  const seconds = zones.map(() => 0);
  const sorted = [...samples].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  for (let index = 0; index < sorted.length - 1; index += 1) {
    const interval = (new Date(sorted[index + 1].timestamp).getTime() - new Date(sorted[index].timestamp).getTime()) / 1000;
    if (!Number.isFinite(interval) || interval <= 0 || interval > maximumGapSeconds) continue;
    const zoneIndex = zones.findIndex((zone) => zone.upper === null || sorted[index].value <= zone.upper);
    if (zoneIndex >= 0) seconds[zoneIndex] += interval;
  }
  const total = seconds.reduce((sum, value) => sum + value, 0);
  return zones.map((zone, index) => ({ ...zone, seconds: seconds[index], percentage: total > 0 ? seconds[index] / total * 100 : 0 }));
}

export function calculateTrainingLoad(normalizedPower: number | null, movingTimeSeconds: number, ftpWatts: number | null): { intensityFactor: number; tss: number } | null {
  if (normalizedPower === null || ftpWatts === null || normalizedPower <= 0 || ftpWatts <= 0 || movingTimeSeconds <= 0) return null;
  const intensityFactor = normalizedPower / ftpWatts;
  return {
    intensityFactor,
    tss: movingTimeSeconds * normalizedPower * intensityFactor / (ftpWatts * 3600) * 100,
  };
}

function timeWeightedAverage(samples: SensorSample[], startMilliseconds: number, endMilliseconds: number, maximumGapSeconds = 10): { average: number; coverage: number } | null {
  const sorted = [...samples].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  let weightedTotal = 0;
  let coveredMilliseconds = 0;
  for (let index = 0; index < sorted.length - 1; index += 1) {
    const sampleStart = new Date(sorted[index].timestamp).getTime();
    const sampleEnd = new Date(sorted[index + 1].timestamp).getTime();
    const originalInterval = sampleEnd - sampleStart;
    if (!Number.isFinite(originalInterval) || originalInterval <= 0 || originalInterval > maximumGapSeconds * 1000) continue;
    const overlap = Math.max(0, Math.min(sampleEnd, endMilliseconds) - Math.max(sampleStart, startMilliseconds));
    if (overlap <= 0) continue;
    weightedTotal += sorted[index].value * overlap;
    coveredMilliseconds += overlap;
  }
  return coveredMilliseconds > 0 ? { average: weightedTotal / coveredMilliseconds, coverage: coveredMilliseconds / (endMilliseconds - startMilliseconds) } : null;
}

export function calculateHeartRateDrift(heartRateSamples: SensorSample[], powerSamples: SensorSample[]): number | null {
  if (heartRateSamples.length < 2 || powerSamples.length < 2) return null;
  const heartRateTimes = heartRateSamples.map((sample) => new Date(sample.timestamp).getTime()).filter(Number.isFinite);
  const powerTimes = powerSamples.map((sample) => new Date(sample.timestamp).getTime()).filter(Number.isFinite);
  const start = Math.max(Math.min(...heartRateTimes), Math.min(...powerTimes));
  const end = Math.min(Math.max(...heartRateTimes), Math.max(...powerTimes));
  if (!Number.isFinite(start) || !Number.isFinite(end) || end - start < 20 * 60 * 1000) return null;
  const middle = start + (end - start) / 2;
  const firstHeartRate = timeWeightedAverage(heartRateSamples, start, middle);
  const secondHeartRate = timeWeightedAverage(heartRateSamples, middle, end);
  const firstPower = timeWeightedAverage(powerSamples, start, middle);
  const secondPower = timeWeightedAverage(powerSamples, middle, end);
  const values = [firstHeartRate, secondHeartRate, firstPower, secondPower];
  if (values.some((value) => value === null || value.coverage < 0.5)) return null;
  const firstEfficiency = firstPower!.average / firstHeartRate!.average;
  const secondEfficiency = secondPower!.average / secondHeartRate!.average;
  if (!Number.isFinite(firstEfficiency) || !Number.isFinite(secondEfficiency) || firstEfficiency <= 0) return null;
  return (firstEfficiency - secondEfficiency) / firstEfficiency * 100;
}

import type { SensorSample } from "@/lib/activity-files/types";
import { attributes, parseAppleDate } from "./xml-parser";

export type AppleHealthWorkoutSport = "running" | "strength" | "volleyball";

export type AppleHealthWorkout = {
  activityType: string;
  sportType: AppleHealthWorkoutSport;
  title: string;
  sourceName: string | null;
  startTime: string;
  endTime: string;
  movingTimeSeconds: number;
  elapsedTimeSeconds: number;
  distanceMeters: number;
  energyKilocalories: number | null;
};

export type AppleHealthWorkoutExtraction = {
  workouts: AppleHealthWorkout[];
  ignoredCyclingCount: number;
};

export type AppleHealthWorkoutPayload = AppleHealthWorkout & {
  heartRateSamples: SensorSample[];
};

const supportedTypes: Record<string, { sportType: AppleHealthWorkoutSport; title: string }> = {
  HKWorkoutActivityTypeRunning: { sportType: "running", title: "Lauf" },
  HKWorkoutActivityTypeTraditionalStrengthTraining: { sportType: "strength", title: "Krafttraining" },
  HKWorkoutActivityTypeFunctionalStrengthTraining: { sportType: "strength", title: "Funktionelles Krafttraining" },
  HKWorkoutActivityTypeCoreTraining: { sportType: "strength", title: "Core-Training" },
  HKWorkoutActivityTypeVolleyball: { sportType: "volleyball", title: "Volleyball" },
};

const cyclingTypes = new Set([
  "HKWorkoutActivityTypeCycling",
  "HKWorkoutActivityTypeHandCycling",
]);

function durationSeconds(value: string | undefined, unit: string | undefined): number | null {
  const duration = Number(value);
  if (!Number.isFinite(duration) || duration <= 0) return null;
  if (unit === "s" || unit === "sec") return duration;
  if (unit === "h" || unit === "hr") return duration * 3600;
  return duration * 60;
}

function distanceMeters(value: string | undefined, unit: string | undefined): number {
  const distance = Number(value);
  if (!Number.isFinite(distance) || distance <= 0) return 0;
  if (unit === "m") return distance;
  if (unit === "mi") return distance * 1609.344;
  return distance * 1000;
}

function energyKilocalories(value: string | undefined, unit: string | undefined): number | null {
  const energy = Number(value);
  if (!Number.isFinite(energy) || energy <= 0) return null;
  return unit === "kJ" ? energy / 4.184 : energy;
}

export function appleHealthSport(activityType: string): AppleHealthWorkoutSport | null {
  return supportedTypes[activityType]?.sportType ?? null;
}

export function isAppleHealthCycling(activityType: string): boolean {
  return cyclingTypes.has(activityType);
}

export function appleHealthWorkoutExternalId(activityType: string, startTime: string, endTime: string): string {
  return `${activityType}:${new Date(startTime).toISOString()}:${new Date(endTime).toISOString()}`;
}

export class AppleHealthWorkoutParser {
  private readonly decoder = new TextDecoder();
  private readonly workouts = new Map<string, AppleHealthWorkout>();
  private ignoredCyclingCount = 0;
  private buffer = "";

  push(chunk: Uint8Array, final = false): void {
    this.buffer += this.decoder.decode(chunk, { stream: !final });
    const tagPattern = /<[^>]+>/g;
    let lastCompleteTagEnd = 0;
    for (const match of this.buffer.matchAll(tagPattern)) {
      lastCompleteTagEnd = (match.index ?? 0) + match[0].length;
      if (!match[0].startsWith("<Workout")) continue;
      const fields = attributes(match[0]);
      const activityType = fields.workoutActivityType ?? "";
      if (isAppleHealthCycling(activityType)) {
        this.ignoredCyclingCount += 1;
        continue;
      }
      const supported = supportedTypes[activityType];
      if (!supported) continue;
      const start = parseAppleDate(fields.startDate ?? "");
      const end = parseAppleDate(fields.endDate ?? "");
      if (!start || !end || end <= start) continue;
      const elapsedTimeSeconds = Math.round((end.getTime() - start.getTime()) / 1000);
      const recordedDuration = durationSeconds(fields.duration, fields.durationUnit);
      const movingTimeSeconds = Math.max(1, Math.min(elapsedTimeSeconds, Math.round(recordedDuration ?? elapsedTimeSeconds)));
      const workout: AppleHealthWorkout = {
        activityType,
        sportType: supported.sportType,
        title: supported.title,
        sourceName: fields.sourceName?.slice(0, 200) || null,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        movingTimeSeconds,
        elapsedTimeSeconds,
        distanceMeters: supported.sportType === "running" ? distanceMeters(fields.totalDistance, fields.totalDistanceUnit) : 0,
        energyKilocalories: energyKilocalories(fields.totalEnergyBurned, fields.totalEnergyBurnedUnit),
      };
      this.workouts.set(appleHealthWorkoutExternalId(activityType, workout.startTime, workout.endTime), workout);
    }
    if (lastCompleteTagEnd > 0) this.buffer = this.buffer.slice(lastCompleteTagEnd);
    if (this.buffer.length > 65_536) this.buffer = this.buffer.slice(Math.max(0, this.buffer.lastIndexOf("<")));
  }

  result(): AppleHealthWorkoutExtraction {
    return {
      workouts: [...this.workouts.values()].sort((a, b) => a.startTime.localeCompare(b.startTime)),
      ignoredCyclingCount: this.ignoredCyclingCount,
    };
  }
}


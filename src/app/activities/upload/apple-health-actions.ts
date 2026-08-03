"use server";

import { revalidatePath } from "next/cache";
import type { SensorSample } from "@/lib/activity-files/types";
import { appleHealthSport, appleHealthWorkoutExternalId, isAppleHealthCycling, type AppleHealthWorkoutPayload, type AppleHealthWorkoutSport } from "@/lib/apple-health/workout-parser";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export type AppleHealthImportResult = {
  imported: number;
  skippedDuplicates: number;
  activityIds: string[];
  errors: string[];
};

type ValidWorkout = Omit<AppleHealthWorkoutPayload, "sportType" | "heartRateSamples"> & {
  sportType: AppleHealthWorkoutSport;
  heartRateSamples: SensorSample[];
  externalId: string;
};

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null) throw new Error("Ein Workout ist ungültig.");
  return value as Record<string, unknown>;
}

function finiteNumber(value: unknown, minimum: number, maximum: number, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) throw new Error(`${label} ist ungültig.`);
  return value;
}

function validateWorkout(value: unknown): ValidWorkout {
  const row = record(value);
  const activityType = typeof row.activityType === "string" ? row.activityType : "";
  if (isAppleHealthCycling(activityType)) throw new Error("Radfahrten aus Apple Health werden grundsätzlich nicht importiert.");
  const sportType = appleHealthSport(activityType);
  if (!sportType) throw new Error("Diese Apple-Health-Sportart wird nicht unterstützt.");
  const start = new Date(typeof row.startTime === "string" ? row.startTime : "");
  const end = new Date(typeof row.endTime === "string" ? row.endTime : "");
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) throw new Error("Der Workout-Zeitraum ist ungültig.");
  const elapsedTimeSeconds = Math.round((end.getTime() - start.getTime()) / 1000);
  if (elapsedTimeSeconds > 48 * 3600) throw new Error("Das Workout ist ungewöhnlich lang und wurde nicht importiert.");
  const movingTimeSeconds = Math.round(Math.min(elapsedTimeSeconds, finiteNumber(row.movingTimeSeconds, 1, 48 * 3600, "Trainingsdauer")));
  const distanceMeters = sportType === "running" ? finiteNumber(row.distanceMeters, 0, 1_000_000, "Distanz") : 0;
  const rawSamples = Array.isArray(row.heartRateSamples) ? row.heartRateSamples : [];
  if (rawSamples.length > 50_000) throw new Error("Das Workout enthält zu viele Herzfrequenzwerte.");
  const samples = new Map<string, number>();
  for (const item of rawSamples) {
    const sample = record(item);
    const timestamp = new Date(typeof sample.timestamp === "string" ? sample.timestamp : "");
    const bpm = finiteNumber(sample.value, 20, 260, "Herzfrequenz");
    if (Number.isNaN(timestamp.getTime()) || timestamp < start || timestamp > end) throw new Error("Ein Herzfrequenzwert liegt außerhalb des Workouts.");
    samples.set(timestamp.toISOString(), bpm);
  }
  const title = typeof row.title === "string" && row.title.trim() ? row.title.trim().slice(0, 200) : sportType === "running" ? "Lauf" : sportType === "strength" ? "Krafttraining" : "Volleyball";
  const energy = row.energyKilocalories === null ? null : finiteNumber(row.energyKilocalories, 0, 100_000, "Energie");
  return {
    activityType,
    sportType,
    title,
    sourceName: typeof row.sourceName === "string" ? row.sourceName.slice(0, 200) : null,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    movingTimeSeconds,
    elapsedTimeSeconds,
    distanceMeters,
    energyKilocalories: energy,
    heartRateSamples: [...samples.entries()].map(([timestamp, bpm]) => ({ timestamp, value: bpm })).sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
    externalId: appleHealthWorkoutExternalId(activityType, start.toISOString(), end.toISOString()),
  };
}

function average(values: number[]): number | null {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
}

export async function importAppleHealthWorkoutBatch(payloads: unknown): Promise<AppleHealthImportResult> {
  if (!Array.isArray(payloads) || payloads.length === 0 || payloads.length > 10) throw new Error("Pro Speicherschritt sind 1 bis 10 Workouts erlaubt.");
  const workouts = payloads.map(validateWorkout);
  const user = await requireUser();
  const supabase = await createClient();
  if (!supabase) throw new Error("Supabase ist nicht verfügbar.");
  const externalIds = workouts.map((workout) => workout.externalId);
  const { data: existing, error: existingError } = await supabase.from("activities").select("external_id").eq("user_id", user.id).eq("source", "apple_health_workout").in("external_id", externalIds);
  if (existingError) throw new Error(`Duplikate konnten nicht geprüft werden: ${existingError.message}`);
  const known = new Set((existing ?? []).flatMap((row) => typeof row.external_id === "string" ? [row.external_id] : []));
  const result: AppleHealthImportResult = { imported: 0, skippedDuplicates: known.size, activityIds: [], errors: [] };

  for (const workout of workouts) {
    if (known.has(workout.externalId)) continue;
    const heartRates = workout.heartRateSamples.map((sample) => sample.value);
    const activityId = crypto.randomUUID();
    const averageSpeedKmh = workout.sportType === "running" && workout.movingTimeSeconds > 0 ? workout.distanceMeters / 1000 / (workout.movingTimeSeconds / 3600) : null;
    const { error: activityError } = await supabase.from("activities").insert({
      id: activityId,
      user_id: user.id,
      sport_type: workout.sportType,
      activity_date: workout.startTime,
      title: workout.title,
      distance_meters: workout.distanceMeters,
      moving_time_seconds: workout.movingTimeSeconds,
      elapsed_time_seconds: workout.elapsedTimeSeconds,
      elevation_gain_meters: 0,
      average_speed_kmh: averageSpeedKmh,
      average_heart_rate: average(heartRates),
      maximum_heart_rate: heartRates.length ? Math.round(Math.max(...heartRates)) : null,
      average_power: null,
      normalized_power: null,
      source: "apple_health_workout",
      external_id: workout.externalId,
    });
    if (activityError) {
      if (activityError.code === "23505") { result.skippedDuplicates += 1; continue; }
      result.errors.push(`${workout.title} vom ${new Date(workout.startTime).toLocaleDateString("de-DE")}: ${activityError.message}`);
      continue;
    }

    const stream = workout.heartRateSamples.length ? {
      activity_id: activityId,
      user_id: user.id,
      stream_type: "heart_rate",
      source: "apple_watch",
      unit: "bpm",
      sample_count: workout.heartRateSamples.length,
      start_time: workout.heartRateSamples[0].timestamp,
      end_time: workout.heartRateSamples.at(-1)!.timestamp,
      samples: workout.heartRateSamples,
    } : null;
    const [metricsResult, streamResult] = await Promise.all([
      supabase.from("activity_metrics").insert({ activity_id: activityId, user_id: user.id, track_point_count: 0, heart_rate_sample_count: workout.heartRateSamples.length, calculation_version: "apple-health-workout-v1", metrics: { activityType: workout.activityType, sourceName: workout.sourceName, endTime: workout.endTime, energyKilocalories: workout.energyKilocalories } }),
      stream ? supabase.from("activity_streams").insert(stream) : Promise.resolve({ error: null }),
    ]);
    if (metricsResult.error || streamResult.error) {
      await supabase.from("activities").delete().eq("id", activityId).eq("user_id", user.id);
      result.errors.push(`${workout.title} vom ${new Date(workout.startTime).toLocaleDateString("de-DE")}: ${(metricsResult.error ?? streamResult.error)?.message}`);
      continue;
    }
    result.imported += 1;
    result.activityIds.push(activityId);
  }

  revalidatePath("/activities");
  revalidatePath("/dashboard");
  revalidatePath("/plan");
  revalidatePath("/progress");
  return result;
}


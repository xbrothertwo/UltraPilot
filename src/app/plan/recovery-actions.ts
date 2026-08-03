"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { AppleHealthDailyRecovery } from "@/lib/apple-health/recovery-parser";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export type RecoveryImportState = { status: "idle" | "success" | "error"; message: string; imported?: number };

function rating(formData: FormData, name: string): number {
  const value = Number(formData.get(name));
  if (!Number.isInteger(value) || value < 1 || value > 10) throw new Error(`${name} muss zwischen 1 und 10 liegen.`);
  return value;
}

export async function saveDailyReadiness(formData: FormData) {
  const week = formData.get("week");
  const destination = `/plan?${typeof week === "string" ? `week=${week}&` : ""}saved=readiness`;
  try {
    const date = formData.get("date");
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Datum ist ungültig.");
    const notesValue = formData.get("notes");
    const notes = typeof notesValue === "string" ? notesValue.trim() : "";
    if (notes.length > 1000) throw new Error("Notiz ist zu lang.");
    const user = await requireUser();
    const supabase = await createClient();
    if (!supabase) throw new Error("Supabase ist nicht verfügbar.");
    const { error } = await supabase.from("daily_readiness_checkins").upsert({ user_id: user.id, checkin_date: date, sleep_quality: rating(formData, "sleepQuality"), general_fatigue: rating(formData, "generalFatigue"), leg_fatigue: rating(formData, "legFatigue"), motivation: rating(formData, "motivation"), pain_or_illness: formData.get("painOrIllness") === "on", notes: notes || null, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    revalidatePath("/plan");
    revalidatePath("/dashboard");
  } catch (error) {
    redirect(`/plan?${typeof week === "string" ? `week=${week}&` : ""}error=${encodeURIComponent(error instanceof Error ? error.message : "Tagesform konnte nicht gespeichert werden.")}`);
  }
  redirect(destination);
}

function validMetric(value: unknown): value is AppleHealthDailyRecovery {
  if (!value || typeof value !== "object") return false;
  const metric = value as Partial<AppleHealthDailyRecovery>;
  const validMinutes = [metric.asleepMinutes, metric.coreMinutes, metric.deepMinutes, metric.remMinutes, metric.awakeMinutes].every((item) => Number.isInteger(item) && (item ?? -1) >= 0 && (item ?? 1441) <= 1440);
  const validOptionalNumber = (item: number | null | undefined, maximum: number) => item === null || (typeof item === "number" && Number.isFinite(item) && item > 0 && item <= maximum);
  return typeof metric.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(metric.date)
    && typeof metric.sleepStart === "string" && Number.isFinite(new Date(metric.sleepStart).getTime())
    && typeof metric.sleepEnd === "string" && Number.isFinite(new Date(metric.sleepEnd).getTime()) && new Date(metric.sleepEnd) > new Date(metric.sleepStart)
    && validMinutes && Number.isInteger(metric.heartRateSampleCount) && (metric.heartRateSampleCount ?? -1) >= 0
    && Number.isInteger(metric.hrvSampleCount) && (metric.hrvSampleCount ?? -1) >= 0
    && validOptionalNumber(metric.sleepingAverageHeartRate, 300) && validOptionalNumber(metric.sleepingMinimumHeartRate, 300)
    && validOptionalNumber(metric.hrvSdnnMs, 1000) && validOptionalNumber(metric.restingHeartRate, 300);
}

export async function saveAppleHealthRecovery(_previous: RecoveryImportState, formData: FormData): Promise<RecoveryImportState> {
  try {
    const input = formData.get("metricsJson");
    if (typeof input !== "string") throw new Error("Die lokal extrahierten Schlafdaten fehlen.");
    const parsed = JSON.parse(input) as unknown;
    if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > 130 || !parsed.every(validMetric)) throw new Error("Die Schlafdaten sind ungültig oder zu umfangreich.");
    const user = await requireUser();
    const supabase = await createClient();
    if (!supabase) throw new Error("Supabase ist nicht verfügbar.");
    const records = parsed.map((metric) => ({ user_id: user.id, metric_date: metric.date, sleep_start: metric.sleepStart, sleep_end: metric.sleepEnd, asleep_minutes: metric.asleepMinutes, core_minutes: metric.coreMinutes, deep_minutes: metric.deepMinutes, rem_minutes: metric.remMinutes, awake_minutes: metric.awakeMinutes, sleeping_average_heart_rate: metric.sleepingAverageHeartRate, sleeping_minimum_heart_rate: metric.sleepingMinimumHeartRate, heart_rate_sample_count: metric.heartRateSampleCount, hrv_sdnn_ms: metric.hrvSdnnMs, hrv_sample_count: metric.hrvSampleCount, resting_heart_rate: metric.restingHeartRate, imported_at: new Date().toISOString() }));
    const { error } = await supabase.from("apple_health_daily_metrics").upsert(records, { onConflict: "user_id,metric_date" });
    if (error) throw new Error(error.message);
    revalidatePath("/plan");
    revalidatePath("/dashboard");
    return { status: "success", message: `${records.length} Nächte wurden aktualisiert.`, imported: records.length };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Apple Health konnte nicht importiert werden." };
  }
}

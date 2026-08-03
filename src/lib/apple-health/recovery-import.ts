import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppleHealthDailyRecovery } from "./recovery-parser";

export function validAppleHealthMetric(value: unknown): value is AppleHealthDailyRecovery {
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

export async function persistAppleHealthRecovery(supabase: SupabaseClient, userId: string, metrics: unknown, source: "apple_health_export" | "apple_health_shortcut"): Promise<number> {
  if (!Array.isArray(metrics) || metrics.length < 1 || metrics.length > 130 || !metrics.every(validAppleHealthMetric)) throw new Error("Die Schlafdaten sind ungültig oder zu umfangreich.");
  const records = metrics.map((metric) => ({ user_id: userId, metric_date: metric.date, sleep_start: metric.sleepStart, sleep_end: metric.sleepEnd, asleep_minutes: metric.asleepMinutes, core_minutes: metric.coreMinutes, deep_minutes: metric.deepMinutes, rem_minutes: metric.remMinutes, awake_minutes: metric.awakeMinutes, sleeping_average_heart_rate: metric.sleepingAverageHeartRate, sleeping_minimum_heart_rate: metric.sleepingMinimumHeartRate, heart_rate_sample_count: metric.heartRateSampleCount, hrv_sdnn_ms: metric.hrvSdnnMs, hrv_sample_count: metric.hrvSampleCount, resting_heart_rate: metric.restingHeartRate, source, imported_at: new Date().toISOString() }));
  const { error } = await supabase.from("apple_health_daily_metrics").upsert(records, { onConflict: "user_id,metric_date" });
  if (error) throw new Error(error.message);
  return records.length;
}

import { isDemoMode } from "@/lib/demo-data";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import type { DailyReadinessCheckin, DailyRecoveryMetric } from "@/lib/recovery-readiness";

export async function getRecoveryData(from: string, until: string): Promise<{ metrics: DailyRecoveryMetric[]; checkins: DailyReadinessCheckin[]; ready: boolean }> {
  if (isDemoMode) return { metrics: [], checkins: [], ready: false };
  await requireUser();
  const supabase = await createClient();
  if (!supabase) return { metrics: [], checkins: [], ready: false };
  const historyStart = new Date(`${from}T12:00:00Z`); historyStart.setUTCDate(historyStart.getUTCDate() - 28);
  const historyKey = historyStart.toISOString().slice(0, 10);
  const [metricsResult, checkinsResult] = await Promise.all([
    supabase.from("apple_health_daily_metrics").select("metric_date,sleep_start,sleep_end,asleep_minutes,core_minutes,deep_minutes,rem_minutes,awake_minutes,sleeping_average_heart_rate,sleeping_minimum_heart_rate,heart_rate_sample_count,hrv_sdnn_ms,hrv_sample_count,resting_heart_rate").gte("metric_date", historyKey).lte("metric_date", until).order("metric_date"),
    supabase.from("daily_readiness_checkins").select("checkin_date,sleep_quality,general_freshness,leg_freshness,motivation,wellbeing,symptom_level,notes").gte("checkin_date", from).lte("checkin_date", until).order("checkin_date"),
  ]);
  if (metricsResult.error || checkinsResult.error) return { metrics: [], checkins: [], ready: false };
  return {
    ready: true,
    metrics: (metricsResult.data ?? []).map((row) => ({ date: row.metric_date, sleepStart: row.sleep_start, sleepEnd: row.sleep_end, asleepMinutes: row.asleep_minutes, coreMinutes: row.core_minutes, deepMinutes: row.deep_minutes, remMinutes: row.rem_minutes, awakeMinutes: row.awake_minutes, sleepingAverageHeartRate: row.sleeping_average_heart_rate === null ? null : Number(row.sleeping_average_heart_rate), sleepingMinimumHeartRate: row.sleeping_minimum_heart_rate === null ? null : Number(row.sleeping_minimum_heart_rate), heartRateSampleCount: row.heart_rate_sample_count, hrvSdnnMs: row.hrv_sdnn_ms === null ? null : Number(row.hrv_sdnn_ms), hrvSampleCount: row.hrv_sample_count, restingHeartRate: row.resting_heart_rate === null ? null : Number(row.resting_heart_rate) })),
    checkins: (checkinsResult.data ?? []).map((row) => ({ date: row.checkin_date, sleepQuality: row.sleep_quality, generalFreshness: row.general_freshness, legFreshness: row.leg_freshness, motivation: row.motivation, wellbeing: row.wellbeing, symptomLevel: row.symptom_level, notes: row.notes ?? "" })),
  };
}

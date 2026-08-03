import { getActivities } from "@/lib/activities";
import { isDemoMode } from "@/lib/demo-data";
import { createClient } from "@/lib/supabase/server";
import { getTrainingProfile } from "@/lib/training-profile";
import { buildDashboardSummary, type DashboardFeedback, type DashboardNutrition, type DashboardStream } from "@/lib/dashboard-analysis";
import type { SensorSample } from "@/lib/activity-files/types";

function numberValue(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function samples(value: unknown): SensorSample[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((sample) => {
    if (typeof sample !== "object" || sample === null) return [];
    const row = sample as Record<string, unknown>;
    if (typeof row.timestamp !== "string" || typeof row.value !== "number" || !Number.isFinite(row.value) || Number.isNaN(new Date(row.timestamp).getTime())) return [];
    return [{ timestamp: new Date(row.timestamp).toISOString(), value: row.value }];
  });
}

export async function getDashboardSummary(days: 7 | 28 | 90) {
  const allActivities = await getActivities();
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const activities = allActivities.filter((activity) => new Date(activity.activityDate).getTime() >= cutoff);
  const { profile } = await getTrainingProfile();
  if (isDemoMode || activities.length === 0) return buildDashboardSummary(activities, [], [], [], profile);
  const supabase = await createClient();
  if (!supabase) return buildDashboardSummary(activities, [], [], [], profile);
  const ids = activities.map((activity) => activity.id);
  const [nutritionResult, feedbackResult, streamResult] = await Promise.all([
    supabase.from("nutrition_entries").select("activity_id,carbohydrates_grams,fluid_milliliters,sodium_milligrams").in("activity_id", ids),
    supabase.from("subjective_feedback").select("activity_id,perceived_exertion,fatigue,mood").in("activity_id", ids),
    supabase.from("activity_streams").select("activity_id,stream_type,samples").in("activity_id", ids).in("stream_type", ["heart_rate", "power"]),
  ]);
  if (nutritionResult.error || feedbackResult.error || streamResult.error) throw new Error(`Dashboarddaten konnten nicht geladen werden: ${(nutritionResult.error ?? feedbackResult.error ?? streamResult.error)?.message}`);
  const nutrition: DashboardNutrition[] = (nutritionResult.data ?? []).map((row) => ({ activityId: row.activity_id, carbohydratesGrams: numberValue(row.carbohydrates_grams), fluidMilliliters: numberValue(row.fluid_milliliters), sodiumMilligrams: numberValue(row.sodium_milligrams) }));
  const feedback: DashboardFeedback[] = (feedbackResult.data ?? []).map((row) => ({ activityId: row.activity_id, perceivedExertion: row.perceived_exertion, fatigue: row.fatigue, mood: row.mood }));
  const streams: DashboardStream[] = (streamResult.data ?? []).flatMap((row) => {
    if (row.stream_type !== "heart_rate" && row.stream_type !== "power") return [];
    const validSamples = samples(row.samples);
    return validSamples.length ? [{ activityId: row.activity_id, type: row.stream_type, samples: validSamples }] : [];
  });
  return buildDashboardSummary(activities, nutrition, feedback, streams, profile);
}


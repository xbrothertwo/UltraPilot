import type { Activity } from "./demo-data";
import type { SensorSample } from "./activity-files/types";
import { isDemoMode } from "./demo-data";
import { createClient } from "./supabase/server";
import { calculateHeartRateDrift } from "./training-zones";
import type { MissionDrift, MissionFeedback, MissionNutrition } from "./mission-control";

function numeric(value: unknown): number { const parsed = Number(value ?? 0); return Number.isFinite(parsed) ? parsed : 0; }
function samples(value: unknown): SensorSample[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((sample) => {
    if (typeof sample !== "object" || sample === null) return [];
    const row = sample as Record<string, unknown>;
    if (typeof row.timestamp !== "string" || typeof row.value !== "number" || !Number.isFinite(row.value)) return [];
    const date = new Date(row.timestamp); return Number.isNaN(date.getTime()) ? [] : [{ timestamp: date.toISOString(), value: row.value }];
  });
}

export async function getMissionEvidence(activities: Activity[]): Promise<{ nutrition: MissionNutrition[]; feedback: MissionFeedback[]; drifts: MissionDrift[] }> {
  if (isDemoMode || activities.length === 0) return { nutrition: [], feedback: [], drifts: [] };
  const supabase = await createClient();
  if (!supabase) return { nutrition: [], feedback: [], drifts: [] };
  const ids = activities.map((activity) => activity.id);
  const driftIds = [...activities].filter((activity) => activity.sportType === "cycling" && activity.movingTimeSeconds >= 2 * 3600).sort((a, b) => b.movingTimeSeconds - a.movingTimeSeconds).slice(0, 8).map((activity) => activity.id);
  const [nutritionResult, feedbackResult, streamResult] = await Promise.all([
    supabase.from("nutrition_entries").select("activity_id,carbohydrates_grams,fluid_milliliters").in("activity_id", ids),
    supabase.from("subjective_feedback").select("activity_id,stomach_tolerance,perceived_exertion").in("activity_id", ids),
    driftIds.length ? supabase.from("activity_streams").select("activity_id,stream_type,samples").in("activity_id", driftIds).in("stream_type", ["heart_rate", "power"]) : Promise.resolve({ data: [], error: null }),
  ]);
  if (nutritionResult.error || feedbackResult.error) throw new Error(`Mission-Control-Daten konnten nicht geladen werden: ${(nutritionResult.error ?? feedbackResult.error)?.message}`);
  const streamRows = streamResult.error ? [] : streamResult.data ?? [];
  const drifts: MissionDrift[] = driftIds.flatMap((activityId) => {
    const heartRate = streamRows.filter((row) => row.activity_id === activityId && row.stream_type === "heart_rate").map((row) => samples(row.samples)).sort((a, b) => b.length - a.length)[0] ?? [];
    const power = streamRows.filter((row) => row.activity_id === activityId && row.stream_type === "power").map((row) => samples(row.samples)).sort((a, b) => b.length - a.length)[0] ?? [];
    const percent = calculateHeartRateDrift(heartRate, power);
    return percent === null ? [] : [{ activityId, percent }];
  });
  return {
    nutrition: (nutritionResult.data ?? []).map((row) => ({ activityId: row.activity_id, carbohydratesGrams: numeric(row.carbohydrates_grams), fluidMilliliters: numeric(row.fluid_milliliters) })),
    feedback: (feedbackResult.data ?? []).map((row) => ({ activityId: row.activity_id, stomachTolerance: row.stomach_tolerance, perceivedExertion: row.perceived_exertion })),
    drifts,
  };
}

import { getActivities } from "@/lib/activities";
import type { SensorSample } from "@/lib/activity-files/types";
import { isDemoMode } from "@/lib/demo-data";
import { createClient } from "@/lib/supabase/server";
import { getTrainingProfile } from "@/lib/training-profile";
import { calculateActivityLoads, summarizeTrainingLoad, type LoadFeedback, type LoadStream } from "@/lib/training-load";

function samples(value: unknown): SensorSample[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((sample) => {
    if (typeof sample !== "object" || sample === null) return [];
    const row = sample as Record<string, unknown>;
    if (typeof row.timestamp !== "string" || typeof row.value !== "number" || !Number.isFinite(row.value) || Number.isNaN(new Date(row.timestamp).getTime())) return [];
    return [{ timestamp: new Date(row.timestamp).toISOString(), value: row.value }];
  });
}

function todayKey(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export async function getTrainingLoadSummary(days: 7 | 28 | 90) {
  const allActivities = await getActivities();
  const cutoff = Date.now() - (days + 28) * 86_400_000;
  const activities = allActivities.filter((activity) => new Date(activity.activityDate).getTime() >= cutoff);
  const { profile } = await getTrainingProfile();
  if (isDemoMode || activities.length === 0) return summarizeTrainingLoad(calculateActivityLoads(activities, [], [], profile), days, todayKey());
  const supabase = await createClient();
  if (!supabase) return summarizeTrainingLoad(calculateActivityLoads(activities, [], [], profile), days, todayKey());
  const ids = activities.map((activity) => activity.id);
  const [feedbackResult, streamResult] = await Promise.all([
    supabase.from("subjective_feedback").select("activity_id,perceived_exertion").in("activity_id", ids),
    supabase.from("activity_streams").select("activity_id,stream_type,samples").in("activity_id", ids).in("stream_type", ["heart_rate", "power"]),
  ]);
  if (feedbackResult.error || streamResult.error) throw new Error(`Belastungsdaten konnten nicht geladen werden: ${(feedbackResult.error ?? streamResult.error)?.message}`);
  const feedback: LoadFeedback[] = (feedbackResult.data ?? []).map((row) => ({ activityId: row.activity_id, perceivedExertion: row.perceived_exertion }));
  const streams: LoadStream[] = (streamResult.data ?? []).flatMap((row) => {
    if (row.stream_type !== "heart_rate" && row.stream_type !== "power") return [];
    const validSamples = samples(row.samples);
    return validSamples.length ? [{ activityId: row.activity_id, type: row.stream_type, samples: validSamples }] : [];
  });
  return summarizeTrainingLoad(calculateActivityLoads(activities, feedback, streams, profile), days, todayKey());
}

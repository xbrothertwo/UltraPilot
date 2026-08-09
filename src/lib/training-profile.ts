import { isSupabaseConfigured } from "@/lib/supabase/config";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import type { HeartRateZoneMethod, TrainingProfile } from "@/lib/training-zones";

export const emptyTrainingProfile: TrainingProfile = {
  maxHeartRate: null,
  restingHeartRate: null,
  ftpWatts: null,
  thresholdPaceSecondsPerKm: null,
  heartRateZoneMethod: "max_hr",
  customHeartRateBoundaries: null,
  customPowerBoundaries: null,
};

function numberArray(value: unknown, length: number): number[] | null {
  return Array.isArray(value) && value.length === length && value.every((entry) => typeof entry === "number") ? value : null;
}

export async function getTrainingProfile(): Promise<{ profile: TrainingProfile; databaseReady: boolean }> {
  if (!isSupabaseConfigured()) return { profile: emptyTrainingProfile, databaseReady: false };
  await requireUser();
  const supabase = await createClient();
  if (!supabase) return { profile: emptyTrainingProfile, databaseReady: false };
  const { data, error } = await supabase.from("profiles").select("max_heart_rate,resting_heart_rate,ftp_watts,threshold_pace_seconds_per_km,heart_rate_zone_method,custom_heart_rate_boundaries,custom_power_boundaries").maybeSingle();
  if (error || !data) return { profile: emptyTrainingProfile, databaseReady: false };
  const method = data.heart_rate_zone_method;
  return {
    databaseReady: true,
    profile: {
      maxHeartRate: typeof data.max_heart_rate === "number" ? data.max_heart_rate : null,
      restingHeartRate: typeof data.resting_heart_rate === "number" ? data.resting_heart_rate : null,
      ftpWatts: typeof data.ftp_watts === "number" ? data.ftp_watts : null,
      thresholdPaceSecondsPerKm: typeof data.threshold_pace_seconds_per_km === "number" ? data.threshold_pace_seconds_per_km : null,
      heartRateZoneMethod: method === "heart_rate_reserve" || method === "manual" ? method as HeartRateZoneMethod : "max_hr",
      customHeartRateBoundaries: numberArray(data.custom_heart_rate_boundaries, 4),
      customPowerBoundaries: numberArray(data.custom_power_boundaries, 6),
    },
  };
}


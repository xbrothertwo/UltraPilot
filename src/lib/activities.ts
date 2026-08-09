import type { Activity } from "@/lib/demo-data";
import { demoActivity } from "@/lib/demo-data";
import { requireUser } from "@/lib/supabase/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { ActivitySportType } from "@/lib/sports";

export type ActivityRow = {
  id: string;
  user_id: string;
  sport_type: ActivitySportType;
  activity_date: string;
  title: string;
  distance_meters: number;
  moving_time_seconds: number;
  elapsed_time_seconds: number;
  elevation_gain_meters: number;
  average_speed_kmh: number | null;
  average_heart_rate: number | null;
  maximum_heart_rate: number | null;
  average_power: number | null;
  normalized_power: number | null;
  source: string;
  created_at: string;
};

const activityColumns = "id,user_id,sport_type,activity_date,title,distance_meters,moving_time_seconds,elapsed_time_seconds,elevation_gain_meters,average_speed_kmh,average_heart_rate,maximum_heart_rate,average_power,normalized_power,source,created_at";

export function mapActivityRow(row: ActivityRow): Activity {
  return {
    id: row.id,
    userId: row.user_id,
    sportType: row.sport_type,
    activityDate: row.activity_date,
    title: row.title,
    distanceMeters: row.distance_meters,
    movingTimeSeconds: row.moving_time_seconds,
    elapsedTimeSeconds: row.elapsed_time_seconds,
    elevationGainMeters: row.elevation_gain_meters,
    averageSpeedKmh: row.average_speed_kmh,
    averageHeartRate: row.average_heart_rate,
    maximumHeartRate: row.maximum_heart_rate,
    averagePower: row.average_power,
    normalizedPower: row.normalized_power,
    source: row.source,
    createdAt: row.created_at,
  };
}

export async function getActivities(): Promise<Activity[]> {
  if (!isSupabaseConfigured()) return [demoActivity];
  await requireUser();
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase.from("activities").select(activityColumns).order("activity_date", { ascending: false });
  if (error) throw new Error(`Aktivitäten konnten nicht geladen werden: ${error.message}`);
  return (data as ActivityRow[]).map(mapActivityRow);
}

export async function getActivityById(id: string): Promise<Activity | null> {
  if (!isSupabaseConfigured()) return id === demoActivity.id ? demoActivity : null;
  await requireUser();
  const supabase = await createClient();
  if (!supabase) return null;
  const { data, error } = await supabase.from("activities").select(activityColumns).eq("id", id).maybeSingle();
  if (error) throw new Error(`Aktivität konnte nicht geladen werden: ${error.message}`);
  return data ? mapActivityRow(data as ActivityRow) : null;
}

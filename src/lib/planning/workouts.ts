import { isDemoMode } from "@/lib/demo-data";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export type PlannedWorkout = {
  id: string;
  scheduledDate: string;
  sportType: "cycling" | "running" | "strength" | "volleyball" | "mobility" | "recovery" | "other";
  title: string;
  description: string | null;
  personalNote: string | null;
  intensity: "recovery" | "easy" | "endurance" | "tempo" | "threshold" | "vo2" | "strength";
  plannedDurationMinutes: number | null;
  plannedDistanceKm: number | null;
  status: "planned" | "completed" | "skipped";
  linkedActivityId: string | null;
  source: "manual" | "automatic";
  generationId: string | null;
  locked: boolean;
  preferredStartTime: string | null;
  targetHeartRateZone: string | null;
  targetPowerZone: string | null;
  gymProgramDayId?: string | null;
  gymExerciseCount?: number | null;
};

export type PlanGeneration = { summary: string; caution: string | null; createdAt: string };

export async function getPlannedWorkouts(from: string, until: string): Promise<PlannedWorkout[]> {
  if (isDemoMode) return [];
  await requireUser();
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase.from("planned_workouts").select("id,scheduled_date,sport_type,title,description,personal_note,intensity,planned_duration_minutes,planned_distance_km,status,linked_activity_id,source,generation_id,locked,preferred_start_time,target_heart_rate_zone,target_power_zone,gym_program_day_id").gte("scheduled_date", from).lte("scheduled_date", until).order("scheduled_date");
  if (error) return [];
  const gymDayIds = [...new Set((data ?? []).flatMap((row) => row.gym_program_day_id ? [row.gym_program_day_id] : []))];
  const { data: gymExercises } = gymDayIds.length
    ? await supabase.from("gym_program_exercises").select("program_day_id").in("program_day_id", gymDayIds)
    : { data: [] };
  const gymCounts = new Map<string, number>();
  for (const row of gymExercises ?? []) gymCounts.set(row.program_day_id, (gymCounts.get(row.program_day_id) ?? 0) + 1);
  return (data ?? []).map((row) => ({
    id: row.id,
    scheduledDate: row.scheduled_date,
    sportType: row.sport_type,
    title: row.title,
    description: row.description,
    personalNote: row.personal_note,
    intensity: row.intensity,
    plannedDurationMinutes: row.planned_duration_minutes,
    plannedDistanceKm: row.planned_distance_km === null ? null : Number(row.planned_distance_km),
    status: row.status,
    linkedActivityId: row.linked_activity_id,
    source: row.source,
    generationId: row.generation_id,
    locked: row.locked,
    preferredStartTime: typeof row.preferred_start_time === "string" ? row.preferred_start_time.slice(0, 5) : null,
    targetHeartRateZone: row.target_heart_rate_zone,
    targetPowerZone: row.target_power_zone,
    gymProgramDayId: row.gym_program_day_id,
    gymExerciseCount: row.gym_program_day_id ? gymCounts.get(row.gym_program_day_id) ?? 0 : null,
  }));
}

export async function getLatestPlanGeneration(week: string): Promise<PlanGeneration | null> {
  if (isDemoMode) return null;
  await requireUser();
  const supabase = await createClient();
  if (!supabase) return null;
  const { data, error } = await supabase.from("training_plan_generations").select("summary,caution,created_at").eq("week_start", week).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error(`Planbegründung konnte nicht geladen werden: ${error.message}`);
  return data ? { summary: data.summary, caution: data.caution, createdAt: data.created_at } : null;
}

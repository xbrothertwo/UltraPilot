import { isDemoMode } from "@/lib/demo-data";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import type { BlockPhase } from "./block-generator";

export type TrainingBlockWeek = { id: string; weekNumber: number; weekStart: string; phase: BlockPhase; targetDistanceKm: number; longRideTargetKm: number; tempoSessionTarget: number; purpose: string };
export type TrainingBlock = { id: string; name: string; startDate: string; endDate: string; baseWeeklyDistanceKm: number; startingLongRideKm: number; recoveryWeekPercentage: number; status: "active" | "completed" | "archived"; weeks: TrainingBlockWeek[] };

export async function getActiveTrainingBlock(): Promise<TrainingBlock | null> {
  if (isDemoMode) return null;
  await requireUser();
  const supabase = await createClient();
  if (!supabase) return null;
  const { data: block, error } = await supabase.from("training_blocks").select("id,name,start_date,end_date,base_weekly_distance_km,starting_long_ride_km,recovery_week_percentage,status").eq("status", "active").maybeSingle();
  if (error) throw new Error(`Trainingsblock konnte nicht geladen werden: ${error.message}`);
  if (!block) return null;
  const { data: weeks, error: weeksError } = await supabase.from("training_block_weeks").select("id,week_number,week_start,phase,target_distance_km,long_ride_target_km,tempo_session_target,purpose").eq("block_id", block.id).order("week_number");
  if (weeksError) throw new Error(`Blockwochen konnten nicht geladen werden: ${weeksError.message}`);
  return {
    id: block.id, name: block.name, startDate: block.start_date, endDate: block.end_date, baseWeeklyDistanceKm: Number(block.base_weekly_distance_km), startingLongRideKm: Number(block.starting_long_ride_km), recoveryWeekPercentage: block.recovery_week_percentage, status: block.status,
    weeks: (weeks ?? []).map((week) => ({ id: week.id, weekNumber: week.week_number, weekStart: week.week_start, phase: week.phase, targetDistanceKm: Number(week.target_distance_km), longRideTargetKm: Number(week.long_ride_target_km), tempoSessionTarget: week.tempo_session_target, purpose: week.purpose })),
  };
}

export function blockWeekForDate(block: TrainingBlock | null, weekStart: string): TrainingBlockWeek | null {
  return block?.weeks.find((week) => week.weekStart === weekStart) ?? null;
}

import { isDemoMode } from "@/lib/demo-data";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import type { BlockPhase, BlockSport } from "./block-generator";

export type TrainingBlockWeek = { id: string; weekNumber: number; weekStart: string; phase: BlockPhase; targetDistanceKm: number; longRideTargetKm: number; tempoSessionTarget: number; purpose: string };
export type TrainingBlockStatus = "active" | "paused" | "completed" | "archived";
export type TrainingBlock = { id: string; name: string; sportType: BlockSport; goal: string | null; startDate: string; endDate: string; weekCount: number; baseWeeklyDistanceKm: number; startingLongRideKm: number; recoveryWeekPercentage: number; status: TrainingBlockStatus; weeks: TrainingBlockWeek[] };

const BLOCK_COLUMNS = "id,name,sport_type,goal,start_date,end_date,week_count,base_weekly_distance_km,starting_long_ride_km,recovery_week_percentage,status";
const WEEK_COLUMNS = "id,week_number,week_start,phase,target_distance_km,long_ride_target_km,tempo_session_target,purpose";

function mapBlock(block: Record<string, unknown>, weeks: Record<string, unknown>[]): TrainingBlock {
  return {
    id: block.id as string,
    name: block.name as string,
    sportType: block.sport_type as BlockSport,
    goal: (block.goal as string | null) ?? null,
    startDate: block.start_date as string,
    endDate: block.end_date as string,
    weekCount: block.week_count as number,
    baseWeeklyDistanceKm: Number(block.base_weekly_distance_km),
    startingLongRideKm: Number(block.starting_long_ride_km),
    recoveryWeekPercentage: block.recovery_week_percentage as number,
    status: block.status as TrainingBlockStatus,
    weeks: weeks.map((week) => ({ id: week.id as string, weekNumber: week.week_number as number, weekStart: week.week_start as string, phase: week.phase as BlockPhase, targetDistanceKm: Number(week.target_distance_km), longRideTargetKm: Number(week.long_ride_target_km), tempoSessionTarget: week.tempo_session_target as number, purpose: week.purpose as string })),
  };
}

// Active or paused: the block still "in flight" for management/display purposes.
export async function getCurrentTrainingBlock(): Promise<TrainingBlock | null> {
  if (isDemoMode) return null;
  await requireUser();
  const supabase = await createClient();
  if (!supabase) return null;
  const { data: block, error } = await supabase.from("training_blocks").select(BLOCK_COLUMNS).in("status", ["active", "paused"]).maybeSingle();
  if (error || !block) return null;
  const { data: weeks, error: weeksError } = await supabase.from("training_block_weeks").select(WEEK_COLUMNS).eq("block_id", block.id).order("week_number");
  if (weeksError) return null;
  return mapBlock(block, weeks ?? []);
}

export function blockWeekForDate(block: TrainingBlock | null, weekStart: string): TrainingBlockWeek | null {
  return block?.weeks.find((week) => week.weekStart === weekStart) ?? null;
}

// Any status, including completed/archived: for the block detail page, read access isn't limited to "in flight" blocks.
export async function getTrainingBlockById(id: string): Promise<TrainingBlock | null> {
  if (isDemoMode) return null;
  await requireUser();
  const supabase = await createClient();
  if (!supabase) return null;
  const { data: block, error } = await supabase.from("training_blocks").select(BLOCK_COLUMNS).eq("id", id).maybeSingle();
  if (error || !block) return null;
  const { data: weeks, error: weeksError } = await supabase.from("training_block_weeks").select(WEEK_COLUMNS).eq("block_id", block.id).order("week_number");
  if (weeksError) return null;
  return mapBlock(block, weeks ?? []);
}

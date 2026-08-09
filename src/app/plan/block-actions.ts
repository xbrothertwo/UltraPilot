"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { generateTrainingBlockWeeks, type BlockSport } from "@/lib/planning/block-generator";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

function numberField(formData: FormData, name: string, minimum: number, maximum: number): number {
  const value = Number(String(formData.get(name) ?? "").replace(",", "."));
  if (!Number.isFinite(value) || value < minimum || value > maximum) throw new Error(`${name} ist ungültig.`);
  return value;
}

function blockName(formData: FormData): string {
  const nameValue = formData.get("name");
  const name = typeof nameValue === "string" ? nameValue.trim() : "";
  if (!name || name.length > 120) throw new Error("Bitte gib einen gültigen Blocknamen ein.");
  return name;
}

function sportType(formData: FormData): BlockSport {
  const value = formData.get("sportType");
  if (value === "cycling" || value === "running") return value;
  throw new Error("Bitte wähle eine Hauptsportart aus.");
}

function optionalGoal(formData: FormData): string | null {
  const value = formData.get("goal");
  if (typeof value !== "string" || !value.trim()) return null;
  const goal = value.trim();
  if (goal.length > 500) throw new Error("Das Blockziel darf höchstens 500 Zeichen lang sein.");
  return goal;
}

function destination(formData: FormData, query: string): string {
  const week = formData.get("selectedWeek");
  return `/plan?${typeof week === "string" && /^\d{4}-\d{2}-\d{2}$/.test(week) ? `week=${week}&` : ""}${query}`;
}

async function requireBlockOwner(supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>, userId: string, id: string) {
  const { data: block, error } = await supabase.from("training_blocks").select("id,status").eq("id", id).eq("user_id", userId).maybeSingle();
  if (error || !block) throw new Error(error?.message ?? "Trainingsblock wurde nicht gefunden.");
  return block;
}

export async function createTrainingBlock(formData: FormData) {
  let target = destination(formData, "saved=block");
  try {
    const name = blockName(formData);
    const sport = sportType(formData);
    const goal = optionalGoal(formData);
    const weekCount = Math.round(numberField(formData, "weekCount", 2, 16));
    const startDateValue = formData.get("startDate");
    if (typeof startDateValue !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(startDateValue)) throw new Error("Startdatum ist ungültig.");
    const startDate = new Date(`${startDateValue}T12:00:00Z`);
    if (Number.isNaN(startDate.getTime()) || startDate.getUTCDay() !== 1) throw new Error("Ein Trainingsblock muss an einem Montag beginnen.");
    const weeklyDistanceKm = numberField(formData, "weeklyDistanceKm", 20, 2000);
    const startingLongRideKm = numberField(formData, "startingLongRideKm", 10, Math.min(1000, weeklyDistanceKm));
    const recoveryWeekPercentage = numberField(formData, "recoveryWeekPercentage", 60, 100);
    const weeks = generateTrainingBlockWeeks({ startDate: startDateValue, sportType: sport, weekCount, weeklyDistanceKm, startingLongRideKm, recoveryWeekPercentage });
    const endDate = new Date(startDate); endDate.setUTCDate(endDate.getUTCDate() + weekCount * 7 - 1);
    const user = await requireUser();
    const supabase = await createClient();
    if (!supabase) throw new Error("Supabase ist nicht verfügbar.");
    const { data: existing } = await supabase.from("training_blocks").select("id").in("status", ["active", "paused"]).maybeSingle();
    if (existing) throw new Error("Es ist bereits ein aktiver oder pausierter Trainingsblock vorhanden. Schließe oder lösche ihn zuerst.");
    const { data: block, error } = await supabase.from("training_blocks").insert({ user_id: user.id, name, sport_type: sport, goal, week_count: weekCount, start_date: startDateValue, end_date: endDate.toISOString().slice(0, 10), base_weekly_distance_km: weeklyDistanceKm, starting_long_ride_km: startingLongRideKm, recovery_week_percentage: recoveryWeekPercentage }).select("id").single();
    if (error || !block) throw new Error(error?.message ?? "Trainingsblock konnte nicht gespeichert werden.");
    const { error: weeksError } = await supabase.from("training_block_weeks").insert(weeks.map((week) => ({ block_id: block.id, user_id: user.id, week_number: week.weekNumber, week_start: week.weekStart, phase: week.phase, target_distance_km: week.targetDistanceKm, long_ride_target_km: week.longRideTargetKm, tempo_session_target: week.tempoSessionTarget, purpose: week.purpose })));
    if (weeksError) { await supabase.from("training_blocks").delete().eq("id", block.id); throw new Error(weeksError.message); }
    revalidatePath("/plan");
  } catch (error) {
    target = destination(formData, `error=${encodeURIComponent(error instanceof Error ? error.message : "Trainingsblock konnte nicht erstellt werden.")}`);
  }
  redirect(target);
}

export async function renameTrainingBlock(formData: FormData) {
  let target = destination(formData, "saved=block-renamed");
  try {
    const id = formData.get("id");
    if (typeof id !== "string" || !id) throw new Error("Trainingsblock fehlt.");
    const name = blockName(formData);
    const user = await requireUser();
    const supabase = await createClient();
    if (!supabase) throw new Error("Supabase ist nicht verfügbar.");
    const { error } = await supabase.from("training_blocks").update({ name }).eq("id", id).eq("user_id", user.id);
    if (error) throw new Error(error.message);
    revalidatePath("/plan");
  } catch (error) {
    target = destination(formData, `error=${encodeURIComponent(error instanceof Error ? error.message : "Trainingsblock konnte nicht umbenannt werden.")}`);
  }
  redirect(target);
}

export async function pauseTrainingBlock(formData: FormData) {
  let target = destination(formData, "saved=block-paused");
  try {
    const id = formData.get("id");
    if (typeof id !== "string" || !id) throw new Error("Trainingsblock fehlt.");
    const user = await requireUser();
    const supabase = await createClient();
    if (!supabase) throw new Error("Supabase ist nicht verfügbar.");
    const { data, error } = await supabase.from("training_blocks").update({ status: "paused" }).eq("id", id).eq("user_id", user.id).eq("status", "active").select("id").maybeSingle();
    if (error || !data) throw new Error(error?.message ?? "Aktiver Trainingsblock wurde nicht gefunden.");
    revalidatePath("/plan");
  } catch (error) {
    target = destination(formData, `error=${encodeURIComponent(error instanceof Error ? error.message : "Trainingsblock konnte nicht pausiert werden.")}`);
  }
  redirect(target);
}

export async function resumeTrainingBlock(formData: FormData) {
  let target = destination(formData, "saved=block-resumed");
  try {
    const id = formData.get("id");
    if (typeof id !== "string" || !id) throw new Error("Trainingsblock fehlt.");
    const user = await requireUser();
    const supabase = await createClient();
    if (!supabase) throw new Error("Supabase ist nicht verfügbar.");
    const { data, error } = await supabase.from("training_blocks").update({ status: "active" }).eq("id", id).eq("user_id", user.id).eq("status", "paused").select("id").maybeSingle();
    if (error || !data) throw new Error(error?.message ?? "Pausierter Trainingsblock wurde nicht gefunden.");
    revalidatePath("/plan");
  } catch (error) {
    target = destination(formData, `error=${encodeURIComponent(error instanceof Error ? error.message : "Trainingsblock konnte nicht fortgesetzt werden.")}`);
  }
  redirect(target);
}

export async function completeTrainingBlock(formData: FormData) {
  let target = destination(formData, "saved=block-completed");
  try {
    const id = formData.get("id");
    if (typeof id !== "string" || !id) throw new Error("Trainingsblock fehlt.");
    const user = await requireUser();
    const supabase = await createClient();
    if (!supabase) throw new Error("Supabase ist nicht verfügbar.");
    const { data, error } = await supabase.from("training_blocks").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id).in("status", ["active", "paused"]).select("id").maybeSingle();
    if (error || !data) throw new Error(error?.message ?? "Trainingsblock wurde nicht gefunden.");
    revalidatePath("/plan");
  } catch (error) {
    target = destination(formData, `error=${encodeURIComponent(error instanceof Error ? error.message : "Trainingsblock konnte nicht abgeschlossen werden.")}`);
  }
  redirect(target);
}

export async function deleteTrainingBlock(formData: FormData) {
  let target = destination(formData, "saved=block-deleted");
  try {
    const id = formData.get("id");
    if (typeof id !== "string" || !id) throw new Error("Trainingsblock fehlt.");
    const user = await requireUser();
    const supabase = await createClient();
    if (!supabase) throw new Error("Supabase ist nicht verfügbar.");
    await requireBlockOwner(supabase, user.id, id);
    const { error } = await supabase.from("training_blocks").delete().eq("id", id).eq("user_id", user.id);
    if (error) throw new Error(error.message);
    revalidatePath("/plan");
  } catch (error) {
    target = destination(formData, `error=${encodeURIComponent(error instanceof Error ? error.message : "Trainingsblock konnte nicht gelöscht werden.")}`);
  }
  redirect(target);
}

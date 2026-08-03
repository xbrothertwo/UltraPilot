"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { generateFourWeekBlock } from "@/lib/planning/block-generator";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

function numberField(formData: FormData, name: string, minimum: number, maximum: number): number {
  const value = Number(String(formData.get(name) ?? "").replace(",", "."));
  if (!Number.isFinite(value) || value < minimum || value > maximum) throw new Error(`${name} ist ungültig.`);
  return value;
}

function destination(formData: FormData, query: string): string {
  const week = formData.get("selectedWeek");
  return `/plan?${typeof week === "string" && /^\d{4}-\d{2}-\d{2}$/.test(week) ? `week=${week}&` : ""}${query}`;
}

export async function createTrainingBlock(formData: FormData) {
  let target = destination(formData, "saved=block");
  try {
    const nameValue = formData.get("name");
    const name = typeof nameValue === "string" ? nameValue.trim() : "";
    if (!name || name.length > 120) throw new Error("Bitte gib einen gültigen Blocknamen ein.");
    const startDateValue = formData.get("startDate");
    if (typeof startDateValue !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(startDateValue)) throw new Error("Startdatum ist ungültig.");
    const startDate = new Date(`${startDateValue}T12:00:00Z`);
    if (Number.isNaN(startDate.getTime()) || startDate.getUTCDay() !== 1) throw new Error("Ein Trainingsblock muss an einem Montag beginnen.");
    const weeklyDistanceKm = numberField(formData, "weeklyDistanceKm", 20, 2000);
    const startingLongRideKm = numberField(formData, "startingLongRideKm", 10, Math.min(1000, weeklyDistanceKm));
    const recoveryWeekPercentage = numberField(formData, "recoveryWeekPercentage", 60, 100);
    const weeks = generateFourWeekBlock({ startDate: startDateValue, weeklyDistanceKm, startingLongRideKm, recoveryWeekPercentage });
    const endDate = new Date(startDate); endDate.setUTCDate(endDate.getUTCDate() + 27);
    const user = await requireUser();
    const supabase = await createClient();
    if (!supabase) throw new Error("Supabase ist nicht verfügbar.");
    const { data: active } = await supabase.from("training_blocks").select("id").eq("status", "active").maybeSingle();
    if (active) throw new Error("Es ist bereits ein aktiver Trainingsblock vorhanden. Schließe ihn zuerst ab.");
    const { data: block, error } = await supabase.from("training_blocks").insert({ user_id: user.id, name, start_date: startDateValue, end_date: endDate.toISOString().slice(0, 10), base_weekly_distance_km: weeklyDistanceKm, starting_long_ride_km: startingLongRideKm, recovery_week_percentage: recoveryWeekPercentage }).select("id").single();
    if (error || !block) throw new Error(error?.message ?? "Trainingsblock konnte nicht gespeichert werden.");
    const { error: weeksError } = await supabase.from("training_block_weeks").insert(weeks.map((week) => ({ block_id: block.id, user_id: user.id, week_number: week.weekNumber, week_start: week.weekStart, phase: week.phase, target_distance_km: week.targetDistanceKm, long_ride_target_km: week.longRideTargetKm, tempo_session_target: week.tempoSessionTarget, purpose: week.purpose })));
    if (weeksError) { await supabase.from("training_blocks").delete().eq("id", block.id); throw new Error(weeksError.message); }
    revalidatePath("/plan");
  } catch (error) {
    target = destination(formData, `error=${encodeURIComponent(error instanceof Error ? error.message : "Trainingsblock konnte nicht erstellt werden.")}`);
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
    const { data, error } = await supabase.from("training_blocks").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id).eq("status", "active").select("id").maybeSingle();
    if (error || !data) throw new Error(error?.message ?? "Aktiver Trainingsblock wurde nicht gefunden.");
    revalidatePath("/plan");
  } catch (error) {
    target = destination(formData, `error=${encodeURIComponent(error instanceof Error ? error.message : "Trainingsblock konnte nicht abgeschlossen werden.")}`);
  }
  redirect(target);
}

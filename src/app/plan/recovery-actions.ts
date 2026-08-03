"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { persistAppleHealthRecovery } from "@/lib/apple-health/recovery-import";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export type RecoveryImportState = { status: "idle" | "success" | "error"; message: string; imported?: number };

function rating(formData: FormData, name: string): number {
  const value = Number(formData.get(name));
  if (!Number.isInteger(value) || value < 1 || value > 10) throw new Error(`${name} muss zwischen 1 und 10 liegen.`);
  return value;
}

export async function saveDailyReadiness(formData: FormData) {
  const week = formData.get("week");
  const destination = `/plan?${typeof week === "string" ? `week=${week}&` : ""}saved=readiness`;
  try {
    const date = formData.get("date");
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Datum ist ungültig.");
    const notesValue = formData.get("notes");
    const notes = typeof notesValue === "string" ? notesValue.trim() : "";
    if (notes.length > 1000) throw new Error("Notiz ist zu lang.");
    const user = await requireUser();
    const supabase = await createClient();
    if (!supabase) throw new Error("Supabase ist nicht verfügbar.");
    const { error } = await supabase.from("daily_readiness_checkins").upsert({ user_id: user.id, checkin_date: date, sleep_quality: rating(formData, "sleepQuality"), general_fatigue: rating(formData, "generalFatigue"), leg_fatigue: rating(formData, "legFatigue"), motivation: rating(formData, "motivation"), pain_or_illness: formData.get("painOrIllness") === "on", notes: notes || null, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    revalidatePath("/plan");
    revalidatePath("/dashboard");
  } catch (error) {
    redirect(`/plan?${typeof week === "string" ? `week=${week}&` : ""}error=${encodeURIComponent(error instanceof Error ? error.message : "Tagesform konnte nicht gespeichert werden.")}`);
  }
  redirect(destination);
}

export async function saveAppleHealthRecovery(_previous: RecoveryImportState, formData: FormData): Promise<RecoveryImportState> {
  try {
    const input = formData.get("metricsJson");
    if (typeof input !== "string") throw new Error("Die lokal extrahierten Schlafdaten fehlen.");
    const parsed = JSON.parse(input) as unknown;
    const user = await requireUser();
    const supabase = await createClient();
    if (!supabase) throw new Error("Supabase ist nicht verfügbar.");
    const imported = await persistAppleHealthRecovery(supabase, user.id, parsed, "apple_health_export");
    revalidatePath("/plan");
    revalidatePath("/dashboard");
    return { status: "success", message: `${imported} Nächte wurden aktualisiert.`, imported };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Apple Health konnte nicht importiert werden." };
  }
}

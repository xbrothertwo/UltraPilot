"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import type { HeartRateZoneMethod } from "@/lib/training-zones";

function optionalInteger(formData: FormData, name: string, minimum: number, maximum: number): number | null {
  const raw = formData.get(name);
  if (typeof raw !== "string" || raw.trim() === "") return null;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < minimum || value > maximum) throw new Error(`${name} ist ungültig.`);
  return value;
}

function boundaries(formData: FormData, prefix: string, count: number, maximum: number): number[] | null {
  const values = Array.from({ length: count }, (_, index) => optionalInteger(formData, `${prefix}${index + 1}`, 1, maximum));
  if (values.every((value) => value === null)) return null;
  if (values.some((value) => value === null)) throw new Error("Bitte alle manuellen Zonengrenzen ausfüllen oder alle leer lassen.");
  const numbers = values as number[];
  if (numbers.some((value, index) => index > 0 && value <= numbers[index - 1])) throw new Error("Zonengrenzen müssen streng ansteigen.");
  return numbers;
}

export async function saveTrainingSettings(formData: FormData) {
  try {
    const user = await requireUser();
    const supabase = await createClient();
    if (!supabase) throw new Error("Supabase ist nicht konfiguriert.");
    const methodValue = formData.get("heartRateZoneMethod");
    const method: HeartRateZoneMethod = methodValue === "heart_rate_reserve" || methodValue === "manual" ? methodValue : "max_hr";
    const maxHeartRate = optionalInteger(formData, "maxHeartRate", 80, 240);
    const restingHeartRate = optionalInteger(formData, "restingHeartRate", 25, 120);
    const ftpWatts = optionalInteger(formData, "ftpWatts", 50, 1000);
    if (maxHeartRate !== null && restingHeartRate !== null && restingHeartRate >= maxHeartRate) throw new Error("Der Ruhepuls muss unter dem Maximalpuls liegen.");
    const heartRateBoundaries = boundaries(formData, "hrBoundary", 4, 240);
    const powerBoundaries = boundaries(formData, "powerBoundary", 6, 1500);
    if (method === "manual" && heartRateBoundaries === null) throw new Error("Für manuelle Herzfrequenzzonen werden vier Grenzen benötigt.");
    const { error } = await supabase.from("profiles").update({
      max_heart_rate: maxHeartRate,
      resting_heart_rate: restingHeartRate,
      ftp_watts: ftpWatts,
      heart_rate_zone_method: method,
      custom_heart_rate_boundaries: heartRateBoundaries,
      custom_power_boundaries: powerBoundaries,
      updated_at: new Date().toISOString(),
    }).eq("id", user.id);
    if (error) throw new Error(error.message);
    revalidatePath("/settings");
    revalidatePath("/activities/[id]", "page");
  } catch (error) {
    redirect(`/settings?error=${encodeURIComponent(error instanceof Error ? error.message : "Einstellungen konnten nicht gespeichert werden.")}`);
  }
  redirect("/settings?saved=1");
}


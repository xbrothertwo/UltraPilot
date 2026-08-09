"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { findDuplicateActivity } from "@/lib/activity-files/duplicate";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

const sports = ["cycling", "running", "strength", "volleyball", "other"] as const;
type ManualSport = (typeof sports)[number];

const defaultTitles: Record<ManualSport, string> = {
  cycling: "Radfahrt",
  running: "Lauf",
  strength: "Krafttraining",
  volleyball: "Volleyball",
  other: "Aktivität",
};

function sportType(formData: FormData): ManualSport {
  const value = formData.get("sportType");
  if (typeof value === "string" && sports.includes(value as ManualSport)) return value as ManualSport;
  throw new Error("Sportart ist ungültig.");
}

function requiredNumber(formData: FormData, name: string, minimum: number, maximum: number, label: string): number {
  const value = Number(String(formData.get(name) ?? "").replace(",", "."));
  if (!Number.isFinite(value) || value < minimum || value > maximum) throw new Error(`${label} ist ungültig.`);
  return value;
}

function optionalNumber(formData: FormData, name: string, minimum: number, maximum: number, label: string): number | null {
  const raw = formData.get(name);
  if (typeof raw !== "string" || raw.trim() === "") return null;
  const value = Number(raw.replace(",", "."));
  if (!Number.isFinite(value) || value < minimum || value > maximum) throw new Error(`${label} ist ungültig.`);
  return value;
}

export async function createManualActivity(formData: FormData) {
  let destination = "/activities/upload?saved=manual";
  try {
    const sport = sportType(formData);
    const dateValue = formData.get("activityDate");
    if (typeof dateValue !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) throw new Error("Datum ist ungültig.");
    const timeValue = formData.get("activityTime");
    const time = typeof timeValue === "string" && /^\d{2}:\d{2}$/.test(timeValue) ? timeValue : "12:00";
    const activityDate = new Date(`${dateValue}T${time}:00`);
    if (Number.isNaN(activityDate.getTime())) throw new Error("Datum oder Startzeit ist ungültig.");

    const durationMinutes = requiredNumber(formData, "duration", 1, 1440, "Dauer");
    const movingTimeSeconds = Math.round(durationMinutes * 60);
    const distanceKm = optionalNumber(formData, "distance", 0, 2000, "Distanz");
    const distanceMeters = distanceKm === null ? 0 : Math.round(distanceKm * 1000);
    const elevationGainMeters = optionalNumber(formData, "elevation", 0, 10_000, "Höhenmeter") ?? 0;
    const averageSpeedKmh = distanceKm !== null && distanceKm > 0 ? distanceKm / (movingTimeSeconds / 3600) : null;

    const titleValue = formData.get("title");
    const title = (typeof titleValue === "string" ? titleValue.trim() : "").slice(0, 200) || defaultTitles[sport];

    const user = await requireUser();
    const supabase = await createClient();
    if (!supabase) throw new Error("Supabase ist nicht verfügbar.");

    const duplicateWindowMs = 3 * 60 * 1000;
    const windowStart = new Date(activityDate.getTime() - duplicateWindowMs).toISOString();
    const windowEnd = new Date(activityDate.getTime() + duplicateWindowMs).toISOString();
    const { data: candidateRows, error: duplicateCheckError } = await supabase
      .from("activities")
      .select("id, activity_date, moving_time_seconds, distance_meters")
      .eq("user_id", user.id)
      .eq("sport_type", sport)
      .gte("activity_date", windowStart)
      .lte("activity_date", windowEnd);
    if (duplicateCheckError) throw new Error(`Duplikate konnten nicht geprüft werden: ${duplicateCheckError.message}`);
    const duplicate = findDuplicateActivity(
      (candidateRows ?? []).map((row) => ({ id: row.id, activityDate: row.activity_date, movingTimeSeconds: row.moving_time_seconds, distanceMeters: row.distance_meters })),
      { startTime: activityDate.toISOString(), movingTimeSeconds, distanceMeters },
    );
    if (duplicate) throw new Error(`Diese Aktivität scheint bereits am ${new Date(duplicate.activityDate).toLocaleDateString("de-DE")} erfasst zu sein.`);

    const { error } = await supabase.from("activities").insert({
      user_id: user.id,
      sport_type: sport,
      activity_date: activityDate.toISOString(),
      title,
      distance_meters: distanceMeters,
      moving_time_seconds: movingTimeSeconds,
      elapsed_time_seconds: movingTimeSeconds,
      elevation_gain_meters: elevationGainMeters,
      average_speed_kmh: averageSpeedKmh,
      source: "manual",
    });
    if (error) throw new Error(`Aktivität konnte nicht gespeichert werden: ${error.message}`);

    revalidatePath("/activities");
    revalidatePath("/dashboard");
    revalidatePath("/plan");
  } catch (error) {
    destination = `/activities/upload?error=${encodeURIComponent(error instanceof Error ? error.message : "Aktivität konnte nicht gespeichert werden.")}`;
  }
  redirect(destination);
}

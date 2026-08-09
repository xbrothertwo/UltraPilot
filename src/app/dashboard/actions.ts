"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adaptWorkoutForLowReadiness } from "@/lib/daily-cockpit";
import type { PlannedWorkout } from "@/lib/planning/workouts";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

function todayKey(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function workoutId(formData: FormData): string {
  const value = formData.get("workoutId");
  if (typeof value !== "string" || !value) throw new Error("Die heutige Einheit fehlt.");
  return value;
}

async function getTodayWorkout(formData: FormData) {
  const id = workoutId(formData);
  const user = await requireUser();
  const supabase = await createClient();
  if (!supabase) throw new Error("Supabase ist nicht verfügbar.");
  const { data, error } = await supabase.from("planned_workouts").select("id,scheduled_date,sport_type,title,description,personal_note,intensity,planned_duration_minutes,planned_distance_km,status,linked_activity_id,source,generation_id,locked,preferred_start_time,target_heart_rate_zone,target_power_zone").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (error || !data) throw new Error(error?.message ?? "Die heutige Einheit wurde nicht gefunden.");
  if (data.scheduled_date !== todayKey() || data.status !== "planned") throw new Error("Diese Aktion gilt nur für eine heute geplante, noch offene Einheit.");
  if (data.source !== "automatic" || (data.sport_type !== "cycling" && data.sport_type !== "running" && data.sport_type !== "strength")) throw new Error("Der Tages-Autopilot passt nur automatisch geplante Ausdauer- und Krafteinheiten an.");
  if (data.locked) throw new Error("Diese Einheit ist gesperrt und wird vom Tages-Autopilot nicht angepasst.");
  const workout: PlannedWorkout = {
    id: data.id,
    scheduledDate: data.scheduled_date,
    sportType: data.sport_type,
    title: data.title,
    description: data.description,
    personalNote: data.personal_note,
    intensity: data.intensity,
    plannedDurationMinutes: data.planned_duration_minutes,
    plannedDistanceKm: data.planned_distance_km === null ? null : Number(data.planned_distance_km),
    status: data.status,
    linkedActivityId: data.linked_activity_id,
    source: data.source,
    generationId: data.generation_id,
    locked: data.locked,
    preferredStartTime: typeof data.preferred_start_time === "string" ? data.preferred_start_time.slice(0, 5) : null,
    targetHeartRateZone: data.target_heart_rate_zone,
    targetPowerZone: data.target_power_zone,
  };
  return { supabase, user, workout };
}

export async function acceptTodayPlan(formData: FormData) {
  let destination = "/dashboard?saved=accepted";
  try {
    await getTodayWorkout(formData);
  } catch (error) {
    destination = `/dashboard?error=${encodeURIComponent(error instanceof Error ? error.message : "Tagesplan konnte nicht bestätigt werden.")}`;
  }
  redirect(destination);
}

export async function adaptTodayForLowReadiness(formData: FormData) {
  let destination = "/dashboard?saved=worse";
  try {
    const { supabase, user, workout } = await getTodayWorkout(formData);
    const adaptation = adaptWorkoutForLowReadiness(workout);
    const { error } = await supabase.from("planned_workouts").update({
      sport_type: adaptation.sportType,
      title: adaptation.title,
      description: adaptation.description,
      intensity: adaptation.intensity,
      planned_duration_minutes: adaptation.plannedDurationMinutes,
      planned_distance_km: adaptation.plannedDistanceKm,
      updated_at: new Date().toISOString(),
    }).eq("id", workout.id).eq("user_id", user.id);
    if (error) throw new Error(error.message);
    revalidatePath("/dashboard");
    revalidatePath("/plan");
  } catch (error) {
    destination = `/dashboard?error=${encodeURIComponent(error instanceof Error ? error.message : "Die heutige Einheit konnte nicht reduziert werden.")}`;
  }
  redirect(destination);
}

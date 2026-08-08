"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

function optionalInteger(
  formData: FormData,
  name: string,
  minimum: number,
  maximum: number,
): number | null {
  const raw = formData.get(name);
  if (typeof raw !== "string" || raw.trim() === "") return null;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < minimum || value > maximum)
    throw new Error(`${name} ist ungültig.`);
  return value;
}

function optionalText(
  formData: FormData,
  name: string,
  maximumLength: number,
): string | null {
  const raw = formData.get(name);
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value) return null;
  if (value.length > maximumLength) throw new Error(`${name} ist zu lang.`);
  return value;
}

function optionalSupportMode(
  formData: FormData,
): "supported" | "nonsupported" | "open" | null {
  const value = formData.get("supportMode");
  if (value === null || value === "") return null;
  if (value !== "supported" && value !== "nonsupported" && value !== "open")
    throw new Error("Unterstützungsmodus ist ungültig.");
  return value;
}

export async function completeOnboarding(formData: FormData) {
  try {
    const heroSport = formData.get("primarySport");
    const multiPriority = formData.get("multiPriority");
    const primarySport =
      heroSport === "multi"
        ? multiPriority === "running"
          ? "running"
          : "cycling"
        : heroSport === "running"
          ? "running"
          : "cycling";

    const runningSessions =
      primarySport === "running"
        ? (optionalInteger(formData, "runningSessions", 1, 7) ?? 3)
        : 3;
    const weeklyDistance = optionalInteger(formData, "weeklyDistance", 0, 2000) ?? 0;
    const strengthEnabled = formData.get("strengthEnabled") === "on";
    const strengthSessions = strengthEnabled
      ? (optionalInteger(formData, "strengthSessions", 0, 7) ?? 1)
      : 0;
    const volleyball = formData.get("volleyball") === "on";
    const workdayMax = optionalInteger(formData, "workdayMax", 15, 360) ?? 90;
    const beforeLate = formData.get("beforeLate") === "on";
    const afterNight = formData.get("afterNight") === "on";

    const maxHeartRate = optionalInteger(formData, "maxHeartRate", 80, 240);
    const restingHeartRate = optionalInteger(formData, "restingHeartRate", 25, 120);
    const ftpWatts = optionalInteger(formData, "ftpWatts", 50, 1000);
    if (
      maxHeartRate !== null &&
      restingHeartRate !== null &&
      restingHeartRate >= maxHeartRate
    )
      throw new Error("Der Ruhepuls muss unter dem Maximalpuls liegen.");

    const user = await requireUser();
    const supabase = await createClient();
    if (!supabase) throw new Error("Supabase ist nicht verfügbar.");

    const [{ error: goalError }, { error: preferenceError }, { error: profileError }] =
      await Promise.all([
        supabase.from("training_goals").upsert({
          user_id: user.id,
          event_name: optionalText(formData, "eventName", 200),
          target_year: optionalInteger(
            formData,
            "targetYear",
            new Date().getFullYear(),
            new Date().getFullYear() + 20,
          ),
          event_distance_km: optionalInteger(formData, "eventDistance", 1, 100000),
          event_elevation_meters: optionalInteger(formData, "eventElevation", 0, 1000000),
          support_mode: optionalSupportMode(formData),
          weekly_distance_goal_km: weeklyDistance,
          updated_at: new Date().toISOString(),
        }),
        supabase.from("training_preferences").upsert({
          user_id: user.id,
          primary_sport: primarySport,
          running_sessions_per_week: runningSessions,
          easy_run_with_cross_training: volleyball,
          before_late_shift_allowed: beforeLate,
          after_night_shift_allowed: afterNight,
          workday_max_session_minutes: workdayMax,
          gym_summer_sessions: strengthSessions,
          gym_winter_sessions: strengthSessions,
          updated_at: new Date().toISOString(),
        }),
        supabase
          .from("profiles")
          .update({
            max_heart_rate: maxHeartRate,
            resting_heart_rate: restingHeartRate,
            ftp_watts: ftpWatts,
            onboarding_completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", user.id),
      ]);
    if (goalError || preferenceError || profileError)
      throw new Error(
        (goalError ?? preferenceError ?? profileError)?.message ??
          "Profil konnte nicht gespeichert werden.",
      );
  } catch (error) {
    redirect(
      `/onboarding?error=${encodeURIComponent(error instanceof Error ? error.message : "Profil konnte nicht gespeichert werden.")}`,
    );
  }
  redirect("/dashboard?saved=onboarding");
}

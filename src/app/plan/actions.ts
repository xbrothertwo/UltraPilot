"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { zonedLocalTimeToIso } from "@/lib/calendar/ics-parser";
import { getActivities } from "@/lib/activities";
import { calculateDailyAvailability } from "@/lib/planning/availability";
import { getPlanningData } from "@/lib/planning/data";
import { calculateRemainingWeeklyDistance, cyclingDescription, generateDeterministicWeek } from "@/lib/planning/generator";
import { reconcilePlannedWorkouts } from "@/lib/planning/reconciliation";
import { getPlannedWorkouts } from "@/lib/planning/workouts";
import { strengthSequence, strengthVariantFromTitle, type StrengthVariant } from "@/lib/planning/strength-plan";
import { getRecoveryData } from "@/lib/recovery";
import { buildReadinessRange } from "@/lib/recovery-readiness";
import { getTrainingLoadSummary } from "@/lib/training-load-data";
import { blockWeekForDate, getActiveTrainingBlock } from "@/lib/planning/blocks";
import { recommendWeeklyTarget } from "@/lib/planning/weekly-target";

const kinds = ["work_early", "work_late", "work_night", "work_day", "appointment", "vacation", "free", "other"] as const;
const sports = ["cycling", "strength", "mobility", "recovery", "other"] as const;
const intensities = ["recovery", "easy", "endurance", "tempo", "threshold", "vo2", "strength"] as const;
const strengthPlan = {
  cadence: { summer: "1× pro Woche, A und B abwechselnd", winter: "2× pro Woche, A + B" },
  progression: "RIR 1–2; zuerst Wiederholungen, dann Gewicht; Grundübungen +2,5–5 kg",
  A: ["Back Squat 4×4–6", "Bulgarian Split Squat 3×6–8 je Bein", "Sitzendes Wadenheben 3×10–12", "Pallof Press 3×10–12 je Seite", "Dead Bug 3×8–10 je Seite", "Side Plank 2×30–45 s je Seite"],
  B: ["Romanian Deadlift 4×5–7", "Step-up mit Knee Raise 3×8 je Bein", "Hip Thrust 3×6–10", "Beinbeuger 2×10–12", "Stehendes Wadenheben 3×12–15", "Forearm Plank 3×30–60 s", "Bird Dog 3×8 je Seite", "Pallof Hold 2×20–30 s je Seite"],
};

function integer(formData: FormData, name: string, minimum: number, maximum: number): number {
  const value = Number(formData.get(name));
  if (!Number.isInteger(value) || value < minimum || value > maximum) throw new Error(`${name} ist ungültig.`);
  return value;
}

export async function savePlanningProfile(formData: FormData) {
  try {
    const user = await requireUser();
    const supabase = await createClient();
    if (!supabase) throw new Error("Supabase ist nicht verfügbar.");
    const indoorMonth = integer(formData, "indoorMonth", 1, 12);
    const indoorYear = integer(formData, "indoorYear", 2026, 2100);
    const [{ error: goalError }, { error: preferenceError }] = await Promise.all([
      supabase.from("training_goals").upsert({ user_id: user.id, event_name: "Race Across Germany Nord–Süd", target_year: integer(formData, "targetYear", 2026, 2100), event_distance_km: 1100, event_elevation_meters: 7500, support_mode: "supported", weekly_distance_goal_km: integer(formData, "weeklyDistance", 0, 2000), updated_at: new Date().toISOString() }),
      supabase.from("training_preferences").upsert({ user_id: user.id, before_late_shift_allowed: formData.get("beforeLate") === "on", after_night_shift_allowed: formData.get("afterNight") === "on", workday_max_session_minutes: integer(formData, "workdayMax", 15, 360), gym_summer_sessions: integer(formData, "gymSummer", 0, 7), gym_winter_sessions: integer(formData, "gymWinter", 0, 7), indoor_cycling_available_from: `${indoorYear}-${String(indoorMonth).padStart(2, "0")}-01`, strength_plan: strengthPlan, updated_at: new Date().toISOString() }),
    ]);
    if (goalError || preferenceError) throw new Error((goalError ?? preferenceError)?.message);
    revalidatePath("/plan");
  } catch (error) {
    redirect(`/plan?error=${encodeURIComponent(error instanceof Error ? error.message : "Einstellungen konnten nicht gespeichert werden.")}`);
  }
  redirect("/plan?saved=profile");
}

type ImportedEvent = { title: unknown; startsAt: unknown; endsAt: unknown; allDay: unknown };

export async function importCalendarEvents(formData: FormData) {
  let importedCount = 0;
  try {
    const user = await requireUser();
    const supabase = await createClient();
    if (!supabase) throw new Error("Supabase ist nicht verfügbar.");
    const eventInput = formData.get("eventsJson");
    const mappingInput = formData.get("mappingsJson");
    if (typeof eventInput !== "string" || typeof mappingInput !== "string") throw new Error("Importdaten fehlen.");
    const rawEvents = JSON.parse(eventInput) as ImportedEvent[];
    const rawMappings = JSON.parse(mappingInput) as Record<string, string>;
    if (!Array.isArray(rawEvents) || rawEvents.length === 0 || rawEvents.length > 5000) throw new Error("Ungültige Anzahl von Terminen.");
    const mappings = Object.entries(rawMappings).map(([code, kind]) => {
      if (!code || code.length > 100 || !kinds.includes(kind as typeof kinds[number])) throw new Error("Eine Code-Zuordnung ist ungültig.");
      return { user_id: user.id, code, event_kind: kind };
    });
    const mappingMap = new Map(mappings.map((mapping) => [mapping.code, mapping.event_kind]));
    const events = rawEvents.map((event) => {
      if (typeof event.title !== "string" || event.title.length < 1 || event.title.length > 200 || typeof event.startsAt !== "string" || typeof event.endsAt !== "string") throw new Error("Ein Kalendereintrag ist ungültig.");
      const startsAt = new Date(event.startsAt);
      const endsAt = new Date(event.endsAt);
      const kind = mappingMap.get(event.title);
      if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt < startsAt || !kind) throw new Error("Kalenderzeit oder Code-Zuordnung ist ungültig.");
      const eventKey = createHash("sha256").update(`${event.title}|${startsAt.toISOString()}|${endsAt.toISOString()}|${Boolean(event.allDay)}`).digest("hex");
      return { user_id: user.id, event_key: eventKey, title: event.title, event_kind: kind, starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(), all_day: Boolean(event.allDay), source: "ics" };
    });
    const [{ error: mappingsError }, { error: eventsError }] = await Promise.all([
      supabase.from("schedule_code_mappings").upsert(mappings, { onConflict: "user_id,code" }),
      supabase.from("calendar_events").upsert(events, { onConflict: "user_id,event_key", ignoreDuplicates: true }),
    ]);
    if (mappingsError || eventsError) throw new Error((mappingsError ?? eventsError)?.message);
    revalidatePath("/plan");
    importedCount = events.length;
  } catch (error) {
    redirect(`/plan?error=${encodeURIComponent(error instanceof Error ? error.message : "Kalender konnte nicht importiert werden.")}`);
  }
  redirect(`/plan?imported=${importedCount}`);
}

function dateValue(value: FormDataEntryValue | null): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(new Date(`${value}T12:00:00Z`).getTime())) throw new Error("Das Trainingsdatum ist ungültig.");
  return value;
}

function optionalPlanNumber(formData: FormData, name: string, maximum: number): number | null {
  const raw = formData.get(name);
  if (typeof raw !== "string" || raw.trim() === "") return null;
  const value = Number(raw.replace(",", "."));
  if (!Number.isFinite(value) || value < 0 || value > maximum) throw new Error(`${name} ist ungültig.`);
  return value;
}

function planDestination(formData: FormData, query: string): string {
  const week = formData.get("week");
  return `/plan?${typeof week === "string" && /^\d{4}-\d{2}-\d{2}$/.test(week) ? `week=${week}&` : ""}${query}`;
}

export async function savePlannedWorkout(formData: FormData) {
  let destination = planDestination(formData, "saved=workout");
  try {
    const user = await requireUser();
    const supabase = await createClient();
    if (!supabase) throw new Error("Supabase ist nicht verfügbar.");
    const titleValue = formData.get("title");
    const title = typeof titleValue === "string" ? titleValue.trim() : "";
    if (!title || title.length > 200) throw new Error("Bitte gib einen gültigen Namen ein.");
    const descriptionValue = formData.get("description");
    const description = typeof descriptionValue === "string" ? descriptionValue.trim() : "";
    if (description.length > 3000) throw new Error("Die Beschreibung ist zu lang.");
    const sportValue = formData.get("sportType");
    const intensityValue = formData.get("intensity");
    if (typeof sportValue !== "string" || !sports.includes(sportValue as typeof sports[number])) throw new Error("Sportart ist ungültig.");
    if (typeof intensityValue !== "string" || !intensities.includes(intensityValue as typeof intensities[number])) throw new Error("Intensität ist ungültig.");
    const record = { user_id: user.id, scheduled_date: dateValue(formData.get("scheduledDate")), sport_type: sportValue, title, description: description || null, intensity: intensityValue, planned_duration_minutes: optionalPlanNumber(formData, "duration", 1440), planned_distance_km: optionalPlanNumber(formData, "distance", 2000), updated_at: new Date().toISOString() };
    const id = formData.get("id");
    const result = typeof id === "string" && id ? await supabase.from("planned_workouts").update(record).eq("id", id).eq("user_id", user.id) : await supabase.from("planned_workouts").insert(record);
    if (result.error) throw new Error(result.error.message);
    revalidatePath("/plan");
  } catch (error) {
    destination = planDestination(formData, `error=${encodeURIComponent(error instanceof Error ? error.message : "Einheit konnte nicht gespeichert werden.")}`);
  }
  redirect(destination);
}

export async function deletePlannedWorkout(formData: FormData) {
  let destination = planDestination(formData, "saved=deleted");
  try {
    const id = formData.get("id");
    if (typeof id !== "string" || !id) throw new Error("Einheit fehlt.");
    const user = await requireUser();
    const supabase = await createClient();
    if (!supabase) throw new Error("Supabase ist nicht verfügbar.");
    const { error } = await supabase.from("planned_workouts").delete().eq("id", id).eq("user_id", user.id);
    if (error) throw new Error(error.message);
    revalidatePath("/plan");
  } catch (error) {
    destination = planDestination(formData, `error=${encodeURIComponent(error instanceof Error ? error.message : "Einheit konnte nicht gelöscht werden.")}`);
  }
  redirect(destination);
}

export async function movePlannedWorkout(id: string, scheduledDate: string): Promise<{ ok: boolean; message?: string }> {
  try {
    const date = dateValue(scheduledDate);
    const user = await requireUser();
    const supabase = await createClient();
    if (!supabase) throw new Error("Supabase ist nicht verfügbar.");
    const { data, error } = await supabase.from("planned_workouts").update({ scheduled_date: date, updated_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id).select("id").maybeSingle();
    if (error || !data) throw new Error(error?.message ?? "Einheit wurde nicht gefunden.");
    revalidatePath("/plan");
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Einheit konnte nicht verschoben werden." };
  }
}

export async function setPlannedWorkoutStatus(formData: FormData) {
  let destination = planDestination(formData, "saved=status");
  try {
    const id = formData.get("id");
    const status = formData.get("status");
    if (typeof id !== "string" || !id) throw new Error("Einheit fehlt.");
    if (status !== "planned" && status !== "skipped") throw new Error("Status ist ungültig.");
    const user = await requireUser();
    const supabase = await createClient();
    if (!supabase) throw new Error("Supabase ist nicht verfügbar.");
    const { data, error } = await supabase.from("planned_workouts").update({ status, linked_activity_id: null, updated_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id).select("id").maybeSingle();
    if (error || !data) throw new Error(error?.message ?? "Einheit wurde nicht gefunden.");
    revalidatePath("/plan");
  } catch (error) {
    destination = planDestination(formData, `error=${encodeURIComponent(error instanceof Error ? error.message : "Status konnte nicht gespeichert werden.")}`);
  }
  redirect(destination);
}

function calendarDateTime(formData: FormData, name: string): string {
  const value = formData.get(name);
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error(`${name} ist ungültig.`);
  return zonedLocalTimeToIso(`${value.slice(0, 4)}${value.slice(5, 7)}${value.slice(8, 10)}T${value.slice(11, 13)}${value.slice(14, 16)}00`, "Europe/Berlin");
}

export async function saveCalendarEvent(formData: FormData) {
  let destination = planDestination(formData, "saved=event");
  try {
    const id = formData.get("id");
    const titleValue = formData.get("title");
    const kindValue = formData.get("eventKind");
    const title = typeof titleValue === "string" ? titleValue.trim() : "";
    if (!title || title.length > 200) throw new Error("Bitte gib einen gültigen Titel ein.");
    if (typeof kindValue !== "string" || !kinds.includes(kindValue as typeof kinds[number])) throw new Error("Terminart ist ungültig.");
    const startsAt = calendarDateTime(formData, "startsAt");
    const endsAt = calendarDateTime(formData, "endsAt");
    if (new Date(endsAt) <= new Date(startsAt)) throw new Error("Das Ende muss nach dem Beginn liegen.");
    const user = await requireUser();
    const supabase = await createClient();
    if (!supabase) throw new Error("Supabase ist nicht verfügbar.");
    const changes = { title, event_kind: kindValue, starts_at: startsAt, ends_at: endsAt, all_day: formData.get("allDay") === "on" };
    if (typeof id === "string" && id) {
      const { data, error } = await supabase.from("calendar_events").update(changes).eq("id", id).eq("user_id", user.id).select("id").maybeSingle();
      if (error || !data) throw new Error(error?.message ?? "Termin wurde nicht gefunden.");
    } else {
      const { error } = await supabase.from("calendar_events").insert({ ...changes, user_id: user.id, event_key: `manual-${crypto.randomUUID()}`, source: "manual" });
      if (error) throw new Error(error.message);
    }
    revalidatePath("/plan");
    revalidatePath("/dashboard");
  } catch (error) {
    destination = planDestination(formData, `error=${encodeURIComponent(error instanceof Error ? error.message : "Termin konnte nicht gespeichert werden.")}`);
  }
  redirect(destination);
}

export async function deleteCalendarEvent(formData: FormData) {
  let destination = planDestination(formData, "saved=event-deleted");
  try {
    const id = formData.get("id");
    if (typeof id !== "string" || !id) throw new Error("Termin fehlt.");
    const user = await requireUser();
    const supabase = await createClient();
    if (!supabase) throw new Error("Supabase ist nicht verfügbar.");
    const { error } = await supabase.from("calendar_events").delete().eq("id", id).eq("user_id", user.id);
    if (error) throw new Error(error.message);
    revalidatePath("/plan");
    revalidatePath("/dashboard");
  } catch (error) {
    destination = planDestination(formData, `error=${encodeURIComponent(error instanceof Error ? error.message : "Termin konnte nicht gelöscht werden.")}`);
  }
  redirect(destination);
}

export async function makeTodayWorkoutEasy(formData: FormData) {
  let destination = "/dashboard?saved=easy";
  try {
    const id = formData.get("workoutId");
    if (typeof id !== "string" || !id) throw new Error("Einheit fehlt.");
    const user = await requireUser();
    const supabase = await createClient();
    if (!supabase) throw new Error("Supabase ist nicht verfügbar.");
    const { data: workout, error: readError } = await supabase.from("planned_workouts").select("id,sport_type,status,planned_duration_minutes").eq("id", id).eq("user_id", user.id).maybeSingle();
    if (readError || !workout) throw new Error(readError?.message ?? "Einheit wurde nicht gefunden.");
    if (workout.sport_type !== "cycling" || workout.status !== "planned") throw new Error("Nur eine noch offene Radfahrt kann gelockert werden.");
    const duration = Number(workout.planned_duration_minutes ?? 60);
    const { error } = await supabase.from("planned_workouts").update({ title: "Lockere Ausdauerfahrt", intensity: "easy", description: cyclingDescription("easy", duration), updated_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id);
    if (error) throw new Error(error.message);
    revalidatePath("/dashboard");
    revalidatePath("/plan");
  } catch (error) {
    destination = `/dashboard?error=${encodeURIComponent(error instanceof Error ? error.message : "Einheit konnte nicht angepasst werden.")}`;
  }
  redirect(destination);
}

export async function generateWeeklyPlan(formData: FormData) {
  const dashboardActionValue = formData.get("dashboardAction");
  const dashboardAction = dashboardActionValue === "shift" || dashboardActionValue === "pause" ? dashboardActionValue : null;
  const dashboardWorkoutId = formData.get("workoutId");
  let destination = dashboardAction ? `/dashboard?saved=${dashboardAction}` : planDestination(formData, "generated=1");
  try {
    const week = dateValue(formData.get("week"));
    const start = new Date(`${week}T12:00:00`);
    const end = new Date(start); end.setDate(end.getDate() + 6);
    const until = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
    const rangeStart = new Date(start); rangeStart.setHours(0, 0, 0, 0);
    const rangeEnd = new Date(end); rangeEnd.setHours(23, 59, 59, 999);
    const historyStart = new Date(start); historyStart.setDate(historyStart.getDate() - 180);
    const historyEnd = new Date(start); historyEnd.setDate(historyEnd.getDate() - 1);
    const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const [planning, existing, activities, previousWorkouts, recovery, trainingLoad, trainingBlock] = await Promise.all([getPlanningData({ from: rangeStart, until: rangeEnd }), getPlannedWorkouts(week, until), getActivities(), getPlannedWorkouts(iso(historyStart), iso(historyEnd)), getRecoveryData(week, until), getTrainingLoadSummary(28), getActiveTrainingBlock()]);
    const dashboardTarget = dashboardAction && typeof dashboardWorkoutId === "string" ? existing.find((workout) => workout.id === dashboardWorkoutId) : null;
    if (dashboardAction) {
      if (typeof dashboardWorkoutId !== "string" || !dashboardWorkoutId) throw new Error("Einheit fehlt.");
      if (!dashboardTarget || dashboardTarget.source !== "automatic" || dashboardTarget.status !== "planned" || dashboardTarget.sportType !== "cycling") throw new Error("Nur eine offene, automatisch geplante Radfahrt kann auf diesem Weg umgeplant werden.");
      if (dashboardTarget.scheduledDate !== iso(new Date())) throw new Error("Die Schnellaktion ist nur für die heutige Einheit verfügbar.");
      if (dashboardAction === "shift" && dashboardTarget.scheduledDate === until) throw new Error("Am letzten Wochentag kann die Einheit nicht auf morgen verschoben werden.");
    }
    const recentCutoff = start.getTime() - 28 * 86_400_000;
    const recent = activities.filter((activity) => { const time = new Date(activity.activityDate).getTime(); return activity.sportType === "cycling" && time >= recentCutoff && time < start.getTime(); });
    const completedThisWeek = activities.filter((activity) => { const time = new Date(activity.activityDate).getTime(); return activity.sportType === "cycling" && time >= rangeStart.getTime() && time <= rangeEnd.getTime(); });
    const recentDistanceKm = recent.reduce((sum, activity) => sum + activity.distanceMeters / 1000, 0);
    const recentSeconds = recent.reduce((sum, activity) => sum + activity.movingTimeSeconds, 0);
    const averageSpeedKmh = recentSeconds > 0 ? recentDistanceKm / (recentSeconds / 3600) : null;
    const reconciled = reconcilePlannedWorkouts(existing, completedThisWeek);
    const automatic = reconciled.filter((item) => item.workout.source === "automatic");
    const replaceableAutomatic = automatic.filter((item) => item.effectiveStatus !== "completed").map((item) => item.workout);
    const completedAutomatic = automatic.filter((item) => item.effectiveStatus === "completed").map((item) => item.workout);
    const manual = existing.filter((workout) => workout.source !== "automatic");
    const completedDistanceKm = completedThisWeek.reduce((sum, activity) => sum + activity.distanceMeters / 1000, 0);
    const manuallyPlannedDistanceKm = reconciled.filter((item) => item.workout.source !== "automatic" && item.workout.sportType === "cycling" && item.effectiveStatus === "planned").reduce((sum, item) => sum + (item.workout.plannedDistanceKm ?? 0), 0);
    const blockWeek = blockWeekForDate(trainingBlock, week);
    const longRideCovered = blockWeek ? completedThisWeek.some((activity) => activity.distanceMeters / 1000 >= blockWeek.longRideTargetKm * .8) || reconciled.some((item) => item.workout.source === "manual" && item.effectiveStatus !== "skipped" && item.workout.sportType === "cycling" && (item.workout.title.toLowerCase().includes("lange") || (item.workout.plannedDistanceKm ?? 0) >= blockWeek.longRideTargetKm * .8)) : false;
    const summer = start.getMonth() >= 3 && start.getMonth() <= 8;
    const configuredStrengthSessions = summer ? planning.profile.gymSummerSessions : planning.profile.gymWinterSessions;
    const currentStrength = manual.filter((workout) => workout.sportType === "strength" && workout.status !== "skipped");
    const manualStrengthVariants = currentStrength.map((workout) => strengthVariantFromTitle(workout.title)).filter((variant): variant is StrengthVariant => variant !== null);
    const historicalStrengthVariants = previousWorkouts.filter((workout) => workout.sportType === "strength" && workout.status !== "skipped").map((workout) => strengthVariantFromTitle(workout.title)).filter((variant): variant is StrengthVariant => variant !== null);
    const remainingStrengthSessions = Math.max(0, configuredStrengthSessions - currentStrength.length - completedAutomatic.filter((workout) => workout.sportType === "strength").length);
    const strengthVariants = summer ? strengthSequence(remainingStrengthSessions, true, [...historicalStrengthVariants, ...manualStrengthVariants].at(-1) ?? null) : (["A", "B"] as StrengthVariant[]).filter((variant) => !manualStrengthVariants.includes(variant)).slice(0, remainingStrengthSessions);
    const weekDates = Array.from({ length: 7 }, (_, index) => { const date = new Date(start); date.setDate(date.getDate() + index); return iso(date); });
    const readinessByDate = new Map(buildReadinessRange(weekDates, recovery.metrics, recovery.checkins).map((item) => [item.date, item.status]));
    const highLoadDates = new Set(trainingLoad.highLoadDates);
    const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    const tomorrowDate = new Date(`${today}T12:00:00`); tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrow = iso(tomorrowDate);
    const activityDates = new Set(completedThisWeek.map((activity) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(activity.activityDate))));
    const loadProtectedDates = new Set<string>();
    const days = Array.from({ length: 7 }, (_, index) => { const date = new Date(start); date.setDate(date.getDate() + index); const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; const events = planning.events.filter((event) => new Date(event.startsAt) < new Date(`${key}T23:59:59`) && new Date(event.endsAt) > new Date(`${key}T00:00:00`) && event.eventKind !== "free"); const windows = calculateDailyAvailability(key, events); const recentHighLoad = [1, 2].some((offset) => { const previous = new Date(`${key}T12:00:00Z`); previous.setUTCDate(previous.getUTCDate() - offset); return highLoadDates.has(previous.toISOString().slice(0, 10)); }); if (recentHighLoad) loadProtectedDates.add(key); const measuredReadiness = readinessByDate.get(key); return { date: key, availableMinutes: windows.reduce((sum, window) => sum + window.durationMinutes, 0), workday: events.some((event) => event.eventKind.startsWith("work_")), readiness: recentHighLoad && (measuredReadiness === "green" || measuredReadiness === "unknown" || measuredReadiness === undefined) ? "yellow" as const : measuredReadiness, highIntensityAllowed: !recentHighLoad && !events.some((event) => event.eventKind === "work_night"), occupied: key < today || (dashboardAction !== null && key < tomorrow) || activityDates.has(key) || manual.some((workout) => workout.scheduledDate === key && workout.status !== "skipped") || completedAutomatic.some((workout) => workout.scheduledDate === key) }; });
    const weeklyRecommendation = recommendWeeklyTarget({ referenceGoalKm: planning.profile.weeklyDistanceGoalKm, days, recentFourWeekDistanceKm: recentDistanceKm, recentAverageSpeedKmh: averageSpeedKmh, workdayMaxMinutes: planning.profile.workdayMaxSessionMinutes, blockTargetKm: blockWeek?.targetDistanceKm, blockLongRideTargetKm: blockWeek?.longRideTargetKm, blockPhase: blockWeek?.phase });
    const weeklyGoalKm = weeklyRecommendation.targetKm;
    const remainingDistanceKm = calculateRemainingWeeklyDistance(weeklyGoalKm, completedDistanceKm, manuallyPlannedDistanceKm);
    const adaptiveLongRideTargetKm = longRideCovered ? undefined : Math.min(weeklyRecommendation.longRideTargetKm, remainingDistanceKm);
    const user = await requireUser();
    const supabase = await createClient();
    if (!supabase) throw new Error("Supabase ist nicht verfügbar.");
    const inferredMatches = reconciled.filter((item) => item.activity && (item.workout.linkedActivityId !== item.activity.id || item.workout.status !== "completed"));
    for (const item of inferredMatches) {
      const { error } = await supabase.from("planned_workouts").update({ linked_activity_id: item.activity!.id, status: "completed", updated_at: new Date().toISOString() }).eq("id", item.workout.id).eq("user_id", user.id);
      if (error) throw new Error(`Plan und Aktivität konnten nicht verknüpft werden: ${error.message}`);
    }
    if (remainingDistanceKm === 0) {
      const summary = `Das Wochenziel von ${weeklyGoalKm.toLocaleString("de-DE")} km ist durch ${completedDistanceKm.toLocaleString("de-DE", { maximumFractionDigits: 1 })} absolvierte und ${manuallyPlannedDistanceKm.toLocaleString("de-DE", { maximumFractionDigits: 1 })} manuell geplante Kilometer bereits vollständig abgedeckt.`;
      const { data: completedGeneration, error } = await supabase.from("training_plan_generations").insert({ user_id: user.id, week_start: week, summary, caution: null, model: "deterministic-v5-adaptive-target", used_ai: false, deterministic_snapshot: { weeklyGoalKm, weeklyRecommendation, blockId: trainingBlock?.id ?? null, blockWeek: blockWeek?.weekNumber ?? null, completedDistanceKm, manuallyPlannedDistanceKm, remainingDistanceKm: 0 } }).select("id").single();
      if (error || !completedGeneration) throw new Error(error?.message ?? "Planlauf konnte nicht gespeichert werden.");
      if (dashboardAction && dashboardTarget) {
        const changes = dashboardAction === "shift" ? { scheduled_date: tomorrow, updated_at: new Date().toISOString() } : { status: "skipped", linked_activity_id: null, updated_at: new Date().toISOString() };
        const { error: adaptationError } = await supabase.from("planned_workouts").update(changes).eq("id", dashboardTarget.id).eq("user_id", user.id);
        if (adaptationError) throw new Error(adaptationError.message);
        destination = `/dashboard?saved=${dashboardAction}&goal=met`;
      } else {
        if (replaceableAutomatic.length) { const { error: removalError } = await supabase.from("planned_workouts").delete().in("id", replaceableAutomatic.map((workout) => workout.id)); if (removalError) { await supabase.from("training_plan_generations").delete().eq("id", completedGeneration.id); throw new Error(removalError.message); } }
        destination = planDestination(formData, "goal=met");
      }
    } else {
      const generated = generateDeterministicWeek({ days, weeklyGoalKm: remainingDistanceKm, recentFourWeekDistanceKm: recentDistanceKm, recentAverageSpeedKmh: averageSpeedKmh, workdayMaxMinutes: planning.profile.workdayMaxSessionMinutes, strengthVariants, longRideTargetKm: adaptiveLongRideTargetKm, longRideCovered, tempoSessionTarget: blockWeek?.tempoSessionTarget, preferredCyclingDate: dashboardAction === "shift" ? tomorrow : undefined });
      if (!generated.workouts.length) throw new Error("Das offene Wochenziel kann nicht verteilt werden: Es fehlen freie Zeitfenster von mindestens 45 Minuten.");
      if (dashboardAction === "shift" && !generated.workouts.some((workout) => workout.sportType === "cycling" && workout.scheduledDate === tomorrow)) throw new Error("Morgen gibt es kein geeignetes freies Trainingsfenster. Der bisherige Plan wurde nicht verändert.");
      const weeklyRecent = recentDistanceKm / 4;
      const increaseWarning = weeklyRecent > 0 && weeklyGoalKm > weeklyRecent * 1.1 ? ` Achtung: Das Ziel liegt mehr als 10 % über deinem Vierwochenschnitt von ${weeklyRecent.toLocaleString("de-DE", { maximumFractionDigits: 1 })} km.` : "";
      const loadProtection = loadProtectedDates.size ? ` Nach hoher persönlicher Vorbelastung wurden ${loadProtectedDates.size} Tag${loadProtectedDates.size === 1 ? "" : "e"} für Tempo gesperrt.` : "";
      const blockContext = blockWeek ? ` Blockwoche ${blockWeek.weekNumber}/4 (${blockWeek.phase}): lange Ausfahrt rund ${weeklyRecommendation.longRideTargetKm.toLocaleString("de-DE", { maximumFractionDigits: 1 })} km, ${blockWeek.tempoSessionTarget ? "eine Tempoeinheit möglich" : "keine Tempoeinheit"}.` : "";
      const adaptiveContext = ` Aus Kalender und Verlauf ergibt sich ein sinnvoller Korridor von ${weeklyRecommendation.lowerKm}–${weeklyRecommendation.upperKm} km; der Planwert liegt bei ${weeklyGoalKm} km statt starr bei ${planning.profile.weeklyDistanceGoalKm} km.`;
      const summary = `Wochenziel ${weeklyGoalKm.toLocaleString("de-DE")} km: ${completedDistanceKm.toLocaleString("de-DE", { maximumFractionDigits: 1 })} km bereits absolviert, ${manuallyPlannedDistanceKm.toLocaleString("de-DE", { maximumFractionDigits: 1 })} km manuell geplant und die offenen ${remainingDistanceKm.toLocaleString("de-DE", { maximumFractionDigits: 1 })} km automatisch verteilt.${adaptiveContext}${blockContext}${increaseWarning}${loadProtection}`;
      const caution = "Verschiebe oder kürze Einheiten bei ungewöhnlicher Müdigkeit, Schmerzen oder unerwarteter Zusatzbelastung. UltraPilot erstellt keine medizinischen Diagnosen.";
      const { data: generation, error: generationError } = await supabase.from("training_plan_generations").insert({ user_id: user.id, week_start: week, summary, caution, model: "deterministic-v5-adaptive-target", used_ai: false, deterministic_snapshot: { weeklyGoalKm, weeklyRecommendation, blockId: trainingBlock?.id ?? null, blockWeek: blockWeek?.weekNumber ?? null, longRideTargetKm: weeklyRecommendation.longRideTargetKm, tempoSessionTarget: blockWeek?.tempoSessionTarget ?? null, completedDistanceKm, manuallyPlannedDistanceKm, remainingDistanceKm, recentFourWeekDistanceKm: Math.round(recentDistanceKm), sevenDayLoad: trainingLoad.sevenDayLoad, fourWeekWeeklyLoad: trainingLoad.fourWeekWeeklyAverage, highLoadDates: [...highLoadDates], loadProtectedDates: [...loadProtectedDates], availableMinutes: days.map((day) => ({ day: day.date, minutes: day.availableMinutes, workday: day.workday })) } }).select("id").single();
      if (generationError || !generation) throw new Error(generationError?.message ?? "Planlauf konnte nicht gespeichert werden.");
      const { error: workoutError } = await supabase.from("planned_workouts").insert(generated.workouts.map((workout) => ({ user_id: user.id, scheduled_date: workout.scheduledDate, sport_type: workout.sportType, title: workout.title, description: workout.description, intensity: workout.intensity, planned_duration_minutes: workout.plannedDurationMinutes, planned_distance_km: workout.plannedDistanceKm, source: "automatic", generation_id: generation.id })));
      if (workoutError) { await supabase.from("training_plan_generations").delete().eq("id", generation.id); throw new Error(workoutError.message); }
      if (replaceableAutomatic.length) {
        const { error: replacementError } = await supabase.from("planned_workouts").delete().in("id", replaceableAutomatic.map((workout) => workout.id));
        if (replacementError) { await supabase.from("planned_workouts").delete().eq("generation_id", generation.id); await supabase.from("training_plan_generations").delete().eq("id", generation.id); throw new Error(`Alter Plan konnte nicht ersetzt werden: ${replacementError.message}`); }
      }
      destination = dashboardAction ? `/dashboard?saved=${dashboardAction}` : planDestination(formData, `generated=${generated.workouts.length}`);
    }
    revalidatePath("/plan");
    revalidatePath("/dashboard");
  } catch (error) {
    destination = dashboardAction ? `/dashboard?error=${encodeURIComponent(error instanceof Error ? error.message : "Wochenplan konnte nicht angepasst werden.")}` : planDestination(formData, `error=${encodeURIComponent(error instanceof Error ? error.message : "Wochenplan konnte nicht erstellt werden.")}`);
  }
  redirect(destination);
}

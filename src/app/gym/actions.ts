"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { isDemoMode } from "@/lib/demo-data";
import { scheduleProgramWeek, selectWritableScheduleItems } from "@/lib/gym/program-builder";
import { GymValidationError, isGymTrackingType, validateGymSet, validateProgram } from "@/lib/gym/validation";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

function field(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function gymDestination(path: string, key: "saved" | "error", message: string): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${key}=${encodeURIComponent(message)}`;
}

function relatedOne<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

async function context() {
  if (isDemoMode) throw new GymValidationError("Im Demo-Modus werden Gym-Daten nicht gespeichert.");
  const user = await requireUser();
  const supabase = await createClient();
  if (!supabase) throw new GymValidationError("Supabase ist nicht verfügbar.");
  return { user, supabase };
}

export async function toggleGymFavorite(formData: FormData): Promise<void> {
  const exerciseId = field(formData, "exerciseId");
  const destination = field(formData, "destination") || "/gym/library";
  try {
    const { user, supabase } = await context();
    const { data } = await supabase.from("gym_exercise_favorites").select("exercise_id").eq("user_id", user.id).eq("exercise_id", exerciseId).maybeSingle();
    const result = data
      ? await supabase.from("gym_exercise_favorites").delete().eq("user_id", user.id).eq("exercise_id", exerciseId)
      : await supabase.from("gym_exercise_favorites").insert({ user_id: user.id, exercise_id: exerciseId });
    if (result.error) throw new GymValidationError(result.error.message);
    revalidatePath("/gym/library");
    revalidatePath(`/gym/exercises/${exerciseId}`);
    redirect(destination);
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
    redirect(gymDestination(destination, "error", error instanceof Error ? error.message : "Favorit konnte nicht gespeichert werden."));
  }
}

export async function createCustomExercise(formData: FormData): Promise<void> {
  const destination = "/gym/library";
  try {
    const { user, supabase } = await context();
    const name = field(formData, "name").trim();
    const muscleGroup = field(formData, "muscleGroup").trim();
    const trackingType = field(formData, "trackingType");
    const laterality = field(formData, "laterality");
    if (!name || name.length > 160 || !muscleGroup || muscleGroup.length > 100) throw new GymValidationError("Name und Muskelgruppe sind erforderlich.");
    if (!isGymTrackingType(trackingType)) throw new GymValidationError("Tracking-Typ ist ungültig.");
    if (!['bilateral', 'unilateral', 'alternating', 'variable'].includes(laterality)) throw new GymValidationError("Seitenmodus ist ungültig.");
    const { data: exercise, error } = await supabase.from("gym_exercises").insert({
      owner_id: user.id,
      external_id: null,
      name,
      primary_muscle: field(formData, "primaryMuscle").trim() || null,
      muscle_group: muscleGroup,
      secondary_muscles: [],
      secondary_muscle_groups: [],
      aliases: [],
      variations: [],
      tracking_type: trackingType,
      exercise_type: field(formData, "exerciseType") || "compound",
      movement_pattern: field(formData, "movementPattern").trim() || null,
      laterality,
      notes: field(formData, "notes").trim() || null,
      source: "custom",
      active: true,
    }).select("id").single();
    if (error || !exercise) throw new GymValidationError(error?.message ?? "Eigene Übung konnte nicht erstellt werden.");
    const equipment = field(formData, "equipment").trim();
    if (equipment) {
      const { data: equipmentRow } = await supabase.from("gym_equipment").select("id").eq("name", equipment).maybeSingle();
      if (equipmentRow) await supabase.from("gym_exercise_equipment").insert({ exercise_id: exercise.id, equipment_id: equipmentRow.id });
    }
    revalidatePath("/gym/library");
    redirect(`/gym/exercises/${exercise.id}?saved=created`);
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
    redirect(gymDestination(destination, "error", error instanceof Error ? error.message : "Eigene Übung konnte nicht erstellt werden."));
  }
}

export async function archiveCustomExercise(formData: FormData): Promise<void> {
  const exerciseId = field(formData, "exerciseId");
  try {
    const { user, supabase } = await context();
    const { error } = await supabase.from("gym_exercises").update({ active: false, updated_at: new Date().toISOString() }).eq("id", exerciseId).eq("owner_id", user.id);
    if (error) throw new GymValidationError(error.message);
    revalidatePath("/gym/library");
    redirect("/gym/library?saved=archived");
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
    redirect(gymDestination(`/gym/exercises/${exerciseId}`, "error", error instanceof Error ? error.message : "Übung konnte nicht archiviert werden."));
  }
}

export async function updateCustomExercise(formData: FormData): Promise<void> {
  const exerciseId = field(formData, "exerciseId");
  try {
    const { user, supabase } = await context();
    const name = field(formData, "name").trim();
    const muscleGroup = field(formData, "muscleGroup").trim();
    const trackingType = field(formData, "trackingType");
    const laterality = field(formData, "laterality");
    const equipmentNames = [...new Set(field(formData, "equipment").split(",").map((value) => value.trim()).filter(Boolean))];
    if (!name || name.length > 160 || !muscleGroup || muscleGroup.length > 100) throw new GymValidationError("Name und Muskelgruppe sind erforderlich.");
    if (!isGymTrackingType(trackingType)) throw new GymValidationError("Tracking-Typ ist ungültig.");
    if (!["bilateral", "unilateral", "alternating", "variable"].includes(laterality)) throw new GymValidationError("Seitenmodus ist ungültig.");
    if (equipmentNames.length > 10 || equipmentNames.some((value) => value.length > 100)) throw new GymValidationError("Equipment ist ungültig.");
    const { data: equipmentRows, error: equipmentError } = equipmentNames.length
      ? await supabase.from("gym_equipment").select("id,name").in("name", equipmentNames)
      : { data: [], error: null };
    if (equipmentError || (equipmentRows?.length ?? 0) !== equipmentNames.length) throw new GymValidationError("Bitte nur Equipment aus der bestehenden Library verwenden.");
    const { data: exercise, error } = await supabase.from("gym_exercises").update({
      name,
      primary_muscle: field(formData, "primaryMuscle").trim() || null,
      muscle_group: muscleGroup,
      tracking_type: trackingType,
      exercise_type: field(formData, "exerciseType") || "compound",
      movement_pattern: field(formData, "movementPattern").trim() || null,
      laterality,
      notes: field(formData, "notes").trim() || null,
      updated_at: new Date().toISOString(),
    }).eq("id", exerciseId).eq("owner_id", user.id).select("id").maybeSingle();
    if (error || !exercise) throw new GymValidationError(error?.message ?? "Eigene Übung wurde nicht gefunden.");
    const { error: deleteError } = await supabase.from("gym_exercise_equipment").delete().eq("exercise_id", exerciseId);
    if (deleteError) throw new GymValidationError(deleteError.message);
    if (equipmentRows?.length) {
      const { error: linkError } = await supabase.from("gym_exercise_equipment").insert(equipmentRows.map((row) => ({ exercise_id: exerciseId, equipment_id: row.id })));
      if (linkError) throw new GymValidationError(linkError.message);
    }
    revalidatePath("/gym/library");
    revalidatePath(`/gym/exercises/${exerciseId}`);
    redirect(`/gym/exercises/${exerciseId}?saved=updated`);
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
    redirect(gymDestination(`/gym/exercises/${exerciseId}`, "error", error instanceof Error ? error.message : "Übung konnte nicht gespeichert werden."));
  }
}

export async function saveGymProgram(formData: FormData): Promise<void> {
  const programId = field(formData, "programId") || null;
  try {
    const raw = JSON.parse(field(formData, "program")) as unknown;
    const program = validateProgram(raw);
    const { supabase } = await context();
    const { data: savedProgramId, error } = await supabase.rpc("save_gym_program", {
      p_program_id: programId,
      p_program: program,
    });
    if (error || typeof savedProgramId !== "string") throw new GymValidationError(error?.message ?? "Programm konnte nicht gespeichert werden.");
    revalidatePath("/gym");
    revalidatePath("/gym/programs");
    redirect(`/gym/programs/${savedProgramId}?saved=program`);
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
    redirect(gymDestination(programId ? `/gym/programs/${programId}` : "/gym/programs/new", "error", error instanceof Error ? error.message : "Programm konnte nicht gespeichert werden."));
  }
}

export async function scheduleGymProgramWeek(formData: FormData): Promise<void> {
  const programId = field(formData, "programId");
  const weekStart = field(formData, "weekStart");
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) throw new GymValidationError("Wochenstart ist ungültig.");
    const { user, supabase } = await context();
    const { data: program } = await supabase.from("gym_programs").select("id").eq("id", programId).eq("user_id", user.id).maybeSingle();
    if (!program) throw new GymValidationError("Programm nicht gefunden.");
    const { data: days, error } = await supabase.from("gym_program_days").select("id,name,estimated_duration_minutes").eq("program_id", programId).eq("user_id", user.id).order("position");
    if (error || !days?.length) throw new GymValidationError("Programm enthält keine Trainingstage.");
    const schedule = scheduleProgramWeek({ programId, weekStart, days: days.map((day) => ({ id: day.id, name: day.name, estimatedDurationMinutes: day.estimated_duration_minutes })) });
    const keys = schedule.map((item) => item.scheduleKey);
    const { data: existing, error: existingError } = await supabase.from("planned_workouts").select("gym_schedule_key,locked").eq("user_id", user.id).in("gym_schedule_key", keys);
    if (existingError) throw new GymValidationError(existingError.message);
    const writable = selectWritableScheduleItems(schedule, (existing ?? []).map((item) => ({ scheduleKey: item.gym_schedule_key, locked: item.locked })));
    if (writable.length) {
      const { error: scheduleError } = await supabase.from("planned_workouts").upsert(writable.map((item) => ({ user_id: user.id, scheduled_date: item.scheduledDate, sport_type: "strength", title: item.title, intensity: "strength", planned_duration_minutes: item.plannedDurationMinutes, planned_distance_km: null, status: "planned", source: "manual", locked: true, gym_program_day_id: item.programDayId, gym_schedule_key: item.scheduleKey })), { onConflict: "user_id,gym_schedule_key" });
      if (scheduleError) throw new GymValidationError(scheduleError.message);
    }
    revalidatePath("/plan");
    revalidatePath("/gym");
    redirect(`/plan?week=${weekStart}&gym=scheduled`);
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
    redirect(gymDestination(`/gym/programs/${programId}`, "error", error instanceof Error ? error.message : "Gym-Woche konnte nicht geplant werden."));
  }
}

export async function startGymWorkout(formData: FormData): Promise<void> {
  const plannedWorkoutId = field(formData, "plannedWorkoutId") || null;
  const requestedProgramDayId = field(formData, "programDayId") || null;
  try {
    const { user, supabase } = await context();
    if (plannedWorkoutId) {
      const { data: existing } = await supabase.from("gym_sessions").select("id").eq("user_id", user.id).eq("planned_workout_id", plannedWorkoutId).maybeSingle();
      if (existing) redirect(`/gym/workout/${existing.id}`);
    }
    const { data: active } = await supabase.from("gym_sessions").select("id").eq("user_id", user.id).eq("status", "active").maybeSingle();
    if (active) redirect(`/gym/workout/${active.id}`);
    let programDayId = requestedProgramDayId;
    let workoutName = field(formData, "name").trim() || "Gym-Training";
    if (plannedWorkoutId) {
      const { data: planned } = await supabase.from("planned_workouts").select("title,gym_program_day_id").eq("id", plannedWorkoutId).eq("user_id", user.id).eq("sport_type", "strength").maybeSingle();
      if (!planned) throw new GymValidationError("Geplantes Gym-Workout nicht gefunden.");
      programDayId = planned.gym_program_day_id;
      workoutName = planned.title;
    }
    let programId: string | null = null;
    if (programDayId) {
      const { data: day } = await supabase.from("gym_program_days").select("program_id,name").eq("id", programDayId).eq("user_id", user.id).maybeSingle();
      if (!day) throw new GymValidationError("Programm-Trainingstag nicht gefunden.");
      programId = day.program_id;
      workoutName = day.name;
    }
    const { data: session, error: sessionError } = await supabase.from("gym_sessions").insert({ user_id: user.id, program_id: programId, program_day_id: programDayId, planned_workout_id: plannedWorkoutId, name: workoutName, status: "active" }).select("id").single();
    if (sessionError || !session) {
      const { data: raced } = await supabase.from("gym_sessions").select("id").eq("user_id", user.id).eq("status", "active").maybeSingle();
      if (raced) redirect(`/gym/workout/${raced.id}`);
      throw new GymValidationError(sessionError?.message ?? "Workout konnte nicht gestartet werden.");
    }
    if (programDayId) {
      const { data: programExercises, error } = await supabase.from("gym_program_exercises").select("id,exercise_id,position,working_sets,rep_min,rep_max,target_rir,target_rpe,rest_seconds,notes,gym_exercises(name,tracking_type)").eq("program_day_id", programDayId).eq("user_id", user.id).order("position");
      if (error) {
        await supabase.from("gym_sessions").delete().eq("id", session.id).eq("user_id", user.id);
        throw new GymValidationError(error.message);
      }
      type ProgramExercise = { id: string; exercise_id: string; position: number; working_sets: number; rep_min: number | null; rep_max: number | null; target_rir: number | null; target_rpe: number | null; rest_seconds: number; notes: string | null; gym_exercises: { name: string; tracking_type: string } | Array<{ name: string; tracking_type: string }> | null };
      const rows = (programExercises ?? []) as unknown as ProgramExercise[];
      if (rows.length) {
        const { error: copyError } = await supabase.from("gym_session_exercises").insert(rows.map((exercise) => { const reference = relatedOne(exercise.gym_exercises); return { session_id: session.id, user_id: user.id, exercise_id: exercise.exercise_id, program_exercise_id: exercise.id, position: exercise.position, exercise_name_snapshot: reference?.name ?? "Archivierte Übung", tracking_type_snapshot: reference?.tracking_type ?? "reps_only", target_sets: exercise.working_sets, target_rep_min: exercise.rep_min, target_rep_max: exercise.rep_max, target_rir: exercise.target_rir, target_rpe: exercise.target_rpe, rest_seconds: exercise.rest_seconds, notes_snapshot: exercise.notes }; }));
        if (copyError) {
          await supabase.from("gym_sessions").delete().eq("id", session.id).eq("user_id", user.id);
          throw new GymValidationError(copyError.message);
        }
      }
    }
    revalidatePath("/gym");
    redirect(`/gym/workout/${session.id}`);
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
    redirect(gymDestination("/gym", "error", error instanceof Error ? error.message : "Workout konnte nicht gestartet werden."));
  }
}

export async function saveGymSet(formData: FormData): Promise<void> {
  const sessionId = field(formData, "sessionId");
  const sessionExerciseId = field(formData, "sessionExerciseId");
  try {
    const { user, supabase } = await context();
    const { data: exercise } = await supabase.from("gym_session_exercises").select("tracking_type_snapshot").eq("id", sessionExerciseId).eq("session_id", sessionId).eq("user_id", user.id).maybeSingle();
    if (!exercise || !isGymTrackingType(exercise.tracking_type_snapshot)) throw new GymValidationError("Session-Übung nicht gefunden.");
    const parsed = validateGymSet({ clientKey: field(formData, "clientKey") || randomUUID(), setNumber: field(formData, "setNumber"), setType: field(formData, "setType") || "working", weightKg: field(formData, "weightKg"), repetitions: field(formData, "repetitions"), durationSeconds: field(formData, "durationSeconds"), distanceMeters: field(formData, "distanceMeters"), loadMode: field(formData, "loadMode") || null, rir: field(formData, "rir"), rpe: field(formData, "rpe"), completed: field(formData, "completed") === "true" }, exercise.tracking_type_snapshot);
    const payload = { client_key: parsed.clientKey, session_exercise_id: sessionExerciseId, user_id: user.id, set_number: parsed.setNumber, set_type: parsed.setType, weight_kg: parsed.weightKg, repetitions: parsed.repetitions, duration_seconds: parsed.durationSeconds, distance_meters: parsed.distanceMeters, load_mode: parsed.loadMode, rir: parsed.rir, rpe: parsed.rpe, completed: parsed.completed, completed_at: parsed.completed ? new Date().toISOString() : null, updated_at: new Date().toISOString() };
    const { error } = await supabase.from("gym_sets").upsert(payload, { onConflict: "user_id,client_key" });
    if (error) throw new GymValidationError(error.message);
    revalidatePath(`/gym/workout/${sessionId}`);
    redirect(`/gym/workout/${sessionId}?saved=set`);
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
    redirect(gymDestination(`/gym/workout/${sessionId}`, "error", error instanceof Error ? error.message : "Satz konnte nicht gespeichert werden."));
  }
}

export async function deleteGymSet(formData: FormData): Promise<void> {
  const sessionId = field(formData, "sessionId");
  const setId = field(formData, "setId");
  const { user, supabase } = await context();
  await supabase.from("gym_sets").delete().eq("id", setId).eq("user_id", user.id);
  revalidatePath(`/gym/workout/${sessionId}`);
  redirect(`/gym/workout/${sessionId}?saved=deleted`);
}

export async function skipGymExercise(formData: FormData): Promise<void> {
  const sessionId = field(formData, "sessionId");
  const exerciseId = field(formData, "sessionExerciseId");
  const skipped = field(formData, "skipped") === "true";
  const { user, supabase } = await context();
  await supabase.from("gym_session_exercises").update({ skipped, updated_at: new Date().toISOString() }).eq("id", exerciseId).eq("session_id", sessionId).eq("user_id", user.id);
  revalidatePath(`/gym/workout/${sessionId}`);
}

export async function addGymSessionExercise(formData: FormData): Promise<void> {
  const sessionId = field(formData, "sessionId");
  const exerciseId = field(formData, "exerciseId");
  try {
    const { user, supabase } = await context();
    const [{ data: session }, { data: exercise }, { data: last }] = await Promise.all([
      supabase.from("gym_sessions").select("id").eq("id", sessionId).eq("user_id", user.id).eq("status", "active").maybeSingle(),
      supabase.from("gym_exercises").select("id,name,tracking_type").eq("id", exerciseId).eq("active", true).maybeSingle(),
      supabase.from("gym_session_exercises").select("position").eq("session_id", sessionId).eq("user_id", user.id).order("position", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (!session || !exercise || !isGymTrackingType(exercise.tracking_type)) throw new GymValidationError("Aktive Session oder Übung wurde nicht gefunden.");
    const { error } = await supabase.from("gym_session_exercises").insert({
      session_id: sessionId,
      user_id: user.id,
      exercise_id: exercise.id,
      position: (last?.position ?? -1) + 1,
      exercise_name_snapshot: exercise.name,
      tracking_type_snapshot: exercise.tracking_type,
      target_sets: 3,
      rest_seconds: 120,
    });
    if (error) throw new GymValidationError(error.message);
    revalidatePath(`/gym/workout/${sessionId}`);
    redirect(`/gym/workout/${sessionId}?saved=exercise`);
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
    redirect(gymDestination(`/gym/workout/${sessionId}`, "error", error instanceof Error ? error.message : "Übung konnte nicht hinzugefügt werden."));
  }
}

export async function updateGymSessionExerciseNote(formData: FormData): Promise<void> {
  const sessionId = field(formData, "sessionId");
  const sessionExerciseId = field(formData, "sessionExerciseId");
  try {
    const notes = field(formData, "notes").trim();
    if (notes.length > 2000) throw new GymValidationError("Die Notiz ist zu lang.");
    const { user, supabase } = await context();
    const { error } = await supabase.from("gym_session_exercises").update({ notes_snapshot: notes || null, updated_at: new Date().toISOString() }).eq("id", sessionExerciseId).eq("session_id", sessionId).eq("user_id", user.id);
    if (error) throw new GymValidationError(error.message);
    revalidatePath(`/gym/workout/${sessionId}`);
    redirect(`/gym/workout/${sessionId}?saved=note`);
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
    redirect(gymDestination(`/gym/workout/${sessionId}`, "error", error instanceof Error ? error.message : "Notiz konnte nicht gespeichert werden."));
  }
}

export async function finishGymWorkout(formData: FormData): Promise<void> {
  const sessionId = field(formData, "sessionId");
  try {
    const { user, supabase } = await context();
    const { data: session } = await supabase.from("gym_sessions").select("started_at,planned_workout_id,status").eq("id", sessionId).eq("user_id", user.id).maybeSingle();
    if (!session) throw new GymValidationError("Workout nicht gefunden.");
    if (session.status !== "completed") {
      const endedAt = new Date();
      const durationSeconds = Math.max(0, Math.min(86400, Math.round((endedAt.getTime() - new Date(session.started_at).getTime()) / 1000)));
      const { error } = await supabase.from("gym_sessions").update({ status: "completed", ended_at: endedAt.toISOString(), duration_seconds: durationSeconds, updated_at: endedAt.toISOString() }).eq("id", sessionId).eq("user_id", user.id).eq("status", "active");
      if (error) throw new GymValidationError(error.message);
    }
    if (session.planned_workout_id) {
      const { error: plannedError } = await supabase.from("planned_workouts").update({ status: "completed", updated_at: new Date().toISOString() }).eq("id", session.planned_workout_id).eq("user_id", user.id);
      if (plannedError) throw new GymValidationError(`Workout ist abgeschlossen, aber der Kalenderstatus konnte nicht synchronisiert werden: ${plannedError.message}`);
    }
    revalidatePath("/gym");
    revalidatePath("/gym/history");
    revalidatePath("/plan");
    redirect(`/gym/workout/${sessionId}?finished=true`);
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
    redirect(gymDestination(`/gym/workout/${sessionId}`, "error", error instanceof Error ? error.message : "Workout konnte nicht abgeschlossen werden."));
  }
}

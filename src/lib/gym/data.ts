import generatedLibrary from "@/lib/gym/exercise-library.generated.json";
import { isDemoMode } from "@/lib/demo-data";
import type { GymExercise, GymSession, GymTrackingType } from "@/lib/gym/types";
import { derivePersonalRecords } from "@/lib/gym/analytics";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

type GeneratedExercise = (typeof generatedLibrary.records)[number];

export function relatedOne<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function mapGenerated(record: GeneratedExercise): GymExercise {
  return {
    id: record.externalId,
    externalId: record.externalId,
    ownerId: null,
    name: record.name,
    primaryMuscle: record.primaryMuscle,
    secondaryMuscles: record.secondaryMuscles,
    muscleGroup: record.muscleGroup,
    secondaryMuscleGroups: record.secondaryMuscleGroups,
    equipment: record.equipment,
    aliases: record.aliases,
    variations: record.variations,
    trackingType: record.trackingType as GymTrackingType,
    exerciseType: record.exerciseType,
    movementPattern: record.movementPattern,
    laterality: record.laterality,
    notes: null,
    active: record.active,
    favorite: false,
    lastUsedAt: null,
  };
}

type ExerciseRow = {
  id: string;
  external_id: string | null;
  owner_id: string | null;
  name: string;
  primary_muscle: string | null;
  secondary_muscles: string[] | null;
  muscle_group: string;
  secondary_muscle_groups: string[] | null;
  aliases: string[] | null;
  variations: string[] | null;
  tracking_type: GymTrackingType;
  exercise_type: string;
  movement_pattern: string | null;
  laterality: string;
  notes: string | null;
  active: boolean;
  gym_exercise_equipment?: Array<{ gym_equipment: { name: string } | Array<{ name: string }> | null }>;
};

export async function getExerciseLibrary(options: { includeArchived?: boolean } = {}): Promise<GymExercise[]> {
  if (isDemoMode) return generatedLibrary.records.map(mapGenerated).filter((exercise) => options.includeArchived || exercise.active);
  const user = await requireUser();
  const supabase = await createClient();
  if (!supabase) return [];
  let query = supabase
    .from("gym_exercises")
    .select("id,external_id,owner_id,name,primary_muscle,secondary_muscles,muscle_group,secondary_muscle_groups,aliases,variations,tracking_type,exercise_type,movement_pattern,laterality,notes,active,gym_exercise_equipment(gym_equipment(name))")
    .order("name");
  if (!options.includeArchived) query = query.eq("active", true);
  const [{ data, error }, favorites, recent] = await Promise.all([
    query,
    supabase.from("gym_exercise_favorites").select("exercise_id").eq("user_id", user.id),
    supabase.from("gym_session_exercises").select("exercise_id,created_at").eq("user_id", user.id).not("exercise_id", "is", null).order("created_at", { ascending: false }).limit(500),
  ]);
  if (error) return [];
  const favoriteIds = new Set((favorites.data ?? []).map((row) => row.exercise_id));
  const recentByExercise = new Map<string, string>();
  for (const row of recent.data ?? []) if (row.exercise_id && !recentByExercise.has(row.exercise_id)) recentByExercise.set(row.exercise_id, row.created_at);
  return ((data ?? []) as unknown as ExerciseRow[]).map((row) => ({
    id: row.id,
    externalId: row.external_id,
    ownerId: row.owner_id,
    name: row.name,
    primaryMuscle: row.primary_muscle,
    secondaryMuscles: row.secondary_muscles ?? [],
    muscleGroup: row.muscle_group,
    secondaryMuscleGroups: row.secondary_muscle_groups ?? [],
    equipment: (row.gym_exercise_equipment ?? []).flatMap((item) => {
      const equipment = relatedOne(item.gym_equipment);
      return equipment?.name ? [equipment.name] : [];
    }),
    aliases: row.aliases ?? [],
    variations: row.variations ?? [],
    trackingType: row.tracking_type,
    exerciseType: row.exercise_type,
    movementPattern: row.movement_pattern,
    laterality: row.laterality,
    notes: row.notes,
    active: row.active,
    favorite: favoriteIds.has(row.id),
    lastUsedAt: recentByExercise.get(row.id) ?? null,
  }));
}

export async function getExercise(id: string): Promise<GymExercise | null> {
  const library = await getExerciseLibrary({ includeArchived: true });
  return library.find((exercise) => exercise.id === id || exercise.externalId === id) ?? null;
}

export type GymProgramSummary = {
  id: string;
  name: string;
  description: string | null;
  goal: string;
  trainingDaysPerWeek: number;
  startDate: string;
  endDate: string | null;
  active: boolean;
  archivedAt: string | null;
};

export type GymProgramDetail = GymProgramSummary & {
  days: Array<{
    id: string;
    name: string;
    position: number;
    estimatedDurationMinutes: number | null;
    notes: string | null;
    exercises: Array<{
      id: string;
      exerciseId: string;
      exerciseName: string;
      trackingType: GymTrackingType;
      position: number;
      workingSets: number;
      repMin: number | null;
      repMax: number | null;
      targetSeconds: number | null;
      targetDistanceMeters: number | null;
      targetRir: number | null;
      targetRpe: number | null;
      restSeconds: number;
      startWeightKg: number | null;
      loadIncrementKg: number | null;
      notes: string | null;
      warmupNote: string | null;
    }>;
  }>;
};

export async function getGymPrograms(): Promise<GymProgramSummary[]> {
  if (isDemoMode) return [];
  const user = await requireUser();
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase.from("gym_programs").select("id,name,description,goal,training_days_per_week,start_date,end_date,active,archived_at").eq("user_id", user.id).order("updated_at", { ascending: false });
  if (error) return [];
  return (data ?? []).map((row) => ({ id: row.id, name: row.name, description: row.description, goal: row.goal, trainingDaysPerWeek: row.training_days_per_week, startDate: row.start_date, endDate: row.end_date, active: row.active, archivedAt: row.archived_at }));
}

export async function getGymProgram(id: string): Promise<GymProgramDetail | null> {
  if (isDemoMode) return null;
  const user = await requireUser();
  const supabase = await createClient();
  if (!supabase) return null;
  const { data: program, error } = await supabase.from("gym_programs").select("id,name,description,goal,training_days_per_week,start_date,end_date,active,archived_at").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (error || !program) return null;
  const { data: days } = await supabase.from("gym_program_days").select("id,name,position,estimated_duration_minutes,notes").eq("program_id", id).eq("user_id", user.id).order("position");
  const dayIds = (days ?? []).map((day) => day.id);
  const { data: exercises } = dayIds.length ? await supabase.from("gym_program_exercises").select("id,program_day_id,exercise_id,position,working_sets,rep_min,rep_max,target_seconds,target_distance_meters,target_rir,target_rpe,rest_seconds,start_weight_kg,load_increment_kg,notes,warmup_note,gym_exercises(name,tracking_type)").eq("user_id", user.id).in("program_day_id", dayIds).order("position") : { data: [] };
  type ProgramExerciseRow = { id: string; program_day_id: string; exercise_id: string; position: number; working_sets: number; rep_min: number | null; rep_max: number | null; target_seconds: number | null; target_distance_meters: number | null; target_rir: number | null; target_rpe: number | null; rest_seconds: number; start_weight_kg: number | null; load_increment_kg: number | null; notes: string | null; warmup_note: string | null; gym_exercises: { name: string; tracking_type: GymTrackingType } | Array<{ name: string; tracking_type: GymTrackingType }> | null };
  const typedExercises = (exercises ?? []) as unknown as ProgramExerciseRow[];
  return {
    id: program.id,
    name: program.name,
    description: program.description,
    goal: program.goal,
    trainingDaysPerWeek: program.training_days_per_week,
    startDate: program.start_date,
    endDate: program.end_date,
    active: program.active,
    archivedAt: program.archived_at,
    days: (days ?? []).map((day) => ({
      id: day.id,
      name: day.name,
      position: day.position,
      estimatedDurationMinutes: day.estimated_duration_minutes,
      notes: day.notes,
      exercises: typedExercises.filter((exercise) => exercise.program_day_id === day.id).map((exercise) => { const reference = relatedOne(exercise.gym_exercises); return { id: exercise.id, exerciseId: exercise.exercise_id, exerciseName: reference?.name ?? "Archivierte Übung", trackingType: reference?.tracking_type ?? "reps_only", position: exercise.position, workingSets: exercise.working_sets, repMin: exercise.rep_min, repMax: exercise.rep_max, targetSeconds: exercise.target_seconds, targetDistanceMeters: exercise.target_distance_meters, targetRir: exercise.target_rir, targetRpe: exercise.target_rpe, restSeconds: exercise.rest_seconds, startWeightKg: exercise.start_weight_kg, loadIncrementKg: exercise.load_increment_kg, notes: exercise.notes, warmupNote: exercise.warmup_note }; }),
    })),
  };
}

export async function getActiveGymSession(): Promise<Pick<GymSession, "id" | "name" | "startedAt" | "status"> | null> {
  if (isDemoMode) return null;
  const user = await requireUser();
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase.from("gym_sessions").select("id,name,started_at,status").eq("user_id", user.id).eq("status", "active").maybeSingle();
  return data ? { id: data.id, name: data.name, startedAt: data.started_at, status: data.status } : null;
}

export type GymHistoryItem = { id: string; name: string; programName: string | null; plannedWorkoutId: string | null; startedAt: string; durationSeconds: number | null; exerciseCount: number; workingSets: number };

export async function getGymHistory(limit = 30, filters: { since?: string; programId?: string; exerciseId?: string } = {}): Promise<GymHistoryItem[]> {
  if (isDemoMode) return [];
  const user = await requireUser();
  const supabase = await createClient();
  if (!supabase) return [];
  let sessionIds: string[] | null = null;
  if (filters.exerciseId) {
    const { data: matchingExercises, error: matchingError } = await supabase.from("gym_session_exercises").select("session_id").eq("user_id", user.id).eq("exercise_id", filters.exerciseId).limit(500);
    if (matchingError) return [];
    sessionIds = [...new Set((matchingExercises ?? []).map((row) => row.session_id))];
    if (!sessionIds.length) return [];
  }
  let query = supabase.from("gym_sessions").select("id,name,planned_workout_id,started_at,duration_seconds,gym_programs(name),gym_session_exercises(id,gym_sets(set_type,completed))").eq("user_id", user.id).eq("status", "completed");
  if (filters.since) query = query.gte("started_at", filters.since);
  if (filters.programId) query = query.eq("program_id", filters.programId);
  if (sessionIds) query = query.in("id", sessionIds);
  const { data, error } = await query.order("started_at", { ascending: false }).limit(Math.min(500, Math.max(1, limit)));
  if (error) return [];
  type HistoryRow = { id: string; name: string; planned_workout_id: string | null; started_at: string; duration_seconds: number | null; gym_programs: { name: string } | Array<{ name: string }> | null; gym_session_exercises: Array<{ id: string; gym_sets: Array<{ set_type: string; completed: boolean }> }> };
  return ((data ?? []) as unknown as HistoryRow[]).map((row) => ({ id: row.id, name: row.name, programName: relatedOne(row.gym_programs)?.name ?? null, plannedWorkoutId: row.planned_workout_id, startedAt: row.started_at, durationSeconds: row.duration_seconds, exerciseCount: row.gym_session_exercises.length, workingSets: row.gym_session_exercises.flatMap((exercise) => exercise.gym_sets).filter((set) => set.completed && set.set_type !== "warmup").length }));
}

export async function getGymSession(id: string): Promise<GymSession | null> {
  if (isDemoMode) return null;
  const user = await requireUser();
  const supabase = await createClient();
  if (!supabase) return null;
  const { data: session } = await supabase.from("gym_sessions").select("id,name,status,program_id,program_day_id,planned_workout_id,started_at,ended_at,duration_seconds").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!session) return null;
  const { data: rows } = await supabase.from("gym_session_exercises").select("id,exercise_id,exercise_name_snapshot,tracking_type_snapshot,position,target_sets,target_rep_min,target_rep_max,target_rir,target_rpe,rest_seconds,notes_snapshot,skipped,gym_sets(id,client_key,set_number,set_type,weight_kg,repetitions,duration_seconds,distance_meters,load_mode,rir,rpe,completed,completed_at)").eq("session_id", id).eq("user_id", user.id).order("position");
  type SessionExerciseRow = { id: string; exercise_id: string | null; exercise_name_snapshot: string; tracking_type_snapshot: GymTrackingType; position: number; target_sets: number | null; target_rep_min: number | null; target_rep_max: number | null; target_rir: number | null; target_rpe: number | null; rest_seconds: number; notes_snapshot: string | null; skipped: boolean; gym_sets: Array<{ id: string; client_key: string; set_number: number; set_type: "warmup" | "working" | "drop" | "amrap"; weight_kg: number | null; repetitions: number | null; duration_seconds: number | null; distance_meters: number | null; load_mode: "bodyweight" | "added" | "assisted" | "external" | null; rir: number | null; rpe: number | null; completed: boolean; completed_at: string | null }> };
  const exerciseRows = (rows ?? []) as SessionExerciseRow[];
  const exerciseIds = exerciseRows.flatMap((row) => row.exercise_id ? [row.exercise_id] : []);
  const { data: previous } = exerciseIds.length ? await supabase.from("gym_session_exercises").select("exercise_id,created_at,gym_sets(id,client_key,set_number,set_type,weight_kg,repetitions,duration_seconds,distance_meters,load_mode,rir,rpe,completed,completed_at)").eq("user_id", user.id).in("exercise_id", exerciseIds).neq("session_id", id).order("created_at", { ascending: false }).limit(200) : { data: [] };
  const previousByExercise = new Map<string, SessionExerciseRow["gym_sets"]>();
  for (const item of previous ?? []) if (item.exercise_id && !previousByExercise.has(item.exercise_id)) previousByExercise.set(item.exercise_id, item.gym_sets as SessionExerciseRow["gym_sets"]);
  const mapSet = (set: SessionExerciseRow["gym_sets"][number]) => ({ id: set.id, clientKey: set.client_key, setNumber: set.set_number, setType: set.set_type, weightKg: set.weight_kg, repetitions: set.repetitions, durationSeconds: set.duration_seconds, distanceMeters: set.distance_meters, loadMode: set.load_mode, rir: set.rir, rpe: set.rpe, completed: set.completed, completedAt: set.completed_at });
  return { id: session.id, name: session.name, status: session.status, programId: session.program_id, programDayId: session.program_day_id, plannedWorkoutId: session.planned_workout_id, startedAt: session.started_at, endedAt: session.ended_at, durationSeconds: session.duration_seconds, exercises: exerciseRows.map((row) => ({ id: row.id, exerciseId: row.exercise_id, name: row.exercise_name_snapshot, trackingType: row.tracking_type_snapshot, position: row.position, targetSets: row.target_sets, targetRepMin: row.target_rep_min, targetRepMax: row.target_rep_max, targetRir: row.target_rir, targetRpe: row.target_rpe, restSeconds: row.rest_seconds, notes: row.notes_snapshot, skipped: row.skipped, sets: row.gym_sets.sort((a, b) => a.set_number - b.set_number).map(mapSet), previousSets: row.exercise_id ? (previousByExercise.get(row.exercise_id) ?? []).filter((set) => set.completed).sort((a, b) => a.set_number - b.set_number).map(mapSet) : [] })) };
}

export type GymPlannedWorkout = { id: string; title: string; scheduledDate: string; durationMinutes: number | null; programDayId: string | null; status: string };

export async function getGymOverview() {
  const [programs, activeSession, history] = await Promise.all([getGymPrograms(), getActiveGymSession(), getGymHistory(5)]);
  if (isDemoMode) return { programs, activeSession, history, planned: [] as GymPlannedWorkout[], exerciseCount: generatedLibrary.records.length };
  const user = await requireUser();
  const supabase = await createClient();
  if (!supabase) return { programs, activeSession, history, planned: [] as GymPlannedWorkout[], exerciseCount: 0 };
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [{ data: planned }, { count }] = await Promise.all([
    supabase.from("planned_workouts").select("id,title,scheduled_date,planned_duration_minutes,gym_program_day_id,status").eq("user_id", user.id).eq("sport_type", "strength").gte("scheduled_date", today).neq("status", "skipped").order("scheduled_date").limit(8),
    supabase.from("gym_exercises").select("id", { count: "exact", head: true }).eq("active", true),
  ]);
  return {
    programs,
    activeSession,
    history,
    exerciseCount: count ?? 0,
    planned: (planned ?? []).map((row) => ({ id: row.id, title: row.title, scheduledDate: row.scheduled_date, durationMinutes: row.planned_duration_minutes, programDayId: row.gym_program_day_id, status: row.status })),
  };
}

export async function getExerciseProgress(exerciseId: string) {
  if (isDemoMode) return { sessions: [], records: derivePersonalRecords([]) };
  const user = await requireUser();
  const supabase = await createClient();
  if (!supabase) return { sessions: [], records: derivePersonalRecords([]) };
  const { data, error } = await supabase.from("gym_session_exercises").select("id,exercise_name_snapshot,created_at,gym_sessions(id,name,started_at,status),gym_sets(id,client_key,set_number,set_type,weight_kg,repetitions,duration_seconds,distance_meters,load_mode,rir,rpe,completed,completed_at)").eq("user_id", user.id).eq("exercise_id", exerciseId).order("created_at", { ascending: false }).limit(50);
  if (error) return { sessions: [], records: derivePersonalRecords([]) };
  type ProgressRow = { id: string; created_at: string; gym_sessions: { id: string; name: string; started_at: string; status: string } | Array<{ id: string; name: string; started_at: string; status: string }> | null; gym_sets: Array<{ id: string; client_key: string; set_number: number; set_type: "warmup" | "working" | "drop" | "amrap"; weight_kg: number | null; repetitions: number | null; duration_seconds: number | null; distance_meters: number | null; load_mode: "bodyweight" | "added" | "assisted" | "external" | null; rir: number | null; rpe: number | null; completed: boolean; completed_at: string | null }> };
  const rows = (data ?? []) as unknown as ProgressRow[];
  const sets = rows.flatMap((row) => row.gym_sets.map((set) => ({ id: set.id, clientKey: set.client_key, setNumber: set.set_number, setType: set.set_type, weightKg: set.weight_kg, repetitions: set.repetitions, durationSeconds: set.duration_seconds, distanceMeters: set.distance_meters, loadMode: set.load_mode, rir: set.rir, rpe: set.rpe, completed: set.completed, completedAt: set.completed_at })));
  return {
    records: derivePersonalRecords(sets),
    sessions: rows.flatMap((row) => { const session = relatedOne(row.gym_sessions); return session?.status === "completed" ? [{ id: session.id, name: session.name, startedAt: session.started_at, sets: row.gym_sets.filter((set) => set.completed).sort((a, b) => a.set_number - b.set_number) }] : []; }),
  };
}

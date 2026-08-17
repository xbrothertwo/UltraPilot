import {
  gymTrackingTypes,
  type GymProgramInput,
  type GymSetInput,
  type GymTrackingType,
} from "@/lib/gym/types";

export class GymValidationError extends Error {}

function text(value: unknown, label: string, maxLength: number, optional = false): string | null {
  if (value === null || value === undefined || value === "") {
    if (optional) return null;
    throw new GymValidationError(`${label} fehlt.`);
  }
  if (typeof value !== "string") throw new GymValidationError(`${label} ist ungültig.`);
  const normalized = value.trim();
  if (!normalized && !optional) throw new GymValidationError(`${label} fehlt.`);
  if (normalized.length > maxLength) throw new GymValidationError(`${label} ist zu lang.`);
  return normalized || null;
}

function numberValue(value: unknown, label: string, min: number, max: number, integer = false, optional = true): number | null {
  if (value === null || value === undefined || value === "") {
    if (optional) return null;
    throw new GymValidationError(`${label} fehlt.`);
  }
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max || (integer && !Number.isInteger(parsed))) {
    throw new GymValidationError(`${label} muss zwischen ${min} und ${max} liegen${integer ? " und ganzzahlig sein" : ""}.`);
  }
  return parsed;
}

export function validateGymSet(input: unknown, trackingType: GymTrackingType): GymSetInput {
  if (typeof input !== "object" || input === null) throw new GymValidationError("Satzdaten fehlen.");
  const row = input as Record<string, unknown>;
  const clientKey = text(row.clientKey, "Client-Key", 80) ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(clientKey)) throw new GymValidationError("Client-Key ist ungültig.");
  const setType = row.setType;
  if (setType !== "warmup" && setType !== "working" && setType !== "drop" && setType !== "amrap") throw new GymValidationError("Satztyp ist ungültig.");
  const loadMode = row.loadMode;
  if (loadMode !== null && loadMode !== undefined && loadMode !== "bodyweight" && loadMode !== "added" && loadMode !== "assisted" && loadMode !== "external") throw new GymValidationError("Load-Modus ist ungültig.");
  const result: GymSetInput = {
    clientKey,
    setNumber: numberValue(row.setNumber, "Satznummer", 1, 100, true, false)!,
    setType,
    weightKg: numberValue(row.weightKg, "Gewicht", 0, 1000),
    repetitions: numberValue(row.repetitions, "Wiederholungen", 0, 500, true),
    durationSeconds: numberValue(row.durationSeconds, "Dauer", 0, 86400, true),
    distanceMeters: numberValue(row.distanceMeters, "Distanz", 0, 100000),
    loadMode: loadMode ?? null,
    rir: numberValue(row.rir, "RIR", 0, 10),
    rpe: numberValue(row.rpe, "RPE", 1, 10),
    completed: row.completed === true || row.completed === "true",
  };

  const requireReps = ["weight_reps", "bodyweight_reps", "weight_or_bodyweight_reps", "reps_only"].includes(trackingType);
  const requireWeight = ["weight_reps", "weight_time", "weight_distance"].includes(trackingType);
  const requireTime = ["time", "weight_time"].includes(trackingType);
  const requireDistance = trackingType === "weight_distance";
  if (requireReps && result.repetitions === null) throw new GymValidationError("Für diese Übung werden Wiederholungen benötigt.");
  if (requireWeight && result.weightKg === null) throw new GymValidationError("Für diese Übung wird ein Gewicht benötigt.");
  if (requireTime && result.durationSeconds === null) throw new GymValidationError("Für diese Übung wird eine Dauer benötigt.");
  if (requireDistance && result.distanceMeters === null) throw new GymValidationError("Für diese Übung wird eine Distanz benötigt.");
  if (trackingType === "distance_time" && result.distanceMeters === null && result.durationSeconds === null) throw new GymValidationError("Distanz oder Dauer wird benötigt.");
  if (trackingType === "time_or_reps" && result.durationSeconds === null && result.repetitions === null) throw new GymValidationError("Dauer oder Wiederholungen werden benötigt.");
  if (trackingType === "weight_or_bodyweight_reps" && !result.loadMode) throw new GymValidationError("Bitte Eigengewicht, Zusatzgewicht oder Unterstützung wählen.");
  if (result.loadMode === "bodyweight" && result.weightKg !== null) throw new GymValidationError("Eigengewicht wird ohne kg-Wert gespeichert.");
  if ((result.loadMode === "added" || result.loadMode === "assisted" || result.loadMode === "external") && result.weightKg === null) throw new GymValidationError("Der gewählte Load-Modus benötigt einen positiven kg-Wert.");
  return result;
}

export function validateProgram(input: unknown): GymProgramInput {
  if (typeof input !== "object" || input === null) throw new GymValidationError("Programmdaten fehlen.");
  const row = input as Record<string, unknown>;
  const goal = row.goal;
  if (goal !== "hypertrophy" && goal !== "strength" && goal !== "athletic" && goal !== "custom") throw new GymValidationError("Programmziel ist ungültig.");
  if (!Array.isArray(row.days) || row.days.length < 1 || row.days.length > 7) throw new GymValidationError("Ein Programm benötigt 1 bis 7 Trainingstage.");
  const seenExerciseIds = new Set<string>();
  const days = row.days.map((rawDay, dayIndex) => {
    if (typeof rawDay !== "object" || rawDay === null) throw new GymValidationError(`Trainingstag ${dayIndex + 1} ist ungültig.`);
    const day = rawDay as Record<string, unknown>;
    if (!Array.isArray(day.exercises) || day.exercises.length > 30) throw new GymValidationError(`Trainingstag ${dayIndex + 1} hat zu viele Übungen.`);
    return {
      id: typeof day.id === "string" ? day.id : undefined,
      name: text(day.name, `Name von Trainingstag ${dayIndex + 1}`, 100)!,
      position: dayIndex,
      estimatedDurationMinutes: numberValue(day.estimatedDurationMinutes, "Geschätzte Dauer", 10, 360, true),
      notes: text(day.notes, "Trainingstagsnotiz", 2000, true),
      exercises: day.exercises.map((rawExercise, exerciseIndex) => {
        if (typeof rawExercise !== "object" || rawExercise === null) throw new GymValidationError("Programmübung ist ungültig.");
        const exercise = rawExercise as Record<string, unknown>;
        const exerciseId = text(exercise.exerciseId, "Übungs-ID", 80)!;
        const uniquenessKey = `${dayIndex}:${exerciseId}`;
        if (seenExerciseIds.has(uniquenessKey)) throw new GymValidationError("Eine Übung darf pro Trainingstag nur einmal vorkommen.");
        seenExerciseIds.add(uniquenessKey);
        const repMin = numberValue(exercise.repMin, "Minimale Wiederholungen", 0, 500, true);
        const repMax = numberValue(exercise.repMax, "Maximale Wiederholungen", 0, 500, true);
        if (repMin !== null && repMax !== null && repMax < repMin) throw new GymValidationError("Das obere Wiederholungsziel darf nicht kleiner sein.");
        return {
          exerciseId,
          position: exerciseIndex,
          workingSets: numberValue(exercise.workingSets, "Arbeitssätze", 1, 20, true, false)!,
          repMin,
          repMax,
          targetSeconds: numberValue(exercise.targetSeconds, "Zieldauer", 1, 86400, true),
          targetDistanceMeters: numberValue(exercise.targetDistanceMeters, "Zieldistanz", 0, 100000),
          targetRir: numberValue(exercise.targetRir, "Ziel-RIR", 0, 10),
          targetRpe: numberValue(exercise.targetRpe, "Ziel-RPE", 1, 10),
          restSeconds: numberValue(exercise.restSeconds, "Satzpause", 0, 3600, true, false)!,
          startWeightKg: numberValue(exercise.startWeightKg, "Startgewicht", 0, 1000),
          loadIncrementKg: numberValue(exercise.loadIncrementKg, "Steigerung", 0, 100),
          notes: text(exercise.notes, "Übungsnotiz", 2000, true),
          warmupNote: text(exercise.warmupNote, "Warm-up-Notiz", 1000, true),
        };
      }),
    };
  });
  const startDate = text(row.startDate, "Startdatum", 10)!;
  const endDate = text(row.endDate, "Enddatum", 10, true);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate))) throw new GymValidationError("Datum muss YYYY-MM-DD entsprechen.");
  if (endDate && endDate < startDate) throw new GymValidationError("Enddatum darf nicht vor dem Startdatum liegen.");
  return {
    name: text(row.name, "Programmname", 120)!,
    description: text(row.description, "Programmbeschreibung", 2000, true),
    goal,
    startDate,
    endDate,
    active: row.active === true || row.active === "true",
    days,
  };
}

export function isGymTrackingType(value: unknown): value is GymTrackingType {
  return typeof value === "string" && gymTrackingTypes.includes(value as GymTrackingType);
}

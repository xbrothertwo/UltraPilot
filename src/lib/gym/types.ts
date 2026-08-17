export const gymTrackingTypes = [
  "weight_reps",
  "bodyweight_reps",
  "weight_or_bodyweight_reps",
  "reps_only",
  "time",
  "weight_time",
  "distance_time",
  "weight_distance",
  "time_or_reps",
] as const;

export type GymTrackingType = (typeof gymTrackingTypes)[number];
export type GymLoadMode = "bodyweight" | "added" | "assisted" | "external";
export type GymSetType = "warmup" | "working" | "drop" | "amrap";
export type GymProgramGoal = "hypertrophy" | "strength" | "athletic" | "custom";

export type GymExercise = {
  id: string;
  externalId: string | null;
  ownerId: string | null;
  name: string;
  primaryMuscle: string | null;
  secondaryMuscles: string[];
  muscleGroup: string;
  secondaryMuscleGroups: string[];
  equipment: string[];
  aliases: string[];
  variations: string[];
  trackingType: GymTrackingType;
  exerciseType: string;
  movementPattern: string | null;
  laterality: string;
  notes: string | null;
  active: boolean;
  favorite: boolean;
  lastUsedAt: string | null;
};

export type GymProgramExerciseInput = {
  exerciseId: string;
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
};

export type GymProgramDayInput = {
  id?: string;
  name: string;
  position: number;
  estimatedDurationMinutes: number | null;
  notes: string | null;
  exercises: GymProgramExerciseInput[];
};

export type GymProgramInput = {
  name: string;
  description: string | null;
  goal: GymProgramGoal;
  startDate: string;
  endDate: string | null;
  active: boolean;
  days: GymProgramDayInput[];
};

export type GymSetInput = {
  clientKey: string;
  setNumber: number;
  setType: GymSetType;
  weightKg: number | null;
  repetitions: number | null;
  durationSeconds: number | null;
  distanceMeters: number | null;
  loadMode: GymLoadMode | null;
  rir: number | null;
  rpe: number | null;
  completed: boolean;
};

export type GymPerformanceSet = GymSetInput & {
  id: string;
  completedAt: string | null;
};

export type GymSessionExercise = {
  id: string;
  exerciseId: string | null;
  name: string;
  trackingType: GymTrackingType;
  position: number;
  targetSets: number | null;
  targetRepMin: number | null;
  targetRepMax: number | null;
  targetRir: number | null;
  targetRpe: number | null;
  restSeconds: number;
  notes: string | null;
  skipped: boolean;
  sets: GymPerformanceSet[];
  previousSets: GymPerformanceSet[];
};

export type GymSession = {
  id: string;
  name: string;
  status: "active" | "completed" | "abandoned";
  programId: string | null;
  programDayId: string | null;
  plannedWorkoutId: string | null;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  exercises: GymSessionExercise[];
};

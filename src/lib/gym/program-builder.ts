import type { GymExercise, GymProgramGoal } from "@/lib/gym/types";

export type GuidedProgramInput = {
  goal: GymProgramGoal;
  daysPerWeek: number;
  minutesPerSession: number;
  equipment: string[];
  experience: "beginner" | "intermediate" | "advanced";
  priorityMuscleGroups: string[];
};

export type GuidedProgramDay = {
  name: string;
  exercises: Array<{ exercise: GymExercise; workingSets: number; repMin: number; repMax: number; restSeconds: number; targetRir: number }>;
};

const dayNames: Record<number, string[]> = {
  1: ["Full Body"],
  2: ["Full Body A", "Full Body B"],
  3: ["Push", "Pull", "Legs"],
  4: ["Upper A", "Lower A", "Upper B", "Lower B"],
  5: ["Push", "Pull", "Legs", "Upper", "Lower"],
  6: ["Push A", "Pull A", "Legs A", "Push B", "Pull B", "Legs B"],
  7: ["Full Body A", "Upper", "Lower", "Full Body B", "Push", "Pull", "Athletic"],
};

const patternTargets: Record<string, string[]> = {
  Push: ["horizontal_push", "vertical_push", "elbow_extension", "core"],
  Pull: ["horizontal_pull", "vertical_pull", "elbow_flexion", "carry"],
  Legs: ["squat", "hinge", "lunge", "knee_flexion", "calf_raise", "core"],
  Upper: ["horizontal_push", "horizontal_pull", "vertical_push", "vertical_pull", "elbow_flexion", "elbow_extension"],
  Lower: ["squat", "hinge", "lunge", "knee_flexion", "calf_raise", "core"],
  "Full Body": ["squat", "hinge", "horizontal_push", "horizontal_pull", "vertical_push", "vertical_pull", "core"],
  Athletic: ["squat", "hinge", "carry", "plyometric", "core", "conditioning"],
};

function baseDayName(name: string): string {
  return name.replace(/ [AB]$/, "");
}

function equipmentMatches(exercise: GymExercise, equipment: readonly string[]): boolean {
  return equipment.length === 0 || exercise.equipment.length === 0 || exercise.equipment.some((item) => equipment.includes(item));
}

export function buildGuidedProgram(exercises: readonly GymExercise[], input: GuidedProgramInput): GuidedProgramDay[] {
  const days = Math.min(7, Math.max(1, Math.round(input.daysPerWeek)));
  const maxExercises = Math.min(9, Math.max(3, Math.floor(input.minutesPerSession / 10)));
  const sets = input.experience === "beginner" ? 2 : input.experience === "advanced" ? 4 : 3;
  const repRange = input.goal === "strength" ? [4, 6] : input.goal === "athletic" ? [6, 10] : [8, 12];
  const available = exercises.filter((exercise) => exercise.active && equipmentMatches(exercise, input.equipment));
  const used = new Map<string, number>();
  return (dayNames[days] ?? dayNames[3]).map((name) => {
    const targets = patternTargets[baseDayName(name)] ?? patternTargets["Full Body"];
    const ranked = available
      .map((exercise) => ({
        exercise,
        score:
          (targets.includes(exercise.movementPattern ?? "") ? 20 : 0) +
          (targets.includes(exercise.exerciseType) ? 12 : 0) +
          (input.priorityMuscleGroups.includes(exercise.muscleGroup) ? 8 : 0) +
          (exercise.exerciseType === "compound" ? 4 : 0) -
          (used.get(exercise.id) ?? 0) * 6,
      }))
      .filter((candidate) => candidate.score > 0)
      .sort((a, b) => b.score - a.score || a.exercise.name.localeCompare(b.exercise.name, "de"));
    const selected: GymExercise[] = [];
    for (const target of targets) {
      const match = ranked.find((candidate) => !selected.some((item) => item.id === candidate.exercise.id) && (candidate.exercise.movementPattern === target || candidate.exercise.exerciseType === target));
      if (match) selected.push(match.exercise);
      if (selected.length >= maxExercises) break;
    }
    for (const candidate of ranked) {
      if (selected.length >= maxExercises) break;
      if (!selected.some((item) => item.id === candidate.exercise.id)) selected.push(candidate.exercise);
    }
    selected.forEach((exercise) => used.set(exercise.id, (used.get(exercise.id) ?? 0) + 1));
    return {
      name,
      exercises: selected.map((exercise) => ({ exercise, workingSets: sets, repMin: repRange[0], repMax: repRange[1], restSeconds: input.goal === "strength" && exercise.exerciseType === "compound" ? 180 : 90, targetRir: 2 })),
    };
  });
}

export function scheduleProgramWeek(input: { programId: string; weekStart: string; days: readonly { id: string; name: string; estimatedDurationMinutes: number | null }[] }) {
  const start = new Date(`${input.weekStart}T12:00:00Z`);
  const count = input.days.length;
  return input.days.map((day, index) => {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + Math.min(6, Math.floor((index * 7) / Math.max(1, count))));
    const scheduledDate = date.toISOString().slice(0, 10);
    return {
      scheduledDate,
      programDayId: day.id,
      title: day.name,
      plannedDurationMinutes: day.estimatedDurationMinutes ?? 60,
      scheduleKey: `gym:${input.programId}:${day.id}:${scheduledDate}`,
    };
  });
}

export function selectWritableScheduleItems<T extends { scheduleKey: string }>(schedule: readonly T[], existing: readonly { scheduleKey: string | null; locked: boolean }[]): T[] {
  const lockedKeys = new Set(existing.filter((item) => item.locked && item.scheduleKey).map((item) => item.scheduleKey));
  return schedule.filter((item) => !lockedKeys.has(item.scheduleKey));
}

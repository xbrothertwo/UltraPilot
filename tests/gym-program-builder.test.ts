import { describe, expect, it } from "vitest";
import { buildGuidedProgram, scheduleProgramWeek, selectWritableScheduleItems } from "@/lib/gym/program-builder";
import type { GymExercise } from "@/lib/gym/types";

function exercise(id: string, name: string, movementPattern: string, muscleGroup = "Ganzkörper"): GymExercise {
  return { id, externalId: id, ownerId: null, name, primaryMuscle: null, secondaryMuscles: [], muscleGroup, secondaryMuscleGroups: [], equipment: ["Langhantel"], aliases: [], variations: [], trackingType: "weight_reps", exerciseType: "compound", movementPattern, laterality: "bilateral", notes: null, active: true, favorite: false, lastUsedAt: null };
}

const library = [exercise("squat", "Kniebeuge", "squat", "Beine"), exercise("hinge", "Kreuzheben", "hinge", "Beine"), exercise("push", "Bankdrücken", "horizontal_push", "Brust"), exercise("pull", "Rudern", "horizontal_pull", "Rücken"), exercise("press", "Schulterdrücken", "vertical_push", "Schulter"), exercise("pulldown", "Latzug", "vertical_pull", "Rücken"), exercise("core", "Pallof Press", "core", "Core")];

describe("deterministic gym program builder", () => {
  it("creates the requested editable split from library metadata", () => {
    const first = buildGuidedProgram(library, { goal: "strength", daysPerWeek: 3, minutesPerSession: 60, equipment: ["Langhantel"], experience: "intermediate", priorityMuscleGroups: ["Beine"] });
    const second = buildGuidedProgram(library, { goal: "strength", daysPerWeek: 3, minutesPerSession: 60, equipment: ["Langhantel"], experience: "intermediate", priorityMuscleGroups: ["Beine"] });
    expect(first).toEqual(second);
    expect(first.map((day) => day.name)).toEqual(["Push", "Pull", "Legs"]);
    expect(first.flatMap((day) => day.exercises).every((item) => item.repMin === 4 && item.repMax === 6)).toBe(true);
  });

  it("generates stable duplicate-safe calendar keys", () => {
    const schedule = scheduleProgramWeek({ programId: "program", weekStart: "2026-08-17", days: [{ id: "a", name: "A", estimatedDurationMinutes: 50 }, { id: "b", name: "B", estimatedDurationMinutes: 60 }] });
    expect(schedule.map((item) => item.scheduledDate)).toEqual(["2026-08-17", "2026-08-20"]);
    expect(new Set(schedule.map((item) => item.scheduleKey)).size).toBe(2);
    expect(scheduleProgramWeek({ programId: "program", weekStart: "2026-08-17", days: [{ id: "a", name: "A", estimatedDurationMinutes: 50 }, { id: "b", name: "B", estimatedDurationMinutes: 60 }] })).toEqual(schedule);
    expect(selectWritableScheduleItems(schedule, [{ scheduleKey: schedule[0].scheduleKey, locked: true }])).toEqual([schedule[1]]);
    expect(selectWritableScheduleItems(schedule, [{ scheduleKey: schedule[0].scheduleKey, locked: false }])).toEqual(schedule);
  });
});

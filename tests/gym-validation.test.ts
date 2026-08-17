import { describe, expect, it } from "vitest";
import { validateGymSet, validateProgram } from "@/lib/gym/validation";
import type { GymTrackingType } from "@/lib/gym/types";

const base = { clientKey: "00000000-0000-4000-8000-000000000001", setNumber: 1, setType: "working", weightKg: "", repetitions: "", durationSeconds: "", distanceMeters: "", loadMode: null, rir: 2, rpe: 8, completed: true };

describe("gym validation", () => {
  it.each<[GymTrackingType, Record<string, unknown>]>([
    ["weight_reps", { weightKg: 80, repetitions: 8, loadMode: "external" }],
    ["bodyweight_reps", { repetitions: 12 }],
    ["weight_or_bodyweight_reps", { repetitions: 8, loadMode: "assisted", weightKg: 20 }],
    ["reps_only", { repetitions: 20 }],
    ["time", { durationSeconds: 45 }],
    ["weight_time", { weightKg: 20, durationSeconds: 30, loadMode: "external" }],
    ["distance_time", { distanceMeters: 500 }],
    ["weight_distance", { weightKg: 30, distanceMeters: 40, loadMode: "external" }],
    ["time_or_reps", { repetitions: 10 }],
  ])("accepts valid %s sets without false required fields", (trackingType, values) => {
    expect(validateGymSet({ ...base, ...values }, trackingType).completed).toBe(true);
  });

  it("keeps assisted and added load positive and semantically distinct", () => {
    expect(validateGymSet({ ...base, repetitions: 8, loadMode: "added", weightKg: 10 }, "weight_or_bodyweight_reps").loadMode).toBe("added");
    expect(validateGymSet({ ...base, repetitions: 8, loadMode: "assisted", weightKg: 20 }, "weight_or_bodyweight_reps").loadMode).toBe("assisted");
    expect(() => validateGymSet({ ...base, repetitions: 8, loadMode: "assisted", weightKg: -20 }, "weight_or_bodyweight_reps")).toThrow("Gewicht");
    expect(() => validateGymSet({ ...base, repetitions: 8, loadMode: "bodyweight", weightKg: 20 }, "weight_or_bodyweight_reps")).toThrow("ohne kg-Wert");
  });

  it("rejects invalid RIR, RPE, reps, duration and text limits server-side", () => {
    expect(() => validateGymSet({ ...base, weightKg: 80, repetitions: 8, loadMode: "external", rir: 11 }, "weight_reps")).toThrow("RIR");
    expect(() => validateGymSet({ ...base, weightKg: 80, repetitions: 8, loadMode: "external", rpe: 0 }, "weight_reps")).toThrow("RPE");
    expect(() => validateGymSet({ ...base, weightKg: 80, repetitions: 8.5, loadMode: "external" }, "weight_reps")).toThrow("ganzzahlig");
    expect(() => validateGymSet({ ...base, durationSeconds: 100000 }, "time")).toThrow("Dauer");
  });

  it("validates complete program structure and bounds", () => {
    const program = validateProgram({ name: "A/B", description: null, goal: "strength", startDate: "2026-08-17", endDate: null, active: true, days: [{ name: "A", estimatedDurationMinutes: 60, notes: null, exercises: [{ exerciseId: "exercise-1", workingSets: 3, repMin: 4, repMax: 6, targetSeconds: null, targetDistanceMeters: null, targetRir: 2, targetRpe: null, restSeconds: 180, startWeightKg: 40, loadIncrementKg: 2.5, notes: null, warmupNote: null }] }] });
    expect(program.days[0].exercises[0]).toMatchObject({ workingSets: 3, repMin: 4, repMax: 6 });
    expect(() => validateProgram({ ...program, days: [] })).toThrow("1 bis 7");
  });
});

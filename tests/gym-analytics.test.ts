import { describe, expect, it } from "vitest";
import { derivePersonalRecords, estimatedOneRepMax, recommendDoubleProgression } from "@/lib/gym/analytics";
import type { GymPerformanceSet } from "@/lib/gym/types";

function set(overrides: Partial<GymPerformanceSet> = {}): GymPerformanceSet {
  return { id: "set", clientKey: "00000000-0000-4000-8000-000000000001", setNumber: 1, setType: "working", weightKg: 80, repetitions: 8, durationSeconds: null, distanceMeters: null, loadMode: "external", rir: 2, rpe: 8, completed: true, completedAt: "2026-08-17T10:00:00Z", ...overrides };
}

describe("gym analytics", () => {
  it("uses Epley only for sensible weighted rep ranges", () => {
    expect(estimatedOneRepMax(80, 8)).toBe(101.3);
    expect(estimatedOneRepMax(80, 13)).toBeNull();
    expect(estimatedOneRepMax(0, 8)).toBeNull();
  });

  it("derives PRs from completed non-warmup history instead of incremental state", () => {
    expect(derivePersonalRecords([set(), set({ id: "heavy", weightKg: 90, repetitions: 3 }), set({ id: "warmup", setType: "warmup", weightKg: 100, repetitions: 1 }), set({ id: "open", completed: false, weightKg: 120 })])).toEqual({ highestLoadKg: 90, bestRepetitions: 8, bestEstimatedOneRepMaxKg: 101.3 });
  });

  it("recommends deterministic double progression without auto-changing load", () => {
    const upper = [set({ id: "a", repetitions: 12 }), set({ id: "b", setNumber: 2, repetitions: 12 }), set({ id: "c", setNumber: 3, repetitions: 12 })];
    expect(recommendDoubleProgression({ sets: upper, targetSets: 3, repMin: 8, repMax: 12, targetRir: 2, loadIncrementKg: 2.5 })).toMatchObject({ action: "increase", suggestedWeightKg: 82.5 });
    expect(recommendDoubleProgression({ sets: upper.slice(0, 2), targetSets: 3, repMin: 8, repMax: 12, targetRir: 2, loadIncrementKg: 2.5 }).action).toBe("hold");
    expect(recommendDoubleProgression({ sets: upper.map((item) => ({ ...item, repetitions: 5 })), targetSets: 3, repMin: 8, repMax: 12, targetRir: 2, loadIncrementKg: 2.5 }).action).toBe("reduce");
  });
});

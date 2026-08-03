import { describe, expect, it } from "vitest";
import { STRENGTH_WORKOUTS, strengthDescription, strengthSequence, strengthVariantFromTitle } from "../src/lib/planning/strength-plan";

describe("strength planning", () => {
  it("alternates A and B across summer weeks", () => {
    expect(strengthSequence(1, true, null)).toEqual(["A"]);
    expect(strengthSequence(1, true, "A")).toEqual(["B"]);
    expect(strengthSequence(1, true, "B")).toEqual(["A"]);
  });

  it("creates an A/B sequence when two sessions are requested", () => {
    expect(strengthSequence(2, false, "B")).toEqual(["A", "B"]);
  });

  it("keeps the full exercise prescription in the generated workout", () => {
    expect(strengthVariantFromTitle("Krafttraining B")).toBe("B");
    expect(strengthDescription("B")).toContain("Romanian Deadlift: 4 × 5–7");
    expect(STRENGTH_WORKOUTS.A.core).toHaveLength(3);
  });
});

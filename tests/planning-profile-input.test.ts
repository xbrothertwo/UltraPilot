import { describe, expect, it } from "vitest";
import { validatePrimarySportAndWeeklyGoal } from "../src/lib/planning/profile-input";

describe("planning profile input", () => {
  it("requires an explicitly submitted weekly goal when changing sports", () => {
    expect(() => validatePrimarySportAndWeeklyGoal({ currentPrimarySport: "cycling", submittedPrimarySport: "running", submittedWeeklyGoal: null })).toThrow(/neues Wochenziel/);
  });
  it("accepts a sport change with an explicit goal", () => {
    expect(validatePrimarySportAndWeeklyGoal({ currentPrimarySport: "cycling", submittedPrimarySport: "running", submittedWeeklyGoal: "50" })).toEqual({ primarySport: "running", weeklyGoalKm: 50 });
  });
  it("keeps normal saving with an explicit goal compatible", () => {
    expect(validatePrimarySportAndWeeklyGoal({ currentPrimarySport: "cycling", submittedPrimarySport: "cycling", submittedWeeklyGoal: "125" })).toEqual({ primarySport: "cycling", weeklyGoalKm: 125 });
  });
  it("preserves a decimal first-run planning target", () => {
    expect(validatePrimarySportAndWeeklyGoal({ currentPrimarySport: "running", submittedPrimarySport: "running", submittedWeeklyGoal: "8.5" })).toEqual({ primarySport: "running", weeklyGoalKm: 8.5 });
  });
});

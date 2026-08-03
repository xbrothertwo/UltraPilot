import { describe, expect, it } from "vitest";
import { recommendWeeklyTarget, type WeeklyTargetDay } from "../src/lib/planning/weekly-target";

function day(date: string, availableMinutes: number, workday = false): WeeklyTargetDay {
  return { date, availableMinutes, workday, readiness: "unknown" };
}

const base = {
  referenceGoalKm: 125,
  recentFourWeekDistanceKm: 500,
  recentAverageSpeedKmh: 25,
  workdayMaxMinutes: 90,
};

describe("recommendWeeklyTarget", () => {
  it("reduces the target in a week containing only short workday windows", () => {
    const result = recommendWeeklyTarget({ ...base, days: [day("2026-08-03", 120, true), day("2026-08-04", 90, true), day("2026-08-05", 90, true)] });
    expect(result.targetKm).toBe(100);
    expect(result.assessment).toBe("ambitious");
    expect(result.longWindowDays).toBe(0);
  });

  it("raises the target cautiously when several long free windows exist", () => {
    const result = recommendWeeklyTarget({ ...base, days: [day("2026-08-03", 600), day("2026-08-04", 600), day("2026-08-05", 300)] });
    expect(result.targetKm).toBe(145);
    expect(result.assessment).toBe("conservative");
    expect(result.longRideTargetKm).toBeGreaterThanOrEqual(60);
  });

  it("keeps a balanced week close to the reference goal", () => {
    const result = recommendWeeklyTarget({ ...base, days: [day("2026-08-03", 180), day("2026-08-05", 150), day("2026-08-07", 120)] });
    expect(result.targetKm).toBe(125);
    expect(result.assessment).toBe("fitting");
  });

  it("never raises an explicit recovery block target", () => {
    const result = recommendWeeklyTarget({ ...base, blockTargetKm: 100, blockLongRideTargetKm: 40, blockPhase: "recovery", days: [day("2026-08-03", 600), day("2026-08-04", 600), day("2026-08-05", 600)] });
    expect(result.targetKm).toBe(100);
    expect(result.longRideTargetKm).toBeLessThanOrEqual(40);
  });

  it("excludes red readiness days from usable capacity", () => {
    const result = recommendWeeklyTarget({ ...base, days: [{ ...day("2026-08-03", 600), readiness: "red" }, day("2026-08-04", 90, true)] });
    expect(result.availableRideDays).toBe(1);
    expect(result.targetKm).toBeLessThan(125);
  });

  it("never recommends a long ride above half of a very small weekly target", () => {
    const result = recommendWeeklyTarget({ ...base, days: [day("2026-08-03", 45, true)] });
    expect(result.longRideTargetKm).toBeLessThanOrEqual(result.targetKm / 2);
  });
});

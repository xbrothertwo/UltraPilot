import { describe, expect, it } from "vitest";
import { calculateReadiness, type DailyRecoveryMetric } from "../src/lib/recovery-readiness";

const metric = (date: string, heartRate = 50, hrv = 60, sleep = 450): DailyRecoveryMetric => ({ date, sleepStart: `${date}T00:00:00Z`, sleepEnd: `${date}T07:30:00Z`, asleepMinutes: sleep, coreMinutes: 250, deepMinutes: 80, remMinutes: 120, awakeMinutes: 10, sleepingAverageHeartRate: heartRate, sleepingMinimumHeartRate: 44, heartRateSampleCount: 20, hrvSdnnMs: hrv, hrvSampleCount: 2, restingHeartRate: 52 });

describe("daily readiness", () => {
  it("uses personal trends instead of population estimates", () => {
    const history = Array.from({ length: 10 }, (_, index) => metric(`2026-07-${String(index + 20).padStart(2, "0")}`));
    const result = calculateReadiness("2026-08-03", metric("2026-08-03", 58, 35, 360), null, history);
    expect(result.status).toBe("red");
    expect(result.reasons.join(" ")).toContain("Durchschnitts-HF");
    expect(result.reasons.join(" ")).toContain("HRV");
  });

  it("always treats reported pain or illness as red", () => {
    const result = calculateReadiness("2026-08-03", metric("2026-08-03"), { date: "2026-08-03", sleepQuality: 10, generalFatigue: 1, legFatigue: 1, motivation: 10, painOrIllness: true, notes: "" }, []);
    expect(result.status).toBe("red");
  });

  it("returns unknown without measurements or check-in", () => {
    expect(calculateReadiness("2026-08-03", null, null, []).status).toBe("unknown");
  });
});

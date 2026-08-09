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

  it("always treats 'Training aktuell nicht sinnvoll' as red regardless of otherwise good values", () => {
    const result = calculateReadiness("2026-08-03", metric("2026-08-03"), { date: "2026-08-03", sleepQuality: 10, generalFreshness: 10, legFreshness: 10, motivation: 10, wellbeing: 10, symptomLevel: "unsuitable", notes: "" }, []);
    expect(result.status).toBe("red");
  });

  it("returns unknown without measurements or check-in", () => {
    expect(calculateReadiness("2026-08-03", null, null, []).status).toBe("unknown");
  });

  it("uses the same 1=sehr schlecht, 10=sehr gut direction for every scale field", () => {
    const good = calculateReadiness("2026-08-03", null, { date: "2026-08-03", sleepQuality: 10, generalFreshness: 10, legFreshness: 10, motivation: 10, wellbeing: 10, symptomLevel: "none", notes: "" }, []);
    const bad = calculateReadiness("2026-08-03", null, { date: "2026-08-03", sleepQuality: 1, generalFreshness: 1, legFreshness: 1, motivation: 1, wellbeing: 1, symptomLevel: "none", notes: "" }, []);
    expect(good.score!).toBeGreaterThan(bad.score!);
    expect(good.status).toBe("green");
    expect(bad.status).toBe("red");
  });

  it("scales symptom severity instead of forcing red for mild complaints", () => {
    const mild = calculateReadiness("2026-08-03", null, { date: "2026-08-03", sleepQuality: 8, generalFreshness: 8, legFreshness: 8, motivation: 8, wellbeing: 8, symptomLevel: "mild", notes: "" }, []);
    expect(mild.status).not.toBe("red");
    expect(mild.reasons.join(" ")).toContain("Leichte Beschwerden");
  });

  it("pulls significant complaints toward red without unconditionally forcing it", () => {
    const result = calculateReadiness("2026-08-03", null, { date: "2026-08-03", sleepQuality: 8, generalFreshness: 8, legFreshness: 8, motivation: 8, wellbeing: 8, symptomLevel: "significant", notes: "" }, []);
    expect(result.reasons.join(" ")).toContain("Deutliche Beschwerden");
    expect(result.score!).toBeLessThan(80);
  });
});

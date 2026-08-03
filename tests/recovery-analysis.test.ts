import { describe, expect, it } from "vitest";
import { buildRecoveryTrend, summarizeRecovery } from "../src/lib/recovery-analysis";
import type { DailyRecoveryMetric, ReadinessResult } from "../src/lib/recovery-readiness";

const metric: DailyRecoveryMetric = { date: "2026-08-02", sleepStart: "2026-08-01T22:00:00Z", sleepEnd: "2026-08-02T06:00:00Z", asleepMinutes: 450, coreMinutes: 240, deepMinutes: 80, remMinutes: 100, awakeMinutes: 20, sleepingAverageHeartRate: 52, sleepingMinimumHeartRate: 45, heartRateSampleCount: 18, hrvSdnnMs: 61, hrvSampleCount: 2, restingHeartRate: 53 };
const readiness: ReadinessResult = { date: "2026-08-02", status: "green", score: 86, reasons: [], metric, checkin: null };

describe("recovery statistics", () => {
  it("keeps missing nights as null gaps and separates sleep stages", () => {
    const trend = buildRecoveryTrend(["2026-08-01", "2026-08-02"], [metric], [readiness]);
    expect(trend[0].sleepHours).toBeNull();
    expect(trend[1].sleepHours).toBe(7.5);
    expect(trend[1].unspecifiedHours).toBe(0.5);
  });

  it("averages only measured nights", () => {
    const trend = buildRecoveryTrend(["2026-08-01", "2026-08-02"], [metric], [readiness]);
    expect(summarizeRecovery(trend)).toMatchObject({ trackedNights: 1, averageSleepHours: 7.5, averageSleepingHeartRate: 52, averageHrvSdnnMs: 61, nightsWithHeartRate: 1, greenDays: 1 });
  });
});

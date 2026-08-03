import type { DailyRecoveryMetric, ReadinessResult, ReadinessStatus } from "./recovery-readiness";

export type RecoveryTrendPoint = {
  date: string;
  sleepHours: number | null;
  coreHours: number | null;
  deepHours: number | null;
  remHours: number | null;
  unspecifiedHours: number | null;
  sleepingAverageHeartRate: number | null;
  sleepingMinimumHeartRate: number | null;
  heartRateSampleCount: number;
  hrvSdnnMs: number | null;
  readinessScore: number | null;
  readinessStatus: ReadinessStatus;
};

export type RecoverySummary = {
  trackedNights: number;
  averageSleepHours: number | null;
  averageSleepingHeartRate: number | null;
  averageHrvSdnnMs: number | null;
  nightsWithHeartRate: number;
  greenDays: number;
  yellowDays: number;
  redDays: number;
};

function rounded(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function average(values: number[]): number | null {
  return values.length ? rounded(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
}

export function buildRecoveryTrend(days: string[], metrics: DailyRecoveryMetric[], readiness: ReadinessResult[]): RecoveryTrendPoint[] {
  return days.map((date) => {
    const metric = metrics.find((item) => item.date === date) ?? null;
    const dailyReadiness = readiness.find((item) => item.date === date) ?? null;
    const stagedMinutes = metric ? metric.coreMinutes + metric.deepMinutes + metric.remMinutes : 0;
    return {
      date,
      sleepHours: metric ? rounded(metric.asleepMinutes / 60, 2) : null,
      coreHours: metric ? rounded(metric.coreMinutes / 60, 2) : null,
      deepHours: metric ? rounded(metric.deepMinutes / 60, 2) : null,
      remHours: metric ? rounded(metric.remMinutes / 60, 2) : null,
      unspecifiedHours: metric ? rounded(Math.max(0, metric.asleepMinutes - stagedMinutes) / 60, 2) : null,
      sleepingAverageHeartRate: metric?.sleepingAverageHeartRate ?? null,
      sleepingMinimumHeartRate: metric?.sleepingMinimumHeartRate ?? null,
      heartRateSampleCount: metric?.heartRateSampleCount ?? 0,
      hrvSdnnMs: metric?.hrvSdnnMs ?? null,
      readinessScore: dailyReadiness?.score ?? null,
      readinessStatus: dailyReadiness?.status ?? "unknown",
    };
  });
}

export function summarizeRecovery(trend: RecoveryTrendPoint[]): RecoverySummary {
  const tracked = trend.filter((item) => item.sleepHours !== null);
  return {
    trackedNights: tracked.length,
    averageSleepHours: average(tracked.flatMap((item) => item.sleepHours === null ? [] : [item.sleepHours])),
    averageSleepingHeartRate: average(tracked.flatMap((item) => item.sleepingAverageHeartRate === null ? [] : [item.sleepingAverageHeartRate])),
    averageHrvSdnnMs: average(tracked.flatMap((item) => item.hrvSdnnMs === null ? [] : [item.hrvSdnnMs])),
    nightsWithHeartRate: tracked.filter((item) => item.heartRateSampleCount > 0).length,
    greenDays: trend.filter((item) => item.readinessStatus === "green").length,
    yellowDays: trend.filter((item) => item.readinessStatus === "yellow").length,
    redDays: trend.filter((item) => item.readinessStatus === "red").length,
  };
}

import { attributes, parseAppleDate } from "./xml-parser";

const SLEEP = "HKCategoryTypeIdentifierSleepAnalysis";
const HEART_RATE = "HKQuantityTypeIdentifierHeartRate";
const HRV = "HKQuantityTypeIdentifierHeartRateVariabilitySDNN";
const RESTING_HEART_RATE = "HKQuantityTypeIdentifierRestingHeartRate";

type SleepStage = "core" | "deep" | "rem" | "awake" | "asleep";
type Interval = { start: number; end: number; stage: SleepStage };
type ValueSample = { timestamp: number; value: number };

export type AppleHealthDailyRecovery = {
  date: string;
  sleepStart: string;
  sleepEnd: string;
  asleepMinutes: number;
  coreMinutes: number;
  deepMinutes: number;
  remMinutes: number;
  awakeMinutes: number;
  sleepingAverageHeartRate: number | null;
  sleepingMinimumHeartRate: number | null;
  heartRateSampleCount: number;
  hrvSdnnMs: number | null;
  hrvSampleCount: number;
  restingHeartRate: number | null;
};

function localDateKey(milliseconds: number): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(milliseconds));
}

function sleepStage(value: string): SleepStage | null {
  if (value.endsWith("AsleepCore")) return "core";
  if (value.endsWith("AsleepDeep")) return "deep";
  if (value.endsWith("AsleepREM")) return "rem";
  if (value.endsWith("Awake")) return "awake";
  if (value.endsWith("Asleep") || value.endsWith("AsleepUnspecified")) return "asleep";
  return null;
}

function mergedMinutes(intervals: Interval[]): number {
  const sorted = intervals.map(({ start, end }) => ({ start, end })).sort((a, b) => a.start - b.start);
  const merged: Array<{ start: number; end: number }> = [];
  for (const interval of sorted) {
    const last = merged.at(-1);
    if (last && interval.start <= last.end) last.end = Math.max(last.end, interval.end);
    else merged.push({ ...interval });
  }
  return Math.round(merged.reduce((sum, interval) => sum + interval.end - interval.start, 0) / 60_000);
}

function average(samples: ValueSample[]): number | null {
  if (!samples.length) return null;
  return Math.round(samples.reduce((sum, sample) => sum + sample.value, 0) / samples.length * 10) / 10;
}

function isInside(timestamp: number, intervals: Interval[]): boolean {
  return intervals.some((interval) => timestamp >= interval.start && timestamp <= interval.end);
}

export class AppleHealthRecoveryParser {
  private readonly decoder = new TextDecoder();
  private readonly sleep: Interval[] = [];
  private readonly heartRate: ValueSample[] = [];
  private readonly hrv: ValueSample[] = [];
  private readonly restingHeartRate: ValueSample[] = [];
  private buffer = "";

  constructor(private readonly cutoffMilliseconds = Date.now() - 120 * 86_400_000) {}

  push(chunk: Uint8Array, final = false): void {
    this.buffer += this.decoder.decode(chunk, { stream: !final });
    const tagPattern = /<[^>]+>/g;
    let lastCompleteTagEnd = 0;
    for (const match of this.buffer.matchAll(tagPattern)) {
      lastCompleteTagEnd = (match.index ?? 0) + match[0].length;
      if (!match[0].startsWith("<Record")) continue;
      const fields = attributes(match[0]);
      const start = parseAppleDate(fields.startDate ?? "");
      const end = parseAppleDate(fields.endDate ?? fields.startDate ?? "");
      if (!start || !end || end.getTime() < this.cutoffMilliseconds) continue;
      if (fields.type === SLEEP) {
        const stage = sleepStage(fields.value ?? "");
        if (stage && end > start) this.sleep.push({ start: start.getTime(), end: end.getTime(), stage });
        continue;
      }
      const value = Number(fields.value);
      if (!Number.isFinite(value) || value <= 0) continue;
      const sample = { timestamp: start.getTime(), value };
      if (fields.type === HEART_RATE && value <= 300) this.heartRate.push(sample);
      else if (fields.type === HRV && value <= 1000) this.hrv.push(sample);
      else if (fields.type === RESTING_HEART_RATE && value <= 300) this.restingHeartRate.push(sample);
    }
    if (lastCompleteTagEnd > 0) this.buffer = this.buffer.slice(lastCompleteTagEnd);
    if (this.buffer.length > 65_536) this.buffer = this.buffer.slice(Math.max(0, this.buffer.lastIndexOf("<")));
  }

  result(): AppleHealthDailyRecovery[] {
    const groups = new Map<string, Interval[]>();
    for (const interval of this.sleep) {
      const key = localDateKey(interval.end);
      groups.set(key, [...(groups.get(key) ?? []), interval]);
    }
    return [...groups.entries()].filter(([, intervals]) => intervals.some((interval) => interval.stage !== "awake")).map(([date, intervals]) => {
      const detailedAsleep = intervals.filter((interval) => interval.stage === "core" || interval.stage === "deep" || interval.stage === "rem");
      const asleepIntervals = detailedAsleep.length ? detailedAsleep : intervals.filter((interval) => interval.stage === "asleep");
      const start = Math.min(...asleepIntervals.map((interval) => interval.start));
      const end = Math.max(...asleepIntervals.map((interval) => interval.end));
      const sleepingHeartRate = this.heartRate.filter((sample) => isInside(sample.timestamp, asleepIntervals));
      const sleepingHrv = this.hrv.filter((sample) => isInside(sample.timestamp, asleepIntervals));
      const dailyResting = this.restingHeartRate.filter((sample) => localDateKey(sample.timestamp) === date);
      return {
        date,
        sleepStart: new Date(start).toISOString(),
        sleepEnd: new Date(end).toISOString(),
        asleepMinutes: mergedMinutes(asleepIntervals),
        coreMinutes: mergedMinutes(intervals.filter((interval) => interval.stage === "core")),
        deepMinutes: mergedMinutes(intervals.filter((interval) => interval.stage === "deep")),
        remMinutes: mergedMinutes(intervals.filter((interval) => interval.stage === "rem")),
        awakeMinutes: mergedMinutes(intervals.filter((interval) => interval.stage === "awake")),
        sleepingAverageHeartRate: average(sleepingHeartRate),
        sleepingMinimumHeartRate: sleepingHeartRate.length ? Math.min(...sleepingHeartRate.map((sample) => sample.value)) : null,
        heartRateSampleCount: sleepingHeartRate.length,
        hrvSdnnMs: average(sleepingHrv),
        hrvSampleCount: sleepingHrv.length,
        restingHeartRate: average(dailyResting),
      };
    }).filter((metric) => metric.asleepMinutes > 0).sort((a, b) => a.date.localeCompare(b.date));
  }
}

import type { Activity } from "./demo-data";
import type { SensorSample } from "./activity-files/types";
import { calculateTimeInZones, calculateTrainingLoad, getHeartRateZones, type TrainingProfile } from "./training-zones";

export type LoadMethod = "power" | "heart_rate" | "rpe" | "unavailable";
export type LoadLevel = "light" | "moderate" | "high" | "unavailable";
export type LoadStream = { activityId: string; type: "heart_rate" | "power"; samples: SensorSample[] };
export type LoadFeedback = { activityId: string; perceivedExertion: number | null };
export type ActivityLoad = {
  activityId: string; activityDate: string; title: string; distanceKilometers: number; durationMinutes: number;
  points: number | null; method: LoadMethod; level: LoadLevel; coveragePercent: number | null; detail: string;
};
export type TrainingLoadTrend = { date: string; loadPoints: number | null; rollingSevenDayLoad: number; level: LoadLevel; activityCount: number };
export type TrainingLoadSummary = {
  trend: TrainingLoadTrend[]; activities: ActivityLoad[]; sevenDayLoad: number; fourWeekWeeklyAverage: number; comparisonPercent: number | null;
  measuredActivities: number; totalActivities: number; highLoadDates: string[]; methods: Record<Exclude<LoadMethod, "unavailable">, number>;
};
export type PlannedLoadComparison = "lower" | "as_planned" | "higher" | "unavailable";

const HEART_RATE_WEIGHTS = [0.4, 0.8, 1.2, 1.6, 2];
const PLANNED_INTENSITY_POINTS_PER_MINUTE: Record<string, number> = { recovery: 0.4, easy: 0.6, endurance: 0.8, tempo: 1.2, threshold: 1.6, vo2: 2 };

function rounded(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function dateKey(value: string): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}

function absoluteLevel(points: number | null): LoadLevel {
  if (points === null) return "unavailable";
  return points < 50 ? "light" : points <= 100 ? "moderate" : "high";
}

export function compareLoadToPlan(points: number | null, intensity: string, durationMinutes: number | null): { comparison: PlannedLoadComparison; expectedPoints: number | null } {
  const rate = PLANNED_INTENSITY_POINTS_PER_MINUTE[intensity];
  if (points === null || !rate || durationMinutes === null || durationMinutes <= 0) return { comparison: "unavailable", expectedPoints: null };
  const expectedPoints = rounded(durationMinutes * rate);
  const ratio = points / expectedPoints;
  return { comparison: ratio > 1.25 ? "higher" : ratio < 0.75 ? "lower" : "as_planned", expectedPoints };
}

function calculateSingleLoad(activity: Activity, feedback: LoadFeedback | undefined, streams: LoadStream[], profile: TrainingProfile): Omit<ActivityLoad, "level"> {
  const durationMinutes = activity.movingTimeSeconds / 60;
  const power = calculateTrainingLoad(activity.normalizedPower, activity.movingTimeSeconds, profile.ftpWatts);
  if (power && power.intensityFactor <= 2.5) return { activityId: activity.id, activityDate: activity.activityDate, title: activity.title, distanceKilometers: activity.distanceMeters / 1000, durationMinutes, points: rounded(power.tss), method: "power", coveragePercent: null, detail: `Power-TSS aus NP ${activity.normalizedPower} W und FTP ${profile.ftpWatts} W.` };

  const definitions = getHeartRateZones(profile);
  const heartRateStreams = streams.filter((stream) => stream.activityId === activity.id && stream.type === "heart_rate");
  if (definitions && heartRateStreams.length) {
    const candidates = heartRateStreams.map((stream) => {
      const zones = calculateTimeInZones(stream.samples, definitions);
      const coveredSeconds = zones.reduce((sum, zone) => sum + zone.seconds, 0);
      const points = zones.reduce((sum, zone, index) => sum + zone.seconds / 60 * (HEART_RATE_WEIGHTS[index] ?? HEART_RATE_WEIGHTS.at(-1)!), 0);
      return { coveredSeconds, points };
    }).sort((a, b) => b.coveredSeconds - a.coveredSeconds);
    const best = candidates[0];
    const coverage = activity.movingTimeSeconds > 0 ? best.coveredSeconds / activity.movingTimeSeconds : 0;
    if (coverage >= 0.5) return { activityId: activity.id, activityDate: activity.activityDate, title: activity.title, distanceKilometers: activity.distanceMeters / 1000, durationMinutes, points: rounded(best.points), method: "heart_rate", coveragePercent: rounded(coverage * 100, 0), detail: `Zeit in persönlichen HF-Zonen, ${rounded(coverage * 100, 0)} % der Bewegungszeit erfasst.` };
  }

  const rpe = feedback?.perceivedExertion;
  if (rpe !== null && rpe !== undefined && Number.isFinite(rpe) && rpe >= 1 && rpe <= 10) return { activityId: activity.id, activityDate: activity.activityDate, title: activity.title, distanceKilometers: activity.distanceMeters / 1000, durationMinutes, points: rounded(durationMinutes * rpe / 5), method: "rpe", coveragePercent: null, detail: `${rounded(durationMinutes, 0)} min × RPE ${rpe} ÷ 5.` };
  return { activityId: activity.id, activityDate: activity.activityDate, title: activity.title, distanceKilometers: activity.distanceMeters / 1000, durationMinutes, points: null, method: "unavailable", coveragePercent: null, detail: "Keine belastbare Power-, HF-Zonen- oder RPE-Grundlage." };
}

function personalLevel(points: number | null, previous: number[]): LoadLevel {
  if (points === null) return "unavailable";
  if (previous.length < 5) return absoluteLevel(points);
  const sorted = [...previous].sort((a, b) => a - b);
  const lightBoundary = sorted[Math.floor((sorted.length - 1) * 0.35)];
  const highBoundary = sorted[Math.floor((sorted.length - 1) * 0.75)];
  return points <= lightBoundary ? "light" : points >= highBoundary ? "high" : "moderate";
}

export function calculateActivityLoads(activities: Activity[], feedback: LoadFeedback[], streams: LoadStream[], profile: TrainingProfile): ActivityLoad[] {
  const chronological = [...activities].sort((a, b) => a.activityDate.localeCompare(b.activityDate));
  const calculated: ActivityLoad[] = [];
  for (const activity of chronological) {
    const base = calculateSingleLoad(activity, feedback.find((item) => item.activityId === activity.id), streams, profile);
    const activityTime = new Date(activity.activityDate).getTime();
    const previous = calculated.filter((item) => item.points !== null && new Date(item.activityDate).getTime() >= activityTime - 28 * 86_400_000).map((item) => item.points!);
    calculated.push({ ...base, level: personalLevel(base.points, previous) });
  }
  return calculated;
}

function dayRange(count: number, today: string): string[] {
  const end = new Date(`${today}T12:00:00Z`);
  return Array.from({ length: count }, (_, index) => { const date = new Date(end); date.setUTCDate(date.getUTCDate() - count + index + 1); return date.toISOString().slice(0, 10); });
}

export function summarizeTrainingLoad(loads: ActivityLoad[], days: 7 | 28 | 90, today: string): TrainingLoadSummary {
  const range = dayRange(days, today);
  const sevenStart = new Date(`${today}T12:00:00Z`); sevenStart.setUTCDate(sevenStart.getUTCDate() - 6);
  const fourWeekStart = new Date(`${today}T12:00:00Z`); fourWeekStart.setUTCDate(fourWeekStart.getUTCDate() - 27);
  const pointsInRange = (start: Date, endKey = today) => loads.filter((item) => item.points !== null && dateKey(item.activityDate) >= start.toISOString().slice(0, 10) && dateKey(item.activityDate) <= endKey).reduce((sum, item) => sum + item.points!, 0);
  const sevenDayLoad = rounded(pointsInRange(sevenStart));
  const fourWeekWeeklyAverage = rounded(pointsInRange(fourWeekStart) / 4);
  const trend = range.map((date) => {
    const daily = loads.filter((item) => dateKey(item.activityDate) === date);
    const measured = daily.filter((item) => item.points !== null);
    const points = measured.length ? rounded(measured.reduce((sum, item) => sum + item.points!, 0)) : null;
    const rollingStart = new Date(`${date}T12:00:00Z`); rollingStart.setUTCDate(rollingStart.getUTCDate() - 6);
    return { date, loadPoints: points, rollingSevenDayLoad: rounded(pointsInRange(rollingStart, date)), level: absoluteLevel(points), activityCount: daily.length };
  });
  const selectedLoads = loads.filter((item) => range.includes(dateKey(item.activityDate)));
  return {
    trend,
    activities: [...selectedLoads].sort((a, b) => b.activityDate.localeCompare(a.activityDate)),
    sevenDayLoad,
    fourWeekWeeklyAverage,
    comparisonPercent: fourWeekWeeklyAverage > 0 ? rounded((sevenDayLoad - fourWeekWeeklyAverage) / fourWeekWeeklyAverage * 100, 0) : null,
    measuredActivities: selectedLoads.filter((item) => item.points !== null).length,
    totalActivities: selectedLoads.length,
    highLoadDates: selectedLoads.filter((item) => item.level === "high").map((item) => dateKey(item.activityDate)),
    methods: { power: selectedLoads.filter((item) => item.method === "power").length, heart_rate: selectedLoads.filter((item) => item.method === "heart_rate").length, rpe: selectedLoads.filter((item) => item.method === "rpe").length },
  };
}

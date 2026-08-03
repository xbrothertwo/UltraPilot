import type { SensorSample } from "@/lib/activity-files/types";
import { calculateAppleHealthRecovery, type AppleHealthDailyRecovery, type AppleHealthRecoverySamples, type SleepStage } from "./recovery-parser";
import type { AppleHealthWorkoutPayload } from "./workout-parser";

type InputRecord = Record<string, unknown>;

export type AppleHealthShortcutExtraction = {
  recovery: AppleHealthDailyRecovery[];
  workouts: AppleHealthWorkoutPayload[];
  ignoredCyclingCount: number;
  ignoredUnsupportedCount: number;
  recordCount: number;
};

const workoutTypes = {
  running: { activityType: "HKWorkoutActivityTypeRunning", sportType: "running", title: "Lauf" },
  strength: { activityType: "HKWorkoutActivityTypeTraditionalStrengthTraining", sportType: "strength", title: "Krafttraining" },
  volleyball: { activityType: "HKWorkoutActivityTypeVolleyball", sportType: "volleyball", title: "Volleyball" },
} as const;

const cyclingNames = new Set(["cycling", "cycle", "radfahren", "fahrrad", "hkworkoutactivitytypecycling", "hkworkoutactivitytypehandcycling"]);

function object(value: unknown): InputRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("Ein Health-Datensatz ist ungültig.");
  return value as InputRecord;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function date(value: unknown, label: string): string {
  const parsed = new Date(text(value));
  if (Number.isNaN(parsed.getTime())) throw new Error(`${label} ist ungültig. Nutze im Kurzbefehl das ISO-8601-Datumsformat.`);
  const oldest = Date.now() - 14 * 86_400_000;
  const newest = Date.now() + 86_400_000;
  if (parsed.getTime() < oldest || parsed.getTime() > newest) throw new Error(`${label} liegt außerhalb des erlaubten 14-Tage-Fensters.`);
  return parsed.toISOString();
}

function number(value: unknown, minimum: number, maximum: number, label: string): number {
  const input = text(value).replace(",", ".");
  const parsed = typeof value === "number" ? value : Number.isFinite(Number(input)) ? Number(input) : Number.parseFloat(input);
  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) throw new Error(`${label} ist ungültig.`);
  return parsed;
}

function optionalNumber(value: unknown, minimum: number, maximum: number, label: string): number | null {
  if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) return null;
  return number(value, minimum, maximum, label);
}

function normalized(value: unknown): string {
  const input = typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
  return input.toLocaleLowerCase("de-DE").replace(/[\s_\-–]+/g, "");
}

function stage(value: unknown): SleepStage | null {
  const key = normalized(value);
  if (["3", "core", "kern", "asleepcore", "hkcategoryvaluesleepanalysisasleepcore"].includes(key)) return "core";
  if (["4", "deep", "tief", "tiefschlaf", "asleepdeep", "hkcategoryvaluesleepanalysisasleepdeep"].includes(key)) return "deep";
  if (["5", "rem", "asleeprem", "hkcategoryvaluesleepanalysisasleeprem"].includes(key)) return "rem";
  if (["2", "awake", "wach", "hkcategoryvaluesleepanalysisawake"].includes(key)) return "awake";
  if (["1", "asleep", "schlaf", "schlafend", "asleepunspecified", "hkcategoryvaluesleepanalysisasleepunspecified"].includes(key)) return "asleep";
  return null;
}

function workoutType(value: unknown): keyof typeof workoutTypes | "cycling" | null {
  const key = normalized(value);
  if (cyclingNames.has(key) || key.includes("cycling") || key.includes("radfahr")) return "cycling";
  if (["running", "run", "laufen", "lauf", "hkworkoutactivitytyperunning"].includes(key) || key.includes("running") || key.includes("laufen")) return "running";
  if (["strength", "strengthtraining", "kraft", "krafttraining", "funktionelleskrafttraining", "traditionalstrengthtraining", "functionalstrengthtraining", "coretraining", "hkworkoutactivitytypetraditionalstrengthtraining", "hkworkoutactivitytypefunctionalstrengthtraining", "hkworkoutactivitytypecoretraining"].includes(key) || key.includes("strength") || key.includes("krafttraining")) return "strength";
  if (["volleyball", "volley", "hkworkoutactivitytypevolleyball"].includes(key) || key.includes("volleyball")) return "volleyball";
  return null;
}

function inRange(samples: SensorSample[], startTime: string, endTime: string): SensorSample[] {
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  return samples.filter((sample) => { const time = new Date(sample.timestamp).getTime(); return time >= start && time <= end; });
}

export function parseAppleHealthShortcutPayload(value: unknown): AppleHealthShortcutExtraction {
  const payload = object(value);
  if (payload.version !== 1) throw new Error("Diese Shortcut-Version wird nicht unterstützt.");
  if (!Array.isArray(payload.records) || payload.records.length < 1 || payload.records.length > 5_000) throw new Error("Der Kurzbefehl muss 1 bis 5.000 Datensätze senden.");

  const recoverySamples: AppleHealthRecoverySamples = { sleep: [], heartRate: [], hrv: [], restingHeartRate: [] };
  const workoutRecords: Array<{ row: InputRecord; startTime: string; endTime: string; type: keyof typeof workoutTypes }> = [];
  let ignoredCyclingCount = 0;
  let ignoredUnsupportedCount = 0;

  for (const input of payload.records) {
    const row = object(input);
    const kind = normalized(row.kind);
    if (kind === "sleep") {
      const sleepStage = stage(row.value);
      if (!sleepStage) { ignoredUnsupportedCount += 1; continue; }
      const startTime = date(row.start, "Schlafbeginn");
      const endTime = date(row.end, "Schlafende");
      if (new Date(endTime) <= new Date(startTime)) throw new Error("Das Schlafende muss nach dem Schlafbeginn liegen.");
      recoverySamples.sleep.push({ startTime, endTime, stage: sleepStage });
      continue;
    }
    if (kind === "heartrate" || kind === "heart_rate" || kind === "herzfrequenz") {
      recoverySamples.heartRate.push({ timestamp: date(row.start, "HF-Zeitpunkt"), value: number(row.value, 20, 260, "Herzfrequenz") });
      continue;
    }
    if (kind === "hrv") {
      recoverySamples.hrv.push({ timestamp: date(row.start, "HRV-Zeitpunkt"), value: number(row.value, 1, 1_000, "HRV") });
      continue;
    }
    if (kind === "restingheartrate" || kind === "resting_heart_rate" || kind === "ruhepuls") {
      recoverySamples.restingHeartRate.push({ timestamp: date(row.start, "Ruhepuls-Zeitpunkt"), value: number(row.value, 20, 260, "Ruhepuls") });
      continue;
    }
    if (kind === "workout" || kind === "training") {
      const type = workoutType(row.value ?? row.sport);
      if (type === "cycling") { ignoredCyclingCount += 1; continue; }
      if (!type) { ignoredUnsupportedCount += 1; continue; }
      const startTime = date(row.start, "Workout-Beginn");
      const endTime = date(row.end, "Workout-Ende");
      if (new Date(endTime) <= new Date(startTime)) throw new Error("Das Workout-Ende muss nach dem Beginn liegen.");
      workoutRecords.push({ row, startTime, endTime, type });
      continue;
    }
    ignoredUnsupportedCount += 1;
  }

  const heartRateSamples = recoverySamples.heartRate.map((sample) => ({ timestamp: sample.timestamp, value: sample.value })).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const workouts = workoutRecords.map(({ row, startTime, endTime, type }): AppleHealthWorkoutPayload => {
    const definition = workoutTypes[type];
    const elapsedTimeSeconds = Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 1_000);
    const durationMinutes = optionalNumber(row.durationMinutes ?? row.duration, 0.01, 2_880, "Workout-Dauer");
    const movingTimeSeconds = Math.max(1, Math.min(elapsedTimeSeconds, Math.round((durationMinutes ?? elapsedTimeSeconds / 60) * 60)));
    const distanceKm = definition.sportType === "running" ? optionalNumber(row.distanceKm ?? row.distance, 0, 1_000, "Laufdistanz") ?? 0 : 0;
    return {
      activityType: definition.activityType,
      sportType: definition.sportType,
      title: text(row.title).slice(0, 200) || definition.title,
      sourceName: text(row.source).slice(0, 200) || "Apple Health Shortcut",
      startTime,
      endTime,
      movingTimeSeconds,
      elapsedTimeSeconds,
      distanceMeters: distanceKm * 1_000,
      energyKilocalories: optionalNumber(row.energyKilocalories ?? row.energy, 0, 100_000, "Energie"),
      heartRateSamples: inRange(heartRateSamples, startTime, endTime),
    };
  });

  return {
    recovery: calculateAppleHealthRecovery(recoverySamples),
    workouts,
    ignoredCyclingCount,
    ignoredUnsupportedCount,
    recordCount: payload.records.length,
  };
}

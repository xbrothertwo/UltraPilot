import type { ActivityStream, SensorSample, StreamType } from "@/lib/activity-files/types";
import { requireUser } from "@/lib/supabase/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { downsampleMinMax } from "@/lib/stream-processing";
import { extractGpxSensorSamples } from "@/lib/gpx/parser";

export type ChartPoint = {
  elapsedMinutes: number;
  timestamp: string;
  value: number;
};

export type ActivityChartStream = {
  type: StreamType;
  source: ActivityStream["source"];
  unit: "bpm" | "W" | "rpm" | "km/h" | "min/km" | "m";
  originalSampleCount: number;
  renderedSampleCount: number;
  coveragePercent: number;
  points: ChartPoint[];
};

type StreamRow = {
  stream_type: unknown;
  source: unknown;
  unit: unknown;
  sample_count: unknown;
  samples: unknown;
};

export type RawActivityStream = {
  type: StreamType;
  source: ActivityStream["source"];
  samples: SensorSample[];
};

const streamTypes: StreamType[] = ["heart_rate", "power", "cadence", "speed", "altitude"];
const sources: ActivityStream["source"][] = ["garmin_edge", "apple_watch", "gpx"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function validSamples(value: unknown): SensorSample[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((sample) => {
    if (!isRecord(sample) || typeof sample.timestamp !== "string" || typeof sample.value !== "number") return [];
    const timestamp = new Date(sample.timestamp);
    if (Number.isNaN(timestamp.getTime()) || !Number.isFinite(sample.value)) return [];
    return [{ timestamp: timestamp.toISOString(), value: sample.value }];
  }).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

function convertValue(type: StreamType, value: number, displayPace: boolean): number {
  if (type !== "speed") return value;
  return displayPace ? 1000 / (value * 60) : value * 3.6;
}

function displayUnit(type: StreamType, displayPace: boolean): ActivityChartStream["unit"] {
  return { heart_rate: "bpm", power: "W", cadence: "rpm", speed: displayPace ? "min/km" : "km/h", altitude: "m" }[type] as ActivityChartStream["unit"];
}

export async function getActivityChartStreams(activityId: string, activityStart: string, elapsedTimeSeconds: number, displayPace = false): Promise<ActivityChartStream[]> {
  if (!isSupabaseConfigured()) return [];
  await requireUser();
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase.from("activity_streams").select("stream_type,source,unit,sample_count,samples").eq("activity_id", activityId);
  if (error) throw new Error(`Zeitreihen konnten nicht geladen werden: ${error.message}`);
  const rows = [...((data ?? []) as StreamRow[])];
  const existingTypes = new Set(rows.map((row) => row.stream_type));
  if (!existingTypes.has("altitude") || !existingTypes.has("speed")) {
    const { data: fileRow } = await supabase.from("activity_files").select("storage_path,file_type").eq("activity_id", activityId).eq("file_type", "gpx").limit(1).maybeSingle();
    if (fileRow?.storage_path) {
      const { data: originalFile } = await supabase.storage.from("activity-files").download(fileRow.storage_path);
      if (originalFile) {
        const fallback = extractGpxSensorSamples(await originalFile.text());
        if (!existingTypes.has("heart_rate") && fallback.heartRate.length) rows.push({ stream_type: "heart_rate", source: "gpx", unit: "bpm", sample_count: fallback.heartRate.length, samples: fallback.heartRate });
        if (!existingTypes.has("speed") && fallback.speed.length) rows.push({ stream_type: "speed", source: "gpx", unit: "mps", sample_count: fallback.speed.length, samples: fallback.speed });
        if (!existingTypes.has("altitude") && fallback.altitude.length) rows.push({ stream_type: "altitude", source: "gpx", unit: "meter", sample_count: fallback.altitude.length, samples: fallback.altitude });
      }
    }
  }
  const startMilliseconds = new Date(activityStart).getTime();
  return rows.flatMap((row) => {
    if (typeof row.stream_type !== "string" || !streamTypes.includes(row.stream_type as StreamType)) return [];
    if (typeof row.source !== "string" || !sources.includes(row.source as ActivityStream["source"])) return [];
    const type = row.stream_type as StreamType;
    const allSamples = validSamples(row.samples).filter((sample) => type !== "speed" || !displayPace || sample.value >= 0.5);
    if (!allSamples.length) return [];
    const reduced = downsampleMinMax(allSamples);
    const firstTime = new Date(allSamples[0].timestamp).getTime();
    const lastTime = new Date(allSamples.at(-1)!.timestamp).getTime();
    const coverageSeconds = Math.max(0, lastTime - firstTime) / 1000;
    return [{
      type,
      source: row.source as ActivityStream["source"],
      unit: displayUnit(type, displayPace),
      originalSampleCount: typeof row.sample_count === "number" ? row.sample_count : allSamples.length,
      renderedSampleCount: reduced.length,
      coveragePercent: elapsedTimeSeconds > 0 ? Math.min(100, coverageSeconds / elapsedTimeSeconds * 100) : 0,
      points: reduced.map((sample) => ({ timestamp: sample.timestamp, elapsedMinutes: Math.max(0, (new Date(sample.timestamp).getTime() - startMilliseconds) / 60_000), value: convertValue(type, sample.value, displayPace) })),
    }];
  }).sort((a, b) => streamTypes.indexOf(a.type) - streamTypes.indexOf(b.type));
}

export async function getRawActivityStreams(activityId: string): Promise<RawActivityStream[]> {
  if (!isSupabaseConfigured()) return [];
  await requireUser();
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase.from("activity_streams").select("stream_type,source,samples").eq("activity_id", activityId).in("stream_type", ["heart_rate", "power"]);
  if (error) return [];
  return ((data ?? []) as StreamRow[]).flatMap((row) => {
    if (typeof row.stream_type !== "string" || !streamTypes.includes(row.stream_type as StreamType)) return [];
    if (typeof row.source !== "string" || !sources.includes(row.source as ActivityStream["source"])) return [];
    const samples = validSamples(row.samples);
    return samples.length ? [{ type: row.stream_type as StreamType, source: row.source as ActivityStream["source"], samples }] : [];
  });
}

import type { ParsedActivityFile, SensorSample } from "@/lib/activity-files/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseHeartRateJson(text: string): ParsedActivityFile {
  const value: unknown = JSON.parse(text);
  if (!isRecord(value) || value.format !== "ultrapilot-heart-rate-v1" || !Array.isArray(value.samples)) throw new Error("Die lokale Herzfrequenzdatei besitzt ein ungültiges Format.");
  if (value.samples.length === 0 || value.samples.length > 500_000) throw new Error("Die lokale Herzfrequenzdatei enthält keine gültige Sample-Anzahl.");
  const samples: SensorSample[] = value.samples.map((sample) => {
    if (!isRecord(sample) || typeof sample.timestamp !== "string" || typeof sample.value !== "number") throw new Error("Ein Herzfrequenzsample ist ungültig.");
    const timestamp = new Date(sample.timestamp);
    if (Number.isNaN(timestamp.getTime()) || !Number.isFinite(sample.value) || sample.value <= 0 || sample.value > 300) throw new Error("Ein Herzfrequenzsample enthält ungültige Werte.");
    return { timestamp: timestamp.toISOString(), value: sample.value };
  }).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const average = samples.reduce((sum, sample) => sum + sample.value, 0) / samples.length;
  const start = new Date(samples[0].timestamp);
  const end = new Date(samples.at(-1)!.timestamp);
  return {
    fileType: "json",
    streams: [{ type: "heart_rate", source: "apple_watch", unit: "bpm", samples }],
    metrics: {
      distanceMeters: 0,
      elapsedTimeSeconds: (end.getTime() - start.getTime()) / 1000,
      movingTimeSeconds: 0,
      averageSpeedKmh: 0,
      elevationGainMeters: 0,
      startTime: start.toISOString(),
      averageHeartRate: average,
      maximumHeartRate: Math.max(...samples.map((sample) => sample.value)),
      heartRateSampleCount: samples.length,
      trackPointCount: samples.length,
      averagePower: null,
      normalizedPower: null,
      averageCadence: null,
    },
  };
}

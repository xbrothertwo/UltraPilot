import type { ActivityStream, MergeResult, ParsedActivityFile, SensorSample } from "./types";

function range(samples: SensorSample[]) {
  const times = samples.map((sample) => new Date(sample.timestamp).getTime()).filter(Number.isFinite);
  return times.length ? { start: Math.min(...times), end: Math.max(...times) } : null;
}

export function mergeHeartRate(primary: ParsedActivityFile, supplement?: ParsedActivityFile): MergeResult {
  const primaryHeartRate = primary.streams.find((stream) => stream.type === "heart_rate");
  if (!supplement) return { metrics: primary.metrics, streams: primary.streams, heartRateSource: primaryHeartRate ? "primary" : "none", importedHeartRateSamples: 0, overlapSeconds: 0 };

  const watchHeartRate = supplement.streams.find((stream) => stream.type === "heart_rate");
  if (!watchHeartRate?.samples.length) throw new Error("Die Apple-Watch-Datei enthält keine Herzfrequenzsamples.");
  const activityStart = new Date(primary.metrics.startTime).getTime();
  const activityEnd = activityStart + primary.metrics.elapsedTimeSeconds * 1000;
  const watchRange = range(watchHeartRate.samples);
  if (!watchRange) throw new Error("Die Apple-Watch-Herzfrequenz besitzt keine gültigen Zeitstempel.");
  const overlapSeconds = Math.max(0, Math.min(activityEnd, watchRange.end) - Math.max(activityStart, watchRange.start)) / 1000;
  const minimumRequiredOverlap = Math.min(300, Math.max(30, primary.metrics.elapsedTimeSeconds * 0.25));
  if (overlapSeconds < minimumRequiredOverlap) throw new Error("Die beiden Dateien überschneiden sich zeitlich nicht ausreichend. Prüfe, ob sie zur selben Tour gehören.");

  const matched = watchHeartRate.samples.filter((sample) => {
    const timestamp = new Date(sample.timestamp).getTime();
    return timestamp >= activityStart && timestamp <= activityEnd;
  });
  if (!matched.length) throw new Error("Im Zeitraum der Garmin-Aktivität wurden keine Watch-Herzfrequenzwerte gefunden.");
  const average = matched.reduce((sum, sample) => sum + sample.value, 0) / matched.length;
  const maximum = Math.max(...matched.map((sample) => sample.value));
  const watchStream: ActivityStream = { ...watchHeartRate, source: "apple_watch", samples: matched };
  return {
    metrics: { ...primary.metrics, averageHeartRate: average, maximumHeartRate: maximum, heartRateSampleCount: matched.length },
    streams: [...primary.streams.filter((stream) => stream.type !== "heart_rate"), watchStream],
    heartRateSource: "apple_watch",
    importedHeartRateSamples: matched.length,
    overlapSeconds,
  };
}

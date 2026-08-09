import { Decoder, Stream, type RecordMesg, type SessionMesg } from "@garmin/fitsdk";
import type { GpxMetrics } from "@/lib/gpx/types";
import type { ActivityStream, ParsedActivityFile, SensorSample, StreamType } from "./types";

const MOVING_THRESHOLD_MPS = 0.5;
export const FIT_PARSER_VERSION = "fit-v1";

function validNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function dateValue(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "number" || typeof value === "string") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return null;
}

function samples(records: RecordMesg[], field: keyof RecordMesg): SensorSample[] {
  return records.flatMap((record) => {
    const timestamp = dateValue(record.timestamp);
    const value = record[field];
    return timestamp && validNumber(value) ? [{ timestamp: timestamp.toISOString(), value }] : [];
  });
}

function makeStream(type: StreamType, unit: ActivityStream["unit"], values: SensorSample[], source: ActivityStream["source"]): ActivityStream | null {
  return values.length ? { type, unit, samples: values, source } : null;
}

function positiveElevationGain(records: RecordMesg[]): number {
  let gain = 0;
  for (let index = 1; index < records.length; index += 1) {
    const previous = records[index - 1].enhancedAltitude ?? records[index - 1].altitude;
    const current = records[index].enhancedAltitude ?? records[index].altitude;
    if (validNumber(previous) && validNumber(current)) gain += Math.max(0, current - previous);
  }
  return gain;
}

function movingSeconds(records: RecordMesg[]): number {
  let total = 0;
  for (let index = 1; index < records.length; index += 1) {
    const previousTime = dateValue(records[index - 1].timestamp);
    const currentTime = dateValue(records[index].timestamp);
    const speed = records[index].enhancedSpeed ?? records[index].speed;
    if (previousTime && currentTime && validNumber(speed) && speed >= MOVING_THRESHOLD_MPS) {
      total += Math.max(0, (currentTime.getTime() - previousTime.getTime()) / 1000);
    }
  }
  return total;
}

function heartRateMetrics(values: SensorSample[]) {
  if (!values.length) return { average: null, maximum: null };
  return {
    average: values.reduce((sum, sample) => sum + sample.value, 0) / values.length,
    maximum: Math.max(...values.map((sample) => sample.value)),
  };
}

export function parseFit(bytes: Uint8Array, source: ActivityStream["source"] = "fit"): ParsedActivityFile {
  const stream = Stream.fromBuffer(bytes);
  const decoder = new Decoder(stream);
  if (!decoder.isFIT()) throw new Error("Die Datei besitzt keine gültige FIT-Signatur.");
  const { messages, errors } = decoder.read();
  if (errors.length) throw new Error(`Die FIT-Datei ist beschädigt: ${errors[0].message}`);

  const records = [...(messages.recordMesgs ?? [])].sort((a, b) => (dateValue(a.timestamp)?.getTime() ?? 0) - (dateValue(b.timestamp)?.getTime() ?? 0));
  const session: SessionMesg | undefined = messages.sessionMesgs?.[0];
  const firstTime = dateValue(session?.startTime) ?? dateValue(records[0]?.timestamp);
  const lastTime = dateValue(session?.timestamp) ?? dateValue(records.at(-1)?.timestamp);
  if (!firstTime || !lastTime) throw new Error("Die FIT-Datei enthält keine auswertbaren Zeitstempel.");

  const heartRates = samples(records, "heartRate");
  const power = samples(records, "power");
  const cadence = samples(records, "cadence");
  const speed = records.flatMap((record) => {
    const timestamp = dateValue(record.timestamp);
    const value = record.enhancedSpeed ?? record.speed;
    return timestamp && validNumber(value) ? [{ timestamp: timestamp.toISOString(), value }] : [];
  });
  const altitude = records.flatMap((record) => {
    const timestamp = dateValue(record.timestamp);
    const value = record.enhancedAltitude ?? record.altitude;
    return timestamp && validNumber(value) ? [{ timestamp: timestamp.toISOString(), value }] : [];
  });
  const heartRate = heartRateMetrics(heartRates);
  const elapsedTimeSeconds = validNumber(session?.totalElapsedTime) ? session.totalElapsedTime : Math.max(0, (lastTime.getTime() - firstTime.getTime()) / 1000);
  const computedMovingSeconds = movingSeconds(records);
  const movingTimeSeconds = validNumber(session?.totalTimerTime) ? session.totalTimerTime : computedMovingSeconds || elapsedTimeSeconds;
  const recordDistances = records.flatMap((record) => validNumber(record.distance) ? [record.distance] : []);
  const distanceMeters = validNumber(session?.totalDistance) ? session.totalDistance : recordDistances.length ? Math.max(...recordDistances) - Math.min(...recordDistances) : 0;
  const metrics: GpxMetrics = {
    distanceMeters,
    elapsedTimeSeconds,
    movingTimeSeconds,
    averageSpeedKmh: validNumber(session?.avgSpeed) ? session.avgSpeed * 3.6 : movingTimeSeconds > 0 ? distanceMeters / movingTimeSeconds * 3.6 : 0,
    elevationGainMeters: validNumber(session?.totalAscent) ? session.totalAscent : positiveElevationGain(records),
    startTime: firstTime.toISOString(),
    averageHeartRate: heartRate.average,
    maximumHeartRate: heartRate.maximum,
    heartRateSampleCount: heartRates.length,
    trackPointCount: records.length,
    discardedTrackPointCount: 0,
    averagePower: validNumber(session?.avgPower) ? session.avgPower : power.length ? power.reduce((sum, sample) => sum + sample.value, 0) / power.length : null,
    normalizedPower: validNumber(session?.normalizedPower) ? session.normalizedPower : null,
    averageCadence: validNumber(session?.avgCadence) ? session.avgCadence : cadence.length ? cadence.reduce((sum, sample) => sum + sample.value, 0) / cadence.length : null,
    parserVersion: FIT_PARSER_VERSION,
  };
  const streams = [
    makeStream("heart_rate", "bpm", heartRates, source),
    makeStream("power", "watt", power, source),
    makeStream("cadence", "rpm", cadence, source),
    makeStream("speed", "mps", speed, source),
    makeStream("altitude", "meter", altitude, source),
  ].filter((value): value is ActivityStream => value !== null);
  return { metrics, streams, fileType: "fit" };
}

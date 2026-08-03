import type { GpxMetrics, TrackPoint } from "./types";
import type { SensorSample } from "../activity-files/types";

const EARTH_RADIUS_METERS = 6_371_000;
export const MOVING_SPEED_THRESHOLD_MPS = 0.5;

function radians(degrees: number): number { return (degrees * Math.PI) / 180; }

export function haversineDistance(a: TrackPoint, b: TrackPoint): number {
  const latitudeDelta = radians(b.latitude - a.latitude);
  const longitudeDelta = radians(b.longitude - a.longitude);
  const aLatitude = radians(a.latitude);
  const bLatitude = radians(b.latitude);
  const value = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(aLatitude) * Math.cos(bLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(value));
}

function tagValue(block: string, localName: string): string | null {
  const match = block.match(new RegExp(`<(?:(?:[\\w-]+):)?${localName}\\b[^>]*>([^<]+)<\\/(?:(?:[\\w-]+):)?${localName}>`, "i"));
  return match?.[1]?.trim() ?? null;
}

export function extractTrackPoints(xml: string): TrackPoint[] {
  const points: TrackPoint[] = [];
  const pointPattern = /<(?:(?:[\w-]+):)?trkpt\b([^>]*)>([\s\S]*?)<\/(?:(?:[\w-]+):)?trkpt>/gi;
  for (const match of xml.matchAll(pointPattern)) {
    const attributes = match[1];
    const content = match[2];
    const latitude = Number(attributes.match(/\blat=["']([^"']+)["']/i)?.[1]);
    const longitude = Number(attributes.match(/\blon=["']([^"']+)["']/i)?.[1]);
    const timeText = tagValue(content, "time");
    const time = timeText ? new Date(timeText) : new Date(Number.NaN);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Number.isNaN(time.getTime())) continue;
    const elevationText = tagValue(content, "ele");
    const heartRateText = tagValue(content, "hr");
    const elevation = elevationText === null ? null : Number(elevationText);
    const heartRate = heartRateText === null ? null : Number(heartRateText);
    points.push({ latitude, longitude, time, elevation: elevation !== null && Number.isFinite(elevation) ? elevation : null, heartRate: heartRate !== null && Number.isFinite(heartRate) ? heartRate : null });
  }
  return points.sort((a, b) => a.time.getTime() - b.time.getTime());
}

export function extractGpxSensorSamples(xml: string): { heartRate: SensorSample[]; altitude: SensorSample[]; speed: SensorSample[] } {
  const points = extractTrackPoints(xml);
  const heartRate = points.flatMap((point) => point.heartRate === null ? [] : [{ timestamp: point.time.toISOString(), value: point.heartRate }]);
  const altitude = points.flatMap((point) => point.elevation === null ? [] : [{ timestamp: point.time.toISOString(), value: point.elevation }]);
  const speed: SensorSample[] = [];
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const elapsedSeconds = (current.time.getTime() - previous.time.getTime()) / 1000;
    if (elapsedSeconds <= 0) continue;
    speed.push({ timestamp: current.time.toISOString(), value: haversineDistance(previous, current) / elapsedSeconds });
  }
  return { heartRate, altitude, speed };
}

export function parseGpx(xml: string): GpxMetrics {
  if (!/<(?:(?:[\w-]+):)?gpx\b/i.test(xml)) throw new Error("Die Datei enthält kein gültiges GPX-Dokument.");
  const points = extractTrackPoints(xml);
  if (points.length < 2) throw new Error("Die GPX-Datei benötigt mindestens zwei Trackpunkte mit gültiger Zeit.");

  let distanceMeters = 0;
  let movingTimeSeconds = 0;
  let elevationGainMeters = 0;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const segmentSeconds = (current.time.getTime() - previous.time.getTime()) / 1000;
    if (segmentSeconds <= 0) continue;
    const segmentDistance = haversineDistance(previous, current);
    distanceMeters += segmentDistance;
    if (segmentDistance / segmentSeconds >= MOVING_SPEED_THRESHOLD_MPS) movingTimeSeconds += segmentSeconds;
    if (previous.elevation !== null && current.elevation !== null) elevationGainMeters += Math.max(0, current.elevation - previous.elevation);
  }

  const elapsedTimeSeconds = (points.at(-1)!.time.getTime() - points[0].time.getTime()) / 1000;
  const heartRates = points.flatMap((point) => point.heartRate === null ? [] : [point.heartRate]);
  return {
    distanceMeters,
    elapsedTimeSeconds,
    movingTimeSeconds,
    averageSpeedKmh: movingTimeSeconds > 0 ? (distanceMeters / movingTimeSeconds) * 3.6 : 0,
    elevationGainMeters,
    startTime: points[0].time.toISOString(),
    averageHeartRate: heartRates.length ? heartRates.reduce((sum, value) => sum + value, 0) / heartRates.length : null,
    maximumHeartRate: heartRates.length ? Math.max(...heartRates) : null,
    heartRateSampleCount: heartRates.length,
    trackPointCount: points.length,
    averagePower: null,
    normalizedPower: null,
    averageCadence: null,
  };
}

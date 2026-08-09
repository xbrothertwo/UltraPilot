import type { GpxMetrics, TrackPoint } from "./types";
import type { SensorSample } from "../activity-files/types";

const EARTH_RADIUS_METERS = 6_371_000;
export const MOVING_SPEED_THRESHOLD_MPS = 0.5;
/** Implied speeds above this are treated as GPS jumps, not real movement — genuine GPS jump artifacts are far larger than any realistic descent speed. */
export const MAX_PLAUSIBLE_SPEED_MPS = 30;
/** A gap this long between consecutive points is treated as an unrecorded pause: the straight-line distance between the two points is not bridged. */
export const MAX_RECORDING_GAP_SECONDS = 120;
const ELEVATION_SMOOTHING_RADIUS = 1;
export const GPX_PARSER_VERSION = "gpx-v2";

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

function dedupeByTimestamp(points: TrackPoint[]): TrackPoint[] {
  const deduped: TrackPoint[] = [];
  for (const point of points) {
    if (deduped.at(-1)?.time.getTime() === point.time.getTime()) continue;
    deduped.push(point);
  }
  return deduped;
}

function parsePointsFromBlock(block: string): TrackPoint[] {
  const points: TrackPoint[] = [];
  const pointPattern = /<(?:(?:[\w-]+):)?trkpt\b([^>]*)>([\s\S]*?)<\/(?:(?:[\w-]+):)?trkpt>/gi;
  for (const match of block.matchAll(pointPattern)) {
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

/**
 * Points from different trkseg blocks are never treated as continuous: a new segment means the
 * recording was explicitly paused/restarted, so bridging distance or time across that boundary
 * would fabricate movement that was never recorded.
 */
export function extractTrackSegments(xml: string): TrackPoint[][] {
  const segmentPattern = /<(?:(?:[\w-]+):)?trkseg\b[^>]*>([\s\S]*?)<\/(?:(?:[\w-]+):)?trkseg>/gi;
  const segmentBlocks = [...xml.matchAll(segmentPattern)].map((match) => match[1]);
  const blocks = segmentBlocks.length ? segmentBlocks : [xml];
  const segments: TrackPoint[][] = [];
  for (const block of blocks) {
    const points = dedupeByTimestamp(parsePointsFromBlock(block));
    if (points.length) segments.push(points);
  }
  return segments;
}

export function extractTrackPoints(xml: string): TrackPoint[] {
  return extractTrackSegments(xml).flat().sort((a, b) => a.time.getTime() - b.time.getTime());
}

/**
 * Drops points that imply an unrealistic speed from the last accepted point (GPS jump artifacts),
 * scanning sequentially so a single bad point can't poison the point that follows it. Long time
 * gaps are left alone here — those are handled as unrecorded pauses where the calculation loop
 * skips the distance contribution instead of discarding a point.
 */
function removeGpsOutliers(points: TrackPoint[]): { points: TrackPoint[]; discarded: number } {
  if (points.length < 2) return { points, discarded: 0 };
  const kept: TrackPoint[] = [points[0]];
  let discarded = 0;
  for (let index = 1; index < points.length; index += 1) {
    const previous = kept.at(-1)!;
    const current = points[index];
    const elapsedSeconds = (current.time.getTime() - previous.time.getTime()) / 1000;
    if (elapsedSeconds <= 0) { discarded += 1; continue; }
    const speed = haversineDistance(previous, current) / elapsedSeconds;
    if (speed > MAX_PLAUSIBLE_SPEED_MPS && elapsedSeconds < MAX_RECORDING_GAP_SECONDS) { discarded += 1; continue; }
    kept.push(current);
  }
  return { points: kept, discarded };
}

/** Averages elevation over neighboring points to suppress GPS altitude noise; missing values are never invented, just excluded from the local window. */
function smoothedElevations(points: TrackPoint[]): (number | null)[] {
  return points.map((_, index) => {
    const window: number[] = [];
    for (let offset = -ELEVATION_SMOOTHING_RADIUS; offset <= ELEVATION_SMOOTHING_RADIUS; offset += 1) {
      const elevation = points[index + offset]?.elevation;
      if (typeof elevation === "number") window.push(elevation);
    }
    return window.length ? window.reduce((sum, value) => sum + value, 0) / window.length : null;
  });
}

export function extractGpxSensorSamples(xml: string): { heartRate: SensorSample[]; altitude: SensorSample[]; speed: SensorSample[] } {
  const segments = extractTrackSegments(xml);
  const allPoints = segments.flat().sort((a, b) => a.time.getTime() - b.time.getTime());
  const heartRate = allPoints.flatMap((point) => point.heartRate === null ? [] : [{ timestamp: point.time.toISOString(), value: point.heartRate }]);
  const altitude = allPoints.flatMap((point) => point.elevation === null ? [] : [{ timestamp: point.time.toISOString(), value: point.elevation }]);
  const speed: SensorSample[] = [];
  for (const segment of segments) {
    const { points } = removeGpsOutliers(segment);
    for (let index = 1; index < points.length; index += 1) {
      const previous = points[index - 1];
      const current = points[index];
      const elapsedSeconds = (current.time.getTime() - previous.time.getTime()) / 1000;
      if (elapsedSeconds <= 0 || elapsedSeconds > MAX_RECORDING_GAP_SECONDS) continue;
      speed.push({ timestamp: current.time.toISOString(), value: haversineDistance(previous, current) / elapsedSeconds });
    }
  }
  return { heartRate, altitude, speed };
}

export function parseGpx(xml: string): GpxMetrics {
  if (!/<(?:(?:[\w-]+):)?gpx\b/i.test(xml)) throw new Error("Die Datei enthält kein gültiges GPX-Dokument.");
  const rawSegments = extractTrackSegments(xml);
  const rawPointCount = rawSegments.reduce((sum, segment) => sum + segment.length, 0);
  if (rawPointCount < 2) throw new Error("Die GPX-Datei benötigt mindestens zwei Trackpunkte mit gültiger Zeit.");

  const cleanedSegments = rawSegments.map((segment) => removeGpsOutliers(segment));
  const discardedTrackPointCount = cleanedSegments.reduce((sum, segment) => sum + segment.discarded, 0);
  const trackPointCount = cleanedSegments.reduce((sum, segment) => sum + segment.points.length, 0);
  if (trackPointCount < 2) throw new Error("Nach der Bereinigung von GPS-Ausreißern bleiben nicht genügend gültige Trackpunkte übrig.");

  let distanceMeters = 0;
  let movingTimeSeconds = 0;
  let elevationGainMeters = 0;
  for (const { points: segment } of cleanedSegments) {
    const smoothed = smoothedElevations(segment);
    for (let index = 1; index < segment.length; index += 1) {
      const previous = segment[index - 1];
      const current = segment[index];
      const segmentSeconds = (current.time.getTime() - previous.time.getTime()) / 1000;
      // A gap this long means the recording was paused, not that a straight line was traveled — skip it rather than bridging it as movement.
      if (segmentSeconds <= 0 || segmentSeconds > MAX_RECORDING_GAP_SECONDS) continue;
      const segmentDistance = haversineDistance(previous, current);
      distanceMeters += segmentDistance;
      if (segmentDistance / segmentSeconds >= MOVING_SPEED_THRESHOLD_MPS) movingTimeSeconds += segmentSeconds;
      const previousElevation = smoothed[index - 1];
      const currentElevation = smoothed[index];
      if (previousElevation !== null && currentElevation !== null) elevationGainMeters += Math.max(0, currentElevation - previousElevation);
    }
  }

  const allPoints = rawSegments.flat().sort((a, b) => a.time.getTime() - b.time.getTime());
  const elapsedTimeSeconds = (allPoints.at(-1)!.time.getTime() - allPoints[0].time.getTime()) / 1000;
  const heartRates = allPoints.flatMap((point) => point.heartRate === null ? [] : [point.heartRate]);
  return {
    distanceMeters,
    elapsedTimeSeconds,
    movingTimeSeconds,
    averageSpeedKmh: movingTimeSeconds > 0 ? (distanceMeters / movingTimeSeconds) * 3.6 : 0,
    elevationGainMeters,
    startTime: allPoints[0].time.toISOString(),
    averageHeartRate: heartRates.length ? heartRates.reduce((sum, value) => sum + value, 0) / heartRates.length : null,
    maximumHeartRate: heartRates.length ? Math.max(...heartRates) : null,
    heartRateSampleCount: heartRates.length,
    trackPointCount,
    discardedTrackPointCount,
    averagePower: null,
    normalizedPower: null,
    averageCadence: null,
    parserVersion: GPX_PARSER_VERSION,
  };
}

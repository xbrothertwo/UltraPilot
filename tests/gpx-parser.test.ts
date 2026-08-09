import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GPX_PARSER_VERSION, MAX_RECORDING_GAP_SECONDS, extractGpxSensorSamples, extractTrackPoints, extractTrackSegments, haversineDistance, parseGpx } from "../src/lib/gpx/parser";

function load(name: string): string {
  return readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
}

const fixture = load("sample.gpx");

describe("GPX parser", () => {
  it("extracts namespaced heart-rate samples", () => {
    const points = extractTrackPoints(fixture);
    expect(points).toHaveLength(4);
    expect(points.map((point) => point.heartRate)).toEqual([110, 120, 130, 140]);
  });

  it("calculates deterministic activity metrics", () => {
    const metrics = parseGpx(fixture);
    expect(metrics.distanceMeters).toBeCloseTo(222.39, 1);
    expect(metrics.elapsedTimeSeconds).toBe(240);
    expect(metrics.movingTimeSeconds).toBe(120);
    expect(metrics.averageSpeedKmh).toBeCloseTo(6.67, 1);
    // Raw elevation deltas sum to 17m (+10, -2 discarded, +7); the 3-point smoothing window
    // that suppresses GPS altitude noise reduces this to 6.5m for this short fixture.
    expect(metrics.elevationGainMeters).toBe(6.5);
    expect(metrics.startTime).toBe("2026-01-01T10:00:00.000Z");
    expect(metrics.averageHeartRate).toBe(125);
    expect(metrics.maximumHeartRate).toBe(140);
    expect(metrics.heartRateSampleCount).toBe(4);
  });

  it("creates chart streams for heart rate, altitude and segment speed", () => {
    const streams = extractGpxSensorSamples(fixture);
    expect(streams.heartRate).toHaveLength(4);
    expect(streams.altitude.map((sample) => sample.value)).toEqual([100, 110, 108, 115]);
    expect(streams.speed).toHaveLength(3);
    expect(streams.speed[0].value).toBeCloseTo(1.85, 1);
    expect(streams.speed[1].value).toBe(0);
    expect(streams.speed[2].value).toBeCloseTo(1.85, 1);
  });

  it("calculates a known haversine segment", () => {
    const [first, second] = extractTrackPoints(fixture);
    expect(haversineDistance(first, second)).toBeCloseTo(111.2, 1);
  });

  it("rejects malformed and incomplete input", () => {
    expect(() => parseGpx("not xml")).toThrow(/GPX-Dokument/);
    expect(() => parseGpx("<gpx><trkpt lat=\"1\" lon=\"2\"><time>2026-01-01T00:00:00Z</time></trkpt></gpx>")).toThrow(/mindestens zwei/);
  });

  it("rejects a truncated, partially-written file instead of computing garbage metrics", () => {
    const truncated = load("sample.gpx").slice(0, 120);
    expect(() => parseGpx(truncated)).toThrow(/GPX-Dokument|mindestens zwei/);
  });

  it("tags every result with the parser version that produced it", () => {
    expect(parseGpx(fixture).parserVersion).toBe(GPX_PARSER_VERSION);
  });

  it("never bridges distance, time or elevation across separate track segments", () => {
    const xml = load("multi-segment.gpx");
    const segments = extractTrackSegments(xml);
    expect(segments).toHaveLength(2);
    expect(segments[0]).toHaveLength(3);
    expect(segments[1]).toHaveLength(3);

    const metrics = parseGpx(xml);
    // Only the two within-segment moves count (~111m each leg); the ~157km jump
    // between segment 1's last point and segment 2's first point must not appear.
    expect(metrics.distanceMeters).toBeLessThan(500);
    expect(metrics.distanceMeters).toBeGreaterThan(400);
    expect(metrics.trackPointCount).toBe(6);
    // Elapsed time still reflects the true wall-clock span between first and last point.
    expect(metrics.elapsedTimeSeconds).toBe(3720);
  });

  it("discards a single GPS jump instead of letting it poison distance and later points", () => {
    const metrics = parseGpx(load("gps-outlier.gpx"));
    expect(metrics.discardedTrackPointCount).toBe(1);
    expect(metrics.trackPointCount).toBe(4);
    // Without filtering, the jump to (5,5) and back would add well over 1,000km.
    expect(metrics.distanceMeters).toBeLessThan(1000);
  });

  it("smooths a single elevation sensor spike instead of counting it at full magnitude", () => {
    const metrics = parseGpx(load("elevation-noise.gpx"));
    // Raw deltas (+1, +49, -48 discarded, +1, +1) would sum to 52m of "gain".
    expect(metrics.elevationGainMeters).toBeLessThan(30);
    expect(metrics.elevationGainMeters).toBeGreaterThan(0);
  });

  it("does not bridge a real recording gap as if it were travelled distance", () => {
    const metrics = parseGpx(load("long-stop.gpx"));
    // Only the two ~111m legs before and after the 10-minute gap should count;
    // the ~1.1km implied by connecting straight across the gap must not appear.
    expect(metrics.distanceMeters).toBeLessThan(400);
    expect(metrics.distanceMeters).toBeGreaterThan(150);
    expect(metrics.elapsedTimeSeconds).toBe(720);
    const gapSeconds = (new Date("2026-02-04T07:11:00Z").getTime() - new Date("2026-02-04T07:01:00Z").getTime()) / 1000;
    expect(gapSeconds).toBeGreaterThan(MAX_RECORDING_GAP_SECONDS);
  });

  it("handles a recording with no heart-rate sensor safely", () => {
    const metrics = parseGpx(load("missing-heart-rate.gpx"));
    expect(metrics.averageHeartRate).toBeNull();
    expect(metrics.maximumHeartRate).toBeNull();
    expect(metrics.heartRateSampleCount).toBe(0);
    expect(metrics.distanceMeters).toBeGreaterThan(0);
  });

  it("processes a multi-hour recording without error", () => {
    const metrics = parseGpx(load("long-activity.gpx"));
    expect(metrics.trackPointCount).toBe(1440);
    expect(metrics.elapsedTimeSeconds).toBe(14390);
    expect(metrics.distanceMeters).toBeGreaterThan(30_000);
    expect(metrics.heartRateSampleCount).toBe(1440);
  });

  it("produces plausible metrics for a running recording", () => {
    const metrics = parseGpx(load("running.gpx"));
    expect(metrics.averageSpeedKmh).toBeGreaterThan(8);
    expect(metrics.averageSpeedKmh).toBeLessThan(13);
    expect(metrics.discardedTrackPointCount).toBe(0);
  });

  it("produces plausible metrics for a cycling recording", () => {
    const metrics = parseGpx(load("cycling.gpx"));
    expect(metrics.averageSpeedKmh).toBeGreaterThan(25);
    expect(metrics.averageSpeedKmh).toBeLessThan(35);
    expect(metrics.discardedTrackPointCount).toBe(0);
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extractGpxSensorSamples, extractTrackPoints, haversineDistance, parseGpx } from "../src/lib/gpx/parser";

const fixture = readFileSync(new URL("./fixtures/sample.gpx", import.meta.url), "utf8");

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
    expect(metrics.elevationGainMeters).toBe(17);
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
});

import { Encoder, Profile, type FileIdMesg, type RecordMesg, type SessionMesg } from "@garmin/fitsdk";
import { describe, expect, it } from "vitest";
import { parseFit } from "../src/lib/activity-files/fit-parser";
import { mergeHeartRate } from "../src/lib/activity-files/merge";
import type { ParsedActivityFile } from "../src/lib/activity-files/types";

function createFitFile({ start = new Date("2026-01-01T10:00:00Z"), heartRates = [120, 130, 140] }: { start?: Date; heartRates?: Array<number | null> } = {}) {
  const encoder = new Encoder();
  encoder.onMesg(Profile.MesgNum.FILE_ID, { type: "activity", manufacturer: "development", product: 1, timeCreated: start } as FileIdMesg);
  heartRates.forEach((heartRate, index) => encoder.onMesg(Profile.MesgNum.RECORD, {
    timestamp: new Date(start.getTime() + index * 60_000),
    ...(heartRate === null ? {} : { heartRate }),
    power: 180 + index * 10,
    cadence: 80 + index,
    speed: 5,
    distance: index * 300,
    altitude: 100 + index * 5,
  } as RecordMesg));
  const end = new Date(start.getTime() + Math.max(0, heartRates.length - 1) * 60_000);
  encoder.onMesg(Profile.MesgNum.SESSION, {
    messageIndex: 0,
    timestamp: end,
    event: "session",
    eventType: "stop",
    startTime: start,
    sport: "cycling",
    totalElapsedTime: 120,
    totalTimerTime: 120,
    totalDistance: 600,
    avgSpeed: 5,
    totalAscent: 10,
    avgPower: 190,
    normalizedPower: 205,
    avgCadence: 81,
  } as SessionMesg);
  return encoder.close();
}

describe("FIT parser", () => {
  it("decodes Garmin summary metrics and record streams", () => {
    const parsed = parseFit(createFitFile());
    expect(parsed.fileType).toBe("fit");
    expect(parsed.metrics.distanceMeters).toBe(600);
    expect(parsed.metrics.elapsedTimeSeconds).toBe(120);
    expect(parsed.metrics.averageSpeedKmh).toBe(18);
    expect(parsed.metrics.elevationGainMeters).toBe(10);
    expect(parsed.metrics.averageHeartRate).toBe(130);
    expect(parsed.metrics.maximumHeartRate).toBe(140);
    expect(parsed.metrics.averagePower).toBe(190);
    expect(parsed.metrics.normalizedPower).toBe(205);
    expect(parsed.streams.find((stream) => stream.type === "heart_rate")?.samples).toHaveLength(3);
  });

  it("rejects data without a FIT signature", () => {
    expect(() => parseFit(new Uint8Array([1, 2, 3]))).toThrow(/FIT-Signatur/);
  });
});

describe("heart-rate fusion", () => {
  const primary = parseFit(createFitFile({ heartRates: [null, null, null] }));

  it("replaces missing primary heart rate using timestamps", () => {
    const watch = parseFit(createFitFile({ heartRates: [110, 125, 150] }), "apple_watch");
    const merged = mergeHeartRate(primary, watch);
    expect(merged.heartRateSource).toBe("apple_watch");
    expect(merged.importedHeartRateSamples).toBe(3);
    expect(merged.metrics.averageHeartRate).toBeCloseTo(128.33, 2);
    expect(merged.metrics.maximumHeartRate).toBe(150);
  });

  it("rejects a watch recording from another time", () => {
    const watch = parseFit(createFitFile({ start: new Date("2026-01-02T10:00:00Z"), heartRates: [110, 120, 130] }), "apple_watch");
    expect(() => mergeHeartRate(primary, watch)).toThrow(/überschneiden/);
  });

  it("keeps primary data when no supplement is present", () => {
    const result = mergeHeartRate(primary as ParsedActivityFile);
    expect(result.heartRateSource).toBe("none");
    expect(result.streams.some((stream) => stream.type === "power")).toBe(true);
  });
});

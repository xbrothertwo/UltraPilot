import { describe, expect, it } from "vitest";
import { calculateHeartRateDrift, calculateTimeInZones, calculateTrainingLoad, formatHeartRateTarget, getHeartRateZones, getPlannedHeartRateTarget, getPowerZones, type TrainingProfile } from "../src/lib/training-zones";

const profile: TrainingProfile = { maxHeartRate: 200, restingHeartRate: 50, ftpWatts: 300, heartRateZoneMethod: "max_hr", customHeartRateBoundaries: null, customPowerBoundaries: null };

describe("training zones", () => {
  it("derives boundaries from explicit reference values", () => {
    expect(getHeartRateZones(profile)?.map((zone) => zone.upper)).toEqual([120, 140, 160, 180, null]);
    expect(getPowerZones(profile)?.map((zone) => zone.upper)).toEqual([165, 225, 270, 315, 360, 450, null]);
  });
  it("supports heart-rate reserve and manual boundaries", () => {
    expect(getHeartRateZones({ ...profile, heartRateZoneMethod: "heart_rate_reserve" })?.map((zone) => zone.upper)).toEqual([140, 155, 170, 185, null]);
    expect(getHeartRateZones({ ...profile, heartRateZoneMethod: "manual", customHeartRateBoundaries: [110, 130, 150, 170] })?.map((zone) => zone.upper)).toEqual([110, 130, 150, 170, null]);
  });
  it("maps planned ride intensity to explicit heart-rate zones", () => {
    const zones = getHeartRateZones(profile)!;
    expect(formatHeartRateTarget(getPlannedHeartRateTarget(zones, "endurance")!)).toBe("121–140 bpm (Z2)");
    expect(formatHeartRateTarget(getPlannedHeartRateTarget(zones, "easy")!)).toBe("bis 140 bpm (Z1–Z2)");
    expect(getPlannedHeartRateTarget(zones, "strength")).toBeNull();
  });
  it("does not derive zones when required values are absent", () => {
    expect(getHeartRateZones({ ...profile, maxHeartRate: null })).toBeNull();
    expect(getPowerZones({ ...profile, ftpWatts: null })).toBeNull();
  });
  it("assigns intervals and ignores gaps over ten seconds", () => {
    const result = calculateTimeInZones([{ timestamp: "2026-01-01T00:00:00.000Z", value: 110 }, { timestamp: "2026-01-01T00:00:05.000Z", value: 130 }, { timestamp: "2026-01-01T00:00:10.000Z", value: 170 }, { timestamp: "2026-01-01T00:00:30.000Z", value: 180 }], getHeartRateZones(profile)!);
    expect(result.map((zone) => zone.seconds)).toEqual([5, 5, 0, 0, 0]);
    expect(result.map((zone) => zone.percentage)).toEqual([50, 50, 0, 0, 0]);
  });
  it("calculates IF and TSS only from explicit FTP and normalized power", () => {
    expect(calculateTrainingLoad(240, 3600, 300)).toEqual({ intensityFactor: 0.8, tss: 64 });
    expect(calculateTrainingLoad(240, 3600, null)).toBeNull();
  });
  it("calculates heart-rate drift from time-aligned power and heart rate", () => {
    const start = Date.parse("2026-01-01T00:00:00.000Z");
    const heartRate = Array.from({ length: 150 }, (_, index) => ({ timestamp: new Date(start + index * 10_000).toISOString(), value: index < 75 ? 140 : 150 }));
    const power = Array.from({ length: 150 }, (_, index) => ({ timestamp: new Date(start + index * 10_000).toISOString(), value: 210 }));
    expect(calculateHeartRateDrift(heartRate, power)).toBeCloseTo(6.67, 1);
    expect(calculateHeartRateDrift(heartRate.slice(0, 10), power.slice(0, 10))).toBeNull();
  });
});

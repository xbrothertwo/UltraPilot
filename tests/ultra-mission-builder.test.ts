import { describe, expect, it } from "vitest";
import {
  buildUltraMissionPlan,
  formatMissionDuration,
  formatPace,
  paceMinutesPerKmToSpeed,
  speedToPaceMinutesPerKm,
  type UltraMissionInput,
} from "../src/lib/ultra-mission-builder";

function mission(
  overrides: Partial<UltraMissionInput> = {},
): UltraMissionInput {
  return {
    sportType: "cycling",
    distanceKm: 300,
    elevationMeters: 3_000,
    averageSpeedKmh: 25,
    startAt: new Date(
      "2026-08-10T06:00:00.000Z",
    ),
    stopIntervalKm: 100,
    stopDurationMinutes: 10,
    carbohydratesPerHour: 80,
    fluidMillilitersPerHour: 600,
    sodiumMilligramsPerHour: 500,
    ...overrides,
  };
}

describe("buildUltraMissionPlan", () => {
  it("calculates cycling time, stops and finish time", () => {
    const plan = buildUltraMissionPlan(
      mission(),
    );

    expect(plan.ridingMinutes).toBe(720);
    expect(plan.breakMinutes).toBe(20);
    expect(plan.totalMinutes).toBe(740);
    expect(plan.stopCount).toBe(2);

    expect(plan.finishAt.toISOString()).toBe(
      "2026-08-10T18:20:00.000Z",
    );
  });

  it("creates a final partial segment without a finish break", () => {
    const plan = buildUltraMissionPlan(
      mission({
        distanceKm: 250,
      }),
    );

    expect(plan.segments).toHaveLength(3);

    expect(plan.segments[2]).toMatchObject({
      fromKm: 200,
      toKm: 250,
      distanceKm: 50,
      breakMinutes: 0,
    });

    expect(plan.stopCount).toBe(2);
  });

  it("calculates nutrition from total elapsed time", () => {
    const plan = buildUltraMissionPlan(
      mission(),
    );

    expect(
      plan.totalCarbohydratesGrams,
    ).toBe(987);

    expect(
      plan.totalFluidMilliliters,
    ).toBe(7_400);

    expect(
      plan.totalSodiumMilligrams,
    ).toBe(6_167);
  });

  it("creates cycling warnings for unsupported assumptions", () => {
    const plan = buildUltraMissionPlan(
      mission({
        distanceKm: 700,
        elevationMeters: 10_000,
        averageSpeedKmh: 36,
        stopIntervalKm: 175,
        carbohydratesPerHour: 40,
        fluidMillilitersPerHour: 350,
      }),
    );

    const warnings = plan.warnings.join(" ");

    expect(plan.warnings.length).toBeGreaterThanOrEqual(
      4,
    );

    expect(warnings).toContain(
      "Bewegungsschnitt",
    );

    expect(warnings).toContain(
      "Kohlenhydrate",
    );
  });

  it("calculates a 50 kilometer running mission from pace", () => {
    const plan = buildUltraMissionPlan(
      mission({
        sportType: "running",
        distanceKm: 50,
        elevationMeters: 500,
        averageSpeedKmh:
          paceMinutesPerKmToSpeed(6),
        startAt: new Date(
          "2026-08-10T07:00:00.000Z",
        ),
        stopIntervalKm: 10,
        stopDurationMinutes: 5,
        carbohydratesPerHour: 60,
        fluidMillilitersPerHour: 500,
      }),
    );

    expect(plan.ridingMinutes).toBe(300);
    expect(plan.breakMinutes).toBe(20);
    expect(plan.totalMinutes).toBe(320);
    expect(plan.stopCount).toBe(4);

    expect(plan.finishAt.toISOString()).toBe(
      "2026-08-10T12:20:00.000Z",
    );

    expect(plan.segments).toHaveLength(5);
    expect(plan.elevationPer10Km).toBe(100);
  });

  it("creates running-specific warnings", () => {
    const plan = buildUltraMissionPlan(
      mission({
        sportType: "running",
        distanceKm: 60,
        elevationMeters: 3_600,
        averageSpeedKmh:
          paceMinutesPerKmToSpeed(3.5),
        stopIntervalKm: 30,
        stopDurationMinutes: 5,
        carbohydratesPerHour: 20,
      }),
    );

    const warnings = plan.warnings.join(" ");

    expect(warnings).toContain("Aid Stations");
    expect(warnings).toContain("Pace");
    expect(warnings).toContain(
      "Kohlenhydrate",
    );
  });

  it("rejects impossible values", () => {
    expect(() =>
      buildUltraMissionPlan(
        mission({
          averageSpeedKmh: 0,
        }),
      ),
    ).toThrow("Bewegungsschnitt");
  });
});

describe("mission formatting", () => {
  it("formats multi-day durations", () => {
    expect(
      formatMissionDuration(1_570),
    ).toBe("1 T 2 h 10 min");
  });

  it("converts and formats running pace", () => {
    const speed =
      paceMinutesPerKmToSpeed(6);

    expect(speed).toBe(10);

    expect(
      speedToPaceMinutesPerKm(speed),
    ).toBe(6);

    expect(formatPace(6)).toBe(
      "6:00 min/km",
    );

    expect(formatPace(5.5)).toBe(
      "5:30 min/km",
    );
  });
});
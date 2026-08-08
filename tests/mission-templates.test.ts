import {
  describe,
  expect,
  it,
} from "vitest";

import {
  deriveMissionTemplates,
} from "../src/lib/mission-templates";

describe("deriveMissionTemplates", () => {
  it("derives cycling missions from the main distance", () => {
    const templates =
      deriveMissionTemplates({
        sportType: "cycling",
        targetDistanceKm: 1_000,
        targetElevationMeters: 8_000,
      });

    expect(
      templates.map(
        (template) =>
          template.distanceKm,
      ),
    ).toEqual([
      250,
      500,
      750,
    ]);

    expect(templates[0]).toMatchObject({
      sportType: "cycling",
      elevationMeters: 2_000,
      averageSpeedKmh: 24,
      paceSecondsPerKm: null,
    });
  });

  it("derives running missions with running defaults", () => {
    const templates =
      deriveMissionTemplates({
        sportType: "running",
        targetDistanceKm: 100,
        targetElevationMeters: 4_000,
      });

    expect(
      templates.map(
        (template) =>
          template.distanceKm,
      ),
    ).toEqual([
      25,
      50,
      75,
    ]);

    expect(templates[0]).toMatchObject({
      sportType: "running",
      elevationMeters: 1_000,
      averageSpeedKmh: null,
      paceSecondsPerKm: 360,
      stopIntervalKm: 5,
    });
  });

  it("does not create duplicate or full-distance missions", () => {
    const templates =
      deriveMissionTemplates({
        sportType: "running",
        targetDistanceKm: 3,
        targetElevationMeters: 0,
      });

    const distances = templates.map(
      (template) =>
        template.distanceKm,
    );

    expect(
      new Set(distances).size,
    ).toBe(distances.length);

    expect(
      distances.every(
        (distance) => distance < 3,
      ),
    ).toBe(true);
  });

  it("returns no templates without a valid main distance", () => {
    expect(
      deriveMissionTemplates({
        sportType: "cycling",
        targetDistanceKm: 0,
        targetElevationMeters: null,
      }),
    ).toEqual([]);
  });
});
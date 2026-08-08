import {
  describe,
  expect,
  it,
} from "vitest";

import {
  buildMissionWriteInput,
} from "../src/lib/mission-input";

function missionForm(
  overrides: Record<string, string> = {},
): FormData {
  const formData = new FormData();

  const values = {
    missionId: "",
    title: "Meine Testmission",
    description: "Ein Test.",
    sportType: "cycling",
    targetDate: "2026-08-15",
    startAtIso:
      "2026-08-15T04:00:00.000Z",
    distanceKm: "300",
    elevationMeters: "3000",
    averageSpeedKmh: "25",
    pace: "",
    stopIntervalKm: "100",
    stopDurationMinutes: "10",
    carbohydratesPerHour: "80",
    fluidMillilitersPerHour: "600",
    sodiumMilligramsPerHour: "500",
    ...overrides,
  };

  for (const [key, value] of Object.entries(
    values,
  )) {
    formData.set(key, value);
  }

  return formData;
}

describe("buildMissionWriteInput", () => {
  it("maps a cycling mission", () => {
    const result =
      buildMissionWriteInput(
        missionForm(),
      );

    expect(result.missionId).toBeNull();

    expect(result.values).toMatchObject({
      title: "Meine Testmission",
      sport_type: "cycling",
      distance_km: 300,
      average_speed_kmh: 25,
      pace_seconds_per_km: null,
    });
  });

  it("maps a running pace", () => {
    const result =
      buildMissionWriteInput(
        missionForm({
          sportType: "running",
          distanceKm: "50",
          averageSpeedKmh: "",
          pace: "5:30",
          stopIntervalKm: "10",
        }),
      );

    expect(result.values).toMatchObject({
      sport_type: "running",
      distance_km: 50,
      average_speed_kmh: null,
      pace_seconds_per_km: 330,
    });
  });

  it("stores an empty description as null", () => {
    const result =
      buildMissionWriteInput(
        missionForm({
          description: "",
        }),
      );

    expect(
      result.values.description,
    ).toBeNull();
  });

  it("rejects an invalid pace", () => {
    expect(() =>
      buildMissionWriteInput(
        missionForm({
          sportType: "running",
          averageSpeedKmh: "",
          pace: "6:90",
          stopIntervalKm: "10",
        }),
      ),
    ).toThrow("Pace");
  });
});
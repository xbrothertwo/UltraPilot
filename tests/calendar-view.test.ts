import { describe, expect, it } from "vitest";
import type { Activity } from "@/lib/demo-data";
import {
  buildActivityCalendarMetrics,
  buildWorkoutCalendarView,
} from "@/lib/planning/calendar-view";
import type { ReconciledWorkout } from "@/lib/planning/reconciliation";
import type { PlannedWorkout } from "@/lib/planning/workouts";
import type { PaceZone, ZoneDefinition } from "@/lib/training-zones";

const heartRateZones: ZoneDefinition[] = [
  { name: "Z1", lower: null, upper: 120, color: "#aaa" },
  { name: "Z2", lower: 121, upper: 140, color: "#bbb" },
  { name: "Z3", lower: 141, upper: 155, color: "#ccc" },
  { name: "Z4", lower: 156, upper: 170, color: "#ddd" },
  { name: "Z5", lower: 171, upper: null, color: "#eee" },
];

const paceZones: PaceZone[] = [
  { name: "Z1", fasterBoundSecondsPerKm: 390, slowerBoundSecondsPerKm: null },
  { name: "Z2", fasterBoundSecondsPerKm: 360, slowerBoundSecondsPerKm: 390 },
  { name: "Z3", fasterBoundSecondsPerKm: 335, slowerBoundSecondsPerKm: 360 },
  { name: "Z4", fasterBoundSecondsPerKm: 320, slowerBoundSecondsPerKm: 335 },
  { name: "Z5", fasterBoundSecondsPerKm: null, slowerBoundSecondsPerKm: 320 },
];

function workout(overrides: Partial<PlannedWorkout> = {}): PlannedWorkout {
  return {
    id: "workout-1",
    scheduledDate: "2026-08-17",
    sportType: "cycling",
    title: "Grundlagenausfahrt",
    description: null,
    personalNote: null,
    intensity: "endurance",
    plannedDurationMinutes: 90,
    plannedDistanceKm: 40,
    status: "planned",
    linkedActivityId: null,
    source: "automatic",
    generationId: "generation-1",
    locked: false,
    preferredStartTime: null,
    targetHeartRateZone: null,
    targetPowerZone: null,
    ...overrides,
  };
}

function reconciled(
  value: PlannedWorkout,
  overrides: Partial<ReconciledWorkout> = {},
): ReconciledWorkout {
  return {
    workout: value,
    activity: null,
    effectiveStatus: "planned",
    comparison: null,
    ...overrides,
  };
}

describe("plan calendar view models", () => {
  it("shows running pace and heart-rate targets without cycling metrics", () => {
    const view = buildWorkoutCalendarView(
      reconciled(
        workout({
          sportType: "running",
          title: "Ruhiger Lauf",
          plannedDurationMinutes: 50,
          plannedDistanceKm: 8,
        }),
      ),
      heartRateZones,
      paceZones,
    );

    expect(view.sportLabel).toBe("Lauf");
    expect(view.metrics).toContain("8 km");
    expect(view.metrics.some((metric) => metric.includes("min/km"))).toBe(true);
    expect(view.metrics.some((metric) => metric.includes("km/h"))).toBe(false);
    expect(view.badges).toContain("HF Z2");
  });

  it("keeps volleyball duration-focused and does not invent distance", () => {
    const view = buildWorkoutCalendarView(
      reconciled(
        workout({
          sportType: "volleyball",
          title: "Volleyballtraining",
          plannedDurationMinutes: 75,
          plannedDistanceKm: 12,
        }),
      ),
      heartRateZones,
      paceZones,
    );

    expect(view.metrics).toEqual(["75 min"]);
    expect(view.badges).toEqual([]);
  });

  it("uses an explicit heart-rate zone instead of the intensity default", () => {
    const view = buildWorkoutCalendarView(
      reconciled(workout({ targetHeartRateZone: "Z4" })),
      heartRateZones,
      paceZones,
    );

    expect(view.badges).toContain("HF Z4");
    expect(view.badges).not.toContain("HF Z2");
  });

  it("distinguishes locked, adjusted and completed workouts in text", () => {
    const locked = buildWorkoutCalendarView(
      reconciled(workout({ locked: true })),
      heartRateZones,
      paceZones,
    );
    const adjusted = buildWorkoutCalendarView(
      reconciled(workout({ source: "manual", generationId: "generation-1" })),
      heartRateZones,
      paceZones,
    );
    const completed = buildWorkoutCalendarView(
      reconciled(workout(), { effectiveStatus: "completed" }),
      heartRateZones,
      paceZones,
    );

    expect(locked).toMatchObject({ state: "locked", statusLabel: "Gesperrt" });
    expect(adjusted).toMatchObject({ state: "adjusted", statusLabel: "Angepasst" });
    expect(completed).toMatchObject({ state: "completed", statusLabel: "Absolviert" });
  });

  it("formats completed running and cycling activities with sport-specific metrics", () => {
    const base: Activity = {
      id: "activity-1",
      userId: "user-1",
      sportType: "running",
      activityDate: "2026-08-17T08:00:00.000Z",
      title: "Morgenlauf",
      distanceMeters: 10_000,
      movingTimeSeconds: 3_000,
      elapsedTimeSeconds: 3_050,
      elevationGainMeters: 80,
      averageSpeedKmh: 12,
      averageHeartRate: 145,
      maximumHeartRate: 165,
      averagePower: null,
      normalizedPower: null,
      source: "gpx",
      createdAt: "2026-08-17T09:00:00.000Z",
    };

    expect(buildActivityCalendarMetrics(base)).toEqual([
      "10 km",
      "50 min",
      "5:00 min/km",
    ]);
    expect(
      buildActivityCalendarMetrics({
        ...base,
        sportType: "cycling",
        averageSpeedKmh: 24.8,
      }),
    ).toEqual(["10 km", "50 min", "24,8 km/h"]);
  });
});

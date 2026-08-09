import { describe, expect, it } from "vitest";
import { mapActivityRow, type ActivityRow } from "../src/lib/activities";

describe("activity mapping", () => {
  it("keeps a missing average speed as null", () => {
    const row: ActivityRow = { id: "a", user_id: "u", sport_type: "cycling", activity_date: "2026-08-03T10:00:00Z", title: "Ride", distance_meters: 0, moving_time_seconds: 0, elapsed_time_seconds: 0, elevation_gain_meters: 0, average_speed_kmh: null, average_heart_rate: null, maximum_heart_rate: null, average_power: null, normalized_power: null, source: "fit", created_at: "2026-08-03T10:00:00Z" };
    expect(mapActivityRow(row).averageSpeedKmh).toBeNull();
    expect(mapActivityRow({ ...row, average_speed_kmh: 0 }).averageSpeedKmh).toBe(0);
  });
});

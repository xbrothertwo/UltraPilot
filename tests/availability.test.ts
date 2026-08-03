import { describe, expect, it } from "vitest";
import { calculateDailyAvailability } from "../src/lib/planning/availability";

describe("daily availability", () => {
  it("subtracts a late shift from the planning day", () => {
    const windows = calculateDailyAvailability("2026-08-03", [{ startsAt: "2026-08-03T13:00:00.000Z", endsAt: "2026-08-03T21:00:00.000Z", allDay: false }]);
    expect(windows).toHaveLength(1);
    expect(windows[0].durationMinutes).toBe(540);
  });

  it("merges overlapping blockers and respects the minimum duration", () => {
    const windows = calculateDailyAvailability("2026-08-03", [{ startsAt: "2026-08-03T06:00:00.000Z", endsAt: "2026-08-03T08:00:00.000Z", allDay: false }, { startsAt: "2026-08-03T07:00:00.000Z", endsAt: "2026-08-03T09:00:00.000Z", allDay: false }], 60);
    expect(windows).toHaveLength(2);
    expect(windows.reduce((sum, window) => sum + window.durationMinutes, 0)).toBe(780);
  });
});


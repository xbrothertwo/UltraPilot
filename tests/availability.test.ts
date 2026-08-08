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

  it("blocks the whole pre-shift window when training before a late shift is disallowed", () => {
    const lateShift = { startsAt: "2026-08-03T13:00:00.000Z", endsAt: "2026-08-03T21:00:00.000Z", allDay: false, eventKind: "work_late" };
    const withoutRule = calculateDailyAvailability("2026-08-03", [lateShift]);
    expect(withoutRule.reduce((sum, window) => sum + window.durationMinutes, 0)).toBe(540);
    const withRule = calculateDailyAvailability("2026-08-03", [lateShift], 30, 6, 22, false, true);
    expect(withRule).toHaveLength(0);
  });

  it("blocks the whole post-shift window when training after a night shift is disallowed", () => {
    const nightShift = { startsAt: "2026-08-02T20:00:00.000Z", endsAt: "2026-08-03T05:00:00.000Z", allDay: false, eventKind: "work_night" };
    const withoutRule = calculateDailyAvailability("2026-08-03", [nightShift]);
    expect(withoutRule.reduce((sum, window) => sum + window.durationMinutes, 0)).toBeGreaterThan(0);
    const withRule = calculateDailyAvailability("2026-08-03", [nightShift], 30, 6, 22, true, false);
    expect(withRule).toHaveLength(0);
  });

  it("leaves availability untouched when the shift rules are satisfied by a different shift kind", () => {
    const earlyShift = { startsAt: "2026-08-03T04:00:00.000Z", endsAt: "2026-08-03T10:00:00.000Z", allDay: false, eventKind: "work_early" };
    const windows = calculateDailyAvailability("2026-08-03", [earlyShift], 30, 6, 22, false, false);
    expect(windows.reduce((sum, window) => sum + window.durationMinutes, 0)).toBe(600);
  });
});


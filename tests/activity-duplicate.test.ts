import { describe, expect, it } from "vitest";
import { findDuplicateActivity } from "../src/lib/activity-files/duplicate";

describe("findDuplicateActivity", () => {
  const existing = [
    { id: "a1", activityDate: "2026-08-09T07:00:00.000Z", movingTimeSeconds: 3600, distanceMeters: 30_000 },
  ];

  it("returns null when no candidates are close in time", () => {
    expect(findDuplicateActivity(existing, { startTime: "2026-08-10T07:00:00.000Z", movingTimeSeconds: 3600, distanceMeters: 30_000 })).toBeNull();
  });

  it("matches an exact re-upload of the same activity", () => {
    const duplicate = findDuplicateActivity(existing, { startTime: "2026-08-09T07:00:00.000Z", movingTimeSeconds: 3600, distanceMeters: 30_000 });
    expect(duplicate?.id).toBe("a1");
  });

  it("matches within tolerance for minor format rounding differences", () => {
    const duplicate = findDuplicateActivity(existing, { startTime: "2026-08-09T07:01:30.000Z", movingTimeSeconds: 3615, distanceMeters: 30_120 });
    expect(duplicate?.id).toBe("a1");
  });

  it("does not match when distance differs materially", () => {
    expect(findDuplicateActivity(existing, { startTime: "2026-08-09T07:00:00.000Z", movingTimeSeconds: 3600, distanceMeters: 45_000 })).toBeNull();
  });

  it("does not match when duration differs materially", () => {
    expect(findDuplicateActivity(existing, { startTime: "2026-08-09T07:00:00.000Z", movingTimeSeconds: 5400, distanceMeters: 30_000 })).toBeNull();
  });

  it("does not match when start time is far outside the tolerance window", () => {
    expect(findDuplicateActivity(existing, { startTime: "2026-08-09T07:10:00.000Z", movingTimeSeconds: 3600, distanceMeters: 30_000 })).toBeNull();
  });
});

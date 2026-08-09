import { describe, expect, it } from "vitest";
import { berlinDayInterval, berlinWeekRange } from "../src/lib/calendar/berlin";

describe("Berlin half-open calendar intervals", () => {
  it("contains the final millisecond but excludes the following midnight", () => {
    const interval = berlinDayInterval("2026-08-09");
    expect(new Date("2026-08-09T21:59:59.999Z").getTime()).toBeLessThan(interval.endExclusive.getTime());
    expect(new Date("2026-08-09T22:00:00.000Z").getTime()).toBe(interval.endExclusive.getTime());
  });

  it("joins consecutive days and weeks without gaps or overlaps", () => {
    expect(berlinDayInterval("2026-08-09").endExclusive).toEqual(berlinDayInterval("2026-08-10").startInclusive);
    expect(berlinWeekRange("2026-08-09")).toMatchObject({ start: "2026-08-03", end: "2026-08-09" });
    expect(berlinWeekRange("2026-08-09").endsAtExclusive).toEqual(berlinWeekRange("2026-08-10").startsAt);
  });

  it("uses 23-hour and 25-hour intervals across Berlin DST changes", () => {
    const spring = berlinDayInterval("2026-03-29");
    const autumn = berlinDayInterval("2026-10-25");
    expect(spring.startInclusive.toISOString()).toBe("2026-03-28T23:00:00.000Z");
    expect(spring.endExclusive.toISOString()).toBe("2026-03-29T22:00:00.000Z");
    expect((spring.endExclusive.getTime() - spring.startInclusive.getTime()) / 3_600_000).toBe(23);
    expect((autumn.endExclusive.getTime() - autumn.startInclusive.getTime()) / 3_600_000).toBe(25);
  });
});

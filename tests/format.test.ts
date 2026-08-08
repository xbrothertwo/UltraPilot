import { describe, expect, it } from "vitest";
import { formatPace, splitPlanReasons } from "../src/lib/format";

describe("running pace formatting", () => {
  it("formats speed as rounded minutes per kilometer", () => {
    expect(formatPace(12)).toBe("5:00 min/km");
    expect(formatPace(10.5)).toBe("5:43 min/km");
  });

  it("does not invent a pace without positive speed", () => {
    expect(formatPace(0)).toBe("–");
  });
});

describe("splitPlanReasons", () => {
  it("splits a summary paragraph into short standalone statements", () => {
    const summary = "145 km wurden eingeplant. Geplant wurden 4 Laufeinheiten. Arbeitstage sind auf 90 Minuten begrenzt.";
    expect(splitPlanReasons(summary, null)).toEqual([
      "145 km wurden eingeplant.",
      "Geplant wurden 4 Laufeinheiten.",
      "Arbeitstage sind auf 90 Minuten begrenzt.",
    ]);
  });

  it("appends the caution as its own statement when present", () => {
    expect(splitPlanReasons("Alles geplant.", "Wenig Zeitpuffer diese Woche.")).toEqual([
      "Alles geplant.",
      "Wenig Zeitpuffer diese Woche.",
    ]);
  });
});

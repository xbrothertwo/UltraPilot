import { describe, expect, it } from "vitest";
import { formatPace } from "../src/lib/format";

describe("running pace formatting", () => {
  it("formats speed as rounded minutes per kilometer", () => {
    expect(formatPace(12)).toBe("5:00 min/km");
    expect(formatPace(10.5)).toBe("5:43 min/km");
  });

  it("does not invent a pace without positive speed", () => {
    expect(formatPace(0)).toBe("–");
  });
});

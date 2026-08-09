import { describe, expect, it } from "vitest";
import { parsePrimarySport } from "../src/lib/sports";

describe("primary sport", () => {
  it.each(["cycling", "running"])("accepts %s", (sport) => expect(parsePrimarySport(sport)).toBe(sport));
  it.each([undefined, null, "swimming", ""])("rejects missing or invalid %s", (sport) => expect(parsePrimarySport(sport)).toBeNull());
});

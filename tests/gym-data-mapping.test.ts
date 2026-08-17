import { describe, expect, it } from "vitest";
import { relatedOne } from "@/lib/gym/data";

describe("gym Supabase relation mapping", () => {
  it("accepts the object shape returned by many-to-one embeds", () => {
    expect(relatedOne({ name: "Bankdrücken" })).toEqual({ name: "Bankdrücken" });
  });

  it("remains tolerant of generated array-shaped clients and missing archives", () => {
    expect(relatedOne([{ name: "Rudern" }])).toEqual({ name: "Rudern" });
    expect(relatedOne([])).toBeNull();
    expect(relatedOne(null)).toBeNull();
  });
});

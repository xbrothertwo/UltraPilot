import { describe, expect, it } from "vitest";
import { downsampleMinMax } from "../src/lib/stream-processing";

function sample(index: number, value: number) {
  return { timestamp: new Date(Date.UTC(2026, 0, 1, 10, 0, index)).toISOString(), value };
}

describe("activity stream downsampling", () => {
  it("keeps short streams unchanged", () => {
    const input = [sample(0, 100), sample(1, 110), sample(2, 105)];
    expect(downsampleMinMax(input, 10)).toEqual(input);
  });

  it("keeps boundaries and local extrema within the limit", () => {
    const input = Array.from({ length: 100 }, (_, index) => sample(index, index === 50 ? 999 : index % 10));
    const output = downsampleMinMax(input, 20);
    expect(output.length).toBeLessThanOrEqual(20);
    expect(output[0]).toEqual(input[0]);
    expect(output.at(-1)).toEqual(input.at(-1));
    expect(output.some((point) => point.value === 999)).toBe(true);
    expect(output.every((point, index) => index === 0 || point.timestamp >= output[index - 1].timestamp)).toBe(true);
  });

  it("rejects unusably small limits", () => {
    expect(() => downsampleMinMax([sample(0, 1)], 3)).toThrow(/mindestens 4/);
  });
});

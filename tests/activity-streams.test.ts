import { describe, expect, it } from "vitest";
import { downsampleMinMax } from "../src/lib/stream-processing";
import {
  isActivityStreamSource,
  validateActivityStreamRow,
  validateRawActivityStreamRow,
} from "../src/lib/activity-stream-validation";

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

describe("activity stream row validation", () => {
  it.each(["garmin_edge", "apple_watch", "gpx", "fit"])(
    "accepts %s as an activity stream source",
    (source) => {
      expect(isActivityStreamSource(source)).toBe(true);
    },
  );

  it("rejects an unknown activity stream source", () => {
    expect(isActivityStreamSource("unknown_device")).toBe(false);
  });

  it("keeps a FIT chart stream after row validation", () => {
    const validated = validateActivityStreamRow({
      stream_type: "speed",
      source: "fit",
      sample_count: 1,
      samples: [sample(0, 10)],
    });
    expect(validated).toMatchObject({ type: "speed", source: "fit", sampleCount: 1 });
    expect(validated?.samples).toHaveLength(1);
  });

  it.each(["heart_rate", "power"])(
    "keeps a FIT %s raw stream after row validation",
    (streamType) => {
      const validated = validateRawActivityStreamRow({
        stream_type: streamType,
        source: "fit",
        samples: [sample(0, 150)],
      });
      expect(validated).toMatchObject({ type: streamType, source: "fit" });
      expect(validated?.samples).toHaveLength(1);
    },
  );

  it("rejects an unknown source during row validation", () => {
    expect(
      validateActivityStreamRow({
        stream_type: "heart_rate",
        source: "unknown_device",
        samples: [sample(0, 150)],
      }),
    ).toBeNull();
  });
});

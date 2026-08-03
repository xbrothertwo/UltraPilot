import { describe, expect, it } from "vitest";
import { AppleHealthHeartRateParser } from "../src/lib/apple-health/xml-parser";
import { parseHeartRateJson } from "../src/lib/apple-health/json-parser";
import { extractAppleHealthHeartRate, extractAppleHealthHeartRateForRanges } from "../src/lib/apple-health/browser-extractor";
import { strToU8, zipSync } from "fflate";

const encoder = new TextEncoder();

describe("Apple Health local extraction", () => {
  it("streams export.xml from Apple's ZIP folder structure", async () => {
    const xml = `<HealthData><Record type="HKQuantityTypeIdentifierHeartRate" sourceName="Apple Watch" unit="count/min" startDate="2026-08-02 08:15:00 +0000" endDate="2026-08-02 08:15:00 +0000" value="123"/></HealthData>`;
    const archive = zipSync({ "apple_health_export/export.xml": strToU8(xml) });
    const file = new File([archive], "export.zip", { type: "application/zip" });
    const samples = await extractAppleHealthHeartRate(file, "2026-08-02T08:00:00.000Z", 3600);
    expect(samples).toEqual([{ timestamp: "2026-08-02T08:15:00.000Z", value: 123 }]);
  });

  it("reads one Health export for multiple activity ranges", async () => {
    const xml = `<HealthData>
      <Record type="HKQuantityTypeIdentifierHeartRate" unit="count/min" startDate="2026-08-02 08:15:00 +0000" value="123"/>
      <Record type="HKQuantityTypeIdentifierHeartRate" unit="count/min" startDate="2026-08-03 12:30:00 +0000" value="142"/>
    </HealthData>`;
    const file = new File([xml], "export.xml", { type: "application/xml" });
    const results = await extractAppleHealthHeartRateForRanges(file, [
      { startTime: "2026-08-02T08:00:00.000Z", elapsedTimeSeconds: 3600 },
      { startTime: "2026-08-03T12:00:00.000Z", elapsedTimeSeconds: 3600 },
      { startTime: "2026-08-04T12:00:00.000Z", elapsedTimeSeconds: 3600 },
    ]);
    expect(results).toEqual([
      [{ timestamp: "2026-08-02T08:15:00.000Z", value: 123 }],
      [{ timestamp: "2026-08-03T12:30:00.000Z", value: 142 }],
      [],
    ]);
  });

  it("extracts only heart rate samples inside the Garmin time range", () => {
    const parser = new AppleHealthHeartRateParser(
      new Date("2026-08-02T08:00:00Z").getTime(),
      new Date("2026-08-02T10:00:00Z").getTime(),
    );
    const xml = `<?xml version="1.0"?><HealthData>
      <Record type="HKQuantityTypeIdentifierHeartRate" sourceName="Apple Watch" unit="count/min" startDate="2026-08-02 07:59:00 +0000" endDate="2026-08-02 07:59:00 +0000" value="90"/>
      <Record type="HKQuantityTypeIdentifierHeartRate" sourceName="Apple Watch" unit="count/min" startDate="2026-08-02 08:15:00 +0000" endDate="2026-08-02 08:15:00 +0000" value="121"/>
      <Record type="HKQuantityTypeIdentifierStepCount" sourceName="Apple Watch" unit="count" startDate="2026-08-02 08:16:00 +0000" endDate="2026-08-02 08:16:00 +0000" value="20"/>
      <Record type="HKQuantityTypeIdentifierHeartRate" sourceName="Apple Watch" unit="count/min" startDate="2026-08-02 09:45:00 +0000" endDate="2026-08-02 09:45:00 +0000" value="149"/>
    </HealthData>`;
    const midpoint = Math.floor(xml.length / 2);
    parser.push(encoder.encode(xml.slice(0, midpoint)));
    parser.push(encoder.encode(xml.slice(midpoint)), true);
    expect(parser.result()).toEqual([
      { timestamp: "2026-08-02T08:15:00.000Z", value: 121 },
      { timestamp: "2026-08-02T09:45:00.000Z", value: 149 },
    ]);
  });

  it("validates the derived payload at the server boundary", () => {
    const parsed = parseHeartRateJson(JSON.stringify({ format: "ultrapilot-heart-rate-v1", samples: [
      { timestamp: "2026-08-02T08:15:00.000Z", value: 120 },
      { timestamp: "2026-08-02T08:16:00.000Z", value: 140 },
    ] }));
    expect(parsed.metrics.averageHeartRate).toBe(130);
    expect(parsed.metrics.maximumHeartRate).toBe(140);
    expect(parsed.streams[0].source).toBe("apple_watch");
  });

  it("rejects malformed derived data", () => {
    expect(() => parseHeartRateJson(JSON.stringify({ format: "wrong", samples: [] }))).toThrow(/ungültiges Format/);
    expect(() => parseHeartRateJson(JSON.stringify({ format: "ultrapilot-heart-rate-v1", samples: [{ timestamp: "bad", value: 120 }] }))).toThrow(/ungültige Werte/);
  });
});

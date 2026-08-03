import { describe, expect, it } from "vitest";
import { AppleHealthRecoveryParser } from "../src/lib/apple-health/recovery-parser";

describe("Apple Health recovery parser", () => {
  it("combines sleep stages with sleeping heart rate, HRV and resting heart rate", () => {
    const parser = new AppleHealthRecoveryParser(new Date("2026-08-01T00:00:00Z").getTime());
    const xml = `<HealthData>
      <Record type="HKCategoryTypeIdentifierSleepAnalysis" value="HKCategoryValueSleepAnalysisAsleepCore" startDate="2026-08-02 22:00:00 +0200" endDate="2026-08-03 01:00:00 +0200"/>
      <Record type="HKCategoryTypeIdentifierSleepAnalysis" value="HKCategoryValueSleepAnalysisAsleepDeep" startDate="2026-08-03 01:00:00 +0200" endDate="2026-08-03 02:00:00 +0200"/>
      <Record type="HKCategoryTypeIdentifierSleepAnalysis" value="HKCategoryValueSleepAnalysisAsleepREM" startDate="2026-08-03 02:00:00 +0200" endDate="2026-08-03 03:30:00 +0200"/>
      <Record type="HKCategoryTypeIdentifierSleepAnalysis" value="HKCategoryValueSleepAnalysisAwake" startDate="2026-08-03 03:30:00 +0200" endDate="2026-08-03 03:40:00 +0200"/>
      <Record type="HKQuantityTypeIdentifierHeartRate" unit="count/min" value="52" startDate="2026-08-03 00:30:00 +0200" endDate="2026-08-03 00:30:00 +0200"/>
      <Record type="HKQuantityTypeIdentifierHeartRate" unit="count/min" value="48" startDate="2026-08-03 01:30:00 +0200" endDate="2026-08-03 01:30:00 +0200"/>
      <Record type="HKQuantityTypeIdentifierHeartRateVariabilitySDNN" unit="ms" value="62" startDate="2026-08-03 01:20:00 +0200" endDate="2026-08-03 01:20:00 +0200"/>
      <Record type="HKQuantityTypeIdentifierRestingHeartRate" unit="count/min" value="50" startDate="2026-08-03 12:00:00 +0200" endDate="2026-08-03 12:00:00 +0200"/>
    </HealthData>`;
    const bytes = new TextEncoder().encode(xml);
    parser.push(bytes.slice(0, 400));
    parser.push(bytes.slice(400), true);
    const [result] = parser.result();
    expect(result.date).toBe("2026-08-03");
    expect(result.asleepMinutes).toBe(330);
    expect(result.deepMinutes).toBe(60);
    expect(result.remMinutes).toBe(90);
    expect(result.sleepingAverageHeartRate).toBe(50);
    expect(result.sleepingMinimumHeartRate).toBe(48);
    expect(result.hrvSdnnMs).toBe(62);
    expect(result.restingHeartRate).toBe(50);
  });

  it("does not double count overlapping unspecified and staged sleep", () => {
    const parser = new AppleHealthRecoveryParser(0);
    parser.push(new TextEncoder().encode(`<Record type="HKCategoryTypeIdentifierSleepAnalysis" value="HKCategoryValueSleepAnalysisAsleep" startDate="2026-08-02 22:00:00 +0200" endDate="2026-08-03 06:00:00 +0200"/><Record type="HKCategoryTypeIdentifierSleepAnalysis" value="HKCategoryValueSleepAnalysisAsleepCore" startDate="2026-08-02 22:00:00 +0200" endDate="2026-08-03 06:00:00 +0200"/>`), true);
    expect(parser.result()[0].asleepMinutes).toBe(480);
  });
});

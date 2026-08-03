import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { extractAppleHealthHeartRateForRanges, extractAppleHealthWorkouts } from "../src/lib/apple-health/browser-extractor";
import { AppleHealthWorkoutParser, appleHealthSport, isAppleHealthCycling } from "../src/lib/apple-health/workout-parser";

const xml = `<HealthData>
  <Record type="HKQuantityTypeIdentifierHeartRate" unit="count/min" value="142" startDate="2026-08-02 08:15:00 +0200"/>
  <Workout workoutActivityType="HKWorkoutActivityTypeRunning" duration="45.5" durationUnit="min" totalDistance="8.2" totalDistanceUnit="km" totalEnergyBurned="510" totalEnergyBurnedUnit="kcal" sourceName="Apple Watch" startDate="2026-08-02 08:00:00 +0200" endDate="2026-08-02 08:50:00 +0200"/>
  <Workout workoutActivityType="HKWorkoutActivityTypeTraditionalStrengthTraining" duration="60" durationUnit="min" sourceName="Apple Watch" startDate="2026-08-03 16:00:00 +0200" endDate="2026-08-03 17:00:00 +0200"/>
  <Workout workoutActivityType="HKWorkoutActivityTypeVolleyball" duration="90" durationUnit="min" sourceName="Apple Watch" startDate="2026-08-04 18:00:00 +0200" endDate="2026-08-04 19:30:00 +0200"/>
  <Workout workoutActivityType="HKWorkoutActivityTypeCycling" duration="120" durationUnit="min" sourceName="Apple Watch" startDate="2026-08-05 08:00:00 +0200" endDate="2026-08-05 10:00:00 +0200"/>
</HealthData>`;

describe("Apple Health workout import", () => {
  it("extracts running, strength and volleyball while excluding cycling", () => {
    const parser = new AppleHealthWorkoutParser();
    const bytes = new TextEncoder().encode(xml);
    parser.push(bytes.slice(0, 350));
    parser.push(bytes.slice(350), true);
    const result = parser.result();
    expect(result.workouts.map((workout) => workout.sportType)).toEqual(["running", "strength", "volleyball"]);
    expect(result.workouts[0].distanceMeters).toBe(8200);
    expect(result.workouts[0].movingTimeSeconds).toBe(2730);
    expect(result.ignoredCyclingCount).toBe(1);
  });

  it("reads workouts from export.zip and assigns heart rate by workout time", async () => {
    const archive = zipSync({ "apple_health_export/export.xml": strToU8(xml) });
    const file = new File([archive], "export.zip", { type: "application/zip" });
    const extraction = await extractAppleHealthWorkouts(file);
    const heartRate = await extractAppleHealthHeartRateForRanges(file, extraction.workouts.map((workout) => ({ startTime: workout.startTime, elapsedTimeSeconds: workout.elapsedTimeSeconds })));
    expect(heartRate[0]).toEqual([{ timestamp: "2026-08-02T06:15:00.000Z", value: 142 }]);
    expect(heartRate[1]).toEqual([]);
  });

  it("recognizes cycling separately but never maps it to an import sport", () => {
    expect(isAppleHealthCycling("HKWorkoutActivityTypeCycling")).toBe(true);
    expect(isAppleHealthCycling("HKWorkoutActivityTypeHandCycling")).toBe(true);
    expect(appleHealthSport("HKWorkoutActivityTypeCycling")).toBeNull();
    expect(appleHealthSport("HKWorkoutActivityTypeVolleyball")).toBe("volleyball");
  });

  it("deduplicates identical workout tags inside one export", () => {
    const parser = new AppleHealthWorkoutParser();
    const workoutTag = `<Workout workoutActivityType="HKWorkoutActivityTypeRunning" duration="30" durationUnit="min" startDate="2026-08-02 08:00:00 +0200" endDate="2026-08-02 08:30:00 +0200"/>`;
    parser.push(new TextEncoder().encode(`${workoutTag}${workoutTag}`), true);
    expect(parser.result().workouts).toHaveLength(1);
  });
});


import { describe, expect, it } from "vitest";
import type { Activity } from "../src/lib/demo-data";
import { buildMissionControl } from "../src/lib/mission-control";

function ride(id: string, date: string, km: number, hours = 4): Activity { return { id, userId: "u", sportType: "cycling", activityDate: `${date}T08:00:00Z`, title: id, distanceMeters: km * 1000, movingTimeSeconds: hours * 3600, elapsedTimeSeconds: hours * 3600, elevationGainMeters: 0, averageSpeedKmh: km / hours, averageHeartRate: 130, maximumHeartRate: 160, averagePower: null, normalizedPower: null, source: "fit", createdAt: `${date}T12:00:00Z` }; }

describe("RAG mission control", () => {
  it("detects longest ride and consecutive-day distance", () => {
    const result = buildMissionControl({ activities: [ride("a", "2026-07-25", 140), ride("b", "2026-07-26", 120), ride("c", "2026-07-10", 210)], nutrition: [], feedback: [], drifts: [], weeklyGoalKm: 125, targetYear: 2028, today: "2026-08-03", recoveryTrackedNights: 0, recoveryStableNights: 0 });
    expect(result.longestRideKm).toBe(210);
    expect(result.bestBackToBackKm).toBe(260);
    expect(result.milestones.find((item) => item.key === "ride_200")?.achieved).toBe(true);
  });

  it("counts only completed weeks reaching 80 percent of the goal", () => {
    const activities = [ride("w1", "2026-07-27", 100), ride("w2", "2026-07-20", 110), ride("w3", "2026-07-13", 130), ride("w4", "2026-07-06", 90)];
    const result = buildMissionControl({ activities, nutrition: [], feedback: [], drifts: [], weeklyGoalKm: 125, targetYear: 2028, today: "2026-08-03", recoveryTrackedNights: 0, recoveryStableNights: 0 });
    expect(result.consistentWeeks).toBe(3);
  });

  it("requires recorded carbs and acceptable stomach feedback for fueling evidence", () => {
    const activities = [ride("good", "2026-07-20", 100, 4), ride("bad", "2026-07-27", 100, 4)];
    const result = buildMissionControl({ activities, nutrition: [{ activityId: "good", carbohydratesGrams: 200, fluidMilliliters: 1000 }, { activityId: "bad", carbohydratesGrams: 200, fluidMilliliters: 1000 }], feedback: [{ activityId: "good", stomachTolerance: 8, perceivedExertion: 4 }, { activityId: "bad", stomachTolerance: 3, perceivedExertion: 6 }], drifts: [], weeklyGoalKm: 125, targetYear: 2028, today: "2026-08-03", recoveryTrackedNights: 0, recoveryStableNights: 0 });
    expect(result.qualifyingFuelingRides).toBe(1);
  });

  it("shows untracked capabilities instead of inventing progress", () => {
    const result = buildMissionControl({ activities: [], nutrition: [], feedback: [], drifts: [], weeklyGoalKm: 125, targetYear: 2028, today: "2026-08-03", recoveryTrackedNights: 0, recoveryStableNights: 0 });
    expect(result.capabilities.find((item) => item.key === "heart_rate")?.progressPercent).toBeNull();
    expect(result.capabilities.find((item) => item.key === "strength")?.status).toBe("untracked");
  });
});

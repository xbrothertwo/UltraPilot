import { describe, expect, it } from "vitest";
import { buildOnboardingV2RpcArguments } from "../src/lib/onboarding-input";
import { deriveInitialPlanningTargetKm, firstPlanningWeekStart } from "../src/lib/onboarding-planning";

function form(values: Record<string, string | string[]>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) {
    for (const item of Array.isArray(value) ? value : [value]) formData.append(key, item);
  }
  return formData;
}

const days = ["1", "2", "3", "4", "5", "6", "7"];

describe("buildOnboardingV2RpcArguments", () => {
  it("builds Running + Gym with three sessions, half marathon and zero baseline", () => {
    const result = buildOnboardingV2RpcArguments(form({
      sports: ["running", "strength"], sportPriority: "running",
      runningSessions: "3", strengthSessions: "3", goalType: "running_event",
      eventName: "Erster Halbmarathon", eventDistance: "21,1",
      targetDate: "2027-05-09", currentWeeklyDistance: "0",
      availableWeekdays: days, gymExperience: "beginner",
    }));
    expect(result).toMatchObject({
      p_selected_sports: ["running", "strength"], p_primary_sport: "running",
      p_running_sessions_per_week: 3, p_gym_summer_sessions: 3,
      p_gym_winter_sessions: 3, p_current_weekly_distance_km: 0,
      p_weekly_distance_goal_km: 12, p_event_distance_km: 21.1,
      p_target_date: "2027-05-09",
    });
  });

  it("builds Cycling only with an unknown baseline", () => {
    const result = buildOnboardingV2RpcArguments(form({
      sports: "cycling", sportPriority: "cycling", cyclingSessions: "3",
      goalType: "endurance", availableWeekdays: ["2", "4", "6"], ftpWatts: "245",
    }));
    expect(result).toMatchObject({
      p_selected_sports: ["cycling"], p_primary_sport: "cycling",
      p_weekly_distance_goal_km: 45, p_current_weekly_distance_km: null,
      p_ftp_watts: 245,
    });
  });

  it("builds Gym only without fake endurance distance", () => {
    const result = buildOnboardingV2RpcArguments(form({
      sports: "strength", sportPriority: "strength", strengthSessions: "3",
      goalType: "strength", availableWeekdays: ["1", "3", "5"],
      gymExperience: "intermediate", gymEquipment: ["Kurzhanteln", "Langhantel"],
    }));
    expect(result).toMatchObject({
      p_selected_sports: ["strength"], p_weekly_distance_goal_km: 0,
      p_gym_summer_sessions: 3, p_gym_experience: "intermediate",
      p_gym_equipment: ["Kurzhanteln", "Langhantel"],
    });
  });

  it("builds Running only without an event", () => {
    const result = buildOnboardingV2RpcArguments(form({
      sports: "running", sportPriority: "running", runningSessions: "2",
      goalType: "consistency", currentWeeklyDistance: "8.5",
      availableWeekdays: ["2", "5"],
    }));
    expect(result).toMatchObject({
      p_goal_type: "consistency", p_event_name: null,
      p_weekly_distance_goal_km: 8.5, p_running_sessions_per_week: 2,
    });
  });

  it("builds Running + Volleyball and protects cross-training load", () => {
    const result = buildOnboardingV2RpcArguments(form({
      sports: ["running", "volleyball"], sportPriority: "running",
      runningSessions: "3", volleyballSessions: "2", goalType: "speed",
      currentWeeklyDistance: "20", availableWeekdays: days,
    }));
    expect(result).toMatchObject({
      p_volleyball_sessions_per_week: 2, p_easy_run_with_cross_training: true,
      p_weekly_distance_goal_km: 20,
    });
  });

  it("requires a plannable sport when Volleyball is selected", () => {
    expect(() => buildOnboardingV2RpcArguments(form({
      sports: "volleyball", volleyballSessions: "2", goalType: "consistency",
      availableWeekdays: days,
    }))).toThrow("Wähle zusätzlich Laufen, Radfahren oder Krafttraining");
  });

  it.each(["5", "10", "21.1", "21,1", "42.195", "100"])(
    "accepts decimal event distance %s",
    (distance) => {
      const result = buildOnboardingV2RpcArguments(form({
        sports: "running", runningSessions: "3", goalType: "running_event",
        eventDistance: distance, availableWeekdays: days,
      }));
      expect(result.p_event_distance_km).toBe(Number(distance.replace(",", ".")));
    },
  );

  it("rejects invalid physiology", () => {
    expect(() => buildOnboardingV2RpcArguments(form({
      sports: "running", runningSessions: "3", goalType: "endurance",
      availableWeekdays: days, maxHeartRate: "120", restingHeartRate: "120",
    }))).toThrow("Der Ruhepuls muss unter dem Maximalpuls liegen.");
  });

  it("rejects an impossible event date", () => {
    expect(() => buildOnboardingV2RpcArguments(form({
      sports: "running", runningSessions: "3", goalType: "running_event",
      targetDate: "2027-02-31", availableWeekdays: days,
    }))).toThrow("Das Zieldatum ist ungültig.");
  });
});

describe("first-run planning policy", () => {
  it("keeps current volume separate and creates a non-zero beginner target", () => {
    expect(deriveInitialPlanningTargetKm({
      primarySport: "running", desiredSessions: 3,
      currentWeeklyDistanceKm: 0, enduranceSelected: true,
    })).toBe(12);
  });

  it("moves to next Monday when no selected day remains", () => {
    expect(firstPlanningWeekStart([1, 2], new Date("2026-08-07T12:00:00Z"))).toBe("2026-08-10");
  });
});

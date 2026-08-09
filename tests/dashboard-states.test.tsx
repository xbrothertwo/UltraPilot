import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DashboardMissionSummary, DashboardPrimarySportError } from "../src/components/dashboard-states";
import { buildDashboardMissionControl, selectDashboardMission } from "../src/lib/dashboard-view-model";
import type { Activity } from "../src/lib/demo-data";
import type { SavedMission } from "../src/lib/missions";
import { resolvePrimarySport } from "../src/lib/planning/data";

function mission(overrides: Partial<SavedMission> = {}): SavedMission {
  return { id: "m", source: "custom", derivedKey: null, title: "Projekt Herbst", description: null, sportType: "cycling", status: "planned", targetDate: "2026-10-04", startAt: null, distanceKm: 0, elevationMeters: 0, averageSpeedKmh: null, paceSecondsPerKm: null, stopIntervalKm: 0, stopDurationMinutes: 0, carbohydratesPerHour: 0, fluidMillilitersPerHour: 0, sodiumMilligramsPerHour: 0, createdAt: "2026-08-01T00:00:00Z", updatedAt: "2026-08-01T00:00:00Z", ...overrides };
}

describe("dashboard error and mission states", () => {
  it.each([
    [undefined, false, "missing"],
    [null, false, "missing"],
    ["swimming", false, "invalid"],
    [undefined, true, "load_error"],
  ] as const)("renders explicit state for %s / loadError=%s", (value, loadError, status) => {
    const resolution = resolvePrimarySport(value, loadError);
    expect(resolution.status).toBe(status);
    if (resolution.status === "valid") throw new Error("Test setup produced a valid sport.");
    const html = renderToStaticMarkup(<DashboardPrimarySportError resolution={resolution} />);
    expect(html).toContain("Dashboard nicht verfügbar");
    expect(html).toContain("/plan#planning-rules");
    expect(html).not.toMatch(/Rad-Wochenziel|Radkilometer/);
    if (status === "load_error") expect(html).toContain("konnte nicht geladen werden");
    else expect(html).toContain("Wähle in den Planungsregeln");
  });

  it.each([
    mission({ sportType: "cycling", distanceKm: 0 }),
    mission({ sportType: "cycling", distanceKm: Number.NaN }),
    mission({ sportType: "running", distanceKm: 100 }),
  ])("renders incompatible or incomplete mission data neutrally", (savedMission) => {
    const selection = selectDashboardMission([savedMission], "cycling");
    const html = renderToStaticMarkup(<DashboardMissionSummary selection={selection} control={null} />);
    expect(html).toContain("Projekt Herbst");
    expect(html).toContain("04.10.2026");
    expect(html).not.toMatch(/%| km|10-km|125-km|Lang|Nacht|Back-to-back|Fahrt|Lauf/);
  });

  it("renders progress from a valid mission target without a 125-km profile fallback", () => {
    const savedMission = mission({ sportType: "running", distanceKm: 50 });
    const selection = selectDashboardMission([savedMission], "running");
    const run: Activity = { id: "run", userId: "u", sportType: "running", activityDate: "2026-08-01T08:00:00Z", title: "Lauf", distanceMeters: 25_000, movingTimeSeconds: 10_000, elapsedTimeSeconds: 10_000, elevationGainMeters: 0, averageSpeedKmh: null, averageHeartRate: null, maximumHeartRate: null, averagePower: null, normalizedPower: null, source: "manual", createdAt: "2026-08-01T12:00:00Z" };
    const control = buildDashboardMissionControl({ selection, activities: [run], today: "2026-08-10", supportMode: null, targetYear: null, recoveryTrackedNights: 0 });
    const html = renderToStaticMarkup(<DashboardMissionSummary selection={selection} control={control} />);
    expect(html).toContain("50-km-Lauf");
    expect(html).toContain("50%");
    expect(html).not.toContain("125");
  });
});

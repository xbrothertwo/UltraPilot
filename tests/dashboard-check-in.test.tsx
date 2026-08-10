import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DashboardCheckIn } from "../src/components/dashboard-check-in";
import type { DailyDecision } from "../src/lib/daily-cockpit";
import type { ReadinessResult } from "../src/lib/recovery-readiness";

const decision: DailyDecision = { level: "go", eyebrow: "Grünes Licht", title: "Locker trainieren", summary: "Heute passt die geplante Einheit.", reasons: [] };
const base: ReadinessResult = { date: "2026-08-10", status: "unknown", score: null, reasons: [], metric: null, checkin: null };

describe("prominent dashboard check-in", () => {
  it("shows a prominent CTA before completion", () => {
    const html = renderToStaticMarkup(<DashboardCheckIn readiness={base} decision={decision} workoutTitle="Lockerer Lauf" />);
    expect(html).toContain("Daily Check-in");
    expect(html).toContain("Wie fühlst du dich heute?");
    expect(html).toContain("Check-in starten");
    expect(html).toContain('data-testid="daily-check-in"');
  });

  it("shows readiness, recommendation and correction after completion", () => {
    const readiness: ReadinessResult = { ...base, status: "green", score: 86, checkin: { date: base.date, sleepQuality: 8, generalFreshness: 8, legFreshness: 7, motivation: 8, wellbeing: 8, symptomLevel: "none", notes: "" } };
    const html = renderToStaticMarkup(<DashboardCheckIn readiness={readiness} decision={decision} workoutTitle="Lockerer Lauf" />);
    expect(html).toContain("Bereit");
    expect(html).toContain("86 / 100");
    expect(html).toContain(decision.summary);
    expect(html).toContain("Als Nächstes: Lockerer Lauf");
    expect(html).toContain("Check-in korrigieren");
  });
});

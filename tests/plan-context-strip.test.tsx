import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PlanContextStrip } from "@/components/plan/plan-context-strip";
import type { TrainingBlock } from "@/lib/planning/blocks";
import type { ReadinessResult } from "@/lib/recovery-readiness";

const readiness: ReadinessResult = {
  date: "2026-08-17",
  status: "unknown",
  score: null,
  reasons: [],
  metric: null,
  checkin: null,
};

const block: TrainingBlock = {
  id: "block-1",
  name: "RAG Grundlagenblock",
  sportType: "cycling",
  goal: "Ausdauer aufbauen",
  startDate: "2026-08-03",
  endDate: "2026-08-30",
  weekCount: 4,
  baseWeeklyDistanceKm: 125,
  startingLongRideKm: 60,
  recoveryWeekPercentage: 80,
  status: "active",
  weeks: [
    {
      id: "week-1",
      weekNumber: 3,
      weekStart: "2026-08-17",
      phase: "load",
      targetDistanceKm: 145,
      longRideTargetKm: 75,
      tempoSessionTarget: 1,
      purpose: "Belastungswoche",
    },
  ],
};

describe("plan context strip", () => {
  it("prioritizes an open daily check-in", () => {
    const html = renderToStaticMarkup(
      <PlanContextStrip
        readiness={readiness}
        block={null}
        blockWeek={null}
        week="2026-08-17"
      />,
    );

    expect(html).toContain("Check-in noch offen");
    expect(html).toContain("30 Sekunden");
    expect(html).toContain(
      "/plan?week=2026-08-17&amp;checkin=open#daily-readiness",
    );
  });

  it("shows completed check-in and compact training-block context", () => {
    const completed: ReadinessResult = {
      ...readiness,
      status: "green",
      score: 87,
      checkin: {
        date: readiness.date,
        sleepQuality: 8,
        generalFreshness: 8,
        legFreshness: 7,
        motivation: 9,
        wellbeing: 8,
        symptomLevel: "none",
        notes: "",
      },
    };
    const html = renderToStaticMarkup(
      <PlanContextStrip
        readiness={completed}
        block={block}
        blockWeek={block.weeks[0]}
        week="2026-08-17"
      />,
    );

    expect(html).toContain("Bereit für den Plan");
    expect(html).toContain("87 / 100");
    expect(html).toContain("RAG Grundlagenblock");
    expect(html).toContain("Woche 3/4");
    expect(html).toContain("Belastung");
    expect(html).toContain("/plan/block/block-1");
  });
});

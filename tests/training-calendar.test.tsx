import { act, create, type ReactTestRenderer } from "react-test-renderer";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  movePlannedWorkout: vi.fn(async () => ({ ok: true })),
  noop: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { children: ReactNode }) => (
    <a {...props}>{children}</a>
  ),
}));
vi.mock("@/app/plan/actions", () => ({
  deleteCalendarEvent: actions.noop,
  deletePlannedWorkout: actions.noop,
  extendPlannedWorkout: actions.noop,
  movePlannedWorkout: actions.movePlannedWorkout,
  reduceWorkoutIntensity: actions.noop,
  saveCalendarEvent: actions.noop,
  savePlannedWorkout: actions.noop,
  setPlannedWorkoutLock: actions.noop,
  setPlannedWorkoutStatus: actions.noop,
  shortenPlannedWorkout: actions.noop,
}));

import { TrainingCalendar } from "@/components/training-calendar";
import type { Activity } from "@/lib/demo-data";
import type { PlannedWorkout } from "@/lib/planning/workouts";
import type { ReadinessResult } from "@/lib/recovery-readiness";
import type { PaceZone, ZoneDefinition } from "@/lib/training-zones";

const days = [
  "2026-08-17",
  "2026-08-18",
  "2026-08-19",
  "2026-08-20",
  "2026-08-21",
  "2026-08-22",
  "2026-08-23",
];

const heartRateZones: ZoneDefinition[] = [
  { name: "Z1", lower: null, upper: 120, color: "#aaa" },
  { name: "Z2", lower: 121, upper: 140, color: "#bbb" },
  { name: "Z3", lower: 141, upper: 155, color: "#ccc" },
  { name: "Z4", lower: 156, upper: 170, color: "#ddd" },
  { name: "Z5", lower: 171, upper: null, color: "#eee" },
];

const paceZones: PaceZone[] = [
  { name: "Z1", fasterBoundSecondsPerKm: 390, slowerBoundSecondsPerKm: null },
  { name: "Z2", fasterBoundSecondsPerKm: 360, slowerBoundSecondsPerKm: 390 },
  { name: "Z3", fasterBoundSecondsPerKm: 335, slowerBoundSecondsPerKm: 360 },
  { name: "Z4", fasterBoundSecondsPerKm: 320, slowerBoundSecondsPerKm: 335 },
  { name: "Z5", fasterBoundSecondsPerKm: null, slowerBoundSecondsPerKm: 320 },
];

function workout(overrides: Partial<PlannedWorkout> = {}): PlannedWorkout {
  return {
    id: "workout-1",
    scheduledDate: days[0],
    sportType: "cycling",
    title: "Grundlagenausfahrt",
    description: "20 min locker\n40 min Grundlage",
    personalNote: null,
    intensity: "endurance",
    plannedDurationMinutes: 90,
    plannedDistanceKm: 40,
    status: "planned",
    linkedActivityId: null,
    source: "automatic",
    generationId: "generation-1",
    locked: false,
    preferredStartTime: "09:00",
    targetHeartRateZone: null,
    targetPowerZone: null,
    ...overrides,
  };
}

function activity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: "activity-1",
    userId: "user-1",
    sportType: "running",
    activityDate: "2026-08-18T08:00:00.000Z",
    title: "Morgenlauf",
    distanceMeters: 10_000,
    movingTimeSeconds: 3_000,
    elapsedTimeSeconds: 3_030,
    elevationGainMeters: 70,
    averageSpeedKmh: 12,
    averageHeartRate: 145,
    maximumHeartRate: 165,
    averagePower: null,
    normalizedPower: null,
    source: "gpx",
    createdAt: "2026-08-18T09:00:00.000Z",
    ...overrides,
  };
}

function readiness(): ReadinessResult[] {
  return days.map((date) => ({
    date,
    status: date === days[0] ? "green" : "unknown",
    score: date === days[0] ? 84 : null,
    reasons: [],
    metric: null,
    checkin: null,
  }));
}

function renderCalendar(
  workouts: PlannedWorkout[],
  activities: Activity[] = [],
): ReactTestRenderer {
  return create(
    <TrainingCalendar
      primarySport="cycling"
      days={days}
      week={days[0]}
      workouts={workouts}
      events={[]}
      activities={activities}
      heartRateZones={heartRateZones}
      paceZones={paceZones}
      powerZones={null}
      readiness={readiness()}
      activityLoads={[]}
    />,
  );
}

function allText(renderer: ReactTestRenderer): string {
  return renderer.root
    .findAll((node) => typeof node.children[0] === "string")
    .flatMap((node) => node.children)
    .filter((child): child is string => typeof child === "string")
    .join(" ");
}

describe("responsive training calendar", () => {
  let renderer: ReactTestRenderer;
  let keydown: ((event: KeyboardEvent) => void) | undefined;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.stubGlobal("window", {
      addEventListener: vi.fn((type: string, listener: (event: KeyboardEvent) => void) => {
        if (type === "keydown") keydown = listener;
      }),
      removeEventListener: vi.fn(),
    });
    vi.stubGlobal("document", {
      activeElement: null,
      body: { style: { overflow: "" } },
    });
  });

  afterEach(() => {
    if (renderer) act(() => renderer.unmount());
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("renders planned, locked, adjusted and completed workouts with explicit states", () => {
    const completedActivity = activity();
    const workouts = [
      workout({
        id: "long-title",
        title:
          "Sehr langer Grundlagenlauf mit ruhigem Beginn und kontrolliertem Abschluss",
        sportType: "running",
      }),
      workout({ id: "locked", scheduledDate: days[1], locked: true }),
      workout({
        id: "adjusted",
        scheduledDate: days[2],
        source: "manual",
        generationId: "generation-1",
      }),
      workout({
        id: "completed",
        scheduledDate: days[1],
        sportType: "running",
        linkedActivityId: completedActivity.id,
      }),
      workout({
        id: "volleyball",
        scheduledDate: days[3],
        sportType: "volleyball",
        title: "Volleyballtraining",
        plannedDistanceKm: 14,
      }),
    ];

    act(() => {
      renderer = renderCalendar(workouts, [completedActivity]);
    });
    const text = allText(renderer);

    expect(text).toContain("Sehr langer Grundlagenlauf");
    expect(text).toContain("Gesperrt");
    expect(text).toContain("Angepasst");
    expect(text).toContain("Absolviert");
    expect(text).toContain("Volleyballtraining");
    expect(text).toContain("min/km");
  });

  it("opens workout details, exposes dialog semantics and closes with Escape", () => {
    act(() => {
      renderer = renderCalendar([workout()]);
    });
    const openButton = renderer.root.findAllByProps({
      "aria-label": "Grundlagenausfahrt öffnen, Geplant",
    })[0];

    act(() => openButton.props.onClick());
    expect(renderer.root.findByProps({ role: "dialog" }).props).toMatchObject({
      "aria-modal": "true",
      "aria-labelledby": "workout-panel-title",
    });
    expect(
      renderer.root.findByProps({ "aria-label": "Workout-Details schließen" }),
    ).toBeTruthy();

    act(() => keydown?.({ key: "Escape" } as KeyboardEvent));
    expect(renderer.root.findAllByProps({ role: "dialog" })).toHaveLength(0);
  });

  it("changes the selected mobile day without changing the desktop week", () => {
    act(() => {
      renderer = renderCalendar([
        workout(),
        workout({ id: "day-two", scheduledDate: days[1], title: "Dienstagslauf" }),
      ]);
    });
    const secondDay = renderer.root.findByProps({
      "aria-label": "Dienstag, 18. August auswählen",
    });
    expect(secondDay.props["aria-pressed"]).toBe(false);

    act(() => secondDay.props.onClick());
    expect(
      renderer.root.findByProps({
        "aria-label": "Dienstag, 18. August auswählen",
      }).props["aria-pressed"],
    ).toBe(true);
    expect(allText(renderer)).toContain("Dienstagslauf");
  });

  it("renders a useful empty state for days without content", () => {
    act(() => {
      renderer = renderCalendar([]);
    });
    expect(allText(renderer)).toContain("Noch keine Einheit oder Termin");
    expect(
      renderer.root.findAllByProps({
        "aria-label": `Training am ${days[0]} hinzufügen`,
      }).length,
    ).toBeGreaterThan(0);
  });
});

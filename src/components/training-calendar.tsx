"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { movePlannedWorkout } from "@/app/plan/actions";
import { CalendarDay } from "@/components/plan/calendar-day";
import { CalendarEventPanel } from "@/components/plan/calendar-event-panel";
import { WorkoutDetailPanel } from "@/components/plan/workout-detail-panel";
import type { Activity } from "@/lib/demo-data";
import { eventOverlapsLocalDay, zonedLocalTimeToIso } from "@/lib/calendar/ics-parser";
import type { PlanningEvent } from "@/lib/planning/data";
import { buildWorkoutCalendarView } from "@/lib/planning/calendar-view";
import {
  reconcilePlannedWorkouts,
  type ReconciledWorkout,
} from "@/lib/planning/reconciliation";
import type { PlannedWorkout } from "@/lib/planning/workouts";
import type { ReadinessResult } from "@/lib/recovery-readiness";
import type { PrimarySport } from "@/lib/sports";
import type { ActivityLoad } from "@/lib/training-load";
import type { PaceZone, ZoneDefinition } from "@/lib/training-zones";

type EditorState = { date: string; item: ReconciledWorkout | null } | null;

function localDate(value: string | Date): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(typeof value === "string" ? new Date(value) : value);
}

function emptyCalendarEvent(date: string): PlanningEvent {
  const compact = date.replaceAll("-", "");
  return {
    id: "",
    title: "",
    eventKind: "appointment",
    startsAt: zonedLocalTimeToIso(`${compact}T090000`, "Europe/Berlin"),
    endsAt: zonedLocalTimeToIso(`${compact}T100000`, "Europe/Berlin"),
    allDay: false,
  };
}

export function TrainingCalendar({
  primarySport,
  days,
  week,
  workouts,
  events,
  activities,
  heartRateZones,
  paceZones,
  powerZones,
  readiness,
  activityLoads,
}: {
  primarySport: PrimarySport;
  days: string[];
  week: string;
  workouts: PlannedWorkout[];
  events: PlanningEvent[];
  activities: Activity[];
  heartRateZones: ZoneDefinition[] | null;
  paceZones: PaceZone[] | null;
  powerZones: ZoneDefinition[] | null;
  readiness: ReadinessResult[];
  activityLoads: ActivityLoad[];
}) {
  const router = useRouter();
  const today = localDate(new Date());
  const [selectedDate, setSelectedDate] = useState(
    days.includes(today) ? today : days[0],
  );
  const [editor, setEditor] = useState<EditorState>(null);
  const [eventEditor, setEventEditor] = useState<PlanningEvent | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [moving, startMove] = useTransition();
  const activeDate = days.includes(selectedDate)
    ? selectedDate
    : days.includes(today)
      ? today
      : days[0];

  const reconciled = useMemo(
    () => reconcilePlannedWorkouts(workouts, activities),
    [activities, workouts],
  );
  const weekWorkouts = useMemo(
    () => reconciled.map((item) => item.workout),
    [reconciled],
  );
  const matchedActivityIds = useMemo(
    () =>
      new Set(
        reconciled.flatMap((item) =>
          item.activity ? [item.activity.id] : [],
        ),
      ),
    [reconciled],
  );

  const closeEditor = useCallback(() => setEditor(null), []);
  const closeEventEditor = useCallback(() => setEventEditor(null), []);

  function dropWorkout(id: string, date: string) {
    startMove(async () => {
      const result = await movePlannedWorkout(id, date);
      if (!result.ok) {
        setMoveError(
          result.message ?? "Einheit konnte nicht verschoben werden.",
        );
        return;
      }
      setMoveError(null);
      setSelectedDate(date);
      router.refresh();
    });
  }

  function contentForDay(date: string) {
    return {
      workouts: reconciled
        .filter((item) => item.workout.scheduledDate === date)
        .map((item) => ({
          item,
          view: buildWorkoutCalendarView(item, heartRateZones, paceZones),
        })),
      events: events.filter(
        (event) =>
          localDate(event.startsAt) === date ||
          eventOverlapsLocalDay(event, date),
      ),
      activities: activities.filter(
        (activity) =>
          localDate(activity.activityDate) === date &&
          !matchedActivityIds.has(activity.id),
      ),
      readiness: readiness.find((item) => item.date === date),
    };
  }

  const selectedContent = contentForDay(activeDate);
  const editorView = editor?.item
    ? buildWorkoutCalendarView(editor.item, heartRateZones, paceZones)
    : null;
  const editorActivityLoad = editor?.item?.activity
    ? activityLoads.find(
        (load) => load.activityId === editor.item?.activity?.id,
      ) ?? null
    : null;

  return (
    <section aria-labelledby="training-calendar-title">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Trainingswoche</p>
          <h2 id="training-calendar-title" className="mt-1 text-xl font-black">
            Kalender & Tagesdetails
          </h2>
        </div>
        <ul
          aria-label="Kalenderstatus"
          className="flex flex-wrap gap-x-3 gap-y-1 text-[.68rem] font-bold text-[var(--muted)]"
        >
          <li>● Geplant</li>
          <li className="text-[var(--success)]">● Absolviert</li>
          <li className="text-[var(--warning)]">● Gesperrt</li>
          <li className="text-[var(--accent)]">● Angepasst</li>
        </ul>
      </div>

      {moveError ? (
        <p
          role="alert"
          className="mb-4 rounded-xl bg-[var(--danger-soft)] px-4 py-3 text-sm font-bold text-[var(--danger)]"
        >
          {moveError}
        </p>
      ) : null}

      <div className="lg:hidden">
        <div
          aria-label="Tag auswählen"
          className="-mx-4 mb-3 flex snap-x gap-2 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6"
        >
          {days.map((date) => {
            const value = new Date(`${date}T12:00:00`);
            const dayReadiness = readiness.find((item) => item.date === date);
            const active = date === activeDate;
            const workoutCount = reconciled.filter(
              (item) => item.workout.scheduledDate === date,
            ).length;
            return (
              <button
                key={date}
                type="button"
                aria-pressed={active}
                aria-label={`${new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "long" }).format(value)} auswählen`}
                onClick={() => setSelectedDate(date)}
                className={`min-w-[4.3rem] snap-start rounded-2xl border px-3 py-2.5 text-center transition ${active ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--button-primary-text)] shadow-sm" : "border-[var(--line)] bg-[var(--card)] text-[var(--ink)]"}`}
              >
                <span className="block text-[.62rem] font-black uppercase tracking-wider opacity-70">
                  {new Intl.DateTimeFormat("de-DE", { weekday: "short" }).format(
                    value,
                  )}
                </span>
                <span className="mt-0.5 block text-lg font-black">
                  {new Intl.DateTimeFormat("de-DE", { day: "2-digit" }).format(
                    value,
                  )}
                </span>
                <span className="mt-1 flex items-center justify-center gap-1 text-[.6rem] font-bold opacity-75">
                  {dayReadiness ? (
                    <span aria-hidden className="size-1.5 rounded-full bg-current" />
                  ) : null}
                  {workoutCount || "–"}
                </span>
              </button>
            );
          })}
        </div>
        <CalendarDay
          date={activeDate}
          isToday={activeDate === today}
          isPast={activeDate < today}
          mobile
          {...selectedContent}
          onAddWorkout={() => setEditor({ date: activeDate, item: null })}
          onAddEvent={() => setEventEditor(emptyCalendarEvent(activeDate))}
          onOpenWorkout={(item) => setEditor({ date: activeDate, item })}
          onOpenEvent={setEventEditor}
        />
      </div>

      <div
        aria-busy={moving}
        className={`card hidden overflow-hidden lg:grid lg:grid-cols-7 lg:divide-x lg:divide-[var(--line)] ${moving ? "opacity-70" : ""}`}
      >
        {days.map((date) => {
          const content = contentForDay(date);
          return (
            <CalendarDay
              key={date}
              date={date}
              isToday={date === today}
              isPast={date < today}
              {...content}
              onAddWorkout={() => setEditor({ date, item: null })}
              onAddEvent={() => setEventEditor(emptyCalendarEvent(date))}
              onOpenWorkout={(item) => setEditor({ date, item })}
              onOpenEvent={setEventEditor}
              onDropWorkout={(id) => dropWorkout(id, date)}
            />
          );
        })}
      </div>

      {editor ? (
        <WorkoutDetailPanel
          date={editor.date}
          week={week}
          item={editor.item}
          view={editorView}
          primarySport={primarySport}
          readiness={readiness.find((item) => item.date === editor.date)}
          weekWorkouts={weekWorkouts}
          heartRateZones={heartRateZones}
          paceZones={paceZones}
          powerZones={powerZones}
          activityLoad={editorActivityLoad}
          onClose={closeEditor}
        />
      ) : null}

      {eventEditor ? (
        <CalendarEventPanel
          event={eventEditor}
          week={week}
          onClose={closeEventEditor}
        />
      ) : null}
    </section>
  );
}

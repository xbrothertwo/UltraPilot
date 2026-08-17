import Link from "next/link";
import type { Activity } from "@/lib/demo-data";
import type { PlanningEvent } from "@/lib/planning/data";
import type { WorkoutCalendarView } from "@/lib/planning/calendar-view";
import { buildActivityCalendarMetrics } from "@/lib/planning/calendar-view";
import type { ReconciledWorkout } from "@/lib/planning/reconciliation";
import type { ReadinessResult } from "@/lib/recovery-readiness";
import { WorkoutEntry } from "@/components/plan/workout-entry";

const kindLabels: Record<string, string> = {
  work_early: "Frühdienst",
  work_late: "Spätdienst",
  work_night: "Nachtdienst",
  work_day: "Arbeit",
  appointment: "Termin",
  vacation: "Urlaub",
  free: "Frei",
  other: "Termin",
};

const readinessLabels: Record<ReadinessResult["status"], string> = {
  green: "Bereit",
  yellow: "Mit Augenmaß",
  red: "Erholung",
  unknown: "Tagesform offen",
};

const readinessDots: Record<ReadinessResult["status"], string> = {
  green: "bg-[var(--success)]",
  yellow: "bg-[var(--warning)]",
  red: "bg-[var(--danger)]",
  unknown: "bg-[var(--disabled)]",
};

function eventTime(event: PlanningEvent): string {
  if (event.allDay) return "ganztägig";
  const formatter = new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${formatter.format(new Date(event.startsAt))}–${formatter.format(new Date(event.endsAt))}`;
}

export type CalendarWorkoutItem = {
  item: ReconciledWorkout;
  view: WorkoutCalendarView;
};

export function CalendarDay({
  date,
  isToday,
  isPast,
  workouts,
  events,
  activities,
  readiness,
  mobile = false,
  onAddWorkout,
  onAddEvent,
  onOpenWorkout,
  onOpenEvent,
  onDropWorkout,
}: {
  date: string;
  isToday: boolean;
  isPast: boolean;
  workouts: CalendarWorkoutItem[];
  events: PlanningEvent[];
  activities: Activity[];
  readiness: ReadinessResult | undefined;
  mobile?: boolean;
  onAddWorkout: () => void;
  onAddEvent: () => void;
  onOpenWorkout: (item: ReconciledWorkout) => void;
  onOpenEvent: (event: PlanningEvent) => void;
  onDropWorkout?: (id: string) => void;
}) {
  const dateValue = new Date(`${date}T12:00:00`);
  const empty = workouts.length === 0 && events.length === 0 && activities.length === 0;

  return (
    <section
      aria-label={new Intl.DateTimeFormat("de-DE", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }).format(dateValue)}
      onDragOver={onDropWorkout ? (event) => event.preventDefault() : undefined}
      onDrop={
        onDropWorkout
          ? (event) => {
              event.preventDefault();
              const id = event.dataTransfer.getData("text/planned-workout");
              if (id) onDropWorkout(id);
            }
          : undefined
      }
      className={`${mobile ? "min-h-[20rem] rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4" : "min-h-[34rem] min-w-0 p-2.5"} ${isToday ? "bg-[color-mix(in_srgb,var(--accent-soft)_45%,var(--card))]" : isPast ? "bg-[color-mix(in_srgb,var(--surface)_52%,transparent)]" : "bg-[var(--card)]"}`}
    >
      <header className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[.65rem] font-black uppercase tracking-[.12em] text-[var(--muted)]">
            {new Intl.DateTimeFormat("de-DE", { weekday: "short" }).format(
              dateValue,
            )}
            {readiness ? (
              <span
                title={`Tagesform: ${readinessLabels[readiness.status]}`}
                aria-label={`Tagesform: ${readinessLabels[readiness.status]}`}
                className={`size-2 rounded-full ${readinessDots[readiness.status]}`}
              />
            ) : null}
          </p>
          <p
            className={`mt-0.5 font-black ${mobile ? "text-2xl" : "text-lg"} ${isToday ? "text-[var(--accent)]" : "text-[var(--ink)]"}`}
          >
            {new Intl.DateTimeFormat("de-DE", {
              day: "2-digit",
              month: "2-digit",
            }).format(dateValue)}
            {isToday ? (
              <span className="ml-1.5 align-middle text-[.58rem] uppercase tracking-wider">
                Heute
              </span>
            ) : null}
          </p>
          {readiness?.metric ? (
            <p className="mt-1 text-[.65rem] font-bold text-[var(--muted)]">
              Schlaf {Math.floor(readiness.metric.asleepMinutes / 60)}h
              {String(readiness.metric.asleepMinutes % 60).padStart(2, "0")}
            </p>
          ) : null}
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={onAddEvent}
            aria-label={`Termin am ${date} hinzufügen`}
            title="Termin hinzufügen"
            className="grid size-9 place-items-center rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[.65rem] font-black text-[var(--ink-soft)]"
          >
            TERM
          </button>
          <button
            type="button"
            onClick={onAddWorkout}
            aria-label={`Training am ${date} hinzufügen`}
            title="Training hinzufügen"
            className="grid size-9 place-items-center rounded-xl bg-[var(--accent)] text-lg font-black text-[var(--button-primary-text)]"
          >
            +
          </button>
        </div>
      </header>

      <div className="space-y-2">
        {events.map((event) => (
          <button
            key={event.id}
            type="button"
            onClick={() => onOpenEvent(event)}
            className="block w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2 text-left text-[.68rem] leading-4 text-[var(--ink-soft)] transition hover:border-[var(--accent)]"
          >
            <span className="block font-extrabold">
              {kindLabels[event.eventKind] ?? "Termin"} · {event.title}
            </span>
            <span className="opacity-70">{eventTime(event)}</span>
          </button>
        ))}

        {workouts.map(({ item, view }) => (
          <WorkoutEntry
            key={item.workout.id}
            item={item}
            view={view}
            onOpen={() => onOpenWorkout(item)}
            onDragStart={
              onDropWorkout
                ? (event) => {
                    if (item.effectiveStatus !== "planned") return;
                    event.dataTransfer.setData(
                      "text/planned-workout",
                      item.workout.id,
                    );
                    event.dataTransfer.effectAllowed = "move";
                  }
                : undefined
            }
          />
        ))}

        {activities.map((activity) => {
          const metrics = buildActivityCalendarMetrics(activity);
          return (
            <Link
              key={activity.id}
              href={`/activities/${activity.id}`}
              className="block rounded-xl border border-[color-mix(in_srgb,var(--success)_30%,transparent)] bg-[var(--success-soft)] px-3 py-3"
            >
              <span className="text-[.62rem] font-black uppercase tracking-[.13em] text-[var(--success)]">
                {activity.sportType === "running"
                  ? "RUN"
                  : activity.sportType === "cycling"
                    ? "RAD"
                    : activity.sportType === "volleyball"
                      ? "VOL"
                      : "FIT"}{" "}
                · Absolviert
              </span>
              <span className="mt-1.5 block break-words text-sm font-extrabold leading-[1.22] text-[var(--ink)]">
                {activity.title}
              </span>
              <span className="mt-2 flex flex-wrap gap-x-2 text-[.68rem] font-bold text-[var(--muted)]">
                {metrics.map((metric) => (
                  <span key={metric}>{metric}</span>
                ))}
              </span>
            </Link>
          );
        })}

        {empty ? (
          <div className="rounded-xl border border-dashed border-[var(--line)] px-3 py-5 text-center">
            <p className="text-xs font-bold text-[var(--muted)]">
              Noch keine Einheit oder Termin
            </p>
            <button
              type="button"
              onClick={onAddWorkout}
              className="mt-2 text-xs font-black text-[var(--accent)]"
            >
              Training hinzufügen
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

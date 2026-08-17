import type { ReconciledWorkout } from "@/lib/planning/reconciliation";
import type { WorkoutCalendarView } from "@/lib/planning/calendar-view";

const stateStyles: Record<WorkoutCalendarView["state"], string> = {
  planned:
    "border-[var(--line)] bg-[var(--surface-strong)] hover:border-[var(--accent)]",
  completed:
    "border-[color-mix(in_srgb,var(--success)_32%,transparent)] bg-[var(--success-soft)]",
  skipped:
    "border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] opacity-75",
  locked:
    "border-[color-mix(in_srgb,var(--warning)_35%,transparent)] bg-[var(--warning-soft)]",
  adjusted:
    "border-[color-mix(in_srgb,var(--accent)_28%,transparent)] bg-[var(--accent-soft)]",
};

const sportMarks: Record<ReconciledWorkout["workout"]["sportType"], string> = {
  cycling: "RAD",
  running: "RUN",
  strength: "GYM",
  volleyball: "VOL",
  mobility: "MOB",
  recovery: "REC",
  other: "FIT",
};

export function WorkoutEntry({
  item,
  view,
  onOpen,
  onDragStart,
}: {
  item: ReconciledWorkout;
  view: WorkoutCalendarView;
  onOpen: () => void;
  onDragStart?: (event: React.DragEvent<HTMLButtonElement>) => void;
}) {
  const workout = item.workout;
  const draggable = item.effectiveStatus === "planned" && Boolean(onDragStart);

  return (
    <button
      type="button"
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={onOpen}
      aria-label={`${workout.title} öffnen, ${view.statusLabel}`}
      className={`group relative w-full overflow-hidden rounded-xl border px-3 py-3 text-left transition focus-visible:z-10 ${draggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"} ${stateStyles[view.state]}`}
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1 bg-[var(--accent)]"
      />
      <span className="flex min-w-0 items-center justify-between gap-2 pl-1">
        <span className="text-[.62rem] font-black uppercase tracking-[.13em] text-[var(--muted)]">
          {sportMarks[workout.sportType]} · {view.intensityLabel}
        </span>
        <span className="shrink-0 rounded-full bg-[var(--surface)] px-2 py-0.5 text-[.6rem] font-black text-[var(--ink-soft)]">
          {view.statusLabel}
        </span>
      </span>
      <span
        className={`mt-1.5 block break-words pl-1 text-sm font-extrabold leading-[1.22] text-[var(--ink)] ${view.state === "skipped" ? "line-through" : ""}`}
      >
        {workout.title}
      </span>
      {view.metrics.length > 0 ? (
        <span className="mt-2 flex flex-wrap gap-x-2 gap-y-1 pl-1 text-[.68rem] font-bold leading-4 text-[var(--muted)]">
          {view.metrics.map((metric) => (
            <span key={metric}>{metric}</span>
          ))}
        </span>
      ) : null}
      {view.badges.length > 0 ? (
        <span className="mt-2 flex flex-wrap gap-1 pl-1">
          {view.badges.map((badge) => (
            <span
              key={badge}
              className="rounded-md bg-[var(--surface)] px-1.5 py-0.5 text-[.6rem] font-bold text-[var(--ink-soft)]"
            >
              {badge}
            </span>
          ))}
        </span>
      ) : null}
    </button>
  );
}

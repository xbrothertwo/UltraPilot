"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import {
  deletePlannedWorkout,
  extendPlannedWorkout,
  reduceWorkoutIntensity,
  savePlannedWorkout,
  setPlannedWorkoutLock,
  setPlannedWorkoutStatus,
  shortenPlannedWorkout,
} from "@/app/plan/actions";
import { startGymWorkout } from "@/app/gym/actions";
import type { PrimarySport } from "@/lib/sports";
import {
  explainWorkoutPlan,
} from "@/lib/planning/explanations";
import type { ReconciledWorkout } from "@/lib/planning/reconciliation";
import {
  STRENGTH_WORKOUTS,
  strengthVariantFromTitle,
} from "@/lib/planning/strength-plan";
import type { PlannedWorkout } from "@/lib/planning/workouts";
import type { ReadinessResult } from "@/lib/recovery-readiness";
import {
  compareLoadToPlan,
  type ActivityLoad,
} from "@/lib/training-load";
import {
  formatHeartRateTarget,
  formatPaceTarget,
  formatPowerTarget,
  getPlannedHeartRateTarget,
  getPlannedPaceTarget,
  getZoneTarget,
  type PaceZone,
  type ZoneDefinition,
} from "@/lib/training-zones";
import type { WorkoutCalendarView } from "@/lib/planning/calendar-view";

const fieldClass =
  "mt-1.5 w-full rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-2.5";

const intensityLabels: Record<PlannedWorkout["intensity"], string> = {
  recovery: "Regeneration",
  easy: "Locker",
  endurance: "Grundlage",
  tempo: "Tempo",
  threshold: "Schwelle",
  vo2: "VO₂max",
  strength: "Kraft",
};

function signed(value: number, unit: string): string {
  return `${value > 0 ? "+" : ""}${value.toLocaleString("de-DE", {
    maximumFractionDigits: 1,
  })} ${unit}`;
}

function PlanActualDetails({
  item,
  load,
}: {
  item: ReconciledWorkout;
  load: ActivityLoad | null;
}) {
  if (!item.activity || !item.comparison) return null;
  const distance =
    item.comparison.distanceDeltaKm === null
      ? null
      : signed(item.comparison.distanceDeltaKm, "km");
  const duration =
    item.comparison.durationDeltaMinutes === null
      ? null
      : signed(item.comparison.durationDeltaMinutes, "min");
  const distanceSport =
    item.workout.sportType === "cycling" ||
    item.workout.sportType === "running";
  const loadComparison = compareLoadToPlan(
    load?.points ?? null,
    item.workout.intensity,
    item.workout.plannedDurationMinutes,
  );
  const comparisonLabel = {
    lower: "leichter als geplant",
    as_planned: "wie geplant",
    higher: "härter als geplant",
    unavailable: "nicht vergleichbar",
  }[loadComparison.comparison];

  return (
    <section className="mt-5 rounded-2xl bg-[var(--success-soft)] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-wider text-[var(--success)]">
          Plan erfüllt
        </p>
        <Link
          href={`/activities/${item.activity.id}`}
          className="text-xs font-bold text-[var(--success)] underline"
        >
          Aktivität öffnen →
        </Link>
      </div>
      <p className="mt-2 font-black text-[var(--ink)]">
        {item.activity.title}
      </p>
      <div className={`mt-3 grid gap-3 text-sm ${distanceSport ? "grid-cols-2" : "grid-cols-1"}`}>
        {distanceSport ? (
          <div>
            <p className="text-xs text-[var(--muted)]">Distanz Ist / Soll</p>
            <p className="font-bold">
              {(item.activity.distanceMeters / 1000).toLocaleString("de-DE", {
                maximumFractionDigits: 1,
              })}{" "}
              / {item.workout.plannedDistanceKm ?? "–"} km
            </p>
            {distance ? (
              <p className="text-xs text-[var(--success)]">{distance}</p>
            ) : null}
          </div>
        ) : null}
        <div>
          <p className="text-xs text-[var(--muted)]">Zeit Ist / Soll</p>
          <p className="font-bold">
            {Math.round(item.activity.movingTimeSeconds / 60)} /{" "}
            {item.workout.plannedDurationMinutes ?? "–"} min
          </p>
          {duration ? (
            <p className="text-xs text-[var(--success)]">{duration}</p>
          ) : null}
        </div>
      </div>
      {load?.points !== null && load?.points !== undefined ? (
        <div className="mt-3 rounded-xl bg-[var(--surface)] px-3 py-2 text-sm">
          <p className="font-bold">
            {load.points.toLocaleString("de-DE", {
              maximumFractionDigits: 1,
            })}{" "}
            UPL · {comparisonLabel}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">{load.detail}</p>
        </div>
      ) : null}
    </section>
  );
}

function StrengthWorkoutDetails({ title }: { title: string }) {
  const variant = strengthVariantFromTitle(title);
  if (!variant) return null;
  const workout = STRENGTH_WORKOUTS[variant];

  return (
    <section className="mt-5 rounded-2xl bg-[var(--accent-soft)] p-4">
      <p className="text-xs font-black uppercase tracking-wider text-[var(--accent-dark)]">
        Einheit {variant} · {workout.focus}
      </p>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {[{ label: "Kraft", items: workout.exercises }, { label: "Stabi", items: workout.core }].map(
          (group) => (
            <div key={group.label}>
              <p className="text-xs font-bold text-[var(--muted)]">
                {group.label}
              </p>
              <ul className="mt-2 space-y-1.5 text-sm">
                {group.items.map((exercise) => (
                  <li
                    key={exercise.name}
                    className="flex justify-between gap-3"
                  >
                    <span className="font-semibold">{exercise.name}</span>
                    <span className="whitespace-nowrap text-[var(--muted)]">
                      {exercise.prescription}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ),
        )}
      </div>
      <p className="mt-3 text-xs text-[var(--muted)]">
        RIR 1–2 · Grundübungen 2–3 min Pause · Zubehör und Core 60–90 s
      </p>
    </section>
  );
}

function SportTargets({
  workout,
  heartRateZones,
  paceZones,
  powerZones,
}: {
  workout: PlannedWorkout;
  heartRateZones: ZoneDefinition[] | null;
  paceZones: PaceZone[] | null;
  powerZones: ZoneDefinition[] | null;
}) {
  if (workout.sportType !== "cycling" && workout.sportType !== "running") {
    return null;
  }
  const heartRateTarget = workout.targetHeartRateZone
    ? getZoneTarget(heartRateZones, workout.targetHeartRateZone)
    : getPlannedHeartRateTarget(heartRateZones, workout.intensity);
  const paceTarget =
    workout.sportType === "running"
      ? getPlannedPaceTarget(paceZones, workout.intensity)
      : null;
  const powerTarget =
    workout.sportType === "cycling" && workout.targetPowerZone
      ? getZoneTarget(powerZones, workout.targetPowerZone)
      : null;

  return (
    <section className="mt-5 grid gap-2 sm:grid-cols-2">
      <div className="rounded-2xl bg-[var(--surface)] p-4">
        <p className="text-xs font-black uppercase tracking-wider text-[var(--accent)]">
          Herzfrequenz
        </p>
        <p className="mt-1 font-black">
          {heartRateTarget
            ? formatHeartRateTarget(heartRateTarget)
            : "Noch keine persönliche Zone"}
        </p>
      </div>
      {paceTarget ? (
        <div className="rounded-2xl bg-[var(--surface)] p-4">
          <p className="text-xs font-black uppercase tracking-wider text-[var(--accent)]">
            Pace
          </p>
          <p className="mt-1 font-black">{formatPaceTarget(paceTarget)}</p>
        </div>
      ) : null}
      {powerTarget ? (
        <div className="rounded-2xl bg-[var(--surface)] p-4">
          <p className="text-xs font-black uppercase tracking-wider text-[var(--accent)]">
            Leistung
          </p>
          <p className="mt-1 font-black">{formatPowerTarget(powerTarget)}</p>
        </div>
      ) : null}
      {!heartRateTarget ? (
        <Link
          href="/settings"
          className="self-center text-sm font-bold text-[var(--accent)] underline"
        >
          Trainingszonen in den Einstellungen ergänzen →
        </Link>
      ) : null}
    </section>
  );
}

function WorkoutForm({
  primarySport,
  date,
  week,
  workout,
}: {
  primarySport: PrimarySport;
  date: string;
  week: string;
  workout?: PlannedWorkout;
}) {
  return (
    <form action={savePlannedWorkout} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="id" value={workout?.id ?? ""} />
      <input type="hidden" name="week" value={week} />
      <label className="text-sm font-bold sm:col-span-2">
        Name
        <input
          name="title"
          required
          maxLength={200}
          defaultValue={workout?.title ?? ""}
          placeholder={
            primarySport === "running"
              ? "z. B. Langer ruhiger Lauf"
              : "z. B. Lange ruhige Ausfahrt"
          }
          className={fieldClass}
        />
      </label>
      <label className="text-sm font-bold">
        Datum
        <input
          name="scheduledDate"
          type="date"
          required
          defaultValue={date}
          className={fieldClass}
        />
      </label>
      <label className="text-sm font-bold">
        Sport
        <select
          name="sportType"
          defaultValue={workout?.sportType ?? primarySport}
          className={fieldClass}
        >
          <option value="cycling">Radfahren</option>
          <option value="running">Laufen</option>
          <option value="strength">Krafttraining</option>
          <option value="volleyball">Volleyball</option>
          <option value="mobility">Mobility</option>
          <option value="recovery">Regeneration</option>
          <option value="other">Sonstiges</option>
        </select>
      </label>
      <label className="text-sm font-bold">
        Intensität
        <select
          name="intensity"
          defaultValue={workout?.intensity ?? "endurance"}
          className={fieldClass}
        >
          {Object.entries(intensityLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm font-bold">
        Dauer (Minuten)
        <input
          name="duration"
          type="number"
          min="1"
          max="1440"
          defaultValue={workout?.plannedDurationMinutes ?? ""}
          className={fieldClass}
        />
      </label>
      <label className="text-sm font-bold">
        Startzeit (optional)
        <input
          name="preferredStartTime"
          type="time"
          defaultValue={workout?.preferredStartTime ?? ""}
          className={fieldClass}
        />
      </label>
      <label className="text-sm font-bold sm:col-span-2">
        Distanz (km, optional)
        <input
          name="distance"
          type="number"
          min="0"
          max="2000"
          step="0.1"
          defaultValue={workout?.plannedDistanceKm ?? ""}
          className={fieldClass}
        />
      </label>
      <label className="text-sm font-bold">
        Herzfrequenzzone (optional)
        <select
          name="targetHeartRateZone"
          defaultValue={workout?.targetHeartRateZone ?? ""}
          className={fieldClass}
        >
          <option value="">Automatisch aus Intensität</option>
          {["Z1", "Z2", "Z3", "Z4", "Z5"].map((zone) => (
            <option key={zone} value={zone}>
              {zone}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm font-bold">
        Leistungszone (optional)
        <select
          name="targetPowerZone"
          defaultValue={workout?.targetPowerZone ?? ""}
          className={fieldClass}
        >
          <option value="">Nicht gesetzt</option>
          {["Z1", "Z2", "Z3", "Z4", "Z5", "Z6", "Z7"].map((zone) => (
            <option key={zone} value={zone}>
              {zone}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm font-bold sm:col-span-2">
        Beschreibung
        <textarea
          name="description"
          maxLength={3000}
          rows={3}
          defaultValue={workout?.description ?? ""}
          className={fieldClass}
        />
      </label>
      <label className="text-sm font-bold sm:col-span-2">
        Persönliche Notiz
        <textarea
          name="personalNote"
          maxLength={1000}
          rows={2}
          defaultValue={workout?.personalNote ?? ""}
          className={fieldClass}
        />
      </label>
      <button type="submit" className="primary-button sm:col-span-2">
        {workout ? "Änderungen speichern" : "Einheit einplanen"}
      </button>
    </form>
  );
}

function HiddenFields({ id, week }: { id: string; week: string }) {
  return (
    <>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="week" value={week} />
    </>
  );
}

export function WorkoutDetailPanel({
  date,
  week,
  item,
  view,
  primarySport,
  readiness,
  weekWorkouts,
  heartRateZones,
  paceZones,
  powerZones,
  activityLoad,
  onClose,
}: {
  date: string;
  week: string;
  item: ReconciledWorkout | null;
  view: WorkoutCalendarView | null;
  primarySport: PrimarySport;
  readiness: ReadinessResult | undefined;
  weekWorkouts: PlannedWorkout[];
  heartRateZones: ZoneDefinition[] | null;
  paceZones: PaceZone[] | null;
  powerZones: ZoneDefinition[] | null;
  activityLoad: ActivityLoad | null;
  onClose: () => void;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const workout = item?.workout;

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousFocus && "focus" in previousFocus) {
        (previousFocus as HTMLElement).focus();
      }
    };
  }, [onClose]);

  const explanations = workout
    ? explainWorkoutPlan(workout, readiness, weekWorkouts)
    : [];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="workout-panel-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-[color-mix(in_srgb,var(--ink)_46%,transparent)] backdrop-blur-sm lg:items-stretch lg:justify-end"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="mobile-safe-sheet max-h-[calc(100dvh-1rem)] w-full overflow-y-auto rounded-t-[1.75rem] border border-[var(--line)] bg-[var(--card)] p-5 shadow-2xl lg:max-h-none lg:w-[31rem] lg:rounded-none lg:border-y-0 lg:border-r-0 lg:p-7">
        <header className="sticky top-0 z-10 -mx-1 flex items-start justify-between gap-4 bg-[var(--card)] px-1 pb-4">
          <div className="min-w-0">
            <p className="eyebrow">
              {workout ? `${view?.sportLabel} · ${view?.statusLabel}` : "Neue Einheit"}
            </p>
            <h2
              id="workout-panel-title"
              className="mt-2 break-words text-2xl font-black leading-tight text-[var(--ink)]"
            >
              {workout?.title ?? "Training einplanen"}
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {new Intl.DateTimeFormat("de-DE", {
                weekday: "long",
                day: "numeric",
                month: "long",
              }).format(new Date(`${date}T12:00:00`))}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Workout-Details schließen"
            className="grid size-11 shrink-0 place-items-center rounded-full border border-[var(--line)] bg-[var(--surface)] text-xl text-[var(--ink)]"
          >
            ×
          </button>
        </header>

        {workout && view ? (
          <>
            <div className="flex flex-wrap gap-2 border-y border-[var(--line)] py-4">
              {[...view.metrics, ...view.badges].map((metric) => (
                <span
                  key={metric}
                  className="rounded-full bg-[var(--surface)] px-3 py-1.5 text-xs font-bold text-[var(--ink-soft)]"
                >
                  {metric}
                </span>
              ))}
            </div>

            {item ? (
              <PlanActualDetails item={item} load={activityLoad} />
            ) : null}

            {workout.source === "automatic" ? (
              <section className="mt-5 rounded-2xl bg-[var(--surface)] p-4">
                <p className="text-xs font-black uppercase tracking-wider text-[var(--muted)]">
                  Warum diese Einheit?
                </p>
                {explanations.length > 0 ? (
                  <ul className="mt-2 space-y-1.5 text-sm leading-5">
                    {explanations.map((explanation) => (
                      <li key={`${explanation.kind}-${explanation.text}`}>
                        <strong>{explanation.label}:</strong>{" "}
                        {explanation.text}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <p className="mt-3 text-xs font-bold text-[var(--muted)]">
                  {workout.locked
                    ? "Gesperrt – bleibt bei einer erneuten Planung erhalten."
                    : "Bleibt ersetzbar, bis du sie bearbeitest, sperrst oder absolvierst."}
                </p>
              </section>
            ) : null}

            {workout.sportType === "strength" ? (
              <>
                <StrengthWorkoutDetails title={workout.title} />
                <section className="mt-5 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
                  <p className="text-xs font-black uppercase tracking-wider text-[var(--muted)]">Gym-Workout</p>
                  <p className="mt-2 text-sm text-[var(--ink-soft)]">{workout.gymExerciseCount !== null && workout.gymExerciseCount !== undefined ? `${workout.gymExerciseCount} Übungen aus dem verknüpften Programmtag.` : "Starte die Einheit im mobilen Gym-Logger."}</p>
                  <form action={startGymWorkout} className="mt-3">
                    <input type="hidden" name="plannedWorkoutId" value={workout.id} />
                    <button className="primary-button w-full">Training starten</button>
                  </form>
                </section>
              </>
            ) : null}

            <SportTargets
              workout={workout}
              heartRateZones={heartRateZones}
              paceZones={paceZones}
              powerZones={powerZones}
            />

            {workout.description ? (
              <section className="mt-5">
                <p className="text-xs font-black uppercase tracking-wider text-[var(--muted)]">
                  Ablauf
                </p>
                <ol className="mt-2 space-y-2 text-sm leading-6">
                  {workout.description
                    .split("\n")
                    .filter(Boolean)
                    .map((step, index) => (
                      <li key={`${index}-${step}`} className="flex gap-2">
                        <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[var(--accent-soft)] text-[.65rem] font-black text-[var(--accent-dark)]">
                          {index + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                </ol>
              </section>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-2 border-t border-[var(--line)] pt-5">
              {workout.plannedDurationMinutes !== null ? (
                <>
                  <form action={shortenPlannedWorkout}>
                    <HiddenFields id={workout.id} week={week} />
                    <button className="secondary-button text-xs">Kürzen</button>
                  </form>
                  <form action={extendPlannedWorkout}>
                    <HiddenFields id={workout.id} week={week} />
                    <button className="secondary-button text-xs">Verlängern</button>
                  </form>
                </>
              ) : null}
              {workout.intensity !== "strength" ? (
                <form action={reduceWorkoutIntensity}>
                  <HiddenFields id={workout.id} week={week} />
                  <button className="secondary-button text-xs">
                    Intensität reduzieren
                  </button>
                </form>
              ) : null}
              <form action={setPlannedWorkoutLock}>
                <HiddenFields id={workout.id} week={week} />
                <input
                  type="hidden"
                  name="locked"
                  value={workout.locked ? "false" : "true"}
                />
                <button className="secondary-button text-xs">
                  {workout.locked ? "Sperre aufheben" : "Einheit sperren"}
                </button>
              </form>
            </div>

            <details className="mt-5 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
              <summary className="list-none text-sm font-black">
                Einheit bearbeiten <span className="float-right">+</span>
              </summary>
              <div className="mt-5">
                <WorkoutForm
                  primarySport={primarySport}
                  date={date}
                  week={week}
                  workout={workout}
                />
              </div>
            </details>

            {!item?.activity &&
            workout.sportType !== "cycling" &&
            workout.sportType !== "running" &&
            item?.effectiveStatus !== "completed" ? (
              <form action={setPlannedWorkoutStatus} className="mt-4">
                <HiddenFields id={workout.id} week={week} />
                <input type="hidden" name="status" value="completed" />
                <button className="w-full rounded-xl px-5 py-2.5 text-sm font-bold text-[var(--success)] hover:bg-[var(--success-soft)]">
                  Als erledigt markieren
                </button>
              </form>
            ) : null}
            {!item?.activity ? (
              <form action={setPlannedWorkoutStatus} className="mt-2">
                <HiddenFields id={workout.id} week={week} />
                <input
                  type="hidden"
                  name="status"
                  value={item?.effectiveStatus === "skipped" ? "planned" : "skipped"}
                />
                <button className="w-full rounded-xl px-5 py-2.5 text-sm font-bold text-[var(--warning)] hover:bg-[var(--warning-soft)]">
                  {item?.effectiveStatus === "skipped"
                    ? "Wieder einplanen"
                    : "Als ausgefallen markieren"}
                </button>
              </form>
            ) : null}
            <form action={deletePlannedWorkout} className="mt-1">
              <HiddenFields id={workout.id} week={week} />
              <button className="w-full rounded-xl px-5 py-2.5 text-sm font-bold text-[var(--danger)] hover:bg-[var(--danger-soft)]">
                Einheit löschen
              </button>
            </form>
          </>
        ) : (
          <div className="border-t border-[var(--line)] pt-5">
            <WorkoutForm
              primarySport={primarySport}
              date={date}
              week={week}
            />
          </div>
        )}
      </section>
    </div>
  );
}

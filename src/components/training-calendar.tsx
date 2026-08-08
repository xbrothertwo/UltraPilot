"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteCalendarEvent, deletePlannedWorkout, movePlannedWorkout, saveCalendarEvent, savePlannedWorkout, setPlannedWorkoutStatus } from "@/app/plan/actions";
import type { Activity } from "@/lib/demo-data";
import type { PlanningEvent, PrimarySport } from "@/lib/planning/data";
import type { PlannedWorkout } from "@/lib/planning/workouts";
import { zonedLocalTimeToIso } from "@/lib/calendar/ics-parser";
import { STRENGTH_WORKOUTS, strengthVariantFromTitle } from "@/lib/planning/strength-plan";
import { explainWorkoutPlacement, reconcilePlannedWorkouts, type ReconciledWorkout } from "@/lib/planning/reconciliation";
import { formatHeartRateTarget, getPlannedHeartRateTarget, type ZoneDefinition } from "@/lib/training-zones";
import type { ReadinessResult } from "@/lib/recovery-readiness";
import { compareLoadToPlan, type ActivityLoad } from "@/lib/training-load";

const kindLabels: Record<string, string> = { work_early: "Früher Arbeitsblock", work_late: "Später Arbeitsblock", work_night: "Nachtarbeit", work_day: "Arbeitstag", appointment: "Termin", vacation: "Urlaub", free: "Frei", other: "Termin" };
const intensityLabels: Record<string, string> = { recovery: "Regeneration", easy: "Locker", endurance: "Grundlage", tempo: "Tempo", threshold: "Schwelle", vo2: "VO₂max", strength: "Kraft" };
const sportLabels: Record<string, string> = { cycling: "Rad", running: "Lauf", strength: "Kraft", mobility: "Mobility", recovery: "Regeneration", other: "Sonstiges" };
const sourceLabels = { automatic: "Automatisch", manual: "Manuell" } as const;
const workoutColors: Record<string, string> = { recovery: "border-sky-300 bg-sky-50", easy: "border-emerald-300 bg-emerald-50", endurance: "border-green-400 bg-green-50", tempo: "border-amber-400 bg-amber-50", threshold: "border-orange-400 bg-orange-50", vo2: "border-rose-400 bg-rose-50", strength: "border-violet-400 bg-violet-50" };
const statusLabels = { planned: "Geplant", completed: "Erledigt", skipped: "Ausgefallen" } as const;
const readinessDots = { green: "bg-emerald-500", yellow: "bg-amber-400", red: "bg-rose-500", unknown: "bg-slate-300" } as const;

function localDate(value: string | Date): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(typeof value === "string" ? new Date(value) : value);
}

function eventTime(event: PlanningEvent): string {
  if (event.allDay) return "ganztägig";
  const formatter = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" });
  return `${formatter.format(new Date(event.startsAt))}–${formatter.format(new Date(event.endsAt))}`;
}

type EditorState = { date: string; workout?: PlannedWorkout } | null;

function dateTimeLocal(value: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

function emptyCalendarEvent(date: string): PlanningEvent {
  const compact = date.replaceAll("-", "");
  return { id: "", title: "", eventKind: "appointment", startsAt: zonedLocalTimeToIso(`${compact}T090000`, "Europe/Berlin"), endsAt: zonedLocalTimeToIso(`${compact}T100000`, "Europe/Berlin"), allDay: false };
}

function workoutMeta(workout: PlannedWorkout, zones: ZoneDefinition[] | null): string {
  const values = [workout.plannedDurationMinutes ? `${workout.plannedDurationMinutes} min` : null, workout.plannedDistanceKm ? `${workout.plannedDistanceKm.toLocaleString("de-DE")} km` : null];
  const target = workout.sportType === "cycling" || workout.sportType === "running" ? getPlannedHeartRateTarget(zones, workout.intensity) : null;
  if (target) values.push(target.label);
  return values.filter(Boolean).join(" · ") || "Details öffnen";
}

function signed(value: number, unit: string): string {
  return `${value > 0 ? "+" : ""}${value.toLocaleString("de-DE", { maximumFractionDigits: 1 })} ${unit}`;
}

function PlanActualDetails({ item, load }: { item: ReconciledWorkout; load: ActivityLoad | null }) {
  if (!item.activity || !item.comparison) return null;
  const distance = item.comparison.distanceDeltaKm === null ? null : signed(item.comparison.distanceDeltaKm, "km");
  const duration = item.comparison.durationDeltaMinutes === null ? null : signed(item.comparison.durationDeltaMinutes, "min");
  const loadComparison = compareLoadToPlan(load?.points ?? null, item.workout.intensity, item.workout.plannedDurationMinutes);
  const comparisonLabel = { lower: "leichter als geplant", as_planned: "wie geplant", higher: "härter als geplant", unavailable: "nicht vergleichbar" }[loadComparison.comparison];
  return <section className="mt-3 rounded-2xl bg-[#0b2347] p-4 text-white"><div className="flex items-center justify-between gap-3"><p className="text-xs font-black uppercase tracking-wider text-cyan-200">Plan erfüllt</p><Link href={`/activities/${item.activity.id}`} className="text-xs font-bold text-cyan-200 underline">Aktivität öffnen →</Link></div><p className="mt-2 font-black">{item.activity.title}</p><div className="mt-3 grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs text-blue-100/60">Distanz Ist / Soll</p><p className="font-bold">{(item.activity.distanceMeters / 1000).toLocaleString("de-DE", { maximumFractionDigits: 1 })} / {item.workout.plannedDistanceKm?.toLocaleString("de-DE", { maximumFractionDigits: 1 }) ?? "–"} km</p>{distance && <p className="text-xs text-cyan-200">{distance}</p>}</div><div><p className="text-xs text-blue-100/60">Zeit Ist / Soll</p><p className="font-bold">{Math.round(item.activity.movingTimeSeconds / 60)} / {item.workout.plannedDurationMinutes ?? "–"} min</p>{duration && <p className="text-xs text-cyan-200">{duration}</p>}</div></div>{load?.points !== null && load?.points !== undefined && <div className="mt-3 rounded-xl bg-white/10 px-3 py-2 text-sm"><div className="flex items-center justify-between gap-3"><span><strong>{load.points.toLocaleString("de-DE", { maximumFractionDigits: 1 })} UPL</strong> · {comparisonLabel}</span><span className="text-xs text-blue-100/65">Soll {loadComparison.expectedPoints?.toLocaleString("de-DE", { maximumFractionDigits: 0 }) ?? "–"}</span></div><p className="mt-1 text-xs text-blue-100/55">{load.detail}</p></div>}</section>;
}

function StrengthWorkoutDetails({ title }: { title: string }) {
  const variant = strengthVariantFromTitle(title);
  if (!variant) return null;
  const workout = STRENGTH_WORKOUTS[variant];
  return <section className="mt-5 rounded-2xl bg-violet-50 p-4"><p className="text-xs font-black uppercase tracking-wider text-violet-700">Einheit {variant} · {workout.focus}</p><div className="mt-3 grid gap-4 sm:grid-cols-2"><div><p className="text-xs font-bold text-[var(--muted)]">Kraft</p><ul className="mt-2 space-y-1.5 text-sm">{workout.exercises.map((exercise) => <li key={exercise.name} className="flex justify-between gap-3"><span className="font-semibold">{exercise.name}</span><span className="whitespace-nowrap text-[var(--muted)]">{exercise.prescription}</span></li>)}</ul></div><div><p className="text-xs font-bold text-[var(--muted)]">Stabi</p><ul className="mt-2 space-y-1.5 text-sm">{workout.core.map((exercise) => <li key={exercise.name} className="flex justify-between gap-3"><span className="font-semibold">{exercise.name}</span><span className="whitespace-nowrap text-[var(--muted)]">{exercise.prescription}</span></li>)}</ul></div></div><p className="mt-3 text-xs text-violet-900/65">RIR 1–2 · Grundübungen 2–3 min Pause · Zubehör und Core 60–90 s</p></section>;
}

function HeartRateDetails({ intensity, zones }: { intensity: string; zones: ZoneDefinition[] | null }) {
  const target = getPlannedHeartRateTarget(zones, intensity);
  return target ? <section className="mt-5 rounded-2xl bg-rose-50 p-4"><p className="text-xs font-black uppercase tracking-wider text-rose-700">Herzfrequenz-Zielbereich</p><p className="mt-1 text-xl font-black text-rose-950">{formatHeartRateTarget(target)}</p><p className="mt-1 text-xs text-rose-900/60">Aus deinen persönlichen HF-Zonen in den Einstellungen.</p></section> : <section className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm text-amber-950">Für einen persönlichen HF-Bereich fehlen Referenzwerte. <Link href="/settings" className="font-bold underline">HF-Zonen einstellen →</Link></section>;
}

function EnduranceStructure({ description, sportType }: { description: string | null; sportType: PrimarySport }) {
  if (!description) return null;
  const steps = description.split("\n").filter(Boolean);
  return <section className="mt-3 rounded-2xl bg-emerald-50 p-4"><p className="text-xs font-black uppercase tracking-wider text-emerald-700">Ablauf {sportType === "running" ? "des Laufs" : "der Fahrt"}</p><ol className="mt-3 space-y-2 text-sm text-emerald-950">{steps.map((step, index) => <li key={`${index}-${step}`} className="flex gap-2"><span className="grid size-5 shrink-0 place-items-center rounded-full bg-emerald-200 text-[.65rem] font-black">{index + 1}</span><span>{step}</span></li>)}</ol></section>;
}

export function TrainingCalendar({ primarySport, days, week, workouts, events, activities, heartRateZones, readiness, activityLoads }: { primarySport: PrimarySport; days: string[]; week: string; workouts: PlannedWorkout[]; events: PlanningEvent[]; activities: Activity[]; heartRateZones: ZoneDefinition[] | null; readiness: ReadinessResult[]; activityLoads: ActivityLoad[] }) {
  const router = useRouter();
  const [editor, setEditor] = useState<EditorState>(null);
  const [eventEditor, setEventEditor] = useState<PlanningEvent | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [openReasonId, setOpenReasonId] = useState<string | null>(null);
  const [moving, startMove] = useTransition();
  const today = localDate(new Date());
  const reconciled = reconcilePlannedWorkouts(workouts, activities);
  const matchedActivityIds = new Set(reconciled.flatMap((item) => item.activity ? [item.activity.id] : []));
  const editorReconciliation = editor?.workout ? reconciled.find((item) => item.workout.id === editor.workout?.id) ?? null : null;

  function dropWorkout(id: string, date: string) {
    startMove(async () => {
      const result = await movePlannedWorkout(id, date);
      if (!result.ok) setMoveError(result.message ?? "Einheit konnte nicht verschoben werden.");
      else { setMoveError(null); router.refresh(); }
    });
  }

  return <>
    {moveError && <p className="mb-4 rounded-xl bg-red-100 px-4 py-3 text-sm font-bold text-red-900">{moveError}</p>}
    <div className={`grid gap-3 md:grid-cols-7 ${moving ? "opacity-70" : ""}`}>
      {days.map((date) => {
        const dateValue = new Date(`${date}T12:00:00`);
        const dayWorkouts = reconciled.filter((item) => item.workout.scheduledDate === date);
        const dayEvents = events.filter((event) => localDate(event.startsAt) === date || (new Date(event.startsAt) < new Date(`${date}T23:59:59`) && new Date(event.endsAt) > new Date(`${date}T00:00:00`)));
        const dayActivities = activities.filter((activity) => localDate(activity.activityDate) === date && !matchedActivityIds.has(activity.id));
        const dayReadiness = readiness.find((item) => item.date === date);
        return <section key={date} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const id = event.dataTransfer.getData("text/planned-workout"); if (id) dropWorkout(id, date); }} className={`min-h-44 rounded-2xl border bg-white/75 p-2.5 md:min-h-[32rem] ${date === today ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/10" : "border-[var(--line)]"}`}>
          <header className="mb-3 flex items-center justify-between px-1"><div><p className="flex items-center gap-1.5 text-[.65rem] font-bold uppercase tracking-wider text-[var(--muted)]">{new Intl.DateTimeFormat("de-DE", { weekday: "short" }).format(dateValue)}{dayReadiness && <span title={`Readiness: ${dayReadiness.status}${dayReadiness.score === null ? "" : ` (${dayReadiness.score})`}`} className={`size-2 rounded-full ${readinessDots[dayReadiness.status]}`}/>}</p><p className={`mt-0.5 text-lg font-black ${date === today ? "text-[var(--accent)]" : ""}`}>{new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit" }).format(dateValue)}</p>{dayReadiness?.metric && <p className="mt-0.5 text-[.62rem] font-bold opacity-50" title="Schlafdauer">Schlaf {Math.floor(dayReadiness.metric.asleepMinutes / 60)}h{String(dayReadiness.metric.asleepMinutes % 60).padStart(2, "0")}</p>}</div><div className="flex gap-1"><button type="button" onClick={() => setEventEditor(emptyCalendarEvent(date))} title="Eigenen Termin hinzufügen" aria-label={`Termin am ${date} hinzufügen`} className="grid size-8 place-items-center rounded-lg bg-slate-200 text-xs font-black text-slate-700 hover:bg-slate-300">T</button><button type="button" onClick={() => setEditor({ date })} title="Training hinzufügen" aria-label={`Training am ${date} hinzufügen`} className="grid size-8 place-items-center rounded-lg bg-[#edf3fb] text-lg font-bold text-[var(--accent-dark)] hover:bg-[var(--accent-soft)]">+</button></div></header>
          <div className="space-y-2">
            {dayEvents.map((event) => <button key={event.id} type="button" onClick={() => setEventEditor(event)} className="block w-full rounded-lg bg-slate-200/75 px-2.5 py-2 text-left text-[.7rem] leading-4 text-slate-700 transition hover:bg-slate-300"><p className="font-extrabold">{kindLabels[event.eventKind] ?? event.title} · {event.title}</p><p className="opacity-65">{eventTime(event)} · bearbeiten</p></button>)}
            {dayWorkouts.map((item) => { const workout = item.workout; const stateColor = item.effectiveStatus === "completed" ? "border-emerald-300 bg-[#0b2347] text-white" : item.effectiveStatus === "skipped" ? "border-slate-300 bg-slate-100 text-slate-500 opacity-75" : workoutColors[workout.intensity] ?? workoutColors.endurance; const reasonOpen = openReasonId === workout.id; const reason = explainWorkoutPlacement(workout, dayReadiness?.status, dayWorkouts.map((entry) => entry.workout)); return <div key={workout.id} className="relative">
              <button type="button" draggable={item.effectiveStatus === "planned"} onDragStart={(event) => { if (item.effectiveStatus !== "planned") return; event.dataTransfer.setData("text/planned-workout", workout.id); event.dataTransfer.effectAllowed = "move"; }} onClick={() => setEditor({ date, workout })} className={`block w-full rounded-xl border-l-4 p-2.5 pr-7 text-left shadow-sm ${item.effectiveStatus === "planned" ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"} ${stateColor}`}>
                <p className="text-[.65rem] font-black uppercase tracking-wider opacity-60">{sportLabels[workout.sportType] ?? workout.sportType} · {statusLabels[item.effectiveStatus]} · {intensityLabels[workout.intensity]} · {sourceLabels[workout.source]}</p>
                <p className={`mt-1 text-sm font-black leading-4 ${item.effectiveStatus === "skipped" ? "line-through" : ""}`}>{workout.title}</p>
                <p className="mt-2 text-[.68rem] font-bold opacity-70">{item.activity ? `${(item.activity.distanceMeters / 1000).toLocaleString("de-DE", { maximumFractionDigits: 1 })} km Ist · ${workout.plannedDistanceKm?.toLocaleString("de-DE", { maximumFractionDigits: 1 }) ?? "–"} km Soll` : workoutMeta(workout, heartRateZones)}</p>
              </button>
              <button type="button" onClick={(event) => { event.stopPropagation(); setOpenReasonId(reasonOpen ? null : workout.id); }} aria-label="Warum diese Einheit an diesem Tag?" aria-expanded={reasonOpen} className="absolute right-1 top-1 grid size-8 place-items-center rounded-full bg-black/10 text-xs font-black leading-none opacity-70 hover:bg-black/20">i</button>
              {reasonOpen && <p className="mt-1 rounded-lg bg-black/5 px-2 py-1.5 text-[.66rem] leading-4 opacity-80">{reason}</p>}
            </div>; })}
            {dayActivities.map((activity) => <Link key={activity.id} href={`/activities/${activity.id}`} className="block rounded-xl border-l-4 border-[var(--accent)] bg-[var(--ink)] p-2.5 text-white shadow-sm"><p className="text-[.65rem] font-black uppercase tracking-wider text-cyan-200/65">Absolviert</p><p className="mt-1 text-sm font-black leading-4">{activity.title}</p><p className="mt-2 text-[.68rem] font-bold text-blue-50/65">{(activity.distanceMeters / 1000).toLocaleString("de-DE", { maximumFractionDigits: 1 })} km · {Math.round(activity.movingTimeSeconds / 60)} min</p></Link>)}
          </div>
        </section>;
      })}
    </div>

    {editor && <div role="dialog" aria-modal="true" aria-label="Training bearbeiten" className="fixed inset-0 z-50 grid place-items-center bg-[var(--ink)]/55 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditor(null); }}><div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[1.5rem] bg-[var(--card)] p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="eyebrow">{editor.workout ? "Einheit bearbeiten" : "Einheit planen"}</p><h2 className="mt-2 text-2xl font-black">{new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${editor.date}T12:00:00`))}</h2></div><button type="button" onClick={() => setEditor(null)} className="grid size-9 place-items-center rounded-full bg-slate-200 text-lg">×</button></div>
      {editorReconciliation && <PlanActualDetails item={editorReconciliation} load={editorReconciliation.activity ? activityLoads.find((load) => load.activityId === editorReconciliation.activity?.id) ?? null : null}/>} {editor.workout?.sportType === "strength" && <StrengthWorkoutDetails title={editor.workout.title}/>} {(editor.workout?.sportType === "cycling" || editor.workout?.sportType === "running") && <><HeartRateDetails intensity={editor.workout.intensity} zones={heartRateZones}/><EnduranceStructure description={editor.workout.description} sportType={editor.workout.sportType}/></>}<form action={savePlannedWorkout} className="mt-6 grid gap-4 sm:grid-cols-2"><input type="hidden" name="id" value={editor.workout?.id ?? ""}/><input type="hidden" name="week" value={week}/><label className="text-sm font-bold sm:col-span-2">Name<input name="title" required maxLength={200} defaultValue={editor.workout?.title ?? ""} placeholder={primarySport === "running" ? "z. B. Langer ruhiger Lauf" : "z. B. Lange ruhige Ausfahrt"} className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"/></label><label className="text-sm font-bold">Datum<input name="scheduledDate" type="date" required defaultValue={editor.date} className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"/></label><label className="text-sm font-bold">Sport<select name="sportType" defaultValue={editor.workout?.sportType ?? primarySport} className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"><option value="cycling">Radfahren</option><option value="running">Laufen</option><option value="strength">Krafttraining</option><option value="mobility">Mobility</option><option value="recovery">Regeneration</option><option value="other">Sonstiges</option></select></label><label className="text-sm font-bold">Intensität<select name="intensity" defaultValue={editor.workout?.intensity ?? "endurance"} className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5">{Object.entries(intensityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="text-sm font-bold">Dauer (Minuten)<input name="duration" type="number" min="1" max="1440" defaultValue={editor.workout?.plannedDurationMinutes ?? ""} className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"/></label><label className="text-sm font-bold sm:col-span-2">Distanz (km, optional)<input name="distance" type="number" min="0" max="2000" step="0.1" defaultValue={editor.workout?.plannedDistanceKm ?? ""} className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"/></label><label className="text-sm font-bold sm:col-span-2">Notizen<textarea name="description" maxLength={3000} rows={4} defaultValue={editor.workout?.description ?? ""} className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"/></label><button type="submit" className="rounded-xl bg-[var(--accent)] px-5 py-3 font-bold text-white sm:col-span-2">{editor.workout ? "Änderungen speichern" : "Einheit einplanen"}</button></form>
      {editor.workout && !editorReconciliation?.activity && editor.workout.sportType !== "cycling" && editor.workout.sportType !== "running" && editorReconciliation?.effectiveStatus !== "completed" && <form action={setPlannedWorkoutStatus} className="mt-3"><input type="hidden" name="id" value={editor.workout.id}/><input type="hidden" name="week" value={week}/><input type="hidden" name="status" value="completed"/><button type="submit" className="w-full rounded-xl px-5 py-2.5 text-sm font-bold text-emerald-700 hover:bg-emerald-50">Als erledigt markieren</button></form>}
      {editor.workout && !editorReconciliation?.activity && <form action={setPlannedWorkoutStatus} className="mt-3"><input type="hidden" name="id" value={editor.workout.id}/><input type="hidden" name="week" value={week}/><input type="hidden" name="status" value={editorReconciliation?.effectiveStatus === "skipped" ? "planned" : "skipped"}/><button type="submit" className="w-full rounded-xl px-5 py-2.5 text-sm font-bold text-amber-800 hover:bg-amber-50">{editorReconciliation?.effectiveStatus === "skipped" ? "Wieder einplanen" : "Als ausgefallen markieren"}</button></form>}{editor.workout && <form action={deletePlannedWorkout} className="mt-1"><input type="hidden" name="id" value={editor.workout.id}/><input type="hidden" name="week" value={week}/><button type="submit" className="w-full rounded-xl px-5 py-2.5 text-sm font-bold text-red-700 hover:bg-red-50">Einheit löschen</button></form>}
    </div></div>}

    {eventEditor && <div role="dialog" aria-modal="true" aria-label="Kalendertermin bearbeiten" className="fixed inset-0 z-50 grid place-items-center bg-[var(--ink)]/55 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setEventEditor(null); }}><div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[1.5rem] bg-[var(--card)] p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="eyebrow">Kalendertermin</p><h2 className="mt-2 text-2xl font-black">{eventEditor.id ? "Termin bearbeiten" : "Eigenen Termin hinzufügen"}</h2><p className="mt-1 text-sm text-[var(--muted)]">{eventEditor.id ? "Änderungen bleiben auch bei einem erneuten ICS-Import erhalten." : "Der Termin wird direkt als belegte Zeit bei der Planung berücksichtigt."}</p></div><button type="button" onClick={() => setEventEditor(null)} className="grid size-9 place-items-center rounded-full bg-slate-200 text-lg">×</button></div>
      <form action={saveCalendarEvent} className="mt-6 grid gap-4 sm:grid-cols-2"><input type="hidden" name="id" value={eventEditor.id}/><input type="hidden" name="week" value={week}/><label className="text-sm font-bold sm:col-span-2">Titel<input name="title" required maxLength={200} defaultValue={eventEditor.title} className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"/></label><label className="text-sm font-bold sm:col-span-2">Terminart<select name="eventKind" defaultValue={eventEditor.eventKind} className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"><option value="work_early">Früher Arbeitsblock</option><option value="work_late">Später Arbeitsblock</option><option value="work_night">Nachtarbeit</option><option value="work_day">Arbeitstag</option><option value="appointment">Termin</option><option value="vacation">Urlaub</option><option value="free">Frei</option><option value="other">Sonstiges</option></select></label><label className="text-sm font-bold">Beginn<input name="startsAt" type="datetime-local" required defaultValue={dateTimeLocal(eventEditor.startsAt)} className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"/></label><label className="text-sm font-bold">Ende<input name="endsAt" type="datetime-local" required defaultValue={dateTimeLocal(eventEditor.endsAt)} className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"/></label><label className="flex items-center gap-2 text-sm font-bold sm:col-span-2"><input name="allDay" type="checkbox" defaultChecked={eventEditor.allDay}/> Ganztägiger Termin</label><button type="submit" className="rounded-xl bg-[var(--accent)] px-5 py-3 font-bold text-white sm:col-span-2">Termin speichern</button></form>
      {eventEditor.id && <form action={deleteCalendarEvent} className="mt-3"><input type="hidden" name="id" value={eventEditor.id}/><input type="hidden" name="week" value={week}/><button type="submit" className="w-full rounded-xl px-5 py-2.5 text-sm font-bold text-red-700 hover:bg-red-50">Termin löschen</button></form>}
    </div></div>}
  </>;
}

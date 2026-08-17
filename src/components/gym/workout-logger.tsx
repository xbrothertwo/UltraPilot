"use client";

import { useMemo, useState } from "react";
import { addGymSessionExercise, deleteGymSet, finishGymWorkout, saveGymSet, skipGymExercise, updateGymSessionExerciseNote } from "@/app/gym/actions";
import { RestTimer } from "@/components/gym/rest-timer";
import type { GymExercise, GymPerformanceSet, GymSession, GymSessionExercise } from "@/lib/gym/types";

export function stableSetClientKey(seed: string): string {
  const hex = Array.from({ length: 4 }, (_, block) => {
    let hash = 2166136261 ^ block;
    for (const character of `${seed}:${block}`) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
    return (hash >>> 0).toString(16).padStart(8, "0");
  }).join("").split("");
  hex[12] = "4";
  hex[16] = "8";
  const value = hex.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function SetFields({ sessionId, exercise, set, number }: { sessionId: string; exercise: GymSessionExercise; set?: GymPerformanceSet; number: number }) {
  const previous = exercise.previousSets.find((item) => item.setNumber === number) ?? exercise.previousSets.at(-1);
  const [copied, setCopied] = useState(false);
  const clientKey = set?.clientKey ?? stableSetClientKey(`${sessionId}:${exercise.id}:${number}`);
  const defaults = copied ? previous : set;
  const type = exercise.trackingType;
  const hasWeight = ["weight_reps", "weight_or_bodyweight_reps", "weight_time", "weight_distance"].includes(type);
  const hasReps = ["weight_reps", "bodyweight_reps", "weight_or_bodyweight_reps", "reps_only", "time_or_reps"].includes(type);
  const hasTime = ["time", "weight_time", "distance_time", "time_or_reps"].includes(type);
  const hasDistance = ["distance_time", "weight_distance"].includes(type);
  return <form action={saveGymSet} className={`rounded-2xl border p-3 ${set?.completed ? "border-[var(--success)] bg-[var(--success-soft)]" : "border-[var(--line)] bg-[var(--card)]"}`}>
    <input type="hidden" name="sessionId" value={sessionId}/><input type="hidden" name="sessionExerciseId" value={exercise.id}/><input type="hidden" name="clientKey" value={clientKey}/><input type="hidden" name="setNumber" value={number}/><input type="hidden" name="setType" value={set?.setType ?? "working"}/><input type="hidden" name="completed" value="true"/>{set ? <input type="hidden" name="setId" value={set.id}/> : null}
    <div className="flex items-center justify-between gap-2"><strong className="text-sm">Satz {number}</strong>{previous ? <button type="button" onClick={() => setCopied(true)} className="min-h-11 rounded-lg px-3 text-xs font-bold text-[var(--accent-dark)]">Letzten kopieren</button> : <span className="text-xs text-[var(--muted)]">Kein Vorwert</span>}</div>
    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {type === "weight_or_bodyweight_reps" ? <label className="col-span-2 text-[.68rem] font-bold text-[var(--muted)]">Load-Modus<select name="loadMode" defaultValue={defaults?.loadMode ?? "bodyweight"} className="mt-1 min-h-12 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2 text-[var(--ink)]"><option value="bodyweight">Eigengewicht</option><option value="added">Zusatzgewicht</option><option value="assisted">Unterstützung</option></select></label> : <input type="hidden" name="loadMode" value={hasWeight ? defaults?.loadMode ?? "external" : ""}/>}
      {hasWeight ? <label className="text-[.68rem] font-bold text-[var(--muted)]">Gewicht kg<input key={`weight-${copied}`} name="weightKg" type="number" inputMode="decimal" min="0" max="1000" step="0.25" defaultValue={defaults?.weightKg ?? ""} className="mt-1 min-h-12 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2 text-lg font-black tabular-nums text-[var(--ink)]"/></label> : <input type="hidden" name="weightKg" value=""/>}
      {hasReps ? <label className="text-[.68rem] font-bold text-[var(--muted)]">Wiederholungen<input key={`reps-${copied}`} name="repetitions" type="number" inputMode="numeric" min="0" max="500" defaultValue={defaults?.repetitions ?? ""} className="mt-1 min-h-12 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2 text-lg font-black tabular-nums text-[var(--ink)]"/></label> : <input type="hidden" name="repetitions" value=""/>}
      {hasTime ? <label className="text-[.68rem] font-bold text-[var(--muted)]">Sekunden<input key={`time-${copied}`} name="durationSeconds" type="number" inputMode="numeric" min="0" max="86400" defaultValue={defaults?.durationSeconds ?? ""} className="mt-1 min-h-12 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2 text-lg font-black tabular-nums text-[var(--ink)]"/></label> : <input type="hidden" name="durationSeconds" value=""/>}
      {hasDistance ? <label className="text-[.68rem] font-bold text-[var(--muted)]">Distanz m<input key={`distance-${copied}`} name="distanceMeters" type="number" inputMode="decimal" min="0" max="100000" defaultValue={defaults?.distanceMeters ?? ""} className="mt-1 min-h-12 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2 text-lg font-black tabular-nums text-[var(--ink)]"/></label> : <input type="hidden" name="distanceMeters" value=""/>}
      <label className="text-[.68rem] font-bold text-[var(--muted)]">RIR<input key={`rir-${copied}`} name="rir" type="number" inputMode="decimal" min="0" max="10" step="0.5" defaultValue={defaults?.rir ?? ""} className="mt-1 min-h-12 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2 text-[var(--ink)]"/></label><label className="text-[.68rem] font-bold text-[var(--muted)]">RPE<input key={`rpe-${copied}`} name="rpe" type="number" inputMode="decimal" min="1" max="10" step="0.5" defaultValue={defaults?.rpe ?? ""} className="mt-1 min-h-12 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2 text-[var(--ink)]"/></label>
    </div>
    <div className="mt-3 flex gap-2"><button type="submit" className="min-h-12 flex-1 rounded-xl bg-[var(--accent)] px-4 text-sm font-black text-white">{set?.completed ? "Satz aktualisieren" : "Satz abhaken"}</button>{set ? <button type="submit" formAction={deleteGymSet} className="min-h-12 rounded-xl px-4 text-sm font-bold text-[var(--danger)]">Löschen</button> : null}</div>
  </form>;
}

function ExerciseCard({ sessionId, exercise, index }: { sessionId: string; exercise: GymSessionExercise; index: number }) {
  const defaultCount = Math.max(exercise.targetSets ?? 1, exercise.sets.length + 1);
  const [setCount, setSetCount] = useState(defaultCount);
  const target = exercise.targetRepMin !== null ? `${exercise.targetRepMin}${exercise.targetRepMax !== null ? `–${exercise.targetRepMax}` : ""} Wdh.` : null;
  return <article id={`exercise-${exercise.id}`} className={`card overflow-hidden ${exercise.skipped ? "opacity-65" : ""}`}>
    <header className="border-b border-[var(--line)] p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="eyebrow">Übung {index + 1}</p><h2 className="mt-1 break-words text-xl font-black">{exercise.name}</h2><p className="mt-1 text-xs text-[var(--muted)]">{[exercise.targetSets ? `${exercise.targetSets} Sätze` : null, target, exercise.targetRir !== null ? `RIR ${exercise.targetRir}` : null, `Pause ${exercise.restSeconds}s`].filter(Boolean).join(" · ")}</p></div><form action={skipGymExercise}><input type="hidden" name="sessionId" value={sessionId}/><input type="hidden" name="sessionExerciseId" value={exercise.id}/><input type="hidden" name="skipped" value={exercise.skipped ? "false" : "true"}/><button className="min-h-11 rounded-xl px-3 text-xs font-bold text-[var(--muted)]">{exercise.skipped ? "Zurückholen" : "Überspringen"}</button></form></div><details className="mt-3"><summary className="min-h-11 cursor-pointer py-3 text-sm font-bold text-[var(--accent-dark)]">{exercise.notes ? "Notiz bearbeiten" : "Notiz hinzufügen"}</summary><form action={updateGymSessionExerciseNote} className="grid gap-2 sm:grid-cols-[1fr_auto]"><input type="hidden" name="sessionId" value={sessionId}/><input type="hidden" name="sessionExerciseId" value={exercise.id}/><label className="sr-only" htmlFor={`note-${exercise.id}`}>Notiz für {exercise.name}</label><textarea id={`note-${exercise.id}`} name="notes" defaultValue={exercise.notes ?? ""} maxLength={2000} rows={2} className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 text-sm text-[var(--ink)]"/><button className="secondary-button self-end">Notiz speichern</button></form></details></header>
    <div className="p-4 sm:p-5"><div className="mb-3 grid gap-2 sm:grid-cols-[1fr_auto]"><div className="rounded-xl bg-[var(--surface)] p-3"><p className="text-[.68rem] font-black uppercase tracking-wider text-[var(--muted)]">Letztes Mal</p>{exercise.previousSets.length ? <p className="mt-1 text-sm font-bold">{exercise.previousSets.map((set) => [set.weightKg !== null ? `${set.weightKg} kg` : null, set.repetitions !== null ? `× ${set.repetitions}` : null, set.durationSeconds !== null ? `${set.durationSeconds} s` : null, set.rir !== null ? `RIR ${set.rir}` : null].filter(Boolean).join(" ")).join(" · ")}</p> : <p className="mt-1 text-sm text-[var(--muted)]">Noch keine vorherige Performance.</p>}</div><RestTimer defaultSeconds={exercise.restSeconds}/></div><div className="space-y-2">{Array.from({ length: setCount }, (_, setIndex) => <SetFields key={`${exercise.id}-${setIndex + 1}-${exercise.sets[setIndex]?.id ?? "new"}`} sessionId={sessionId} exercise={exercise} set={exercise.sets[setIndex]} number={setIndex + 1}/>)}</div><button type="button" onClick={() => setSetCount((value) => Math.min(20, value + 1))} className="secondary-button mt-3 w-full">Satz hinzufügen</button></div>
  </article>;
}

export function WorkoutLogger({ session, exercises = [] }: { session: GymSession; exercises?: GymExercise[] }) {
  const [exerciseQuery, setExerciseQuery] = useState("");
  const exerciseResults = useMemo(() => {
    const query = exerciseQuery.trim().toLocaleLowerCase("de");
    if (!query) return [];
    const existing = new Set(session.exercises.flatMap((exercise) => exercise.exerciseId ? [exercise.exerciseId] : []));
    return exercises.filter((exercise) => exercise.active && !existing.has(exercise.id) && [exercise.name, ...exercise.aliases, ...exercise.variations].join(" ").toLocaleLowerCase("de").includes(query)).slice(0, 12);
  }, [exerciseQuery, exercises, session.exercises]);
  const completedSets = session.exercises.flatMap((exercise) => exercise.sets).filter((set) => set.completed).length;
  const targetSets = session.exercises.reduce((sum, exercise) => sum + (exercise.targetSets ?? 0), 0);
  return <div className="pb-24"><section className="card mb-4 p-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">Live Workout</p><h1 className="mt-1 text-3xl font-black">{session.name}</h1><p className="mt-2 text-sm text-[var(--muted)]">Gestartet {new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" }).format(new Date(session.startedAt))} · Servergespeichert</p></div><strong className="text-lg tabular-nums">{completedSets} / {targetSets || "–"} Sätze</strong></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--surface)]"><div className="h-full rounded-full bg-[var(--success)]" style={{ width: `${targetSets ? Math.min(100, completedSets / targetSets * 100) : 0}%` }}/></div></section>
    {session.exercises.length ? <div className="space-y-4">{session.exercises.map((exercise, index) => <ExerciseCard key={exercise.id} sessionId={session.id} exercise={exercise} index={index}/>)}</div> : <div className="card p-10 text-center"><h2 className="text-xl font-black">Noch keine Übungen</h2><p className="mt-2 text-sm text-[var(--muted)]">Suche unten nach einer Übung oder starte künftig direkt aus einem Programmtag.</p></div>}
    {session.status === "active" ? <section className="card mt-4 p-4 sm:p-5"><p className="eyebrow">Workout anpassen</p><h2 className="mt-1 text-lg font-black">Übung hinzufügen</h2><label className="mt-3 block text-xs font-bold text-[var(--muted)]">Library durchsuchen<input value={exerciseQuery} onChange={(event) => setExerciseQuery(event.target.value)} type="search" placeholder="Name, Alias oder Variation" className="mt-1 min-h-12 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-[var(--ink)]"/></label>{exerciseQuery ? exerciseResults.length ? <ul className="mt-2 grid gap-2 sm:grid-cols-2">{exerciseResults.map((exercise) => <li key={exercise.id}><form action={addGymSessionExercise}><input type="hidden" name="sessionId" value={session.id}/><input type="hidden" name="exerciseId" value={exercise.id}/><button className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-[var(--line)] px-3 text-left"><span className="min-w-0 break-words text-sm font-bold">{exercise.name}</span><span className="shrink-0 text-xs text-[var(--accent-dark)]">Hinzufügen</span></button></form></li>)}</ul> : <p className="mt-3 text-sm text-[var(--muted)]">Keine weitere passende Übung gefunden.</p> : null}</section> : null}
    {session.status === "active" ? <form action={finishGymWorkout} className="fixed inset-x-3 bottom-[5.7rem] z-30 mx-auto max-w-xl rounded-2xl border border-[var(--line)] bg-[var(--shell)]/95 p-3 shadow-xl backdrop-blur lg:bottom-5"><input type="hidden" name="sessionId" value={session.id}/><button className="min-h-12 w-full rounded-xl bg-[var(--success)] px-5 font-black text-white">Workout abschließen</button></form> : null}
  </div>;
}

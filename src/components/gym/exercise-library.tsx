"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { toggleGymFavorite } from "@/app/gym/actions";
import type { GymExercise } from "@/lib/gym/types";

function normalized(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function uniqueValues(exercises: readonly GymExercise[], selector: (exercise: GymExercise) => Array<string | null>): string[] {
  return [...new Set(exercises.flatMap(selector).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b, "de"));
}

export function filterExercises(exercises: readonly GymExercise[], filters: { query: string; muscleGroup: string; muscle: string; equipment: string; movement: string; type: string; favoritesOnly: boolean; recentOnly: boolean }): GymExercise[] {
  const query = normalized(filters.query.trim());
  return exercises.filter((exercise) => {
    const searchable = normalized([exercise.name, ...exercise.aliases, ...exercise.variations].join(" "));
    return (!query || searchable.includes(query))
      && (!filters.muscleGroup || exercise.muscleGroup === filters.muscleGroup)
      && (!filters.muscle || exercise.primaryMuscle === filters.muscle || exercise.secondaryMuscles.includes(filters.muscle))
      && (!filters.equipment || exercise.equipment.includes(filters.equipment))
      && (!filters.movement || exercise.movementPattern === filters.movement)
      && (!filters.type || exercise.exerciseType === filters.type)
      && (!filters.favoritesOnly || exercise.favorite)
      && (!filters.recentOnly || exercise.lastUsedAt !== null);
  }).sort((a, b) => {
    if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
    if (a.lastUsedAt !== b.lastUsedAt) return (b.lastUsedAt ?? "").localeCompare(a.lastUsedAt ?? "");
    return a.name.localeCompare(b.name, "de");
  });
}

export function ExerciseLibrary({ exercises, demoMode }: { exercises: GymExercise[]; demoMode: boolean }) {
  const [query, setQuery] = useState("");
  const [muscleGroup, setMuscleGroup] = useState("");
  const [muscle, setMuscle] = useState("");
  const [equipment, setEquipment] = useState("");
  const [movement, setMovement] = useState("");
  const [type, setType] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [recentOnly, setRecentOnly] = useState(false);
  const muscleGroups = useMemo(() => uniqueValues(exercises, (exercise) => [exercise.muscleGroup]), [exercises]);
  const muscles = useMemo(() => uniqueValues(exercises, (exercise) => [exercise.primaryMuscle, ...exercise.secondaryMuscles]), [exercises]);
  const equipmentOptions = useMemo(() => uniqueValues(exercises, (exercise) => exercise.equipment), [exercises]);
  const movements = useMemo(() => uniqueValues(exercises, (exercise) => [exercise.movementPattern]), [exercises]);
  const types = useMemo(() => uniqueValues(exercises, (exercise) => [exercise.exerciseType]), [exercises]);
  const results = useMemo(() => filterExercises(exercises, { query, muscleGroup, muscle, equipment, movement, type, favoritesOnly, recentOnly }), [exercises, query, muscleGroup, muscle, equipment, movement, type, favoritesOnly, recentOnly]);
  const clear = () => { setQuery(""); setMuscleGroup(""); setMuscle(""); setEquipment(""); setMovement(""); setType(""); setFavoritesOnly(false); setRecentOnly(false); };
  return <div className="grid gap-5 xl:grid-cols-[19rem_minmax(0,1fr)]">
    <aside className="card h-fit p-4 xl:sticky xl:top-6">
      <div className="flex items-center justify-between"><p className="eyebrow">Filter</p><button type="button" onClick={clear} className="text-xs font-bold text-[var(--accent-dark)]">Zurücksetzen</button></div>
      <label className="mt-4 block text-xs font-bold text-[var(--muted)]">Suche<input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="Übung, Alias oder Variation" className="mt-1.5 min-h-12 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--ink)]" /></label>
      <div className="mt-4 grid gap-3">
        {[{ label: "Muskelgruppe", value: muscleGroup, set: setMuscleGroup, options: muscleGroups }, { label: "Exakter Muskel", value: muscle, set: setMuscle, options: muscles }, { label: "Equipment", value: equipment, set: setEquipment, options: equipmentOptions }, { label: "Bewegungsmuster", value: movement, set: setMovement, options: movements }, { label: "Übungstyp", value: type, set: setType, options: types }].map((filter) => <label key={filter.label} className="text-xs font-bold text-[var(--muted)]">{filter.label}<select value={filter.value} onChange={(event) => filter.set(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--ink)]"><option value="">Alle</option>{filter.options.map((option) => <option key={option}>{option}</option>)}</select></label>)}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2"><button type="button" aria-pressed={favoritesOnly} onClick={() => setFavoritesOnly((value) => !value)} className={`min-h-11 rounded-xl border px-3 text-xs font-bold ${favoritesOnly ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-dark)]" : "border-[var(--line)]"}`}>★ Favoriten</button><button type="button" aria-pressed={recentOnly} onClick={() => setRecentOnly((value) => !value)} className={`min-h-11 rounded-xl border px-3 text-xs font-bold ${recentOnly ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-dark)]" : "border-[var(--line)]"}`}>Zuletzt</button></div>
    </aside>
    <section aria-live="polite">
      <div className="mb-3 flex items-end justify-between gap-3"><div><p className="eyebrow">Exercise Library</p><h2 className="mt-1 text-xl font-black">{results.length} Übungen</h2></div><Link href="/gym/library?custom=open#custom-exercise" className="secondary-button">Eigene Übung</Link></div>
      {results.length ? <ul className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-3">{results.map((exercise) => <li key={exercise.id} className="group rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4 transition hover:border-[var(--accent)]">
        <div className="flex items-start gap-3"><Link href={`/gym/exercises/${exercise.id}`} className="min-w-0 flex-1"><p className="break-words font-black text-[var(--ink)]">{exercise.name}</p><p className="mt-1 text-xs text-[var(--muted)]">{exercise.muscleGroup} · {exercise.trackingType.replaceAll("_", " ")}</p></Link>
          {demoMode ? <span title="Favoriten sind nach der Einrichtung verfügbar" className="text-lg text-[var(--muted)]">☆</span> : <form action={toggleGymFavorite}><input type="hidden" name="exerciseId" value={exercise.id}/><input type="hidden" name="destination" value="/gym/library"/><button aria-label={`${exercise.name} ${exercise.favorite ? "aus Favoriten entfernen" : "favorisieren"}`} className="grid size-11 place-items-center text-xl text-[var(--accent-dark)]">{exercise.favorite ? "★" : "☆"}</button></form>}
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">{exercise.equipment.slice(0, 3).map((item) => <span key={item} className="rounded-full bg-[var(--surface)] px-2 py-1 text-[.68rem] font-bold text-[var(--ink-soft)]">{item}</span>)}{exercise.movementPattern ? <span className="rounded-full bg-[var(--surface)] px-2 py-1 text-[.68rem] font-bold text-[var(--ink-soft)]">{exercise.movementPattern}</span> : null}</div>
      </li>)}</ul> : <div className="card p-10 text-center"><h3 className="text-lg font-black">Keine passende Übung</h3><p className="mt-2 text-sm text-[var(--muted)]">Filter lockern oder eine eigene Übung anlegen.</p><button type="button" onClick={clear} className="secondary-button mt-5">Filter zurücksetzen</button></div>}
    </section>
  </div>;
}

"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatDate, formatDistance, formatDuration, formatPace } from "@/lib/format";
import type { PlanComparison } from "@/lib/planning/reconciliation";
import { activitySportLabels } from "@/lib/sports";
import { filterTrainingHistory, historyMonthKey, type HistoryFilters, type TrainingHistoryEntry } from "@/lib/training-history";

const initialFilters: HistoryFilters = { query: "", sport: "all", period: "all", plan: "all", sort: "newest" };

export function ActivityArchive({ entries, now }: { entries: TrainingHistoryEntry[]; now: string }) {
  const [filters, setFilters] = useState(initialFilters);
  const filtered = useMemo(() => filterTrainingHistory(entries, filters, new Date(now)), [entries, filters, now]);
  const groups = useMemo(() => {
    const result = new Map<string, TrainingHistoryEntry[]>();
    for (const entry of filtered) {
      const key = historyMonthKey(entry.occurredAt);
      result.set(key, [...(result.get(key) ?? []), entry]);
    }
    return result;
  }, [filtered]);
  const hasFilters = JSON.stringify(filters) !== JSON.stringify(initialFilters);
  const patch = <Key extends keyof HistoryFilters>(key: Key, value: HistoryFilters[Key]) => setFilters((current) => ({ ...current, [key]: value }));

  return <section aria-label="Trainingsarchiv">
    <div className="card mb-6 p-4 sm:p-5">
      <div className="grid gap-3 lg:grid-cols-[minmax(14rem,1fr)_repeat(4,minmax(9rem,auto))]">
        <label className="text-xs font-bold text-[var(--muted)]">Suche<input type="search" value={filters.query} onChange={(event) => patch("query", event.target.value)} placeholder="Name oder Quelle" className="mt-1.5 min-h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] px-3 text-sm text-[var(--ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]" /></label>
        <FilterSelect label="Zeitraum" value={filters.period} onChange={(value) => patch("period", value as HistoryFilters["period"])} options={[["all", "Gesamter Zeitraum"], ["30", "30 Tage"], ["90", "90 Tage"], ["365", "12 Monate"]]} />
        <FilterSelect label="Sport" value={filters.sport} onChange={(value) => patch("sport", value as HistoryFilters["sport"])} options={[["all", "Alle Sportarten"], ["running", "Laufen"], ["cycling", "Radfahren"], ["strength", "Gym"], ["volleyball", "Volleyball"], ["other", "Sonstiges"]]} />
        <FilterSelect label="Planstatus" value={filters.plan} onChange={(value) => patch("plan", value as HistoryFilters["plan"])} options={[["all", "Alle"], ["planned", "Mit Plan"], ["matched", "Plan getroffen"], ["deviation", "Planabweichung"], ["unplanned", "Ungeplant"]]} />
        <FilterSelect label="Sortierung" value={filters.sort} onChange={(value) => patch("sort", value as HistoryFilters["sort"])} options={[["newest", "Neueste zuerst"], ["oldest", "Älteste zuerst"], ["distance", "Längste Distanz"], ["duration", "Längste Dauer"]]} />
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-4 text-sm"><p aria-live="polite" className="font-bold">{filtered.length} von {entries.length} Einträgen</p>{hasFilters && <button type="button" onClick={() => setFilters(initialFilters)} className="rounded-lg px-3 py-2 font-bold text-[var(--accent)] outline-none hover:bg-[var(--accent-soft)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]">Filter zurücksetzen</button>}</div>
    </div>
    {filtered.length ? [...groups.entries()].map(([month, monthEntries]) => <div key={month} className="mb-8"><div className="mb-3 flex items-center gap-3"><h2 className="text-lg font-black capitalize">{month}</h2><span className="h-px flex-1 bg-[var(--line)]" /></div><div className="grid gap-3">{monthEntries.map((entry) => <HistoryCard key={`${entry.kind}-${entry.id}`} entry={entry} />)}</div></div>) : <div className="card p-10 text-center"><p className="text-xl font-black">Keine passenden Trainings gefunden</p><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[var(--muted)]">Passe Suche oder Filter an. Deine gespeicherten Aktivitäten bleiben unverändert.</p>{hasFilters && <button type="button" onClick={() => setFilters(initialFilters)} className="secondary-button mt-5">Alle Trainings anzeigen</button>}</div>}
  </section>;
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<[string, string]> }) {
  return <label className="text-xs font-bold text-[var(--muted)]">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] px-3 text-sm font-semibold text-[var(--ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]">{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></label>;
}

function HistoryCard({ entry }: { entry: TrainingHistoryEntry }) {
  const metrics = historyMetrics(entry);
  return <article className="card overflow-hidden transition hover:border-[color-mix(in_srgb,var(--accent)_35%,var(--line))] hover:shadow-[0_14px_40px_var(--shadow-color)]"><Link href={entry.href} className="block p-4 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)] sm:p-5"><div className="flex items-start gap-3 sm:gap-4"><span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-xl text-[var(--accent-dark)]">{sportIcon(entry.sportType)}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate font-black sm:text-lg">{entry.title}</h3><p className="mt-1 text-xs font-semibold text-[var(--muted)]">{activitySportLabels[entry.sportType]} · {formatDate(entry.occurredAt)}{entry.kind === "gym" && entry.programName ? ` · ${entry.programName}` : ""}</p></div>{entry.planMatch ? <span className={`rounded-full px-3 py-1 text-xs font-black ${entry.planMatch.status === "matched" ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-400/15 dark:text-emerald-200" : "bg-amber-100 text-amber-950 dark:bg-amber-400/15 dark:text-amber-100"}`}>{entry.planMatch.status === "matched" ? "✓ Plan getroffen" : "Planabweichung"}</span> : <span className="rounded-full bg-[var(--surface-raised)] px-3 py-1 text-xs font-bold text-[var(--muted)]">Ungeplant</span>}</div><dl className="mt-4 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:gap-x-8 sm:gap-y-3">{metrics.map((metric) => <div key={metric.label}><dt className="text-[.68rem] font-bold uppercase tracking-wider text-[var(--muted)]">{metric.label}</dt><dd className="mt-0.5 font-black tabular-nums">{metric.value}</dd></div>)}</dl>{entry.planMatch && <div className="mt-4 border-t border-[var(--line)] pt-3"><p className="text-xs font-bold text-[var(--muted)]">Plan-Zuordnung</p><p className="mt-1 text-sm font-black">{entry.planMatch.workoutTitle}</p>{planDelta(entry.planMatch.comparison) && <p className="mt-1 text-xs text-[var(--muted)]">{planDelta(entry.planMatch.comparison)}</p>}</div>}</div></div></Link></article>;
}

function historyMetrics(entry: TrainingHistoryEntry): Array<{ label: string; value: string }> {
  if (entry.kind === "gym") return [{ label: "Dauer", value: formatDuration(entry.durationSeconds) }, { label: "Arbeitssätze", value: String(entry.workingSets) }, { label: "Übungen", value: String(entry.exerciseCount) }];
  if (entry.sportType === "running") return [{ label: "Distanz", value: formatDistance(entry.distanceMeters) }, { label: "Dauer", value: formatDuration(entry.durationSeconds) }, { label: "Pace", value: formatPace(entry.averageSpeedKmh) }, ...(entry.averageHeartRate ? [{ label: "Ø HF", value: `${Math.round(entry.averageHeartRate)} bpm` }] : [])];
  if (entry.sportType === "cycling") return [{ label: "Distanz", value: formatDistance(entry.distanceMeters) }, { label: "Dauer", value: formatDuration(entry.durationSeconds) }, { label: "Geschwindigkeit", value: entry.averageSpeedKmh ? `${entry.averageSpeedKmh.toLocaleString("de-DE", { maximumFractionDigits: 1 })} km/h` : "–" }, ...(entry.averagePower ? [{ label: "Ø Leistung", value: `${Math.round(entry.averagePower)} W` }] : [])];
  return [{ label: "Dauer", value: formatDuration(entry.durationSeconds) }, ...(entry.averageHeartRate ? [{ label: "Ø HF", value: `${Math.round(entry.averageHeartRate)} bpm` }] : []), ...(entry.maximumHeartRate ? [{ label: "Max. HF", value: `${Math.round(entry.maximumHeartRate)} bpm` }] : [])];
}

function planDelta(comparison: PlanComparison | null): string | null {
  if (!comparison) return null;
  const parts = [comparison.distanceDeltaKm === null ? null : `${comparison.distanceDeltaKm > 0 ? "+" : ""}${comparison.distanceDeltaKm.toLocaleString("de-DE")} km gegenüber Plan`, comparison.durationDeltaMinutes === null ? null : `${comparison.durationDeltaMinutes > 0 ? "+" : ""}${comparison.durationDeltaMinutes} min`].filter((value): value is string => Boolean(value));
  return parts.length ? parts.join(" · ") : null;
}

function sportIcon(sport: TrainingHistoryEntry["sportType"]): string { return { running: "↗", cycling: "◉", strength: "◆", volleyball: "●", other: "•" }[sport]; }

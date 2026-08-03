"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { importAppleHealthWorkoutBatch, type AppleHealthImportResult } from "@/app/activities/upload/apple-health-actions";
import { extractAppleHealthHeartRateForRanges, extractAppleHealthWorkouts } from "@/lib/apple-health/browser-extractor";

type ImportSummary = AppleHealthImportResult & { ignoredCyclingCount: number; found: number };

function combine(current: AppleHealthImportResult, next: AppleHealthImportResult): AppleHealthImportResult {
  return {
    imported: current.imported + next.imported,
    skippedDuplicates: current.skippedDuplicates + next.skippedDuplicates,
    activityIds: [...current.activityIds, ...next.activityIds],
    errors: [...current.errors, ...next.errors],
  };
}

export function AppleHealthWorkoutImport() {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get("healthWorkoutFile");
    if (!(file instanceof File) || file.size === 0) { setStatus("Bitte wähle deine export.zip oder export.xml aus."); return; }
    setPending(true);
    setSummary(null);
    try {
      setStatus("Unterstützte Workouts werden lokal gesucht … 0 %");
      const extraction = await extractAppleHealthWorkouts(file, (fraction) => setStatus(`Unterstützte Workouts werden lokal gesucht … ${Math.round(fraction * 100)} %`));
      if (!extraction.workouts.length) {
        setSummary({ imported: 0, skippedDuplicates: 0, activityIds: [], errors: [], ignoredCyclingCount: extraction.ignoredCyclingCount, found: 0 });
        setStatus(null);
        return;
      }
      setStatus("Passende Herzfrequenzdaten werden lokal zugeordnet … 0 %");
      const heartRate = await extractAppleHealthHeartRateForRanges(file, extraction.workouts.map((workout) => ({ startTime: workout.startTime, elapsedTimeSeconds: workout.elapsedTimeSeconds })), (fraction) => setStatus(`Passende Herzfrequenzdaten werden lokal zugeordnet … ${Math.round(fraction * 100)} %`));
      const payloads = extraction.workouts.map((workout, index) => ({ ...workout, heartRateSamples: heartRate[index] ?? [] }));
      let imported: AppleHealthImportResult = { imported: 0, skippedDuplicates: 0, activityIds: [], errors: [] };
      for (let offset = 0; offset < payloads.length; offset += 10) {
        setStatus(`${Math.min(offset + 10, payloads.length)} von ${payloads.length} Workouts werden gespeichert …`);
        imported = combine(imported, await importAppleHealthWorkoutBatch(payloads.slice(offset, offset + 10)));
      }
      setSummary({ ...imported, ignoredCyclingCount: extraction.ignoredCyclingCount, found: extraction.workouts.length });
      setStatus(null);
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Der Apple-Health-Import ist fehlgeschlagen.");
    } finally {
      setPending(false);
    }
  }

  return <section className="relative mb-6 overflow-hidden rounded-[1.5rem] border border-blue-200/70 bg-gradient-to-br from-[#edf4ff] via-white to-[#e8f9fd] p-5 shadow-[0_12px_32px_rgba(37,99,235,.08)] sm:p-6">
    <div aria-hidden className="absolute -right-14 -top-20 size-48 rounded-full border-[32px] border-cyan-400/10" />
    <div className="relative grid min-w-0 gap-6 lg:grid-cols-[.8fr_1.2fr] lg:items-center">
      <div><p className="eyebrow">Apple Health · automatisch</p><h2 className="mt-2 text-2xl font-black tracking-[-.03em]">Laufen, Gym und Volleyball übernehmen</h2><p className="mt-3 text-sm leading-6 text-[var(--muted)]">UltraPilot liest die ZIP lokal, ordnet den Workouts ihre Pulswerte zu und speichert ausschließlich die abgeleiteten Einheiten. <strong className="text-[var(--ink)]">Apple-Health-Radfahrten werden immer ignoriert.</strong></p><div className="mt-4 flex flex-wrap gap-2">{["Laufen", "Krafttraining", "Volleyball"].map((sport) => <span key={sport} className="rounded-full border border-blue-100 bg-white/80 px-3 py-1.5 text-xs font-black text-blue-800">{sport}</span>)}</div></div>
      <form onSubmit={submit} className="min-w-0 rounded-2xl border border-white/80 bg-white/75 p-4 shadow-sm sm:p-5">
        <label htmlFor="healthWorkoutFile" className="block min-w-0 overflow-hidden rounded-xl border-2 border-dashed border-[#b9c9df] bg-[#f8fbff] p-4 transition hover:border-[var(--accent)]"><span className="font-bold">Apple-Health-Export auswählen</span><span className="mt-1 block text-xs leading-5 text-[var(--muted)]">export.zip oder export.xml · Wiederholungsimporte erzeugen keine Duplikate</span><input id="healthWorkoutFile" name="healthWorkoutFile" type="file" accept=".zip,.xml,application/zip,text/xml,application/xml" required className="mt-4 block w-full min-w-0 overflow-hidden text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-blue-700 file:px-4 file:py-2 file:text-white" /></label>
        <button type="submit" disabled={pending} className="mt-4 w-full rounded-xl bg-[var(--accent)] px-5 py-3 font-black text-white transition hover:bg-[var(--accent-dark)] disabled:cursor-wait disabled:opacity-60">{pending ? "Health-Daten werden verarbeitet …" : "Neue Watch-Workouts importieren"}</button>
        {status && <p role="status" className={`mt-4 rounded-xl px-4 py-3 text-sm font-bold ${pending ? "bg-blue-50 text-blue-900" : "bg-red-50 text-red-900"}`}>{status}</p>}
        {summary && <div role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950"><p className="font-black">{summary.imported ? `${summary.imported} neue ${summary.imported === 1 ? "Aktivität" : "Aktivitäten"} importiert.` : "Keine neuen Aktivitäten gefunden."}</p><ul className="mt-2 space-y-1 text-xs"><li>{summary.skippedDuplicates} bereits vorhandene Workouts übersprungen</li><li>{summary.ignoredCyclingCount} Apple-Health-Radfahrten bewusst ignoriert</li><li>{summary.found} unterstützte Workouts im Export erkannt</li></ul>{summary.errors.length > 0 && <p className="mt-2 text-xs font-bold text-red-800">{summary.errors.length} Einheiten konnten nicht gespeichert werden: {summary.errors[0]}</p>}{summary.activityIds.length === 1 && <Link href={`/activities/${summary.activityIds[0]}`} className="mt-3 inline-flex font-black text-emerald-800">Aktivität öffnen →</Link>}</div>}
      </form>
    </div>
  </section>;
}

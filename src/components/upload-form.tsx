"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { inspectActivityFile, type UploadResult, type UploadState } from "@/app/activities/upload/actions";
import { SelectedFileField } from "@/components/selected-file-field";
import { commonDetectedSport, type ImportSportType } from "@/lib/activity-import";
import { parseActivityFile } from "@/lib/activity-files/parser";
import { extractAppleHealthHeartRateForRanges } from "@/lib/apple-health/browser-extractor";
import { formatDistance, formatDuration, formatPace } from "@/lib/format";
import type { PlanComparison } from "@/lib/planning/reconciliation";

const initialState: UploadState = { status: "idle", message: "" };
const MAX_BATCH_FILES = 20;

function selectedFiles(formData: FormData, name: string): File[] {
  return formData.getAll(name).filter((value): value is File => value instanceof File && value.size > 0);
}

function heartRateSourceLabel(source: UploadState["heartRateSource"], samples: number | undefined): string {
  if (source === "primary") return "Hauptdatei";
  if (source === "apple_watch") return `Apple Health (${samples} Samples)`;
  if (source === "fit" || source === "gpx" || source === "garmin_edge") return `Zusatzdatei (${samples} Samples)`;
  return "keine";
}

export function UploadForm({ defaultSportType }: { defaultSportType: ImportSportType | null }) {
  const [localStatus, setLocalStatus] = useState<string | null>(null);
  const [selectedSportType, setSelectedSportType] = useState<ImportSportType | "">(defaultSportType ?? "");
  const [sportTouched, setSportTouched] = useState(false);

  const detectSport = async (files: File[]) => {
    if (!files.length || sportTouched) return;
    try {
      const parsed = await Promise.all(files.map((file) => parseActivityFile(file, file.name.toLowerCase().endsWith(".fit") ? "fit" : "gpx")));
      const detected = commonDetectedSport(parsed.map((activity) => activity.detectedSportType));
      if (detected) setSelectedSportType(detected);
    } catch {
      // Selection remains explicit when metadata cannot be read reliably.
    }
  };

  const submitBatch = async (_previous: UploadState, formData: FormData): Promise<UploadState> => {
    const primaryFiles = selectedFiles(formData, "activityFiles");
    const healthExport = formData.get("appleHealthFile");
    const directHeartRateFile = formData.get("heartRateFile");
    const hasHealthExport = healthExport instanceof File && healthExport.size > 0;
    const hasDirectFile = directHeartRateFile instanceof File && directHeartRateFile.size > 0;
    try {
      if (!primaryFiles.length) return { status: "error", message: "Bitte wähle mindestens eine GPX- oder FIT-Datei aus." };
      if (selectedSportType !== "cycling" && selectedSportType !== "running") return { status: "error", message: "Bitte wähle aus, ob die Dateien Läufe oder Radfahrten enthalten." };
      if (primaryFiles.length > MAX_BATCH_FILES) return { status: "error", message: `Pro Durchgang können höchstens ${MAX_BATCH_FILES} Aktivitäten importiert werden.` };
      if (hasHealthExport && hasDirectFile) return { status: "error", message: "Bitte verwende entweder den Apple-Health-Export oder eine einzelne Zusatzdatei – nicht beides." };
      if (hasDirectFile && primaryFiles.length > 1) return { status: "error", message: "Eine einzelne Zusatzdatei kann nur einer Hauptdatei zugeordnet werden. Nutze für mehrere Aktivitäten den Apple-Health-Export." };

      let healthSamples: { timestamp: string; value: number }[][] = primaryFiles.map(() => []);
      if (hasHealthExport) {
        setLocalStatus(`Zeiträume von ${primaryFiles.length} Aktivitäten werden ermittelt …`);
        const parsed = [];
        for (let index = 0; index < primaryFiles.length; index += 1) {
          const file = primaryFiles[index];
          setLocalStatus(`Aktivität ${index + 1} von ${primaryFiles.length} wird lokal gelesen …`);
          parsed.push(await parseActivityFile(file, file.name.toLowerCase().endsWith(".fit") ? "fit" : "gpx"));
        }
        healthSamples = await extractAppleHealthHeartRateForRanges(healthExport, parsed.map((activity) => ({ startTime: activity.metrics.startTime, elapsedTimeSeconds: activity.metrics.elapsedTimeSeconds })), (fraction) => setLocalStatus(`Apple Health wird einmal lokal durchsucht … ${Math.round(fraction * 100)} %`));
      }

      const results: UploadResult[] = [];
      for (let index = 0; index < primaryFiles.length; index += 1) {
        const file = primaryFiles[index];
        setLocalStatus(`Aktivität ${index + 1} von ${primaryFiles.length} wird gespeichert …`);
        const single = new FormData();
        single.set("activityFile", file);
        single.set("sportType", selectedSportType);
        if (hasDirectFile) single.set("heartRateFile", directHeartRateFile);
        if (hasHealthExport && healthSamples[index]?.length) single.set("heartRateFile", new File([JSON.stringify({ format: "ultrapilot-heart-rate-v1", samples: healthSamples[index] })], `apple-watch-heart-rate-${index + 1}.json`, { type: "application/json" }));
        results.push(await inspectActivityFile(initialState, single));
      }

      const succeeded = results.filter((result) => result.status === "success").length;
      const duplicates = results.filter((result) => result.status === "duplicate").length;
      const failed = results.length - succeeded - duplicates;
      const overallStatus = failed > 0 ? (succeeded > 0 || duplicates > 0 ? "partial" : "error") : duplicates > 0 ? (succeeded > 0 ? "partial" : "duplicate") : "success";
      const messageParts = [succeeded ? `${succeeded} ${succeeded === 1 ? "Aktivität" : "Aktivitäten"} importiert` : null, duplicates ? `${duplicates} bereits vorhanden (übersprungen)` : null, failed ? `${failed} fehlgeschlagen` : null].filter((part): part is string => part !== null);
      const lastSuccess = [...results].reverse().find((result) => result.status === "success");
      return { status: overallStatus, message: `${messageParts.join(", ")}.`, results, metrics: lastSuccess?.metrics, sportType: lastSuccess?.sportType, planMatch: lastSuccess?.planMatch, heartRateSource: lastSuccess?.heartRateSource, importedHeartRateSamples: lastSuccess?.importedHeartRateSamples };
    } catch (error) {
      return { status: "error", message: error instanceof Error ? error.message : "Der Import konnte nicht abgeschlossen werden." };
    } finally {
      setLocalStatus(null);
    }
  };

  const [state, formAction, pending] = useActionState(submitBatch, initialState);
  const completed = state.status === "success" && state.results?.some((result) => result.status === "success");
  if (completed) return <ImportSuccess results={state.results ?? []} />;

  return <div className="grid min-w-0 gap-6 lg:grid-cols-[1.2fr_.8fr]">
    <form action={formAction} className="card min-w-0 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4"><div><p className="eyebrow">Schritt 1</p><h2 className="mt-2 text-xl font-black">Aktivitäten auswählen</h2></div><span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-bold text-[var(--accent-dark)]">bis zu {MAX_BATCH_FILES}</span></div>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">FIT und GPX werden verarbeitet. Wenn deine Auswahl die Sportart nicht eindeutig macht, fragst du sie hier bewusst ab.</p>
      <label className="mt-5 block text-sm font-bold">Sportart<select name="sportType" value={selectedSportType} onChange={(event) => { setSportTouched(true); setSelectedSportType(event.target.value === "running" ? "running" : event.target.value === "cycling" ? "cycling" : ""); }} className="mt-2 min-h-12 w-full rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] px-4 text-[var(--ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"><option value="">Bitte auswählen</option><option value="cycling">Radfahren</option><option value="running">Laufen</option></select></label>
      <SelectedFileField name="activityFiles" title="GPX- oder FIT-Dateien" hint="Mehrfachauswahl möglich · enthaltene Herzfrequenz wird automatisch übernommen · jeweils maximal 20 MB" accept=".fit,.gpx,application/gpx+xml,application/octet-stream" multiple onFilesChange={(files) => void detectSport(files)} />
      <div className="mt-5 rounded-2xl border border-[var(--line)] p-4"><p className="eyebrow">Schritt 2 · optional</p><p className="mt-2 text-sm font-bold">Herzfrequenz aus einer zweiten Quelle ergänzen</p><SelectedFileField name="appleHealthFile" title="Apple-Health-Export für alle ausgewählten Aktivitäten" hint="export.zip oder export.xml · wird nur einmal lokal gelesen · auch 55 MB sind okay" accept=".zip,.xml,application/zip,text/xml,application/xml" /><SelectedFileField name="heartRateFile" title="Einzelne Zusatzdatei" hint="Nur bei genau einer Hauptdatei · FIT oder GPX · maximal 20 MB" accept=".fit,.gpx,application/gpx+xml,application/octet-stream" /></div>
      <div className="mt-5 rounded-xl bg-[var(--accent-soft)] px-4 py-3 text-xs leading-5 text-[var(--muted)]">Enthält die Hauptdatei bereits Herzfrequenzwerte, werden sie direkt für Kurve, Durchschnitt, Maximum, Zonen und Trainingsbelastung verwendet.</div>
      {localStatus && <p role="status" className="mt-4 text-sm font-bold text-[var(--accent-dark)]">{localStatus}</p>}
      <button type="submit" disabled={pending} className="primary-button mt-5 w-full justify-center disabled:cursor-wait disabled:opacity-60">{pending ? "Import läuft …" : "Ausgewählte Aktivitäten importieren"}</button>
      {state.status !== "idle" && <div role="status" className={`mt-5 rounded-xl border px-4 py-3 text-sm ${state.status === "partial" || state.status === "duplicate" ? "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100" : "border-red-200 bg-red-50 text-red-900 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-100"}`}><strong>{state.message}</strong></div>}
      {state.results?.length ? <ResultList results={state.results} /> : null}
    </form>
    <aside className="card p-6"><p className="eyebrow">Vorschau</p>{state.metrics ? <><Metrics metrics={state.metrics} sportType={state.sportType ?? (selectedSportType || "cycling")} /><p className="mt-6 rounded-xl bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-900 dark:bg-emerald-400/10 dark:text-emerald-100">Herzfrequenzquelle: {heartRateSourceLabel(state.heartRateSource, state.importedHeartRateSamples)}</p></> : <p className="mt-4 text-sm leading-6 text-[var(--muted)]">Nach dem Import siehst du hier echte Kennzahlen und eine vorhandene Plan-Zuordnung.</p>}</aside>
  </div>;
}

function ImportSuccess({ results }: { results: UploadResult[] }) {
  const imported = results.filter((result) => result.status === "success");
  return <section className="card overflow-hidden"><div className="bg-emerald-50/80 p-6 dark:bg-emerald-400/10 sm:p-8"><span className="grid size-12 place-items-center rounded-full bg-emerald-600 text-2xl font-black text-white">✓</span><p className="eyebrow mt-5 text-emerald-700 dark:text-emerald-300">Import abgeschlossen</p><h2 className="mt-2 text-2xl font-black">{imported.length === 1 ? `${imported[0].sportType === "running" ? "Lauf" : "Radfahrt"} erfolgreich importiert` : `${imported.length} Aktivitäten erfolgreich importiert`}</h2><p className="mt-2 text-sm text-[var(--muted)]">Deine Originaldatei, Messwerte und vorhandene Plan-Zuordnung wurden sicher gespeichert.</p></div><div className="grid gap-4 p-5 sm:p-8">{imported.map((result, index) => <article key={`${result.fileName}-${index}`} className="rounded-2xl border border-[var(--line)] p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-black">{result.fileName}</h3><p className="mt-1 text-xs text-[var(--muted)]">{result.sportType === "running" ? "Laufen" : "Radfahren"}</p></div>{result.activityId && <Link href={`/activities/${result.activityId}`} className="primary-button">Aktivität ansehen</Link>}</div>{result.metrics && <div className="mt-5"><Metrics metrics={result.metrics} sportType={result.sportType ?? "cycling"} /></div>}{result.planMatch && <div className="mt-5 rounded-xl bg-[var(--accent-soft)] p-4"><p className="text-xs font-bold text-[var(--muted)]">Plan-Zuordnung</p><p className="mt-1 font-black">✓ {result.planMatch.workoutTitle}</p><p className="mt-1 text-xs text-[var(--muted)]">{comparisonText(result.planMatch.comparison)}</p></div>}</article>)}</div><div className="border-t border-[var(--line)] p-5 sm:px-8"><button type="button" onClick={() => window.location.assign("/activities/upload")} className="secondary-button">Weitere Aktivität importieren</button></div></section>;
}

function ResultList({ results }: { results: UploadResult[] }) { return <div className="mt-4 space-y-2">{results.map((result, index) => <div key={`${result.fileName}-${index}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--line)] px-4 py-3 text-sm"><div><p className="font-bold">{result.fileName ?? `Datei ${index + 1}`}</p><p className="mt-0.5 text-xs text-[var(--muted)]">{result.message}</p></div>{result.activityId && <Link href={`/activities/${result.activityId}`} className="font-bold text-[var(--accent)]">Öffnen →</Link>}</div>)}</div>; }

function Metrics({ metrics, sportType }: { metrics: NonNullable<UploadState["metrics"]>; sportType: ImportSportType }) { return <dl className="grid grid-cols-2 gap-x-5 gap-y-5 sm:grid-cols-3"><Metric label="Distanz" value={formatDistance(metrics.distanceMeters)} /><Metric label="Bewegungszeit" value={formatDuration(metrics.movingTimeSeconds)} /><Metric label={sportType === "running" ? "Ø Pace" : "Ø Geschwindigkeit"} value={sportType === "running" ? formatPace(metrics.averageSpeedKmh) : `${metrics.averageSpeedKmh.toLocaleString("de-DE", { maximumFractionDigits: 1 })} km/h`} /><Metric label="Höhengewinn" value={`${Math.round(metrics.elevationGainMeters).toLocaleString("de-DE")} m`} />{metrics.averageHeartRate !== null && <Metric label="Ø Herzfrequenz" value={`${Math.round(metrics.averageHeartRate)} bpm`} />}</dl>; }

function comparisonText(comparison: PlanComparison | null): string { if (!comparison) return "Plan und Aktivität sind verknüpft."; return [comparison.distanceDeltaKm === null ? null : `${comparison.distanceDeltaKm > 0 ? "+" : ""}${comparison.distanceDeltaKm.toLocaleString("de-DE")} km`, comparison.durationDeltaMinutes === null ? null : `${comparison.durationDeltaMinutes > 0 ? "+" : ""}${comparison.durationDeltaMinutes} min`].filter(Boolean).join(" · ") || "Plan und Aktivität sind verknüpft."; }
function Metric({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs text-[var(--muted)]">{label}</dt><dd className="mt-1 font-semibold">{value}</dd></div>; }

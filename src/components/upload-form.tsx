"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { inspectActivityFile, type UploadResult, type UploadState } from "@/app/activities/upload/actions";
import { parseActivityFile } from "@/lib/activity-files/parser";
import { extractAppleHealthHeartRateForRanges } from "@/lib/apple-health/browser-extractor";
import { formatDistance, formatDuration, formatPace } from "@/lib/format";

const initialState: UploadState = { status: "idle", message: "" };
const MAX_BATCH_FILES = 20;

function selectedFiles(formData: FormData, name: string): File[] {
  return formData.getAll(name).filter((value): value is File => value instanceof File && value.size > 0);
}

export function UploadForm() {
  const [localStatus, setLocalStatus] = useState<string | null>(null);
  const [selectedSportType, setSelectedSportType] = useState<"cycling" | "running">("cycling");
  const submitBatch = async (_previous: UploadState, formData: FormData): Promise<UploadState> => {
    const primaryFiles = selectedFiles(formData, "activityFiles");
    const healthExport = formData.get("appleHealthFile");
    const directHeartRateFile = formData.get("heartRateFile");
    const hasHealthExport = healthExport instanceof File && healthExport.size > 0;
    const hasDirectFile = directHeartRateFile instanceof File && directHeartRateFile.size > 0;
    try {
      if (!primaryFiles.length) return { status: "error", message: "Bitte wähle mindestens eine Garmin-, GPX- oder FIT-Datei aus." };
      if (primaryFiles.length > MAX_BATCH_FILES) return { status: "error", message: `Pro Durchgang können höchstens ${MAX_BATCH_FILES} Aktivitäten importiert werden.` };
      if (hasHealthExport && hasDirectFile) return { status: "error", message: "Bitte verwende entweder den Apple-Health-Export oder eine direkte Watch-Datei – nicht beides." };
      if (hasDirectFile && primaryFiles.length > 1) return { status: "error", message: "Eine einzelne Watch-Datei kann nur einer Hauptdatei zugeordnet werden. Nutze für mehrere Fahrten den Apple-Health-Export." };

      let healthSamples: { timestamp: string; value: number }[][] = primaryFiles.map(() => []);
      if (hasHealthExport) {
        setLocalStatus(`Zeiträume von ${primaryFiles.length} Aktivitäten werden ermittelt …`);
        const parsed = [];
        for (let index = 0; index < primaryFiles.length; index += 1) {
          const file = primaryFiles[index];
          setLocalStatus(`Aktivität ${index + 1} von ${primaryFiles.length} wird lokal gelesen …`);
          parsed.push(await parseActivityFile(file, file.name.toLowerCase().endsWith(".fit") ? "garmin_edge" : "gpx"));
        }
        healthSamples = await extractAppleHealthHeartRateForRanges(
          healthExport,
          parsed.map((activity) => ({ startTime: activity.metrics.startTime, elapsedTimeSeconds: activity.metrics.elapsedTimeSeconds })),
          (fraction) => setLocalStatus(`Apple Health wird einmal lokal durchsucht … ${Math.round(fraction * 100)} %`),
        );
      }

      const results: UploadResult[] = [];
      const sportType = formData.get("sportType");
      for (let index = 0; index < primaryFiles.length; index += 1) {
        const file = primaryFiles[index];
        setLocalStatus(`Aktivität ${index + 1} von ${primaryFiles.length} wird gespeichert …`);
        const single = new FormData();
        single.set("activityFile", file);
        if (typeof sportType === "string") single.set("sportType", sportType);
        if (hasDirectFile) single.set("heartRateFile", directHeartRateFile);
        if (hasHealthExport && healthSamples[index]?.length) {
          single.set("heartRateFile", new File([JSON.stringify({ format: "ultrapilot-heart-rate-v1", samples: healthSamples[index] })], `apple-watch-heart-rate-${index + 1}.json`, { type: "application/json" }));
        }
        results.push(await inspectActivityFile(initialState, single));
      }

      const succeeded = results.filter((result) => result.status === "success").length;
      const duplicates = results.filter((result) => result.status === "duplicate").length;
      const failed = results.length - succeeded - duplicates;
      const overallStatus = failed > 0 ? (succeeded > 0 || duplicates > 0 ? "partial" : "error") : duplicates > 0 ? (succeeded > 0 ? "partial" : "duplicate") : "success";
      const messageParts = [
        succeeded ? `${succeeded} ${succeeded === 1 ? "Aktivität" : "Aktivitäten"} importiert` : null,
        duplicates ? `${duplicates} bereits vorhanden (übersprungen)` : null,
        failed ? `${failed} fehlgeschlagen` : null,
      ].filter((part): part is string => part !== null);
      const lastSuccess = [...results].reverse().find((result) => result.status === "success");
      return {
        status: overallStatus,
        message: `${messageParts.join(", ")}.`,
        results,
        metrics: lastSuccess?.metrics,
        heartRateSource: lastSuccess?.heartRateSource,
        importedHeartRateSamples: lastSuccess?.importedHeartRateSamples,
      };
    } catch (error) {
      return { status: "error", message: error instanceof Error ? error.message : "Der Import konnte nicht abgeschlossen werden." };
    } finally {
      setLocalStatus(null);
    }
  };

  const [state, formAction, pending] = useActionState(submitBatch, initialState);
  const metrics = state.metrics;
  return <div className="grid min-w-0 gap-6 lg:grid-cols-[1.2fr_.8fr]">
    <form action={formAction} className="card min-w-0 p-6">
      <div className="flex items-start justify-between gap-4"><div><p className="eyebrow">Schritt 1</p><h2 className="mt-2 text-xl font-black">Aktivitäten auswählen</h2></div><span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-bold text-[var(--accent-dark)]">bis zu {MAX_BATCH_FILES}</span></div>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Wähle zuerst die Sportart und anschließend eine oder mehrere Dateien. Jede Datei wird als eigene Aktivität in deinem persönlichen Konto gespeichert.</p>
      <label className="mt-5 block text-sm font-bold">Sportart<select name="sportType" value={selectedSportType} onChange={(event) => setSelectedSportType(event.target.value === "running" ? "running" : "cycling")} className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-[var(--ink)]"><option value="cycling">Radfahren</option><option value="running">Laufen</option></select></label>
      <FileField id="activityFiles" name="activityFiles" title="GPX- oder FIT-Dateien" hint="Mehrfachauswahl möglich · Herzfrequenz in der GPX-Datei wird automatisch übernommen · jeweils maximal 20 MB" accept=".fit,.gpx,.tcx,application/gpx+xml,application/octet-stream" required multiple />
      <div className="mt-5 rounded-2xl border border-[var(--line)] p-4"><p className="eyebrow">Schritt 2 · optional</p><p className="mt-2 text-sm font-bold">Apple-Watch-Herzfrequenz ergänzen</p><FileField id="appleHealthFile" name="appleHealthFile" title="Apple-Health-Export für alle ausgewählten Fahrten" hint="export.zip oder export.xml · wird nur einmal lokal gelesen · auch 55 MB sind okay" accept=".zip,.xml,application/zip,text/xml,application/xml" /><FileField id="heartRateFile" name="heartRateFile" title="Einzelne Watch-Datei" hint="Nur bei genau einer Hauptdatei · FIT oder GPX · maximal 20 MB" accept=".fit,.gpx,application/gpx+xml,application/octet-stream" /></div>
      <div className="mt-5 rounded-xl bg-[#eef4fb] px-4 py-3 text-xs leading-5 text-[var(--muted)]">Enthält die Hauptdatei bereits Herzfrequenzwerte, werden sie direkt für Kurve, Durchschnitt, Maximum, Zonen und Trainingsbelastung verwendet. Eine zusätzliche Watch-Datei ist dann nicht nötig.</div>
      {localStatus && <p role="status" className="mt-4 text-sm font-bold text-[var(--accent-dark)]">{localStatus}</p>}
      <button type="submit" disabled={pending} className="mt-5 w-full rounded-xl bg-[var(--accent)] px-5 py-3 font-bold text-white transition hover:bg-[var(--accent-dark)] disabled:cursor-wait disabled:opacity-60">{pending ? "Import läuft …" : "Ausgewählte Aktivitäten importieren"}</button>
      {state.status !== "idle" && <div role="status" className={`mt-5 rounded-xl border px-4 py-3 text-sm ${state.status === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : state.status === "partial" || state.status === "duplicate" ? "border-amber-200 bg-amber-50 text-amber-950" : "border-red-200 bg-red-50 text-red-900"}`}><strong>{state.message}</strong></div>}
      {state.results?.length ? <div className="mt-4 space-y-2">{state.results.map((result, index) => <div key={`${result.fileName}-${index}`} className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${result.status === "success" ? "border-emerald-200 bg-emerald-50/60" : result.status === "duplicate" ? "border-amber-200 bg-amber-50/60" : "border-red-200 bg-red-50/60"}`}><div><p className="font-bold">{result.fileName ?? `Datei ${index + 1}`}</p><p className="mt-0.5 text-xs text-[var(--muted)]">{result.message}</p></div>{result.activityId && <Link href={`/activities/${result.activityId}`} className="font-bold text-[var(--accent)]">Öffnen →</Link>}</div>)}</div> : null}
    </form>
    <aside className="card p-6"><p className="eyebrow">Letztes Ergebnis</p>{metrics ? <><dl className="mt-5 grid grid-cols-2 gap-x-5 gap-y-6"><Metric label="Distanz" value={formatDistance(metrics.distanceMeters)} /><Metric label="Bewegungszeit" value={formatDuration(metrics.movingTimeSeconds)} /><Metric label="Verstrichene Zeit" value={formatDuration(metrics.elapsedTimeSeconds)} /><Metric label={selectedSportType === "running" ? "Ø Pace" : "Ø Geschwindigkeit"} value={selectedSportType === "running" ? formatPace(metrics.averageSpeedKmh) : `${metrics.averageSpeedKmh.toLocaleString("de-DE", { maximumFractionDigits: 1 })} km/h`} /><Metric label="Höhengewinn" value={`${Math.round(metrics.elevationGainMeters).toLocaleString("de-DE")} m`} /><Metric label="Ø Herzfrequenz" value={metrics.averageHeartRate === null ? "Keine Daten" : `${Math.round(metrics.averageHeartRate)} bpm`} /></dl><p className="mt-6 rounded-xl bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-900">Herzfrequenzquelle: {state.heartRateSource === "apple_watch" ? `Apple Watch (${state.importedHeartRateSamples} Samples)` : state.heartRateSource === "primary" ? "Hauptdatei" : "keine"}</p></> : <p className="mt-4 text-sm leading-6 text-[var(--muted)]">Nach dem Import erscheint hier eine Zusammenfassung der zuletzt erfolgreich verarbeiteten Aktivität.</p>}</aside>
  </div>;
}

function FileField({ id, name, title, hint, accept, required = false, multiple = false }: { id: string; name: string; title: string; hint: string; accept: string; required?: boolean; multiple?: boolean }) {
  return <label htmlFor={id} className="mt-5 block min-w-0 overflow-hidden rounded-2xl border-2 border-dashed border-[#b9c9df] bg-[#f8fbff] p-5 transition hover:border-[var(--accent)]"><span className="font-semibold">{title}</span><span className="mt-1 block text-xs text-[var(--muted)]">{hint}</span><input id={id} name={name} type="file" accept={accept} required={required} multiple={multiple} className="mt-4 block w-full min-w-0 overflow-hidden text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-blue-700 file:px-4 file:py-2 file:text-white" /></label>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs text-[var(--muted)]">{label}</dt><dd className="mt-1 font-semibold">{value}</dd></div>;
}

"use client";

import { useActionState, useState } from "react";
import { saveAppleHealthRecovery, saveDailyReadiness, type RecoveryImportState } from "@/app/plan/recovery-actions";
import { extractAppleHealthRecovery } from "@/lib/apple-health/browser-extractor";
import type { ReadinessResult } from "@/lib/recovery-readiness";

const initialState: RecoveryImportState = { status: "idle", message: "" };
const fieldClass = "mt-1.5 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5";
const readinessStyle = { green: "bg-emerald-100 text-emerald-950", yellow: "bg-amber-100 text-amber-950", red: "bg-rose-100 text-rose-950", unknown: "bg-slate-100 text-slate-700" } as const;
const readinessLabel = { green: "Grün · planmäßig trainieren", yellow: "Gelb · Belastung reduzieren", red: "Rot · Regeneration priorisieren", unknown: "Noch keine Einschätzung" } as const;

function Rating({ name, label, low, high, value }: { name: string; label: string; low: string; high: string; value: number | null | undefined }) {
  return <label className="text-sm font-bold">{label}<select required name={name} defaultValue={value ?? ""} className={fieldClass}><option value="" disabled>Auswählen</option>{Array.from({ length: 10 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}{index === 0 ? ` · ${low}` : index === 9 ? ` · ${high}` : ""}</option>)}</select></label>;
}

export function RecoveryPanel({ readiness, week, editable }: { readiness: ReadinessResult; week: string; editable: boolean }) {
  const [progress, setProgress] = useState<string | null>(null);
  const importRecovery = async (previous: RecoveryImportState, formData: FormData): Promise<RecoveryImportState> => {
    const file = formData.get("healthExport");
    if (!(file instanceof File) || !file.size) return { status: "error", message: "Bitte wähle export.zip oder export.xml aus." };
    try {
      const metrics = await extractAppleHealthRecovery(file, (fraction) => setProgress(`Apple Health wird lokal gelesen … ${Math.round(fraction * 100)} %`));
      const payload = new FormData();
      payload.set("metricsJson", JSON.stringify(metrics));
      return await saveAppleHealthRecovery(previous, payload);
    } catch (error) {
      return { status: "error", message: error instanceof Error ? error.message : "Apple Health konnte nicht gelesen werden." };
    } finally { setProgress(null); }
  };
  const [state, importAction, pending] = useActionState(importRecovery, initialState);
  const metric = readiness.metric;
  const checkin = readiness.checkin;
  return <section className="card mb-4 overflow-hidden"><div className="grid lg:grid-cols-[.8fr_1.2fr]"><div className={`p-5 ${readinessStyle[readiness.status]}`}><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wider opacity-60">Tagesform · {readiness.date}</p><h2 className="mt-2 text-xl font-black">{readinessLabel[readiness.status]}</h2></div>{readiness.score !== null && <span className="grid size-14 place-items-center rounded-full bg-white/65 text-xl font-black">{readiness.score}</span>}</div><ul className="mt-4 space-y-1.5 text-sm">{readiness.reasons.map((reason) => <li key={reason}>• {reason}</li>)}</ul>{metric && <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-current/10 pt-4 text-sm"><div><dt className="text-xs opacity-60">Schlaf</dt><dd className="font-black">{Math.floor(metric.asleepMinutes / 60)} h {metric.asleepMinutes % 60} min</dd></div><div><dt className="text-xs opacity-60">Ø HF nachts</dt><dd className="font-black">{metric.sleepingAverageHeartRate ? `${metric.sleepingAverageHeartRate} bpm` : "–"}</dd><p className="text-[.65rem] opacity-60">{metric.heartRateSampleCount} Messpunkte</p></div><div><dt className="text-xs opacity-60">HRV (SDNN)</dt><dd className="font-black">{metric.hrvSdnnMs ? `${metric.hrvSdnnMs} ms` : "–"}</dd></div><div><dt className="text-xs opacity-60">Tief / REM</dt><dd className="font-black">{metric.deepMinutes} / {metric.remMinutes} min</dd></div></dl>}</div>
    <div className="p-5"><details open={!checkin}><summary className="cursor-pointer list-none font-black">30-Sekunden-Check-in <span className="float-right text-[var(--accent)]">+</span></summary>{editable ? <form action={saveDailyReadiness} className="mt-4 grid gap-3 sm:grid-cols-2"><input type="hidden" name="date" value={readiness.date}/><input type="hidden" name="week" value={week}/><Rating name="sleepQuality" label="Schlafqualität" low="schlecht" high="sehr gut" value={checkin?.sleepQuality}/><Rating name="generalFatigue" label="Allgemeine Müdigkeit" low="frisch" high="erschöpft" value={checkin?.generalFatigue}/><Rating name="legFatigue" label="Beine" low="frisch" high="sehr schwer" value={checkin?.legFatigue}/><Rating name="motivation" label="Motivation" low="keine" high="sehr hoch" value={checkin?.motivation}/><label className="flex items-center gap-2 text-sm font-bold sm:col-span-2"><input name="painOrIllness" type="checkbox" defaultChecked={checkin?.painOrIllness}/> Beschwerden oder Krankheitssymptome vorhanden</label><label className="text-sm font-bold sm:col-span-2">Notiz<textarea name="notes" maxLength={1000} rows={2} defaultValue={checkin?.notes} className={fieldClass}/></label><button className="rounded-xl bg-[var(--accent)] px-4 py-2.5 font-bold text-white sm:col-span-2">Tagesform speichern</button></form> : <p className="mt-3 text-sm text-[var(--muted)]">Im Demo-Modus wird nichts gespeichert.</p>}</details>
    <details className="mt-5 border-t border-[var(--line)] pt-5"><summary className="cursor-pointer list-none font-black">Apple-Health-Schlaf importieren <span className="float-right text-[var(--accent)]">+</span></summary><p className="mt-2 text-xs leading-5 text-[var(--muted)]">Die Exportdatei wird lokal durchsucht. Gespeichert werden nur Zusammenfassungen der letzten 120 Tage, nicht die 55-MB-Rohdatei.</p><form action={importAction} className="mt-3"><input name="healthExport" type="file" required accept=".zip,.xml,application/zip,text/xml,application/xml" className="max-w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-800 file:px-3 file:py-2 file:text-white"/><button disabled={pending || !editable} className="mt-3 w-full rounded-xl border border-[var(--line)] bg-white px-4 py-2.5 text-sm font-bold disabled:opacity-50">{pending ? "Import läuft …" : "Schlafdaten aktualisieren"}</button></form>{progress && <p className="mt-2 text-xs font-bold text-[var(--accent)]">{progress}</p>}{state.status !== "idle" && <p className={`mt-3 rounded-xl px-3 py-2 text-sm ${state.status === "success" ? "bg-emerald-100 text-emerald-950" : "bg-red-100 text-red-950"}`}>{state.message}</p>}</details></div></div></section>;
}

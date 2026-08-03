import Link from "next/link";
import { DashboardCharts } from "@/components/dashboard-charts";
import { PageHeading } from "@/components/page-heading";
import { StatCard } from "@/components/stat-card";
import { ZoneDistribution } from "@/components/zone-distribution";
import { RecoveryCharts } from "@/components/recovery-charts";
import { TrainingLoadCharts } from "@/components/training-load-charts";
import { getDashboardSummary } from "@/lib/dashboard-data";
import { formatDistance, formatDuration } from "@/lib/format";
import { getRecoveryData } from "@/lib/recovery";
import { buildReadinessRange } from "@/lib/recovery-readiness";
import { buildRecoveryTrend, summarizeRecovery } from "@/lib/recovery-analysis";
import { getTrainingLoadSummary } from "@/lib/training-load-data";
import type { LoadLevel, LoadMethod } from "@/lib/training-load";

export const metadata = { title: "Fortschritt" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ days?: string }> };
function optional(value: number | null, unit: string, digits = 1): string { return value === null ? "–" : `${value.toLocaleString("de-DE", { maximumFractionDigits: digits })} ${unit}`; }

function dateRange(count: number): string[] {
  const todayKey = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const today = new Date(`${todayKey}T12:00:00Z`);
  return Array.from({ length: count }, (_, index) => { const date = new Date(today); date.setUTCDate(date.getUTCDate() - count + index + 1); return date.toISOString().slice(0, 10); });
}

function sleepDuration(hours: number | null): string {
  if (hours === null) return "–";
  const minutes = Math.round(hours * 60);
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

const methodLabels: Record<LoadMethod, string> = { power: "Power-TSS", heart_rate: "HF-Zonen", rpe: "sRPE", unavailable: "Keine Berechnung" };
const levelLabels: Record<LoadLevel, string> = { light: "leicht", moderate: "mittel", high: "hoch", unavailable: "offen" };
const levelStyles: Record<LoadLevel, string> = { light: "bg-emerald-100 text-emerald-900", moderate: "bg-amber-100 text-amber-950", high: "bg-rose-100 text-rose-950", unavailable: "bg-slate-100 text-slate-700" };

export default async function ProgressPage({ searchParams }: Props) {
  const query = await searchParams;
  const days: 7 | 28 | 90 = query.days === "7" ? 7 : query.days === "90" ? 90 : 28;
  const range = dateRange(days);
  const [summary, recovery, loadSummary] = await Promise.all([getDashboardSummary(days), getRecoveryData(range[0], range.at(-1)!), getTrainingLoadSummary(days)]);
  const readiness = buildReadinessRange(range, recovery.metrics, recovery.checkins);
  const recoveryTrend = buildRecoveryTrend(range, recovery.metrics, readiness);
  const recoverySummary = summarizeRecovery(recoveryTrend);
  return <>
    <PageHeading eyebrow="Deine Entwicklung" title="Fortschritt, der nachvollziehbar bleibt." description="Training, Schlaf, Erholung und Versorgung – ausschließlich aus deinen gespeicherten Messwerten berechnet." />
    <nav aria-label="Zeitraum" className="mb-6 flex w-fit rounded-xl border border-[var(--line)] bg-white/70 p-1">{[7, 28, 90].map((period) => <Link key={period} href={`/progress?days=${period}`} className={`rounded-lg px-4 py-2 text-sm font-bold ${days === period ? "bg-[var(--ink)] text-white" : "text-[var(--muted)] hover:bg-white"}`}>{period} Tage</Link>)}</nav>

    <section><div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">Erholung</p><h2 className="mt-2 text-2xl font-black">Deine letzten Nächte</h2></div><p className="text-xs text-[var(--muted)]">{recoverySummary.trackedNights} von {days} Nächten · HF in {recoverySummary.nightsWithHeartRate} Nächten</p></div>
      {recoverySummary.trackedNights ? <><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Ø Schlaf" value={sleepDuration(recoverySummary.averageSleepHours)} detail={`${recoverySummary.trackedNights} gemessene Nächte`} /><StatCard label="Ø HF nachts" value={optional(recoverySummary.averageSleepingHeartRate, "bpm", 1)} detail={`${recoverySummary.nightsWithHeartRate} Nächte mit HF`} /><StatCard label="Ø HRV" value={optional(recoverySummary.averageHrvSdnnMs, "ms", 1)} detail="SDNN · nur vorhandene Werte" /><StatCard label="Readiness" value={`${recoverySummary.greenDays} / ${recoverySummary.yellowDays} / ${recoverySummary.redDays}`} detail="grün / gelb / rot" /></div><RecoveryCharts trend={recoveryTrend}/><p className="mt-3 text-xs leading-5 text-[var(--muted)]">Nächtliche HF und HRV werden nur im persönlichen Verlauf gezeigt. Fehlende Watch-Samples werden weder ergänzt noch durch Bevölkerungswerte ersetzt.</p></> : <div className="card p-8 text-center"><h3 className="text-lg font-black">Noch keine Schlafnächte importiert</h3><p className="mt-2 text-sm text-[var(--muted)]">Importiere deinen Apple-Health-Export im aktuellen Wochenplan. Danach erscheinen Schlafphasen, nächtliche HF, HRV und Readiness hier automatisch.</p><Link href="/plan" className="primary-button mt-5">Zum Schlafimport</Link></div>}
    </section>

    <div className="mb-4 mt-10"><p className="eyebrow">Training</p><h2 className="mt-2 text-2xl font-black">Umfang und Belastung</h2></div>
    {summary.activityCount === 0 ? <section className="card p-10 text-center"><h2 className="text-xl font-black">Keine Aktivitäten in diesem Zeitraum</h2><p className="mt-2 text-sm text-[var(--muted)]">Wähle einen längeren Zeitraum oder importiere eine Aktivität.</p></section> : <>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Aktivitäten" value={String(summary.activityCount)} detail={`letzte ${days} Tage`} /><StatCard label="Distanz" value={formatDistance(summary.distanceMeters)} detail="gesamte Strecke" /><StatCard label="Bewegungszeit" value={formatDuration(summary.movingTimeSeconds)} detail="reine Trainingszeit" /><StatCard label="Höhenmeter" value={`${Math.round(summary.elevationGainMeters).toLocaleString("de-DE")} m`} detail="positiver Anstieg" /></section>
      <section className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Belastung 7 Tage" value={`${loadSummary.sevenDayLoad.toLocaleString("de-DE", { maximumFractionDigits: 0 })} UPL`} detail="rollierende Summe" /><StatCard label="Ø Wochenlast" value={`${loadSummary.fourWeekWeeklyAverage.toLocaleString("de-DE", { maximumFractionDigits: 0 })} UPL`} detail="letzte 28 Tage ÷ 4" /><StatCard label="Aktuell vs. Verlauf" value={loadSummary.comparisonPercent === null ? "–" : `${loadSummary.comparisonPercent > 0 ? "+" : ""}${loadSummary.comparisonPercent} %`} detail="7 Tage gegen Wochenschnitt" /><StatCard label="Datenabdeckung" value={`${loadSummary.measuredActivities} / ${loadSummary.totalActivities}`} detail="Aktivitäten mit Lastwert" /></section>
      <TrainingLoadCharts trend={loadSummary.trend}/>
      <section className="card mt-6 p-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-black">Belastung je Aktivität</h2><p className="mt-1 text-sm text-[var(--muted)]">Priorität: Power-TSS → HF-Zonen bei mindestens 50 % Abdeckung → sRPE. Nach fünf messbaren Einheiten erfolgt leicht/mittel/hoch relativ zu deinem persönlichen 28-Tage-Verlauf.</p></div><p className="text-xs text-[var(--muted)]">Power {loadSummary.methods.power} · HF {loadSummary.methods.heart_rate} · RPE {loadSummary.methods.rpe}</p></div><div className="mt-5 divide-y divide-[var(--line)]">{loadSummary.activities.slice(0, 8).map((activity) => <Link key={activity.activityId} href={`/activities/${activity.activityId}`} className="grid gap-2 py-3 transition hover:bg-blue-50/70 sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-5"><div><p className="font-bold">{activity.title}</p><p className="mt-1 text-xs text-[var(--muted)]">{new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(activity.activityDate))} · {methodLabels[activity.method]} · {activity.detail}</p></div><span className={`w-fit rounded-full px-2.5 py-1 text-xs font-bold ${levelStyles[activity.level]}`}>{levelLabels[activity.level]}</span><strong className="min-w-20 text-right tabular-nums">{activity.points === null ? "–" : `${activity.points.toLocaleString("de-DE", { maximumFractionDigits: 1 })} UPL`}</strong></Link>)}</div></section>
      <DashboardCharts trend={summary.trend} />
      <section className="mt-6 grid gap-6 xl:grid-cols-2"><article className="card p-6"><p className="eyebrow">Belastung</p><dl className="mt-5 grid grid-cols-2 gap-5 sm:grid-cols-4"><div><dt className="text-xs text-[var(--muted)]">Ø Herzfrequenz</dt><dd className="mt-1 text-xl font-black">{optional(summary.averageHeartRate, "bpm", 0)}</dd></div><div><dt className="text-xs text-[var(--muted)]">Ø Leistung</dt><dd className="mt-1 text-xl font-black">{optional(summary.averagePower, "W", 0)}</dd></div><div><dt className="text-xs text-[var(--muted)]">TSS</dt><dd className="mt-1 text-xl font-black">{optional(summary.totalTss, "", 0)}</dd></div><div><dt className="text-xs text-[var(--muted)]">Ø RPE</dt><dd className="mt-1 text-xl font-black">{optional(summary.averageRpe, "/10")}</dd></div></dl></article><article className="card p-6"><p className="eyebrow">Versorgung</p><dl className="mt-5 grid grid-cols-3 gap-4"><div><dt className="text-xs text-[var(--muted)]">Carbs</dt><dd className="mt-1 text-xl font-black">{optional(summary.carbohydratesPerHour, "g/h")}</dd></div><div><dt className="text-xs text-[var(--muted)]">Flüssigkeit</dt><dd className="mt-1 text-xl font-black">{optional(summary.fluidPerHour, "ml/h", 0)}</dd></div><div><dt className="text-xs text-[var(--muted)]">Natrium</dt><dd className="mt-1 text-xl font-black">{optional(summary.sodiumPerHour, "mg/h", 0)}</dd></div></dl></article></section>
      {(summary.heartRateZones || summary.powerZones) && <section className="card mt-6 p-6"><h2 className="text-xl font-black">Zeit in Trainingszonen</h2><p className="mt-1 text-sm text-[var(--muted)]">Aus vorhandenen Rohsamples; Messlücken über 10 Sekunden zählen nicht.</p><div className="mt-6 grid gap-8 xl:grid-cols-2">{summary.heartRateZones && <ZoneDistribution title="Herzfrequenz" unit="bpm" zones={summary.heartRateZones} />}{summary.powerZones && <ZoneDistribution title="Leistung" unit="W" zones={summary.powerZones} />}</div></section>}
    </>}
  </>;
}

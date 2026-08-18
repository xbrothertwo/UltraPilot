import Link from "next/link";
import { DashboardCharts } from "@/components/dashboard-charts";
import { PageHeading } from "@/components/page-heading";
import { RecoveryCharts } from "@/components/recovery-charts";
import { StatCard } from "@/components/stat-card";
import { TrainingLoadCharts } from "@/components/training-load-charts";
import { ZoneDistribution } from "@/components/zone-distribution";
import { getActivities } from "@/lib/activities";
import { berlinDateKey } from "@/lib/calendar/berlin";
import { getDashboardSummary } from "@/lib/dashboard-data";
import { formatDistance, formatDuration, formatPace } from "@/lib/format";
import { getGymHistory } from "@/lib/gym/data";
import { reconcilePlannedWorkouts } from "@/lib/planning/reconciliation";
import { getPlannedWorkouts } from "@/lib/planning/workouts";
import { buildProgressExperience } from "@/lib/progress-experience";
import { getRecoveryData } from "@/lib/recovery";
import { buildRecoveryTrend, summarizeRecovery } from "@/lib/recovery-analysis";
import { buildReadinessRange } from "@/lib/recovery-readiness";
import type { LoadLevel, LoadMethod } from "@/lib/training-load";
import { getTrainingLoadSummary } from "@/lib/training-load-data";

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

const methodLabels: Record<LoadMethod, string> = { power: "Power-TSS", heart_rate: "HF-Zonen", rpe: "sRPE", unavailable: "Noch nicht berechenbar" };
const levelLabels: Record<LoadLevel, string> = { light: "leicht", moderate: "mittel", high: "hoch", unavailable: "offen" };
const levelStyles: Record<LoadLevel, string> = { light: "bg-emerald-100 text-emerald-900", moderate: "bg-amber-100 text-amber-950", high: "bg-rose-100 text-rose-950", unavailable: "bg-slate-100 text-slate-700" };

export default async function ProgressPage({ searchParams }: Props) {
  const query = await searchParams;
  const days: 7 | 28 | 90 = query.days === "7" ? 7 : query.days === "90" ? 90 : 28;
  const range = dateRange(days);
  const [summary, recovery, loadSummary, gymHistory, allActivities] = await Promise.all([getDashboardSummary(days), getRecoveryData(range[0], range.at(-1)!), getTrainingLoadSummary(days), getGymHistory(100), getActivities()]);
  const readiness = buildReadinessRange(range, recovery.metrics, recovery.checkins);
  const recoveryTrend = buildRecoveryTrend(range, recovery.metrics, readiness);
  const recoverySummary = summarizeRecovery(recoveryTrend);
  const periodActivities = allActivities.filter((activity) => {
    const activityDate = berlinDateKey(activity.activityDate);
    return activity.sportType === summary.primarySport && activityDate >= range[0] && activityDate <= range.at(-1)!;
  });
  const workouts = await getPlannedWorkouts(range[0], range.at(-1)!);
  const matchedPlanCount = reconcilePlannedWorkouts(workouts, periodActivities).filter((item) => item.activity).length;
  const hasNutrition = summary.carbohydratesPerHour !== null || summary.fluidPerHour !== null || summary.sodiumPerHour !== null;
  const experience = buildProgressExperience({ primarySport: summary.primarySport, activityCount: summary.activityCount, measuredLoadActivities: loadSummary.measuredActivities, averageHeartRate: summary.averageHeartRate, trackedNights: recoverySummary.trackedNights, hasNutrition, gymSessionCount: gymHistory.length, matchedPlanCount });

  return <>
    <PageHeading eyebrow="Deine Entwicklung" title="Wo du stehst. Was sich entwickelt. Was noch fehlt." description="UltraPilot trennt bereits belastbare Signale von Trends, für die deine persönliche Datenbasis noch wächst." />
    <nav aria-label="Zeitraum" className="mb-6 flex w-fit rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] p-1">{[7, 28, 90].map((period) => <Link key={period} href={`/progress?days=${period}`} className={`rounded-lg px-4 py-2 text-sm font-bold outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${days === period ? "bg-[var(--ink)] text-[var(--surface)]" : "text-[var(--muted)] hover:bg-[var(--surface-raised)]"}`}>{period} Tage</Link>)}</nav>

    <section className="card overflow-hidden" aria-labelledby="progress-baseline-title">
      <div className="bg-[var(--accent-soft)] p-6 sm:p-8"><p className="eyebrow">Aktueller Stand</p><h2 id="progress-baseline-title" className="mt-2 text-2xl font-black sm:text-3xl">{experience.headline}</h2><p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">{experience.summary}</p></div>
      <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-8"><SignalList title="Schon verfügbar" values={experience.availableSignals} empty="Nach deinem ersten Training erscheinen hier Umfang und Zeit." tone="ready" /><SignalList title="Im Aufbau" values={experience.buildingSignals} empty="Deine wichtigsten Trends sind bereits verfügbar." tone="building" /></div>
    </section>

    {summary.activityCount > 0 ? <>
      <section className="mt-8"><SectionHeading eyebrow="A · Aktueller Stand" title={summary.primarySport === "running" ? "Dein Laufumfang" : "Dein Radumfang"} description={`Echte Werte aus den letzten ${days} Tagen.`} /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><StatCard label="Aktivitäten" value={String(summary.activityCount)} detail={summary.primarySport === "running" ? "Läufe" : "Radfahrten"} /><StatCard label="Distanz" value={formatDistance(summary.distanceMeters)} detail="gesamter Umfang" /><StatCard label={summary.primarySport === "running" ? "Ø Pace" : "Ø Geschwindigkeit"} value={summary.averageSpeedKmh === null ? "–" : summary.primarySport === "running" ? formatPace(summary.averageSpeedKmh) : `${summary.averageSpeedKmh.toLocaleString("de-DE", { maximumFractionDigits: 1 })} km/h`} detail="gewichtet nach Bewegungszeit" /><StatCard label="Trainingszeit" value={formatDuration(summary.movingTimeSeconds)} detail="reine Bewegungszeit" /><StatCard label="Plan-Zuordnungen" value={String(matchedPlanCount)} detail="erfüllte oder abweichende Einheiten" /></div></section>

      <section className="mt-10"><SectionHeading eyebrow="B · Entwicklung" title="Umfang und Vergleichbarkeit" description="Einzelwerte werden nicht als Trend verkauft." />{summary.activityCount > 1 ? <DashboardCharts trend={summary.trend} showNutrition={experience.showNutritionModule} /> : <div className="card p-6"><h3 className="font-black">Der erste Referenzpunkt steht.</h3><p className="mt-2 text-sm leading-6 text-[var(--muted)]">Mit weiteren vergleichbaren {summary.primarySport === "running" ? "Läufen" : "Fahrten"} wird hier aus einzelnen Messwerten eine nachvollziehbare Entwicklung.</p></div>}</section>

      <section className="mt-10"><SectionHeading eyebrow="C · Belastung" title="Persönliche Trainingsbelastung" description="Nur aus Power, persönlichen HF-Zonen oder dokumentiertem RPE – nie geschätzt." /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Belastung berechenbar" value={`${loadSummary.measuredActivities} von ${loadSummary.totalActivities}`} detail="Aktivitäten mit belastbarer Grundlage" />{loadSummary.measuredActivities > 0 && <><StatCard label="Belastung 7 Tage" value={`${loadSummary.sevenDayLoad.toLocaleString("de-DE", { maximumFractionDigits: 0 })} UPL`} detail="rollierende Summe" /><StatCard label="Ø Wochenlast" value={`${loadSummary.fourWeekWeeklyAverage.toLocaleString("de-DE", { maximumFractionDigits: 0 })} UPL`} detail="letzte 28 Tage ÷ 4" /><StatCard label="Aktuell vs. Verlauf" value={loadSummary.comparisonPercent === null ? "–" : `${loadSummary.comparisonPercent > 0 ? "+" : ""}${loadSummary.comparisonPercent} %`} detail="7 Tage gegen Wochenschnitt" /></>}</div>{loadSummary.measuredActivities > 0 ? <><TrainingLoadCharts trend={loadSummary.trend} /><LoadActivityList activities={loadSummary.activities} /></> : <LoadEmptyState reason={experience.loadState} firstActivityId={periodActivities[0]?.id ?? null} />}</section>

      {(summary.heartRateZones || summary.powerZones) && <section className="card mt-6 p-6"><h2 className="text-xl font-black">Zeit in Trainingszonen</h2><p className="mt-1 text-sm text-[var(--muted)]">Aus vorhandenen Rohsamples; Messlücken über 10 Sekunden zählen nicht.</p><div className="mt-6 grid gap-8 xl:grid-cols-2">{summary.heartRateZones && <ZoneDistribution title="Herzfrequenz" unit="bpm" zones={summary.heartRateZones} />}{summary.powerZones && <ZoneDistribution title="Leistung" unit="W" zones={summary.powerZones} />}</div></section>}
    </> : experience.state === "empty" ? <section className="card mt-8 p-8 text-center"><h2 className="text-xl font-black">Noch kein Training in diesem Zeitraum</h2><p className="mt-2 text-sm text-[var(--muted)]">Importiere eine Aktivität oder wähle einen längeren Zeitraum. Leere Daten werden nicht als Null-Trend dargestellt.</p><Link href="/activities/upload" className="primary-button mt-5">Aktivität importieren</Link></section> : null}

    <section className="mt-10"><SectionHeading eyebrow="D · Einflussfaktoren" title="Erholung, Verpflegung und Gym" description="Optionale Signale werden erst groß, wenn du sie tatsächlich nutzt." />
      {experience.showRecoveryModule ? <div className="card p-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><h3 className="text-xl font-black">Schlaf & Erholung</h3><p className="mt-1 text-sm text-[var(--muted)]">{recoverySummary.trackedNights} von {days} Nächten erfasst</p></div><p className="text-xs text-[var(--muted)]">HF in {recoverySummary.nightsWithHeartRate} Nächten</p></div><div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Ø Schlaf" value={sleepDuration(recoverySummary.averageSleepHours)} detail={`${recoverySummary.trackedNights} gemessene Nächte`} /><StatCard label="Ø HF nachts" value={optional(recoverySummary.averageSleepingHeartRate, "bpm", 1)} detail="nur vorhandene Werte" /><StatCard label="Ø HRV" value={optional(recoverySummary.averageHrvSdnnMs, "ms", 1)} detail="SDNN" /><StatCard label="Readiness" value={`${recoverySummary.greenDays} / ${recoverySummary.yellowDays} / ${recoverySummary.redDays}`} detail="grün / gelb / rot" /></div><RecoveryCharts trend={recoveryTrend} /></div> : <OptionalModule title="Schlaf & Erholung verbinden" description="Optional: Apple-Health-Daten helfen später, Erholung neben deiner Belastung einzuordnen." href="/plan" action="Schlafimport öffnen" />}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">{experience.showNutritionModule ? <article className="card p-6"><p className="eyebrow">Verpflegung</p><h3 className="mt-2 text-xl font-black">Dokumentierte Versorgung</h3><dl className="mt-5 grid grid-cols-3 gap-4"><SmallMetric label="Carbs" value={optional(summary.carbohydratesPerHour, "g/h")} /><SmallMetric label="Flüssigkeit" value={optional(summary.fluidPerHour, "ml/h", 0)} /><SmallMetric label="Natrium" value={optional(summary.sodiumPerHour, "mg/h", 0)} /></dl></article> : <OptionalModule title="Verpflegung dokumentieren" description="Optional: Für lange Fahrten kannst du Produkte und Flaschen direkt an Aktivitäten protokollieren." href="/nutrition" action="Verpflegung öffnen" />}
      <article className="card p-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">Gym-Fortschritt</p><h3 className="mt-2 text-xl font-black">Krafttraining im selben Verlauf</h3></div><Link href="/gym/history" className="secondary-button">Gym-History</Link></div>{gymHistory.length ? <dl className="mt-5 grid grid-cols-3 gap-3"><SmallMetric label="Sessions" value={String(gymHistory.length)} /><SmallMetric label="Arbeitssätze" value={String(gymHistory.reduce((sum, session) => sum + session.workingSets, 0))} /><SmallMetric label="Übungen" value={String(gymHistory.reduce((sum, session) => sum + session.exerciseCount, 0))} /></dl> : <p className="mt-4 text-sm leading-6 text-[var(--muted)]">Optional: Nach deiner ersten abgeschlossenen Gym-Session erscheinen hier Sessions, Arbeitssätze und deine bestehende PR-Analyse.</p>}</article></div>
    </section>
  </>;
}

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) { return <div className="mb-4"><p className="eyebrow">{eyebrow}</p><h2 className="mt-2 text-2xl font-black">{title}</h2><p className="mt-1 text-sm text-[var(--muted)]">{description}</p></div>; }
function SignalList({ title, values, empty, tone }: { title: string; values: string[]; empty: string; tone: "ready" | "building" }) { return <div><p className="text-xs font-black uppercase tracking-wider text-[var(--muted)]">{title}</p>{values.length ? <ul className="mt-3 space-y-2">{values.map((value) => <li key={value} className="flex items-center gap-2 text-sm font-bold"><span aria-hidden className={`grid size-5 place-items-center rounded-full text-xs ${tone === "ready" ? "bg-emerald-100 text-emerald-800" : "bg-[var(--accent-soft)] text-[var(--accent-dark)]"}`}>{tone === "ready" ? "✓" : "…"}</span>{value}</li>)}</ul> : <p className="mt-3 text-sm text-[var(--muted)]">{empty}</p>}</div>; }
function OptionalModule({ title, description, href, action }: { title: string; description: string; href: string; action: string }) { return <article className="card p-6"><span className="rounded-full bg-[var(--surface-raised)] px-3 py-1 text-xs font-bold text-[var(--muted)]">Optional</span><h3 className="mt-4 text-xl font-black">{title}</h3><p className="mt-2 text-sm leading-6 text-[var(--muted)]">{description}</p><Link href={href} className="mt-4 inline-flex text-sm font-black text-[var(--accent)]">{action} →</Link></article>; }
function SmallMetric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-[var(--surface-raised)] p-3"><dt className="text-xs font-bold text-[var(--muted)]">{label}</dt><dd className="mt-1 text-xl font-black">{value}</dd></div>; }
function LoadEmptyState({ reason, firstActivityId }: { reason: "available" | "needs_zones" | "needs_input"; firstActivityId: string | null }) { return <div className="card mt-4 p-6 sm:p-8"><h3 className="text-xl font-black">Noch kein Belastungstrend.</h3><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">{reason === "needs_zones" ? "Herzfrequenzdaten wurden erkannt. Für persönliche Trainingszonen und eine Belastungsberechnung fehlen noch deine Referenzwerte." : "Dein Training wurde gespeichert. Für eine belastbare Bewertung braucht UltraPilot persönliche HF-Zonen, eine Power-Basis oder dein dokumentiertes Belastungsempfinden (RPE)."}</p><div className="mt-5 flex flex-wrap gap-2">{reason === "needs_zones" && <Link href="/settings" className="primary-button">Herzfrequenz-Zonen einrichten</Link>}{firstActivityId && <Link href={`/activities/${firstActivityId}`} className="secondary-button">Training ergänzen</Link>}</div></div>; }
function LoadActivityList({ activities }: { activities: Awaited<ReturnType<typeof getTrainingLoadSummary>>["activities"] }) { return <section className="card mt-6 p-6"><h3 className="text-xl font-black">Belastung je Aktivität</h3><p className="mt-1 text-sm text-[var(--muted)]">Power-TSS → persönliche HF-Zonen → sRPE. Die verwendete Grundlage bleibt sichtbar.</p><div className="mt-5 divide-y divide-[var(--line)]">{activities.slice(0, 8).map((activity) => <Link key={activity.activityId} href={`/activities/${activity.activityId}`} className="grid gap-2 py-3 transition hover:bg-[var(--surface-raised)] sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-5"><div><p className="font-bold">{activity.title}</p><p className="mt-1 text-xs text-[var(--muted)]">{new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(activity.activityDate))} · {methodLabels[activity.method]} · {activity.detail}</p></div><span className={`w-fit rounded-full px-2.5 py-1 text-xs font-bold ${levelStyles[activity.level]}`}>{levelLabels[activity.level]}</span><strong className="min-w-20 text-right tabular-nums">{activity.points === null ? "–" : `${activity.points.toLocaleString("de-DE", { maximumFractionDigits: 1 })} UPL`}</strong></Link>)}</div></section>; }

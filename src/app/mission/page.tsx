import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { getActivities } from "@/lib/activities";
import { getMissionEvidence } from "@/lib/mission-control-data";
import { buildMissionControl, type CapabilityStatus } from "@/lib/mission-control";
import { getPlanningData } from "@/lib/planning/data";
import { getRecoveryData } from "@/lib/recovery";
import { buildReadinessRange } from "@/lib/recovery-readiness";

export const metadata = { title: "RAG Mission Control" };
export const dynamic = "force-dynamic";

function dateKey(value: Date): string { return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(value); }
function addDays(key: string, count: number): string { const date = new Date(`${key}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + count); return date.toISOString().slice(0, 10); }

const statusLabels: Record<CapabilityStatus, string> = { starting: "Start", building: "Im Aufbau", solid: "Solide", ready: "Bereit", untracked: "Noch nicht messbar" };
const statusStyles: Record<CapabilityStatus, string> = { starting: "bg-slate-100 text-slate-700", building: "bg-amber-100 text-amber-950", solid: "bg-sky-100 text-sky-950", ready: "bg-emerald-100 text-emerald-950", untracked: "bg-violet-100 text-violet-950" };

export default async function MissionPage() {
  const today = dateKey(new Date());
  const recoveryFrom = addDays(today, -27);
  const [activities, planning, recovery] = await Promise.all([getActivities(), getPlanningData(), getRecoveryData(recoveryFrom, today)]);
  const evidence = await getMissionEvidence(activities);
  const recoveryDays = Array.from({ length: 28 }, (_, index) => addDays(recoveryFrom, index));
  const readiness = buildReadinessRange(recoveryDays, recovery.metrics, recovery.checkins);
  const trackedNights = recovery.metrics.filter((metric) => metric.date >= recoveryFrom && metric.date <= today && metric.asleepMinutes > 0).length;
  const stableNights = readiness.filter((item) => item.metric?.asleepMinutes && item.status !== "red").length;
  const mission = buildMissionControl({ activities, ...evidence, weeklyGoalKm: planning.profile.weeklyDistanceGoalKm, targetYear: planning.profile.targetYear, today, recoveryTrackedNights: trackedNights, recoveryStableNights: stableNights });
  const next = mission.nextMilestone;

  return <>
    <PageHeading eyebrow="Road to RAG" title="Mission Control 2028" description="Dein nachvollziehbarer Weg zur unterstützten 1.100-km-Nord–Süd-Strecke – aus echten Fahrten, nicht aus motivierenden Fantasiezahlen." action={<Link href="/plan" className="primary-button">Aktuellen Block planen</Link>} />

    <section className="relative overflow-hidden rounded-[1.6rem] bg-gradient-to-br from-[#07162d] via-[#123a72] to-[#155e9a] p-6 text-white shadow-[0_24px_60px_rgba(9,26,51,.2)] sm:rounded-[2rem] sm:p-9">
      <div className="absolute -right-28 -top-32 size-96 rounded-full border-[60px] border-cyan-300/10"/>
      <div className="relative grid gap-8 xl:grid-cols-[1.25fr_.75fr] xl:items-end"><div><p className="text-xs font-black uppercase tracking-[.2em] text-cyan-200">Supported · Nord nach Süd · Zielkorridor {mission.targetYear}</p><h2 className="mt-3 text-4xl font-black tracking-[-.05em] sm:text-6xl">1.100 km.<br/><span className="text-blue-200">Schritt für Schritt belastbar.</span></h2><p className="mt-5 max-w-2xl leading-7 text-blue-50/65">Mission Control misst einzelne Fähigkeiten getrennt. Ein grüner Balken bedeutet nur: Der konkrete, angezeigte Nachweis wurde erbracht – keine Garantie für Rennbereitschaft.</p></div><div className="rounded-2xl border border-white/10 bg-white/[.08] p-5 backdrop-blur-sm"><p className="text-xs font-black uppercase tracking-wider text-cyan-100/60">Nächster Meilenstein</p><p className="mt-2 text-2xl font-black">{next?.title ?? "Roadmap vollständig"}</p>{next && <><p className="mt-2 text-sm text-blue-50/60">{next.evidence} · Horizont {next.horizon}</p><div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#67e8f9]" style={{ width: `${next.progressPercent}%` }}/></div><p className="mt-2 text-right text-xs font-bold text-cyan-200">{next.progressPercent} % des messbaren Hauptkriteriums</p></>}</div></div>
    </section>

    <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Fact label="Längste Fahrt" value={`${mission.longestRideKm} km`} detail="gespeicherter Bestwert"/><Fact label="Bestes Back-to-back" value={`${mission.bestBackToBackKm} km`} detail="zwei Tage · jeweils mindestens 40 km"/><Fact label="Stabile Wochen" value={`${mission.consistentWeeks} / 4`} detail={`mindestens 80 % von ${planning.profile.weeklyDistanceGoalKm} km`}/><Fact label="Verpflegungsproben" value={String(mission.qualifyingFuelingRides)} detail="über 3 h · mindestens 40 g KH/h"/></section>

    {next && <section className="card mt-6 p-6 sm:p-8"><div className="grid gap-7 xl:grid-cols-[.8fr_1.2fr]"><div><p className="eyebrow">Deine nächste Mission</p><h2 className="mt-2 text-3xl font-black tracking-tight">{next.title}</h2><p className="mt-3 leading-7 text-[var(--muted)]">{next.purpose}</p><p className="mt-4 text-sm font-bold text-[var(--accent-dark)]">{next.evidence}</p></div><div><p className="text-xs font-black uppercase tracking-wider text-[var(--muted)]">Voraussetzungen</p><div className="mt-3 space-y-2">{next.requirements.map((requirement) => <div key={requirement.label} className={`flex items-center gap-3 rounded-xl px-4 py-3 ${requirement.met ? "bg-emerald-50 text-emerald-950" : "bg-[#edf3fb] text-[var(--ink)]"}`}><span className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-black ${requirement.met ? "bg-emerald-200" : "bg-white"}`}>{requirement.met ? "✓" : "○"}</span><span className="text-sm font-bold">{requirement.label}</span></div>)}</div></div></div></section>}

    <section className="mt-10"><div><p className="eyebrow">Fähigkeitsprofil</p><h2 className="mt-2 text-3xl font-black tracking-tight">Was bereits trägt – und was noch fehlt</h2></div><div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">{mission.capabilities.map((capability) => <article key={capability.key} className="card flex flex-col p-5"><div className="flex items-start justify-between gap-3"><h3 className="font-black">{capability.label}</h3><span className={`shrink-0 rounded-full px-2.5 py-1 text-[.65rem] font-black ${statusStyles[capability.status]}`}>{statusLabels[capability.status]}</span></div>{capability.progressPercent !== null ? <><p className="mt-5 text-3xl font-black">{capability.progressPercent}<span className="text-base text-[var(--muted)]"> %</span></p><div className="mt-2 h-2 overflow-hidden rounded-full bg-[#e3ebf6]"><div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${capability.progressPercent}%` }}/></div></> : <p className="mt-5 text-2xl font-black text-violet-700">Tracking fehlt</p>}<p className="mt-4 text-xs leading-5 text-[var(--muted)]">{capability.evidence}</p><p className="mt-auto pt-4 text-xs font-bold text-[var(--accent-dark)]">Nächster Nachweis: {capability.nextTarget}</p></article>)}</div></section>

    <section className="mt-10"><div><p className="eyebrow">Roadmap</p><h2 className="mt-2 text-3xl font-black tracking-tight">Von Konstanz zur Hauptprobe</h2></div><div className="card mt-5 overflow-hidden"><div className="divide-y divide-[var(--line)]">{mission.milestones.map((milestone, index) => <article key={milestone.key} className="grid gap-4 p-5 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:p-6"><span className={`grid size-11 place-items-center rounded-full text-sm font-black ${milestone.achieved ? "bg-[var(--accent)] text-white" : milestone.key === next?.key ? "bg-[#f59e67] text-[#3f1f2a]" : "bg-[#edf3fb] text-[var(--muted)]"}`}>{milestone.achieved ? "✓" : index + 1}</span><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-black">{milestone.title}</h3><span className="rounded-full bg-[#edf3fb] px-2.5 py-1 text-[.65rem] font-bold text-[var(--muted)]">{milestone.horizon}</span></div><p className="mt-1 text-sm text-[var(--muted)]">{milestone.purpose}</p></div><div className="sm:text-right"><p className="font-black">{milestone.evidence}</p><p className={`mt-1 text-xs font-bold ${milestone.achieved ? "text-emerald-700" : "text-[var(--muted)]"}`}>{milestone.achieved ? "Nachweis erbracht" : `${milestone.progressPercent} %`}</p></div></article>)}</div></div><p className="mt-3 text-xs leading-5 text-[var(--muted)]">Die Horizonte sind Entwicklungsphasen, keine festen Termine. Neue Distanzschritte werden nicht automatisch in deinen Kalender gedrückt; sie müssen zum Vier-Wochen-Block, Dienstplan und aktuellen Erholungsverlauf passen.</p></section>
  </>;
}

function Fact({ label, value, detail }: { label: string; value: string; detail: string }) { return <article className="card p-5"><p className="text-xs font-black uppercase tracking-wider text-[var(--muted)]">{label}</p><p className="mt-2 text-2xl font-black">{value}</p><p className="mt-1 text-xs text-[var(--muted)]">{detail}</p></article>; }

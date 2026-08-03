import Link from "next/link";
import { getActivities } from "@/lib/activities";
import { buildDailyDecision, buildFuelingPreparation, type DailyDecisionLevel } from "@/lib/daily-cockpit";
import { isDemoMode } from "@/lib/demo-data";
import { formatDistance, formatDuration } from "@/lib/format";
import { getNutritionLibrary } from "@/lib/nutrition-planner";
import { blockWeekForDate, getActiveTrainingBlock } from "@/lib/planning/blocks";
import { getPlanningData, type PlanningEvent } from "@/lib/planning/data";
import { reconcilePlannedWorkouts } from "@/lib/planning/reconciliation";
import { STRENGTH_WORKOUTS, strengthVariantFromTitle } from "@/lib/planning/strength-plan";
import { getPlannedWorkouts, type PlannedWorkout } from "@/lib/planning/workouts";
import { getRecoveryData } from "@/lib/recovery";
import { buildReadinessRange, type ReadinessResult } from "@/lib/recovery-readiness";
import { getTrainingLoadSummary } from "@/lib/training-load-data";
import { getTrainingProfile } from "@/lib/training-profile";
import { formatHeartRateTarget, getHeartRateZones, getPlannedHeartRateTarget } from "@/lib/training-zones";
import { generateWeeklyPlan, makeTodayWorkoutEasy } from "@/app/plan/actions";
import { buildMissionControl } from "@/lib/mission-control";

export const metadata = { title: "Heute" };
export const dynamic = "force-dynamic";

function dateKey(value: Date): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
}

function dateAtNoon(key: string): Date { return new Date(`${key}T12:00:00`); }
function addDays(key: string, count: number): string { const date = dateAtNoon(key); date.setDate(date.getDate() + count); return dateKey(date); }
function weekStartKey(key: string): string { const date = dateAtNoon(key); const weekday = date.getDay() || 7; date.setDate(date.getDate() - weekday + 1); return dateKey(date); }
function activityKey(value: string): string { return dateKey(new Date(value)); }
function localTime(value: string): string { return new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
function dayLabel(key: string): string { return new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" }).format(dateAtNoon(key)); }
function sleepLabel(minutes: number): string { return minutes ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : "–"; }

function overlapsDay(event: PlanningEvent, key: string): boolean {
  const start = new Date(`${key}T00:00:00`);
  const end = new Date(`${key}T23:59:59`);
  return new Date(event.startsAt) <= end && new Date(event.endsAt) >= start;
}

const decisionStyles: Record<DailyDecisionLevel, string> = {
  go: "bg-[#10281d] text-white", adjust: "bg-[#e5b151] text-[#2c210f]", recover: "bg-[#7d3541] text-white",
  done: "bg-[#245b43] text-white", open: "bg-[#dce9df] text-[#10281d]",
};

const readinessLabels: Record<ReadinessResult["status"], string> = { green: "Grün", yellow: "Gelb", red: "Rot", unknown: "Offen" };
const intensityLabels: Record<PlannedWorkout["intensity"], string> = { recovery: "Regeneration", easy: "Locker", endurance: "Grundlage", tempo: "Tempo", threshold: "Schwelle", vo2: "VO₂max", strength: "Kraft" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string; goal?: string }> }) {
  const query = await searchParams;
  const today = new Date();
  const todayKey = dateKey(today);
  const weekStart = weekStartKey(todayKey);
  const weekEnd = addDays(weekStart, 6);
  const previewEnd = addDays(todayKey, 3);
  const rangeStart = dateAtNoon(weekStart); rangeStart.setHours(0, 0, 0, 0);
  const rangeEnd = dateAtNoon(previewEnd); rangeEnd.setHours(23, 59, 59, 999);

  const [planning, workouts, activities, recovery, load, block, trainingProfile, nutrition] = await Promise.all([
    getPlanningData({ from: rangeStart, until: rangeEnd }),
    getPlannedWorkouts(weekStart, previewEnd),
    getActivities(),
    getRecoveryData(todayKey, todayKey),
    getTrainingLoadSummary(28),
    getActiveTrainingBlock(),
    getTrainingProfile(),
    getNutritionLibrary(),
  ]);

  const weekActivities = activities.filter((activity) => { const key = activityKey(activity.activityDate); return key >= weekStart && key <= weekEnd; });
  const reconciled = reconcilePlannedWorkouts(workouts, activities);
  const todayItems = reconciled.filter((item) => item.workout.scheduledDate === todayKey && item.effectiveStatus !== "skipped");
  const primaryItem = todayItems.find((item) => item.effectiveStatus === "planned") ?? todayItems[0] ?? null;
  const primaryWorkout = primaryItem?.workout ?? null;
  const readiness = buildReadinessRange([todayKey], recovery.metrics, recovery.checkins)[0];
  const previousTwoDays = [addDays(todayKey, -1), addDays(todayKey, -2)];
  const highLoadWithin48Hours = load.highLoadDates.some((key) => previousTwoDays.includes(key));
  const decision = buildDailyDecision(readiness, primaryWorkout, primaryItem?.effectiveStatus === "completed", highLoadWithin48Hours);
  const zones = getHeartRateZones(trainingProfile.profile);
  const hrTarget = primaryWorkout ? getPlannedHeartRateTarget(zones, primaryWorkout.intensity) : null;
  const todayEvents = planning.events.filter((event) => overlapsDay(event, todayKey));
  const selectedBlockWeek = blockWeekForDate(block, weekStart);
  const weeklyGoal = selectedBlockWeek?.targetDistanceKm ?? planning.profile.weeklyDistanceGoalKm;
  const actualKm = weekActivities.filter((activity) => activity.sportType === "cycling").reduce((sum, activity) => sum + activity.distanceMeters / 1000, 0);
  const progress = Math.min(100, weeklyGoal > 0 ? actualKm / weeklyGoal * 100 : 0);
  const upcomingCycling = reconciled.find((item) => item.effectiveStatus === "planned" && item.workout.sportType === "cycling" && item.workout.scheduledDate >= todayKey)?.workout ?? null;
  const fuelingWorkout = primaryWorkout?.sportType === "cycling" ? primaryWorkout : upcomingCycling;
  const fueling = buildFuelingPreparation(fuelingWorkout, nutrition.products, nutrition.presets);
  const strengthVariant = primaryWorkout ? strengthVariantFromTitle(primaryWorkout.title) : null;
  const strength = strengthVariant ? STRENGTH_WORKOUTS[strengthVariant] : null;
  const latest = activities[0];
  const previewDays = [addDays(todayKey, 1), addDays(todayKey, 2), addDays(todayKey, 3)];
  const quickActionsAvailable = primaryWorkout?.source === "automatic" && primaryWorkout.sportType === "cycling" && primaryItem?.effectiveStatus === "planned";
  const canShiftTomorrow = todayKey < weekEnd;
  const mission = buildMissionControl({ activities, nutrition: [], feedback: [], drifts: [], weeklyGoalKm: planning.profile.weeklyDistanceGoalKm, targetYear: planning.profile.targetYear, today: todayKey, recoveryTrackedNights: recovery.metrics.filter((metric) => metric.asleepMinutes > 0).length, recoveryStableNights: 0 });

  return <>
    <header className="mb-5 flex flex-col justify-between gap-4 sm:mb-7 sm:flex-row sm:items-end">
      <div><p className="eyebrow">{new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "long" }).format(today)}</p><h1 className="mt-2 text-[2.35rem] font-black leading-none tracking-[-.045em] text-[var(--ink)] sm:text-5xl">Heute zählt.</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)] sm:text-base">Dein Training, deine Erholung und das echte Leben auf einer Seite.</p></div>
      <div className="grid grid-cols-2 gap-2 sm:flex"><Link href="/plan" className="secondary-button justify-center">Wochenplan</Link><Link href="/activities/upload" className="primary-button">+ Importieren</Link></div>
    </header>

    {isDemoMode && <div className="mb-6 rounded-2xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-950"><strong>Demo-Modus:</strong> Verbinde Supabase, um deine persönlichen Empfehlungen zu sehen.</div>}
    {query.saved && <div className="mb-6 rounded-2xl bg-emerald-100 px-4 py-3 text-sm font-bold text-emerald-950">{{ easy: "Die heutige Fahrt wurde in eine lockere Ausdauerfahrt geändert.", shift: "Die Fahrt wurde auf morgen gelegt und die offene Woche neu verteilt.", pause: "Heute bleibt trainingsfrei; die offenen Kilometer wurden auf die restliche Woche verteilt." }[query.saved] ?? "Plan wurde angepasst."}{query.goal === "met" ? " Dein Wochenziel ist bereits erreicht, daher war keine weitere Verteilung nötig." : ""}</div>}
    {query.error && <div className="mb-6 rounded-2xl bg-rose-100 px-4 py-3 text-sm font-bold text-rose-950">{query.error}</div>}

    <section className={`relative overflow-hidden rounded-[1.6rem] p-5 shadow-[0_20px_50px_rgba(16,37,27,.14)] sm:rounded-[2rem] sm:p-9 ${decisionStyles[decision.level]}`}>
      <div className="absolute -right-20 -top-24 size-80 rounded-full border-[55px] border-white/5" />
      <div className="relative grid gap-6 sm:gap-8 xl:grid-cols-[1.35fr_.65fr] xl:items-end">
        <div><p className="text-xs font-black uppercase tracking-[.18em] opacity-60">{decision.eyebrow}</p><h2 className="mt-3 max-w-3xl text-[1.85rem] font-black leading-[1.05] tracking-[-.04em] sm:text-5xl">{decision.title}</h2><p className="mt-3 max-w-2xl text-sm leading-6 opacity-75 sm:mt-4 sm:text-base sm:leading-7">{decision.summary}</p>{decision.reasons.length > 0 && <ul className="mt-4 space-y-2 text-sm font-semibold opacity-80 sm:mt-5">{decision.reasons.map((reason) => <li key={reason} className="flex gap-2"><span aria-hidden>•</span><span>{reason}</span></li>)}</ul>}</div>
        <div className="rounded-2xl border border-current/10 bg-white/10 p-5 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-3"><span className="text-xs font-black uppercase tracking-wider opacity-60">Heutige Einheit</span>{primaryWorkout && <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold">{intensityLabels[primaryWorkout.intensity]}</span>}</div>
          {primaryWorkout ? <><p className="mt-3 text-2xl font-black">{primaryWorkout.title}</p><div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm font-bold"><span>{primaryWorkout.plannedDurationMinutes ? `${primaryWorkout.plannedDurationMinutes} min` : "Zeit offen"}</span>{primaryWorkout.plannedDistanceKm !== null && <span>{primaryWorkout.plannedDistanceKm} km</span>}{hrTarget && <span>{formatHeartRateTarget(hrTarget)}</span>}</div></> : <><p className="mt-3 text-2xl font-black">Kein Training geplant</p><p className="mt-2 text-sm opacity-70">Ein freier Tag ist Teil des Plans.</p></>}
          <Link href="/plan" className="mt-5 inline-flex rounded-xl bg-white px-4 py-2.5 text-sm font-black text-[#10281d]">Im Plan öffnen →</Link>
          {quickActionsAvailable && <div className="mt-4 border-t border-current/10 pt-4"><p className="mb-2 text-[.65rem] font-black uppercase tracking-wider opacity-55">Plan schnell anpassen</p><div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
            {primaryWorkout.intensity !== "easy" && primaryWorkout.intensity !== "recovery" && <form action={makeTodayWorkoutEasy}><input type="hidden" name="workoutId" value={primaryWorkout.id}/><button className="w-full rounded-xl border border-current/15 bg-white/10 px-3 py-2.5 text-sm font-black hover:bg-white/20" type="submit">Locker machen</button></form>}
            {canShiftTomorrow && <form action={generateWeeklyPlan}><input type="hidden" name="week" value={weekStart}/><input type="hidden" name="workoutId" value={primaryWorkout.id}/><input type="hidden" name="dashboardAction" value="shift"/><button className="w-full rounded-xl border border-current/15 bg-white/10 px-3 py-2.5 text-sm font-black hover:bg-white/20" type="submit">Auf morgen</button></form>}
            <form action={generateWeeklyPlan}><input type="hidden" name="week" value={weekStart}/><input type="hidden" name="workoutId" value={primaryWorkout.id}/><input type="hidden" name="dashboardAction" value="pause"/><button className="w-full rounded-xl border border-current/15 bg-white/10 px-3 py-2.5 text-sm font-black hover:bg-white/20" type="submit">Heute pausieren</button></form>
          </div><p className="mt-2 text-[.68rem] leading-5 opacity-55">Manuelle und absolvierte Einheiten bleiben unverändert. Offene automatische Kilometer werden neu verteilt.</p></div>}
        </div>
      </div>
    </section>

    <section className="mt-4 grid gap-4 sm:mt-6 sm:gap-6 xl:grid-cols-[1.2fr_.8fr]">
      <div className="grid content-start gap-4 sm:gap-6">
        <article className="card p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="eyebrow">Training im Detail</p><h2 className="mt-2 text-2xl font-black">{primaryWorkout?.title ?? "Heute ist trainingsfrei"}</h2></div>{primaryWorkout && <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1.5 text-xs font-black text-[var(--accent-dark)]">{primaryWorkout.sportType === "cycling" ? "Rad" : primaryWorkout.sportType === "strength" ? "Gym" : "Training"}</span>}</div>
          {strength ? <div className="mt-6"><p className="font-bold text-[var(--muted)]">Einheit {strength.variant} · {strength.focus}</p><div className="mt-4 grid gap-2 sm:grid-cols-2">{[...strength.exercises, ...strength.core].map((exercise) => <div key={exercise.name} className="rounded-xl bg-[#edf1ec] px-4 py-3"><p className="font-bold">{exercise.name}</p><p className="mt-1 text-sm text-[var(--muted)]">{exercise.prescription}</p></div>)}</div><p className="mt-4 text-xs text-[var(--muted)]">RIR 1–2 · Grundübungen 2–3 min Pause · Zubehör/Core 60–90 s</p></div> : primaryWorkout ? <div className="mt-5"><div className="grid gap-3 sm:grid-cols-3"><Metric label="Dauer" value={primaryWorkout.plannedDurationMinutes ? `${primaryWorkout.plannedDurationMinutes} min` : "Offen"}/><Metric label="Distanz" value={primaryWorkout.plannedDistanceKm !== null ? `${primaryWorkout.plannedDistanceKm} km` : "Offen"}/><Metric label="Herzfrequenz" value={hrTarget ? formatHeartRateTarget(hrTarget) : "Zonen einrichten"}/></div>{primaryWorkout.description && <div className="mt-5 rounded-2xl bg-[#edf1ec] p-4"><p className="text-xs font-black uppercase tracking-wider text-[var(--muted)]">Ablauf</p><div className="mt-3 space-y-2 text-sm leading-6">{primaryWorkout.description.split("\n").filter(Boolean).map((line) => <p key={line}>{line}</p>)}</div></div>}</div> : <div className="mt-6 rounded-2xl border border-dashed border-[var(--line)] p-6 text-center"><p className="font-bold">Keine Einheit im Plan.</p><p className="mt-1 text-sm text-[var(--muted)]">Spazieren, Mobility oder einfach Erholung – ohne Kilometer nachholen zu müssen.</p></div>}
        </article>

        <article className="card p-6 sm:p-7"><div className="flex items-center justify-between gap-3"><div><p className="eyebrow">Dein Tag</p><h2 className="mt-2 text-2xl font-black">Dienste & Termine</h2></div><Link href="/plan" className="text-sm font-bold text-[var(--accent)]">Bearbeiten →</Link></div>{todayEvents.length ? <div className="mt-5 space-y-3">{todayEvents.map((event) => <div key={event.id} className="flex items-center gap-4 rounded-2xl bg-[#edf1ec] p-4"><span className="h-10 w-1 rounded-full bg-[var(--accent)]"/><div className="min-w-0 flex-1"><p className="truncate font-bold">{event.title}</p><p className="mt-1 text-sm text-[var(--muted)]">{event.allDay ? "Ganztägig" : `${localTime(event.startsAt)}–${localTime(event.endsAt)} Uhr`}</p></div></div>)}</div> : <p className="mt-5 rounded-2xl bg-[#edf1ec] p-5 text-sm text-[var(--muted)]">Keine Dienste oder privaten Termine heute.</p>}</article>
      </div>

      <aside className="grid content-start gap-4 sm:gap-6">
        <article className="card p-6"><div className="flex items-start justify-between gap-3"><div><p className="eyebrow">Readiness</p><h2 className="mt-2 text-xl font-black">{readinessLabels[readiness.status]}{readiness.score !== null ? ` · ${readiness.score}/100` : ""}</h2></div><span className={`size-3 rounded-full ${readiness.status === "green" ? "bg-emerald-500" : readiness.status === "yellow" ? "bg-amber-400" : readiness.status === "red" ? "bg-rose-500" : "bg-slate-300"}`}/></div><div className="mt-5 grid grid-cols-3 gap-2"><Metric label="Schlaf" value={sleepLabel(readiness.metric?.asleepMinutes ?? 0)}/><Metric label="HF nachts" value={readiness.metric?.sleepingAverageHeartRate ? `${Math.round(readiness.metric.sleepingAverageHeartRate)} bpm` : "–"}/><Metric label="HRV" value={readiness.metric?.hrvSdnnMs ? `${Math.round(readiness.metric.hrvSdnnMs)} ms` : "–"}/></div><div className="mt-4 flex gap-2"><Link href="/plan" className="secondary-button flex-1 justify-center">Tagesform eintragen</Link><Link href="/progress" aria-label="Erholungsverlauf" className="secondary-button">↗</Link></div></article>

        <article className="card p-6"><div className="flex items-center justify-between gap-3"><div><p className="eyebrow">Diese Woche</p><h2 className="mt-2 text-xl font-black">{actualKm.toLocaleString("de-DE", { maximumFractionDigits: 1 })} / {weeklyGoal} km</h2></div>{selectedBlockWeek && <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-black text-[var(--accent-dark)]">Block {selectedBlockWeek.weekNumber}/4</span>}</div><div className="mt-4 h-3 overflow-hidden rounded-full bg-[#e4e9e3]"><div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${progress}%` }}/></div><div className="mt-4 grid grid-cols-2 gap-3"><Metric label="Noch offen" value={`${Math.max(0, weeklyGoal - actualKm).toLocaleString("de-DE", { maximumFractionDigits: 1 })} km`}/><Metric label="7-Tage-Last" value={`${load.sevenDayLoad.toLocaleString("de-DE", { maximumFractionDigits: 0 })} UPL`}/>{selectedBlockWeek && <><Metric label="Lange Fahrt" value={`${selectedBlockWeek.longRideTargetKm} km`}/><Metric label="Wochenfokus" value={selectedBlockWeek.phase}/></>}</div></article>

        <article className="relative overflow-hidden rounded-[1.5rem] bg-[var(--ink)] p-6 text-white"><div className="absolute -right-12 -top-12 size-40 rounded-full border-[28px] border-emerald-300/5"/><div className="relative"><div className="flex items-center justify-between gap-3"><p className="text-xs font-black uppercase tracking-[.16em] text-emerald-200/60">RAG Mission Control</p><span className="text-xs font-bold text-emerald-200">{mission.achievedMilestones}/{mission.milestones.length}</span></div><h2 className="mt-3 text-xl font-black">{mission.nextMilestone?.title ?? "Roadmap vollständig"}</h2>{mission.nextMilestone && <><p className="mt-2 text-sm text-emerald-50/60">{mission.nextMilestone.evidence}</p><div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#7bd89e]" style={{ width: `${mission.nextMilestone.progressPercent}%` }}/></div></>}<Link href="/mission" className="mt-5 inline-flex rounded-xl bg-white px-4 py-2.5 text-sm font-black text-[var(--ink)]">Mission öffnen →</Link></div></article>

        <article className="rounded-[1.5rem] bg-[#e5b151] p-6 text-[#2c210f]"><p className="text-xs font-black uppercase tracking-[.16em] opacity-60">Verpflegung vorbereiten</p>{fueling && fuelingWorkout ? <><h2 className="mt-2 text-xl font-black">Für {fuelingWorkout.scheduledDate === todayKey ? "heute" : dayLabel(fuelingWorkout.scheduledDate)}</h2><p className="mt-1 text-sm font-semibold opacity-70">{fuelingWorkout.title} · {fuelingWorkout.plannedDurationMinutes} min</p><div className="mt-5 grid grid-cols-2 gap-3"><Metric label="Carbs" value={`${fueling.carbohydrateRateGrams} g/h`}/><Metric label="Gesamt" value={`${fueling.totalCarbohydratesGrams} g`}/><Metric label="Flüssigkeit" value={`${fueling.fluidMilliliters} ml`}/><Metric label="Flaschen" value={`${fueling.bottleCount} × 750 ml`}/></div><div className="mt-4 space-y-2 text-sm font-bold">{fueling.bottleSuggestion && <p>{fueling.bottleSuggestion.count}× {fueling.bottleSuggestion.name}</p>}{fueling.productSuggestion && <p>{fueling.productSuggestion.count}× {fueling.productSuggestion.name}</p>}{!fueling.bottleSuggestion && !fueling.productSuggestion && <p>Lege Gels, Riegel oder eine Flaschenmischung in deiner Bibliothek an.</p>}</div><p className="mt-4 text-xs leading-5 opacity-60">Planungsbasis: 500 ml/h. Wetter und persönliche Schweißrate sind noch nicht eingerechnet.</p></> : <><h2 className="mt-2 text-xl font-black">Für heute nichts zu packen.</h2><p className="mt-2 text-sm leading-6 opacity-70">Die nächste geplante Radfahrt erscheint hier automatisch.</p></>}<Link href="/nutrition" className="mt-5 inline-flex rounded-xl bg-[#2c210f] px-4 py-2.5 text-sm font-bold text-white">Verpflegung öffnen</Link></article>
      </aside>
    </section>

    <section className="mt-4 grid gap-4 sm:mt-6 sm:gap-6 xl:grid-cols-[1.2fr_.8fr]">
      <article className="card p-6 sm:p-7"><div className="flex items-center justify-between gap-3"><div><p className="eyebrow">Vorschau</p><h2 className="mt-2 text-2xl font-black">Die nächsten drei Tage</h2></div><Link href="/plan" className="text-sm font-bold text-[var(--accent)]">Ganze Woche →</Link></div><div className="mt-5 grid gap-3 sm:grid-cols-3">{previewDays.map((key) => { const dayWorkout = reconciled.find((item) => item.workout.scheduledDate === key && item.effectiveStatus !== "skipped")?.workout; const events = planning.events.filter((event) => overlapsDay(event, key)); return <div key={key} className="rounded-2xl bg-[#edf1ec] p-4"><p className="text-xs font-black uppercase tracking-wider text-[var(--muted)]">{dayLabel(key)}</p><p className="mt-3 font-black">{dayWorkout?.title ?? "Trainingsfrei"}</p>{dayWorkout && <p className="mt-1 text-xs text-[var(--muted)]">{dayWorkout.plannedDurationMinutes ? `${dayWorkout.plannedDurationMinutes} min` : intensityLabels[dayWorkout.intensity]}{dayWorkout.plannedDistanceKm !== null ? ` · ${dayWorkout.plannedDistanceKm} km` : ""}</p>}<p className="mt-3 text-xs text-[var(--muted)]">{events.length ? events.map((event) => event.title).join(" · ") : "Keine Termine"}</p></div>; })}</div></article>

      <article className="card overflow-hidden"><div className="border-b border-[var(--line)] p-5"><p className="eyebrow">Letzte Aktivität</p></div>{latest ? <Link href={`/activities/${latest.id}`} className="block p-6 transition hover:bg-white"><p className="text-xl font-black tracking-tight">{latest.title}</p><div className="mt-5 grid grid-cols-3 gap-3"><Metric label="Distanz" value={formatDistance(latest.distanceMeters)}/><Metric label="Zeit" value={formatDuration(latest.movingTimeSeconds)}/><Metric label="Anstieg" value={`${Math.round(latest.elevationGainMeters)} m`}/></div><p className="mt-5 text-sm font-bold text-[var(--accent)]">Auswerten & Feedback ergänzen →</p></Link> : <div className="p-6 text-sm text-[var(--muted)]">Noch keine Aktivität vorhanden.</div>}</article>
    </section>
  </>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[.65rem] font-bold uppercase tracking-wider text-current opacity-50">{label}</p><p className="mt-1 font-black leading-tight">{value}</p></div>;
}

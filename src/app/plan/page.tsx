import Link from "next/link";
import { CalendarImport } from "@/components/calendar-import";
import { PageHeading } from "@/components/page-heading";
import { TrainingCalendar } from "@/components/training-calendar";
import { RecoveryPanel } from "@/components/recovery-panel";
import { TrainingBlockOverview } from "@/components/training-block-overview";
import { WeeklyTargetCard } from "@/components/weekly-target-card";
import { getActivities } from "@/lib/activities";
import { defaultPlanningProfile, getPlanningData } from "@/lib/planning/data";
import { getLatestPlanGeneration, getPlannedWorkouts } from "@/lib/planning/workouts";
import { reconcilePlannedWorkouts } from "@/lib/planning/reconciliation";
import { getTrainingProfile } from "@/lib/training-profile";
import { getHeartRateZones } from "@/lib/training-zones";
import { getRecoveryData } from "@/lib/recovery";
import { buildReadinessRange } from "@/lib/recovery-readiness";
import { isDemoMode } from "@/lib/demo-data";
import { getTrainingLoadSummary } from "@/lib/training-load-data";
import { blockWeekForDate, getActiveTrainingBlock } from "@/lib/planning/blocks";
import { buildWeeklyTargetDays, recommendWeeklyTarget } from "@/lib/planning/weekly-target";
import { generateWeeklyPlan, savePlanningProfile } from "./actions";

export const metadata = { title: "Plan" };
export const dynamic = "force-dynamic";
const inputClass = "mt-1.5 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5";

function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function weekStart(value?: string): Date {
  const date = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date();
  if (Number.isNaN(date.getTime())) return weekStart();
  date.setHours(12, 0, 0, 0);
  const weekday = date.getDay() || 7;
  date.setDate(date.getDate() - weekday + 1);
  return date;
}

export default async function PlanPage({ searchParams }: { searchParams: Promise<{ week?: string; saved?: string; imported?: string; generated?: string; goal?: string; error?: string }> }) {
  const query = await searchParams;
  const start = weekStart(query.week);
  const end = new Date(start); end.setDate(end.getDate() + 6);
  const rangeStart = new Date(start); rangeStart.setHours(0, 0, 0, 0);
  const rangeEnd = new Date(end); rangeEnd.setHours(23, 59, 59, 999);
  const days = Array.from({ length: 7 }, (_, index) => { const date = new Date(start); date.setDate(date.getDate() + index); return isoDate(date); });
  const week = days[0];
  const previous = new Date(start); previous.setDate(previous.getDate() - 7);
  const next = new Date(start); next.setDate(next.getDate() + 7);
  const [data, workouts, allActivities, generation, { profile: trainingProfile }, recovery, trainingLoad, trainingBlock] = await Promise.all([getPlanningData({ from: rangeStart, until: rangeEnd }), getPlannedWorkouts(days[0], days[6]), getActivities(), getLatestPlanGeneration(week), getTrainingProfile(), getRecoveryData(days[0], days[6]), getTrainingLoadSummary(28), getActiveTrainingBlock()]);
  const profile = data.profile ?? defaultPlanningProfile;
  const activities = allActivities.filter((activity) => { const time = new Date(activity.activityDate); return time >= rangeStart && time <= rangeEnd; });
  const primaryActivities = activities.filter((activity) => activity.sportType === profile.primarySport);
  const reconciled = reconcilePlannedWorkouts(workouts, activities);
  const activeWorkouts = reconciled.filter((item) => item.effectiveStatus !== "skipped");
  const completedPlans = reconciled.filter((item) => item.effectiveStatus === "completed").length;
  const plannedMinutes = activeWorkouts.reduce((sum, item) => sum + (item.workout.plannedDurationMinutes ?? 0), 0);
  const plannedKm = activeWorkouts.reduce((sum, item) => sum + (item.workout.plannedDistanceKm ?? 0), 0);
  const actualMinutes = primaryActivities.reduce((sum, activity) => sum + activity.movingTimeSeconds / 60, 0);
  const actualKm = primaryActivities.reduce((sum, activity) => sum + activity.distanceMeters / 1000, 0);
  const indoorDate = profile.indoorCyclingAvailableFrom ? new Date(`${profile.indoorCyclingAvailableFrom}T12:00:00`) : new Date("2026-10-01T12:00:00");
  const readiness = buildReadinessRange(days, recovery.metrics, recovery.checkins);
  const todayKey = isoDate(new Date());
  const todayReadiness = readiness.find((item) => item.date === todayKey);
  const selectedBlockWeek = profile.primarySport === "cycling" ? blockWeekForDate(trainingBlock, week) : null;
  const recentCutoff = new Date(start); recentCutoff.setDate(recentCutoff.getDate() - 28);
  const recentPrimary = allActivities.filter((activity) => activity.sportType === profile.primarySport && new Date(activity.activityDate) >= recentCutoff && new Date(activity.activityDate) < start);
  const recentDistanceKm = recentPrimary.reduce((sum, activity) => sum + activity.distanceMeters / 1000, 0);
  const recentSeconds = recentPrimary.reduce((sum, activity) => sum + activity.movingTimeSeconds, 0);
  const recentAverageSpeedKmh = recentSeconds > 0 ? recentDistanceKm / (recentSeconds / 3600) : null;
  const readinessByDate = new Map(readiness.map((item) => [item.date, item.status] as const));
  const targetDays = buildWeeklyTargetDays(days, data.events, readinessByDate);
  const weeklyRecommendation = recommendWeeklyTarget({
    referenceGoalKm: profile.weeklyDistanceGoalKm,
    days: targetDays,
    recentFourWeekDistanceKm: recentDistanceKm,
    recentAverageSpeedKmh,
    workdayMaxMinutes: profile.workdayMaxSessionMinutes,
    blockTargetKm: selectedBlockWeek?.targetDistanceKm,
    blockLongRideTargetKm: selectedBlockWeek?.longRideTargetKm,
    blockPhase: selectedBlockWeek?.phase,
  });
  const effectiveWeeklyGoal = weeklyRecommendation.targetKm;

  return <>
    <PageHeading eyebrow={`Trainingskalender · ${profile.primarySport === "running" ? "Laufen" : "Radfahren"}`} title="Deine Woche. Dein echtes Leben." description={`Plane ${profile.primarySport === "running" ? "Läufe" : "Radtraining"} um Dienste und Termine herum, verschiebe Einheiten und vergleiche Planung mit dem tatsächlich absolvierten Training.`} />
    {query.saved && <p className="mb-5 rounded-xl bg-emerald-100 px-4 py-3 text-sm font-bold text-emerald-900">{{ deleted: "Einheit gelöscht.", workout: "Einheit gespeichert.", status: "Trainingsstatus gespeichert.", readiness: "Tagesform gespeichert.", block: "Vier-Wochen-Block erstellt.", "block-completed": "Trainingsblock abgeschlossen.", event: "Kalendertermin gespeichert.", "event-deleted": "Kalendertermin gelöscht.", profile: "Planungseinstellungen gespeichert." }[query.saved] ?? "Änderung gespeichert."}</p>}
    {query.imported && <p className="mb-5 rounded-xl bg-emerald-100 px-4 py-3 text-sm font-bold text-emerald-900">{query.imported} Termine importiert oder aktualisiert.</p>}
    {query.generated && <p className="mb-5 rounded-xl bg-emerald-100 px-4 py-3 text-sm font-bold text-emerald-900">{query.generated} Einheiten wurden in freie Zeitfenster eingeplant.</p>}
    {query.goal === "met" && <p className="mb-5 rounded-xl bg-emerald-100 px-4 py-3 text-sm font-bold text-emerald-900">Das Wochenziel ist durch absolvierte und manuell geplante Kilometer bereits vollständig abgedeckt.</p>}
    {query.error && <p className="mb-5 rounded-xl bg-red-100 px-4 py-3 text-sm font-bold text-red-900">{query.error}</p>}

    {todayReadiness && <RecoveryPanel readiness={todayReadiness} week={week} editable={!isDemoMode && recovery.ready}/>} 

    {profile.primarySport === "cycling" ? <><TrainingBlockOverview block={trainingBlock} selectedWeek={week} activities={allActivities} weeklyDistanceKm={profile.weeklyDistanceGoalKm} editable={!isDemoMode}/><WeeklyTargetCard recommendation={weeklyRecommendation} blockWeekNumber={selectedBlockWeek?.weekNumber} /></> : <section className="card mb-4 p-5"><p className="eyebrow">Lauf-Wochenziel</p><div className="mt-2 flex flex-wrap items-end justify-between gap-3"><div><p className="text-3xl font-black">{effectiveWeeklyGoal} km</p><p className="mt-1 text-sm text-[var(--muted)]">Automatisch auf bis zu drei Läufe verteilt · längster Lauf im größten freien Fenster</p></div><p className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-800">HF-gesteuert</p></div></section>}

    <section className="card mb-4 flex flex-col gap-4 p-4 xl:flex-row xl:items-center xl:justify-between">
      <div className="flex flex-wrap items-center gap-2"><Link href={`/plan?week=${isoDate(previous)}`} aria-label="Vorherige Woche" className="grid size-10 place-items-center rounded-xl border border-[var(--line)] bg-white font-black">←</Link><Link href="/plan" className="rounded-xl border border-[var(--line)] bg-white px-4 py-2.5 text-sm font-bold">Heute</Link><Link href={`/plan?week=${isoDate(next)}`} aria-label="Nächste Woche" className="grid size-10 place-items-center rounded-xl border border-[var(--line)] bg-white font-black">→</Link><h2 className="ml-2 text-lg font-black">{new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short" }).format(start)} – {new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short", year: "numeric" }).format(end)}</h2><form action={generateWeeklyPlan} className="ml-auto"><input type="hidden" name="week" value={week}/><button type="submit" className="rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-black text-white shadow-sm hover:bg-[var(--accent-dark)]">✦ {activities.length ? "Restwoche neu planen" : "Woche automatisch planen"}</button></form></div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Summary label="Geplant" value={`${Math.round(plannedMinutes)} min`} detail={`${plannedKm.toLocaleString("de-DE", { maximumFractionDigits: 1 })} km`} /><Summary label="Absolviert" value={`${Math.round(actualMinutes)} min`} detail={`${actualKm.toLocaleString("de-DE", { maximumFractionDigits: 1 })} km`} /><Summary label="Plan erfüllt" value={`${completedPlans} / ${activeWorkouts.length}`} detail="zugeordnete Einheiten" /><Summary label="Adaptives Ziel" value={`${effectiveWeeklyGoal} km`} detail={`${Math.max(0, effectiveWeeklyGoal - actualKm).toLocaleString("de-DE", { maximumFractionDigits: 1 })} km offen`} /></dl>
    </section>

    {generation && <section className="mb-4 rounded-2xl border border-emerald-900/10 bg-[var(--accent-soft)] p-5"><div className="flex flex-wrap items-center justify-between gap-2"><p className="eyebrow">Planbegründung</p><span className="rounded-full bg-white/70 px-3 py-1 text-[.65rem] font-black uppercase tracking-wider text-[var(--muted)]">Regelbasiert · nachvollziehbar</span></div><p className="mt-3 text-sm font-semibold leading-6 text-[var(--ink)]">{generation.summary}</p>{generation.caution && <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{generation.caution}</p>}</section>}

    <TrainingCalendar primarySport={profile.primarySport} days={days} week={week} workouts={workouts} events={data.events} activities={activities} heartRateZones={getHeartRateZones(trainingProfile)} readiness={readiness} activityLoads={trainingLoad.activities} />

    <section className="mt-6 grid gap-6 xl:grid-cols-2">
      <details className="card p-6"><summary className="cursor-pointer list-none text-xl font-black">Dienstplan importieren <span className="float-right text-[var(--accent)]">+</span></summary><p className="mt-2 text-sm leading-6 text-[var(--muted)]">Nur Codes und Zeiten werden gespeichert; Beschreibungen, Kollegennamen und Orte bleiben außen vor.</p><div className="mt-5"><CalendarImport /></div></details>
      <details className="card p-6"><summary className="cursor-pointer list-none text-xl font-black">Planungsregeln <span className="float-right text-[var(--accent)]">+</span></summary><form action={savePlanningProfile} className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold sm:col-span-2">Trainingsfokus<select className={inputClass} name="primarySport" defaultValue={profile.primarySport}><option value="cycling">Radfahren</option><option value="running">Laufen</option></select></label><label className="text-sm font-semibold">Zieljahr<input className={inputClass} name="targetYear" type="number" min="2026" defaultValue={profile.targetYear}/></label><label className="text-sm font-semibold">Wochenziel (km)<input className={inputClass} name="weeklyDistance" type="number" min="0" defaultValue={profile.weeklyDistanceGoalKm}/></label><label className="text-sm font-semibold">Max. Arbeitstag (min)<input className={inputClass} name="workdayMax" type="number" min="15" max="360" defaultValue={profile.workdayMaxSessionMinutes}/></label><label className="text-sm font-semibold">Gym Sommer<input className={inputClass} name="gymSummer" type="number" min="0" max="7" defaultValue={profile.gymSummerSessions}/></label><label className="text-sm font-semibold">Gym Winter<input className={inputClass} name="gymWinter" type="number" min="0" max="7" defaultValue={profile.gymWinterSessions}/></label><label className="text-sm font-semibold">Indoor ab Monat<input className={inputClass} name="indoorMonth" type="number" min="1" max="12" defaultValue={indoorDate.getMonth() + 1}/></label><input type="hidden" name="indoorYear" value={indoorDate.getFullYear()}/><label className="flex items-center gap-2 text-sm font-semibold sm:col-span-2"><input name="beforeLate" type="checkbox" defaultChecked={profile.beforeLateShiftAllowed}/> Training vor Spätdienst möglich</label><label className="flex items-center gap-2 text-sm font-semibold sm:col-span-2"><input name="afterNight" type="checkbox" defaultChecked={profile.afterNightShiftAllowed}/> Training nach Nachtdienst möglich</label><button className="rounded-xl bg-[var(--accent)] px-5 py-3 font-bold text-white sm:col-span-2" type="submit">Einstellungen speichern</button></form></details>
    </section>
  </>;
}

function Summary({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="min-w-28 rounded-xl bg-[#edf3fb] px-3 py-2"><dt className="text-[.65rem] font-bold uppercase tracking-wider text-[var(--muted)]">{label}</dt><dd className="mt-0.5 font-black">{value}</dd><p className="text-[.65rem] text-[var(--muted)]">{detail}</p></div>;
}

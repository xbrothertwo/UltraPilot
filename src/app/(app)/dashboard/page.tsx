import Link from "next/link";
import { redirect } from "next/navigation";
import { getActivities } from "@/lib/activities";
import { eventOverlapsLocalDay } from "@/lib/calendar/ics-parser";
import {
  addBerlinCalendarDays,
  berlinDateKey,
  berlinDayInterval,
  berlinWeekRange,
} from "@/lib/calendar/berlin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { hasCompletedOnboarding } from "@/lib/onboarding";
import {
  buildDailyDecision,
  buildFuelingPreparation,
  type DailyDecisionLevel,
} from "@/lib/daily-cockpit";
import { isDemoMode } from "@/lib/demo-data";
import { formatDuration } from "@/lib/format";
import { getNutritionLibrary } from "@/lib/nutrition-planner";
import {
  blockWeekForDate,
  getCurrentTrainingBlock,
} from "@/lib/planning/blocks";
import { getPlanningData, type PlanningEvent } from "@/lib/planning/data";
import {
  computeStrengthWeekProgress,
  reconcilePlannedWorkouts,
} from "@/lib/planning/reconciliation";
import {
  STRENGTH_WORKOUTS,
  strengthVariantFromTitle,
} from "@/lib/planning/strength-plan";
import {
  getPlannedWorkouts,
  type PlannedWorkout,
} from "@/lib/planning/workouts";
import { getRecoveryData } from "@/lib/recovery";
import {
  buildReadinessRange,
} from "@/lib/recovery-readiness";
import { getTrainingLoadSummary } from "@/lib/training-load-data";
import { getTrainingProfile } from "@/lib/training-profile";
import { getActiveGymSession } from "@/lib/gym/data";
import {
  formatHeartRateTarget,
  getHeartRateZones,
  getPlannedHeartRateTarget,
} from "@/lib/training-zones";
import { generateWeeklyPlan } from "@/app/plan/actions";
import { getMissions } from "@/lib/missions";
import {
  buildDashboardViewModel,
  buildDashboardMissionControl,
  dashboardSportIcon,
  selectDashboardMission,
} from "@/lib/dashboard-view-model";
import {
  buildWeeklyTargetDays,
  recommendWeeklyTarget,
} from "@/lib/planning/weekly-target";
import { calculateDailyAvailability } from "@/lib/planning/availability";
import {
  acceptTodayPlan,
  adaptTodayForLowReadiness,
} from "@/app/dashboard/actions";
import {
  DashboardMissionSummary,
  DashboardPrimarySportError,
  DashboardRecoverySummary,
} from "@/components/dashboard-states";
import { DashboardCheckIn } from "@/components/dashboard-check-in";
import { InlineAlert, Metric as BloomMetric, PageHeader, Progress, SectionHeader } from "@/components/ui";

export const metadata = { title: "Heute" };
export const dynamic = "force-dynamic";

function dateAtNoon(key: string): Date {
  return new Date(`${key}T12:00:00Z`);
}
function localTime(value: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
function dayLabel(key: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  }).format(dateAtNoon(key));
}
function overlapsDay(event: PlanningEvent, key: string): boolean {
  return eventOverlapsLocalDay(event, key);
}

const decisionPillStyles: Record<DailyDecisionLevel, string> = {
  go: "bg-emerald-400/15 text-emerald-200 ring-emerald-300/20",
  adjust: "bg-amber-300/15 text-amber-100 ring-amber-200/20",
  recover: "bg-rose-300/15 text-rose-100 ring-rose-200/20",
  done: "bg-cyan-300/15 text-cyan-100 ring-cyan-200/20",
  open: "bg-blue-300/15 text-blue-100 ring-blue-200/20",
};

const intensityLabels: Record<PlannedWorkout["intensity"], string> = {
  recovery: "Regeneration",
  easy: "Locker",
  endurance: "Grundlage",
  tempo: "Tempo",
  threshold: "Schwelle",
  vo2: "VO₂max",
  strength: "Kraft",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    saved?: string;
    error?: string;
    goal?: string;
    firstPlan?: "ready" | "empty" | "error";
    generated?: string;
    planWeek?: string;
  }>;
}) {
  const query = await searchParams;
  if (isSupabaseConfigured() && !(await hasCompletedOnboarding()))
    redirect("/onboarding");
  const today = new Date();
  const berlinWeek = berlinWeekRange(today);
  const todayKey = berlinWeek.today;
  const weekStart = berlinWeek.start;
  const weekEnd = berlinWeek.end;
  const previewEnd = addBerlinCalendarDays(todayKey, 3);
  const nextWeekStart = addBerlinCalendarDays(weekStart, 7);
  const requestedPlanWeek = query.planWeek === nextWeekStart ? nextWeekStart : weekStart;
  const firstPlanWeek = query.firstPlan ? requestedPlanWeek : weekStart;
  const firstPlanWeekEnd = addBerlinCalendarDays(firstPlanWeek, 6);
  const workoutRangeStart = firstPlanWeek < weekStart ? firstPlanWeek : weekStart;
  const workoutRangeEnd = [previewEnd, weekEnd, firstPlanWeekEnd].sort().at(-1)!;
  const rangeStart = berlinDayInterval(workoutRangeStart).startInclusive;
  const rangeEnd = berlinDayInterval(workoutRangeEnd).endExclusive;

  const [
    planning,
    workouts,
    activities,
    recovery,
    load,
    currentBlock,
    trainingProfile,
    nutrition,
    missions,
    activeGymSession,
  ] = await Promise.all([
    getPlanningData({ from: rangeStart, until: rangeEnd }),
    getPlannedWorkouts(workoutRangeStart, workoutRangeEnd),
    getActivities(),
    getRecoveryData(todayKey, todayKey),
    getTrainingLoadSummary(28),
    getCurrentTrainingBlock(),
    getTrainingProfile(),
    getNutritionLibrary(),
    getMissions(),
    getActiveGymSession(),
  ]);

  if (planning.primarySport.status !== "valid") {
    return <DashboardPrimarySportError resolution={planning.primarySport} />;
  }

  const weekActivities = activities.filter((activity) => {
    const key = berlinDateKey(activity.activityDate);
    return key >= weekStart && key <= weekEnd;
  });
  const reconciled = reconcilePlannedWorkouts(workouts, activities);
  const strengthProgress = computeStrengthWeekProgress(
    workouts,
    planning.profile.gymSummerSessions,
    planning.profile.gymWinterSessions,
  );
  const nextStrengthWorkout = strengthProgress
    ? workouts
        .filter(
          (workout) =>
            workout.sportType === "strength" &&
            workout.status === "planned" &&
            workout.scheduledDate >= todayKey,
        )
        .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))[0] ?? null
    : null;
  const todayItems = reconciled.filter(
    (item) =>
      item.workout.scheduledDate === todayKey &&
      item.effectiveStatus !== "skipped",
  );
  const primaryItem =
    todayItems.find((item) => item.effectiveStatus === "planned") ??
    todayItems[0] ??
    null;
  const primaryWorkout = primaryItem?.workout ?? null;
  const readiness = buildReadinessRange(
    [todayKey],
    recovery.metrics,
    recovery.checkins,
  )[0];
  const previousTwoDays = [addBerlinCalendarDays(todayKey, -1), addBerlinCalendarDays(todayKey, -2)];
  const highLoadWithin48Hours = load.highLoadDates.some((key) =>
    previousTwoDays.includes(key),
  );
  const todayEvents = planning.events.filter((event) =>
    overlapsDay(event, todayKey),
  );
  const busyTodayEvents = todayEvents.filter(
    (event) => event.eventKind !== "free",
  );
  const todayWindows = calculateDailyAvailability(
    todayKey,
    busyTodayEvents,
    30,
    6,
    22,
    planning.profile.beforeLateShiftAllowed,
    planning.profile.afterNightShiftAllowed,
  );
  const rawLargestWindow = todayWindows.reduce(
    (largest, window) => Math.max(largest, window.durationMinutes),
    0,
  );
  const isWorkday = busyTodayEvents.some((event) =>
    event.eventKind.startsWith("work_"),
  );
  const largestAvailableWindow = isWorkday
    ? Math.min(rawLargestWindow, planning.profile.workdayMaxSessionMinutes)
    : rawLargestWindow;
  const decision = buildDailyDecision(
    readiness,
    primaryWorkout,
    primaryItem?.effectiveStatus === "completed",
    highLoadWithin48Hours,
    largestAvailableWindow,
  );
  const zones = getHeartRateZones(trainingProfile.profile);
  const hrTarget = primaryWorkout
    ? getPlannedHeartRateTarget(zones, primaryWorkout.intensity)
    : null;
  const primarySport = planning.primarySport.value;
  const block = currentBlock?.status === "active" && currentBlock.sportType === primarySport ? currentBlock : null;
  const selectedBlockWeek = blockWeekForDate(block, weekStart);
  const recentCutoff = berlinDayInterval(addBerlinCalendarDays(weekStart, -28)).startInclusive;
  const recentPrimary = activities.filter(
    (activity) =>
      activity.sportType === primarySport &&
      new Date(activity.activityDate) >= recentCutoff &&
      new Date(activity.activityDate) < rangeStart,
  );
  const recentDistanceKm = recentPrimary.reduce(
    (sum, activity) => sum + activity.distanceMeters / 1000,
    0,
  );
  const recentSeconds = recentPrimary.reduce(
    (sum, activity) => sum + activity.movingTimeSeconds,
    0,
  );
  const recommendationDays = buildWeeklyTargetDays(
    Array.from({ length: 7 }, (_, index) => addBerlinCalendarDays(weekStart, index)),
    planning.events,
    new Map([[todayKey, readiness.status]]),
    planning.profile.beforeLateShiftAllowed,
    planning.profile.afterNightShiftAllowed,
  ).map((day) => ({
    ...day,
    availableMinutes: planning.profile.availableWeekdays.includes(
      new Date(`${day.date}T12:00:00Z`).getUTCDay() || 7,
    )
      ? day.availableMinutes
      : 0,
  }));
  const weeklyRecommendation = recommendWeeklyTarget({
    primarySport,
    runningSessionsPerWeek:
      primarySport === "running"
        ? planning.profile.runningSessionsPerWeek
        : planning.profile.cyclingSessionsPerWeek,
    referenceGoalKm: planning.profile.weeklyDistanceGoalKm,
    days: recommendationDays,
    recentFourWeekDistanceKm: recentDistanceKm,
    recentAverageSpeedKmh:
      recentSeconds > 0 ? recentDistanceKm / (recentSeconds / 3600) : null,
    workdayMaxMinutes: planning.profile.workdayMaxSessionMinutes,
    blockTargetKm: selectedBlockWeek?.targetDistanceKm,
    blockLongRideTargetKm: selectedBlockWeek?.longRideTargetKm,
    blockPhase: selectedBlockWeek?.phase,
  });
  const dashboard = buildDashboardViewModel({
    primarySport,
    selectedSports: planning.profile.selectedSports,
    desiredSessionsPerWeek:
      primarySport === "running"
        ? planning.profile.runningSessionsPerWeek
        : planning.profile.cyclingSessionsPerWeek,
    strengthSessionsPerWeek: planning.profile.gymSummerSessions,
    weeklyGoalKm: planning.weeklyGoal.status === "valid" ? weeklyRecommendation.planningTargetKm : null,
    weekActivities,
    reconciledWorkouts: reconciled,
    today: todayKey,
    latestActivities: activities.slice(0, 5),
  });
  const weeklyGoal = dashboard.weeklyGoal.targetKm;
  const actualKm = dashboard.weeklyGoal.actualKm;
  const progress = dashboard.weeklyGoal.progressPercent ?? 0;
  const upcomingPrimary =
    reconciled.find(
      (item) =>
        item.effectiveStatus === "planned" &&
        item.workout.sportType === primarySport &&
        item.workout.scheduledDate >= todayKey,
    )?.workout ?? null;
  const fuelingWorkout =
    primaryWorkout?.sportType === primarySport ? primaryWorkout : upcomingPrimary;
  const fueling = buildFuelingPreparation(
    fuelingWorkout,
    nutrition.products,
    nutrition.presets,
  );
  const strengthVariant = primaryWorkout
    ? strengthVariantFromTitle(primaryWorkout.title)
    : null;
  const strength = strengthVariant ? STRENGTH_WORKOUTS[strengthVariant] : null;
  const latest = dashboard.latestActivities[0];
  const previewDays = [
    addBerlinCalendarDays(todayKey, 1),
    addBerlinCalendarDays(todayKey, 2),
    addBerlinCalendarDays(todayKey, 3),
  ];
  const autopilotActionsAvailable =
    primaryWorkout?.source === "automatic" &&
    (primaryWorkout.sportType === primarySport ||
      primaryWorkout.sportType === "strength") &&
    primaryItem?.effectiveStatus === "planned" &&
    query.saved !== "accepted";
  const missionSelection = selectDashboardMission(missions, primarySport);
  const mission = buildDashboardMissionControl({
    selection: missionSelection,
    activities,
    supportMode: planning.profile.supportMode,
    targetYear: planning.profile.targetYear,
    today: todayKey,
    recoveryTrackedNights: recovery.metrics.filter(
      (metric) => metric.asleepMinutes > 0,
    ).length,
  });
  const firstPlanItems = reconciled.filter(
    (item) =>
      item.effectiveStatus !== "skipped" &&
      item.workout.scheduledDate >= firstPlanWeek &&
      item.workout.scheduledDate <= firstPlanWeekEnd,
  );
  const firstPlanCounts = firstPlanItems.reduce(
    (counts, item) => {
      counts[item.workout.sportType] = (counts[item.workout.sportType] ?? 0) + 1;
      return counts;
    },
    {} as Partial<Record<PlannedWorkout["sportType"], number>>,
  );
  const nextPlanned = reconciled
    .filter((item) => item.effectiveStatus === "planned" && item.workout.scheduledDate >= todayKey)
    .sort((a, b) => a.workout.scheduledDate.localeCompare(b.workout.scheduledDate))[0] ?? null;
  const firstPlanToday = firstPlanItems.find(
    (item) => item.effectiveStatus !== "skipped" && item.workout.scheduledDate === todayKey,
  )?.workout ?? null;
  const nextPlannedWeek = nextPlanned
    ? berlinWeekRange(dateAtNoon(nextPlanned.workout.scheduledDate)).start
    : weekStart;
  const sportSummary = [
    firstPlanCounts.running ? `${firstPlanCounts.running} ${firstPlanCounts.running === 1 ? "Lauf" : "Läufe"}` : null,
    firstPlanCounts.cycling ? `${firstPlanCounts.cycling} ${firstPlanCounts.cycling === 1 ? "Radeinheit" : "Radeinheiten"}` : null,
    firstPlanCounts.strength ? `${firstPlanCounts.strength} ${firstPlanCounts.strength === 1 ? "Krafttraining" : "Krafttrainings"}` : null,
    firstPlanCounts.volleyball ? `${firstPlanCounts.volleyball}× Volleyball` : null,
  ].filter((value): value is string => value !== null);

  return (
    <>
      <PageHeader
        eyebrow={new Intl.DateTimeFormat("de-DE", {
              weekday: "long",
              day: "numeric",
              month: "long",
            }).format(today)}
        title="Heute"
        description="Tagesform, Training und die eine Entscheidung, die jetzt zählt."
        actions={<div className="grid grid-cols-2 gap-2 sm:flex">
          <Link href="/plan" className="secondary-button">
            Woche ansehen
          </Link>
          <Link href="/activities/upload" className="primary-button">
            Aktivität +
          </Link>
        </div>}
      />

      {isDemoMode && (
        <InlineAlert tone="warning">
          <strong>Demo-Modus:</strong> Verbinde Supabase, um deine persönlichen
          Empfehlungen zu sehen.
        </InlineAlert>
      )}
      {query.saved && (
        <InlineAlert tone="success">
          {{
            accepted: "Passt – die heutige Einheit bleibt genau so im Plan.",
            worse:
              "Die Einheit wurde regenerativ angepasst. Gekürzte Kilometer werden nicht erzwungen nachgeholt.",
            easy: dashboard.savedMessages.easy,
            shift: dashboard.savedMessages.shift,
            pause:
              "Heute bleibt trainingsfrei. Die restliche Woche wurde anhand deiner echten Zeitfenster neu geplant.",
          }[query.saved] ?? "Plan wurde angepasst."}
          {query.goal === "met" ? " Dein Wochenziel ist bereits erreicht." : ""}
        </InlineAlert>
      )}
      {query.error && (
        <InlineAlert tone="danger">
          {query.error}
        </InlineAlert>
      )}

      {query.firstPlan === "ready" && (
        <section className="card mb-4 overflow-hidden border-[color-mix(in_srgb,var(--accent)_35%,var(--line))] p-5 sm:mb-6 sm:p-7" aria-labelledby="first-plan-title">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="eyebrow">Setup abgeschlossen</p>
              <h2 id="first-plan-title" className="mt-2 text-2xl font-black sm:text-3xl">Dein erster Plan ist bereit.</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                {sportSummary.length > 0
                  ? `Diese Woche: ${sportSummary.join(" · ")}.`
                  : "Deine Regeln sind gespeichert; für diese Woche ist aktuell keine Einheit offen."}
              </p>
              <p className="mt-3 text-sm font-bold">
                {firstPlanToday
                  ? `Heute: ${firstPlanToday.title}`
                  : nextPlanned
                    ? `Heute ist Erholung. Als Nächstes: ${dayLabel(nextPlanned.workout.scheduledDate)} · ${nextPlanned.workout.title}`
                    : "Heute ist Erholung. Für diese Woche ist keine weitere Einheit offen."}
              </p>
              {planning.profile.selectedSports.includes("strength") &&
                firstPlanCounts.strength &&
                !workouts.some((workout) => workout.gymProgramDayId) && (
                  <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
                    Deine Krafttermine stehen bereits. Wähle im geführten Gym Builder anschließend die konkreten Übungen.
                  </p>
                )}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              {planning.profile.selectedSports.includes("strength") &&
                !workouts.some((workout) => workout.gymProgramDayId) && (
                  <Link href="/gym/programs/new?guided=1" className="secondary-button">Gym-Plan einrichten</Link>
                )}
              <Link href={`/plan?week=${firstPlanWeek}`} className="primary-button">Plan ansehen</Link>
            </div>
          </div>
        </section>
      )}

      {(query.firstPlan === "empty" || query.firstPlan === "error") && (
        <section className="card mb-4 p-5 sm:mb-6 sm:p-6">
          <p className="eyebrow">Plan braucht noch einen Anlauf</p>
          <h2 className="mt-2 text-xl font-black">Dein Profil ist sicher gespeichert.</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Prüfe deine verfügbaren Tage oder starte die deterministische Planung erneut. Ein leerer Plan wird nicht als erreichtes Wochenziel ausgegeben.
          </p>
          <form action={generateWeeklyPlan} className="mt-4">
            <input type="hidden" name="week" value={firstPlanWeek} />
            <input type="hidden" name="firstRun" value="true" />
            <button type="submit" className="primary-button">Ersten Plan erneut erstellen</button>
          </form>
        </section>
      )}

      <div className="mb-4 mt-4 sm:mb-6">
        <DashboardCheckIn readiness={readiness} decision={decision} workoutTitle={primaryWorkout?.title ?? null} />
      </div>

      <section className="card mb-4 flex flex-col gap-4 p-5 sm:mb-6 sm:flex-row sm:items-center sm:justify-between" aria-labelledby="next-up-title">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
            <DashboardIcon name={nextPlanned ? dashboardSportIcon(nextPlanned.workout.sportType) : "calendar"} />
          </span>
          <div className="min-w-0">
            <p className="eyebrow">Als Nächstes</p>
            <h2 id="next-up-title" className="mt-1 truncate text-lg font-black">
              {nextPlanned?.workout.title ?? "Noch keine weitere Einheit geplant"}
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {nextPlanned ? (
                <>
                  {dayLabel(nextPlanned.workout.scheduledDate)}
                  {nextPlanned.workout.plannedDurationMinutes ? ` · ${nextPlanned.workout.plannedDurationMinutes} min` : ""}
                  {nextPlanned.workout.plannedDistanceKm !== null ? ` · ${nextPlanned.workout.plannedDistanceKm} km` : ""}
                </>
              ) : "Öffne den Plan, um eine neue Woche zu erstellen oder eine Einheit hinzuzufügen."}
            </p>
          </div>
        </div>
        <Link href={`/plan?week=${nextPlannedWeek}`} className="secondary-button shrink-0">Plan öffnen</Link>
      </section>

      <section className="card mb-4 p-5 sm:mb-6 sm:p-6" aria-labelledby="primary-sport-week">
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-400/10 dark:text-blue-300">
            <DashboardIcon name={dashboard.sportIcon} />
          </span>
          <div>
            <p className="eyebrow">{dashboard.sportLabel}</p>
            <h2 id="primary-sport-week" className="mt-1 text-xl font-black">{dashboard.weekTitle}</h2>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {dashboard.metrics.map((metric) => (
            <div key={metric.label} className="min-w-0 rounded-2xl bg-[var(--surface-raised)] p-4">
              <BloomMetric label={metric.label} value={metric.value} />
            </div>
          ))}
          <div className="min-w-0 rounded-2xl bg-[var(--surface-raised)] p-4">
            <BloomMetric label={weeklyGoal === null ? "Trainingsfrequenz" : dashboard.weeklyGoal.label} value={dashboard.weeklyGoal.summary} />
          </div>
        </div>
        {weeklyGoal !== null && <div className="mt-5"><Progress label={`${dashboard.weeklyGoal.label} · ${Math.max(0, weeklyGoal - actualKm).toLocaleString("de-DE", { maximumFractionDigits: 1 })} km offen`} value={progress} /></div>}
        {dashboard.metrics[0].value === "–" && <p className="mt-3 text-sm text-[var(--muted)]">{dashboard.emptyText}</p>}
      </section>

      <section className="grid gap-4">
        <article className="rise-in relative overflow-hidden rounded-[1.6rem] bg-gradient-to-br from-[#4a4a4a] via-[#5b424c] to-[#8e4585] p-5 text-white shadow-[0_24px_60px_rgba(74,44,63,.24)] sm:p-8">
          <div className="aurora-drift pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-blue-400/20 blur-3xl" />
          <div className="aurora-drift pointer-events-none absolute -bottom-32 left-1/3 size-72 rounded-full bg-cyan-300/15 blur-3xl" style={{ animationDelay: "-6s" }} />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[.05] mix-blend-overlay"
            style={{
              backgroundImage:
                "repeating-linear-gradient(180deg, #fff 0px, #fff 1px, transparent 1px, transparent 3px)",
            }}
          />
          <div className="relative">
            <div
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[.68rem] font-black uppercase tracking-[.16em] ring-1 ring-inset ${decisionPillStyles[decision.level]}`}
            >
              <span className="size-1.5 rounded-full bg-current" />
              {decision.eyebrow}
            </div>
            <h2 className="font-display mt-5 max-w-3xl text-[2rem] leading-[1.04] sm:text-[3.25rem]">
              {decision.title}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-100/70 sm:text-base sm:leading-7">
              {decision.summary}
            </p>
            {decision.reasons.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {decision.reasons.slice(0, 2).map((reason) => (
                  <span
                    key={reason}
                    className="rounded-full bg-white/7 px-3 py-1.5 text-xs font-semibold text-blue-100/70 ring-1 ring-inset ring-white/8"
                  >
                    {reason}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-7 rounded-[1.25rem] border border-white/10 bg-white/7 p-4 sm:p-5">
              <div className="flex items-start gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-blue-400/15 text-blue-100">
                  <DashboardIcon
                    name={primaryWorkout ? dashboardSportIcon(primaryWorkout.sportType) : dashboard.sportIcon}
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[.65rem] font-black uppercase tracking-[.15em] text-blue-100/50">
                      Heute geplant
                    </p>
                    {primaryWorkout && (
                      <span className="rounded-full bg-white/10 px-2.5 py-1 text-[.65rem] font-bold text-blue-50">
                        {dashboard.today.find((item) => item.workout.id === primaryWorkout.id)?.sportLabel ?? dashboard.sportLabel} · {intensityLabels[primaryWorkout.intensity]}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xl font-black tracking-tight sm:text-2xl">
                    {primaryWorkout?.title ?? "Kein Training"}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm font-bold text-blue-50/75">
                    {primaryWorkout ? (
                      <>
                        <span>
                          {primaryWorkout.plannedDurationMinutes
                            ? `${primaryWorkout.plannedDurationMinutes} min`
                            : "Zeit offen"}
                        </span>
                        {primaryWorkout.plannedDistanceKm !== null && (
                          <span>{primaryWorkout.plannedDistanceKm} km</span>
                        )}
                        {hrTarget && (
                          <span>{formatHeartRateTarget(hrTarget)}</span>
                        )}
                      </>
                    ) : (
                      <span>Freier Tag – kein Nachholen nötig</span>
                    )}
                  </div>
                </div>
              </div>
              <Link
                href={primaryWorkout ? "#training-details" : "/plan"}
                className="mt-4 inline-flex min-h-10 items-center rounded-xl bg-white px-4 py-2 text-sm font-black text-[#0b2145] transition hover:bg-blue-50"
              >
                {primaryWorkout ? "Einheit ansehen" : "Plan öffnen"}{" "}
                <span className="ml-2" aria-hidden>
                  →
                </span>
              </Link>
            </div>

            {autopilotActionsAvailable && (
              <div className="mt-5 border-t border-white/10 pt-5">
                <p className="mb-3 text-[.65rem] font-black uppercase tracking-[.16em] text-blue-100/50">
                  Was passt heute?
                </p>
                <div className="grid gap-2 sm:grid-cols-3">
                  <form action={acceptTodayPlan}>
                    <input
                      type="hidden"
                      name="workoutId"
                      value={primaryWorkout.id}
                    />
                    <button
                      className="min-h-12 w-full rounded-xl bg-blue-500 px-3 py-2.5 text-sm font-black text-white shadow-lg shadow-blue-950/20 transition hover:bg-blue-400"
                      type="submit"
                    >
                      Passt so
                    </button>
                  </form>
                  <form action={generateWeeklyPlan}>
                    <input type="hidden" name="week" value={weekStart} />
                    <input
                      type="hidden"
                      name="workoutId"
                      value={primaryWorkout.id}
                    />
                    <input type="hidden" name="dashboardAction" value="pause" />
                    <button
                      className="min-h-12 w-full rounded-xl border border-white/12 bg-white/7 px-3 py-2.5 text-sm font-black text-white transition hover:bg-white/12"
                      type="submit"
                    >
                      Keine Zeit
                    </button>
                  </form>
                  <form action={adaptTodayForLowReadiness}>
                    <input
                      type="hidden"
                      name="workoutId"
                      value={primaryWorkout.id}
                    />
                    <button
                      className="min-h-12 w-full rounded-xl border border-white/12 bg-white/7 px-3 py-2.5 text-sm font-black text-white transition hover:bg-white/12"
                      type="submit"
                    >
                      Fühle mich schlechter
                    </button>
                  </form>
                </div>
                <p className="mt-3 text-xs leading-5 text-blue-100/45">
                  UltraPilot plant deterministisch neu – ohne
                  Zufallsverschiebungen oder blindes Kilometer-Nachholen.
                </p>
              </div>
            )}
          </div>
        </article>
      </section>

      <section className="mt-4 grid gap-4 sm:mt-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,.8fr)]">
        <div className="grid content-start gap-4">
          <SectionHeader title="Timeline" description="Heute und die nächsten drei Tage – kompakt und in Reihenfolge." />
          <article className="card overflow-hidden" id="training-details">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-4 sm:px-6">
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-400/10 dark:text-blue-300">
                  <DashboardIcon name="calendar" />
                </span>
                <div>
                  <p className="text-xs font-bold text-[var(--muted)]">
                    Tagesablauf
                  </p>
                  <h2 className="text-xl font-black">Heute auf einen Blick</h2>
                </div>
              </div>
              <Link
                href="/plan"
                className="text-sm font-bold text-[var(--accent)]"
              >
                Bearbeiten
              </Link>
            </div>
            <div className="p-4 sm:p-6">
              {primaryWorkout ? (
                <details
                  open
                  className="group rounded-2xl border border-blue-100 bg-blue-50/55 p-4 dark:border-blue-400/20 dark:bg-blue-400/10"
                >
                  <summary className="flex list-none items-center gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-600 text-white">
                      <DashboardIcon
                        name={dashboardSportIcon(primaryWorkout.sportType)}
                      />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[.65rem] font-black uppercase tracking-wider text-blue-600">
                        Training · flexibel
                      </p>
                      <p className="truncate font-black text-[var(--ink)]">
                        {primaryWorkout.title}
                      </p>
                    </div>
                    <span
                      className="text-xl text-blue-500 transition group-open:rotate-45"
                      aria-hidden
                    >
                      +
                    </span>
                  </summary>
                  <div className="mt-4 border-t border-blue-100 pt-4">
                    {strength ? (
                      <>
                        <p className="text-sm font-bold text-[var(--muted)]">
                          Einheit {strength.variant} · {strength.focus}
                        </p>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          {[...strength.exercises, ...strength.core].map(
                            (exercise) => (
                              <div
                                key={exercise.name}
                                className="rounded-xl bg-[var(--surface-strong)] px-4 py-3 shadow-sm"
                              >
                                <p className="font-bold">{exercise.name}</p>
                                <p className="mt-1 text-sm text-[var(--muted)]">
                                  {exercise.prescription}
                                </p>
                              </div>
                            ),
                          )}
                        </div>
                        <p className="mt-3 text-xs text-[var(--muted)]">
                          RIR 1–2 · Grundübungen 2–3 min Pause · Zubehör/Core
                          60–90 s
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="grid grid-cols-3 gap-3">
                          <Metric
                            label="Dauer"
                            value={
                              primaryWorkout.plannedDurationMinutes
                                ? `${primaryWorkout.plannedDurationMinutes} min`
                                : "Offen"
                            }
                          />
                          <Metric
                            label="Distanz"
                            value={
                              primaryWorkout.plannedDistanceKm !== null
                                ? `${primaryWorkout.plannedDistanceKm} km`
                                : "Offen"
                            }
                          />
                          <Metric
                            label="HF-Ziel"
                            value={
                              hrTarget
                                ? formatHeartRateTarget(hrTarget)
                                : "Offen"
                            }
                          />
                        </div>
                        {primaryWorkout.description && (
                          <div className="mt-4 space-y-2 text-sm leading-6 text-[var(--muted)]">
                            {primaryWorkout.description
                              .split("\n")
                              .filter(Boolean)
                              .map((line) => (
                                <p key={line}>{line}</p>
                              ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </details>
              ) : (
                <div className="rounded-2xl border border-dashed border-[var(--line)] bg-slate-50/60 p-5 dark:bg-white/[.03]">
                  <p className="font-black">Heute ist trainingsfrei.</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Erholen, Mobility oder spazieren – ohne Kilometer nachholen
                    zu müssen.
                  </p>
                </div>
              )}

              <div className="mt-3 space-y-2">
                {busyTodayEvents.length ? (
                  busyTodayEvents.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4"
                    >
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600 dark:bg-white/[.06] dark:text-slate-300">
                        <DashboardIcon name="clock" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold">{event.title}</p>
                        <p className="mt-0.5 text-xs text-[var(--muted)]">
                          {event.allDay
                            ? "Ganztägig"
                            : `${localTime(event.startsAt)}–${localTime(event.endsAt)} Uhr`}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center gap-3 rounded-2xl border border-dashed border-[var(--line)] p-4 text-sm text-[var(--muted)]">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-100">
                      <DashboardIcon name="clock" />
                    </span>
                    Keine Arbeitszeiten oder privaten Termine.
                  </div>
                )}
              </div>
            </div>
          </article>

          <article className="card p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="eyebrow">Danach</p>
                <h2 className="mt-1 text-xl font-black">
                  Die nächsten drei Tage
                </h2>
              </div>
              <Link
                href="/plan"
                className="text-sm font-bold text-[var(--accent)]"
              >
                Ganze Woche
              </Link>
            </div>
            <div className="mt-4 divide-y divide-[var(--line)]">
              {previewDays.map((key) => {
                const dayItem = reconciled.find(
                  (item) =>
                    item.workout.scheduledDate === key &&
                    item.effectiveStatus !== "skipped",
                );
                const dayWorkout = dayItem?.workout;
                const events = planning.events.filter(
                  (event) =>
                    overlapsDay(event, key) && event.eventKind !== "free",
                );
                return (
                  <div
                    key={key}
                    className="grid grid-cols-[4.6rem_1fr] gap-3 py-3"
                  >
                    <p className="text-xs font-black uppercase tracking-wider text-[var(--muted)]">
                      {dayLabel(key)}
                    </p>
                    <div>
                      <p className="font-bold">
                        {dayWorkout?.title ?? "Trainingsfrei"}
                      </p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {dayWorkout
                          ? `${dashboard.upcoming.find((item) => item.workout.id === dayWorkout.id)?.sportLabel ?? "Training"} · ${dayWorkout.plannedDurationMinutes ?? "–"} min${dayWorkout.plannedDistanceKm !== null ? ` · ${dayWorkout.plannedDistanceKm} km` : ""}`
                          : "Erholung eingeplant"}
                        {events.length
                          ? ` · ${events.map((event) => event.title).join(" · ")}`
                          : ""}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </article>
        </div>

        <aside className="grid content-start gap-4">
          <DashboardRecoverySummary readiness={readiness} />

          {dashboard.showFueling && <article className="card p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-cyan-50 text-cyan-700">
                <DashboardIcon name="fuel" />
              </span>
              <div>
                <p className="text-xs font-bold text-[var(--muted)]">
                  Verpflegung
                </p>
                <h2 className="mt-0.5 text-xl font-black">
                  {fueling && fuelingWorkout
                    ? `Für ${fuelingWorkout.scheduledDate === todayKey ? "heute" : dayLabel(fuelingWorkout.scheduledDate)}`
                    : "Nichts vorzubereiten"}
                </h2>
              </div>
            </div>
            {fueling && fuelingWorkout ? (
              <>
                <p className="mt-4 text-sm text-[var(--muted)]">
                  {fuelingWorkout.title} ·{" "}
                  {fuelingWorkout.plannedDurationMinutes} min
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-cyan-50/60 p-4">
                  <Metric
                    label="Carbs"
                    value={`${fueling.carbohydrateRateGrams} g/h`}
                  />
                  <Metric
                    label="Gesamt"
                    value={`${fueling.totalCarbohydratesGrams} g`}
                  />
                  <Metric
                    label="Flüssigkeit"
                    value={`${fueling.fluidMilliliters} ml`}
                  />
                  <Metric
                    label="Flaschen"
                    value={`${fueling.bottleCount} × 750 ml`}
                  />
                </div>
                <div className="mt-3 space-y-1 text-sm font-bold">
                  {fueling.bottleSuggestion && (
                    <p>
                      {fueling.bottleSuggestion.count}×{" "}
                      {fueling.bottleSuggestion.name}
                    </p>
                  )}
                  {fueling.productSuggestion && (
                    <p>
                      {fueling.productSuggestion.count}×{" "}
                      {fueling.productSuggestion.name}
                    </p>
                  )}
                </div>
              </>
            ) : (
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                Die nächste längere Radfahrt erscheint hier automatisch.
              </p>
            )}
            <Link
              href="/nutrition"
              className="mt-4 inline-flex text-sm font-black text-[var(--accent)]"
            >
              Verpflegung öffnen →
            </Link>
          </article>}

          {(strengthProgress || activeGymSession) && (
            <article className="card p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300">
                  <DashboardIcon name="strength" />
                </span>
                <div>
                  <p className="text-xs font-bold text-[var(--muted)]">
                    Kraft · diese Woche
                  </p>
                  <h2 className="mt-0.5 text-xl font-black">
                    {strengthProgress?.completed ?? 0} / {strengthProgress?.planned ?? 0}{" "}
                    <span className="text-base font-bold text-[var(--muted)]">
                      Einheiten
                    </span>
                  </h2>
                </div>
              </div>
              <p className="mt-4 text-sm text-[var(--muted)]">
                {activeGymSession
                  ? `${activeGymSession.name} läuft und ist serverseitig gespeichert.`
                  : nextStrengthWorkout
                  ? `Nächste Einheit: ${nextStrengthWorkout.title} · ${nextStrengthWorkout.scheduledDate === todayKey ? "heute" : dayLabel(nextStrengthWorkout.scheduledDate)}`
                  : "Keine weitere Kraft-Einheit diese Woche geplant."}
              </p>
              <Link
                href={activeGymSession ? `/gym/workout/${activeGymSession.id}` : "/plan"}
                className="mt-4 inline-flex text-sm font-black text-[var(--accent)]"
              >
                {activeGymSession ? "Training fortsetzen →" : "Trainingsplan öffnen →"}
              </Link>
            </article>
          )}

          <DashboardMissionSummary
            selection={missionSelection}
            control={mission}
            fallbackGoal={{
              name: planning.profile.eventName,
              targetDate: planning.profile.targetDate,
              distanceKm: planning.profile.eventDistanceKm,
            }}
          />

          <article className="card p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-400/10 dark:text-blue-300">
                <DashboardIcon name={latest?.icon ?? "activity"} />
              </span>
              <div>
                <p className="text-xs font-bold text-[var(--muted)]">
                  Letzte Aktivität
                </p>
                <h2 className="mt-0.5 line-clamp-1 text-lg font-black">
                  {latest?.activity.title ?? "Noch keine Aktivität"}
                </h2>
              </div>
            </div>
            {latest ? (
              <Link
                href={`/activities/${latest.activity.id}`}
                className="mt-4 block rounded-2xl bg-slate-50/80 p-4 transition hover:bg-blue-50 dark:bg-white/[.04] dark:hover:bg-blue-400/10"
              >
                <div className="grid grid-cols-3 gap-3">
                  <Metric
                    label="Distanz"
                    value={latest.activity.sportType === "strength" || latest.activity.sportType === "volleyball" || latest.activity.sportType === "other" || latest.activity.distanceMeters <= 0 ? "–" : `${(latest.activity.distanceMeters / 1000).toLocaleString("de-DE", { maximumFractionDigits: 1 })} km`}
                  />
                  <Metric
                    label="Zeit"
                    value={formatDuration(latest.activity.movingTimeSeconds)}
                  />
                  <Metric
                    label={latest.metricLabel}
                    value={latest.metricValue}
                  />
                </div>
                <p className="mt-3 text-sm font-black text-[var(--accent)]">
                  Auswerten →
                </p>
              </Link>
            ) : (
              <p className="mt-3 text-sm text-[var(--muted)]">
                Importiere deine erste Aktivität.
              </p>
            )}
          </article>
        </aside>
      </section>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[.65rem] font-bold uppercase tracking-wider text-current opacity-50">
        {label}
      </p>
      <p className="mt-1 font-black leading-tight">{value}</p>
    </div>
  );
}

function DashboardIcon({
  name,
}: {
  name:
    | "activity"
    | "bike"
    | "calendar"
    | "clock"
    | "flag"
    | "fuel"
    | "pulse"
    | "run"
    | "volleyball"
    | "strength";
}) {
  const paths = {
    activity: (
      <>
        <path d="M4 12h3l2-5 4 10 2-5h5" />
        <path d="M4 4v16h16" />
      </>
    ),
    bike: (
      <>
        <circle cx="6" cy="17" r="3" />
        <circle cx="18" cy="17" r="3" />
        <path d="m6 17 4-8 3 8m-5-4h8l-3-6h3" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M16 3v4M8 3v4M3 10h18" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    flag: (
      <>
        <path d="M5 21V4m0 1h11l-2 4 2 4H5" />
      </>
    ),
    fuel: (
      <>
        <path d="M8 3h8v18H8zM8 8h8M6 21h12" />
        <path d="M16 6h2l2 3v7a2 2 0 0 1-2 2h-2" />
      </>
    ),
    pulse: (
      <>
        <path d="M3 12h4l2-6 4 12 2-6h6" />
      </>
    ),
    run: (
      <>
        <circle cx="13" cy="5" r="2" />
        <path d="m10 9 3-2 3 3m-6-1-2 5 4 2 2 5m-2-5-4 4m5-9-2 4" />
      </>
    ),
    volleyball: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 3c2 3 3 6 2 9M4 8c4 0 7 1 10 4m6 4c-4 0-7-1-10-4" />
      </>
    ),
    strength: (
      <>
        <path d="M6 8v8M3 10v4m15-6v8m3-6v4M6 12h12" />
      </>
    ),
  };
  return (
    <svg
      aria-hidden="true"
      className="size-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

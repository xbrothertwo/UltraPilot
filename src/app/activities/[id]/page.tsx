import Link from "next/link";
import { notFound } from "next/navigation";
import { ActivityCharts } from "@/components/activity-charts";
import { ActivityJournal } from "@/components/activity-journal";
import { DeleteActivityButton } from "@/components/delete-activity-button";
import { NutritionPlanner } from "@/components/nutrition-planner";
import { PageHeading } from "@/components/page-heading";
import { RenameActivityForm } from "@/components/rename-activity-form";
import { RideDebrief } from "@/components/ride-debrief";
import { StatCard } from "@/components/stat-card";
import { ZoneDistribution } from "@/components/zone-distribution";
import { getActivityById } from "@/lib/activities";
import { getActivityJournal } from "@/lib/activity-journal";
import { getActivityChartStreams, getRawActivityStreams } from "@/lib/activity-streams";
import { formatDate, formatDistance, formatDuration, formatPace } from "@/lib/format";
import { isDemoMode } from "@/lib/demo-data";
import { analyzeNutrition } from "@/lib/nutrition-analysis";
import { getNutritionPlanner } from "@/lib/nutrition-planner";
import { getTrainingProfile } from "@/lib/training-profile";
import { calculateHeartRateDrift, calculateTimeInZones, calculateTrainingLoad, getHeartRateZones, getPowerZones } from "@/lib/training-zones";
import { getPlannedWorkouts } from "@/lib/planning/workouts";
import { reconcilePlannedWorkouts } from "@/lib/planning/reconciliation";
import { buildRideDebrief } from "@/lib/ride-debrief";
import { calculateActivityLoads, type LoadStream } from "@/lib/training-load";
import { activitySportLabels } from "@/lib/sports";

type ActivityPageProps = { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; error?: string }> };

function localDate(value: Date): string { return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(value); }
function addDays(key: string, count: number): string { const date = new Date(`${key}T12:00:00`); date.setDate(date.getDate() + count); return localDate(date); }

export async function generateMetadata({ params }: ActivityPageProps) {
  const { id } = await params;
  const activity = await getActivityById(id);
  return { title: activity?.title ?? "Aktivität" };
}

export default async function ActivityPage({ params, searchParams }: ActivityPageProps) {
  const { id } = await params;
  const query = await searchParams;
  const activity = await getActivityById(id);
  if (!activity) notFound();
  const activityDay = localDate(new Date(activity.activityDate));
  const isCycling = activity.sportType === "cycling";
  const hasDistance = activity.sportType === "cycling" || activity.sportType === "running";
  const [streams, rawStreams, { profile }, journal, planner, nearbyWorkouts] = await Promise.all([
    getActivityChartStreams(activity.id, activity.activityDate, activity.elapsedTimeSeconds, activity.sportType === "running"),
    getRawActivityStreams(activity.id),
    getTrainingProfile(),
    getActivityJournal(activity.id),
    getNutritionPlanner(activity.id),
    getPlannedWorkouts(addDays(activityDay, -1), addDays(activityDay, 14)),
  ]);
  const heartRateZones = getHeartRateZones(profile);
  const powerZones = getPowerZones(profile);
  const heartRateSamples = rawStreams.find((stream) => stream.type === "heart_rate")?.samples ?? [];
  const powerSamples = rawStreams.find((stream) => stream.type === "power")?.samples ?? [];
  const heartRateDistribution = heartRateZones && heartRateSamples.length ? calculateTimeInZones(heartRateSamples, heartRateZones) : null;
  const powerDistribution = powerZones && powerSamples.length ? calculateTimeInZones(powerSamples, powerZones) : null;
  const trainingLoad = calculateTrainingLoad(activity.normalizedPower, activity.movingTimeSeconds, profile.ftpWatts);
  const heartRateDrift = calculateHeartRateDrift(heartRateSamples, powerSamples);
  const nutritionSummary = analyzeNutrition(journal.entries, activity.movingTimeSeconds, activity.elapsedTimeSeconds);
  const reconciled = reconcilePlannedWorkouts(nearbyWorkouts, [activity]);
  const matched = reconciled.find((item) => item.activity?.id === activity.id) ?? null;
  const loadStreams: LoadStream[] = rawStreams.flatMap((stream) => stream.type === "heart_rate" || stream.type === "power" ? [{ activityId: activity.id, type: stream.type, samples: stream.samples }] : []);
  const activityLoad = calculateActivityLoads([activity], [{ activityId: activity.id, perceivedExertion: journal.feedback?.perceivedExertion ?? null }], loadStreams, profile)[0] ?? null;
  const debrief = buildRideDebrief({ workout: matched?.workout ?? null, comparison: matched?.comparison ?? null, load: activityLoad, nutrition: nutritionSummary, nutritionRecorded: journal.entries.length > 0, feedback: journal.feedback, heartRateDriftPercent: heartRateDrift });
  const actionableDate = [addDays(activityDay, 1), localDate(new Date())].sort().at(-1)!;
  const nextWorkout = nearbyWorkouts.find((workout) => workout.id !== matched?.workout.id && workout.sportType === "cycling" && workout.status === "planned" && workout.scheduledDate >= actionableDate) ?? null;
  const source = activity.source === "demo" ? "Demo-Aktivität" : activity.source === "apple_health_workout" ? "Apple Health" : activity.source.startsWith("fit") ? (activity.source.includes("apple_watch") ? "FIT-Upload + ergänzende Herzfrequenzdatei" : "FIT-Upload") : activity.source.includes("apple_watch") ? "GPX-Upload + ergänzende Herzfrequenzdatei" : "GPX-Upload";

  return (
    <>
      <PageHeading eyebrow={formatDate(activity.activityDate)} title={activity.title} description={`${activitySportLabels[activity.sportType]} · ${source}`} action={!isDemoMode ? <div className="flex flex-wrap gap-2"><RenameActivityForm activityId={activity.id} title={activity.title} /><DeleteActivityButton activityId={activity.id} title={activity.title} /></div> : undefined} />
      {query.saved && <p className="mb-5 rounded-xl bg-emerald-100 px-4 py-3 text-sm font-semibold text-emerald-900">{{ renamed: "Aktivität wurde umbenannt.", deleted: "Eintrag gelöscht.", feedback: "Feedback gespeichert und Debrief aktualisiert.", product: "Produkt gespeichert.", "product-deleted": "Produkt entfernt.", timeline: "Produkt auf der Timeline eingetragen.", "timeline-updated": "Timeline-Eintrag aktualisiert.", bottle: "Flaschenplan erstellt.", "bottle-deleted": "Flaschenplan und abgeleitete Einträge gelöscht.", "next-easy": "Die nächste geplante Fahrt wurde gelockert." }[query.saved] ?? "Ernährungseintrag gespeichert."}</p>}
      {query.error && <p className="mb-5 rounded-xl bg-red-100 px-4 py-3 text-sm font-semibold text-red-900">{query.error}</p>}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {hasDistance ? <StatCard label="Distanz" value={formatDistance(activity.distanceMeters)} detail="aufgezeichnete Strecke" /> : <StatCard label="Ø Herzfrequenz" value={activity.averageHeartRate === null ? "–" : `${activity.averageHeartRate} bpm`} detail="aufgezeichneter Durchschnitt" />}
        <StatCard label="Bewegungszeit" value={formatDuration(activity.movingTimeSeconds)} detail={`verstrichen ${formatDuration(activity.elapsedTimeSeconds)}`} />
        {hasDistance ? <StatCard label="Höhengewinn" value={`${Math.round(activity.elevationGainMeters).toLocaleString("de-DE")} m`} detail="positive Differenzen" /> : <StatCard label="Max. Herzfrequenz" value={activity.maximumHeartRate === null ? "–" : `${activity.maximumHeartRate} bpm`} detail="höchster Messwert" />}
        {hasDistance ? <StatCard label={activity.sportType === "running" ? "Ø Pace" : "Ø Geschwindigkeit"} value={activity.sportType === "running" ? formatPace(activity.averageSpeedKmh) : activity.averageSpeedKmh === null ? "–" : `${activity.averageSpeedKmh.toLocaleString("de-DE", { maximumFractionDigits: 1 })} km/h`} detail="Distanz / Bewegungszeit" /> : <StatCard label="Belastung" value={activityLoad?.points === null || activityLoad?.points === undefined ? "–" : `${activityLoad.points} UPL`} detail={activityLoad?.method === "heart_rate" ? "aus deinen HF-Zonen" : "noch nicht berechenbar"} />}
      </section>
      {isCycling && <RideDebrief activityId={activity.id} result={debrief} matchedWorkout={matched?.workout ?? null} nextWorkout={nextWorkout} editable={!isDemoMode} />}
      <section className="card mt-6 p-6">
        <h2 className="text-lg font-bold">Leistungsdaten</h2>
        <dl className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[["Ø Herzfrequenz", activity.averageHeartRate === null ? "–" : `${activity.averageHeartRate} bpm`], ["Max. Herzfrequenz", activity.maximumHeartRate === null ? "–" : `${activity.maximumHeartRate} bpm`], ["Ø Leistung", activity.averagePower === null ? "–" : `${activity.averagePower} W`], ["Normalized Power", activity.normalizedPower === null ? "–" : `${activity.normalizedPower} W`]].map(([term, value]) => <div key={term}><dt className="text-sm text-[var(--muted)]">{term}</dt><dd className="mt-1 font-semibold">{value}</dd></div>)}
        </dl>
      </section>
      <section className="card mt-6 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-lg font-bold">Trainingszonen & Belastung</h2><p className="mt-1 text-sm text-[var(--muted)]">Deterministisch aus deinen Messwerten und persönlichen Einstellungen.</p></div><Link href="/settings" className="text-sm font-bold text-[var(--accent)]">Zonen einstellen →</Link></div>
        {(trainingLoad || heartRateDrift !== null) && <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{trainingLoad && <><div className="rounded-2xl bg-blue-50/45 p-4"><dt className="text-sm text-[var(--muted)]">Intensity Factor (IF)</dt><dd className="mt-1 text-2xl font-bold">{trainingLoad.intensityFactor.toLocaleString("de-DE", { maximumFractionDigits: 2 })}</dd></div><div className="rounded-2xl bg-blue-50/45 p-4"><dt className="text-sm text-[var(--muted)]">Training Stress Score (TSS)</dt><dd className="mt-1 text-2xl font-bold">{Math.round(trainingLoad.tss)}</dd></div></>}{heartRateDrift !== null && <div className="rounded-2xl bg-blue-50/45 p-4"><dt className="text-sm text-[var(--muted)]">Herzfrequenzdrift</dt><dd className="mt-1 text-2xl font-bold">{heartRateDrift.toLocaleString("de-DE", { maximumFractionDigits: 1 })} %</dd><p className="mt-1 text-xs text-[var(--muted)]">Effizienzverlust Watt / bpm</p></div>}</dl>}
        {(heartRateDistribution || powerDistribution) ? <div className="mt-7 grid gap-8 xl:grid-cols-2">{heartRateDistribution && <ZoneDistribution title="Herzfrequenz" unit="bpm" zones={heartRateDistribution} />}{powerDistribution && <ZoneDistribution title="Leistung" unit="W" zones={powerDistribution} />}</div> : <p className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-950">Für die Zonenanzeige fehlen entweder persönliche Referenzwerte oder passende Herzfrequenz-/Leistungssamples. Es werden keine Werte geschätzt.</p>}
        <p className="mt-5 text-xs leading-5 text-[var(--muted)]">Messintervalle über 10 Sekunden werden nicht einer Zone zugerechnet. IF und TSS erscheinen nur mit FTP und Normalized Power. Die Herzfrequenzdrift benötigt mindestens 20 Minuten gleichzeitig aufgezeichnete Puls- und Leistungsdaten mit mindestens 50 % Abdeckung je Hälfte.</p>
      </section>
      <ActivityCharts streams={streams} nutritionEntries={journal.entries} elapsedTimeSeconds={activity.elapsedTimeSeconds} />
      {isCycling && <NutritionPlanner activityId={activity.id} elapsedTimeSeconds={activity.elapsedTimeSeconds} products={planner.products} bottles={planner.bottles} presets={planner.presets} entries={journal.entries} editable={!isDemoMode} ready={planner.ready && planner.presetsReady} />}
      <ActivityJournal activityId={activity.id} entries={journal.entries} feedback={journal.feedback} summary={nutritionSummary} editable={!isDemoMode} feedbackDetailsReady={journal.feedbackDetailsReady} showNutrition={isCycling} />
    </>
  );
}

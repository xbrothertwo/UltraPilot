import Link from "next/link";
import { ActivityArchive } from "@/components/activity-archive";
import { PageHeading } from "@/components/page-heading";
import { getActivities } from "@/lib/activities";
import { isDemoMode } from "@/lib/demo-data";
import { getGymHistory } from "@/lib/gym/data";
import { reconcilePlannedWorkouts } from "@/lib/planning/reconciliation";
import { getPlannedWorkouts } from "@/lib/planning/workouts";
import { buildTrainingHistory } from "@/lib/training-history";

export const metadata = { title: "Aktivitäten" };
export const dynamic = "force-dynamic";

function addDays(key: string, count: number): string {
  const date = new Date(`${key}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}

export default async function ActivitiesPage({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const query = await searchParams;
  const [activities, gymHistory] = await Promise.all([getActivities(), getGymHistory(500)]);
  const occurred = [...activities.map((activity) => activity.activityDate), ...gymHistory.map((session) => session.startedAt)].sort();
  const from = occurred[0]?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
  const until = occurred.at(-1)?.slice(0, 10) ?? from;
  const plannedWorkouts = await getPlannedWorkouts(addDays(from, -1), addDays(until, 1));
  const reconciled = reconcilePlannedWorkouts(plannedWorkouts, activities);
  const entries = buildTrainingHistory(activities, gymHistory, reconciled, plannedWorkouts);

  return <>
    <PageHeading eyebrow="Dein Trainingsarchiv" title="Was du trainiert hast – und wie es zum Plan passt." description="Läufe, Radfahrten, Gym und Volleyball mit den jeweils relevanten Messwerten, nicht als generische Datentabelle." action={<Link href="/activities/upload" className="primary-button">+ Aktivität importieren</Link>} />
    {query.deleted === "1" && <p className="mb-5 rounded-xl bg-emerald-100 px-4 py-3 text-sm font-semibold text-emerald-900 dark:bg-emerald-400/15 dark:text-emerald-100">Aktivität und zugehörige Dateien wurden gelöscht.</p>}
    {isDemoMode && <p className="mb-4 text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Beispieldaten</p>}
    {entries.length ? <ActivityArchive entries={entries} now={new Date().toISOString()} /> : <div className="card p-10 text-center"><p className="text-xl font-black">Dein Trainingsarchiv ist bereit</p><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[var(--muted)]">Importiere deinen ersten Lauf oder deine erste Fahrt. Abgeschlossene Gym-Sessions erscheinen ebenfalls automatisch hier.</p><Link href="/activities/upload" className="primary-button mt-5">Erste Aktivität importieren</Link></div>}
  </>;
}

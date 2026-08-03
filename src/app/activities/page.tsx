import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { isDemoMode } from "@/lib/demo-data";
import { formatDate, formatDistance, formatDuration } from "@/lib/format";
import { getActivities } from "@/lib/activities";

export const metadata = { title: "Aktivitäten" };

export const dynamic = "force-dynamic";

export default async function ActivitiesPage({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const query = await searchParams;
  const activities = await getActivities();
  return (
    <>
      <PageHeading eyebrow="Dein Trainingsarchiv" title="Aktivitäten" description="Jede Fahrt, ihre Messwerte und deine Notizen an einem Ort."
        action={<Link href="/activities/upload" className="primary-button">+ Aktivität importieren</Link>} />
      {query.deleted === "1" && <p className="mb-5 rounded-xl bg-emerald-100 px-4 py-3 text-sm font-semibold text-emerald-900">Aktivität und zugehörige Dateien wurden gelöscht.</p>}
      <div className="card overflow-hidden">
        <div className="border-b border-[var(--line)] px-5 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">{isDemoMode ? "Beispieldaten" : "Aktivitäten"}</div>
        {activities.length ? activities.map((activity) => <Link key={activity.id} href={`/activities/${activity.id}`} className="block border-b border-[var(--line)] p-4 transition last:border-b-0 hover:bg-emerald-50/40 sm:grid sm:grid-cols-[1fr_repeat(3,auto)] sm:items-center sm:gap-10 sm:p-5">
          <div><p className="font-semibold">{activity.title}</p><p className="mt-1 text-sm text-[var(--muted)]">{formatDate(activity.activityDate)} · Radfahren</p></div>
          <div className="mt-4 grid grid-cols-3 gap-3 border-t border-[var(--line)] pt-3 sm:contents">
            <div><p className="text-xs text-[var(--muted)]">Distanz</p><p className="font-semibold">{formatDistance(activity.distanceMeters)}</p></div>
            <div><p className="text-xs text-[var(--muted)]">Bewegung</p><p className="font-semibold">{formatDuration(activity.movingTimeSeconds)}</p></div>
            <div><p className="text-xs text-[var(--muted)]">Anstieg</p><p className="font-semibold">{Math.round(activity.elevationGainMeters).toLocaleString("de-DE")} m</p></div>
          </div>
        </Link>) : <div className="p-8 text-center"><p className="font-semibold">Noch keine Aktivitäten</p><p className="mt-1 text-sm text-[var(--muted)]">Dein erster GPX-Upload erscheint anschließend hier.</p></div>}
      </div>
    </>
  );
}

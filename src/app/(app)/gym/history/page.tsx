import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { getExerciseLibrary, getGymHistory, getGymPrograms } from "@/lib/gym/data";

export const metadata = { title: "Gym-History" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ period?: string; program?: string; exercise?: string }> };
function historySince(days: string): string { return new Date(Date.now() - Number(days) * 86400000).toISOString(); }

export default async function GymHistoryPage({ searchParams }: Props) {
  const query = await searchParams;
  const period = ["30", "90", "365", "all"].includes(query.period ?? "") ? query.period! : "90";
  const since = period === "all" ? undefined : historySince(period);
  const [history, programs, exercises] = await Promise.all([
    getGymHistory(100, { since, programId: query.program || undefined, exerciseId: query.exercise || undefined }),
    getGymPrograms(),
    getExerciseLibrary(),
  ]);
  return <><PageHeading eyebrow="Gym · History" title="Jede Session bleibt nachvollziehbar." description="Abgeschlossene Sätze verwenden Exercise-Snapshots und bleiben auch nach späteren Programmänderungen verständlich."/>
    <form className="card mb-5 grid gap-3 p-4 sm:grid-cols-3 lg:grid-cols-[10rem_1fr_1fr_auto]" aria-label="Gym-History filtern"><label className="text-xs font-bold text-[var(--muted)]">Zeitraum<select name="period" defaultValue={period} className="mt-1 min-h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-[var(--ink)]"><option value="30">30 Tage</option><option value="90">90 Tage</option><option value="365">1 Jahr</option><option value="all">Gesamt</option></select></label><label className="text-xs font-bold text-[var(--muted)]">Programm<select name="program" defaultValue={query.program ?? ""} className="mt-1 min-h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-[var(--ink)]"><option value="">Alle Programme</option>{programs.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}</select></label><label className="text-xs font-bold text-[var(--muted)]">Übung<select name="exercise" defaultValue={query.exercise ?? ""} className="mt-1 min-h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-[var(--ink)]"><option value="">Alle Übungen</option>{exercises.map((exercise) => <option key={exercise.id} value={exercise.id}>{exercise.name}</option>)}</select></label><button className="secondary-button self-end">Filtern</button></form>
    {history.length ? <div className="card divide-y divide-[var(--line)] overflow-hidden">{history.map((session) => <Link key={session.id} href={`/gym/workout/${session.id}`} className="grid gap-2 p-4 transition hover:bg-[var(--surface)] sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-6"><div><p className="font-black">{session.name}</p><p className="mt-1 text-xs text-[var(--muted)]">{new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(session.startedAt))}{session.programName ? ` · ${session.programName}` : ""}{session.durationSeconds !== null ? ` · ${Math.round(session.durationSeconds / 60)} min` : ""}</p></div><span className="text-sm font-bold">{session.exerciseCount} Übungen</span><span className="text-sm font-bold">{session.workingSets} Arbeitssätze</span></Link>)}</div> : <section className="card p-10 text-center"><h2 className="text-xl font-black">Keine passenden Gym-Sessions</h2><p className="mt-2 text-sm text-[var(--muted)]">Passe die Filter an oder schließe dein erstes Workout ab.</p><Link href="/gym" className="primary-button mt-5">Training starten</Link></section>}
  </>;
}

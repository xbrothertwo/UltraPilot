import Link from "next/link";
import { notFound } from "next/navigation";
import { WorkoutLogger } from "@/components/gym/workout-logger";
import { getExerciseLibrary, getGymSession } from "@/lib/gym/data";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; saved?: string; finished?: string }> };

export default async function GymWorkoutPage({ params, searchParams }: Props) {
  const { id } = await params;
  const query = await searchParams;
  const [session, exercises] = await Promise.all([getGymSession(id), getExerciseLibrary()]);
  if (!session) notFound();
  const completedSets = session.exercises.flatMap((exercise) => exercise.sets).filter((set) => set.completed && set.setType !== "warmup");
  const reps = completedSets.reduce((sum, set) => sum + (set.repetitions ?? 0), 0);
  const volume = completedSets.reduce((sum, set) => sum + (set.weightKg !== null && set.repetitions !== null && (set.loadMode === "external" || set.loadMode === "added" || set.loadMode === null) ? set.weightKg * set.repetitions : 0), 0);
  return <>{query.error ? <p role="alert" className="mb-4 rounded-xl bg-[var(--danger-soft)] p-3 text-sm font-bold text-[var(--danger)]">{query.error}</p> : null}{session.status === "completed" ? <section className="card mb-5 p-6"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">Workout Summary</p><h1 className="mt-2 text-3xl font-black">{session.name}</h1><p className="mt-2 text-sm text-[var(--muted)]">{new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(session.startedAt))}</p></div><Link href="/gym/history" className="secondary-button">Zur History</Link></div><dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4"><div className="rounded-xl bg-[var(--surface)] p-3"><dt className="text-xs font-bold text-[var(--muted)]">Dauer</dt><dd className="mt-1 text-xl font-black">{session.durationSeconds === null ? "–" : `${Math.round(session.durationSeconds / 60)} min`}</dd></div><div className="rounded-xl bg-[var(--surface)] p-3"><dt className="text-xs font-bold text-[var(--muted)]">Übungen</dt><dd className="mt-1 text-xl font-black">{session.exercises.filter((exercise) => !exercise.skipped).length}</dd></div><div className="rounded-xl bg-[var(--surface)] p-3"><dt className="text-xs font-bold text-[var(--muted)]">Arbeitssätze</dt><dd className="mt-1 text-xl font-black">{completedSets.length}</dd></div><div className="rounded-xl bg-[var(--surface)] p-3"><dt className="text-xs font-bold text-[var(--muted)]">Reps / Volume</dt><dd className="mt-1 text-xl font-black">{reps}{volume > 0 ? ` · ${Math.round(volume).toLocaleString("de-DE")} kg` : ""}</dd></div></dl></section> : null}<WorkoutLogger session={session} exercises={exercises}/></>;
}

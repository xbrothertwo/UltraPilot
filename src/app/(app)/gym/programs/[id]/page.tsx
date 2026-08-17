import Link from "next/link";
import { notFound } from "next/navigation";
import { scheduleGymProgramWeek, startGymWorkout } from "@/app/gym/actions";
import { PageHeading } from "@/components/page-heading";
import { isDemoMode } from "@/lib/demo-data";
import { getGymProgram } from "@/lib/gym/data";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; saved?: string }> };
function monday(): string { const date = new Date(); const day = date.getDay(); date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day)); return date.toISOString().slice(0, 10); }

export default async function GymProgramPage({ params, searchParams }: Props) {
  const { id } = await params;
  const query = await searchParams;
  const program = await getGymProgram(id);
  if (!program) notFound();
  return <><PageHeading eyebrow={`Gym · ${program.active ? "Aktives Programm" : "Programm"}`} title={program.name} description={program.description ?? `${program.trainingDaysPerWeek} Trainingstage · ${program.goal}`}/>{query.error ? <p role="alert" className="mb-4 rounded-xl bg-[var(--danger-soft)] p-3 text-sm font-bold text-[var(--danger)]">{query.error}</p> : null}
    <div className="mb-5 flex flex-wrap gap-3"><Link href={`/gym/programs/${id}/edit`} className="secondary-button">Programm bearbeiten</Link><form action={scheduleGymProgramWeek} className="flex flex-wrap gap-2"><input type="hidden" name="programId" value={id}/><label className="sr-only" htmlFor="gym-week-start">Wochenstart</label><input id="gym-week-start" name="weekStart" type="date" defaultValue={monday()} className="min-h-12 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3"/><button disabled={isDemoMode} className="primary-button disabled:opacity-50">In Kalender planen</button></form></div>
    {program.days.length ? <div className="grid gap-4 xl:grid-cols-2">{program.days.map((day) => <article key={day.id} className="card overflow-hidden"><header className="flex items-start justify-between gap-3 border-b border-[var(--line)] p-5"><div><p className="eyebrow">Tag {day.position + 1}</p><h2 className="mt-2 text-xl font-black">{day.name}</h2><p className="mt-1 text-sm text-[var(--muted)]">ca. {day.estimatedDurationMinutes ?? 60} min · {day.exercises.length} Übungen</p></div><form action={startGymWorkout}><input type="hidden" name="programDayId" value={day.id}/><button disabled={isDemoMode} className="secondary-button disabled:opacity-50">Starten</button></form></header><ol className="divide-y divide-[var(--line)]">{day.exercises.map((exercise) => <li key={exercise.id} className="flex items-start justify-between gap-4 px-5 py-3"><div><Link href={`/gym/exercises/${exercise.exerciseId}`} className="font-black hover:text-[var(--accent-dark)]">{exercise.exerciseName}</Link><p className="mt-1 text-xs text-[var(--muted)]">{exercise.trackingType.replaceAll("_", " ")}{exercise.notes ? ` · ${exercise.notes}` : ""}</p></div><p className="shrink-0 text-right text-sm font-bold">{exercise.workingSets} × {exercise.repMin ?? "–"}{exercise.repMax !== null ? `–${exercise.repMax}` : ""}<span className="block text-xs font-normal text-[var(--muted)]">{exercise.targetRir !== null ? `RIR ${exercise.targetRir} · ` : ""}{exercise.restSeconds}s</span></p></li>)}</ol></article>)}</div> : <section className="card p-10 text-center"><h2 className="text-xl font-black">Dieses Programm hat noch keine Trainingstage</h2><Link href={`/gym/programs/${id}/edit`} className="primary-button mt-5">Programm bearbeiten</Link></section>}
  </>;
}

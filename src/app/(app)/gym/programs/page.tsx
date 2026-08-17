import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { getGymPrograms } from "@/lib/gym/data";

export const metadata = { title: "Gym-Programme" };
export const dynamic = "force-dynamic";

export default async function GymProgramsPage() {
  const programs = await getGymPrograms();
  return <><PageHeading eyebrow="Gym · Programme" title="Dein Krafttraining als ruhiges System." description="Programmtage bleiben editierbar und können idempotent in den gemeinsamen Wochenkalender gelegt werden." />
    <div className="mb-5 flex justify-end"><Link href="/gym/programs/new" className="primary-button">Neues Programm</Link></div>
    {programs.length ? <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{programs.map((program) => <li key={program.id} className="card p-5"><div className="flex items-center justify-between gap-3"><span className={`rounded-full px-2.5 py-1 text-xs font-black ${program.active ? "bg-[var(--success-soft)] text-[var(--success)]" : "bg-[var(--surface)] text-[var(--muted)]"}`}>{program.active ? "Aktiv" : program.archivedAt ? "Archiviert" : "Inaktiv"}</span><span className="text-xs font-bold text-[var(--muted)]">{program.trainingDaysPerWeek} Tage</span></div><h2 className="mt-4 break-words text-xl font-black">{program.name}</h2><p className="mt-2 line-clamp-2 text-sm text-[var(--muted)]">{program.description || program.goal}</p><Link href={`/gym/programs/${program.id}`} className="secondary-button mt-5 w-full">Programm öffnen</Link></li>)}</ul> : <section className="card p-10 text-center"><h2 className="text-xl font-black">Noch keine Programme</h2><p className="mt-2 text-sm text-[var(--muted)]">Baue manuell oder starte mit dem regelbasierten Builder.</p><Link href="/gym/programs/new" className="primary-button mt-5">Erstes Programm bauen</Link></section>}
  </>;
}

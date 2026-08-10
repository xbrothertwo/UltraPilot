import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading } from "@/components/page-heading";
import { updateTrainingBlockWeek } from "@/app/plan/block-actions";
import { getTrainingBlockById } from "@/lib/planning/blocks";
import { getPlannedWorkouts } from "@/lib/planning/workouts";

export const metadata = { title: "Trainingsblock" };
export const dynamic = "force-dynamic";

const phaseLabels = { foundation: "Grundlage", build: "Aufbau", load: "Belastung", peak: "Peak", recovery: "Erholung" } as const;
const sportLabels = { cycling: "Radfahren", running: "Laufen" } as const;
const statusLabels = { active: "Aktiv", paused: "Pausiert", completed: "Abgeschlossen", archived: "Archiviert" } as const;
const inputClass = "mt-1.5 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 disabled:opacity-60";

function weekEnd(weekStart: string): string {
  const end = new Date(`${weekStart}T12:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 6);
  return end.toISOString().slice(0, 10);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit" }).format(new Date(`${value}T12:00:00`));
}

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; error?: string }> };

export default async function TrainingBlockDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const query = await searchParams;
  const block = await getTrainingBlockById(id);
  if (!block) notFound();
  const workouts = block.weeks.length ? await getPlannedWorkouts(block.weeks[0].weekStart, weekEnd(block.weeks.at(-1)!.weekStart)) : [];
  const editable = block.status === "active" || block.status === "paused";

  return (
    <>
      <PageHeading
        eyebrow={`Trainingsblock · ${sportLabels[block.sportType]}`}
        title={block.name}
        description={block.goal ?? "Kein Blockziel hinterlegt."}
        action={<Link href="/plan" className="primary-button">Zurück zum Plan</Link>}
      />
      {query.saved === "week-updated" && <p className="mb-5 rounded-xl bg-emerald-100 px-4 py-3 text-sm font-bold text-emerald-900">Wochenziel gespeichert.</p>}
      {query.error && <p className="mb-5 rounded-xl bg-red-100 px-4 py-3 text-sm font-bold text-red-900">{query.error}</p>}

      <section className="card mb-6 p-5">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="rounded-full bg-slate-100 px-3 py-1 font-black text-slate-700">{statusLabels[block.status]}</span>
          <span className="text-[var(--muted)]">
            {new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short" }).format(new Date(`${block.startDate}T12:00:00`))} – {new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${block.endDate}T12:00:00`))} · {block.weekCount} Wochen
          </span>
        </div>
        {!editable && <p className="mt-3 text-xs leading-5 text-[var(--muted)]">Dieser Block ist {statusLabels[block.status].toLowerCase()} und wird nur noch schreibgeschützt angezeigt.</p>}
      </section>

      <div className="grid gap-4">
        {block.weeks.map((week) => {
          const start = week.weekStart;
          const end = weekEnd(start);
          const alreadyPlanned = workouts.some((workout) => workout.source === "automatic" && workout.scheduledDate >= start && workout.scheduledDate <= end);
          return (
            <section key={week.id} className="card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="eyebrow">Woche {week.weekNumber}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">{formatDate(start)} – {formatDate(end)} · {phaseLabels[week.phase]}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-black ${alreadyPlanned ? "bg-amber-100 text-amber-950" : "bg-emerald-100 text-emerald-950"}`}>
                  {alreadyPlanned ? "Bereits geplant · Änderung wirkt erst nach Neuplanung dieser Woche" : "Noch nicht geplant · Änderung fließt automatisch ein"}
                </span>
              </div>
              <form action={updateTrainingBlockWeek} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
                <input type="hidden" name="blockId" value={block.id} />
                <input type="hidden" name="weekId" value={week.id} />
                <label className="text-xs font-bold">
                  Phase
                  <select name="phase" defaultValue={week.phase} disabled={!editable} className={inputClass}>
                    <option value="foundation">Grundlage</option>
                    <option value="build">Aufbau</option>
                    <option value="load">Belastung</option>
                    <option value="peak">Peak</option>
                    <option value="recovery">Erholung</option>
                  </select>
                </label>
                <label className="text-xs font-bold">
                  Wochenziel (km)
                  <input name="targetDistanceKm" type="number" min="0" max="2000" step="0.1" required disabled={!editable} defaultValue={week.targetDistanceKm} className={inputClass} />
                </label>
                <label className="text-xs font-bold">
                  {block.sportType === "running" ? "Langer Lauf" : "Lange Fahrt"} (km)
                  <input name="longRideTargetKm" type="number" min="0" max="1000" step="0.1" required disabled={!editable} defaultValue={week.longRideTargetKm} className={inputClass} />
                </label>
                <label className="text-xs font-bold">
                  Tempoeinheiten
                  <input name="tempoSessionTarget" type="number" min="0" max="2" step="1" required disabled={!editable} defaultValue={week.tempoSessionTarget} className={inputClass} />
                </label>
                {editable && <button className="w-fit rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-bold text-white">Woche speichern</button>}
                <label className="text-xs font-bold sm:col-span-2 lg:col-span-5">
                  Beschreibung
                  <textarea name="purpose" maxLength={500} rows={2} required disabled={!editable} defaultValue={week.purpose} className={inputClass} />
                </label>
              </form>
            </section>
          );
        })}
      </div>
    </>
  );
}

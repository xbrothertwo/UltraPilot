import Link from "next/link";
import { makeFutureWorkoutEasy } from "@/app/activities/[id]/actions";
import type { RideDebrief as RideDebriefResult, DebriefTone } from "@/lib/ride-debrief";
import type { PlannedWorkout } from "@/lib/planning/workouts";

const panelStyles: Record<RideDebriefResult["status"], string> = {
  on_track: "bg-[#10281d] text-white",
  adjust: "bg-[#e5b151] text-[#2c210f]",
  recover: "bg-[#7d3541] text-white",
  incomplete: "bg-[#dce9df] text-[#10281d]",
};

const signalStyles: Record<DebriefTone, string> = {
  good: "bg-emerald-50 text-emerald-950 border-emerald-200",
  info: "bg-slate-50 text-slate-900 border-slate-200",
  warning: "bg-amber-50 text-amber-950 border-amber-200",
  critical: "bg-rose-50 text-rose-950 border-rose-200",
};

export function RideDebrief({ activityId, result, matchedWorkout, nextWorkout, editable }: { activityId: string; result: RideDebriefResult; matchedWorkout: PlannedWorkout | null; nextWorkout: PlannedWorkout | null; editable: boolean }) {
  return <section id="debrief" className="mt-6 scroll-mt-24">
    <div className={`overflow-hidden rounded-[2rem] p-6 shadow-[0_20px_50px_rgba(16,37,27,.12)] sm:p-8 ${panelStyles[result.status]}`}>
      <div className="grid gap-6 xl:grid-cols-[1.25fr_.75fr] xl:items-end">
        <div><p className="text-xs font-black uppercase tracking-[.18em] opacity-55">Ride Debrief · regelbasiert</p><h2 className="mt-3 text-3xl font-black tracking-[-.035em]">{result.title}</h2><p className="mt-3 max-w-3xl leading-7 opacity-75">{result.summary}</p>{matchedWorkout && <p className="mt-4 text-sm font-bold opacity-65">Zugeordnet zu: {matchedWorkout.title} · {matchedWorkout.plannedDistanceKm ?? "–"} km · {matchedWorkout.plannedDurationMinutes ?? "–"} min</p>}</div>
        <div className="rounded-2xl border border-current/10 bg-white/10 p-5"><p className="text-xs font-black uppercase tracking-wider opacity-55">Nächster Schritt</p>{result.status === "incomplete" ? <><p className="mt-2 font-black">Zwei Minuten Feedback ergänzen</p><a href="#journal" className="mt-4 inline-flex rounded-xl bg-white px-4 py-2.5 text-sm font-black text-[#10281d]">Zum Körpergefühl ↓</a></> : (result.nextAction === "easy" || result.nextAction === "recover") && nextWorkout && editable ? <><p className="mt-2 font-black">{nextWorkout.title}</p><p className="mt-1 text-sm opacity-65">{new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "2-digit", month: "2-digit" }).format(new Date(`${nextWorkout.scheduledDate}T12:00:00`))}</p><form action={makeFutureWorkoutEasy.bind(null, activityId)} className="mt-4"><input type="hidden" name="workoutId" value={nextWorkout.id}/><button type="submit" className="rounded-xl bg-white px-4 py-2.5 text-sm font-black text-[#10281d]">Nächste Fahrt lockern</button></form></> : <><p className="mt-2 font-black">Plan beibehalten</p><p className="mt-1 text-sm opacity-65">Die nächste Einheit muss aktuell nicht verändert werden.</p><Link href="/plan" className="mt-4 inline-flex rounded-xl bg-white px-4 py-2.5 text-sm font-black text-[#10281d]">Wochenplan öffnen →</Link></>}</div>
      </div>
    </div>
    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">{result.signals.map((signal) => <article key={signal.label} className={`rounded-2xl border p-4 ${signalStyles[signal.tone]}`}><p className="text-[.65rem] font-black uppercase tracking-wider opacity-55">{signal.label}</p><p className="mt-2 text-lg font-black">{signal.value}</p><p className="mt-2 text-xs leading-5 opacity-65">{signal.detail}</p></article>)}</div>
    <p className="mt-3 text-xs leading-5 text-[var(--muted)]">Der Debrief verwendet ausschließlich gespeicherte Messwerte, Planvorgaben und dein Feedback. Er stellt keine medizinische Diagnose und ergänzt keine fehlenden Werte.</p>
  </section>;
}

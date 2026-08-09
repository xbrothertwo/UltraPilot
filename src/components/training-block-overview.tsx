import Link from "next/link";
import type { Activity } from "@/lib/demo-data";
import type { PrimarySport } from "@/lib/planning/data";
import type { TrainingBlock } from "@/lib/planning/blocks";
import { completeTrainingBlock, createTrainingBlock, deleteTrainingBlock, pauseTrainingBlock, renameTrainingBlock, resumeTrainingBlock, updateTrainingBlockDates, updateTrainingBlockGoal, updateTrainingBlockWeeklyTarget } from "@/app/plan/block-actions";

const phaseLabels = { foundation: "Grundlage", build: "Aufbau", load: "Belastung", peak: "Peak", recovery: "Erholung" } as const;
const phaseStyles = { foundation: "bg-emerald-100 text-emerald-950", build: "bg-sky-100 text-sky-950", load: "bg-orange-100 text-orange-950", peak: "bg-amber-100 text-amber-950", recovery: "bg-violet-100 text-violet-950" } as const;
const inputClass = "mt-1.5 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5";
const sportLabels = { cycling: "Radfahren", running: "Laufen" } as const;

function localDate(value: string): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}

function CreateBlockForm({ selectedWeek, weeklyDistanceKm, primarySport, editable }: { selectedWeek: string; weeklyDistanceKm: number; primarySport: PrimarySport; editable: boolean }) {
  return <section className="card mb-4 p-6">
    <div className="grid gap-6 xl:grid-cols-[.8fr_1.2fr]">
      <div>
        <p className="eyebrow">Trainingsblock</p>
        <h2 className="mt-2 text-2xl font-black">Deinen ersten Trainingsblock starten</h2>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Die lange Einheit wächst kontrolliert über den Block, die letzte Woche ist immer eine Entlastungswoche. Arbeitszeiten, Readiness und Belastung entscheiden weiterhin über die konkreten Trainingstage.</p>
      </div>
      <form action={createTrainingBlock} className="grid gap-4 sm:grid-cols-2">
        <input type="hidden" name="selectedWeek" value={selectedWeek}/>
        <label className="text-sm font-bold sm:col-span-2">Name<input name="name" required maxLength={120} defaultValue="Grundlagenblock 1" className={inputClass}/></label>
        <label className="text-sm font-bold">Hauptsportart<select name="sportType" defaultValue={primarySport} className={inputClass}><option value="cycling">Radfahren</option><option value="running">Laufen</option></select></label>
        <label className="text-sm font-bold">Startmontag<input name="startDate" type="date" required defaultValue={selectedWeek} className={inputClass}/></label>
        <label className="text-sm font-bold">Anzahl Wochen<input name="weekCount" type="number" min="2" max="16" step="1" required defaultValue={4} className={inputClass}/></label>
        <label className="text-sm font-bold">Normale Wochenkilometer<input name="weeklyDistanceKm" type="number" min="20" max="2000" step="1" required defaultValue={weeklyDistanceKm} className={inputClass}/></label>
        <label className="text-sm font-bold">Lange Einheit zu Beginn (km)<input name="startingLongRideKm" type="number" min="10" max="1000" step="1" required defaultValue={Math.round(weeklyDistanceKm * .4)} className={inputClass}/></label>
        <label className="text-sm font-bold">Entlastungswoche<select name="recoveryWeekPercentage" defaultValue="100" className={inputClass}><option value="100">100 % Umfang erhalten</option><option value="90">90 % Umfang</option><option value="80">80 % Umfang</option><option value="70">70 % Umfang</option><option value="60">60 % Umfang</option></select></label>
        <label className="text-sm font-bold sm:col-span-2">Ziel des Blocks (optional)<textarea name="goal" maxLength={500} rows={2} placeholder="z. B. Fitness für den ersten Ultra aufbauen" className={inputClass}/></label>
        <button disabled={!editable} className="rounded-xl bg-[var(--accent)] px-5 py-3 font-bold text-white disabled:opacity-50 sm:col-span-2">Trainingsblock erstellen</button>
      </form>
    </div>
  </section>;
}

export function TrainingBlockOverview({ block, primarySport, selectedWeek, activities, weeklyDistanceKm, editable }: { block: TrainingBlock | null; primarySport: PrimarySport; selectedWeek: string; activities: Activity[]; weeklyDistanceKm: number; editable: boolean }) {
  if (!block) return <CreateBlockForm selectedWeek={selectedWeek} weeklyDistanceKm={weeklyDistanceKm} primarySport={primarySport} editable={editable}/>;

  const paused = block.status === "paused";
  const longSessionLabel = block.sportType === "running" ? "Langer Lauf" : "Lange Fahrt";

  return <section className={`card mb-4 p-5 ${paused ? "opacity-80" : ""}`}>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="eyebrow">{paused ? "Pausierter Trainingsblock" : "Aktiver Trainingsblock"}</p>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[.65rem] font-black text-slate-700">{sportLabels[block.sportType]}</span>
        </div>
        <h2 className="mt-2 text-2xl font-black">{block.name}</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">{new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short" }).format(new Date(`${block.startDate}T12:00:00`))} – {new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${block.endDate}T12:00:00`))} · {block.weekCount} Wochen</p>
        {block.goal && <p className="mt-2 text-sm leading-5 text-[var(--ink)]"><span className="font-bold">Ziel:</span> {block.goal}</p>}
        <Link href={`/plan/block/${block.id}`} className="mt-2 inline-block text-sm font-bold text-[var(--accent)] underline">Details & Wochen manuell bearbeiten →</Link>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {editable && <form action={renameTrainingBlock} className="flex items-center gap-1.5"><input type="hidden" name="id" value={block.id}/><input type="hidden" name="selectedWeek" value={selectedWeek}/><input name="name" defaultValue={block.name} maxLength={120} aria-label="Blockname" className="w-40 rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm"/><button className="rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm font-bold text-[var(--muted)] hover:bg-blue-50/45">Umbenennen</button></form>}
        {editable && (paused
          ? <form action={resumeTrainingBlock}><input type="hidden" name="id" value={block.id}/><input type="hidden" name="selectedWeek" value={selectedWeek}/><button className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-900 hover:bg-emerald-100">Fortsetzen</button></form>
          : <form action={pauseTrainingBlock}><input type="hidden" name="id" value={block.id}/><input type="hidden" name="selectedWeek" value={selectedWeek}/><button className="rounded-xl border border-[var(--line)] bg-white px-4 py-2 text-sm font-bold text-[var(--muted)] hover:bg-blue-50/45">Pausieren</button></form>)}
        {editable && <form action={completeTrainingBlock}><input type="hidden" name="id" value={block.id}/><input type="hidden" name="selectedWeek" value={selectedWeek}/><button className="rounded-xl border border-[var(--line)] bg-white px-4 py-2 text-sm font-bold text-[var(--muted)] hover:bg-blue-50/45">Abschließen</button></form>}
        {editable && <form action={deleteTrainingBlock}><input type="hidden" name="id" value={block.id}/><input type="hidden" name="selectedWeek" value={selectedWeek}/><button className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-50">Löschen</button></form>}
      </div>
    </div>
    {editable && <details className="mt-4 rounded-2xl border border-[var(--line)] bg-white/60 p-4">
      <summary className="cursor-pointer text-sm font-bold text-[var(--muted)]">Zeitraum, Ziel & Wochenziel bearbeiten</summary>
      <div className="mt-4 grid gap-5 sm:grid-cols-2">
        <form action={updateTrainingBlockDates} className="grid gap-2">
          <input type="hidden" name="id" value={block.id}/><input type="hidden" name="selectedWeek" value={selectedWeek}/>
          <label className="text-xs font-bold">Startmontag<input name="startDate" type="date" required defaultValue={block.startDate} className={inputClass}/></label>
          <p className="text-xs text-[var(--muted)]">Alle {block.weekCount} Wochen werden um denselben Zeitraum mitverschoben; die geplanten Wochenziele bleiben gleich.</p>
          <button className="mt-1 w-fit rounded-xl border border-[var(--line)] bg-white px-4 py-2 text-sm font-bold text-[var(--muted)] hover:bg-blue-50/45">Zeitraum speichern</button>
        </form>
        <form action={updateTrainingBlockGoal} className="grid gap-2">
          <input type="hidden" name="id" value={block.id}/><input type="hidden" name="selectedWeek" value={selectedWeek}/>
          <label className="text-xs font-bold">Ziel des Blocks<textarea name="goal" maxLength={500} rows={2} defaultValue={block.goal ?? ""} placeholder="z. B. Fitness für den ersten Ultra aufbauen" className={inputClass}/></label>
          <button className="mt-1 w-fit rounded-xl border border-[var(--line)] bg-white px-4 py-2 text-sm font-bold text-[var(--muted)] hover:bg-blue-50/45">Ziel speichern</button>
        </form>
        <form action={updateTrainingBlockWeeklyTarget} className="grid gap-2 sm:col-span-2 sm:grid-cols-3 sm:items-end">
          <input type="hidden" name="id" value={block.id}/><input type="hidden" name="selectedWeek" value={selectedWeek}/>
          <label className="text-xs font-bold">Normale Wochenkilometer<input name="weeklyDistanceKm" type="number" min="20" max="2000" step="1" required defaultValue={block.baseWeeklyDistanceKm} className={inputClass}/></label>
          <label className="text-xs font-bold">{longSessionLabel} zu Beginn (km)<input name="startingLongRideKm" type="number" min="10" max="1000" step="1" required defaultValue={block.startingLongRideKm} className={inputClass}/></label>
          <label className="text-xs font-bold">Entlastungswoche<select name="recoveryWeekPercentage" defaultValue={String(block.recoveryWeekPercentage)} className={inputClass}><option value="100">100 % Umfang erhalten</option><option value="90">90 % Umfang</option><option value="80">80 % Umfang</option><option value="70">70 % Umfang</option><option value="60">60 % Umfang</option></select></label>
          <p className="text-xs text-[var(--muted)] sm:col-span-3">Berechnet alle {block.weekCount} Wochenziele des Blocks neu; bereits geplante Einheiten bleiben unverändert.</p>
          <button className="w-fit rounded-xl border border-[var(--line)] bg-white px-4 py-2 text-sm font-bold text-[var(--muted)] hover:bg-blue-50/45 sm:col-span-3">Wochenziel neu berechnen</button>
        </form>
      </div>
    </details>}
    <div className="mt-5 grid gap-3 lg:grid-cols-4">{block.weeks.map((week) => { const end = new Date(`${week.weekStart}T12:00:00Z`); end.setUTCDate(end.getUTCDate() + 6); const actualKm = activities.filter((activity) => { const date = localDate(activity.activityDate); return date >= week.weekStart && date <= end.toISOString().slice(0, 10); }).reduce((sum, activity) => sum + activity.distanceMeters / 1000, 0); const progress = Math.min(100, week.targetDistanceKm > 0 ? actualKm / week.targetDistanceKm * 100 : 0); return <Link key={week.id} href={`/plan?week=${week.weekStart}`} className={`rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:shadow-md ${selectedWeek === week.weekStart ? "border-[var(--accent)] bg-emerald-50 ring-2 ring-emerald-900/5" : "border-[var(--line)] bg-white/70"}`}><div className="flex items-center justify-between gap-2"><p className="text-xs font-black uppercase tracking-wider">Woche {week.weekNumber}</p><span className={`rounded-full px-2 py-1 text-[.65rem] font-black ${phaseStyles[week.phase]}`}>{phaseLabels[week.phase]}</span></div><p className="mt-4 text-2xl font-black">{week.targetDistanceKm.toLocaleString("de-DE", { maximumFractionDigits: 0 })} km</p><p className="mt-1 text-xs text-[var(--muted)]">{longSessionLabel} {week.longRideTargetKm.toLocaleString("de-DE", { maximumFractionDigits: 1 })} km · {week.tempoSessionTarget ? "1× Tempo" : "kein Tempo"}</p><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${progress}%` }}/></div><p className="mt-2 text-xs font-bold text-[var(--muted)]">{actualKm.toLocaleString("de-DE", { maximumFractionDigits: 1 })} km absolviert</p><p className="mt-3 text-xs leading-5 text-[var(--muted)]">{week.purpose}</p></Link>; })}</div>
  </section>;
}

import type { SubjectiveFeedback } from "@/lib/activity-journal";
import type { NutritionEntry, NutritionSummary } from "@/lib/nutrition-analysis";
import { formatDuration } from "@/lib/format";
import { deleteNutritionEntry, saveNutritionEntry, saveSubjectiveFeedback } from "@/app/activities/[id]/actions";

type ActivityJournalProps = {
  activityId: string;
  entries: NutritionEntry[];
  feedback: SubjectiveFeedback | null;
  summary: NutritionSummary;
  editable: boolean;
  feedbackDetailsReady: boolean;
};

const inputClass = "mt-1.5 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 outline-none focus:border-[var(--accent)]";

function timeLabel(seconds: number | null): string {
  if (seconds === null) return "Zeitpunkt offen";
  return `nach ${formatDuration(seconds)}`;
}

function Rating({ name, label, low, high, value }: { name: string; label: string; low: string; high: string; value: number | null | undefined }) {
  return <label className="text-sm font-semibold">{label}<select className={inputClass} name={name} defaultValue={value ?? ""}><option value="">–</option>{Array.from({ length: 10 }, (_, index) => <option value={index + 1} key={index + 1}>{index + 1}{index === 0 ? ` – ${low}` : index === 9 ? ` – ${high}` : ""}</option>)}</select></label>;
}

export function ActivityJournal({ activityId, entries, feedback, summary, editable, feedbackDetailsReady }: ActivityJournalProps) {
  const nutritionAction = saveNutritionEntry.bind(null, activityId);
  const feedbackAction = saveSubjectiveFeedback.bind(null, activityId);
  return (
    <section id="journal" className="mt-6 space-y-6 scroll-mt-24">
      <div className="card p-6">
        <div><h2 className="text-lg font-bold">Ernährung & Flüssigkeit</h2><p className="mt-1 text-sm text-[var(--muted)]">Protokoll während der Fahrt und Summen bezogen auf die Bewegungszeit.</p></div>
        <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl bg-slate-50 p-4"><dt className="text-xs text-[var(--muted)]">Kohlenhydrate</dt><dd className="mt-1 text-xl font-bold">{summary.carbohydratesGrams.toLocaleString("de-DE", { maximumFractionDigits: 1 })} g</dd><p className="text-xs text-[var(--muted)]">{summary.carbohydratesPerHour.toLocaleString("de-DE", { maximumFractionDigits: 1 })} g/h</p></div>
          <div className="rounded-2xl bg-slate-50 p-4"><dt className="text-xs text-[var(--muted)]">Flüssigkeit</dt><dd className="mt-1 text-xl font-bold">{summary.fluidMilliliters.toLocaleString("de-DE")} ml</dd><p className="text-xs text-[var(--muted)]">{summary.fluidPerHour.toLocaleString("de-DE", { maximumFractionDigits: 0 })} ml/h</p></div>
          <div className="rounded-2xl bg-slate-50 p-4"><dt className="text-xs text-[var(--muted)]">Natrium</dt><dd className="mt-1 text-xl font-bold">{summary.sodiumMilligrams.toLocaleString("de-DE")} mg</dd><p className="text-xs text-[var(--muted)]">{summary.sodiumPerHour.toLocaleString("de-DE", { maximumFractionDigits: 0 })} mg/h</p></div>
          <div className="rounded-2xl bg-slate-50 p-4"><dt className="text-xs text-[var(--muted)]">Energie</dt><dd className="mt-1 text-xl font-bold">{summary.calories.toLocaleString("de-DE")} kcal</dd><p className="text-xs text-[var(--muted)]">protokolliert</p></div>
        </dl>
        {entries.length > 0 && summary.gaps.length > 0 && <div className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm text-amber-950"><p className="font-bold">Protokolllücken über 60 Minuten</p><p className="mt-1">{summary.gaps.map((gap) => `${formatDuration(gap.startSeconds)}–${formatDuration(gap.endSeconds)} (${formatDuration(gap.durationSeconds)})`).join(" · ")}</p><p className="mt-1 text-xs">Das zeigt nur fehlende Einträge, nicht automatisch eine tatsächliche Unterversorgung.</p></div>}
        <div className="mt-6 space-y-3">
          {entries.map((entry) => <div key={entry.id} className="flex flex-col justify-between gap-3 rounded-2xl border border-[var(--line)] p-4 sm:flex-row sm:items-center"><div><p className="font-bold">{entry.description}</p><p className="mt-1 text-xs text-[var(--muted)]">{timeLabel(entry.consumedAtSeconds)} · {entry.carbohydratesGrams} g KH · {entry.fluidMilliliters} ml · {entry.sodiumMilligrams} mg Natrium</p>{entry.entryMethod === "bottle_schedule" && <span className="mt-1 inline-block rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-900">Aus Flaschenplan abgeleitet</span>}</div>{editable && entry.entryMethod !== "bottle_schedule" && <form action={deleteNutritionEntry.bind(null, activityId, entry.id)}><button className="text-sm font-semibold text-red-700" type="submit">Löschen</button></form>}</div>)}
          {entries.length === 0 && <p className="rounded-2xl border border-dashed border-[var(--line)] p-4 text-sm text-[var(--muted)]">Noch keine Verpflegung protokolliert.</p>}
        </div>
        {editable && <form action={nutritionAction} className="mt-6 border-t border-[var(--line)] pt-6"><h3 className="font-bold">Eintrag hinzufügen</h3><div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><label className="text-sm font-semibold sm:col-span-2">Produkt / Beschreibung<input className={inputClass} name="Beschreibung" maxLength={200} required placeholder="z. B. Banane + 500 ml Iso" /></label><label className="text-sm font-semibold">Stunden nach Start<input className={inputClass} name="Stunden" type="number" min="0" step="1" placeholder="2" /></label><label className="text-sm font-semibold">Minuten<input className={inputClass} name="Minuten" type="number" min="0" max="59" step="1" placeholder="30" /></label><label className="text-sm font-semibold">Kohlenhydrate (g)<input className={inputClass} name="Kohlenhydrate" type="number" min="0" step="0.1" /></label><label className="text-sm font-semibold">Flüssigkeit (ml)<input className={inputClass} name="Flüssigkeit" type="number" min="0" step="1" /></label><label className="text-sm font-semibold">Natrium (mg)<input className={inputClass} name="Natrium" type="number" min="0" step="1" /></label><label className="text-sm font-semibold">Kalorien<input className={inputClass} name="Kalorien" type="number" min="0" step="1" /></label></div><button className="mt-5 rounded-xl bg-[var(--accent)] px-5 py-3 font-bold text-white hover:bg-[var(--accent-dark)]" type="submit">Eintrag speichern</button></form>}
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-bold">Subjektives Feedback</h2><p className="mt-1 text-sm text-[var(--muted)]">Deine Einschätzung ergänzt die Messwerte, ohne medizinische Bewertung.</p>
        {!feedbackDetailsReady && editable && <p className="mt-4 rounded-xl bg-amber-100 px-4 py-3 text-sm text-amber-950">Bitte zuerst die Migration <code>202608020004_feedback_details.sql</code> ausführen.</p>}
        {editable ? <form action={feedbackAction} className="mt-5"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"><Rating name="Anstrengung" label="Anstrengung (RPE)" low="sehr leicht" high="maximal" value={feedback?.perceivedExertion} /><Rating name="Energiegefühl" label="Energiegefühl" low="leer" high="sehr gut" value={feedback?.mood} /><Rating name="Beinmüdigkeit" label="Beinmüdigkeit" low="frisch" high="extrem" value={feedback?.fatigue} /><Rating name="Magenverträglichkeit" label="Magenverträglichkeit" low="schlecht" high="sehr gut" value={feedback?.stomachTolerance} /><Rating name="Schlafqualität" label="Schlafqualität" low="schlecht" high="sehr gut" value={feedback?.sleepQuality} /></div><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Beschwerden<textarea className={`${inputClass} min-h-24`} name="Beschwerden" maxLength={1000} defaultValue={feedback?.painNotes} placeholder="Optional, keine medizinische Diagnose" /></label><label className="text-sm font-semibold">Notizen<textarea className={`${inputClass} min-h-24`} name="Notizen" maxLength={3000} defaultValue={feedback?.notes} placeholder="Was lief gut, was möchtest du ändern?" /></label></div><button className="mt-5 rounded-xl bg-[var(--accent)] px-5 py-3 font-bold text-white hover:bg-[var(--accent-dark)] disabled:opacity-50" type="submit" disabled={!feedbackDetailsReady}>Feedback speichern</button></form> : <p className="mt-4 text-sm text-[var(--muted)]">Im Demo-Modus wird kein Feedback gespeichert.</p>}
      </div>
    </section>
  );
}

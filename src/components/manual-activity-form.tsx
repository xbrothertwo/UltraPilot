import { createManualActivity } from "@/app/activities/manual/actions";

const inputClass = "mt-1.5 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5";

export function ManualActivityForm() {
  return (
    <form action={createManualActivity} className="card p-6">
      <p className="eyebrow">Ohne Datei oder Gerät</p>
      <h2 className="mt-2 text-xl font-black">Aktivität manuell eintragen</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Für Aktivitäten ohne Aufzeichnung — z. B. Krafttraining ohne Uhr oder eine Fahrt, die nicht aufgezeichnet wurde. UltraPilot schätzt keine fehlenden Werte hinzu.</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-bold">
          Sportart
          <select name="sportType" defaultValue="cycling" className={inputClass}>
            <option value="cycling">Radfahren</option>
            <option value="running">Laufen</option>
            <option value="strength">Krafttraining</option>
            <option value="volleyball">Volleyball</option>
            <option value="other">Sonstiges</option>
          </select>
        </label>
        <label className="text-sm font-bold">
          Titel (optional)
          <input name="title" maxLength={200} placeholder="z. B. Abendrunde" className={inputClass} />
        </label>
        <label className="text-sm font-bold">
          Datum
          <input name="activityDate" type="date" required className={inputClass} />
        </label>
        <label className="text-sm font-bold">
          Startzeit (optional)
          <input name="activityTime" type="time" className={inputClass} />
        </label>
        <label className="text-sm font-bold">
          Dauer (Minuten)
          <input name="duration" type="number" min="1" max="1440" required className={inputClass} />
        </label>
        <label className="text-sm font-bold">
          Distanz (km, optional)
          <input name="distance" type="number" min="0" max="2000" step="0.1" className={inputClass} />
        </label>
        <label className="text-sm font-bold sm:col-span-2">
          Höhenmeter (optional)
          <input name="elevation" type="number" min="0" max="10000" step="1" className={inputClass} />
        </label>
      </div>
      <button type="submit" className="mt-5 w-full rounded-xl bg-[var(--accent)] px-5 py-3 font-bold text-white transition hover:bg-[var(--accent-dark)]">Aktivität eintragen</button>
    </form>
  );
}

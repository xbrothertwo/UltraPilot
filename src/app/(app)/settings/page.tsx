import { PageHeading } from "@/components/page-heading";
import { isDemoMode } from "@/lib/demo-data";
import { getTrainingProfile } from "@/lib/training-profile";
import { getHeartRateZones, getPaceZones, getPowerZones } from "@/lib/training-zones";
import { saveTrainingSettings } from "@/app/settings/actions";
import { HealthShortcutSetup } from "@/components/health-shortcut-setup";
import { AccountDataExport } from "@/components/account-data-export";
import { AccountDeletion } from "@/components/account-deletion";
import { getHealthShortcutStatus } from "@/lib/apple-health/shortcut-connection";

export const metadata = { title: "Einstellungen" };
export const dynamic = "force-dynamic";

type SettingsPageProps = { searchParams: Promise<{ saved?: string; error?: string }> };

const inputClass = "mt-1.5 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 outline-none focus:border-[var(--accent)]";

function paceValue(secondsPerKm: number | null): string {
  if (secondsPerKm === null) return "";
  return `${Math.floor(secondsPerKm / 60)}:${String(Math.round(secondsPerKm % 60)).padStart(2, "0")}`;
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const query = await searchParams;
  const [{ profile, databaseReady }, shortcutStatus] = await Promise.all([getTrainingProfile(), getHealthShortcutStatus()]);
  const heartRateZones = getHeartRateZones(profile);
  const powerZones = getPowerZones(profile);
  const paceZones = getPaceZones(profile);
  return (
    <>
      <PageHeading title="Einstellungen" description="Persönliche Referenzwerte für nachvollziehbare Trainingsmetriken." />
      {query.saved === "1" && <p className="mb-5 rounded-xl bg-emerald-100 px-4 py-3 text-sm font-semibold text-emerald-900">Einstellungen gespeichert.</p>}
      {query.error && <p className="mb-5 rounded-xl bg-red-100 px-4 py-3 text-sm font-semibold text-red-900">{query.error}</p>}
      {!isDemoMode && !databaseReady && <p className="mb-5 rounded-xl bg-amber-100 px-4 py-3 text-sm text-amber-950">Bitte zuerst die neue Migration <code>202608020003_training_zones.sql</code> im Supabase SQL Editor ausführen.</p>}
      <form action={saveTrainingSettings} className="card max-w-4xl p-6">
        <div className="grid gap-8 lg:grid-cols-2">
          <section>
            <h2 className="text-lg font-bold">Leistungswerte</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">Nur selbst gemessene oder bewusst gesetzte Werte eintragen. UltraPilot schätzt nichts.</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold">Maximalpuls (bpm)<input className={inputClass} name="maxHeartRate" type="number" min="80" max="240" defaultValue={profile.maxHeartRate ?? ""} /></label>
              <label className="text-sm font-semibold">Ruhepuls (bpm)<input className={inputClass} name="restingHeartRate" type="number" min="25" max="120" defaultValue={profile.restingHeartRate ?? ""} /></label>
              <label className="text-sm font-semibold">FTP (Watt)<input className={inputClass} name="ftpWatts" type="number" min="50" max="1000" defaultValue={profile.ftpWatts ?? ""} /></label>
              <label className="text-sm font-semibold">Schwellenpace (min/km)<input className={inputClass} name="thresholdPace" type="text" inputMode="numeric" pattern="[0-9]{1,2}:[0-5][0-9]" placeholder="4:30" defaultValue={paceValue(profile.thresholdPaceSecondsPerKm)} /></label>
            </div>
          </section>
          <section>
            <h2 className="text-lg font-bold">Herzfrequenzzonen</h2>
            <label className="mt-5 block text-sm font-semibold">Berechnungsmethode
              <select className={inputClass} name="heartRateZoneMethod" defaultValue={profile.heartRateZoneMethod}>
                <option value="max_hr">Prozent vom Maximalpuls</option>
                <option value="heart_rate_reserve">Herzfrequenzreserve (Karvonen)</option>
                <option value="manual">Manuelle Grenzen</option>
              </select>
            </label>
            <p className="mt-3 text-xs leading-5 text-[var(--muted)]">Automatisch: Grenzen bei 60 / 70 / 80 / 90 %. Für die Herzfrequenzreserve werden Maximal- und Ruhepuls benötigt.</p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Array.from({ length: 4 }, (_, index) => <label key={index} className="text-xs font-semibold">Z{index + 1} bis<input className={inputClass} name={`hrBoundary${index + 1}`} type="number" min="1" max="240" defaultValue={profile.customHeartRateBoundaries?.[index] ?? ""} /></label>)}
            </div>
          </section>
        </div>
        <section className="mt-8 border-t border-[var(--line)] pt-7">
          <h2 className="text-lg font-bold">Leistungszonen</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Ohne manuelle Grenzen: 55 / 75 / 90 / 105 / 120 / 150 % der eingetragenen FTP.</p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }, (_, index) => <label key={index} className="text-xs font-semibold">Z{index + 1} bis<input className={inputClass} name={`powerBoundary${index + 1}`} type="number" min="1" max="1500" defaultValue={profile.customPowerBoundaries?.[index] ?? ""} /></label>)}
          </div>
        </section>
        {(heartRateZones || powerZones || paceZones) && <section className="mt-8 rounded-2xl bg-blue-50/45 p-4 text-sm"><h2 className="font-bold">Aktuelle Vorschau</h2><div className="mt-3 grid gap-3 md:grid-cols-2">{heartRateZones && <p><span className="font-semibold">Puls:</span> {heartRateZones.map((zone) => `${zone.name} ${zone.upper ?? "+"}`).join(" · ")}</p>}{powerZones && <p><span className="font-semibold">Leistung:</span> {powerZones.map((zone) => `${zone.name} ${zone.upper ?? "+"}`).join(" · ")}</p>}{paceZones && <p><span className="font-semibold">Pace:</span> {paceZones.map((zone) => `${zone.name} ${zone.fasterBoundSecondsPerKm !== null ? paceValue(zone.fasterBoundSecondsPerKm) : "offen"}`).join(" · ")}</p>}</div></section>}
        <button className="mt-7 rounded-xl bg-[var(--accent)] px-5 py-3 font-bold text-white transition hover:bg-[var(--accent-dark)] disabled:cursor-not-allowed disabled:opacity-50" type="submit" disabled={isDemoMode || !databaseReady}>Einstellungen speichern</button>
        {isDemoMode && <p className="mt-3 text-sm text-[var(--muted)]">Im Demo-Modus werden persönliche Einstellungen nicht gespeichert.</p>}
      </form>
      <HealthShortcutSetup status={shortcutStatus} endpointUrl={`${(process.env.NEXT_PUBLIC_APP_URL ?? "https://ultra-pilot.vercel.app").replace(/\/$/, "")}/api/health/shortcut`} />
      {!isDemoMode && <AccountDataExport />}
      {!isDemoMode && <AccountDeletion />}
      <section className="card mt-6 max-w-4xl p-6"><div className="flex items-center justify-between gap-4"><div><h2 className="font-bold">Supabase</h2><p className="mt-1 text-sm text-[var(--muted)]">Authentifizierung, Datenbank und Dateispeicher</p></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${isDemoMode ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-900"}`}>{isDemoMode ? "Demo-Modus" : "Konfiguriert"}</span></div></section>
    </>
  );
}

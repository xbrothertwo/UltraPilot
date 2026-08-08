"use client";

import { useState } from "react";
import { completeOnboarding } from "@/app/onboarding/actions";

type HeroSport = "cycling" | "running" | "multi";

const inputClass =
  "mt-1.5 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5";
const skipNote =
  "Kannst du überspringen und später in den Einstellungen ergänzen. UltraPilot schätzt nichts.";

export function OnboardingWizard({ error }: { error: string | null }) {
  const [heroSport, setHeroSport] = useState<HeroSport | null>(null);
  const [multiPriority, setMultiPriority] = useState<"cycling" | "running">(
    "cycling",
  );
  const [strengthEnabled, setStrengthEnabled] = useState(false);
  const [devices, setDevices] = useState<string[]>([]);

  const resolvedSport: "cycling" | "running" =
    heroSport === "multi" ? multiPriority : (heroSport ?? "cycling");

  function toggleDevice(device: string) {
    setDevices((current) =>
      current.includes(device)
        ? current.filter((entry) => entry !== device)
        : [...current, device],
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <p className="eyebrow">Willkommen bei UltraPilot</p>
      <h1 className="mt-2 text-3xl font-black tracking-[-.03em] text-[var(--ink)] sm:text-4xl">
        Lass uns dein Grundprofil aufsetzen.
      </h1>
      <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--muted)]">
        Ein paar Angaben reichen für einen ersten sinnvollen Trainingsplan.
        Alles Weitere kannst du jederzeit in den Einstellungen anpassen.
      </p>

      {error && (
        <p className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-900">
          {error}
        </p>
      )}

      <form action={completeOnboarding} className="mt-6 space-y-6">
        <input type="hidden" name="primarySport" value={heroSport ?? ""} />
        <input type="hidden" name="multiPriority" value={multiPriority} />

        <section className="card p-5 sm:p-6">
          <p className="eyebrow">Hauptsportart</p>
          <h2 className="mt-1 text-xl font-black">
            Worauf liegt dein Fokus?
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {(
              [
                { value: "cycling", label: "Radfahren", hint: "Ausdauer auf dem Rad" },
                { value: "running", label: "Laufen", hint: "Ausdauer zu Fuß" },
                { value: "multi", label: "Multi-Sport", hint: "Mehrere Ausdauersportarten" },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setHeroSport(option.value)}
                aria-pressed={heroSport === option.value}
                className={`min-h-28 rounded-2xl border-2 p-4 text-left transition ${heroSport === option.value ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--line)] bg-white hover:border-blue-200"}`}
              >
                <span className="block text-lg font-black">
                  {option.label}
                </span>
                <span className="mt-1 block text-xs text-[var(--muted)]">
                  {option.hint}
                </span>
              </button>
            ))}
          </div>
          {heroSport === "multi" && (
            <div className="mt-4 rounded-xl border border-[var(--line)] bg-blue-50/45 p-4">
              <p className="text-sm font-bold">
                Womit sollen wir starten? Die zweite Sportart bleibt sichtbar,
                der Plan richtet sich zuerst nach deiner Priorität.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setMultiPriority("cycling")}
                  className={`rounded-xl border px-4 py-2 text-sm font-bold ${multiPriority === "cycling" ? "border-[var(--accent)] bg-white" : "border-[var(--line)] bg-white/60"}`}
                >
                  Radfahren zuerst
                </button>
                <button
                  type="button"
                  onClick={() => setMultiPriority("running")}
                  className={`rounded-xl border px-4 py-2 text-sm font-bold ${multiPriority === "running" ? "border-[var(--accent)] bg-white" : "border-[var(--line)] bg-white/60"}`}
                >
                  Laufen zuerst
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="card p-5 sm:p-6">
          <p className="eyebrow">Ergänzende Sportarten</p>
          <h2 className="mt-1 text-xl font-black">
            Machst du regelmäßig noch etwas anderes?
          </h2>
          <div className="mt-4 space-y-3">
            <label className="flex items-center justify-between gap-3 rounded-xl border border-[var(--line)] px-4 py-3">
              <span className="flex items-center gap-2 text-sm font-bold">
                <input
                  name="strengthEnabled"
                  type="checkbox"
                  checked={strengthEnabled}
                  onChange={(event) => setStrengthEnabled(event.target.checked)}
                />
                Krafttraining
              </span>
              {strengthEnabled && (
                <span className="flex items-center gap-2 text-sm">
                  <input
                    name="strengthSessions"
                    type="number"
                    min={0}
                    max={7}
                    defaultValue={1}
                    className="w-16 rounded-lg border border-[var(--line)] px-2 py-1.5 text-center"
                  />
                  ×/Woche
                </span>
              )}
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-[var(--line)] px-4 py-3 text-sm font-bold">
              <input name="volleyball" type="checkbox" />
              Volleyball
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-[var(--line)] px-4 py-3 text-sm font-bold text-[var(--muted)]">
              <input type="checkbox" disabled />
              Sonstige Sportarten (bald verfügbar)
            </label>
          </div>
        </section>

        <section className="card p-5 sm:p-6">
          <p className="eyebrow">Trainingsziel</p>
          <h2 className="mt-1 text-xl font-black">Optional, aber hilfreich</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">{skipNote}</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold sm:col-span-2">
              Zielname
              <input
                name="eventName"
                type="text"
                maxLength={200}
                placeholder="z. B. erster Marathon"
                className={inputClass}
              />
            </label>
            <label className="text-sm font-semibold">
              Zieljahr
              <input
                name="targetYear"
                type="number"
                min={new Date().getFullYear()}
                max={new Date().getFullYear() + 20}
                placeholder="optional"
                className={inputClass}
              />
            </label>
            <label className="text-sm font-semibold">
              Zieldistanz (km)
              <input
                name="eventDistance"
                type="number"
                min={1}
                max={100000}
                placeholder="optional"
                className={inputClass}
              />
            </label>
            <label className="text-sm font-semibold">
              Höhenmeter
              <input
                name="eventElevation"
                type="number"
                min={0}
                max={1000000}
                placeholder="optional"
                className={inputClass}
              />
            </label>
            <label className="text-sm font-semibold">
              Unterstützungsmodus
              <select name="supportMode" defaultValue="" className={inputClass}>
                <option value="">Nicht festgelegt</option>
                <option value="supported">Mit Support</option>
                <option value="nonsupported">Ohne Support</option>
                <option value="open">Offen</option>
              </select>
            </label>
          </div>
        </section>

        <section className="card p-5 sm:p-6">
          <p className="eyebrow">Trainingsumfang</p>
          <h2 className="mt-1 text-xl font-black">
            Wie sieht dein Training aktuell aus?
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {resolvedSport === "running" && (
              <label className="text-sm font-semibold">
                Laufeinheiten pro Woche
                <input
                  name="runningSessions"
                  type="number"
                  min={1}
                  max={7}
                  defaultValue={3}
                  className={inputClass}
                />
              </label>
            )}
            <label className="text-sm font-semibold">
              Bisheriger Wochenumfang (km)
              <input
                name="weeklyDistance"
                type="number"
                min={0}
                max={2000}
                placeholder="0"
                className={inputClass}
              />
              <span className="mt-1 block text-xs font-normal text-[var(--muted)]">
                Dient als Startpunkt, UltraPilot passt es laufend an.
              </span>
            </label>
          </div>
        </section>

        <section className="card p-5 sm:p-6">
          <p className="eyebrow">Datenquellen &amp; Geräte</p>
          <h2 className="mt-1 text-xl font-black">Womit zeichnest du auf?</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {["Garmin", "Apple Watch / Health", "Leistungsmesser", "Keins davon"].map(
              (device) => (
                <button
                  key={device}
                  type="button"
                  onClick={() => toggleDevice(device)}
                  aria-pressed={devices.includes(device)}
                  className={`rounded-full border px-4 py-2 text-sm font-bold ${devices.includes(device) ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--line)] bg-white"}`}
                >
                  {device}
                </button>
              ),
            )}
          </div>
          {devices.includes("Apple Watch / Health") && (
            <p className="mt-3 text-xs text-[var(--muted)]">
              Apple Health lässt sich direkt im Trainingsplan verbinden — die
              Exportdatei wird lokal in deinem Browser verarbeitet.
            </p>
          )}
          {devices.includes("Garmin") && (
            <p className="mt-3 text-xs text-[var(--muted)]">
              Garmin-Aktivitäten kannst du als FIT- oder GPX-Datei hochladen.
            </p>
          )}
        </section>

        <section className="card p-5 sm:p-6">
          <p className="eyebrow">Bekannte Leistungswerte</p>
          <h2 className="mt-1 text-xl font-black">Nur was du wirklich weißt</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">{skipNote}</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <label className="text-sm font-semibold">
              Maximalpuls (bpm)
              <input
                name="maxHeartRate"
                type="number"
                min={80}
                max={240}
                placeholder="optional"
                className={inputClass}
              />
            </label>
            <label className="text-sm font-semibold">
              Ruhepuls (bpm)
              <input
                name="restingHeartRate"
                type="number"
                min={25}
                max={120}
                placeholder="optional"
                className={inputClass}
              />
            </label>
            <label className="text-sm font-semibold">
              FTP (Watt)
              <input
                name="ftpWatts"
                type="number"
                min={50}
                max={1000}
                placeholder="optional"
                className={inputClass}
              />
            </label>
          </div>
        </section>

        <section className="card p-5 sm:p-6">
          <p className="eyebrow">Zeitliche Einschränkungen</p>
          <h2 className="mt-1 text-xl font-black">
            Damit der Plan zu deinem Alltag passt
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold sm:col-span-2">
              Max. Trainingsdauer an Arbeitstagen (min)
              <input
                name="workdayMax"
                type="number"
                min={15}
                max={360}
                defaultValue={90}
                className={inputClass}
              />
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold sm:col-span-2">
              <input name="beforeLate" type="checkbox" defaultChecked />
              Training vor einem späten Arbeitsblock möglich
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold sm:col-span-2">
              <input name="afterNight" type="checkbox" defaultChecked />
              Training nach Nachtarbeit möglich
            </label>
          </div>
        </section>

        <button
          type="submit"
          disabled={!heroSport}
          className="primary-button w-full disabled:cursor-not-allowed disabled:opacity-50"
        >
          Profil erstellen &amp; loslegen
        </button>
        {!heroSport && (
          <p className="text-center text-xs text-[var(--muted)]">
            Wähle oben eine Hauptsportart, um fortzufahren.
          </p>
        )}
      </form>
    </div>
  );
}

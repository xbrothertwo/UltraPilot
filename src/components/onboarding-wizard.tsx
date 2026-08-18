"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { completeOnboarding } from "@/app/onboarding/actions";
import type { OnboardingGoalType, OnboardingPriority } from "@/lib/onboarding-input";
import type { OnboardingSport } from "@/lib/onboarding-planning";

const inputClass = "mt-1.5 w-full rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-2.5";
const choiceClass = "rounded-2xl border p-4 text-left transition focus-visible:outline-none";
const steps = ["Training", "Ziel", "Alltag", "Daten", "Fertig"];
const sportOptions: Array<{ value: OnboardingSport; label: string; hint: string; mark: string }> = [
  { value: "running", label: "Laufen", hint: "Pace, Herzfrequenz und Laufumfang", mark: "RUN" },
  { value: "cycling", label: "Radfahren", hint: "Straße, Gravel oder Indoor", mark: "BIKE" },
  { value: "strength", label: "Krafttraining", hint: "Programme, Übungen und Progress", mark: "GYM" },
  { value: "volleyball", label: "Volleyball", hint: "Als echte Zusatzbelastung", mark: "VB" },
];
const goalOptions: Array<{ value: OnboardingGoalType; label: string; hint: string }> = [
  { value: "running_event", label: "Für ein Lauf-Event trainieren", hint: "5 km bis Ultra" },
  { value: "cycling_event", label: "Für ein Rad-Event trainieren", hint: "Distanz, Datum und Höhenmeter" },
  { value: "endurance", label: "Ausdauer verbessern", hint: "Eine belastbare Basis aufbauen" },
  { value: "speed", label: "Schneller werden", hint: "Kontrolliert Leistung entwickeln" },
  { value: "strength", label: "Stärker werden", hint: "Kraft oder Muskelaufbau" },
  { value: "hybrid", label: "Kraft + Ausdauer kombinieren", hint: "Beides in einer gemeinsamen Woche" },
  { value: "consistency", label: "Regelmäßiger trainieren", hint: "Eine Routine, die zum Alltag passt" },
  { value: "custom", label: "Eigenes Ziel", hint: "Du gibst die Richtung vor" },
];
const weekdays = [
  { value: 1, label: "Mo" }, { value: 2, label: "Di" }, { value: 3, label: "Mi" },
  { value: 4, label: "Do" }, { value: 5, label: "Fr" }, { value: 6, label: "Sa" },
  { value: 7, label: "So" },
];
const dataSources = [
  { value: "garmin", label: "Garmin", hint: "Quelle · Import über FIT oder GPX" },
  { value: "polar", label: "Polar", hint: "Quelle · Import über FIT oder GPX" },
  { value: "apple", label: "Apple Health", hint: "Verbindung über den UltraPilot-Kurzbefehl" },
  { value: "files", label: "FIT / GPX", hint: "Dateiimport, keine dauerhafte Verbindung" },
  { value: "manual", label: "Manuell", hint: "Einheit direkt in UltraPilot erfassen" },
];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="primary-button min-w-52 disabled:cursor-wait">
      {pending ? "Plan wird erstellt …" : "Profil speichern & Plan erstellen"}
    </button>
  );
}

function selectedStyle(selected: boolean): string {
  return selected
    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--ink)]"
    : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:border-[var(--accent)]";
}

export function OnboardingWizard({ error }: { error: string | null }) {
  const [step, setStep] = useState(0);
  const [sports, setSports] = useState<OnboardingSport[]>([]);
  const [priority, setPriority] = useState<OnboardingPriority>("balanced");
  const [goalType, setGoalType] = useState<OnboardingGoalType | null>(null);
  const [availableDays, setAvailableDays] = useState([1, 2, 3, 4, 5, 6, 7]);
  const [devices, setDevices] = useState<string[]>([]);
  const [eventDistance, setEventDistance] = useState("");
  const eventGoal = goalType === "running_event" || goalType === "cycling_event";
  const selectedLabels = useMemo(
    () => sportOptions.filter((option) => sports.includes(option.value)).map((option) => option.label),
    [sports],
  );

  function toggleSport(sport: OnboardingSport) {
    setSports((current) => {
      const next = current.includes(sport) ? current.filter((item) => item !== sport) : [...current, sport];
      if (!next.includes(priority as OnboardingSport)) setPriority(next.length > 1 ? "balanced" : (next[0] === "volleyball" ? "balanced" : next[0] ?? "balanced"));
      return next;
    });
  }

  function canContinue(): boolean {
    if (step === 0) return sports.some((sport) => sport !== "volleyball");
    if (step === 1) return goalType !== null;
    if (step === 2) return availableDays.length > 0;
    return true;
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <header className="mb-6 sm:mb-8">
        <div className="flex items-center justify-between gap-4">
          <p className="text-lg font-black tracking-[-.03em]">UltraPilot</p>
          <p className="text-xs font-bold text-[var(--muted)]">Schritt {step + 1} von {steps.length}</p>
        </div>
        <div className="mt-4 grid grid-cols-5 gap-1.5" aria-label="Fortschritt">
          {steps.map((label, index) => (
            <div key={label}>
              <div className={`h-1.5 rounded-full ${index <= step ? "bg-[var(--accent)]" : "bg-[var(--line)]"}`} />
              <span className="mt-1.5 hidden text-[.65rem] font-bold text-[var(--muted)] sm:block">{label}</span>
            </div>
          ))}
        </div>
      </header>

      {error && (
        <p role="alert" className="mb-5 rounded-xl border border-[var(--danger)] bg-[var(--danger-soft)] px-4 py-3 text-sm font-bold text-[var(--danger)]">
          {error}
        </p>
      )}

      <form action={completeOnboarding}>
        <section hidden={step !== 0} className="card p-5 sm:p-8">
          <p className="eyebrow">Wie trainierst du?</p>
          <h1 className="mt-2 text-3xl font-black tracking-[-.04em] sm:text-4xl">Dein Sportmix, nicht irgendeine Schublade.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">Wähle alles, was regelmäßig in deiner Woche vorkommt. Jede Sportart erhält ihre eigene Frequenz.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {sportOptions.map((option) => {
              const selected = sports.includes(option.value);
              return (
                <label key={option.value} className={`${choiceClass} ${selectedStyle(selected)}`}>
                  <input className="sr-only" type="checkbox" name="sports" value={option.value} checked={selected} onChange={() => toggleSport(option.value)} />
                  <span className="flex items-start gap-3">
                    <span className="grid min-w-12 place-items-center rounded-xl bg-[var(--surface-strong)] px-2 py-2 text-[.62rem] font-black tracking-wider">{option.mark}</span>
                    <span><strong className="block">{option.label}</strong><span className="mt-1 block text-xs text-[var(--muted)]">{option.hint}</span></span>
                  </span>
                </label>
              );
            })}
          </div>
          {sports.length > 0 && sports.every((sport) => sport === "volleyball") && (
            <p role="status" className="mt-3 text-sm font-semibold text-[var(--muted)]">
              Volleyball wird als Zusatzbelastung eingeplant. Wähle dazu Laufen, Radfahren oder Krafttraining.
            </p>
          )}
          {sports.length > 0 && (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {sports.map((sport) => (
                <label key={sport} className="text-sm font-semibold">
                  {sportOptions.find((option) => option.value === sport)?.label} pro Woche
                  <select name={`${sport}Sessions`} defaultValue={sport === "volleyball" ? 1 : 3} className={inputClass}>
                    {[1, 2, 3, 4, 5, 6, 7].map((count) => <option key={count} value={count}>{count}× / Woche</option>)}
                  </select>
                </label>
              ))}
            </div>
          )}
          {sports.length > 1 && (
            <div className="mt-6">
              <p className="text-sm font-black">Was hat aktuell Priorität?</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {[...sports.filter((sport) => sport !== "volleyball"), "balanced" as const].map((value) => (
                  <label key={value} className={`rounded-full border px-4 py-2 text-sm font-bold ${selectedStyle(priority === value)}`}>
                    <input className="sr-only" type="radio" name="sportPriority" value={value} checked={priority === value} onChange={() => setPriority(value as OnboardingPriority)} />
                    {value === "balanced" ? "Ausgeglichen" : sportOptions.find((option) => option.value === value)?.label}
                  </label>
                ))}
              </div>
            </div>
          )}
          {sports.length <= 1 && <input type="hidden" name="sportPriority" value={priority} />}
        </section>

        <section hidden={step !== 1} className="card p-5 sm:p-8">
          <p className="eyebrow">Was möchtest du erreichen?</p>
          <h1 className="mt-2 text-3xl font-black tracking-[-.04em] sm:text-4xl">Ein Ziel, das zu deinem Training passt.</h1>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {goalOptions.map((option) => (
              <label key={option.value} className={`${choiceClass} ${selectedStyle(goalType === option.value)}`}>
                <input className="sr-only" type="radio" name="goalType" value={option.value} checked={goalType === option.value} onChange={() => setGoalType(option.value)} />
                <strong className="block">{option.label}</strong>
                <span className="mt-1 block text-xs text-[var(--muted)]">{option.hint}</span>
              </label>
            ))}
          </div>
          {(eventGoal || goalType === "custom") && (
            <div className="mt-6 grid gap-4 border-t border-[var(--line)] pt-6 sm:grid-cols-2">
              <label className="text-sm font-semibold sm:col-span-2">{eventGoal ? "Eventname" : "Dein Ziel"}<input name="eventName" maxLength={200} placeholder={goalType === "running_event" ? "z. B. erster Halbmarathon" : "Kurz und konkret"} className={inputClass} /></label>
              {eventGoal && <label className="text-sm font-semibold">Eventdatum <span className="font-normal text-[var(--muted)]">(optional)</span><input name="targetDate" type="date" className={inputClass} /></label>}
              {eventGoal && <label className="text-sm font-semibold">Distanz (km) <span className="font-normal text-[var(--muted)]">(optional)</span><input name="eventDistance" value={eventDistance} onChange={(event) => setEventDistance(event.target.value)} inputMode="decimal" placeholder="z. B. 21,1" className={inputClass} /></label>}
              {goalType === "running_event" && (
                <div className="flex flex-wrap gap-2 sm:col-span-2">
                  {[{ label: "5 km", value: "5" }, { label: "10 km", value: "10" }, { label: "Halbmarathon", value: "21.1" }, { label: "Marathon", value: "42.195" }].map((preset) => (
                    <button key={preset.value} type="button" onClick={() => setEventDistance(preset.value)} className="secondary-button !min-h-9 !px-3 !py-1.5 text-xs">{preset.label}</button>
                  ))}
                </div>
              )}
              {goalType === "running_event" && <><label className="text-sm font-semibold">Zielzeit Stunden <span className="font-normal text-[var(--muted)]">(optional)</span><input name="targetTimeHours" type="number" min={0} max={999} className={inputClass} /></label><label className="text-sm font-semibold">Minuten<input name="targetTimeMinutes" type="number" min={0} max={59} className={inputClass} /></label></>}
              {goalType === "cycling_event" && <><label className="text-sm font-semibold">Höhenmeter <span className="font-normal text-[var(--muted)]">(optional)</span><input name="eventElevation" type="number" min={0} max={1000000} className={inputClass} /></label><label className="text-sm font-semibold">Support <span className="font-normal text-[var(--muted)]">(optional)</span><select name="supportMode" defaultValue="" className={inputClass}><option value="">Noch offen</option><option value="supported">Mit Support</option><option value="nonsupported">Ohne Support</option><option value="open">Nicht entschieden</option></select></label></>}
            </div>
          )}
          {sports.includes("strength") && (
            <div className="mt-6 grid gap-4 border-t border-[var(--line)] pt-6 sm:grid-cols-2">
              <label className="text-sm font-semibold">Trainingserfahrung<select name="gymExperience" defaultValue="beginner" className={inputClass}><option value="beginner">Einsteiger / Wiedereinstieg</option><option value="intermediate">Regelmäßig trainiert</option><option value="advanced">Fortgeschritten</option></select></label>
              <fieldset><legend className="text-sm font-semibold">Verfügbares Equipment</legend><div className="mt-2 flex flex-wrap gap-2">{["Körpergewicht", "Kurzhanteln", "Langhantel", "Maschinen", "Kabelzug"].map((item) => <label key={item} className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs font-bold"><input name="gymEquipment" value={item} type="checkbox" className="mr-2" />{item}</label>)}</div></fieldset>
            </div>
          )}
        </section>

        <section hidden={step !== 2} className="card p-5 sm:p-8">
          <p className="eyebrow">Dein echtes Leben</p>
          <h1 className="mt-2 text-3xl font-black tracking-[-.04em] sm:text-4xl">Wann passt Training normalerweise?</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">UltraPilot verteilt nur auf Tage, die du freigibst. Dienstplan und konkrete Termine kannst du später zusätzlich importieren.</p>
          <fieldset className="mt-6"><legend className="text-sm font-black">Verfügbare Wochentage</legend><div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-7">{weekdays.map((day) => { const selected = availableDays.includes(day.value); return <label key={day.value} className={`grid min-h-12 place-items-center rounded-xl border text-sm font-black ${selectedStyle(selected)}`}><input className="sr-only" type="checkbox" name="availableWeekdays" value={day.value} checked={selected} onChange={() => setAvailableDays((current) => selected ? current.filter((value) => value !== day.value) : [...current, day.value].sort())} />{day.label}</label>; })}</div></fieldset>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {(sports.includes("running") || sports.includes("cycling")) && <label className="text-sm font-semibold">Aktueller Wochenumfang (km) <span className="font-normal text-[var(--muted)]">(0 ist okay)</span><input name="currentWeeklyDistance" inputMode="decimal" placeholder="0" className={inputClass} /><span className="mt-1.5 block text-xs font-normal leading-5 text-[var(--muted)]">Das ist dein Ausgangsniveau – nicht automatisch dein Planungsziel.</span></label>}
            <label className="text-sm font-semibold">Max. Dauer an Arbeitstagen (min)<input name="workdayMax" type="number" min={15} max={360} defaultValue={90} className={inputClass} /></label>
          </div>
          <div className="mt-5 space-y-3">
            <label className="flex gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 text-sm font-semibold"><input name="beforeLate" type="checkbox" defaultChecked /><span><strong className="block">Training vor einer Spätschicht ist möglich</strong><span className="mt-1 block text-xs font-normal text-[var(--muted)]">UltraPilot darf das freie Fenster davor nutzen.</span></span></label>
            <label className="flex gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 text-sm font-semibold"><input name="afterNight" type="checkbox" /><span><strong className="block">Training nach einer Nachtschicht ist möglich</strong><span className="mt-1 block text-xs font-normal text-[var(--muted)]">Ausgeschaltet bleibt dieses Zeitfenster geschützt.</span></span></label>
          </div>
        </section>

        <section hidden={step !== 3} className="card p-5 sm:p-8">
          <p className="eyebrow">Daten & Leistungswerte</p>
          <h1 className="mt-2 text-3xl font-black tracking-[-.04em] sm:text-4xl">Nur das, was du wirklich nutzt.</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Diese Auswahl erklärt den späteren Importweg. Sie richtet keine Garmin- oder Polar-Direktsynchronisation ein.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">{dataSources.map((source) => { const selected = devices.includes(source.value); return <button key={source.value} type="button" aria-pressed={selected} onClick={() => setDevices((current) => selected ? current.filter((item) => item !== source.value) : [...current, source.value])} className={`${choiceClass} ${selectedStyle(selected)}`}><strong className="block">{source.label}</strong><span className="mt-1 block text-xs text-[var(--muted)]">{source.hint}</span></button>; })}</div>
          {(sports.includes("running") || sports.includes("cycling")) && <div className="mt-6 grid gap-4 border-t border-[var(--line)] pt-6 sm:grid-cols-3"><label className="text-sm font-semibold">Maximalpuls <span className="font-normal text-[var(--muted)]">optional</span><input name="maxHeartRate" type="number" min={80} max={240} className={inputClass} /></label><label className="text-sm font-semibold">Ruhepuls <span className="font-normal text-[var(--muted)]">optional</span><input name="restingHeartRate" type="number" min={25} max={120} className={inputClass} /></label>{sports.includes("cycling") && <label className="text-sm font-semibold">FTP (Watt) <span className="font-normal text-[var(--muted)]">optional</span><input name="ftpWatts" type="number" min={50} max={1000} className={inputClass} /></label>}</div>}
          <p className="mt-4 text-xs leading-5 text-[var(--muted)]">Fehlende Werte werden nicht von einer KI geschätzt. Du kannst sie später ergänzen.</p>
        </section>

        <section hidden={step !== 4} className="card p-5 sm:p-8">
          <p className="eyebrow">Bereit für deinen ersten Plan</p>
          <h1 className="mt-2 text-3xl font-black tracking-[-.04em] sm:text-4xl">UltraPilot hat die wichtigen Dinge verstanden.</h1>
          <dl className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-[var(--surface)] p-4"><dt className="text-xs font-bold text-[var(--muted)]">Sportarten</dt><dd className="mt-1 font-black">{selectedLabels.join(" · ")}</dd></div>
            <div className="rounded-2xl bg-[var(--surface)] p-4"><dt className="text-xs font-bold text-[var(--muted)]">Ziel</dt><dd className="mt-1 font-black">{goalOptions.find((option) => option.value === goalType)?.label}</dd></div>
            <div className="rounded-2xl bg-[var(--surface)] p-4"><dt className="text-xs font-bold text-[var(--muted)]">Trainierbare Tage</dt><dd className="mt-1 font-black">{availableDays.map((value) => weekdays.find((day) => day.value === value)?.label).join(" · ")}</dd></div>
            <div className="rounded-2xl bg-[var(--surface)] p-4"><dt className="text-xs font-bold text-[var(--muted)]">Danach</dt><dd className="mt-1 font-black">Plan wird automatisch erstellt</dd></div>
          </dl>
          {sports.includes("strength") && <p className="mt-5 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 text-sm leading-6 text-[var(--muted)]">Krafttermine werden direkt in die gemeinsame Woche eingeplant. Danach führt dich der bestehende Gym Builder zu den konkreten Übungen.</p>}
        </section>

        <footer className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button type="button" onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={step === 0} className="secondary-button disabled:invisible">Zurück</button>
          {step < steps.length - 1 ? (
            <button type="button" onClick={() => canContinue() && setStep((current) => Math.min(steps.length - 1, current + 1))} disabled={!canContinue()} className="primary-button disabled:cursor-not-allowed disabled:opacity-50">Weiter</button>
          ) : <SubmitButton />}
        </footer>
      </form>
    </div>
  );
}

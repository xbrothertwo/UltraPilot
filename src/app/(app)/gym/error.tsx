"use client";

export default function GymError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <section role="alert" className="card p-8 text-center">
    <p className="eyebrow">Gym konnte nicht geladen werden</p>
    <h1 className="mt-2 text-2xl font-black">Die Datenbankanfrage ist fehlgeschlagen.</h1>
    <p className="mt-2 text-sm text-[var(--muted)]">Prüfe, ob die Gym-Migration und der Library-Import bereits ausgeführt wurden.</p>
    <button type="button" onClick={reset} className="primary-button mt-5">Erneut versuchen</button>
  </section>;
}

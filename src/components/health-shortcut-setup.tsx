"use client";

import { useActionState, useState } from "react";
import { createHealthShortcutConnection, revokeHealthShortcutConnection, type HealthShortcutTokenState } from "@/app/settings/health-shortcut-actions";
import type { HealthShortcutStatus } from "@/lib/apple-health/shortcut-connection";

const initialState: HealthShortcutTokenState = { status: "idle", message: "" };

function CopyButton({ value, label = "Kopieren" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return <button type="button" onClick={async () => { await navigator.clipboard.writeText(value); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }} className="shrink-0 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-black text-blue-700">{copied ? "Kopiert ✓" : label}</button>;
}

function CodeRow({ label, value, secret = false }: { label: string; value: string; secret?: boolean }) {
  return <div className="min-w-0"><p className="mb-1.5 text-xs font-bold text-[var(--muted)]">{label}</p><div className="flex min-w-0 items-center gap-2 overflow-hidden rounded-xl border border-blue-100 bg-blue-50/70 p-2"><code className={`block w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap bg-transparent px-1 text-xs text-blue-950 ${secret ? "font-bold" : ""}`}>{value}</code><CopyButton value={value}/></div></div>;
}

export function HealthShortcutSetup({ status, endpointUrl }: { status: HealthShortcutStatus; endpointUrl: string }) {
  const [state, createAction, pending] = useActionState(createHealthShortcutConnection, initialState);
  const active = status.connected || state.status === "success";
  return <section className="card mt-6 max-w-4xl overflow-hidden">
    <div className="border-b border-[var(--line)] bg-gradient-to-r from-blue-50/80 to-cyan-50/60 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow">Apple Health · täglich</p><h2 className="mt-2 text-2xl font-black tracking-tight">Automatisch vom iPhone synchronisieren</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">Ein kostenloser Kurzbefehl überträgt Schlaf, Nacht-HF, HRV sowie Läufe, Gym und Volleyball. Radfahrten werden serverseitig immer verworfen.</p></div><span className={`rounded-full px-3 py-1.5 text-xs font-black ${active ? "bg-emerald-100 text-emerald-900" : "bg-slate-200 text-slate-700"}`}>{active ? "Verbunden" : "Noch nicht verbunden"}</span></div>
    </div>
    <div className="p-6">
      {!status.databaseReady && <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">Führe zuerst die Migration <code>202608030013_health_shortcut_sync.sql</code> in Supabase aus.</p>}
      {status.databaseReady && !status.serviceRoleConfigured && <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">In Vercel fehlt noch <code>SUPABASE_SECRET_KEY</code>. Dieser Schlüssel ist ausschließlich serverseitig und darf niemals <code>NEXT_PUBLIC_</code> heißen.</p>}

      <div className="mt-5 grid gap-4 sm:grid-cols-2"><CodeRow label="UltraPilot-Endpunkt" value={endpointUrl}/><CodeRow label="Header" value="Authorization: Bearer DEIN_SCHLÜSSEL"/></div>

      {state.status === "success" && state.token && <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-sm font-black text-emerald-950">Nur jetzt sichtbar</p><p className="mt-1 text-xs text-emerald-900">Speichere diesen Schlüssel direkt im Kurzbefehl. UltraPilot speichert nur seinen SHA-256-Fingerabdruck.</p><div className="mt-3"><CodeRow label="Dein persönlicher Verbindungsschlüssel" value={state.token} secret/></div></div>}
      {state.status === "error" && <p className="mt-4 rounded-xl bg-rose-100 px-4 py-3 text-sm font-semibold text-rose-950">{state.message}</p>}

      <div className="mt-5 flex flex-wrap gap-2">
        <form action={createAction}><button disabled={pending || !status.databaseReady} className="primary-button disabled:cursor-not-allowed disabled:opacity-50">{pending ? "Schlüssel wird erstellt …" : active ? "Neuen Schlüssel erzeugen" : "Verbindungsschlüssel erzeugen"}</button></form>
        <a href="/shortcuts/UltraPilot-Health-Sync.shortcut" download className="secondary-button">Kurzbefehl herunterladen</a>
        {active && <form action={revokeHealthShortcutConnection}><button className="secondary-button text-rose-700">Verbindung widerrufen</button></form>}
      </div>
      {status.connected && <p className="mt-3 text-xs text-[var(--muted)]">Aktiver Schlüssel endet auf <strong>{status.tokenHint}</strong>{status.lastUsedAt ? ` · zuletzt genutzt ${new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(status.lastUsedAt))}` : " · noch nicht benutzt"}.</p>}

      <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50/70 p-4">
        <p className="font-black text-blue-950">Fertiger iPhone-Kurzbefehl</p>
        <p className="mt-1 text-sm leading-6 text-blue-900">Erzeuge zuerst oben einen Verbindungsschlüssel. Beim Öffnen der heruntergeladenen Datei fragt iOS genau einmal nach diesem Schlüssel – die komplette Health- und Upload-Logik ist bereits eingebaut.</p>
      </div>

      <details className="mt-7 rounded-2xl border border-[var(--line)] bg-white/70 p-4">
        <summary className="list-none cursor-pointer font-black">Kurzbefehl auf dem iPhone einrichten <span className="float-right text-blue-600">+</span></summary>
        <ol className="mt-5 space-y-5 text-sm leading-6">
          <li><strong>1. Schlüssel erzeugen:</strong> Tippe oben auf „Verbindungsschlüssel erzeugen“ und kopiere den nur einmal sichtbaren Schlüssel.</li>
          <li><strong>2. Installieren:</strong> Tippe auf „Kurzbefehl herunterladen“, öffne die Datei auf dem iPhone und wähle „Kurzbefehl hinzufügen“. Füge den kopierten Schlüssel in die Importfrage ein.</li>
          <li><strong>3. Einmal testen:</strong> Starte „UltraPilot Health Sync“ manuell. Erlaube beim ersten Lauf den abgefragten Lesezugriff auf Health-Daten und den Netzwerkzugriff zu UltraPilot.</li>
          <li><strong>4. Automatisieren:</strong> Öffne in Kurzbefehle „Automation“ → „Tageszeit“, wähle morgens nach dem Aufstehen, „Sofort ausführen“ und anschließend „UltraPilot Health Sync“.</li>
        </ol>
        <p className="mt-4 text-xs leading-5 text-[var(--muted)]">Der Shortcut überträgt jeweils die letzten zwei Tage. Der Server akzeptiert höchstens 5.000 Datensätze, maximal 1 MB und nur Daten der letzten 14 Tage. Apple-Health-Radfahrten werden weiterhin ignoriert, damit deine Garmin-Aktivitäten nicht doppelt entstehen.</p>
      </details>
    </div>
  </section>;
}

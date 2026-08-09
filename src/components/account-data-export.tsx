"use client";

import { useRef, useState } from "react";

type ExportStatus = { kind: "idle" | "pending" | "success" | "error"; message: string };

export function AccountDataExport() {
  const activeRequest = useRef(false);
  const [status, setStatus] = useState<ExportStatus>({ kind: "idle", message: "" });

  async function downloadExport() {
    if (activeRequest.current) return;
    activeRequest.current = true;
    setStatus({ kind: "pending", message: "Dein Datenexport wird erstellt …" });
    try {
      const response = await fetch("/api/account/export", { credentials: "same-origin" });
      if (!response.ok) throw new Error("EXPORT_FAILED");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      try {
        const link = document.createElement("a");
        link.href = url;
        link.download = `ultrapilot-export-${new Date().toISOString().slice(0, 10)}.zip`;
        link.click();
      } finally {
        URL.revokeObjectURL(url);
      }
      setStatus({ kind: "success", message: "Dein Datenexport wurde heruntergeladen." });
    } catch {
      setStatus({ kind: "error", message: "Der Datenexport konnte nicht erstellt werden. Bei sehr großen Aktivitätsdaten kann die Exportgrenze von 250 MB erreicht sein. Bitte versuche es erneut." });
    } finally {
      activeRequest.current = false;
    }
  }

  return <section className="card mt-6 max-w-4xl p-6">
    <h2 className="text-lg font-bold">Datenexport</h2>
    <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">Lade deine Profil-, Trainings-, Aktivitäts-, Planungs-, Recovery-, Ernährungs- und Missionsdaten sowie vorhandene GPX-/FIT-Originaldateien als ZIP herunter.</p>
    <button type="button" onClick={downloadExport} disabled={status.kind === "pending"} className="primary-button mt-5 disabled:cursor-not-allowed disabled:opacity-50">
      {status.kind === "pending" ? "Export wird erstellt …" : "Meine Daten exportieren"}
    </button>
    {status.message ? <p role={status.kind === "error" ? "alert" : "status"} aria-live="polite" className={`mt-4 rounded-xl px-4 py-3 text-sm ${status.kind === "error" ? "bg-red-50 text-red-900" : status.kind === "success" ? "bg-emerald-50 text-emerald-900" : "bg-blue-50 text-blue-900"}`}>{status.message}</p> : null}
  </section>;
}

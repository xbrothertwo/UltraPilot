"use client";

import { useState } from "react";
import { importCalendarEvents } from "@/app/plan/actions";
import { parseIcs, type ParsedCalendarEvent } from "@/lib/calendar/ics-parser";

const kindOptions = [{ value: "work_early", label: "Früher Arbeitsblock" }, { value: "work_late", label: "Später Arbeitsblock" }, { value: "work_night", label: "Nachtarbeit" }, { value: "work_day", label: "Arbeitstag" }, { value: "appointment", label: "Privater Termin" }, { value: "vacation", label: "Urlaub / Abwesenheit" }, { value: "free", label: "Frei" }, { value: "other", label: "Sonstiges" }];

function suggestion(code: string, events: ParsedCalendarEvent[]): string {
  const matching = events.filter((event) => event.title === code);
  if (matching.every((event) => event.allDay)) return "other";
  const starts = matching.map((event) => new Date(event.startsAt).getHours());
  const crossesDate = matching.some((event) => event.startsAt.slice(0, 10) !== event.endsAt.slice(0, 10));
  if (crossesDate || /N$/i.test(code)) return "work_night";
  if (starts.every((hour) => hour >= 13)) return "work_late";
  if (starts.every((hour) => hour <= 8)) return "work_early";
  return "other";
}

export function CalendarImport() {
  const [events, setEvents] = useState<ParsedCalendarEvent[]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const codes = [...new Set(events.map((event) => event.title))].sort();
  async function readFile(file: File | undefined) {
    if (!file) return;
    try {
      const parsed = parseIcs(await file.text());
      setEvents(parsed);
      setMappings(Object.fromEntries([...new Set(parsed.map((event) => event.title))].map((code) => [code, suggestion(code, parsed)])));
      setError(null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Datei konnte nicht gelesen werden."); setEvents([]); }
  }
  return <div><label className="block rounded-2xl border-2 border-dashed border-[var(--line)] bg-blue-50/45 p-5 text-center text-sm font-semibold">ICS-Datei auswählen<input className="mt-3 block w-full text-sm" type="file" accept=".ics,text/calendar" onChange={(event) => void readFile(event.target.files?.[0])} /></label>{error && <p className="mt-3 rounded-xl bg-red-100 p-3 text-sm text-red-900">{error}</p>}{events.length > 0 && <form action={importCalendarEvents} className="mt-5"><p className="text-sm"><strong>{events.length} Termine erkannt.</strong> Beschreibungen und Orte werden nicht importiert.</p><div className="mt-4 grid gap-3 sm:grid-cols-2">{codes.map((code) => <label key={code} className="rounded-xl border border-[var(--line)] p-3 text-sm"><span className="font-bold">{code}</span><select className="mt-2 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2" value={mappings[code]} onChange={(event) => setMappings((current) => ({ ...current, [code]: event.target.value }))}>{kindOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>)}</div><input type="hidden" name="eventsJson" value={JSON.stringify(events)} /><input type="hidden" name="mappingsJson" value={JSON.stringify(mappings)} /><button className="mt-4 rounded-xl bg-[var(--accent)] px-5 py-3 font-bold text-white" type="submit">Termine importieren</button></form>}</div>;
}


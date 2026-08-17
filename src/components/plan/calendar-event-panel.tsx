"use client";

import { useEffect, useRef } from "react";
import {
  deleteCalendarEvent,
  saveCalendarEvent,
} from "@/app/plan/actions";
import type { PlanningEvent } from "@/lib/planning/data";

const fieldClass =
  "mt-1.5 w-full rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-2.5";

function dateTimeLocal(value: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

export function CalendarEventPanel({
  event,
  week,
  onClose,
}: {
  event: PlanningEvent;
  week: string;
  onClose: () => void;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const handleKeyDown = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousFocus && "focus" in previousFocus) {
        (previousFocus as HTMLElement).focus();
      }
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="calendar-event-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-[color-mix(in_srgb,var(--ink)_46%,transparent)] backdrop-blur-sm lg:items-stretch lg:justify-end"
      onMouseDown={(mouseEvent) => {
        if (mouseEvent.target === mouseEvent.currentTarget) onClose();
      }}
    >
      <section className="mobile-safe-sheet max-h-[calc(100dvh-1rem)] w-full overflow-y-auto rounded-t-[1.75rem] border border-[var(--line)] bg-[var(--card)] p-5 shadow-2xl lg:max-h-none lg:w-[31rem] lg:rounded-none lg:border-y-0 lg:border-r-0 lg:p-7">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Kalendertermin</p>
            <h2 id="calendar-event-title" className="mt-2 text-2xl font-black">
              {event.id ? "Termin bearbeiten" : "Eigenen Termin hinzufügen"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              {event.id
                ? "Manuelle Änderungen bleiben auch bei einem erneuten ICS-Import erhalten."
                : "Der Termin blockiert dieses Zeitfenster für die automatische Planung."}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Kalendertermin schließen"
            className="grid size-11 shrink-0 place-items-center rounded-full border border-[var(--line)] bg-[var(--surface)] text-xl"
          >
            ×
          </button>
        </header>
        <form action={saveCalendarEvent} className="mt-6 grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="id" value={event.id} />
          <input type="hidden" name="week" value={week} />
          <label className="text-sm font-bold sm:col-span-2">
            Titel
            <input
              name="title"
              required
              maxLength={200}
              defaultValue={event.title}
              className={fieldClass}
            />
          </label>
          <label className="text-sm font-bold sm:col-span-2">
            Terminart
            <select
              name="eventKind"
              defaultValue={event.eventKind}
              className={fieldClass}
            >
              <option value="work_early">Früher Arbeitsblock</option>
              <option value="work_late">Später Arbeitsblock</option>
              <option value="work_night">Nachtarbeit</option>
              <option value="work_day">Arbeitstag</option>
              <option value="appointment">Termin</option>
              <option value="vacation">Urlaub</option>
              <option value="free">Frei</option>
              <option value="other">Sonstiges</option>
            </select>
          </label>
          <label className="text-sm font-bold">
            Beginn
            <input
              name="startsAt"
              type="datetime-local"
              required
              defaultValue={dateTimeLocal(event.startsAt)}
              className={fieldClass}
            />
          </label>
          <label className="text-sm font-bold">
            Ende
            <input
              name="endsAt"
              type="datetime-local"
              required
              defaultValue={dateTimeLocal(event.endsAt)}
              className={fieldClass}
            />
          </label>
          <label className="flex items-center gap-2 text-sm font-bold sm:col-span-2">
            <input name="allDay" type="checkbox" defaultChecked={event.allDay} />
            Ganztägiger Termin
          </label>
          <button type="submit" className="primary-button sm:col-span-2">
            Termin speichern
          </button>
        </form>
        {event.id ? (
          <form action={deleteCalendarEvent} className="mt-3">
            <input type="hidden" name="id" value={event.id} />
            <input type="hidden" name="week" value={week} />
            <button className="w-full rounded-xl px-5 py-2.5 text-sm font-bold text-[var(--danger)] hover:bg-[var(--danger-soft)]">
              Termin löschen
            </button>
          </form>
        ) : null}
      </section>
    </div>
  );
}

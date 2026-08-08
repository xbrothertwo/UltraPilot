export type BusyCalendarEvent = { startsAt: string; endsAt: string; allDay: boolean; eventKind?: string };
export type AvailabilityWindow = { startsAt: string; endsAt: string; durationMinutes: number };

export function calculateDailyAvailability(date: string, events: BusyCalendarEvent[], minimumMinutes = 30, dayStartHour = 6, dayEndHour = 22, beforeLateShiftAllowed = true, afterNightShiftAllowed = true): AvailabilityWindow[] {
  const dayStart = new Date(zonedLocalTimeToIso(`${date.replaceAll("-", "")}T${String(dayStartHour).padStart(2, "0")}0000`, "Europe/Berlin")).getTime();
  const dayEnd = new Date(zonedLocalTimeToIso(`${date.replaceAll("-", "")}T${String(dayEndHour).padStart(2, "0")}0000`, "Europe/Berlin")).getTime();
  const busy = events.flatMap((event) => {
    const start = Math.max(dayStart, new Date(event.startsAt).getTime());
    const end = Math.min(dayEnd, new Date(event.endsAt).getTime());
    return end > start ? [{ start, end }] : [];
  });
  if (!beforeLateShiftAllowed) {
    const lateStart = events
      .filter((event) => event.eventKind === "work_late")
      .map((event) => Math.max(dayStart, new Date(event.startsAt).getTime()))
      .reduce((min, value) => Math.min(min, value), Infinity);
    if (lateStart > dayStart && lateStart < dayEnd) busy.push({ start: dayStart, end: lateStart });
  }
  if (!afterNightShiftAllowed) {
    const nightEnd = events
      .filter((event) => event.eventKind === "work_night")
      .map((event) => Math.min(dayEnd, new Date(event.endsAt).getTime()))
      .reduce((max, value) => Math.max(max, value), -Infinity);
    if (nightEnd > dayStart && nightEnd < dayEnd) busy.push({ start: nightEnd, end: dayEnd });
  }
  busy.sort((a, b) => a.start - b.start);
  const merged: Array<{ start: number; end: number }> = [];
  for (const item of busy) {
    const last = merged.at(-1);
    if (last && item.start <= last.end) last.end = Math.max(last.end, item.end);
    else merged.push({ ...item });
  }
  let cursor = dayStart;
  const windows: AvailabilityWindow[] = [];
  for (const item of merged.concat({ start: dayEnd, end: dayEnd })) {
    const durationMinutes = Math.floor((item.start - cursor) / 60_000);
    if (durationMinutes >= minimumMinutes) windows.push({ startsAt: new Date(cursor).toISOString(), endsAt: new Date(item.start).toISOString(), durationMinutes });
    cursor = Math.max(cursor, item.end);
  }
  return windows;
}
import { zonedLocalTimeToIso } from "../calendar/ics-parser";


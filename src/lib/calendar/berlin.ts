import { zonedLocalTimeToIso } from "./ics-parser";

export const BERLIN_TIME_ZONE = "Europe/Berlin";

export function berlinDateKey(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) throw new Error("Ungültiger Datumswert.");
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: BERLIN_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function dateParts(key: string): [number, number, number] {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) throw new Error("Ungültiger Kalendertag.");
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function addBerlinCalendarDays(key: string, count: number): string {
  const [year, month, day] = dateParts(key);
  const shifted = new Date(Date.UTC(year, month - 1, day + count));
  return shifted.toISOString().slice(0, 10);
}

export function berlinWeekStart(key: string): string {
  const [year, month, day] = dateParts(key);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay() || 7;
  return addBerlinCalendarDays(key, 1 - weekday);
}

export function berlinDayInterval(key: string): {
  startInclusive: Date;
  endExclusive: Date;
} {
  dateParts(key);
  const compact = key.replaceAll("-", "");
  const nextCompact = addBerlinCalendarDays(key, 1).replaceAll("-", "");
  return {
    startInclusive: new Date(zonedLocalTimeToIso(`${compact}T000000`, BERLIN_TIME_ZONE)),
    endExclusive: new Date(zonedLocalTimeToIso(`${nextCompact}T000000`, BERLIN_TIME_ZONE)),
  };
}

export function berlinWeekRange(value: Date | string): {
  today: string;
  start: string;
  end: string;
  startsAt: Date;
  endsAtExclusive: Date;
} {
  const today = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : berlinDateKey(value);
  const start = berlinWeekStart(today);
  const end = addBerlinCalendarDays(start, 6);
  return {
    today,
    start,
    end,
    startsAt: berlinDayInterval(start).startInclusive,
    endsAtExclusive: berlinDayInterval(end).endExclusive,
  };
}

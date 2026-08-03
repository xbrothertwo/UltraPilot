export type ParsedCalendarEvent = {
  title: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
};

function unfold(text: string): string[] {
  const physical = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const result: string[] = [];
  for (const line of physical) {
    if (/^[ \t]/.test(line) && result.length) result[result.length - 1] += line.slice(1);
    else result.push(line);
  }
  return result;
}

function unescapeText(value: string): string {
  return value.replace(/\\n/gi, " ").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\").trim();
}

function timezoneOffsetMilliseconds(timestamp: number, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date(timestamp));
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((item) => item.type === type)?.value);
  return Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"), part("second")) - timestamp;
}

export function zonedLocalTimeToIso(value: string, timezone: string): string {
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(value);
  if (!match) throw new Error(`Ungültiger ICS-Zeitwert: ${value}`);
  const base = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6]));
  if (match[7] === "Z") return new Date(base).toISOString();
  let result = base - timezoneOffsetMilliseconds(base, timezone);
  result = base - timezoneOffsetMilliseconds(result, timezone);
  return new Date(result).toISOString();
}

function dateToIso(value: string, timezone: string): string {
  if (!/^\d{8}$/.test(value)) throw new Error(`Ungültiges ICS-Datum: ${value}`);
  return zonedLocalTimeToIso(`${value}T000000`, timezone);
}

function property(line: string): { name: string; parameters: Record<string, string>; value: string } | null {
  const colon = line.indexOf(":");
  if (colon < 0) return null;
  const [name, ...parameterParts] = line.slice(0, colon).split(";");
  const parameters = Object.fromEntries(parameterParts.map((item) => { const [key, ...rest] = item.split("="); return [key.toUpperCase(), rest.join("=")]; }));
  return { name: name.toUpperCase(), parameters, value: line.slice(colon + 1) };
}

export function parseIcs(text: string, defaultTimezone = "Europe/Berlin"): ParsedCalendarEvent[] {
  if (text.length > 5_000_000) throw new Error("Die ICS-Datei ist zu groß.");
  const events: ParsedCalendarEvent[] = [];
  let current: Record<string, ReturnType<typeof property>> | null = null;
  for (const line of unfold(text)) {
    if (line === "BEGIN:VEVENT") { current = {}; continue; }
    if (line === "END:VEVENT") {
      if (!current) continue;
      const summary = current.SUMMARY;
      const start = current.DTSTART;
      const end = current.DTEND;
      if (summary && start && end) {
        const allDay = start.parameters.VALUE === "DATE" || /^\d{8}$/.test(start.value);
        const timezone = start.parameters.TZID || defaultTimezone;
        const startsAt = allDay ? dateToIso(start.value, timezone) : zonedLocalTimeToIso(start.value, timezone);
        let endsAt = allDay ? dateToIso(end.value, end.parameters.TZID || timezone) : zonedLocalTimeToIso(end.value, end.parameters.TZID || timezone);
        if (allDay && endsAt <= startsAt) endsAt = new Date(new Date(startsAt).getTime() + 86_400_000).toISOString();
        events.push({ title: unescapeText(summary.value).slice(0, 200), startsAt, endsAt, allDay });
      }
      current = null;
      continue;
    }
    if (current) {
      const parsed = property(line);
      if (parsed?.name === "RRULE") throw new Error("Wiederkehrende ICS-Termine werden noch nicht automatisch aufgelöst. Bitte den Dienstplan als bereits ausgeführte Einzeltermine exportieren.");
      if (parsed && ["SUMMARY", "DTSTART", "DTEND"].includes(parsed.name)) current[parsed.name] = parsed;
    }
  }
  if (!events.length) throw new Error("Die Datei enthält keine lesbaren Kalendereinträge.");
  return events.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

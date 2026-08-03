import { describe, expect, it } from "vitest";
import { parseIcs } from "../src/lib/calendar/ics-parser";

describe("ICS parser", () => {
  it("parses timed and all-day shifts in Europe/Berlin", () => {
    const events = parseIcs("BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nSUMMARY:02S\r\nDTSTART;TZID=Europe/Berlin:20260803T150000\r\nDTEND;TZID=Europe/Berlin:20260803T230000\r\nDESCRIPTION:private data\r\nLOCATION:private place\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nSUMMARY:AKA\r\nDTSTART;VALUE=DATE:20260812\r\nDTEND;VALUE=DATE:20260812\r\nEND:VEVENT\r\nEND:VCALENDAR");
    expect(events[0]).toEqual({ title: "02S", startsAt: "2026-08-03T13:00:00.000Z", endsAt: "2026-08-03T21:00:00.000Z", allDay: false });
    expect(events[1].allDay).toBe(true);
    expect(new Date(events[1].endsAt).getTime() - new Date(events[1].startsAt).getTime()).toBe(86_400_000);
    expect(JSON.stringify(events)).not.toContain("private");
  });

  it("unfolds lines and unescapes summaries", () => {
    const [event] = parseIcs("BEGIN:VCALENDAR\nBEGIN:VEVENT\nSUMMARY:Langer\\, Di\n enst\nDTSTART:20260801T070000Z\nDTEND:20260801T080000Z\nEND:VEVENT\nEND:VCALENDAR");
    expect(event.title).toBe("Langer, Dienst");
  });

  it("rejects unresolved recurring rules instead of silently losing occurrences", () => {
    expect(() => parseIcs("BEGIN:VCALENDAR\nBEGIN:VEVENT\nSUMMARY:Termin\nDTSTART:20260801T070000Z\nDTEND:20260801T080000Z\nRRULE:FREQ=WEEKLY\nEND:VEVENT\nEND:VCALENDAR")).toThrow(/Wiederkehrende/);
  });
});


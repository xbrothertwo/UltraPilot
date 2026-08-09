import { describe, expect, it } from "vitest";
import { allDayEventBounds, eventOverlapsLocalDay, parseIcs, zonedLocalTimeToIso } from "../src/lib/calendar/ics-parser";

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

describe("allDayEventBounds", () => {
  it("blocks the full local calendar day regardless of the entered time-of-day", () => {
    const bounds = allDayEventBounds("2026-08-10T09:00", "2026-08-10T17:00");
    expect(bounds).toEqual({ startsAt: "2026-08-09T22:00:00.000Z", endsAt: "2026-08-10T22:00:00.000Z" });
    expect(new Date(bounds.endsAt).getTime() - new Date(bounds.startsAt).getTime()).toBe(86_400_000);
  });

  it("spans multiple days when start and end dates differ", () => {
    const bounds = allDayEventBounds("2026-08-10T09:00", "2026-08-11T17:00");
    expect(new Date(bounds.endsAt).getTime() - new Date(bounds.startsAt).getTime()).toBe(2 * 86_400_000);
  });
});

describe("eventOverlapsLocalDay", () => {
  it("attributes an activity shortly after German midnight to the new day, not the UTC day", () => {
    const event = { startsAt: "2026-01-14T23:30:00.000Z", endsAt: "2026-01-14T23:45:00.000Z" };
    expect(eventOverlapsLocalDay(event, "2026-01-15")).toBe(true);
    expect(eventOverlapsLocalDay(event, "2026-01-14")).toBe(false);
  });

  it("attributes an activity shortly before German midnight to the correct day", () => {
    const event = { startsAt: "2026-01-14T22:30:00.000Z", endsAt: "2026-01-14T22:45:00.000Z" };
    expect(eventOverlapsLocalDay(event, "2026-01-14")).toBe(true);
    expect(eventOverlapsLocalDay(event, "2026-01-15")).toBe(false);
  });

  it("spans both calendar days for a night shift crossing midnight", () => {
    const event = { startsAt: zonedLocalTimeToIso("20260114T220000", "Europe/Berlin"), endsAt: zonedLocalTimeToIso("20260115T060000", "Europe/Berlin") };
    expect(eventOverlapsLocalDay(event, "2026-01-14")).toBe(true);
    expect(eventOverlapsLocalDay(event, "2026-01-15")).toBe(true);
    expect(eventOverlapsLocalDay(event, "2026-01-16")).toBe(false);
  });

  it("assigns an event starting exactly at midnight only to the new day", () => {
    const event = {
      startsAt: zonedLocalTimeToIso("20260115T000000", "Europe/Berlin"),
      endsAt: zonedLocalTimeToIso("20260115T010000", "Europe/Berlin"),
    };
    expect(eventOverlapsLocalDay(event, "2026-01-14")).toBe(false);
    expect(eventOverlapsLocalDay(event, "2026-01-15")).toBe(true);
  });

  it("attributes an activity to the correct day across the spring DST transition", () => {
    const event = { startsAt: zonedLocalTimeToIso("20260329T110000", "Europe/Berlin"), endsAt: zonedLocalTimeToIso("20260329T120000", "Europe/Berlin") };
    expect(eventOverlapsLocalDay(event, "2026-03-29")).toBe(true);
    expect(eventOverlapsLocalDay(event, "2026-03-28")).toBe(false);
    expect(eventOverlapsLocalDay(event, "2026-03-30")).toBe(false);
  });

  it("attributes an activity to the correct day across the autumn DST transition", () => {
    const event = { startsAt: zonedLocalTimeToIso("20261025T110000", "Europe/Berlin"), endsAt: zonedLocalTimeToIso("20261025T120000", "Europe/Berlin") };
    expect(eventOverlapsLocalDay(event, "2026-10-25")).toBe(true);
    expect(eventOverlapsLocalDay(event, "2026-10-24")).toBe(false);
    expect(eventOverlapsLocalDay(event, "2026-10-26")).toBe(false);
  });
});


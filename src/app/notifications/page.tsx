import type { Metadata } from "next";
import { PageHeading } from "@/components/page-heading";

export const metadata: Metadata = { title: "Benachrichtigungen" };

const upcoming = [
  {
    title: "Tagesansicht",
    description:
      "Der heutige Tag als durchgehende Zeitleiste statt einzelner Karten.",
  },
  {
    title: "Erinnerungen",
    description:
      "Hinweise zu Einheiten, Verpflegung und Check-ins zur richtigen Zeit.",
  },
  {
    title: "Wochenanpassungen",
    description:
      "Nachricht, sobald UltraPilot die Woche automatisch neu verteilt hat.",
  },
];

export default function NotificationsPage() {
  return (
    <>
      <PageHeading
        eyebrow="Cockpit"
        title="Benachrichtigungen"
        description="Noch nicht verfügbar. Hier landen künftig Hinweise zu deinem Training, ohne dass du aktiv nachschauen musst."
      />

      <section className="cut-corner rise-in relative overflow-hidden bg-[#0b2145] p-6 text-white shadow-[0_24px_60px_rgba(9,31,68,.32)] sm:p-10">
        <div className="aurora-drift pointer-events-none absolute -right-20 -top-20 size-72 rounded-full bg-blue-400/20 blur-3xl" />
        <div
          className="aurora-drift pointer-events-none absolute -bottom-28 left-1/4 size-72 rounded-full bg-cyan-300/15 blur-3xl"
          style={{ animationDelay: "-7s" }}
        />
        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full bg-cyan-300/15 px-3 py-1.5 text-[.68rem] font-black uppercase tracking-[.16em] text-cyan-200">
            <span className="size-1.5 rounded-full bg-current" /> Bald
          </span>
          <h2 className="font-display mt-5 max-w-xl text-[2rem] leading-[1.05] sm:text-[2.75rem]">
            Wir bauen gerade daran.
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-blue-100/70 sm:text-base">
            Benachrichtigungen sind Teil der nächsten Ausbaustufe von
            UltraPilot. Bis dahin bleibt alles, was zählt, auf deiner{" "}
            <a href="/dashboard" className="font-bold text-white underline underline-offset-4">
              Heute-Seite
            </a>{" "}
            sichtbar.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {upcoming.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-white/10 bg-white/[.05] p-4"
              >
                <p className="font-display text-sm">{item.title}</p>
                <p className="mt-1.5 text-xs leading-5 text-blue-100/60">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

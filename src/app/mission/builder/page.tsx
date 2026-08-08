import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { UltraMissionBuilder } from "@/components/ultra-mission-builder";
import { getPlanningData } from "@/lib/planning/data";

export const metadata = {
  title: "Ultra Mission Builder",
};

export const dynamic = "force-dynamic";

function defaultStartAt(): string {
  const tomorrow = new Date();

  tomorrow.setDate(
    tomorrow.getDate() + 1,
  );

  const date =
    new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Europe/Berlin",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(tomorrow);

  return `${date}T06:00`;
}

export default async function MissionBuilderPage() {
  const planning =
    await getPlanningData();

  const initialSportType =
    planning.profile.primarySport ===
    "running"
      ? "running"
      : "cycling";

  return (
    <>
      <PageHeading
        eyebrow="Ultra Mission Builder"
        title="Plane deine nächste große Mission"
        description="Simuliere Bewegungszeit, Pausen, Zielankunft, Versorgung und Kontrollpunkte für Rad- oder Laufmissionen. Alle Ergebnisse basieren ausschließlich auf deinen Eingaben."
        action={
          <Link
            href="/mission"
            className="rounded-full border border-[var(--line)] px-4 py-2.5 text-sm font-black"
          >
            Zurück zu Mission Control
          </Link>
        }
      />

      <UltraMissionBuilder
        defaultStartAt={defaultStartAt()}
        initialSportType={
          initialSportType
        }
      />
    </>
  );
}
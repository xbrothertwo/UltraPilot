import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading } from "@/components/page-heading";
import { UltraMissionBuilder } from "@/components/ultra-mission-builder";
import { getMission } from "@/lib/missions";
import { getPlanningData } from "@/lib/planning/data";

export const metadata = {
  title: "Ultra Mission Builder",
};

export const dynamic = "force-dynamic";

type MissionBuilderPageProps = {
  searchParams: Promise<{
    id?: string;
    error?: string;
  }>;
};

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

export default async function MissionBuilderPage({
  searchParams,
}: MissionBuilderPageProps) {
  const parameters =
    await searchParams;

  const missionId =
    parameters.id ?? null;

  const [planning, mission] =
    await Promise.all([
      getPlanningData(),
      missionId
        ? getMission(missionId)
        : Promise.resolve(null),
    ]);

  if (missionId && !mission) {
    notFound();
  }

  const initialSportType =
    planning.profile.primarySport ===
    "running"
      ? "running"
      : "cycling";

  return (
    <>
      <PageHeading
        eyebrow="Ultra Mission Builder"
        title={
          mission
            ? "Mission bearbeiten"
            : "Plane deine nächste große Mission"
        }
        description={
          mission
            ? "Passe Distanz, Tempo, Startzeit, Versorgung und Kontrollpunkte deiner gespeicherten Mission an."
            : "Simuliere Bewegungszeit, Pausen, Zielankunft, Versorgung und Kontrollpunkte für Rad- oder Laufmissionen."
        }
        action={
          <Link
            href="/mission"
            className="rounded-full border border-[var(--line)] px-4 py-2.5 text-sm font-black"
          >
            Zurück zum Mission HQ
          </Link>
        }
      />

      <UltraMissionBuilder
        defaultStartAt={defaultStartAt()}
        initialSportType={
          initialSportType
        }
        initialMission={mission}
        serverError={
          parameters.error ?? null
        }
      />
    </>
  );
}
import Link from "next/link";
import {
  createDerivedMission,
  setMissionStatus,
} from "@/app/mission/actions";
import { PageHeading } from "@/components/page-heading";
import {
  buildMissionDerivedKey,
  deriveMissionTemplates,
  type MissionTemplateInput,
} from "@/lib/mission-templates";
import {
  getMissions,
  type MissionStatus,
  type SavedMission,
} from "@/lib/missions";
import { getPlanningData } from "@/lib/planning/data";

export const metadata = {
  title: "Mission HQ",
};

export const dynamic = "force-dynamic";

const statusLabels: Record<
  MissionStatus,
  string
> = {
  draft: "Entwurf",
  planned: "Geplant",
  completed: "Abgeschlossen",
  archived: "Archiviert",
};

const statusStyles: Record<
  MissionStatus,
  string
> = {
  draft:
    "bg-slate-100 text-slate-700",
  planned:
    "bg-sky-100 text-sky-950",
  completed:
    "bg-emerald-100 text-emerald-950",
  archived:
    "bg-slate-100 text-slate-500",
};

function formatNumber(
  value: number,
): string {
  return value.toLocaleString("de-DE", {
    maximumFractionDigits: 1,
  });
}

function formatPace(
  secondsPerKm: number,
): string {
  const minutes = Math.floor(
    secondsPerKm / 60,
  );

  const seconds =
    secondsPerKm % 60;

  return `${minutes}:${String(
    seconds,
  ).padStart(2, "0")} min/km`;
}

function missionPacingLabel(
  mission: SavedMission,
): string {
  if (
    mission.sportType === "running" &&
    mission.paceSecondsPerKm !== null
  ) {
    return formatPace(
      mission.paceSecondsPerKm,
    );
  }

  if (
    mission.averageSpeedKmh !== null
  ) {
    return `${formatNumber(
      mission.averageSpeedKmh,
    )} km/h`;
  }

  return "Noch nicht festgelegt";
}

export default async function MissionPage() {
  const [planning, missions] =
    await Promise.all([
      getPlanningData(),
      getMissions(),
    ]);

  const profile = planning.profile;

  const sportType =
    profile.primarySport === "running"
      ? "running"
      : "cycling";

  const targetDistanceKm =
    profile.eventDistanceKm;

  const templateInput:
    | MissionTemplateInput
    | null =
    targetDistanceKm !== null &&
    targetDistanceKm > 0
      ? {
          sportType,
          targetDistanceKm,
          targetElevationMeters:
            profile.eventElevationMeters,
        }
      : null;

  const templates = templateInput
    ? deriveMissionTemplates(
        templateInput,
      )
    : [];

  const savedDerivedKeys = new Set(
    missions.flatMap((mission) =>
      mission.derivedKey
        ? [mission.derivedKey]
        : [],
    ),
  );

  const visibleMissions =
    missions.filter(
      (mission) =>
        mission.status !== "archived",
    );

  return (
    <>
      <PageHeading
        eyebrow="Mission HQ"
        title="Vom großen Ziel zur nächsten echten Mission"
        description="Leite kontrollierte Untermissionen aus deinem Hauptziel ab, plane eigene Herausforderungen und halte deinen Fortschritt an einem Ort zusammen."
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/mission/builder"
              className="primary-button"
            >
              Eigene Mission planen
            </Link>

            <Link
              href="/mission/readiness"
              className="rounded-full border border-[var(--line)] px-4 py-2.5 text-sm font-black"
            >
              Nachweise & Bereitschaft
            </Link>
          </div>
        }
      />

      <section className="relative overflow-hidden rounded-[1.8rem] bg-gradient-to-br from-[#07162d] via-[#123a72] to-[#155e9a] p-6 text-white shadow-[0_24px_60px_rgba(9,26,51,.2)] sm:p-9">
        <div className="absolute -right-28 -top-32 size-96 rounded-full border-[60px] border-cyan-300/10" />

        <div className="relative grid gap-8 xl:grid-cols-[1.25fr_.75fr] xl:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[.2em] text-cyan-200">
              Dein Hauptziel
            </p>

            <h2 className="mt-3 text-4xl font-black tracking-[-.05em] sm:text-6xl">
              {profile.eventName ??
                "Deine große Mission"}
            </h2>

            <p className="mt-4 text-xl font-black text-blue-200 sm:text-2xl">
              {targetDistanceKm !== null
                ? `${formatNumber(
                    targetDistanceKm,
                  )} km`
                : "Zieldistanz noch offen"}

              {profile.eventElevationMeters !==
                null &&
                ` · ${formatNumber(
                  profile.eventElevationMeters,
                )} hm`}
            </p>

            <p className="mt-5 max-w-2xl leading-7 text-blue-50/65">
              Das Hauptziel wird nicht direkt in
              deinen Kalender gedrückt. Mission HQ
              zerlegt es in kontrollierbare
              Zwischenziele, die du einzeln
              übernehmen und planen kannst.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[.08] p-5 backdrop-blur-sm">
            <p className="text-xs font-black uppercase tracking-wider text-cyan-100/60">
              Ausrichtung
            </p>

            <p className="mt-2 text-2xl font-black">
              {sportType === "running"
                ? "Laufmission"
                : "Radmission"}
            </p>

            <p className="mt-2 text-sm text-blue-50/60">
              {profile.targetYear
                ? `Zieljahr ${profile.targetYear}`
                : "Kein Zieljahr festgelegt"}
            </p>

            <Link
              href="/settings"
              className="mt-5 inline-flex text-sm font-black text-cyan-200"
            >
              Hauptziel bearbeiten
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-10">
        <p className="eyebrow">
          Abgeleitete Untermissionen
        </p>

        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-3xl font-black tracking-tight">
            Der Weg zum Hauptziel
          </h2>

          <p className="max-w-xl text-sm text-[var(--muted)]">
            Die Vorschläge übernehmen Distanz und
            Höhenprofil proportional. Pace,
            Bewegungsschnitt und Versorgung bleiben
            bearbeitbare Ausgangswerte.
          </p>
        </div>

        {templates.length === 0 ? (
          <div className="card mt-5 p-6">
            <p className="font-black">
              Noch keine Untermissionen ableitbar
            </p>

            <p className="mt-2 text-sm text-[var(--muted)]">
              Lege in den Einstellungen zuerst eine
              gültige Zieldistanz fest.
            </p>

            <Link
              href="/settings"
              className="primary-button mt-5 inline-flex"
            >
              Hauptziel festlegen
            </Link>
          </div>
        ) : (
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            {templates.map((template) => {
              const derivedKey =
                buildMissionDerivedKey(
                  templateInput!,
                  template.key,
                );

              const isSaved =
                savedDerivedKeys.has(
                  derivedKey,
                );

              return (
                <article
                  key={template.key}
                  className="card flex flex-col p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="rounded-full bg-[#edf3fb] px-2.5 py-1 text-[.65rem] font-black uppercase tracking-wider text-[var(--muted)]">
                      {template.sportType ===
                      "running"
                        ? "Laufen"
                        : "Radfahren"}
                    </span>

                    {isSaved && (
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[.65rem] font-black text-emerald-950">
                        Übernommen
                      </span>
                    )}
                  </div>

                  <h3 className="mt-4 text-xl font-black">
                    {template.title}
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                    {template.description}
                  </p>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <TemplateFact
                      label="Distanz"
                      value={`${formatNumber(
                        template.distanceKm,
                      )} km`}
                    />

                    <TemplateFact
                      label="Höhenmeter"
                      value={`${formatNumber(
                        template.elevationMeters,
                      )} hm`}
                    />
                  </div>

                  <div className="mt-auto pt-5">
                    {isSaved ? (
                      <p className="rounded-xl bg-emerald-50 px-4 py-3 text-center text-sm font-black text-emerald-950">
                        Bereits in deinen Missionen
                      </p>
                    ) : (
                      <form
                        action={
                          createDerivedMission
                        }
                      >
                        <input
                          type="hidden"
                          name="templateKey"
                          value={template.key}
                        />

                        <button
                          type="submit"
                          className="primary-button w-full"
                        >
                          Als Untermission übernehmen
                        </button>
                      </form>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-12">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">
              Deine Missionen
            </p>

            <h2 className="mt-2 text-3xl font-black tracking-tight">
              Geplant, getestet, geschafft
            </h2>
          </div>

          <Link
            href="/mission/builder"
            className="primary-button"
          >
            Neue Mission
          </Link>
        </div>

        {visibleMissions.length === 0 ? (
          <div className="card mt-5 p-7 text-center">
            <p className="text-xl font-black">
              Noch keine Mission gespeichert
            </p>

            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[var(--muted)]">
              Übernimm eine vorgeschlagene
              Untermission oder erstelle im Builder
              deine eigene Herausforderung.
            </p>
          </div>
        ) : (
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visibleMissions.map(
              (mission) => (
                <article
                  key={mission.id}
                  className="card flex flex-col p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[.65rem] font-black ${statusStyles[mission.status]}`}
                    >
                      {
                        statusLabels[
                          mission.status
                        ]
                      }
                    </span>

                    <span className="text-xs font-black uppercase tracking-wider text-[var(--muted)]">
                      {mission.source ===
                      "derived"
                        ? "Untermission"
                        : "Eigene Mission"}
                    </span>
                  </div>

                  <h3 className="mt-4 text-xl font-black">
                    {mission.title}
                  </h3>

                  {mission.description && (
                    <p className="mt-2 line-clamp-3 text-sm leading-6 text-[var(--muted)]">
                      {mission.description}
                    </p>
                  )}

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <TemplateFact
                      label="Distanz"
                      value={`${formatNumber(
                        mission.distanceKm,
                      )} km`}
                    />

                    <TemplateFact
                      label={
                        mission.sportType ===
                        "running"
                          ? "Pace"
                          : "Schnitt"
                      }
                      value={missionPacingLabel(
                        mission,
                      )}
                    />
                  </div>

                  <div className="mt-auto flex flex-wrap gap-2 pt-5">
                    {mission.status !==
                      "completed" && (
                      <form
                        action={
                          setMissionStatus
                        }
                      >
                        <input
                          type="hidden"
                          name="missionId"
                          value={mission.id}
                        />

                        <input
                          type="hidden"
                          name="status"
                          value="completed"
                        />

                        <button
                          type="submit"
                          className="rounded-full bg-emerald-100 px-3 py-2 text-xs font-black text-emerald-950"
                        >
                          Als geschafft markieren
                        </button>
                      </form>
                    )}

                    <form
                      action={
                        setMissionStatus
                      }
                    >
                      <input
                        type="hidden"
                        name="missionId"
                        value={mission.id}
                      />

                      <input
                        type="hidden"
                        name="status"
                        value="archived"
                      />

                      <button
                        type="submit"
                        className="rounded-full border border-[var(--line)] px-3 py-2 text-xs font-black"
                      >
                        Archivieren
                      </button>
                    </form>
                  </div>
                </article>
              ),
            )}
          </div>
        )}
      </section>
    </>
  );
}

function TemplateFact({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-[#edf3fb] p-3">
      <p className="text-[.65rem] font-black uppercase tracking-wider text-[var(--muted)]">
        {label}
      </p>

      <p className="mt-1 font-black">
        {value}
      </p>
    </div>
  );
}
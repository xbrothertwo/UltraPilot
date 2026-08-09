import Link from "next/link";
import type { DashboardMissionSelection } from "@/lib/dashboard-view-model";
import type { MissionControl } from "@/lib/mission-control";
import type { PrimarySportResolution } from "@/lib/planning/data";

export function DashboardPrimarySportError({
  resolution,
}: {
  resolution: Exclude<PrimarySportResolution, { status: "valid" }>;
}) {
  const loadError = resolution.status === "load_error";
  return (
    <section className="card mx-auto max-w-2xl p-6 sm:p-8">
      <p className="eyebrow">Dashboard nicht verfügbar</p>
      <h1 className="font-display mt-2 text-3xl">Hauptsportart prüfen</h1>
      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
        {loadError
          ? "Deine Hauptsportart konnte nicht geladen werden. Bitte versuche es erneut."
          : "Wähle in den Planungsregeln Cycling oder Running, damit dein Dashboard korrekt berechnet wird."}
      </p>
      <Link href="/plan#planning-rules" className="primary-button mt-5 inline-flex">
        Planungsregeln öffnen
      </Link>
    </section>
  );
}

function missionDate(value: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Berlin",
  }).format(new Date(`${value}T12:00:00Z`));
}

export function DashboardMissionSummary({
  selection,
  control,
}: {
  selection: DashboardMissionSelection;
  control: MissionControl | null;
}) {
  const milestone = control?.nextMilestone ?? null;
  return (
    <article className="card p-5 sm:p-6">
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-bold text-[var(--muted)]">Deine Ausdauer-Mission</p>
          {control && (
            <span className="text-xs font-black text-violet-600">
              {control.achievedMilestones}/{control.milestones.length}
            </span>
          )}
        </div>
        <h2 className="mt-1 text-lg font-black">
          {control
            ? milestone?.title ?? "Roadmap vollständig"
            : selection?.mission.title ?? "Keine aktive Mission"}
        </h2>
      </div>
      {milestone && (
        <>
          <p className="mt-3 text-sm text-[var(--muted)]">{milestone.evidence}</p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-violet-100">
            <div className="h-full rounded-full bg-violet-500" style={{ width: `${milestone.progressPercent}%` }} />
          </div>
        </>
      )}
      {!control && selection?.mission.targetDate && (
        <p className="mt-3 text-sm text-[var(--muted)]">Zieldatum: {missionDate(selection.mission.targetDate)}</p>
      )}
      <Link href="/mission" className="mt-4 inline-flex text-sm font-black text-violet-600">
        Mission öffnen →
      </Link>
    </article>
  );
}

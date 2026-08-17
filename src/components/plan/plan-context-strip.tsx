import Link from "next/link";
import type {
  TrainingBlock,
  TrainingBlockWeek,
} from "@/lib/planning/blocks";
import type { ReadinessResult } from "@/lib/recovery-readiness";

const readinessLabels: Record<ReadinessResult["status"], string> = {
  green: "Bereit für den Plan",
  yellow: "Heute mit Augenmaß",
  red: "Erholung priorisieren",
  unknown: "Check-in noch offen",
};

const phaseLabels = {
  foundation: "Grundlage",
  build: "Aufbau",
  load: "Belastung",
  peak: "Peak",
  recovery: "Erholung",
} as const;

export function PlanContextStrip({
  readiness,
  block,
  blockWeek,
  week,
}: {
  readiness: ReadinessResult | undefined;
  block: TrainingBlock | null;
  blockWeek: TrainingBlockWeek | null;
  week: string;
}) {
  const checkInComplete = readiness?.checkin !== null && readiness?.checkin !== undefined;

  return (
    <section
      aria-label="Planungskontext"
      className="card mb-4 grid overflow-hidden md:grid-cols-2 md:divide-x md:divide-[var(--line)]"
    >
      <div className="flex min-w-0 items-center justify-between gap-4 p-4 sm:p-5">
        <div className="min-w-0">
          <p className="eyebrow">Tagesform</p>
          <p className="mt-1 truncate font-black text-[var(--ink)]">
            {readiness ? readinessLabels[readiness.status] : "Heute noch ohne Messwert"}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {checkInComplete
              ? `${readiness?.score ?? "–"} / 100 · Check-in ausgefüllt`
              : "30 Sekunden für eine passendere Tagesentscheidung"}
          </p>
        </div>
        <Link
          href={`/plan?week=${week}&checkin=open#daily-readiness`}
          className={checkInComplete ? "secondary-button shrink-0 text-xs" : "primary-button shrink-0 text-xs"}
        >
          {checkInComplete ? "Ansehen" : "Check-in"}
        </Link>
      </div>

      <div className="flex min-w-0 items-center justify-between gap-4 border-t border-[var(--line)] p-4 sm:p-5 md:border-t-0">
        <div className="min-w-0">
          <p className="eyebrow">Trainingsblock</p>
          {block ? (
            <>
              <p className="mt-1 truncate font-black text-[var(--ink)]">
                {block.name}
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {blockWeek
                  ? `Woche ${blockWeek.weekNumber}/${block.weekCount} · ${phaseLabels[blockWeek.phase]} · ${blockWeek.targetDistanceKm.toLocaleString("de-DE", { maximumFractionDigits: 0 })} km`
                  : `${block.weekCount} Wochen · aktuell außerhalb der Blockwochen`}
              </p>
            </>
          ) : (
            <>
              <p className="mt-1 font-black text-[var(--ink)]">Noch kein aktiver Block</p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Optional für mehrwöchige Progression und Entlastung.
              </p>
            </>
          )}
        </div>
        <Link
          href={
            block
              ? `/plan/block/${block.id}`
              : `/plan?week=${week}&checkin=open#daily-readiness`
          }
          className="secondary-button shrink-0 text-xs"
        >
          {block ? "Block öffnen" : "Einrichten"}
        </Link>
      </div>
    </section>
  );
}

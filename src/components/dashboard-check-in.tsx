import Link from "next/link";
import type { DailyDecision } from "@/lib/daily-cockpit";
import type { ReadinessResult } from "@/lib/recovery-readiness";
import { StatusBadge } from "@/components/ui";

const readinessLabels: Record<ReadinessResult["status"], string> = {
  green: "Bereit",
  yellow: "Mit Augenmaß",
  red: "Erholung priorisieren",
  unknown: "Noch offen",
};

export function DashboardCheckIn({ readiness, decision, workoutTitle }: { readiness: ReadinessResult; decision: DailyDecision; workoutTitle: string | null }) {
  const completed = readiness.checkin !== null;
  return (
    <section data-testid="daily-check-in" className="card relative overflow-hidden p-5 sm:p-7">
      <div className="pointer-events-none absolute -right-12 -top-14 size-44 rounded-full bg-[var(--brand-mint)]/60 blur-3xl" />
      <div className="relative">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[var(--accent)]">Daily Check-in</p>
            <h2 className="font-display mt-1 text-2xl text-[var(--ink)]">
              {completed ? readinessLabels[readiness.status] : "Wie fühlst du dich heute?"}
            </h2>
          </div>
          <StatusBadge tone={readiness.status === "green" ? "success" : readiness.status === "red" ? "danger" : readiness.status === "yellow" ? "warning" : "neutral"}>
            {completed && readiness.score !== null ? `${readiness.score} / 100` : "2 Minuten"}
          </StatusBadge>
        </div>
        <p className="mt-3 max-w-[52ch] text-sm leading-6 text-[var(--muted)]">
          {completed ? decision.summary : "Schlaf, Energie und Muskelgefühl machen die heutige Empfehlung persönlicher – kurz, ruhig und ohne Leistungsdruck."}
        </p>
        {completed && workoutTitle && <p className="mt-3 text-sm font-bold text-[var(--ink)]">Als Nächstes: {workoutTitle}</p>}
        <Link href="/plan" className={completed ? "secondary-button mt-5" : "primary-button mt-5"}>
          {completed ? "Check-in korrigieren" : "Check-in starten"}
        </Link>
      </div>
    </section>
  );
}

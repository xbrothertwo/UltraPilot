import type { WeeklyTargetRecommendation } from "@/lib/planning/weekly-target";

const levelLabels: Record<WeeklyTargetRecommendation["availabilityLevel"], string> = {
  very_busy: "sehr volle Woche",
  busy: "volle Woche",
  balanced: "ausgewogene Woche",
  open: "viel Trainingsraum",
  very_open: "sehr viel Trainingsraum",
};

const assessmentLabels: Record<WeeklyTargetRecommendation["assessment"], string> = {
  conservative: "Dein Basisziel ist diese Woche eher konservativ.",
  fitting: "Dein Basisziel passt gut zu dieser Woche.",
  ambitious: "Dein Basisziel ist für diese Woche eher ambitioniert.",
};

export function WeeklyTargetCard({ recommendation, blockWeekNumber }: { recommendation: WeeklyTargetRecommendation; blockWeekNumber?: number }) {
  return <section className="relative mb-4 overflow-hidden rounded-[1.4rem] border border-blue-200/70 bg-gradient-to-br from-[#edf4ff] via-white to-[#e8f9fd] p-5 shadow-[0_12px_32px_rgba(37,99,235,.08)] sm:p-6">
    <div aria-hidden className="absolute -right-16 -top-20 size-52 rounded-full border-[34px] border-blue-400/8" />
    <div className="relative grid gap-5 xl:grid-cols-[1.1fr_.9fr] xl:items-end">
      <div>
        <div className="flex flex-wrap items-center gap-2"><p className="eyebrow">Wochenziel-Einschätzung</p><span className="rounded-full bg-white/80 px-2.5 py-1 text-[.62rem] font-black uppercase tracking-wider text-blue-700 shadow-sm">{blockWeekNumber ? `Blockwoche ${blockWeekNumber}` : levelLabels[recommendation.availabilityLevel]}</span></div>
        <h2 className="mt-3 text-2xl font-black tracking-[-.04em] text-[var(--ink)] sm:text-3xl">Diese Woche sind {recommendation.lowerKm}–{recommendation.upperKm} km sinnvoll.</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
  {assessmentLabels[recommendation.assessment]} UltraPilot plant mit{" "}
  <strong className="text-[var(--ink)]">
    {recommendation.planningTargetKm} km
  </strong>
  .{" "}
  {recommendation.suggestedGoalKm !== null
    ? `Mehr Umfang bis ${recommendation.suggestedGoalKm} km wird erst nach deiner Bestätigung eingeplant.`
    : `Dein bestätigtes Wochenziel liegt bei ${recommendation.referenceGoalKm} km.`}
</p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-[var(--ink-soft)]">{recommendation.reasons.slice(0, 2).map((reason) => <span key={reason} className="rounded-full border border-blue-100 bg-white/75 px-3 py-1.5">{reason}</span>)}</div>
      </div>
      <dl className="grid grid-cols-3 gap-2.5">
        <TargetMetric
  label="Planwert"
  value={`${recommendation.planningTargetKm} km`}
/>
        <TargetMetric label="Lange Fahrt" value={`ca. ${recommendation.longRideTargetKm} km`} />
        <TargetMetric label="Radfenster" value={`${recommendation.availableRideDays} Tage`} />
      </dl>
    </div>
  </section>;
}

function TargetMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-blue-100 bg-white/78 p-3 shadow-sm"><dt className="text-[.6rem] font-black uppercase tracking-wider text-[var(--muted)]">{label}</dt><dd className="mt-1 text-sm font-black text-[var(--ink)] sm:text-base">{value}</dd></div>;
}

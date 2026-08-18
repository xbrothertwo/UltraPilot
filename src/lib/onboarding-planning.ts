export type OnboardingSport = "running" | "cycling" | "strength" | "volleyball";

/**
 * Separates observed volume from the distance the deterministic planner needs.
 * For a zero/unknown baseline we use a conservative distance per requested
 * session that fits the planner's existing minimum-duration policy.
 */
export function deriveInitialPlanningTargetKm(input: {
  primarySport: "running" | "cycling";
  desiredSessions: number;
  currentWeeklyDistanceKm: number | null;
  enduranceSelected: boolean;
}): number {
  if (!input.enduranceSelected) return 0;
  const current = input.currentWeeklyDistanceKm;
  if (typeof current === "number" && Number.isFinite(current) && current > 0) {
    return Math.round(current * 10) / 10;
  }
  const sessions = Math.max(1, Math.min(7, Math.round(input.desiredSessions)));
  const perSessionKm = input.primarySport === "running" ? 4 : 15;
  return sessions * perSessionKm;
}

export function firstPlanningWeekStart(
  availableWeekdays: readonly number[],
  now = new Date(),
): string {
  const date = new Date(now);
  date.setHours(12, 0, 0, 0);
  const isoWeekday = date.getDay() || 7;
  const monday = new Date(date);
  monday.setDate(date.getDate() - isoWeekday + 1);
  const hasRemainingDay = availableWeekdays.some((day) => day >= isoWeekday);
  if (!hasRemainingDay) monday.setDate(monday.getDate() + 7);
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
}

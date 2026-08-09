export type SessionCapacityDay = {
  availableMinutes: number;
  longestAvailableWindowMinutes?: number;
  workday: boolean;
};

function finiteNonNegativeMinutes(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function effectiveSessionCapacityMinutes(
  day: SessionCapacityDay,
  workdayMaxMinutes: number,
): number {
  const availableMinutes = finiteNonNegativeMinutes(day.availableMinutes);
  const longestWindowMinutes =
    day.longestAvailableWindowMinutes === undefined
      ? availableMinutes
      : finiteNonNegativeMinutes(day.longestAvailableWindowMinutes);
  const capacityMinutes = Math.min(availableMinutes, longestWindowMinutes);

  if (!day.workday) return capacityMinutes;

  return Math.min(
    capacityMinutes,
    finiteNonNegativeMinutes(workdayMaxMinutes),
  );
}

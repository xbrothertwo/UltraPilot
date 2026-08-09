export type ActivitySportType = "cycling" | "running" | "strength" | "volleyball" | "other";
export type PrimarySport = "cycling" | "running";

export function parsePrimarySport(value: unknown): PrimarySport | null {
  return value === "cycling" || value === "running" ? value : null;
}

export const activitySportLabels: Record<ActivitySportType, string> = {
  cycling: "Radfahren",
  running: "Laufen",
  strength: "Krafttraining",
  volleyball: "Volleyball",
  other: "Sonstiges",
};

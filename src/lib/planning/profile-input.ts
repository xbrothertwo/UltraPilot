import { parsePrimarySport, type PrimarySport } from "../sports";

export function validatePrimarySportAndWeeklyGoal(input: {
  currentPrimarySport: unknown;
  submittedPrimarySport: unknown;
  submittedWeeklyGoal: unknown;
}): { primarySport: PrimarySport; weeklyGoalKm: number } {
  const currentPrimarySport = parsePrimarySport(input.currentPrimarySport);
  const primarySport = parsePrimarySport(input.submittedPrimarySport);
  if (!primarySport) throw new Error("Die Hauptsportart ist ungültig.");

  const rawGoal = input.submittedWeeklyGoal;
  if (typeof rawGoal !== "string" || rawGoal.trim() === "") {
    if (currentPrimarySport && currentPrimarySport !== primarySport) {
      throw new Error("Beim Wechsel der Hauptsportart muss ein neues Wochenziel bewusst angegeben werden.");
    }
    throw new Error("Das Wochenziel fehlt.");
  }
  const weeklyGoalKm = Number(rawGoal);
  if (!Number.isFinite(weeklyGoalKm) || weeklyGoalKm < 0 || weeklyGoalKm > 2000) {
    throw new Error("Das Wochenziel ist ungültig.");
  }
  return { primarySport, weeklyGoalKm };
}

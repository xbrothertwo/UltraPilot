export type BlockPhase = "foundation" | "build" | "peak" | "recovery";
export type GeneratedBlockWeek = { weekNumber: number; weekStart: string; phase: BlockPhase; targetDistanceKm: number; longRideTargetKm: number; tempoSessionTarget: number; purpose: string };
export type BlockGeneratorInput = { startDate: string; weeklyDistanceKm: number; startingLongRideKm: number; recoveryWeekPercentage: number };

function rounded(value: number): number { return Math.round(value * 10) / 10; }

export function generateFourWeekBlock(input: BlockGeneratorInput): GeneratedBlockWeek[] {
  const weeklyDistance = Math.max(20, input.weeklyDistanceKm);
  const recoveryPercentage = Math.max(60, Math.min(100, input.recoveryWeekPercentage));
  const startLongRide = Math.max(10, Math.min(input.startingLongRideKm, weeklyDistance * 0.6));
  const phases: BlockPhase[] = ["foundation", "build", "peak", "recovery"];
  const purposes = [
    "Rhythmus finden und alle Einheiten kontrolliert abschließen.",
    "Lange Ausfahrt behutsam verlängern; eine kontrollierte Tempoeinheit ist möglich.",
    "Höchster spezifischer Reiz des Blocks mit der längsten ruhigen Ausfahrt.",
    "Belastung verarbeiten: keine Tempoeinheit und alle Radkilometer bewusst locker.",
  ];
  const longRideFactors = [1, 1.1, 1.2, 0.75];
  return phases.map((phase, index) => {
    const weekStart = new Date(`${input.startDate}T12:00:00Z`); weekStart.setUTCDate(weekStart.getUTCDate() + index * 7);
    const targetDistanceKm = index === 3 ? rounded(weeklyDistance * recoveryPercentage / 100) : rounded(weeklyDistance);
    return { weekNumber: index + 1, weekStart: weekStart.toISOString().slice(0, 10), phase, targetDistanceKm, longRideTargetKm: rounded(Math.min(targetDistanceKm * 0.6, startLongRide * longRideFactors[index])), tempoSessionTarget: index === 1 || index === 2 ? 1 : 0, purpose: purposes[index] };
  });
}

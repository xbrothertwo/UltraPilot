export type BlockPhase = "foundation" | "build" | "load" | "peak" | "recovery";
export type BlockSport = "cycling" | "running";
export type GeneratedBlockWeek = { weekNumber: number; weekStart: string; phase: BlockPhase; targetDistanceKm: number; longRideTargetKm: number; tempoSessionTarget: number; purpose: string };
export type BlockGeneratorInput = { startDate: string; sportType: BlockSport; weekCount: number; weeklyDistanceKm: number; startingLongRideKm: number; recoveryWeekPercentage: number };

const LONG_SESSION_FACTORS: Record<BlockPhase, number> = { foundation: 1, build: 1.1, load: 1.15, peak: 1.2, recovery: 0.75 };
const TEMPO_TARGET: Record<BlockPhase, number> = { foundation: 0, build: 1, load: 1, peak: 1, recovery: 0 };

const PURPOSES: Record<BlockSport, Record<BlockPhase, string>> = {
  cycling: {
    foundation: "Rhythmus finden und alle Einheiten kontrolliert abschließen.",
    build: "Lange Ausfahrt behutsam verlängern; eine kontrollierte Tempoeinheit ist möglich.",
    load: "Umfang und lange Ausfahrt weiter steigern; Belastung bewusst kumulieren.",
    peak: "Höchster spezifischer Reiz des Blocks mit der längsten ruhigen Ausfahrt.",
    recovery: "Belastung verarbeiten: keine Tempoeinheit und alle Radkilometer bewusst locker.",
  },
  running: {
    foundation: "Rhythmus finden und alle Einheiten kontrolliert abschließen.",
    build: "Langen Lauf behutsam verlängern; eine kontrollierte Tempoeinheit ist möglich.",
    load: "Umfang und langen Lauf weiter steigern; Belastung bewusst kumulieren.",
    peak: "Höchster spezifischer Reiz des Blocks mit dem längsten ruhigen Lauf.",
    recovery: "Belastung verarbeiten: keine Tempoeinheit und alle Laufkilometer bewusst locker.",
  },
};

function rounded(value: number): number { return Math.round(value * 10) / 10; }

// Foundation opens, peak sits right before recovery, build/load fill whatever is left in between.
function phaseSequence(weekCount: number): BlockPhase[] {
  const workWeeks = weekCount - 1;
  if (workWeeks <= 0) return ["recovery"];
  if (workWeeks === 1) return ["peak", "recovery"];
  if (workWeeks === 2) return ["foundation", "peak", "recovery"];
  const middleWeeks = workWeeks - 2;
  const buildCount = Math.ceil(middleWeeks / 2);
  const loadCount = middleWeeks - buildCount;
  return ["foundation", ...Array(buildCount).fill("build" as const), ...Array(loadCount).fill("load" as const), "peak", "recovery"];
}

export function generateTrainingBlockWeeks(input: BlockGeneratorInput): GeneratedBlockWeek[] {
  const weekCount = Math.max(2, Math.min(16, Math.round(input.weekCount)));
  const weeklyDistance = Math.max(20, input.weeklyDistanceKm);
  const recoveryPercentage = Math.max(60, Math.min(100, input.recoveryWeekPercentage));
  const startLongSession = Math.max(10, Math.min(input.startingLongRideKm, weeklyDistance * 0.6));
  const phases = phaseSequence(weekCount);
  return phases.map((phase, index) => {
    const weekStart = new Date(`${input.startDate}T12:00:00Z`); weekStart.setUTCDate(weekStart.getUTCDate() + index * 7);
    const targetDistanceKm = phase === "recovery" ? rounded(weeklyDistance * recoveryPercentage / 100) : rounded(weeklyDistance);
    return {
      weekNumber: index + 1,
      weekStart: weekStart.toISOString().slice(0, 10),
      phase,
      targetDistanceKm,
      longRideTargetKm: rounded(Math.min(targetDistanceKm * 0.6, startLongSession * LONG_SESSION_FACTORS[phase])),
      tempoSessionTarget: TEMPO_TARGET[phase],
      purpose: PURPOSES[input.sportType][phase],
    };
  });
}

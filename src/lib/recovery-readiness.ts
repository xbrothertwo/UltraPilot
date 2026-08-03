export type DailyRecoveryMetric = {
  date: string; sleepStart: string | null; sleepEnd: string | null; asleepMinutes: number; coreMinutes: number; deepMinutes: number; remMinutes: number; awakeMinutes: number;
  sleepingAverageHeartRate: number | null; sleepingMinimumHeartRate: number | null; heartRateSampleCount: number; hrvSdnnMs: number | null; hrvSampleCount: number; restingHeartRate: number | null;
};
export type DailyReadinessCheckin = { date: string; sleepQuality: number | null; generalFatigue: number | null; legFatigue: number | null; motivation: number | null; painOrIllness: boolean; notes: string };
export type ReadinessStatus = "green" | "yellow" | "red" | "unknown";
export type ReadinessResult = { date: string; status: ReadinessStatus; score: number | null; reasons: string[]; metric: DailyRecoveryMetric | null; checkin: DailyReadinessCheckin | null };

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function calculateReadiness(date: string, metric: DailyRecoveryMetric | null, checkin: DailyReadinessCheckin | null, history: DailyRecoveryMetric[]): ReadinessResult {
  if (!metric && !checkin) return { date, status: "unknown", score: null, reasons: ["Noch keine Schlafdaten oder Tagesform eingetragen."], metric, checkin };
  let score = 80;
  const reasons: string[] = [];
  if (metric) {
    if (metric.asleepMinutes >= 450) { score += 8; reasons.push("Mindestens 7,5 Stunden Schlaf."); }
    else if (metric.asleepMinutes < 330) { score -= 25; reasons.push("Weniger als 5,5 Stunden Schlaf."); }
    else if (metric.asleepMinutes < 390) { score -= 12; reasons.push("Weniger als 6,5 Stunden Schlaf."); }
    const heartRateHistory = history.map((item) => item.sleepingAverageHeartRate).filter((value): value is number => value !== null);
    const heartRateBaseline = median(heartRateHistory);
    if (heartRateBaseline && metric.sleepingAverageHeartRate && heartRateHistory.length >= 7) {
      const ratio = metric.sleepingAverageHeartRate / heartRateBaseline;
      if (ratio > 1.1) { score -= 18; reasons.push("Nächtliche Durchschnitts-HF liegt mehr als 10 % über deinem Verlauf."); }
      else if (ratio > 1.05) { score -= 9; reasons.push("Nächtliche Durchschnitts-HF liegt mehr als 5 % über deinem Verlauf."); }
    }
    const hrvHistory = history.map((item) => item.hrvSdnnMs).filter((value): value is number => value !== null);
    const hrvBaseline = median(hrvHistory);
    if (hrvBaseline && metric.hrvSdnnMs && hrvHistory.length >= 7) {
      const ratio = metric.hrvSdnnMs / hrvBaseline;
      if (ratio < 0.65) { score -= 18; reasons.push("HRV liegt deutlich unter deinem persönlichen Verlauf."); }
      else if (ratio < 0.8) { score -= 10; reasons.push("HRV liegt unter deinem persönlichen Verlauf."); }
    }
  }
  if (checkin) {
    if (checkin.sleepQuality !== null) score += (checkin.sleepQuality - 5) * 2;
    if (checkin.generalFatigue !== null && checkin.generalFatigue >= 7) { score -= (checkin.generalFatigue - 6) * 6; reasons.push("Du meldest erhöhte allgemeine Müdigkeit."); }
    if (checkin.legFatigue !== null && checkin.legFatigue >= 7) { score -= (checkin.legFatigue - 6) * 5; reasons.push("Du meldest schwere Beine."); }
    if (checkin.motivation !== null && checkin.motivation <= 3) { score -= 8; reasons.push("Motivation ist heute niedrig."); }
    if (checkin.painOrIllness) reasons.push("Beschwerden oder Krankheitssymptome wurden markiert.");
  }
  score = Math.max(0, Math.min(100, Math.round(score)));
  const status: ReadinessStatus = checkin?.painOrIllness || score < 50 ? "red" : score < 72 ? "yellow" : "green";
  if (!reasons.length) reasons.push("Messwerte und Tagesform liegen in deinem üblichen Bereich.");
  return { date, status, score, reasons, metric, checkin };
}

export function buildReadinessRange(days: string[], metrics: DailyRecoveryMetric[], checkins: DailyReadinessCheckin[]): ReadinessResult[] {
  return days.map((date) => calculateReadiness(date, metrics.find((metric) => metric.date === date) ?? null, checkins.find((checkin) => checkin.date === date) ?? null, metrics.filter((metric) => metric.date < date).slice(-28)));
}

import { calculateDailyAvailability } from "./availability";

export type WeeklyTargetDay = {
  date: string;
  availableMinutes: number;
  workday: boolean;
  readiness?: "green" | "yellow" | "red" | "unknown";
};

export type WeeklyTargetEvent = {
  startsAt: string;
  endsAt: string;
  eventKind: string;
  allDay: boolean;
};

export type WeeklyTargetAssessment = "conservative" | "fitting" | "ambitious";
export type WeeklyAvailabilityLevel = "very_busy" | "busy" | "balanced" | "open" | "very_open";

export type WeeklyTargetRecommendation = {
  referenceGoalKm: number;
  targetKm: number;
  lowerKm: number;
  upperKm: number;
  longRideTargetKm: number;
  estimatedCapacityKm: number;
  usableCyclingMinutes: number;
  availableRideDays: number;
  longWindowDays: number;
  availabilityLevel: WeeklyAvailabilityLevel;
  assessment: WeeklyTargetAssessment;
  reasons: string[];
};

export type WeeklyTargetInput = {
  primarySport: "cycling" | "running";
  runningSessionsPerWeek?: number;
  referenceGoalKm: number;
  days: WeeklyTargetDay[];
  recentFourWeekDistanceKm: number;
  recentAverageSpeedKmh: number | null;
  workdayMaxMinutes: number;
  blockTargetKm?: number;
  blockLongRideTargetKm?: number;
  blockPhase?: "foundation" | "build" | "peak" | "recovery";
};

function roundFive(value: number): number {
  return Math.max(0, Math.round(value / 5) * 5);
}

function roundDownFive(value: number): number {
  return Math.max(0, Math.floor(value / 5) * 5);
}

function availabilityLevel(minutes: number): WeeklyAvailabilityLevel {
  if (minutes < 180) return "very_busy";
  if (minutes < 300) return "busy";
  if (minutes < 480) return "balanced";
  if (minutes < 660) return "open";
  return "very_open";
}

const availabilityFactors: Record<WeeklyAvailabilityLevel, number> = {
  very_busy: .65,
  busy: .8,
  balanced: 1,
  open: 1.12,
  very_open: 1.2,
};

export function buildWeeklyTargetDays(
  dates: string[],
  events: WeeklyTargetEvent[],
  readinessByDate: ReadonlyMap<string, WeeklyTargetDay["readiness"]> = new Map(),
): WeeklyTargetDay[] {
  return dates.map((date) => {
    const dayEvents = events.filter((event) => event.eventKind !== "free" && new Date(event.startsAt) < new Date(`${date}T23:59:59`) && new Date(event.endsAt) > new Date(`${date}T00:00:00`));
    const windows = calculateDailyAvailability(date, dayEvents);
    return {
      date,
      availableMinutes: windows.reduce((sum, window) => sum + window.durationMinutes, 0),
      workday: dayEvents.some((event) => event.eventKind.startsWith("work_")),
      readiness: readinessByDate.get(date),
    };
  });
}

export function recommendWeeklyTarget(input: WeeklyTargetInput): WeeklyTargetRecommendation {
  const isRunning = input.primarySport === "running";
  const referenceGoalKm = Math.max(0, input.referenceGoalKm);
  const anchorKm = Math.max(0, input.blockTargetKm ?? referenceGoalKm);
  const speedThreshold = isRunning ? 3 : 10;
  const speedCap = isRunning ? 25 : 40;
  const speedFallback = isRunning ? 8 : 22;
  const speedKmh = input.recentAverageSpeedKmh && input.recentAverageSpeedKmh >= speedThreshold
    ? Math.min(speedCap, input.recentAverageSpeedKmh)
    : speedFallback;
  const minimumMinutes = isRunning ? 30 : 45;
  const sessionCap = isRunning
    ? Math.max(1, Math.min(7, input.runningSessionsPerWeek ?? 3))
    : 3;
  const usableDays = input.days
    .filter((day) => day.readiness !== "red" && day.availableMinutes >= minimumMinutes)
    .map((day) => {
      const cap = day.workday ? input.workdayMaxMinutes : 300;
      const readinessFactor = day.readiness === "yellow" ? .75 : 1;
      return { ...day, usableMinutes: Math.floor(Math.min(day.availableMinutes, cap) * readinessFactor) };
    })
    .filter((day) => day.usableMinutes >= minimumMinutes)
    .sort((a, b) => b.usableMinutes - a.usableMinutes || a.date.localeCompare(b.date));
  const cyclingDays = usableDays.slice(0, sessionCap);
  const usableCyclingMinutes = cyclingDays.reduce((sum, day) => sum + day.usableMinutes, 0);
  const level = availabilityLevel(usableCyclingMinutes);
  const estimatedCapacityKm = roundFive(usableCyclingMinutes / 60 * speedKmh);

  let rawTarget = anchorKm * availabilityFactors[level];
  if (input.blockPhase === "recovery") rawTarget = Math.min(rawTarget, anchorKm);
  const recentWeeklyKm = input.recentFourWeekDistanceKm > 0 ? input.recentFourWeekDistanceKm / 4 : null;
  const progressionCeiling = Math.min(
    anchorKm * 1.25,
    Math.max(anchorKm * 1.15, recentWeeklyKm === null ? 0 : recentWeeklyKm * 1.12),
  );
  if (rawTarget > anchorKm) rawTarget = Math.min(rawTarget, progressionCeiling);
  if (estimatedCapacityKm > 0) rawTarget = Math.min(rawTarget, estimatedCapacityKm);
  const targetKm = roundFive(rawTarget);
  const lowerKm = roundFive(targetKm * .9);
  const upperKm = roundFive(targetKm * 1.1);
  const assessment: WeeklyTargetAssessment = anchorKm < lowerKm ? "conservative" : anchorKm > upperKm ? "ambitious" : "fitting";

  const bestDayMinutes = cyclingDays[0]?.usableMinutes ?? 0;
  const longDayCapacityKm = bestDayMinutes / 60 * speedKmh * .85;
  let desiredLongRideKm = input.blockLongRideTargetKm ?? targetKm * .45;
  if (level === "open" || level === "very_open") desiredLongRideKm *= 1.1;
  if (input.blockPhase === "recovery") desiredLongRideKm = Math.min(desiredLongRideKm, targetKm * .4);
  const longRideTargetKm = targetKm > 0 ? roundDownFive(Math.min(desiredLongRideKm, targetKm * .5, longDayCapacityKm)) : 0;
  const longWindowDays = usableDays.filter((day) => !day.workday && day.usableMinutes >= 180).length;

  const reasons = [
    isRunning
      ? `${cyclingDays.length} nutzbare Lauffenster ergeben rund ${usableCyclingMinutes} realistische Trainingsminuten.`
      : `${cyclingDays.length} nutzbare Radfenster ergeben rund ${usableCyclingMinutes} realistische Trainingsminuten.`,
    longWindowDays > 0
      ? `${longWindowDays} ${longWindowDays === 1 ? "freier Tag eignet" : "freie Tage eignen"} sich für ${isRunning ? "einen langen Lauf" : "eine längere Ausfahrt"}.`
      : "Kein freier Tag bietet aktuell ein langes, unbelastetes Zeitfenster.",
    recentWeeklyKm === null
      ? "Bis genügend Verlauf vorliegt, begrenzt dein Referenzziel größere Sprünge."
      : `Dein Vierwochenschnitt von ${recentWeeklyKm.toLocaleString("de-DE", { maximumFractionDigits: 0 })} km begrenzt zu schnelle Steigerungen.`,
  ];
  if (input.blockPhase === "recovery") reasons.push("Die Erholungswoche wird trotz freier Zeit nicht nach oben erweitert.");

  return {
    referenceGoalKm,
    targetKm,
    lowerKm,
    upperKm,
    longRideTargetKm,
    estimatedCapacityKm,
    usableCyclingMinutes,
    availableRideDays: cyclingDays.length,
    longWindowDays,
    availabilityLevel: level,
    assessment,
    reasons,
  };
}

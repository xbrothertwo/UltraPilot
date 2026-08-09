import { eventOverlapsLocalDay } from "../calendar/ics-parser";
import { calculateDailyAvailability } from "./availability";
import { effectiveSessionCapacityMinutes } from "./session-capacity";
import type { PrimarySport } from "../sports";

export type WeeklyTargetDay = {
  date: string;
  availableMinutes: number;
  longestAvailableWindowMinutes?: number;
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
  planningTargetKm: number;
  suggestedGoalKm: number | null;
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
  primarySport: PrimarySport;
  runningSessionsPerWeek?: number;
  referenceGoalKm: number;
  days: WeeklyTargetDay[];
  recentFourWeekDistanceKm: number;
  recentAverageSpeedKmh: number | null;
  workdayMaxMinutes: number;
  blockTargetKm?: number;
  blockLongRideTargetKm?: number;
  blockPhase?: "foundation" | "build" | "load" | "peak" | "recovery";
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
export function validateWeeklyGoalIncrease(
  currentGoalKm: number,
  requestedGoalKm: number,
): number {
  if (
    !Number.isInteger(requestedGoalKm) ||
    requestedGoalKm <= 0 ||
    requestedGoalKm > 2000 ||
    requestedGoalKm % 5 !== 0
  ) {
    throw new Error("Wochenziel ist ungültig.");
  }

  if (
    !Number.isFinite(currentGoalKm) ||
    currentGoalKm < 0 ||
    currentGoalKm > 2000
  ) {
    throw new Error("Aktuelles Wochenziel ist ungültig.");
  }

  if (requestedGoalKm <= currentGoalKm) {
    throw new Error("Das neue Wochenziel muss höher sein.");
  }

  const maximumIncreaseKm =
    currentGoalKm > 0 ? roundFive(currentGoalKm * 1.25) : 50;

  if (requestedGoalKm > maximumIncreaseKm) {
    throw new Error("Die vorgeschlagene Erhöhung ist zu groß.");
  }

  return requestedGoalKm;
}
export function buildWeeklyTargetDays(
  dates: string[],
  events: WeeklyTargetEvent[],
  readinessByDate: ReadonlyMap<string, WeeklyTargetDay["readiness"]> = new Map(),
  beforeLateShiftAllowed = true,
  afterNightShiftAllowed = true,
): WeeklyTargetDay[] {
  return dates.map((date) => {
    const dayEvents = events.filter((event) => event.eventKind !== "free" && eventOverlapsLocalDay(event, date));
    const windows = calculateDailyAvailability(date, dayEvents, 30, 6, 22, beforeLateShiftAllowed, afterNightShiftAllowed);
    return {
      date,
      availableMinutes: windows.reduce((sum, window) => sum + window.durationMinutes, 0),
      longestAvailableWindowMinutes: windows.reduce((longest, window) => Math.max(longest, window.durationMinutes), 0),
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
    .filter(
      (day) =>
        day.readiness !== "red" &&
        effectiveSessionCapacityMinutes(day, input.workdayMaxMinutes) >= minimumMinutes,
    )
    .map((day) => {
      const readinessFactor = day.readiness === "yellow" ? .75 : 1;
      return {
        ...day,
        usableMinutes: Math.floor(
          effectiveSessionCapacityMinutes(day, input.workdayMaxMinutes) *
            readinessFactor,
        ),
      };
    })
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
  if (estimatedCapacityKm > 0)
    rawTarget = Math.min(rawTarget, estimatedCapacityKm);
  if (referenceGoalKm > 0)
    rawTarget = Math.min(rawTarget, referenceGoalKm * 1.25);

  const targetKm = roundFive(rawTarget);
  const planningTargetKm = Math.min(targetKm, referenceGoalKm);
  const suggestedGoalKm =
    targetKm > referenceGoalKm ? targetKm : null;
  const lowerKm = roundFive(targetKm * .9);
  const upperKm = roundFive(targetKm * 1.1);
  const assessment: WeeklyTargetAssessment = anchorKm < lowerKm ? "conservative" : anchorKm > upperKm ? "ambitious" : "fitting";

  const bestDayMinutes = cyclingDays[0]?.usableMinutes ?? 0;
  const longDayCapacityKm = bestDayMinutes / 60 * speedKmh * .85;
    let desiredLongRideKm =
    input.blockLongRideTargetKm ?? planningTargetKm * .45;
  if (level === "open" || level === "very_open")
    desiredLongRideKm *= 1.1;
  if (input.blockPhase === "recovery")
    desiredLongRideKm = Math.min(
      desiredLongRideKm,
      planningTargetKm * .4,
    );
  const longRideTargetKm =
    planningTargetKm > 0
      ? roundDownFive(
          Math.min(
            desiredLongRideKm,
            planningTargetKm * .5,
            longDayCapacityKm,
          ),
        )
      : 0;
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
    planningTargetKm,
    suggestedGoalKm,
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

import type { Activity } from "./demo-data";
import type { SensorSample } from "./activity-files/types";
import type { TrainingProfile, ZoneTime } from "./training-zones";
import { calculateTimeInZones, calculateTrainingLoad, getHeartRateZones, getPowerZones } from "./training-zones";

export type DashboardNutrition = { activityId: string; carbohydratesGrams: number; fluidMilliliters: number; sodiumMilligrams: number };
export type DashboardFeedback = { activityId: string; perceivedExertion: number | null; fatigue: number | null; mood: number | null };
export type DashboardStream = { activityId: string; type: "heart_rate" | "power"; samples: SensorSample[] };
export type DashboardTrend = { date: string; distanceKilometers: number; movingHours: number; elevationMeters: number; tss: number; carbohydratesPerHour: number | null };
export type PrimarySport = "cycling" | "running";

export type DashboardSummary = {
  primarySport: PrimarySport;
  activityCount: number;
  distanceMeters: number;
  movingTimeSeconds: number;
  elevationGainMeters: number;
  averageSpeedKmh: number | null;
  averageHeartRate: number | null;
  averagePower: number | null;
  totalTss: number | null;
  carbohydratesPerHour: number | null;
  fluidPerHour: number | null;
  sodiumPerHour: number | null;
  averageRpe: number | null;
  averageEnergy: number | null;
  averageFatigue: number | null;
  heartRateZones: ZoneTime[] | null;
  powerZones: ZoneTime[] | null;
  trend: DashboardTrend[];
};

function weightedAverage(activities: Activity[], selector: (activity: Activity) => number | null): number | null {
  const measured = activities.filter((activity) => selector(activity) !== null && activity.movingTimeSeconds > 0);
  const seconds = measured.reduce((sum, activity) => sum + activity.movingTimeSeconds, 0);
  return seconds > 0 ? measured.reduce((sum, activity) => sum + selector(activity)! * activity.movingTimeSeconds, 0) / seconds : null;
}

function average(values: Array<number | null>): number | null {
  const measured = values.filter((value): value is number => value !== null);
  return measured.length ? measured.reduce((sum, value) => sum + value, 0) / measured.length : null;
}

function combineZones(groups: ZoneTime[][]): ZoneTime[] | null {
  if (!groups.length) return null;
  const seconds = groups[0].map((_, index) => groups.reduce((sum, group) => sum + group[index].seconds, 0));
  const total = seconds.reduce((sum, value) => sum + value, 0);
  return groups[0].map((zone, index) => ({ ...zone, seconds: seconds[index], percentage: total > 0 ? seconds[index] / total * 100 : 0 }));
}

export function buildDashboardSummary(activities: Activity[], nutrition: DashboardNutrition[], feedback: DashboardFeedback[], streams: DashboardStream[], profile: TrainingProfile, primarySport: PrimarySport): DashboardSummary {
  const primaryActivities = activities.filter((activity) => activity.sportType === primarySport);
  const distanceMeters = primaryActivities.reduce((sum, activity) => sum + activity.distanceMeters, 0);
  const movingTimeSeconds = primaryActivities.reduce((sum, activity) => sum + activity.movingTimeSeconds, 0);
  const elevationGainMeters = primaryActivities.reduce((sum, activity) => sum + activity.elevationGainMeters, 0);
  const loads = primaryActivities.map((activity) => calculateTrainingLoad(activity.normalizedPower, activity.movingTimeSeconds, profile.ftpWatts)).filter((load): load is NonNullable<typeof load> => load !== null);
  const nutritionTotals = nutrition.reduce((sum, entry) => ({ carbohydrates: sum.carbohydrates + entry.carbohydratesGrams, fluid: sum.fluid + entry.fluidMilliliters, sodium: sum.sodium + entry.sodiumMilligrams }), { carbohydrates: 0, fluid: 0, sodium: 0 });
  const nutritionActivityIds = new Set(nutrition.map((entry) => entry.activityId));
  const nutritionSeconds = activities.filter((activity) => nutritionActivityIds.has(activity.id)).reduce((sum, activity) => sum + activity.movingTimeSeconds, 0);
  const nutritionHours = nutritionSeconds / 3600;
  const heartRateDefinitions = getHeartRateZones(profile);
  const powerDefinitions = getPowerZones(profile);
  const heartRateZoneGroups = heartRateDefinitions ? streams.filter((stream) => stream.type === "heart_rate").map((stream) => calculateTimeInZones(stream.samples, heartRateDefinitions)) : [];
  const powerZoneGroups = powerDefinitions ? streams.filter((stream) => stream.type === "power").map((stream) => calculateTimeInZones(stream.samples, powerDefinitions)) : [];
  const byDate = new Map<string, DashboardTrend>();
  for (const activity of primaryActivities) {
    const date = activity.activityDate.slice(0, 10);
    const current = byDate.get(date) ?? { date, distanceKilometers: 0, movingHours: 0, elevationMeters: 0, tss: 0, carbohydratesPerHour: null };
    const load = calculateTrainingLoad(activity.normalizedPower, activity.movingTimeSeconds, profile.ftpWatts);
    current.distanceKilometers += activity.distanceMeters / 1000;
    current.movingHours += activity.movingTimeSeconds / 3600;
    current.elevationMeters += activity.elevationGainMeters;
    current.tss += load?.tss ?? 0;
    byDate.set(date, current);
  }
  for (const current of byDate.values()) {
    const activitiesOnDate = primaryActivities.filter((activity) => activity.activityDate.slice(0, 10) === current.date);
    const idsWithNutrition = new Set(nutrition.filter((entry) => activitiesOnDate.some((activity) => activity.id === entry.activityId)).map((entry) => entry.activityId));
    const recordedSeconds = activitiesOnDate.filter((activity) => idsWithNutrition.has(activity.id)).reduce((sum, activity) => sum + activity.movingTimeSeconds, 0);
    const carbohydrates = nutrition.filter((entry) => idsWithNutrition.has(entry.activityId)).reduce((sum, entry) => sum + entry.carbohydratesGrams, 0);
    current.carbohydratesPerHour = recordedSeconds > 0 ? carbohydrates / (recordedSeconds / 3600) : null;
  }
  return {
    primarySport,
    activityCount: primaryActivities.length,
    distanceMeters,
    movingTimeSeconds,
    elevationGainMeters,
    averageSpeedKmh: weightedAverage(primaryActivities, (activity) => activity.averageSpeedKmh),
    averageHeartRate: weightedAverage(primaryActivities, (activity) => activity.averageHeartRate),
    averagePower: weightedAverage(primaryActivities, (activity) => activity.averagePower),
    totalTss: loads.length ? loads.reduce((sum, load) => sum + load.tss, 0) : null,
    carbohydratesPerHour: nutritionHours > 0 ? nutritionTotals.carbohydrates / nutritionHours : null,
    fluidPerHour: nutritionHours > 0 ? nutritionTotals.fluid / nutritionHours : null,
    sodiumPerHour: nutritionHours > 0 ? nutritionTotals.sodium / nutritionHours : null,
    averageRpe: average(feedback.map((entry) => entry.perceivedExertion)),
    averageEnergy: average(feedback.map((entry) => entry.mood)),
    averageFatigue: average(feedback.map((entry) => entry.fatigue)),
    heartRateZones: combineZones(heartRateZoneGroups),
    powerZones: combineZones(powerZoneGroups),
    trend: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
  };
}

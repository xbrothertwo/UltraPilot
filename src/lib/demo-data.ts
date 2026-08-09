import type { ActivitySportType } from "@/lib/sports";

export type Activity = {
  id: string;
  userId: string;
  sportType: ActivitySportType;
  activityDate: string;
  title: string;
  distanceMeters: number;
  movingTimeSeconds: number;
  elapsedTimeSeconds: number;
  elevationGainMeters: number;
  averageSpeedKmh: number | null;
  averageHeartRate: number | null;
  maximumHeartRate: number | null;
  averagePower: number | null;
  normalizedPower: number | null;
  source: string;
  createdAt: string;
};

import { isSupabaseConfigured } from "@/lib/supabase/config";

export const isDemoMode = !isSupabaseConfigured();

export const demoActivity: Activity = {
  id: "demo-alpenrunde",
  userId: "demo-user",
  sportType: "cycling",
  activityDate: "2026-07-27T05:42:00.000Z",
  title: "Lange Alpenrunde",
  distanceMeters: 184_600,
  movingTimeSeconds: 26_880,
  elapsedTimeSeconds: 29_340,
  elevationGainMeters: 2_740,
  averageSpeedKmh: 24.7,
  averageHeartRate: 137,
  maximumHeartRate: 174,
  averagePower: 186,
  normalizedPower: 211,
  source: "demo",
  createdAt: "2026-07-27T14:00:00.000Z",
};

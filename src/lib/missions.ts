import { createClient } from "@/lib/supabase/server";
import { parsePrimarySport, type PrimarySport } from "@/lib/sports";

export type MissionSource =
  | "derived"
  | "custom";

export type MissionStatus =
  | "draft"
  | "planned"
  | "completed"
  | "archived";

export type SavedMission = {
  id: string;
  source: MissionSource;
  derivedKey: string | null;
  title: string;
  description: string | null;
  sportType: PrimarySport;
  status: MissionStatus;
  targetDate: string | null;
  startAt: string | null;
  distanceKm: number;
  elevationMeters: number;
  averageSpeedKmh: number | null;
  paceSecondsPerKm: number | null;
  stopIntervalKm: number;
  stopDurationMinutes: number;
  carbohydratesPerHour: number;
  fluidMillilitersPerHour: number;
  sodiumMilligramsPerHour: number;
  createdAt: string;
  updatedAt: string;
};

type MissionRow = {
  id: string;
  source: MissionSource;
  derived_key: string | null;
  title: string;
  description: string | null;
  sport_type: unknown;
  status: MissionStatus;
  target_date: string | null;
  start_at: string | null;
  distance_km: number | string;
  elevation_meters: number;
  average_speed_kmh: number | string | null;
  pace_seconds_per_km: number | null;
  stop_interval_km: number | string;
  stop_duration_minutes: number;
  carbohydrates_per_hour: number;
  fluid_milliliters_per_hour: number;
  sodium_milligrams_per_hour: number;
  created_at: string;
  updated_at: string;
};

function optionalNumber(
  value: unknown,
): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function mapMission(
  row: MissionRow,
): SavedMission | null {
  const sportType = parsePrimarySport(row.sport_type);
  if (!sportType) return null;
  return {
    id: row.id,
    source: row.source,
    derivedKey: row.derived_key,
    title: row.title,
    description: row.description,
    sportType,
    status: row.status,
    targetDate: row.target_date,
    startAt: row.start_at,
    distanceKm:
      optionalNumber(row.distance_km) ?? 0,
    elevationMeters:
      row.elevation_meters,
    averageSpeedKmh: optionalNumber(
      row.average_speed_kmh,
    ),
    paceSecondsPerKm:
      row.pace_seconds_per_km,
    stopIntervalKm:
      optionalNumber(
        row.stop_interval_km,
      ) ?? 0,
    stopDurationMinutes:
      row.stop_duration_minutes,
    carbohydratesPerHour:
      row.carbohydrates_per_hour,
    fluidMillilitersPerHour:
      row.fluid_milliliters_per_hour,
    sodiumMilligramsPerHour:
      row.sodium_milligrams_per_hour,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const missionColumns =
  "id,source,derived_key,title,description,sport_type,status,target_date,start_at,distance_km,elevation_meters,average_speed_kmh,pace_seconds_per_km,stop_interval_km,stop_duration_minutes,carbohydrates_per_hour,fluid_milliliters_per_hour,sodium_milligrams_per_hour,created_at,updated_at";

export async function getMissions(): Promise<
  SavedMission[]
> {
  const supabase = await createClient();

  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("missions")
    .select(missionColumns)
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    throw new Error(
      `Missionen konnten nicht geladen werden: ${error.message}`,
    );
  }

  return ((data ?? []) as MissionRow[]).flatMap((row) => {
    const mission = mapMission(row);
    return mission ? [mission] : [];
  });
}

export async function getMission(
  missionId: string,
): Promise<SavedMission | null> {
  const supabase = await createClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("missions")
    .select(missionColumns)
    .eq("id", missionId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Mission konnte nicht geladen werden: ${error.message}`,
    );
  }

  return data ? mapMission(data as MissionRow) : null;
}

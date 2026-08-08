import type {
  MissionSportType,
} from "@/lib/ultra-mission-builder";

export type MissionTemplateInput = {
  sportType: MissionSportType;
  targetDistanceKm: number;
  targetElevationMeters: number | null;
};

export type MissionTemplate = {
  key: string;
  title: string;
  description: string;
  sportType: MissionSportType;
  distanceKm: number;
  elevationMeters: number;
  averageSpeedKmh: number | null;
  paceSecondsPerKm: number | null;
  stopIntervalKm: number;
  stopDurationMinutes: number;
  carbohydratesPerHour: number;
  fluidMillilitersPerHour: number;
  sodiumMilligramsPerHour: number;
};

function roundedDistance(
  value: number,
  sportType: MissionSportType,
): number {
  const step =
    sportType === "cycling" ? 10 : 1;

  return Math.max(
    step,
    Math.round(value / step) * step,
  );
}

function proportionalElevation(
  targetDistanceKm: number,
  targetElevationMeters: number | null,
  missionDistanceKm: number,
): number {
  if (
    targetElevationMeters === null ||
    targetDistanceKm <= 0
  ) {
    return 0;
  }

  return Math.round(
    targetElevationMeters *
      (missionDistanceKm / targetDistanceKm),
  );
}

function cyclingTemplate(
  key: string,
  title: string,
  description: string,
  distanceKm: number,
  elevationMeters: number,
): MissionTemplate {
  return {
    key,
    title,
    description,
    sportType: "cycling",
    distanceKm,
    elevationMeters,
    averageSpeedKmh: 24,
    paceSecondsPerKm: null,
    stopIntervalKm:
      distanceKm >= 200 ? 100 : 50,
    stopDurationMinutes: 10,
    carbohydratesPerHour: 80,
    fluidMillilitersPerHour: 600,
    sodiumMilligramsPerHour: 500,
  };
}

function runningTemplate(
  key: string,
  title: string,
  description: string,
  distanceKm: number,
  elevationMeters: number,
): MissionTemplate {
  return {
    key,
    title,
    description,
    sportType: "running",
    distanceKm,
    elevationMeters,
    averageSpeedKmh: null,
    paceSecondsPerKm: 360,
    stopIntervalKm:
      distanceKm >= 30 ? 10 : 5,
    stopDurationMinutes: 5,
    carbohydratesPerHour: 60,
    fluidMillilitersPerHour: 500,
    sodiumMilligramsPerHour: 400,
  };
}

export function deriveMissionTemplates(
  input: MissionTemplateInput,
): MissionTemplate[] {
  if (
    !Number.isFinite(input.targetDistanceKm) ||
    input.targetDistanceKm <= 0
  ) {
    return [];
  }

  const definitions = [
    {
      key: "foundation",
      fraction: 0.25,
      title: "Erster Distanznachweis",
      description:
        "Ein kontrollierter erster Schritt, um Belastung, Material und Versorgung unter realen Bedingungen zu prüfen.",
    },
    {
      key: "half-distance",
      fraction: 0.5,
      title: "Halbdistanz-Mission",
      description:
        "Die Hälfte der Zieldistanz als eigenständige Belastungsprobe mit vollständigem Verpflegungsplan.",
    },
    {
      key: "dress-rehearsal",
      fraction: 0.75,
      title: "Große Generalprobe",
      description:
        "Eine lange Generalprobe für Pacing, Versorgung, Ausrüstung und Pausenstrategie.",
    },
  ];

  const templates = definitions.map(
    (definition) => {
      const distanceKm = roundedDistance(
        input.targetDistanceKm *
          definition.fraction,
        input.sportType,
      );

      const elevationMeters =
        proportionalElevation(
          input.targetDistanceKm,
          input.targetElevationMeters,
          distanceKm,
        );

      if (input.sportType === "running") {
        return runningTemplate(
          definition.key,
          definition.title,
          definition.description,
          distanceKm,
          elevationMeters,
        );
      }

      return cyclingTemplate(
        definition.key,
        definition.title,
        definition.description,
        distanceKm,
        elevationMeters,
      );
    },
  );

  const uniqueDistances = new Set<number>();

  return templates.filter((template) => {
    if (
      template.distanceKm >=
      input.targetDistanceKm
    ) {
      return false;
    }

    if (
      uniqueDistances.has(
        template.distanceKm,
      )
    ) {
      return false;
    }

    uniqueDistances.add(
      template.distanceKm,
    );

    return true;
  });
}

export function buildMissionDerivedKey(
  input: MissionTemplateInput,
  templateKey: string,
): string {
  const distancePart = Math.round(
    input.targetDistanceKm * 10,
  );

  const elevationPart = Math.round(
    input.targetElevationMeters ?? 0,
  );

  return [
    input.sportType,
    distancePart,
    elevationPart,
    templateKey,
  ].join(":");
}
export type MissionSportType = "cycling" | "running";

export type UltraMissionInput = {
  sportType: MissionSportType;
  distanceKm: number;
  elevationMeters: number;
  averageSpeedKmh: number;
  startAt: Date;
  stopIntervalKm: number;
  stopDurationMinutes: number;
  carbohydratesPerHour: number;
  fluidMillilitersPerHour: number;
  sodiumMilligramsPerHour: number;
};

export type UltraMissionSegment = {
  index: number;
  fromKm: number;
  toKm: number;
  distanceKm: number;
  ridingMinutes: number;
  breakMinutes: number;
  arrivalAt: Date;
  departureAt: Date;
  elapsedMinutes: number;
  cumulativeCarbohydratesGrams: number;
  cumulativeFluidMilliliters: number;
  cumulativeSodiumMilligrams: number;
};

export type UltraMissionPlan = {
  ridingMinutes: number;
  breakMinutes: number;
  totalMinutes: number;
  stopCount: number;
  finishAt: Date;
  totalCarbohydratesGrams: number;
  totalFluidMilliliters: number;
  totalSodiumMilligrams: number;
  elevationPer100Km: number;
  elevationPer10Km: number;
  segments: UltraMissionSegment[];
  warnings: string[];
};

function validateNumber(
  value: number,
  label: string,
  minimum: number,
  maximum: number,
): void {
  if (
    !Number.isFinite(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw new Error(
      `${label} muss zwischen ${minimum} und ${maximum} liegen.`,
    );
  }
}

function dateAfterMinutes(
  startAt: Date,
  minutes: number,
): Date {
  return new Date(startAt.getTime() + minutes * 60_000);
}

function rounded(value: number): number {
  return Math.round(value);
}

function cumulativeNutrition(
  elapsedMinutes: number,
  input: UltraMissionInput,
) {
  const hours = elapsedMinutes / 60;

  return {
    carbohydrates: rounded(
      hours * input.carbohydratesPerHour,
    ),
    fluid: rounded(
      hours * input.fluidMillilitersPerHour,
    ),
    sodium: rounded(
      hours * input.sodiumMilligramsPerHour,
    ),
  };
}

function buildWarnings(
  input: UltraMissionInput,
  totalMinutes: number,
  elevationPer100Km: number,
  elevationPer10Km: number,
): string[] {
  const warnings: string[] = [];

  if (totalMinutes >= 24 * 60) {
    warnings.push(
      "Die Mission dauert mindestens 24 Stunden. Schlaf- und Müdigkeitsstrategie sind in dieser Berechnung noch nicht enthalten.",
    );
  }

  if (
    input.sportType === "cycling" &&
    elevationPer100Km >= 1_200
  ) {
    warnings.push(
      "Die Radstrecke ist sehr bergig. Prüfe, ob der gewählte Bewegungsschnitt unter diesen Höhenmetern realistisch ist.",
    );
  }

  if (
    input.sportType === "running" &&
    elevationPer10Km >= 500
  ) {
    warnings.push(
      "Die Laufstrecke ist sehr bergig. Prüfe, ob die gewählte Pace unter diesen Höhenmetern realistisch ist.",
    );
  }

  if (
    input.sportType === "cycling" &&
    input.stopIntervalKm > 150
  ) {
    warnings.push(
      "Zwischen den geplanten Stopps liegen mehr als 150 Kilometer.",
    );
  }

  if (
    input.sportType === "running" &&
    input.stopIntervalKm > 25
  ) {
    warnings.push(
      "Zwischen den geplanten Aid Stations liegen mehr als 25 Kilometer.",
    );
  }

  if (
    input.sportType === "cycling" &&
    input.distanceKm >= 200 &&
    input.carbohydratesPerHour < 50
  ) {
    warnings.push(
      "Für eine lange Radmission sind weniger als 50 Gramm Kohlenhydrate pro Stunde eingeplant.",
    );
  }

  if (
    input.sportType === "running" &&
    input.distanceKm >= 42 &&
    input.carbohydratesPerHour < 30
  ) {
    warnings.push(
      "Für eine lange Laufmission sind weniger als 30 Gramm Kohlenhydrate pro Stunde eingeplant.",
    );
  }

  if (
    totalMinutes >= 6 * 60 &&
    input.fluidMillilitersPerHour < 400
  ) {
    warnings.push(
      "Die geplante Flüssigkeitsmenge liegt unter 400 Millilitern pro Stunde. Wetter und individuellen Schweißverlust zusätzlich berücksichtigen.",
    );
  }

  if (
    input.sportType === "cycling" &&
    input.averageSpeedKmh > 35
  ) {
    warnings.push(
      "Der gewählte Bewegungsschnitt ist für eine Ultra-Radmission außergewöhnlich hoch.",
    );
  }

  if (
    input.sportType === "running" &&
    input.averageSpeedKmh > 15
  ) {
    warnings.push(
      "Die gewählte Pace ist für eine lange Laufmission außergewöhnlich schnell.",
    );
  }

  return warnings;
}

export function paceMinutesPerKmToSpeed(
  paceMinutesPerKm: number,
): number {
  validateNumber(
    paceMinutesPerKm,
    "Pace",
    2,
    30,
  );

  return 60 / paceMinutesPerKm;
}

export function speedToPaceMinutesPerKm(
  speedKmh: number,
): number {
  validateNumber(
    speedKmh,
    "Geschwindigkeit",
    2,
    60,
  );

  return 60 / speedKmh;
}

export function formatPace(
  paceMinutesPerKm: number,
): string {
  validateNumber(
    paceMinutesPerKm,
    "Pace",
    2,
    60,
  );

  const totalSeconds = Math.round(
    paceMinutesPerKm * 60,
  );

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(
    2,
    "0",
  )} min/km`;
}

export function buildUltraMissionPlan(
  input: UltraMissionInput,
): UltraMissionPlan {
  if (
    input.sportType !== "cycling" &&
    input.sportType !== "running"
  ) {
    throw new Error("Die Sportart ist ungültig.");
  }

  validateNumber(
    input.distanceKm,
    "Distanz",
    1,
    10_000,
  );

  validateNumber(
    input.elevationMeters,
    "Höhenmeter",
    0,
    100_000,
  );

  validateNumber(
    input.averageSpeedKmh,
    input.sportType === "running"
      ? "Aus der Pace berechnete Geschwindigkeit"
      : "Bewegungsschnitt",
    input.sportType === "running" ? 2 : 5,
    input.sportType === "running" ? 30 : 60,
  );

  validateNumber(
    input.stopIntervalKm,
    input.sportType === "running"
      ? "Aid-Station-Intervall"
      : "Stoppintervall",
    input.sportType === "running" ? 1 : 20,
    500,
  );

  validateNumber(
    input.stopDurationMinutes,
    "Stoppdauer",
    0,
    240,
  );

  validateNumber(
    input.carbohydratesPerHour,
    "Kohlenhydrate pro Stunde",
    0,
    150,
  );

  validateNumber(
    input.fluidMillilitersPerHour,
    "Flüssigkeit pro Stunde",
    0,
    2_000,
  );

  validateNumber(
    input.sodiumMilligramsPerHour,
    "Natrium pro Stunde",
    0,
    3_000,
  );

  if (Number.isNaN(input.startAt.getTime())) {
    throw new Error("Die Startzeit ist ungültig.");
  }

  const segmentCount = Math.ceil(
    input.distanceKm / input.stopIntervalKm,
  );

  const segments: UltraMissionSegment[] = [];

  let elapsedMinutes = 0;
  let totalBreakMinutes = 0;
  let stopCount = 0;

  for (
    let index = 0;
    index < segmentCount;
    index += 1
  ) {
    const fromKm =
      index * input.stopIntervalKm;

    const toKm = Math.min(
      input.distanceKm,
      fromKm + input.stopIntervalKm,
    );

    const segmentDistanceKm = toKm - fromKm;

    const ridingMinutes =
      (segmentDistanceKm /
        input.averageSpeedKmh) *
      60;

    elapsedMinutes += ridingMinutes;

    const arrivalAt = dateAfterMinutes(
      input.startAt,
      elapsedMinutes,
    );

    const hasStopAfterSegment =
      toKm < input.distanceKm;

    const breakMinutes = hasStopAfterSegment
      ? input.stopDurationMinutes
      : 0;

    if (hasStopAfterSegment) {
      stopCount += 1;
      totalBreakMinutes += breakMinutes;
      elapsedMinutes += breakMinutes;
    }

    const departureAt = dateAfterMinutes(
      input.startAt,
      elapsedMinutes,
    );

    const nutrition = cumulativeNutrition(
      elapsedMinutes,
      input,
    );

    segments.push({
      index: index + 1,
      fromKm,
      toKm,
      distanceKm: segmentDistanceKm,
      ridingMinutes: rounded(ridingMinutes),
      breakMinutes,
      arrivalAt,
      departureAt,
      elapsedMinutes: rounded(elapsedMinutes),
      cumulativeCarbohydratesGrams:
        nutrition.carbohydrates,
      cumulativeFluidMilliliters:
        nutrition.fluid,
      cumulativeSodiumMilligrams:
        nutrition.sodium,
    });
  }

  const ridingMinutes =
    (input.distanceKm /
      input.averageSpeedKmh) *
    60;

  const totalMinutes =
    ridingMinutes + totalBreakMinutes;

  const nutrition = cumulativeNutrition(
    totalMinutes,
    input,
  );

  const elevationPer100Km =
    (input.elevationMeters /
      input.distanceKm) *
    100;

  const elevationPer10Km =
    (input.elevationMeters /
      input.distanceKm) *
    10;

  return {
    ridingMinutes: rounded(ridingMinutes),
    breakMinutes: rounded(totalBreakMinutes),
    totalMinutes: rounded(totalMinutes),
    stopCount,
    finishAt: dateAfterMinutes(
      input.startAt,
      totalMinutes,
    ),
    totalCarbohydratesGrams:
      nutrition.carbohydrates,
    totalFluidMilliliters:
      nutrition.fluid,
    totalSodiumMilligrams:
      nutrition.sodium,
    elevationPer100Km:
      rounded(elevationPer100Km),
    elevationPer10Km:
      rounded(elevationPer10Km),
    segments,
    warnings: buildWarnings(
      input,
      totalMinutes,
      elevationPer100Km,
      elevationPer10Km,
    ),
  };
}

export function formatMissionDuration(
  totalMinutes: number,
): string {
  const minutes = Math.max(
    0,
    Math.round(totalMinutes),
  );

  const days = Math.floor(minutes / 1_440);
  const remainingAfterDays =
    minutes % 1_440;

  const hours = Math.floor(
    remainingAfterDays / 60,
  );

  const remainingMinutes =
    remainingAfterDays % 60;

  return [
    days > 0 ? `${days} T` : null,
    `${hours} h`,
    `${remainingMinutes} min`,
  ]
    .filter(Boolean)
    .join(" ");
}
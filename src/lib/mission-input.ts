export type MissionDatabaseValues = {
  title: string;
  description: string | null;
  sport_type: "cycling" | "running";
  target_date: string;
  start_at: string;
  distance_km: number;
  elevation_meters: number;
  average_speed_kmh: number | null;
  pace_seconds_per_km: number | null;
  stop_interval_km: number;
  stop_duration_minutes: number;
  carbohydrates_per_hour: number;
  fluid_milliliters_per_hour: number;
  sodium_milligrams_per_hour: number;
};

export type ParsedMissionInput = {
  missionId: string | null;
  values: MissionDatabaseValues;
};

function text(
  formData: FormData,
  key: string,
): string {
  const value = formData.get(key);

  return typeof value === "string"
    ? value.trim()
    : "";
}

function numberValue(
  formData: FormData,
  key: string,
  label: string,
  minimum: number,
  maximum: number,
): number {
  const raw = text(formData, key).replace(
    ",",
    ".",
  );

  const value = Number(raw);

  if (
    !Number.isFinite(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw new Error(
      `${label} muss zwischen ${minimum} und ${maximum} liegen.`,
    );
  }

  return value;
}

function integerValue(
  formData: FormData,
  key: string,
  label: string,
  minimum: number,
  maximum: number,
): number {
  const value = numberValue(
    formData,
    key,
    label,
    minimum,
    maximum,
  );

  if (!Number.isInteger(value)) {
    throw new Error(
      `${label} muss eine ganze Zahl sein.`,
    );
  }

  return value;
}

function paceSeconds(
  value: string,
): number {
  const normalized = value
    .trim()
    .replace(",", ".");

  let totalSeconds: number;

  if (normalized.includes(":")) {
    const parts = normalized.split(":");

    if (parts.length !== 2) {
      throw new Error(
        "Die Pace ist ungültig.",
      );
    }

    const minutes = Number(parts[0]);
    const seconds = Number(parts[1]);

    if (
      !Number.isInteger(minutes) ||
      !Number.isInteger(seconds) ||
      seconds < 0 ||
      seconds > 59
    ) {
      throw new Error(
        "Die Pace ist ungültig.",
      );
    }

    totalSeconds =
      minutes * 60 + seconds;
  } else {
    const decimalMinutes =
      Number(normalized);

    totalSeconds = Math.round(
      decimalMinutes * 60,
    );
  }

  if (
    !Number.isFinite(totalSeconds) ||
    totalSeconds < 120 ||
    totalSeconds > 1_800
  ) {
    throw new Error(
      "Die Pace muss zwischen 2:00 und 30:00 min/km liegen.",
    );
  }

  return totalSeconds;
}

function validDate(
  value: string,
): boolean {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const date = new Date(
    `${value}T12:00:00.000Z`,
  );

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) ===
      value
  );
}

function missionId(
  formData: FormData,
): string | null {
  const value = text(
    formData,
    "missionId",
  );

  if (value === "") {
    return null;
  }

  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuidPattern.test(value)) {
    throw new Error(
      "Die Missions-ID ist ungültig.",
    );
  }

  return value;
}

export function buildMissionWriteInput(
  formData: FormData,
): ParsedMissionInput {
  const title = text(formData, "title");

  if (
    title.length < 1 ||
    title.length > 200
  ) {
    throw new Error(
      "Der Missionsname muss zwischen 1 und 200 Zeichen lang sein.",
    );
  }

  const descriptionValue = text(
    formData,
    "description",
  );

  if (descriptionValue.length > 2_000) {
    throw new Error(
      "Die Beschreibung darf höchstens 2000 Zeichen lang sein.",
    );
  }

  const sportType = text(
    formData,
    "sportType",
  );

  if (
    sportType !== "cycling" &&
    sportType !== "running"
  ) {
    throw new Error(
      "Die Sportart ist ungültig.",
    );
  }

  const targetDate = text(
    formData,
    "targetDate",
  );

  if (!validDate(targetDate)) {
    throw new Error(
      "Das Missionsdatum ist ungültig.",
    );
  }

  const startAtIso = text(
    formData,
    "startAtIso",
  );

  const startAt = new Date(startAtIso);

  if (
    startAtIso === "" ||
    Number.isNaN(startAt.getTime())
  ) {
    throw new Error(
      "Die Startzeit ist ungültig.",
    );
  }

  const averageSpeedKmh =
    sportType === "cycling"
      ? numberValue(
          formData,
          "averageSpeedKmh",
          "Bewegungsschnitt",
          5,
          60,
        )
      : null;

  const paceSecondsPerKm =
    sportType === "running"
      ? paceSeconds(
          text(formData, "pace"),
        )
      : null;

  return {
    missionId: missionId(formData),
    values: {
      title,
      description:
        descriptionValue || null,
      sport_type: sportType,
      target_date: targetDate,
      start_at: startAt.toISOString(),
      distance_km: numberValue(
        formData,
        "distanceKm",
        "Distanz",
        1,
        10_000,
      ),
      elevation_meters: integerValue(
        formData,
        "elevationMeters",
        "Höhenmeter",
        0,
        100_000,
      ),
      average_speed_kmh:
        averageSpeedKmh,
      pace_seconds_per_km:
        paceSecondsPerKm,
      stop_interval_km: numberValue(
        formData,
        "stopIntervalKm",
        sportType === "running"
          ? "Aid-Station-Intervall"
          : "Stoppintervall",
        sportType === "running"
          ? 1
          : 20,
        500,
      ),
      stop_duration_minutes:
        integerValue(
          formData,
          "stopDurationMinutes",
          "Stoppdauer",
          0,
          240,
        ),
      carbohydrates_per_hour:
        integerValue(
          formData,
          "carbohydratesPerHour",
          "Kohlenhydrate pro Stunde",
          0,
          150,
        ),
      fluid_milliliters_per_hour:
        integerValue(
          formData,
          "fluidMillilitersPerHour",
          "Flüssigkeit pro Stunde",
          0,
          2_000,
        ),
      sodium_milligrams_per_hour:
        integerValue(
          formData,
          "sodiumMilligramsPerHour",
          "Natrium pro Stunde",
          0,
          3_000,
        ),
    },
  };
}
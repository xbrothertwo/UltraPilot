import type {
  ActivityStream,
  SensorSample,
  StreamType,
} from "@/lib/activity-files/types";

export type ActivityStreamRow = {
  stream_type: unknown;
  source: unknown;
  unit?: unknown;
  sample_count?: unknown;
  samples: unknown;
};

export type ValidatedActivityStreamRow = {
  type: StreamType;
  source: ActivityStream["source"];
  sampleCount: number | null;
  samples: SensorSample[];
};

const streamTypes: readonly StreamType[] = [
  "heart_rate",
  "power",
  "cadence",
  "speed",
  "altitude",
];

const activityStreamSources = [
  "garmin_edge",
  "apple_watch",
  "gpx",
  "fit",
] as const satisfies readonly ActivityStream["source"][];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function validSamples(value: unknown): SensorSample[] {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((sample) => {
      if (
        !isRecord(sample) ||
        typeof sample.timestamp !== "string" ||
        typeof sample.value !== "number"
      )
        return [];
      const timestamp = new Date(sample.timestamp);
      if (Number.isNaN(timestamp.getTime()) || !Number.isFinite(sample.value))
        return [];
      return [{ timestamp: timestamp.toISOString(), value: sample.value }];
    })
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

export function isActivityStreamSource(
  value: unknown,
): value is ActivityStream["source"] {
  return (
    typeof value === "string" &&
    (activityStreamSources as readonly string[]).includes(value)
  );
}

export function validateActivityStreamRow(
  row: ActivityStreamRow,
): ValidatedActivityStreamRow | null {
  if (
    typeof row.stream_type !== "string" ||
    !streamTypes.includes(row.stream_type as StreamType) ||
    !isActivityStreamSource(row.source)
  )
    return null;

  const samples = validSamples(row.samples);
  if (!samples.length) return null;

  return {
    type: row.stream_type as StreamType,
    source: row.source,
    sampleCount:
      typeof row.sample_count === "number" ? row.sample_count : null,
    samples,
  };
}

export function validateRawActivityStreamRow(
  row: ActivityStreamRow,
): ValidatedActivityStreamRow | null {
  const validated = validateActivityStreamRow(row);
  if (
    !validated ||
    (validated.type !== "heart_rate" && validated.type !== "power")
  )
    return null;
  return validated;
}

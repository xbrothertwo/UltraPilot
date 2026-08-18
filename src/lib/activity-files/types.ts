import type { GpxMetrics } from "@/lib/gpx/types";

export type StreamType = "heart_rate" | "power" | "cadence" | "speed" | "altitude";

export type SensorSample = {
  timestamp: string;
  value: number;
};

export type ActivityStream = {
  type: StreamType;
  source: "garmin_edge" | "apple_watch" | "gpx" | "fit";
  unit: "bpm" | "watt" | "rpm" | "mps" | "meter";
  samples: SensorSample[];
};

export type ParsedActivityFile = {
  metrics: GpxMetrics;
  streams: ActivityStream[];
  fileType: "gpx" | "fit" | "json";
  detectedSportType?: "cycling" | "running" | null;
};

export type MergeResult = {
  metrics: GpxMetrics;
  streams: ActivityStream[];
  heartRateSource: "primary" | "none" | ActivityStream["source"];
  importedHeartRateSamples: number;
  overlapSeconds: number;
};

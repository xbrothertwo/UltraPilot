import type { Activity } from "@/lib/demo-data";

export type ActivityDetailMetric = { label: string; value: string };

export function buildActivityDetailMetrics(activity: Activity): ActivityDetailMetric[] {
  const metrics: ActivityDetailMetric[] = [];
  if (activity.averageHeartRate !== null) metrics.push({ label: "Ø Herzfrequenz", value: `${Math.round(activity.averageHeartRate)} bpm` });
  if (activity.maximumHeartRate !== null) metrics.push({ label: "Max. Herzfrequenz", value: `${Math.round(activity.maximumHeartRate)} bpm` });
  if ((activity.sportType === "cycling" || activity.sportType === "running") && activity.averagePower !== null) metrics.push({ label: "Ø Leistung", value: `${Math.round(activity.averagePower)} W` });
  if ((activity.sportType === "cycling" || activity.sportType === "running") && activity.normalizedPower !== null) metrics.push({ label: "Normalized Power", value: `${Math.round(activity.normalizedPower)} W` });
  return metrics;
}

export function heartRateSetupState(input: { hasHeartRateData: boolean; hasHeartRateZones: boolean }): "ready" | "needs_reference" | "no_data" {
  if (input.hasHeartRateData && !input.hasHeartRateZones) return "needs_reference";
  if (input.hasHeartRateData && input.hasHeartRateZones) return "ready";
  return "no_data";
}

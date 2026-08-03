import { extractGpxSensorSamples, parseGpx } from "@/lib/gpx/parser";
import type { ActivityStream, ParsedActivityFile } from "./types";
import { parseFit } from "./fit-parser";
import { parseHeartRateJson } from "@/lib/apple-health/json-parser";

export async function parseActivityFile(file: File, source: ActivityStream["source"]): Promise<ParsedActivityFile> {
  const extension = file.name.split(".").at(-1)?.toLowerCase();
  if (extension === "fit") return parseFit(new Uint8Array(await file.arrayBuffer()), source);
  if (extension === "json" && source === "apple_watch") return parseHeartRateJson(await file.text());
  if (extension === "gpx") {
    const xml = await file.text();
    const metrics = parseGpx(xml);
    const samples = extractGpxSensorSamples(xml);
    const streams: ActivityStream[] = [
      ...(samples.heartRate.length ? [{ type: "heart_rate" as const, source: "gpx" as const, unit: "bpm" as const, samples: samples.heartRate }] : []),
      ...(samples.speed.length ? [{ type: "speed" as const, source: "gpx" as const, unit: "mps" as const, samples: samples.speed }] : []),
      ...(samples.altitude.length ? [{ type: "altitude" as const, source: "gpx" as const, unit: "meter" as const, samples: samples.altitude }] : []),
    ];
    return { metrics, streams, fileType: "gpx" };
  }
  throw new Error(extension === "tcx" ? "Der TCX-Parser folgt in einer späteren Phase." : "Unterstützt werden GPX- und FIT-Dateien.");
}

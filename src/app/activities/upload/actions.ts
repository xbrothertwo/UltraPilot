"use server";

import type { GpxMetrics } from "@/lib/gpx/types";
import { parseActivityFile } from "@/lib/activity-files/parser";
import { mergeHeartRate } from "@/lib/activity-files/merge";
import type { ActivityStream } from "@/lib/activity-files/types";
import { findDuplicateActivity } from "@/lib/activity-files/duplicate";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export type UploadState = {
  status: "idle" | "success" | "partial" | "error" | "unsupported" | "duplicate";
  message: string;
  fileName?: string;
  metrics?: GpxMetrics;
  activityId?: string;
  heartRateSource?: "primary" | "apple_watch" | "none";
  importedHeartRateSamples?: number;
  results?: UploadResult[];
};

export type UploadResult = Omit<UploadState, "results">;

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;
type UploadSportType = "cycling" | "running";

function uploadSportType(value: FormDataEntryValue | null): UploadSportType {
  if (value === "cycling" || value === "running") return value;
  throw new Error("Bitte wähle Radfahren oder Laufen als Sportart aus.");
}

function fileExtension(file: File): string | undefined {
  return file.name.split(".").at(-1)?.toLowerCase();
}

function validateFile(file: FormDataEntryValue | null, label: string, optional = false, allowedExtensions: string[] = ["gpx", "fit", "tcx"]): File | null {
  if (!(file instanceof File) || file.size === 0) {
    if (optional) return null;
    throw new Error(`Bitte wähle ${label} aus.`);
  }
  if (file.size > MAX_FILE_SIZE_BYTES) throw new Error(`${label} darf höchstens 20 MB groß sein.`);
  const extension = fileExtension(file);
  if (!extension || !allowedExtensions.includes(extension)) throw new Error(`${label} besitzt kein unterstütztes Dateiformat.`);
  if (extension === "tcx") throw new Error("Der TCX-Parser folgt in einer späteren Phase.");
  return file;
}

function streamRecord(activityId: string, userId: string, stream: ActivityStream) {
  const timestamps = stream.samples.map((sample) => sample.timestamp).sort();
  return { activity_id: activityId, user_id: userId, stream_type: stream.type, source: stream.source, unit: stream.unit, sample_count: stream.samples.length, start_time: timestamps[0], end_time: timestamps.at(-1)!, samples: stream.samples };
}

export async function inspectActivityFile(_previous: UploadState, formData: FormData): Promise<UploadState> {
  let file: File | null = null;
  try {
    const sportType = uploadSportType(formData.get("sportType"));
    file = validateFile(formData.get("activityFile"), "eine GPX- oder FIT-Hauptdatei");
    const supplement = validateFile(formData.get("heartRateFile"), "Die Apple-Watch-Datei", true, ["gpx", "fit", "json"]);
    if (!file) throw new Error("Die Hauptdatei fehlt.");
    const primary = await parseActivityFile(file, fileExtension(file) === "fit" ? "garmin_edge" : "gpx");
    const watch = supplement ? await parseActivityFile(supplement, "apple_watch") : undefined;
    const merged = mergeHeartRate(primary, watch);
    const metrics = merged.metrics;
    const mergeMessage = supplement ? `${merged.importedHeartRateSamples} Watch-Herzfrequenzwerte wurden zeitlich zugeordnet.` : merged.heartRateSource === "primary" ? "Herzfrequenz stammt aus der Hauptdatei." : "Keine Herzfrequenzdatei hinzugefügt.";
    if (!isSupabaseConfigured()) return { status: "success", fileName: file.name, message: `Dateien wurden im Demo-Modus analysiert. ${mergeMessage}`, metrics, heartRateSource: merged.heartRateSource, importedHeartRateSamples: merged.importedHeartRateSamples };

    const user = await requireUser();
    const supabase = await createClient();
    if (!supabase) return { status: "error", fileName: file.name, message: "Supabase ist nicht verfügbar." };

    const duplicateWindowMs = 3 * 60 * 1000;
    const windowStart = new Date(new Date(metrics.startTime).getTime() - duplicateWindowMs).toISOString();
    const windowEnd = new Date(new Date(metrics.startTime).getTime() + duplicateWindowMs).toISOString();
    const { data: candidateRows, error: duplicateCheckError } = await supabase
      .from("activities")
      .select("id, activity_date, moving_time_seconds, distance_meters")
      .eq("user_id", user.id)
      .eq("sport_type", sportType)
      .gte("activity_date", windowStart)
      .lte("activity_date", windowEnd);
    if (duplicateCheckError) throw new Error(`Duplikate konnten nicht geprüft werden: ${duplicateCheckError.message}`);
    const duplicate = findDuplicateActivity(
      (candidateRows ?? []).map((row) => ({ id: row.id, activityDate: row.activity_date, movingTimeSeconds: row.moving_time_seconds, distanceMeters: row.distance_meters })),
      { startTime: metrics.startTime, movingTimeSeconds: metrics.movingTimeSeconds, distanceMeters: metrics.distanceMeters },
    );
    if (duplicate) {
      return { status: "duplicate", fileName: file.name, message: `Diese Aktivität wurde bereits am ${new Date(duplicate.activityDate).toLocaleDateString("de-DE")} importiert und wurde übersprungen.`, activityId: duplicate.id };
    }

    const activityId = crypto.randomUUID();
    const primaryExtension = fileExtension(file)!;
    const storagePath = `${user.id}/primary-${activityId}.${primaryExtension}`;
    const storeSupplementFile = supplement && fileExtension(supplement) !== "json" ? supplement : null;
    const supplementPath = storeSupplementFile ? `${user.id}/heart-rate-${activityId}.${fileExtension(storeSupplementFile)}` : null;
    const title = file.name.replace(/\.(?:gpx|fit)$/i, "").replace(/[_-]+/g, " ").trim().slice(0, 200) || (sportType === "running" ? "Lauf" : "Radfahrt");
    const activityRecord = {
      id: activityId,
      user_id: user.id,
      sport_type: sportType,
      activity_date: metrics.startTime,
      title,
      distance_meters: metrics.distanceMeters,
      moving_time_seconds: Math.round(metrics.movingTimeSeconds),
      elapsed_time_seconds: Math.round(metrics.elapsedTimeSeconds),
      elevation_gain_meters: metrics.elevationGainMeters,
      average_speed_kmh: metrics.averageSpeedKmh,
      average_heart_rate: metrics.averageHeartRate === null ? null : Math.round(metrics.averageHeartRate),
      maximum_heart_rate: metrics.maximumHeartRate === null ? null : Math.round(metrics.maximumHeartRate),
      average_power: metrics.averagePower === null ? null : Math.round(metrics.averagePower),
      normalized_power: metrics.normalizedPower === null ? null : Math.round(metrics.normalizedPower),
      source: supplement ? `${primaryExtension}_apple_watch` : `${primaryExtension}_upload`,
    };

    const { error: activityError } = await supabase.from("activities").insert(activityRecord);
    if (activityError) throw new Error(`Aktivität konnte nicht gespeichert werden: ${activityError.message}`);

    const uploads = [
      { path: storagePath, file, contentType: primaryExtension === "fit" ? "application/octet-stream" : "application/gpx+xml" },
      ...(storeSupplementFile && supplementPath ? [{ path: supplementPath, file: storeSupplementFile, contentType: fileExtension(storeSupplementFile) === "fit" ? "application/octet-stream" : "application/gpx+xml" }] : []),
    ];
    const uploadResults = await Promise.all(uploads.map(async (upload) => supabase.storage.from("activity-files").upload(upload.path, await upload.file.arrayBuffer(), { contentType: upload.contentType, upsert: false })));
    const storageError = uploadResults.find((result) => result.error)?.error;
    if (storageError) {
      await supabase.storage.from("activity-files").remove(uploads.map((upload) => upload.path));
      await supabase.from("activities").delete().eq("id", activityId);
      throw new Error(`Datei konnte nicht gespeichert werden: ${storageError.message}`);
    }

    const fileRecords = [
      { activity_id: activityId, user_id: user.id, storage_path: storagePath, original_filename: file.name.slice(0, 255), file_type: primaryExtension, mime_type: uploads[0].contentType, size_bytes: file.size, file_role: "primary", source_device: primaryExtension === "fit" ? "garmin_edge" : "gpx" },
      ...(storeSupplementFile && supplementPath ? [{ activity_id: activityId, user_id: user.id, storage_path: supplementPath, original_filename: storeSupplementFile.name.slice(0, 255), file_type: fileExtension(storeSupplementFile)!, mime_type: uploads[1].contentType, size_bytes: storeSupplementFile.size, file_role: "heart_rate_supplement", source_device: "apple_watch" }] : []),
    ];
    const [{ error: fileError }, { error: metricsError }, { error: streamsError }] = await Promise.all([
      supabase.from("activity_files").insert(fileRecords),
      supabase.from("activity_metrics").insert({ activity_id: activityId, user_id: user.id, track_point_count: metrics.trackPointCount, heart_rate_sample_count: metrics.heartRateSampleCount, calculation_version: "multi-source-v1", metrics: { ...metrics, heartRateSource: merged.heartRateSource, overlapSeconds: merged.overlapSeconds } }),
      merged.streams.length ? supabase.from("activity_streams").insert(merged.streams.map((stream) => streamRecord(activityId, user.id, stream))) : Promise.resolve({ error: null }),
    ]);
    if (fileError || metricsError || streamsError) {
      await supabase.storage.from("activity-files").remove(uploads.map((upload) => upload.path));
      await supabase.from("activities").delete().eq("id", activityId);
      throw new Error(`Metadaten konnten nicht gespeichert werden: ${(fileError ?? metricsError ?? streamsError)?.message}`);
    }

    revalidatePath("/dashboard");
    revalidatePath("/activities");
    revalidatePath("/plan");
    return { status: "success", fileName: file.name, message: `${supplement ? "Aktivität und beide Datenquellen" : "Aktivität"} wurden sicher gespeichert. ${mergeMessage}`, metrics, activityId, heartRateSource: merged.heartRateSource, importedHeartRateSamples: merged.importedHeartRateSamples };
  } catch (error) {
    return { status: "error", fileName: file?.name, message: error instanceof Error ? error.message : "Die Aktivitätsdateien konnten nicht verarbeitet werden." };
  }
}

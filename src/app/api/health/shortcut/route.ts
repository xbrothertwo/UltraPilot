import { NextResponse } from "next/server";
import { persistAppleHealthRecovery } from "@/lib/apple-health/recovery-import";
import { parseAppleHealthShortcutPayload } from "@/lib/apple-health/shortcut-payload";
import { hashHealthShortcutToken, isHealthShortcutToken } from "@/lib/apple-health/shortcut-token";
import { persistAppleHealthWorkouts, type AppleHealthImportResult } from "@/lib/apple-health/workout-import";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function response(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function bearer(request: Request): string {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : request.headers.get("x-ultrapilot-token")?.trim() ?? "";
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 1_000_000) return response({ ok: false, error: "Payload ist größer als 1 MB." }, 413);
  const token = bearer(request);
  if (!isHealthShortcutToken(token)) return response({ ok: false, error: "Verbindungsschlüssel fehlt oder ist ungültig." }, 401);
  const supabase = createAdminClient();
  if (!supabase) return response({ ok: false, error: "Der serverseitige Supabase-Zugang ist noch nicht konfiguriert." }, 503);

  const { data: connection, error: connectionError } = await supabase.from("health_shortcut_tokens").select("user_id").eq("token_hash", hashHealthShortcutToken(token)).is("revoked_at", null).maybeSingle();
  if (connectionError) return response({ ok: false, error: "Shortcut-Verbindung konnte nicht geprüft werden." }, 503);
  if (!connection?.user_id) return response({ ok: false, error: "Verbindungsschlüssel ist unbekannt oder wurde widerrufen." }, 401);

  try {
    const extraction = parseAppleHealthShortcutPayload(await request.json());
    const workoutResult: AppleHealthImportResult = { imported: 0, skippedDuplicates: 0, activityIds: [], errors: [] };
    for (let index = 0; index < extraction.workouts.length; index += 10) {
      const batch = await persistAppleHealthWorkouts(supabase, connection.user_id, extraction.workouts.slice(index, index + 10));
      workoutResult.imported += batch.imported;
      workoutResult.skippedDuplicates += batch.skippedDuplicates;
      workoutResult.activityIds.push(...batch.activityIds);
      workoutResult.errors.push(...batch.errors);
    }
    const nightsUpdated = extraction.recovery.length ? await persistAppleHealthRecovery(supabase, connection.user_id, extraction.recovery, "apple_health_shortcut") : 0;
    await supabase.from("health_shortcut_tokens").update({ last_used_at: new Date().toISOString() }).eq("user_id", connection.user_id);
    return response({ ok: workoutResult.errors.length === 0, recordsReceived: extraction.recordCount, nightsUpdated, workoutsImported: workoutResult.imported, duplicatesSkipped: workoutResult.skippedDuplicates, cyclingWorkoutsIgnored: extraction.ignoredCyclingCount, unsupportedRecordsIgnored: extraction.ignoredUnsupportedCount, errors: workoutResult.errors });
  } catch (error) {
    return response({ ok: false, error: error instanceof Error ? error.message : "Health-Daten konnten nicht verarbeitet werden." }, 400);
  }
}

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

export const TRACKING_TYPES = new Set([
  "weight_reps",
  "bodyweight_reps",
  "weight_or_bodyweight_reps",
  "reps_only",
  "time",
  "weight_time",
  "distance_time",
  "weight_distance",
  "time_or_reps",
]);

export const EXERCISE_TYPES = new Set([
  "compound",
  "isolation",
  "core",
  "carry",
  "isometric",
  "plyometric",
  "conditioning",
  "stability",
]);

export const LATERALITY_MODES = new Set([
  "bilateral",
  "unilateral",
  "alternating",
  "variable",
]);

const EXPECTED_HEADERS = [
  "ID",
  "Muskel",
  "Weitere_Muskeln",
  "Muskelgruppe_UI",
  "Weitere_Muskelgruppen_UI",
  "Übung",
  "Equipment",
  "Equipment_Normalisiert",
  "Variationen",
  "Aliase",
  "Tracking_Typ",
  "Übungstyp",
  "Bewegungsmuster",
  "Seitenmodus",
  "Aktiv",
  "Review_Status",
  "Review_Hinweis",
];

function splitDelimited(text, delimiter) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === delimiter && !quoted) {
      row.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }
  if (quoted) throw new Error("CSV enthält ein nicht geschlossenes Anführungszeichen.");
  row.push(field);
  if (row.some((value) => value.length > 0)) rows.push(row);
  return rows;
}

function pipeList(value) {
  return value
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

function booleanValue(value, externalId) {
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  throw new Error(`${externalId}: Aktiv muss true oder false sein.`);
}

function requireValue(value, label, externalId) {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${externalId}: ${label} darf nicht leer sein.`);
  return normalized;
}

export function parseExerciseCsv(text) {
  const normalized = text.replace(/^\uFEFF/, "");
  const rows = splitDelimited(normalized, ";");
  if (rows.length < 2) throw new Error("CSV enthält keine Übungsdatensätze.");
  const headers = rows[0].map((header) => header.trim());
  if (headers.length !== EXPECTED_HEADERS.length || headers.some((header, index) => header !== EXPECTED_HEADERS[index])) {
    throw new Error(`Unerwartete CSV-Spalten. Erwartet: ${EXPECTED_HEADERS.join("; ")}`);
  }

  const seen = new Set();
  return rows.slice(1).map((values, rowIndex) => {
    if (values.length !== headers.length) throw new Error(`Zeile ${rowIndex + 2}: ${values.length} statt ${headers.length} Spalten.`);
    const source = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
    const externalId = requireValue(source.ID, "ID", `Zeile ${rowIndex + 2}`);
    if (!/^EX-\d{4}$/.test(externalId)) throw new Error(`${externalId}: ID muss dem Format EX-0001 entsprechen.`);
    if (seen.has(externalId)) throw new Error(`${externalId}: doppelte External ID.`);
    seen.add(externalId);
    const trackingType = requireValue(source.Tracking_Typ, "Tracking_Typ", externalId);
    const exerciseType = requireValue(source.Übungstyp, "Übungstyp", externalId);
    const laterality = requireValue(source.Seitenmodus, "Seitenmodus", externalId);
    if (!TRACKING_TYPES.has(trackingType)) throw new Error(`${externalId}: unbekannter Tracking_Typ ${trackingType}.`);
    if (!EXERCISE_TYPES.has(exerciseType)) throw new Error(`${externalId}: unbekannter Übungstyp ${exerciseType}.`);
    if (!LATERALITY_MODES.has(laterality)) throw new Error(`${externalId}: unbekannter Seitenmodus ${laterality}.`);
    const normalizedEquipment = pipeList(source.Equipment_Normalisiert);
    return {
      externalId,
      name: requireValue(source.Übung, "Übung", externalId),
      primaryMuscle: requireValue(source.Muskel, "Muskel", externalId),
      secondaryMuscles: pipeList(source.Weitere_Muskeln),
      muscleGroup: requireValue(source.Muskelgruppe_UI, "Muskelgruppe_UI", externalId),
      secondaryMuscleGroups: pipeList(source.Weitere_Muskelgruppen_UI),
      equipment: normalizedEquipment,
      sourceEquipment: pipeList(source.Equipment),
      variations: pipeList(source.Variationen),
      aliases: pipeList(source.Aliase),
      trackingType,
      exerciseType,
      movementPattern: source.Bewegungsmuster.trim() || null,
      laterality,
      active: booleanValue(source.Aktiv, externalId),
      reviewStatus: source.Review_Status.trim() || null,
      reviewNote: source.Review_Hinweis.trim() || null,
    };
  });
}

export function summarizeLibrary(records) {
  const duplicateIds = records.length - new Set(records.map((record) => record.externalId)).size;
  return {
    records: records.length,
    active: records.filter((record) => record.active).length,
    reviewRequired: records.filter((record) => record.reviewStatus === "prüfen").length,
    duplicateIds,
    equipment: new Set(records.flatMap((record) => record.equipment)).size,
    sha256: createHash("sha256").update(JSON.stringify(records)).digest("hex"),
  };
}

export function planLibraryImport(existingRows, incomingRecords) {
  const existing = new Map(existingRows.map((row) => [row.external_id, row]));
  const incomingIds = new Set(incomingRecords.map((record) => record.externalId));
  return {
    inserts: incomingRecords.filter((record) => !existing.has(record.externalId)).map((record) => record.externalId),
    updates: incomingRecords.filter((record) => existing.has(record.externalId)).map((record) => record.externalId),
    archives: existingRows.filter((row) => !incomingIds.has(row.external_id) && row.active).map((row) => row.external_id),
  };
}

export async function readExerciseLibrary(csvPath) {
  return parseExerciseCsv(await readFile(csvPath, "utf8"));
}

async function generateJson(records, outputPath, summary) {
  const payload = { generatedAt: null, source: "Uebungsdatenbank_UltraPilot_Gym_v1.csv", sha256: summary.sha256, records };
  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function applyImport(records, summary) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error("Für --apply werden NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY benötigt.");
  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: existingRows, error: existingError } = await client.from("gym_exercises").select("external_id,active").eq("source", "ultrapilot_csv").not("external_id", "is", null);
  if (existingError) throw new Error(`Bestehende Library konnte nicht gelesen werden: ${existingError.message}`);
  const plan = planLibraryImport(existingRows ?? [], records);

  const equipmentNames = [...new Set(records.flatMap((record) => record.equipment))].sort((a, b) => a.localeCompare(b, "de"));
  if (equipmentNames.length) {
    const { error } = await client.from("gym_equipment").upsert(equipmentNames.map((name) => ({ name })), { onConflict: "name" });
    if (error) throw new Error(`Equipment-Import fehlgeschlagen: ${error.message}`);
  }
  const { data: equipmentRows, error: equipmentReadError } = await client.from("gym_equipment").select("id,name").in("name", equipmentNames);
  if (equipmentReadError) throw new Error(`Equipment konnte nicht gelesen werden: ${equipmentReadError.message}`);
  const equipmentIds = new Map((equipmentRows ?? []).map((row) => [row.name, row.id]));

  for (let index = 0; index < records.length; index += 100) {
    const chunk = records.slice(index, index + 100);
    const { error } = await client.from("gym_exercises").upsert(chunk.map((record) => ({
      external_id: record.externalId,
      owner_id: null,
      name: record.name,
      primary_muscle: record.primaryMuscle,
      secondary_muscles: record.secondaryMuscles,
      muscle_group: record.muscleGroup,
      secondary_muscle_groups: record.secondaryMuscleGroups,
      aliases: record.aliases,
      variations: record.variations,
      tracking_type: record.trackingType,
      exercise_type: record.exerciseType,
      movement_pattern: record.movementPattern,
      laterality: record.laterality,
      source: "ultrapilot_csv",
      source_equipment: record.sourceEquipment,
      active: record.active,
      review_status: record.reviewStatus,
      review_note: record.reviewNote,
      library_hash: summary.sha256,
      updated_at: new Date().toISOString(),
    })), { onConflict: "external_id" });
    if (error) throw new Error(`Exercise-Upsert fehlgeschlagen: ${error.message}`);
  }

  const { data: exerciseRows, error: exerciseReadError } = await client.from("gym_exercises").select("id,external_id").in("external_id", records.map((record) => record.externalId));
  if (exerciseReadError) throw new Error(`Exercise-IDs konnten nicht gelesen werden: ${exerciseReadError.message}`);
  const exerciseIds = new Map((exerciseRows ?? []).map((row) => [row.external_id, row.id]));
  for (const record of records) {
    const exerciseId = exerciseIds.get(record.externalId);
    if (!exerciseId) throw new Error(`${record.externalId}: interne ID fehlt nach Upsert.`);
    const { error: deleteError } = await client.from("gym_exercise_equipment").delete().eq("exercise_id", exerciseId);
    if (deleteError) throw new Error(`${record.externalId}: alte Equipment-Zuordnung konnte nicht ersetzt werden.`);
    if (record.equipment.length) {
      const { error: linkError } = await client.from("gym_exercise_equipment").insert(record.equipment.map((name) => ({ exercise_id: exerciseId, equipment_id: equipmentIds.get(name) })));
      if (linkError) throw new Error(`${record.externalId}: Equipment-Zuordnung fehlgeschlagen: ${linkError.message}`);
    }
  }
  if (plan.archives.length) {
    const { error } = await client.from("gym_exercises").update({ active: false, updated_at: new Date().toISOString() }).in("external_id", plan.archives);
    if (error) throw new Error(`Archivierung fehlgeschlagen: ${error.message}`);
  }
  return plan;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const csvPath = resolve(process.cwd(), "data/gym/Uebungsdatenbank_UltraPilot_Gym_v1.csv");
  const records = await readExerciseLibrary(csvPath);
  const summary = summarizeLibrary(records);
  if (summary.duplicateIds) throw new Error("CSV enthält doppelte External IDs.");
  if (args.has("--generate")) {
    await generateJson(records, resolve(process.cwd(), "src/lib/gym/exercise-library.generated.json"), summary);
  }
  if (args.has("--apply")) {
    const plan = await applyImport(records, summary);
    console.log(JSON.stringify({ ...summary, ...plan, mode: "apply" }, null, 2));
  } else {
    console.log(JSON.stringify({ ...summary, mode: "dry-run" }, null, 2));
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${resolve(process.argv[1])}`).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

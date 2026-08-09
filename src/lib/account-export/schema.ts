import packageMetadata from "../../../package.json";

export const ACCOUNT_EXPORT_SCHEMA_VERSION = 1;
export const ACCOUNT_EXPORT_FORMAT = "ultrapilot-account-export";
export const MAX_EXPORT_UNCOMPRESSED_BYTES = 250 * 1024 * 1024;
export const EXPORT_PAGE_SIZE = 100;
export const EXPORT_PARENT_ID_CHUNK_SIZE = 100;

export type ExportAreaFile =
  | "profile.json"
  | "training.json"
  | "activities.json"
  | "planning.json"
  | "recovery.json"
  | "nutrition.json"
  | "missions.json";

export type ExportTableSpec = {
  key: string;
  table: string;
  ownerField: "id" | "user_id";
  orderBy: string;
  selectFields: readonly string[];
  exportFields?: readonly string[];
  parent?: "activity" | "training_block";
  parentField?: "activity_id" | "block_id";
  pageSize?: number;
};

const profile: ExportTableSpec[] = [
  { key: "profiles", table: "profiles", ownerField: "id", orderBy: "id", selectFields: ["id", "display_name", "timezone", "max_heart_rate", "resting_heart_rate", "ftp_watts", "heart_rate_zone_method", "custom_heart_rate_boundaries", "custom_power_boundaries", "threshold_pace_seconds_per_km", "onboarding_completed_at", "created_at", "updated_at"] },
  { key: "healthShortcutMetadata", table: "health_shortcut_tokens", ownerField: "user_id", orderBy: "created_at", selectFields: ["user_id", "created_at", "last_used_at", "revoked_at"], exportFields: ["created_at", "last_used_at", "revoked_at"] },
];

const training: ExportTableSpec[] = [
  { key: "goals", table: "training_goals", ownerField: "user_id", orderBy: "user_id", selectFields: ["user_id", "event_name", "target_year", "target_date", "event_distance_km", "event_elevation_meters", "support_mode", "weekly_distance_goal_km", "created_at", "updated_at"] },
  { key: "preferences", table: "training_preferences", ownerField: "user_id", orderBy: "user_id", selectFields: ["user_id", "before_late_shift_allowed", "after_night_shift_allowed", "workday_max_session_minutes", "gym_summer_sessions", "gym_winter_sessions", "indoor_cycling_available_from", "strength_plan", "primary_sport", "running_sessions_per_week", "easy_run_with_cross_training", "updated_at"] },
  { key: "scheduleCodeMappings", table: "schedule_code_mappings", ownerField: "user_id", orderBy: "code", selectFields: ["user_id", "code", "event_kind", "updated_at"] },
];

const activities: ExportTableSpec[] = [
  { key: "activities", table: "activities", ownerField: "user_id", orderBy: "id", selectFields: ["id", "user_id", "sport_type", "activity_date", "title", "distance_meters", "moving_time_seconds", "elapsed_time_seconds", "elevation_gain_meters", "average_speed_kmh", "average_heart_rate", "maximum_heart_rate", "average_power", "normalized_power", "source", "external_id", "created_at", "updated_at"] },
  { key: "files", table: "activity_files", ownerField: "user_id", orderBy: "id", parent: "activity", parentField: "activity_id", selectFields: ["id", "activity_id", "user_id", "storage_path", "original_filename", "file_type", "mime_type", "size_bytes", "file_role", "source_device", "created_at"], exportFields: ["id", "activity_id", "user_id", "original_filename", "file_type", "mime_type", "size_bytes", "file_role", "source_device", "created_at"] },
  { key: "metrics", table: "activity_metrics", ownerField: "user_id", orderBy: "id", parent: "activity", parentField: "activity_id", selectFields: ["id", "activity_id", "user_id", "track_point_count", "heart_rate_sample_count", "calculation_version", "metrics", "calculated_at"] },
  { key: "streams", table: "activity_streams", ownerField: "user_id", orderBy: "id", parent: "activity", parentField: "activity_id", pageSize: 5, selectFields: ["id", "activity_id", "user_id", "stream_type", "source", "unit", "sample_count", "start_time", "end_time", "samples", "created_at"] },
  { key: "subjectiveFeedback", table: "subjective_feedback", ownerField: "user_id", orderBy: "id", parent: "activity", parentField: "activity_id", selectFields: ["id", "activity_id", "user_id", "perceived_exertion", "fatigue", "mood", "pain_notes", "notes", "stomach_tolerance", "sleep_quality", "created_at", "updated_at"] },
  { key: "aiAnalyses", table: "ai_analyses", ownerField: "user_id", orderBy: "id", parent: "activity", parentField: "activity_id", selectFields: ["id", "activity_id", "user_id", "status", "analysis", "created_at", "completed_at"] },
];

const planning: ExportTableSpec[] = [
  { key: "calendarEvents", table: "calendar_events", ownerField: "user_id", orderBy: "id", selectFields: ["id", "user_id", "event_key", "title", "event_kind", "starts_at", "ends_at", "all_day", "source", "imported_at"] },
  { key: "plannedWorkouts", table: "planned_workouts", ownerField: "user_id", orderBy: "id", selectFields: ["id", "user_id", "scheduled_date", "sport_type", "title", "description", "intensity", "planned_duration_minutes", "planned_distance_km", "status", "linked_activity_id", "source", "generation_id", "locked", "personal_note", "preferred_start_time", "target_heart_rate_zone", "target_power_zone", "created_at", "updated_at"] },
  { key: "planGenerations", table: "training_plan_generations", ownerField: "user_id", orderBy: "id", selectFields: ["id", "user_id", "week_start", "summary", "caution", "used_ai", "deterministic_snapshot", "created_at"] },
];

const recovery: ExportTableSpec[] = [
  { key: "appleHealthDailyMetrics", table: "apple_health_daily_metrics", ownerField: "user_id", orderBy: "metric_date", selectFields: ["user_id", "metric_date", "sleep_start", "sleep_end", "asleep_minutes", "core_minutes", "deep_minutes", "rem_minutes", "awake_minutes", "sleeping_average_heart_rate", "sleeping_minimum_heart_rate", "heart_rate_sample_count", "hrv_sdnn_ms", "hrv_sample_count", "resting_heart_rate", "source", "imported_at"] },
  { key: "dailyReadinessCheckins", table: "daily_readiness_checkins", ownerField: "user_id", orderBy: "checkin_date", selectFields: ["user_id", "checkin_date", "sleep_quality", "general_freshness", "leg_freshness", "motivation", "wellbeing", "symptom_level", "notes", "updated_at"] },
];

const nutrition: ExportTableSpec[] = [
  { key: "entries", table: "nutrition_entries", ownerField: "user_id", orderBy: "id", parent: "activity", parentField: "activity_id", selectFields: ["id", "activity_id", "user_id", "consumed_at_seconds", "description", "carbohydrates_grams", "fluid_milliliters", "sodium_milligrams", "calories", "product_id", "quantity", "entry_method", "bottle_plan_id", "created_at"] },
  { key: "products", table: "nutrition_products", ownerField: "user_id", orderBy: "id", selectFields: ["id", "user_id", "name", "category", "serving_label", "carbohydrates_grams", "fluid_milliliters", "sodium_milligrams", "calories", "barcode", "source", "confirmed_at", "created_at", "updated_at"] },
  { key: "bottlePlans", table: "nutrition_bottle_plans", ownerField: "user_id", orderBy: "id", parent: "activity", parentField: "activity_id", selectFields: ["id", "activity_id", "user_id", "name", "volume_milliliters", "carbohydrates_grams", "sodium_milligrams", "calories", "first_drink_seconds", "last_drink_seconds", "interval_minutes", "remaining_percent", "preset_id", "created_at"] },
  { key: "bottlePresets", table: "nutrition_bottle_presets", ownerField: "user_id", orderBy: "id", selectFields: ["id", "user_id", "name", "volume_milliliters", "carbohydrates_grams", "sodium_milligrams", "calories", "created_at", "updated_at"] },
];

const missions: ExportTableSpec[] = [
  { key: "missions", table: "missions", ownerField: "user_id", orderBy: "id", selectFields: ["id", "user_id", "source", "derived_key", "title", "description", "sport_type", "status", "target_date", "start_at", "distance_km", "elevation_meters", "average_speed_kmh", "pace_seconds_per_km", "stop_interval_km", "stop_duration_minutes", "carbohydrates_per_hour", "fluid_milliliters_per_hour", "sodium_milligrams_per_hour", "created_at", "updated_at"] },
  { key: "trainingBlocks", table: "training_blocks", ownerField: "user_id", orderBy: "id", selectFields: ["id", "user_id", "name", "block_type", "sport_type", "goal", "start_date", "end_date", "week_count", "base_weekly_distance_km", "starting_long_ride_km", "recovery_week_percentage", "status", "paused_at", "created_at", "completed_at"] },
  { key: "trainingBlockWeeks", table: "training_block_weeks", ownerField: "user_id", orderBy: "id", parent: "training_block", parentField: "block_id", selectFields: ["id", "block_id", "user_id", "week_number", "week_start", "phase", "target_distance_km", "long_ride_target_km", "tempo_session_target", "purpose"] },
];

export const ACCOUNT_EXPORT_FILES: ReadonlyArray<{ file: ExportAreaFile; specs: readonly ExportTableSpec[] }> = [
  { file: "profile.json", specs: profile },
  { file: "training.json", specs: training },
  { file: "activities.json", specs: activities },
  { file: "planning.json", specs: planning },
  { file: "recovery.json", specs: recovery },
  { file: "nutrition.json", specs: nutrition },
  { file: "missions.json", specs: missions },
];

export const ACCOUNT_EXPORT_AREAS = ["profile", "training", "activities", "planning", "recovery", "nutrition", "missions", "originalFiles"] as const;

export type MissingExportFile = {
  activityFileId: string;
  originalFilename: string;
  reason: "missing" | "unsafe-path" | "size-limit";
};

export function buildExportManifest(exportedAt: string, missingFiles: readonly MissingExportFile[]) {
  return {
    schemaVersion: ACCOUNT_EXPORT_SCHEMA_VERSION,
    exportedAt,
    exportFormat: ACCOUNT_EXPORT_FORMAT,
    appVersion: packageMetadata.version,
    includedAreas: ACCOUNT_EXPORT_AREAS,
    files: ["manifest.json", ...ACCOUNT_EXPORT_FILES.map((area) => area.file), "files/"],
    missingFiles,
  };
}

export function accountExportFilename(date: Date): string {
  return `ultrapilot-export-${date.toISOString().slice(0, 10)}.zip`;
}

export function isOwnedStoragePath(path: unknown, userId: string): path is string {
  if (typeof path !== "string" || path.includes("\\") || path.includes("\0")) return false;
  const parts = path.split("/");
  return parts.length >= 2 && parts[0] === userId && parts.every((part) => part !== "" && part !== "." && part !== "..");
}

export function safeArchiveFilename(value: unknown): string {
  const name = typeof value === "string" ? value : "activity-file";
  const sanitized = name.normalize("NFKC").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^[-.]+|[-.]+$/g, "");
  return sanitized.slice(0, 120) || "activity-file";
}

export function pickAllowedFields(row: Record<string, unknown>, fields: readonly string[]): Record<string, unknown> {
  return Object.fromEntries(fields.filter((field) => Object.hasOwn(row, field)).map((field) => [field, row[field]]));
}

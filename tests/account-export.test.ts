import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it, vi } from "vitest";
import {
  BackpressuredZipWriter,
  createAccountExportResponse,
  createSupabaseExportSource,
  type AccountExportSource,
  type ExportPageRequest,
} from "../src/lib/account-export/export";
import {
  ACCOUNT_EXPORT_AREAS,
  ACCOUNT_EXPORT_FILES,
  EXPORT_PARENT_ID_CHUNK_SIZE,
  isOwnedStoragePath,
} from "../src/lib/account-export/schema";

type Row = Record<string, unknown>;

function fakeSource(rows: Record<string, Row[]> = {}, files: Record<string, Blob | null> = {}) {
  const downloadActivityFile = vi.fn(async (path: string) => files[path] ?? null);
  const fetchPage = vi.fn(async ({ spec, userId, parentIds, offset, limit }: ExportPageRequest) => {
    const filtered = (rows[spec.table] ?? []).filter((row) => {
      if (row[spec.ownerField] !== userId) return false;
      return !spec.parentField || parentIds?.includes(String(row[spec.parentField]));
    });
    return filtered.slice(offset, offset + limit);
  });
  const source: AccountExportSource = {
    fetchPage,
    downloadActivityFile,
  };
  return { source, downloadActivityFile, fetchPage };
}

async function unzipResponse(response: Response) {
  const archive = unzipSync(new Uint8Array(await response.arrayBuffer()));
  return {
    archive,
    json(name: string) {
      return JSON.parse(strFromU8(archive[name])) as Record<string, unknown>;
    },
  };
}

describe("account data export", () => {
  it("covers every required user-data table exactly once", () => {
    const expectedTables = [
      "profiles", "training_goals", "training_preferences", "schedule_code_mappings",
      "activities", "activity_files", "activity_metrics", "activity_streams", "subjective_feedback", "ai_analyses",
      "nutrition_entries", "nutrition_products", "nutrition_bottle_plans", "nutrition_bottle_presets",
      "calendar_events", "planned_workouts", "training_plan_generations",
      "missions", "training_blocks", "training_block_weeks",
      "apple_health_daily_metrics", "daily_readiness_checkins", "health_shortcut_tokens",
    ].sort();
    const configuredTables = ACCOUNT_EXPORT_FILES.flatMap((area) => area.specs.map((spec) => spec.table)).sort();
    expect(configuredTables).toEqual(expectedTables);
    expect(new Set(configuredTables).size).toBe(configuredTables.length);
  });

  it("creates a valid empty export with every required area and safe headers", async () => {
    const { source } = fakeSource();
    const exportedAt = new Date("2026-08-10T12:00:00.000Z");
    const response = createAccountExportResponse(source, { id: "user-a", email: "a@example.com" }, { exportedAt });
    const zip = await unzipResponse(response);

    expect(response.headers.get("content-type")).toBe("application/zip");
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="ultrapilot-export-2026-08-10.zip"');
    expect(zip.json("manifest.json")).toMatchObject({ schemaVersion: 1, includedAreas: [...ACCOUNT_EXPORT_AREAS] });
    for (const area of ACCOUNT_EXPORT_FILES) expect(() => zip.json(area.file)).not.toThrow();
  });

  it("filters foreign rows and child rows whose activity does not belong to the user", async () => {
    const { source } = fakeSource({
      activities: [
        { id: "activity-a", user_id: "user-a", title: "Own" },
        { id: "activity-b", user_id: "user-b", title: "Foreign" },
      ],
      activity_metrics: [
        { id: "metric-a", activity_id: "activity-a", user_id: "user-a", metrics: { own: true } },
        { id: "metric-b", activity_id: "activity-b", user_id: "user-a", metrics: { foreignParent: true } },
        { id: "metric-c", activity_id: "activity-a", user_id: "user-b", metrics: { foreignOwner: true } },
      ],
    });
    const zip = await unzipResponse(createAccountExportResponse(source, { id: "user-a", email: null }));
    const activities = zip.json("activities.json") as { activities: Row[]; metrics: Row[] };
    expect(activities.activities.map((row) => row.id)).toEqual(["activity-a"]);
    expect(activities.metrics.map((row) => row.id)).toEqual(["metric-a"]);
    expect(JSON.stringify(activities)).not.toContain("Foreign");
  });

  it("never exports token hashes, token hints or excluded technical AI fields", async () => {
    const { source } = fakeSource({
      health_shortcut_tokens: [{ user_id: "user-a", token_hash: "secret-hash", token_hint: "secret", created_at: "2026-01-01", last_used_at: null, revoked_at: null }],
      activities: [{ id: "activity-a", user_id: "user-a" }],
      ai_analyses: [{ id: "ai-a", activity_id: "activity-a", user_id: "user-a", status: "completed", analysis: { result: "ok" }, model: "internal-model", prompt_version: "secret-prompt", error_message: "raw" }],
    });
    const zip = await unzipResponse(createAccountExportResponse(source, { id: "user-a", email: null }));
    const serialized = Object.values(zip.archive).map((value) => strFromU8(value)).join("\n");
    expect(serialized).not.toContain("secret-hash");
    expect(serialized).not.toContain("token_hint");
    expect(serialized).not.toContain("internal-model");
    expect(serialized).not.toContain("secret-prompt");
    expect(serialized).not.toContain('"error_message"');
  });

  it("paginates large stream collections without silently truncating them", async () => {
    const streams = Array.from({ length: 12 }, (_, index) => ({ id: `stream-${index}`, activity_id: "activity-a", user_id: "user-a", stream_type: "heart_rate", samples: [{ timestamp: index, value: 100 + index }] }));
    const { source } = fakeSource({ activities: [{ id: "activity-a", user_id: "user-a" }], activity_streams: streams });
    const zip = await unzipResponse(createAccountExportResponse(source, { id: "user-a", email: null }));
    const activities = zip.json("activities.json") as { streams: Row[] };
    expect(activities.streams).toHaveLength(12);
    expect(activities.streams.at(-1)?.id).toBe("stream-11");
  });

  it("queries child tables in deterministic parent chunks and deduplicates returned rows", async () => {
    const activities = Array.from({ length: EXPORT_PARENT_ID_CHUNK_SIZE * 2 + 5 }, (_, index) => ({
      id: `activity-${String(index).padStart(3, "0")}`,
      user_id: "user-a",
    }));
    const metrics = activities.map((activity, index) => ({
      id: `metric-${String(index).padStart(3, "0")}`,
      activity_id: activity.id,
      user_id: "user-a",
      metrics: { index },
    }));
    const { source, fetchPage } = fakeSource({ activities, activity_metrics: metrics });

    const zip = await unzipResponse(createAccountExportResponse(source, { id: "user-a", email: null }));
    const exported = zip.json("activities.json") as { metrics: Row[] };
    const metricCalls = fetchPage.mock.calls
      .map(([request]) => request)
      .filter((request) => request.spec.table === "activity_metrics" && request.offset === 0);

    expect(metricCalls.map((request) => request.parentIds?.length)).toEqual([100, 100, 5]);
    expect(metricCalls.flatMap((request) => request.parentIds ?? [])).toEqual(activities.map((activity) => activity.id));
    expect(exported.metrics).toHaveLength(metrics.length);
    expect(new Set(exported.metrics.map((row) => row.id)).size).toBe(metrics.length);
  });

  it("queries training block weeks only through verified own block ids", async () => {
    const { source, fetchPage } = fakeSource({
      training_blocks: [
        { id: "block-a", user_id: "user-a", name: "Own" },
        { id: "block-b", user_id: "user-b", name: "Foreign" },
      ],
      training_block_weeks: [
        { id: "week-a", block_id: "block-a", user_id: "user-a", week_number: 1 },
        { id: "week-b", block_id: "block-b", user_id: "user-a", week_number: 1 },
      ],
    });

    const zip = await unzipResponse(createAccountExportResponse(source, { id: "user-a", email: null }));
    const missions = zip.json("missions.json") as { trainingBlockWeeks: Row[] };
    const weekCalls = fetchPage.mock.calls
      .map(([request]) => request)
      .filter((request) => request.spec.table === "training_block_weeks");

    expect(weekCalls.map((request) => request.parentIds)).toEqual([["block-a"]]);
    expect(missions.trainingBlockWeeks.map((row) => row.id)).toEqual(["week-a"]);
  });

  it("does not query child tables when no verified parent ids exist", async () => {
    const { source, fetchPage } = fakeSource();
    await unzipResponse(createAccountExportResponse(source, { id: "user-a", email: null }));

    const queriedTables = fetchPage.mock.calls.map(([request]) => request.spec.table);
    expect(queriedTables).not.toContain("activity_metrics");
    expect(queriedTables).not.toContain("training_block_weeks");
  });

  it("applies verified user, parent chunks and abort signals in the Supabase source", async () => {
    const builder: Record<string, ReturnType<typeof vi.fn>> = {};
    builder.select = vi.fn(() => builder);
    builder.eq = vi.fn(() => builder);
    builder.in = vi.fn(() => builder);
    builder.order = vi.fn(() => builder);
    builder.range = vi.fn(() => builder);
    builder.abortSignal = vi.fn(async () => ({ data: [], error: null }));
    const download = vi.fn(async () => ({ data: new Blob(["file"]), error: null }));
    const supabase = {
      from: vi.fn(() => builder),
      storage: { from: vi.fn(() => ({ download })) },
    };
    const source = createSupabaseExportSource(supabase as never);
    const activityFileSpec = ACCOUNT_EXPORT_FILES.flatMap((area) => area.specs)
      .find((spec) => spec.table === "activity_files")!;
    const signal = new AbortController().signal;

    await source.fetchPage({
      spec: activityFileSpec,
      userId: "user-a",
      parentIds: ["activity-a", "activity-b"],
      offset: 100,
      limit: 100,
      signal,
    });
    await source.downloadActivityFile("user-a/file.fit", signal);

    expect(builder.eq).toHaveBeenCalledWith("user_id", "user-a");
    expect(builder.in).toHaveBeenCalledWith("activity_id", ["activity-a", "activity-b"]);
    expect(builder.range).toHaveBeenCalledWith(100, 199);
    expect(builder.abortSignal).toHaveBeenCalledWith(signal);
    expect(download).toHaveBeenCalledWith("user-a/file.fit", {}, { signal });
  });

  it("keeps the post-query parent and owner checks against manipulated source responses", async () => {
    const source: AccountExportSource = {
      async fetchPage({ spec, offset }) {
        if (offset > 0) return [];
        if (spec.table === "activities") return [{ id: "activity-a", user_id: "user-a" }];
        if (spec.table === "activity_metrics") return [
          { id: "foreign-parent", activity_id: "activity-b", user_id: "user-a", metrics: { leaked: true } },
          { id: "foreign-owner", activity_id: "activity-a", user_id: "user-b", metrics: { leaked: true } },
        ];
        return [];
      },
      downloadActivityFile: async () => null,
    };

    const zip = await unzipResponse(createAccountExportResponse(source, { id: "user-a", email: null }));
    const activities = zip.json("activities.json") as { metrics: Row[] };
    expect(activities.metrics).toEqual([]);
  });

  it("does not advance the producer while ZIP output is backpressured", async () => {
    const { source, fetchPage } = fakeSource({ profiles: [{ id: "user-a", email: "a@example.com" }] });
    const response = createAccountExportResponse(source, { id: "user-a", email: "a@example.com" });

    await new Promise((resolve) => setTimeout(resolve, 10));
    const callsWhileBlocked = fetchPage.mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(callsWhileBlocked).toBeGreaterThan(0);
    expect(fetchPage).toHaveBeenCalledTimes(callsWhileBlocked);
    expect(callsWhileBlocked).toBeLessThan(ACCOUNT_EXPORT_FILES.flatMap((area) => area.specs).length);

    await unzipResponse(response);
    expect(fetchPage).toHaveBeenCalled();
  });

  it("waits for writer readiness and aborts instead of closing after a writer failure", async () => {
    let releaseReady: (() => void) | undefined;
    const ready = new Promise<void>((resolve) => { releaseReady = resolve; });
    const writer = {
      ready,
      write: vi.fn(async () => { throw new Error("sink failed"); }),
      close: vi.fn(async () => undefined),
      abort: vi.fn(async () => undefined),
    };
    const bridge = new BackpressuredZipWriter(writer, new AbortController().signal);
    bridge.enqueue(null, new Uint8Array([1, 2, 3]), false);
    const flushed = bridge.flush();

    await Promise.resolve();
    expect(writer.write).not.toHaveBeenCalled();
    releaseReady?.();
    await expect(flushed).rejects.toThrow("sink failed");
    await bridge.abort(new Error("sink failed"));
    expect(writer.abort).toHaveBeenCalledOnce();
    expect(writer.close).not.toHaveBeenCalled();
  });

  it("stops pagination immediately when the request is aborted", async () => {
    const abortController = new AbortController();
    const fetchPage = vi.fn(async ({ spec }: ExportPageRequest) => {
      if (spec.table === "profiles") {
        abortController.abort();
        return Array.from({ length: 100 }, (_, index) => ({ id: `profile-${index}`, user_id: "user-a" }));
      }
      return [];
    });
    const source: AccountExportSource = { fetchPage, downloadActivityFile: async () => null };
    const response = createAccountExportResponse(source, { id: "user-a", email: null }, { signal: abortController.signal });

    await expect(response.arrayBuffer()).rejects.toThrow("Der Datenexport konnte nicht erstellt werden.");
    expect(fetchPage).toHaveBeenCalledOnce();
  });

  it("unblocks a backpressure wait when the request is aborted", async () => {
    const abortController = new AbortController();
    const { source, fetchPage } = fakeSource({ profiles: [{ id: "user-a" }] });
    const response = createAccountExportResponse(source, { id: "user-a", email: null }, { signal: abortController.signal });
    await new Promise((resolve) => setTimeout(resolve, 10));
    const callsBeforeAbort = fetchPage.mock.calls.length;

    abortController.abort();
    await expect(response.arrayBuffer()).rejects.toThrow("Der Datenexport konnte nicht erstellt werden.");
    expect(fetchPage).toHaveBeenCalledTimes(callsBeforeAbort);
  });

  it("cancels the active file reader and starts no later file after abort", async () => {
    const abortController = new AbortController();
    const cancel = vi.fn(async () => undefined);
    let sent = false;
    const fileBlob = {
      size: 3,
      stream: () => new ReadableStream<Uint8Array>({
        pull(controller) {
          if (sent) return;
          sent = true;
          controller.enqueue(new Uint8Array([1, 2, 3]));
          abortController.abort();
        },
        cancel,
      }),
    } as Blob;
    const { source, downloadActivityFile } = fakeSource({
      activities: [{ id: "activity-a", user_id: "user-a" }],
      activity_files: [
        { id: "file-a", activity_id: "activity-a", user_id: "user-a", storage_path: "user-a/a.fit", original_filename: "a.fit", file_type: "fit", file_role: "primary" },
        { id: "file-b", activity_id: "activity-a", user_id: "user-a", storage_path: "user-a/b.fit", original_filename: "b.fit", file_type: "fit", file_role: "primary" },
      ],
    }, { "user-a/a.fit": fileBlob, "user-a/b.fit": new Blob(["later"]) });
    const response = createAccountExportResponse(source, { id: "user-a", email: null }, { signal: abortController.signal });

    await expect(response.arrayBuffer()).rejects.toThrow("Der Datenexport konnte nicht erstellt werden.");
    expect(cancel).toHaveBeenCalled();
    expect(downloadActivityFile).toHaveBeenCalledTimes(1);
  });

  it("includes own GPX/FIT files, rejects foreign paths and records missing files", async () => {
    const { source, downloadActivityFile } = fakeSource({
      activities: [{ id: "activity-a", user_id: "user-a" }],
      activity_files: [
        { id: "file-gpx", activity_id: "activity-a", user_id: "user-a", storage_path: "user-a/ride.gpx", original_filename: "ride.gpx", file_type: "gpx", file_role: "primary" },
        { id: "file-fit", activity_id: "activity-a", user_id: "user-a", storage_path: "user-a/watch.fit", original_filename: "watch.fit", file_type: "fit", file_role: "heart_rate_supplement" },
        { id: "file-foreign", activity_id: "activity-a", user_id: "user-a", storage_path: "user-b/private.fit", original_filename: "private.fit", file_type: "fit", file_role: "primary" },
        { id: "file-missing", activity_id: "activity-a", user_id: "user-a", storage_path: "user-a/missing.fit", original_filename: "missing.fit", file_type: "fit", file_role: "primary" },
      ],
    }, {
      "user-a/ride.gpx": new Blob(["<gpx />"]),
      "user-a/watch.fit": new Blob([new Uint8Array([1, 2, 3])]),
      "user-a/missing.fit": null,
    });
    const zip = await unzipResponse(createAccountExportResponse(source, { id: "user-a", email: null }));
    const names = Object.keys(zip.archive);
    expect(names.some((name) => name.endsWith("ride.gpx"))).toBe(true);
    expect(names.some((name) => name.endsWith("watch.fit"))).toBe(true);
    expect(downloadActivityFile).not.toHaveBeenCalledWith("user-b/private.fit", expect.any(AbortSignal));
    expect(zip.json("manifest.json").missingFiles).toEqual(expect.arrayContaining([
      expect.objectContaining({ activityFileId: "file-foreign", reason: "unsafe-path" }),
      expect.objectContaining({ activityFileId: "file-missing", reason: "missing" }),
    ]));
  });

  it("replaces raw database failures with a general export error", async () => {
    const source: AccountExportSource = {
      fetchPage: async () => { throw new Error("raw database table detail"); },
      downloadActivityFile: async () => null,
    };
    const response = createAccountExportResponse(source, { id: "user-a", email: null });
    let failure: unknown;
    try { await response.arrayBuffer(); } catch (error) { failure = error; }
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toContain("Der Datenexport konnte nicht erstellt werden.");
    expect((failure as Error).message).not.toContain("raw database");
  });

  it.each([
    ["user-a/file.gpx", "user-a", true],
    ["user-b/file.gpx", "user-a", false],
    ["user-a/../user-b/file.gpx", "user-a", false],
    ["user-a\\file.gpx", "user-a", false],
  ] as const)("validates storage path %s", (path, userId, expected) => {
    expect(isOwnedStoragePath(path, userId)).toBe(expected);
  });
});

import type { SupabaseClient } from "@supabase/supabase-js";
import { Zip, ZipDeflate, ZipPassThrough } from "fflate";
import {
  ACCOUNT_EXPORT_FILES,
  EXPORT_PAGE_SIZE,
  EXPORT_PARENT_ID_CHUNK_SIZE,
  MAX_EXPORT_UNCOMPRESSED_BYTES,
  accountExportFilename,
  buildExportManifest,
  isOwnedStoragePath,
  pickAllowedFields,
  safeArchiveFilename,
  type ExportTableSpec,
  type MissingExportFile,
} from "./schema";

type ExportRow = Record<string, unknown>;

export type ExportPageRequest = {
  spec: ExportTableSpec;
  userId: string;
  parentIds: readonly string[] | null;
  offset: number;
  limit: number;
  signal: AbortSignal;
};

export type AccountExportSource = {
  fetchPage: (request: ExportPageRequest) => Promise<ExportRow[]>;
  downloadActivityFile: (path: string, signal: AbortSignal) => Promise<Blob | null>;
};

type ExportIdentity = { id: string; email: string | null };
type StoredActivityFile = { id: string; activityId: string; path: string; originalFilename: string; fileType: "gpx" | "fit"; fileRole: string };
type AccountExportOptions = { exportedAt?: Date; signal?: AbortSignal };
type ZipWriter = Pick<WritableStreamDefaultWriter<Uint8Array>, "abort" | "close" | "ready" | "write">;

class ExportSizeError extends Error {}

function isRecord(value: unknown): value is ExportRow {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function abortError(): DOMException {
  return new DOMException("Der Datenexport wurde abgebrochen.", "AbortError");
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw abortError();
}

function publicExportError(error: unknown): Error {
  if (error instanceof Error && error.message === "Der Datenexport überschreitet die maximale Größe von 250 MB.") {
    return new Error(error.message);
  }
  return new Error("Der Datenexport konnte nicht erstellt werden.");
}

function chunkIds(ids: ReadonlySet<string>): string[][] {
  const sorted = [...ids].sort();
  const chunks: string[][] = [];
  for (let index = 0; index < sorted.length; index += EXPORT_PARENT_ID_CHUNK_SIZE) {
    chunks.push(sorted.slice(index, index + EXPORT_PARENT_ID_CHUNK_SIZE));
  }
  return chunks;
}

export class BackpressuredZipWriter {
  private pending = Promise.resolve();
  private callbackError: Error | null = null;
  private finalChunkSeen = false;

  constructor(private readonly writer: ZipWriter, private readonly signal: AbortSignal) {}

  enqueue(error: Error | null, chunk: Uint8Array, final: boolean): void {
    if (error) {
      this.callbackError = new Error("Der Datenexport konnte nicht erstellt werden.");
      return;
    }
    if (chunk.length) {
      const output = chunk.slice();
      this.pending = this.pending.then(async () => {
        throwIfAborted(this.signal);
        await this.writer.ready;
        throwIfAborted(this.signal);
        await this.writer.write(output);
      });
    }
    if (final) this.finalChunkSeen = true;
  }

  async flush(): Promise<void> {
    if (this.callbackError) throw this.callbackError;
    await this.pending;
    if (this.callbackError) throw this.callbackError;
  }

  async close(): Promise<void> {
    await this.flush();
    if (!this.finalChunkSeen) throw new Error("Der Datenexport konnte nicht erstellt werden.");
    await this.writer.ready;
    await this.writer.close();
  }

  async abort(reason: unknown): Promise<void> {
    const safeReason = reason instanceof ExportSizeError
      ? new Error("Der Datenexport überschreitet die maximale Größe von 250 MB.")
      : abortError();
    try {
      await this.writer.abort(safeReason);
    } catch {
      // The consumer or stream may already have closed the writer.
    }
  }
}

export function createSupabaseExportSource(supabase: SupabaseClient): AccountExportSource {
  return {
    async fetchPage({ spec, userId, parentIds, offset, limit, signal }) {
      throwIfAborted(signal);
      if (spec.parent && (!parentIds || parentIds.length === 0)) return [];

      let query = supabase
        .from(spec.table)
        .select(spec.selectFields.join(","))
        .eq(spec.ownerField, userId);
      if (spec.parentField && parentIds) query = query.in(spec.parentField, [...parentIds]);

      const { data, error } = await query
        .order(spec.orderBy, { ascending: true })
        .range(offset, offset + limit - 1)
        .abortSignal(signal);
      throwIfAborted(signal);
      if (error) throw new Error("ACCOUNT_EXPORT_DATABASE_UNAVAILABLE");
      const rows: unknown = data;
      return Array.isArray(rows) ? rows.filter(isRecord) : [];
    },
    async downloadActivityFile(path, signal) {
      throwIfAborted(signal);
      const { data, error } = await supabase.storage.from("activity-files").download(path, {}, { signal });
      throwIfAborted(signal);
      return error || !data ? null : data;
    },
  };
}

function utf8(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function ownsRow(
  row: ExportRow,
  spec: ExportTableSpec,
  identity: ExportIdentity,
  activityIds: Set<string>,
  blockIds: Set<string>,
  parentIds: readonly string[] | null,
): boolean {
  if (row[spec.ownerField] !== identity.id) return false;
  if (!spec.parent || !spec.parentField) return true;
  const parentId = row[spec.parentField];
  if (typeof parentId !== "string" || !parentIds?.includes(parentId)) return false;
  return spec.parent === "activity" ? activityIds.has(parentId) : blockIds.has(parentId);
}

function createOutputStream(
  source: AccountExportSource,
  identity: ExportIdentity,
  exportedAt: Date,
  requestSignal?: AbortSignal,
): ReadableStream<Uint8Array> {
  const exportController = new AbortController();
  const signal = exportController.signal;
  const output = new TransformStream<Uint8Array, Uint8Array>();
  const outputWriter = output.writable.getWriter();
  const outputReader = output.readable.getReader();
  const bridge = new BackpressuredZipWriter(outputWriter, signal);
  let zip: Zip | null = null;
  let activeFileReader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  const abortExport = () => exportController.abort(abortError());
  if (requestSignal?.aborted) abortExport();
  else requestSignal?.addEventListener("abort", abortExport, { once: true });

  const cancelActiveFileReader = () => {
    if (activeFileReader) void activeFileReader.cancel(abortError()).catch(() => undefined);
  };
  const abortOutputWriter = () => {
    void bridge.abort(abortError());
  };
  signal.addEventListener("abort", cancelActiveFileReader);
  signal.addEventListener("abort", abortOutputWriter);

  const producer = async () => {
    zip = new Zip((error, chunk, final) => bridge.enqueue(error, chunk, final));
    const activityIds = new Set<string>();
    const blockIds = new Set<string>();
    const storedFiles: StoredActivityFile[] = [];
    const missingFiles: MissingExportFile[] = [];
    let uncompressedBytes = 0;

    const countBytes = (chunk: Uint8Array) => {
      uncompressedBytes += chunk.byteLength;
      if (uncompressedBytes > MAX_EXPORT_UNCOMPRESSED_BYTES) throw new ExportSizeError();
    };

    const syncZip = async (operation: () => void) => {
      throwIfAborted(signal);
      operation();
      await bridge.flush();
      throwIfAborted(signal);
    };

    const writeJsonArea = async (file: string, specs: readonly ExportTableSpec[]) => {
      const entry = new ZipDeflate(file, { level: 6 });
      await syncZip(() => zip!.add(entry));
      const pushText = async (text: string) => {
        const chunk = utf8(text);
        countBytes(chunk);
        await syncZip(() => entry.push(chunk));
      };
      await pushText(`{\n  "schemaVersion": 1,\n  "account": ${JSON.stringify({ id: identity.id, email: identity.email })}`);
      for (const spec of specs) {
        throwIfAborted(signal);
        await pushText(`,\n  ${JSON.stringify(spec.key)}: [`);
        let first = true;
        const pageSize = spec.pageSize ?? EXPORT_PAGE_SIZE;
        const parentSet = spec.parent === "activity" ? activityIds : spec.parent === "training_block" ? blockIds : null;
        const parentChunks: Array<readonly string[] | null> = parentSet ? chunkIds(parentSet) : [null];
        const seenIds = new Set<string>();

        for (const parentIds of parentChunks) {
          for (let offset = 0; ; offset += pageSize) {
            throwIfAborted(signal);
            const rows = await source.fetchPage({ spec, userId: identity.id, parentIds, offset, limit: pageSize, signal });
            throwIfAborted(signal);
            for (const row of rows) {
              if (!ownsRow(row, spec, identity, activityIds, blockIds, parentIds)) continue;
              const id = row.id;
              if (typeof id === "string" && seenIds.has(id)) continue;
              if (typeof id === "string") seenIds.add(id);
              if (spec.table === "activities" && typeof id === "string") activityIds.add(id);
              if (spec.table === "training_blocks" && typeof id === "string") blockIds.add(id);
              if (spec.table === "activity_files" && typeof id === "string" && typeof row.activity_id === "string") {
                const originalFilename = typeof row.original_filename === "string" ? row.original_filename : "activity-file";
                if (!isOwnedStoragePath(row.storage_path, identity.id)) {
                  missingFiles.push({ activityFileId: id, originalFilename, reason: "unsafe-path" });
                } else if (row.file_type === "gpx" || row.file_type === "fit") {
                  storedFiles.push({
                    id,
                    activityId: row.activity_id,
                    path: row.storage_path,
                    originalFilename,
                    fileType: row.file_type,
                    fileRole: typeof row.file_role === "string" ? row.file_role : "primary",
                  });
                }
              }
              const allowed = pickAllowedFields(row, spec.exportFields ?? spec.selectFields);
              await pushText(`${first ? "" : ","}\n    ${JSON.stringify(allowed)}`);
              first = false;
            }
            if (rows.length < pageSize) break;
          }
        }
        await pushText(first ? "]" : "\n  ]");
      }
      await pushText("\n}\n");
      await syncZip(() => entry.push(new Uint8Array(), true));
    };

    try {
      for (const area of ACCOUNT_EXPORT_FILES) await writeJsonArea(area.file, area.specs);

      for (const file of storedFiles) {
        throwIfAborted(signal);
        const blob = await source.downloadActivityFile(file.path, signal);
        throwIfAborted(signal);
        if (!blob) {
          missingFiles.push({ activityFileId: file.id, originalFilename: file.originalFilename, reason: "missing" });
          continue;
        }
        if (uncompressedBytes + blob.size > MAX_EXPORT_UNCOMPRESSED_BYTES) {
          missingFiles.push({ activityFileId: file.id, originalFilename: file.originalFilename, reason: "size-limit" });
          continue;
        }
        const archiveName = `files/${file.activityId}/${safeArchiveFilename(file.fileRole)}-${file.id}-${safeArchiveFilename(file.originalFilename)}`;
        const entry = new ZipPassThrough(archiveName);
        await syncZip(() => zip!.add(entry));
        activeFileReader = blob.stream().getReader();
        try {
          for (;;) {
            throwIfAborted(signal);
            const { value, done } = await activeFileReader.read();
            throwIfAborted(signal);
            if (done) break;
            countBytes(value);
            await syncZip(() => entry.push(value));
          }
          await syncZip(() => entry.push(new Uint8Array(), true));
        } finally {
          if (signal.aborted) await activeFileReader.cancel(abortError()).catch(() => undefined);
          activeFileReader.releaseLock();
          activeFileReader = null;
        }
      }

      const manifest = utf8(`${JSON.stringify(buildExportManifest(exportedAt.toISOString(), missingFiles), null, 2)}\n`);
      countBytes(manifest);
      const manifestEntry = new ZipDeflate("manifest.json", { level: 6 });
      await syncZip(() => zip!.add(manifestEntry));
      await syncZip(() => manifestEntry.push(manifest, true));
      await syncZip(() => zip!.end());
      await bridge.close();
    } catch (error: unknown) {
      zip?.terminate();
      await bridge.abort(error);
    } finally {
      requestSignal?.removeEventListener("abort", abortExport);
      signal.removeEventListener("abort", cancelActiveFileReader);
      signal.removeEventListener("abort", abortOutputWriter);
      outputWriter.releaseLock();
    }
  };

  void producer().catch(async (error: unknown) => {
    zip?.terminate();
    await bridge.abort(error);
  });

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await outputReader.read();
        if (done) controller.close();
        else controller.enqueue(value);
      } catch (error: unknown) {
        controller.error(publicExportError(error));
      }
    },
    async cancel(reason) {
      exportController.abort(abortError());
      await outputReader.cancel(reason).catch(() => undefined);
    },
  });
}

export function createAccountExportStream(
  source: AccountExportSource,
  identity: ExportIdentity,
  exportedAt: Date,
  signal?: AbortSignal,
): ReadableStream<Uint8Array> {
  return createOutputStream(source, identity, exportedAt, signal);
}

export function createAccountExportResponse(
  source: AccountExportSource,
  identity: ExportIdentity,
  options: AccountExportOptions = {},
): Response {
  const exportedAt = options.exportedAt ?? new Date();
  return new Response(createAccountExportStream(source, identity, exportedAt, options.signal), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="${accountExportFilename(exportedAt)}"`,
      "Content-Type": "application/zip",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

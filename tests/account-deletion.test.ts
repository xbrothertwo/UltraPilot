import { describe, expect, it, vi } from "vitest";
import {
  AccountDeletionFailure,
  cleanupAccountStorage,
  isSafeOwnedStoragePath,
  processClaimedAccountDeletionJob,
  type AccountDeletionBackend,
  type AccountDeletionJob,
} from "../src/lib/account-deletion";

function job(overrides: Partial<AccountDeletionJob> = {}): AccountDeletionJob {
  return {
    id: "job-a",
    user_id: "user-a",
    status: "deleting_storage",
    attempt_count: 1,
    last_error_code: null,
    reauthenticated_at: "2026-08-11T00:00:00.000Z",
    sessions_revoked_at: "2026-08-11T00:00:01.000Z",
    lease_token: "lease-a",
    lease_generation: 1,
    ...overrides,
  };
}

function storageBackend(initialFiles: string[], knownPaths: string[] = initialFiles) {
  const files = new Set(initialFiles);
  const removed: string[][] = [];
  const listCalls: string[] = [];
  const updates: Array<Record<string, unknown>> = [];
  const backend: AccountDeletionBackend = {
    listKnownActivityPaths: vi.fn(async () => knownPaths),
    listStorageFolder: vi.fn(async (folder) => {
      listCalls.push(folder);
      const children = new Map<string, boolean>();
      for (const path of files) {
        if (!path.startsWith(`${folder}/`)) continue;
        const remainder = path.slice(folder.length + 1);
        const [name, ...rest] = remainder.split("/");
        children.set(name, rest.length === 0);
      }
      return [...children].sort(([left], [right]) => left.localeCompare(right)).map(([name, file]) => ({ id: file ? `id-${name}` : null, name }));
    }),
    removeStoragePaths: vi.fn(async (paths) => {
      removed.push(paths);
      for (const path of paths) files.delete(path);
    }),
    authUserExists: vi.fn(async () => true),
    deleteAuthUser: vi.fn(async () => undefined),
    deleteCompletedJob: vi.fn(async () => undefined),
    transitionJob: vi.fn(async (jobId, leaseToken, leaseGeneration, expectedStatus, newStatus, errorCode, nextAttemptAt) => {
      updates.push({ jobId, leaseToken, leaseGeneration, expectedStatus, newStatus, errorCode, nextAttemptAt });
      return true;
    }),
    beginAuthDelete: vi.fn(async (_jobId, leaseToken, leaseGeneration) => ({
      userId: "user-a",
      leaseToken,
      leaseGeneration,
      leaseExpiresAt: "2026-08-11T00:15:00.000Z",
    })),
  };
  return { backend, files, removed, listCalls, updates };
}

describe("account deletion storage and state machine", () => {
  it.each([
    ["user-a/file.fit", true],
    ["user-a/nested/file.fit", true],
    ["user-b/file.fit", false],
    ["user-a/../user-b/file.fit", false],
    ["user-a\\file.fit", false],
    ["/user-a/file.fit", false],
  ] as const)("validates owned path %s", (path, expected) => {
    expect(isSafeOwnedStoragePath(path, "user-a")).toBe(expected);
  });

  it("removes known and orphaned own files, including nested files, and verifies the folder", async () => {
    const context = storageBackend(
      ["user-a/known.fit", "user-a/orphan.gpx", "user-a/nested/watch.fit"],
      ["user-a/known.fit", "user-b/foreign.fit", "user-a/../unsafe.fit"],
    );
    await cleanupAccountStorage(context.backend, "user-a");

    expect(context.files.size).toBe(0);
    expect(context.removed.flat()).toEqual(expect.arrayContaining([
      "user-a/known.fit",
      "user-a/orphan.gpx",
      "user-a/nested/watch.fit",
    ]));
    expect(context.removed.flat()).not.toContain("user-b/foreign.fit");
    expect(context.listCalls.filter((folder) => folder === "user-a").length).toBeGreaterThan(1);
  });

  it("removes at most 1000 paths per call", async () => {
    const paths = Array.from({ length: 1001 }, (_, index) => `user-a/file-${index}.fit`);
    const context = storageBackend([], paths);
    await cleanupAccountStorage(context.backend, "user-a");
    expect(context.removed.map((batch) => batch.length)).toEqual([1000, 1]);
  });

  it("treats a known but already missing file as deleted", async () => {
    const context = storageBackend([], ["user-a/missing.fit"]);
    await cleanupAccountStorage(context.backend, "user-a");
    expect(context.removed).toEqual([["user-a/missing.fit"]]);
  });

  it("does not delete the Auth user until storage is confirmed empty", async () => {
    const context = storageBackend(["user-a/file.fit"]);
    const events: string[] = [];
    context.backend.removeStoragePaths = vi.fn(async (paths) => {
      events.push("storage");
      for (const path of paths) context.files.delete(path);
    });
    context.backend.authUserExists = vi.fn(async () => { events.push("auth-check"); return true; });
    context.backend.deleteAuthUser = vi.fn(async (userId) => { events.push(`delete:${userId}`); });

    const result = await processClaimedAccountDeletionJob(context.backend, job());
    expect(result).toEqual({ outcome: "completed" });
    expect(events).toEqual(["storage", "auth-check", "delete:user-a"]);
    expect(context.updates.at(-1)).toMatchObject({ expectedStatus: "deleting_auth", newStatus: "completed" });
    expect(context.backend.deleteCompletedJob).toHaveBeenCalledWith("job-a", "user-a");
  });

  it("treats an already missing Auth user as an idempotent success", async () => {
    const context = storageBackend([]);
    context.backend.authUserExists = vi.fn(async () => false);
    const result = await processClaimedAccountDeletionJob(context.backend, job({ status: "deleting_auth" }));
    expect(result.outcome).toBe("completed");
    expect(context.backend.deleteAuthUser).not.toHaveBeenCalled();
  });

  it("keeps an Auth provider failure retryable", async () => {
    const context = storageBackend([]);
    context.backend.authUserExists = vi.fn(async () => { throw new AccountDeletionFailure("auth_delete_failed"); });
    const result = await processClaimedAccountDeletionJob(context.backend, job({ status: "deleting_auth", attempt_count: 3 }));
    expect(result).toEqual({ outcome: "failed", errorCode: "auth_delete_failed" });
    expect(context.updates.at(-1)).toMatchObject({ expectedStatus: "deleting_auth", newStatus: "failed", errorCode: "auth_delete_failed" });
  });

  it("keeps storage failures retryable and never calls deleteUser", async () => {
    const context = storageBackend(["user-a/file.fit"]);
    context.backend.removeStoragePaths = vi.fn(async () => { throw new AccountDeletionFailure("storage_delete_failed"); });
    const result = await processClaimedAccountDeletionJob(context.backend, job());
    expect(result).toEqual({ outcome: "failed", errorCode: "storage_delete_failed" });
    expect(context.backend.deleteAuthUser).not.toHaveBeenCalled();
    expect(context.updates.at(-1)).toMatchObject({ expectedStatus: "deleting_storage", newStatus: "failed", errorCode: "storage_delete_failed" });
    expect(JSON.stringify(context.updates)).not.toContain("provider detail");
  });

  it("refuses Auth deletion while an unsafe non-empty folder result remains", async () => {
    const context = storageBackend([]);
    context.backend.listStorageFolder = vi.fn(async () => [{ id: "unsafe", name: ".." }]);
    const result = await processClaimedAccountDeletionJob(context.backend, job());
    expect(result).toEqual({ outcome: "failed", errorCode: "storage_not_empty" });
    expect(context.backend.deleteAuthUser).not.toHaveBeenCalled();
  });

  it("rejects jobs without revoked sessions and protects every update with the lease", async () => {
    const context = storageBackend([]);
    expect(await processClaimedAccountDeletionJob(context.backend, job({ sessions_revoked_at: null })))
      .toEqual({ outcome: "failed", errorCode: "lease_lost" });
    expect(context.backend.transitionJob).not.toHaveBeenCalled();

    context.backend.transitionJob = vi.fn(async () => false);
    expect(await processClaimedAccountDeletionJob(context.backend, job()))
      .toEqual({ outcome: "failed", errorCode: "lease_lost" });
    expect(context.backend.transitionJob).toHaveBeenCalledWith(
      "job-a", "lease-a", 1, "deleting_storage", "deleting_storage", undefined, undefined,
    );
    expect(context.backend.deleteAuthUser).not.toHaveBeenCalled();
  });

  it("never calls deleteUser when the atomic auth fence is lost after storage cleanup", async () => {
    const context = storageBackend([]);
    context.backend.beginAuthDelete = vi.fn(async () => null);
    const result = await processClaimedAccountDeletionJob(context.backend, job());
    expect(result).toEqual({ outcome: "failed", errorCode: "lease_lost" });
    expect(context.backend.authUserExists).not.toHaveBeenCalled();
    expect(context.backend.deleteAuthUser).not.toHaveBeenCalled();
  });

  it("deletes exclusively the user id returned by the atomic auth fence", async () => {
    const context = storageBackend([]);
    context.backend.beginAuthDelete = vi.fn(async () => ({
      userId: "authoritative-user",
      leaseToken: "extended-token",
      leaseGeneration: 2,
      leaseExpiresAt: "2026-08-11T00:15:00.000Z",
    }));
    const result = await processClaimedAccountDeletionJob(context.backend, job());
    expect(result).toEqual({ outcome: "completed" });
    expect(context.backend.authUserExists).toHaveBeenCalledWith("authoritative-user");
    expect(context.backend.deleteAuthUser).toHaveBeenCalledWith("authoritative-user");
    expect(context.updates.at(-1)).toMatchObject({
      leaseToken: "extended-token",
      leaseGeneration: 2,
      expectedStatus: "deleting_auth",
      newStatus: "completed",
    });
  });
});

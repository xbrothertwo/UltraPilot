import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { ACCOUNT_DELETION_CONFIRMATION } from "./account-deletion-shared";

export { ACCOUNT_DELETION_CONFIRMATION };
export const ACCOUNT_DELETION_BUCKET = "activity-files";
export const ACCOUNT_DELETION_REMOVE_CHUNK_SIZE = 1000;
const STORAGE_LIST_LIMIT = 1000;
const MAX_STORAGE_LIST_OPERATIONS = 100;
const LEASE_SECONDS = 300;

export const ACCOUNT_DELETION_ERROR_CODES = [
  "session_revoke_failed",
  "storage_list_failed",
  "storage_delete_failed",
  "storage_not_empty",
  "auth_delete_failed",
  "lease_lost",
  "internal_error",
] as const;

export type AccountDeletionErrorCode = (typeof ACCOUNT_DELETION_ERROR_CODES)[number];
export type AccountDeletionStatus =
  | "requested"
  | "revoking_sessions"
  | "deleting_storage"
  | "deleting_auth"
  | "failed"
  | "completed";

export type AccountDeletionJob = {
  id: string;
  user_id: string;
  status: AccountDeletionStatus;
  attempt_count: number;
  last_error_code: AccountDeletionErrorCode | null;
  reauthenticated_at: string;
  sessions_revoked_at: string | null;
  lease_token: string | null;
  lease_generation: number;
};

type FencedStatus = "failed" | "deleting_storage" | "deleting_auth" | "completed";

type AuthDeleteFence = {
  userId: string;
  leaseToken: string;
  leaseGeneration: number;
  leaseExpiresAt: string;
};

type StorageEntry = { id: string | null; name: string };

export type AccountDeletionBackend = {
  listKnownActivityPaths(userId: string): Promise<string[]>;
  listStorageFolder(folder: string): Promise<StorageEntry[]>;
  removeStoragePaths(paths: string[]): Promise<void>;
  authUserExists(userId: string): Promise<boolean>;
  deleteAuthUser(userId: string): Promise<void>;
  deleteCompletedJob(jobId: string, userId: string): Promise<void>;
  transitionJob(
    jobId: string,
    leaseToken: string,
    leaseGeneration: number,
    expectedStatus: FencedStatus,
    newStatus: FencedStatus,
    errorCode?: AccountDeletionErrorCode,
    nextAttemptAt?: string,
  ): Promise<boolean>;
  beginAuthDelete(jobId: string, leaseToken: string, leaseGeneration: number): Promise<AuthDeleteFence | null>;
};

export type AccountDeletionProcessResult = {
  outcome: "completed" | "failed" | "not_found";
  errorCode?: AccountDeletionErrorCode;
};

export class AccountDeletionFailure extends Error {
  constructor(readonly code: AccountDeletionErrorCode) {
    super(code);
  }
}

function providerErrorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("code" in error)) return null;
  return typeof error.code === "string" ? error.code : null;
}

function retryAt(attemptCount: number): string {
  const delaySeconds = Math.min(86_400, 30 * (2 ** Math.max(0, Math.min(attemptCount - 1, 12))));
  return new Date(Date.now() + delaySeconds * 1000).toISOString();
}

export function isSafeOwnedStoragePath(path: unknown, userId: string): path is string {
  if (typeof path !== "string" || !path.startsWith(`${userId}/`)) return false;
  if (path.startsWith("/") || path.includes("\\") || /[\u0000-\u001f\u007f]/.test(path)) return false;
  const parts = path.slice(userId.length + 1).split("/");
  return parts.length > 0 && parts.every((part) => part.length > 0 && part !== "." && part !== "..");
}

export function createIsolatedReauthenticationClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createSupabaseClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export async function findActiveAccountDeletionJob(
  admin: SupabaseClient,
  userId: string,
): Promise<Pick<AccountDeletionJob, "id" | "status" | "sessions_revoked_at"> | null> {
  const { data, error } = await admin
    .from("account_deletion_jobs")
    .select("id,status,sessions_revoked_at")
    .eq("user_id", userId)
    .neq("status", "completed")
    .maybeSingle();
  if (error) throw new Error("ACCOUNT_DELETION_JOB_LOOKUP_FAILED");
  return data as Pick<AccountDeletionJob, "id" | "status" | "sessions_revoked_at"> | null;
}

export async function createOrReuseAccountDeletionJob(
  admin: SupabaseClient,
  userId: string,
  reauthenticatedAt: string,
): Promise<AccountDeletionJob> {
  const { error: insertError } = await admin.from("account_deletion_jobs").upsert({
    user_id: userId,
    status: "requested",
    reauthenticated_at: reauthenticatedAt,
    last_error_code: null,
    next_attempt_at: reauthenticatedAt,
    updated_at: reauthenticatedAt,
  }, { onConflict: "user_id", ignoreDuplicates: true });
  if (insertError) throw new Error("ACCOUNT_DELETION_JOB_CREATE_FAILED");
  const { data, error } = await admin
    .from("account_deletion_jobs")
    .select("id,user_id,status,attempt_count,last_error_code,reauthenticated_at,sessions_revoked_at,lease_token,lease_generation")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) throw new Error("ACCOUNT_DELETION_JOB_CREATE_FAILED");
  const existing = data as AccountDeletionJob;
  if (existing.status === "failed" && existing.sessions_revoked_at === null) {
    const { data: refreshed, error: refreshError } = await admin.from("account_deletion_jobs").update({
      status: "requested",
      reauthenticated_at: reauthenticatedAt,
      last_error_code: null,
      next_attempt_at: reauthenticatedAt,
      updated_at: reauthenticatedAt,
    }).eq("id", existing.id).eq("user_id", userId).is("sessions_revoked_at", null)
      .select("id,user_id,status,attempt_count,last_error_code,reauthenticated_at,sessions_revoked_at,lease_token,lease_generation")
      .maybeSingle();
    if (refreshError || !refreshed) throw new Error("ACCOUNT_DELETION_JOB_CREATE_FAILED");
    return refreshed as AccountDeletionJob;
  }
  return existing;
}

export async function prepareAccountDeletionJobForSignOut(
  admin: SupabaseClient,
  jobId: string,
  userId: string,
): Promise<boolean> {
  const now = new Date().toISOString();
  const { data, error } = await admin.from("account_deletion_jobs").update({
    status: "revoking_sessions",
    last_error_code: null,
    updated_at: now,
  }).eq("id", jobId).eq("user_id", userId).is("sessions_revoked_at", null).select("id").maybeSingle();
  return !error && Boolean(data);
}

export async function releaseAccountDeletionJobAfterSignOut(
  admin: SupabaseClient,
  jobId: string,
  userId: string,
): Promise<boolean> {
  const now = new Date().toISOString();
  const immediatelyDue = new Date(Date.now() - 60_000).toISOString();
  const { data, error } = await admin.from("account_deletion_jobs").update({
    status: "deleting_storage",
    sessions_revoked_at: now,
    last_error_code: null,
    next_attempt_at: immediatelyDue,
    updated_at: now,
  }).eq("id", jobId).eq("user_id", userId).eq("status", "revoking_sessions").select("id").maybeSingle();
  return !error && Boolean(data);
}

export async function markSessionRevocationFailed(admin: SupabaseClient, jobId: string, userId: string): Promise<void> {
  const now = new Date().toISOString();
  await admin.from("account_deletion_jobs").update({
    status: "failed",
    last_error_code: "session_revoke_failed",
    next_attempt_at: retryAt(1),
    updated_at: now,
  }).eq("id", jobId).eq("user_id", userId).eq("status", "revoking_sessions").is("sessions_revoked_at", null);
}

function createSupabaseBackend(admin: SupabaseClient): AccountDeletionBackend {
  return {
    async listKnownActivityPaths(userId) {
      const paths: string[] = [];
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await admin.from("activity_files")
          .select("id,storage_path")
          .eq("user_id", userId)
          .order("id", { ascending: true })
          .range(offset, offset + 999);
        if (error) throw new AccountDeletionFailure("storage_list_failed");
        const rows = data ?? [];
        for (const row of rows) if (isSafeOwnedStoragePath(row.storage_path, userId)) paths.push(row.storage_path);
        if (rows.length < 1000) break;
      }
      return [...new Set(paths)];
    },
    async listStorageFolder(folder) {
      const { data, error } = await admin.storage.from(ACCOUNT_DELETION_BUCKET).list(folder, {
        limit: STORAGE_LIST_LIMIT,
        offset: 0,
        sortBy: { column: "name", order: "asc" },
      });
      if (error) throw new AccountDeletionFailure("storage_list_failed");
      return (data ?? []).map((entry) => ({ id: entry.id, name: entry.name }));
    },
    async removeStoragePaths(paths) {
      const { error } = await admin.storage.from(ACCOUNT_DELETION_BUCKET).remove(paths);
      if (error) throw new AccountDeletionFailure("storage_delete_failed");
    },
    async authUserExists(userId) {
      const { data, error } = await admin.auth.admin.getUserById(userId);
      if (providerErrorCode(error) === "user_not_found") return false;
      if (error) throw new AccountDeletionFailure("auth_delete_failed");
      return Boolean(data.user);
    },
    async deleteAuthUser(userId) {
      const { error } = await admin.auth.admin.deleteUser(userId, false);
      if (error && providerErrorCode(error) !== "user_not_found") throw new AccountDeletionFailure("auth_delete_failed");
    },
    async deleteCompletedJob(jobId, userId) {
      await admin.from("account_deletion_jobs").delete()
        .eq("id", jobId)
        .eq("user_id", userId)
        .eq("status", "completed");
    },
    async transitionJob(jobId, leaseToken, leaseGeneration, expectedStatus, newStatus, errorCode, nextAttemptAt) {
      const { data, error } = await admin.rpc("transition_account_deletion_job", {
        p_job_id: jobId,
        p_lease_token: leaseToken,
        p_lease_generation: leaseGeneration,
        p_expected_status: expectedStatus,
        p_new_status: newStatus,
        p_error_code: errorCode ?? null,
        p_next_attempt_at: nextAttemptAt ?? null,
      });
      return !error && data === true;
    },
    async beginAuthDelete(jobId, leaseToken, leaseGeneration) {
      const { data, error } = await admin.rpc("begin_account_auth_delete", {
        p_job_id: jobId,
        p_lease_token: leaseToken,
        p_lease_generation: leaseGeneration,
      });
      if (error) return null;
      const row = Array.isArray(data) ? data[0] : null;
      if (!row || typeof row !== "object") return null;
      const candidate = row as Record<string, unknown>;
      if (typeof candidate.user_id !== "string"
        || typeof candidate.lease_token !== "string"
        || typeof candidate.lease_generation !== "number"
        || typeof candidate.lease_expires_at !== "string") return null;
      return {
        userId: candidate.user_id,
        leaseToken: candidate.lease_token,
        leaseGeneration: candidate.lease_generation,
        leaseExpiresAt: candidate.lease_expires_at,
      };
    },
  };
}

async function removeInChunks(backend: AccountDeletionBackend, paths: string[]): Promise<void> {
  for (let index = 0; index < paths.length; index += ACCOUNT_DELETION_REMOVE_CHUNK_SIZE) {
    await backend.removeStoragePaths(paths.slice(index, index + ACCOUNT_DELETION_REMOVE_CHUNK_SIZE));
  }
}

export async function cleanupAccountStorage(backend: AccountDeletionBackend, userId: string): Promise<void> {
  const knownPaths = (await backend.listKnownActivityPaths(userId)).filter((path) => isSafeOwnedStoragePath(path, userId));
  await removeInChunks(backend, [...new Set(knownPaths)]);

  let operations = 0;
  const emptyFolder = async (folder: string): Promise<void> => {
    for (;;) {
      if (++operations > MAX_STORAGE_LIST_OPERATIONS) throw new AccountDeletionFailure("storage_not_empty");
      const entries = await backend.listStorageFolder(folder);
      if (entries.length === 0) return;

      const files: string[] = [];
      const folders: string[] = [];
      for (const entry of entries) {
        const path = `${folder}/${entry.name}`;
        if (!isSafeOwnedStoragePath(path, userId)) throw new AccountDeletionFailure("storage_not_empty");
        if (entry.id === null) folders.push(path);
        else files.push(path);
      }
      await removeInChunks(backend, files);
      for (const child of folders) await emptyFolder(child);
      if (files.length === 0 && folders.length === 0) throw new AccountDeletionFailure("storage_not_empty");
    }
  };

  await emptyFolder(userId);
  const verification = await backend.listStorageFolder(userId);
  if (verification.length !== 0) throw new AccountDeletionFailure("storage_not_empty");
}

export async function processClaimedAccountDeletionJob(
  backend: AccountDeletionBackend,
  job: AccountDeletionJob,
): Promise<AccountDeletionProcessResult> {
  if (!job.sessions_revoked_at || !job.lease_token) return { outcome: "failed", errorCode: "lease_lost" };
  let leaseToken = job.lease_token;
  let leaseGeneration = job.lease_generation;
  let currentStatus: FencedStatus = job.status === "failed" || job.status === "deleting_auth"
    ? job.status
    : "deleting_storage";
  const transition = async (
    newStatus: FencedStatus,
    errorCode?: AccountDeletionErrorCode,
    nextAttemptAt?: string,
  ) => {
    const ok = await backend.transitionJob(
      job.id,
      leaseToken,
      leaseGeneration,
      currentStatus,
      newStatus,
      errorCode,
      nextAttemptAt,
    );
    if (!ok) throw new AccountDeletionFailure("lease_lost");
    currentStatus = newStatus;
  };

  try {
    await transition("deleting_storage");
    await cleanupAccountStorage(backend, job.user_id);
    const authFence = await backend.beginAuthDelete(job.id, leaseToken, leaseGeneration);
    if (!authFence) throw new AccountDeletionFailure("lease_lost");
    currentStatus = "deleting_auth";
    leaseToken = authFence.leaseToken;
    leaseGeneration = authFence.leaseGeneration;
    if (await backend.authUserExists(authFence.userId)) await backend.deleteAuthUser(authFence.userId);
    await transition("completed");
    try {
      await backend.deleteCompletedJob(job.id, authFence.userId);
    } catch {
      // A completed private job is harmless and can be removed administratively later.
    }
    return { outcome: "completed" };
  } catch (error: unknown) {
    const code = error instanceof AccountDeletionFailure ? error.code : "internal_error";
    if (code !== "lease_lost") {
      await backend.transitionJob(
        job.id,
        leaseToken,
        leaseGeneration,
        currentStatus,
        "failed",
        code,
        retryAt(job.attempt_count),
      );
    }
    return { outcome: "failed", errorCode: code };
  }
}

function isDeletionJob(value: unknown): value is AccountDeletionJob {
  if (typeof value !== "object" || value === null) return false;
  const job = value as Record<string, unknown>;
  return typeof job.id === "string"
    && typeof job.user_id === "string"
    && typeof job.status === "string"
    && typeof job.attempt_count === "number"
    && typeof job.lease_generation === "number"
    && typeof job.reauthenticated_at === "string";
}

export async function processAccountDeletionJob(
  admin: SupabaseClient,
  requestedJobId?: string,
): Promise<AccountDeletionProcessResult> {
  const { data, error } = await admin.rpc("claim_account_deletion_job", {
    p_job_id: requestedJobId ?? null,
    p_lease_seconds: LEASE_SECONDS,
  });
  if (error) return { outcome: "failed", errorCode: "internal_error" };
  const candidate = Array.isArray(data) ? data[0] : null;
  if (!isDeletionJob(candidate)) return { outcome: "not_found" };
  return processClaimedAccountDeletionJob(createSupabaseBackend(admin), candidate);
}

#!/usr/bin/env node

import {
  ACTIVITY_STORAGE_BUCKET,
  parseResetArguments,
  resetTestUser,
} from "./lib/test-user-reset.mjs";

const STORAGE_PAGE_SIZE = 1000;
const STORAGE_MAX_LIST_OPERATIONS = 100;
const DELETE_CHUNK_SIZE = 1000;

function serverSecretFromEnvironment() {
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY oder SUPABASE_SERVICE_ROLE_KEY fehlt.");
  if (key.startsWith("sb_secret_")) return key;
  try {
    const payload = JSON.parse(Buffer.from(key.split(".")[1] ?? "", "base64url").toString("utf8"));
    if (payload.role === "service_role") return key;
  } catch {
    // The generic error below deliberately reveals no secret details.
  }
  throw new Error("Der konfigurierte Schlüssel ist kein serverseitiger Supabase-Service-Key.");
}

function createBackend(supabase) {
  return {
    async findAuthUsersByEmail(email) {
      const matches = [];
      const perPage = 1000;
      for (let page = 1; page <= 100; page += 1) {
        const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
        if (error) throw new Error("Auth-User konnten nicht aufgelöst werden.");
        matches.push(...data.users.filter((user) => user.email?.toLowerCase() === email));
        if (data.users.length < perPage) break;
        if (page === 100) throw new Error("Auth-User-Auflösung überschreitet das Sicherheitslimit.");
      }
      return matches;
    },

    async getAuthUserById(userId) {
      const { data, error } = await supabase.auth.admin.getUserById(userId);
      if (error) throw new Error("Auth-User konnte nach dem Reset nicht verifiziert werden.");
      return data.user;
    },

    async findAccountDeletionJobs(userId) {
      const { data, error } = await supabase
        .from("account_deletion_jobs")
        .select("id,status,sessions_revoked_at")
        .eq("user_id", userId);
      if (error) throw new Error("Account-Deletion-Status konnte nicht geprüft werden.");
      return data ?? [];
    },

    async countOwnedRows(target, userId) {
      const { count, error } = await supabase
        .from(target.table)
        .select(target.ownerField, { count: "exact", head: true })
        .eq(target.ownerField, userId);
      if (error) throw new Error(`Zeilen in ${target.table} konnten nicht geprüft werden.`);
      return count ?? 0;
    },

    async deleteOwnedRows(target, userId) {
      const { error } = await supabase
        .from(target.table)
        .delete()
        .eq(target.ownerField, userId);
      if (error) throw new Error(`Reset von ${target.table} ist fehlgeschlagen.`);
    },

    async getGlobalExerciseSummary() {
      const [all, active] = await Promise.all([
        supabase.from("gym_exercises").select("id", { count: "exact", head: true }).is("owner_id", null),
        supabase.from("gym_exercises").select("id", { count: "exact", head: true }).is("owner_id", null).eq("active", true),
      ]);
      if (all.error || active.error) throw new Error("Globale Exercise Library konnte nicht geprüft werden.");
      return { total: all.count ?? 0, active: active.count ?? 0 };
    },

    async getProfile(userId) {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,onboarding_completed_at")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw new Error("Profil konnte nicht verifiziert werden.");
      return data;
    },

    async resetProfile(user) {
      const displayName = typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name.trim() || null
        : null;
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: displayName,
          timezone: "Europe/Berlin",
          max_heart_rate: null,
          resting_heart_rate: null,
          ftp_watts: null,
          heart_rate_zone_method: "max_hr",
          custom_heart_rate_boundaries: null,
          custom_power_boundaries: null,
          threshold_pace_seconds_per_km: null,
          onboarding_completed_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);
      if (error) throw new Error("Profil konnte nicht auf Onboarding zurückgesetzt werden.");
    },

    async listOwnedStoragePaths(userId) {
      const paths = [];
      const folders = [userId];
      let operations = 0;
      while (folders.length > 0) {
        const folder = folders.shift();
        for (let offset = 0; ; offset += STORAGE_PAGE_SIZE) {
          operations += 1;
          if (operations > STORAGE_MAX_LIST_OPERATIONS) {
            throw new Error("Storage-Auflistung überschreitet das Sicherheitslimit.");
          }
          const { data, error } = await supabase.storage
            .from(ACTIVITY_STORAGE_BUCKET)
            .list(folder, { limit: STORAGE_PAGE_SIZE, offset, sortBy: { column: "name", order: "asc" } });
          if (error) throw new Error("Activity-Storage konnte nicht aufgelistet werden.");
          for (const entry of data ?? []) {
            const path = `${folder}/${entry.name}`;
            if (entry.id === null) folders.push(path);
            else paths.push(path);
          }
          if ((data ?? []).length < STORAGE_PAGE_SIZE) break;
        }
      }
      return paths;
    },

    async removeOwnedStoragePaths(paths) {
      for (let index = 0; index < paths.length; index += DELETE_CHUNK_SIZE) {
        const chunk = paths.slice(index, index + DELETE_CHUNK_SIZE);
        const { error } = await supabase.storage.from(ACTIVITY_STORAGE_BUCKET).remove(chunk);
        if (error) throw new Error("Activity-Storage konnte nicht vollständig geleert werden.");
      }
    },
  };
}

async function main() {
  if (process.env.VERCEL === "1" || process.env.NODE_ENV === "production" || process.env.CI === "true") {
    throw new Error("Dieses Tool darf ausschließlich in einer lokalen Development-Shell laufen.");
  }
  const options = parseResetArguments(process.argv.slice(2));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL fehlt.");
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== "https:" && parsedUrl.hostname !== "localhost" && parsedUrl.hostname !== "127.0.0.1") {
      throw new Error();
    }
  } catch {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL ist ungültig.");
  }

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(url, serverSecretFromEnvironment(), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  await resetTestUser({ backend: createBackend(supabase), ...options, log: console.log });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Testaccount-Reset fehlgeschlagen.");
  process.exitCode = 1;
});

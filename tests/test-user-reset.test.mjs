import { describe, expect, it } from "vitest";
import {
  isRecognizedTestEmail,
  parseResetArguments,
  resetTestUser,
  TEST_USER_RESET_TABLES,
} from "../scripts/lib/test-user-reset.mjs";
import { ACCOUNT_EXPORT_FILES } from "../src/lib/account-export/schema.ts";

const USER_A = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "jonas@example.com",
  email_confirmed_at: "2026-08-01T10:00:00.000Z",
  user_metadata: { full_name: "Jonas Test" },
  passwordHash: "unchanged-password-hash-a",
};
const USER_B = {
  id: "00000000-0000-4000-8000-000000000002",
  email: "other@example.com",
  email_confirmed_at: "2026-08-01T11:00:00.000Z",
  user_metadata: { full_name: "Other User" },
  passwordHash: "unchanged-password-hash-b",
};

function clone(value) {
  return structuredClone(value);
}

function createBackend() {
  const authUsers = [clone(USER_A), clone(USER_B)];
  const rows = new Map();
  for (const target of TEST_USER_RESET_TABLES) {
    rows.set(target.table, [
      { id: `${target.table}-a`, [target.ownerField]: USER_A.id },
      { id: `${target.table}-b`, [target.ownerField]: USER_B.id },
    ]);
  }
  rows.get("gym_exercises").push({ id: "global-exercise", owner_id: null, active: true });
  const profiles = new Map([
    [USER_A.id, { id: USER_A.id, display_name: "Jonas", onboarding_completed_at: "2026-08-02T10:00:00.000Z", max_heart_rate: 190 }],
    [USER_B.id, { id: USER_B.id, display_name: "Other", onboarding_completed_at: "2026-08-02T11:00:00.000Z", max_heart_rate: 180 }],
  ]);
  const storage = new Map([
    [USER_A.id, [`${USER_A.id}/ride.gpx`, `${USER_A.id}/watch.fit`]],
    [USER_B.id, [`${USER_B.id}/run.gpx`]],
  ]);
  const deletionJobs = [];
  const deleteOrder = [];

  return {
    state: { authUsers, rows, profiles, storage, deletionJobs, deleteOrder },
    async findAuthUsersByEmail(email) {
      return authUsers.filter((user) => user.email.toLowerCase() === email);
    },
    async getAuthUserById(userId) {
      return authUsers.find((user) => user.id === userId) ?? null;
    },
    async findAccountDeletionJobs(userId) {
      return deletionJobs.filter((job) => job.user_id === userId);
    },
    async countOwnedRows(target, userId) {
      return rows.get(target.table).filter((row) => row[target.ownerField] === userId).length;
    },
    async deleteOwnedRows(target, userId) {
      deleteOrder.push(target.table);
      rows.set(target.table, rows.get(target.table).filter((row) => row[target.ownerField] !== userId));
    },
    async getGlobalExerciseSummary() {
      const globalRows = rows.get("gym_exercises").filter((row) => row.owner_id === null);
      return { total: globalRows.length, active: globalRows.filter((row) => row.active).length };
    },
    async getProfile(userId) {
      return profiles.get(userId) ?? null;
    },
    async resetProfile(user) {
      profiles.set(user.id, {
        ...profiles.get(user.id),
        display_name: user.user_metadata.full_name,
        onboarding_completed_at: null,
        max_heart_rate: null,
      });
    },
    async listOwnedStoragePaths(userId) {
      return [...(storage.get(userId) ?? [])];
    },
    async removeOwnedStoragePaths(paths) {
      for (const [userId, existing] of storage) {
        storage.set(userId, existing.filter((path) => !paths.includes(path)));
      }
    },
  };
}

describe("test-user reset argument safety", () => {
  it("requires an explicit email", () => {
    expect(() => parseResetArguments([])).toThrow("E-Mail ist erforderlich");
  });

  it("defaults to dry run and parses the explicit apply guard", () => {
    expect(parseResetArguments(["--email", "Jonas@Example.com"])).toEqual({
      email: "jonas@example.com", apply: false, confirmTestAccount: false,
    });
    expect(parseResetArguments(["--email", "real@domain.de", "--apply", "--confirm-test-account"])).toEqual({
      email: "real@domain.de", apply: true, confirmTestAccount: true,
    });
  });

  it("recognizes only explicit test-style addresses", () => {
    expect(isRecognizedTestEmail("jonas@example.com")).toBe(true);
    expect(isRecognizedTestEmail("person+test@domain.de")).toBe(true);
    expect(isRecognizedTestEmail("person@domain.de")).toBe(false);
  });
});

describe("test-user reset behavior", () => {
  it("keeps dry run completely read-only", async () => {
    const backend = createBackend();
    const before = clone(backend.state);
    const result = await resetTestUser({ backend, email: USER_A.email });
    expect(result.applied).toBe(false);
    expect(backend.state).toEqual(before);
  });

  it("removes only the selected user's complete product state", async () => {
    const backend = createBackend();
    const authBefore = clone(backend.state.authUsers);
    await resetTestUser({ backend, email: USER_A.email, apply: true });

    for (const target of TEST_USER_RESET_TABLES) {
      const tableRows = backend.state.rows.get(target.table);
      expect(tableRows.some((row) => row[target.ownerField] === USER_A.id), target.table).toBe(false);
      expect(tableRows.some((row) => row[target.ownerField] === USER_B.id), target.table).toBe(true);
    }
    expect(backend.state.storage.get(USER_A.id)).toEqual([]);
    expect(backend.state.storage.get(USER_B.id)).toEqual([`${USER_B.id}/run.gpx`]);
    expect(backend.state.deleteOrder).toEqual(TEST_USER_RESET_TABLES.map((target) => target.table));
    expect(backend.state.profiles.get(USER_A.id).onboarding_completed_at).toBeNull();
    expect(backend.state.profiles.get(USER_B.id).onboarding_completed_at).not.toBeNull();
    expect(backend.state.authUsers).toEqual(authBefore);
  });

  it("preserves auth identity, confirmed email, password and global Gym data", async () => {
    const backend = createBackend();
    await resetTestUser({ backend, email: USER_A.email, apply: true });
    const user = backend.state.authUsers.find((candidate) => candidate.id === USER_A.id);
    expect(user).toMatchObject({
      id: USER_A.id,
      email: USER_A.email,
      email_confirmed_at: USER_A.email_confirmed_at,
      passwordHash: USER_A.passwordHash,
    });
    expect(backend.state.rows.get("gym_exercises")).toContainEqual({
      id: "global-exercise", owner_id: null, active: true,
    });
  });

  it("specifically removes Gym history, planned workouts and activities", async () => {
    const backend = createBackend();
    await resetTestUser({ backend, email: USER_A.email, apply: true });
    for (const table of ["gym_sets", "gym_session_exercises", "gym_sessions", "gym_programs", "planned_workouts", "activities"]) {
      expect(backend.state.rows.get(table).some((row) => row.user_id === USER_A.id), table).toBe(false);
    }
  });

  it("rejects unknown and unexpectedly duplicated auth users", async () => {
    const backend = createBackend();
    await expect(resetTestUser({ backend, email: "missing@example.com" })).rejects.toThrow("Kein Auth-User");
    backend.state.authUsers.push(clone(USER_A));
    await expect(resetTestUser({ backend, email: USER_A.email })).rejects.toThrow("Unerwartet 2 Auth-User");
  });

  it("requires explicit confirmation for a normal-looking address", async () => {
    const backend = createBackend();
    backend.state.authUsers[0].email = "jonas@domain.de";
    await expect(resetTestUser({ backend, email: "jonas@domain.de", apply: true })).rejects.toThrow("--confirm-test-account");
    await expect(resetTestUser({ backend, email: "jonas@domain.de", apply: true, confirmTestAccount: true })).resolves.toMatchObject({ applied: true });
  });

  it("aborts when the auth user is in the account-deletion workflow", async () => {
    const backend = createBackend();
    backend.state.deletionJobs.push({ user_id: USER_A.id, status: "requested" });
    await expect(resetTestUser({ backend, email: USER_A.email, apply: true })).rejects.toThrow("Account-Deletion-Job");
    expect(backend.state.authUsers).toHaveLength(2);
  });
});

describe("reset schema coverage", () => {
  it("covers every user-owned account-export table and no global reference table", () => {
    const exportedTables = new Set(
      ACCOUNT_EXPORT_FILES.flatMap((area) => area.specs)
        .map((spec) => spec.table)
        .filter((table) => table !== "profiles"),
    );
    const resetTables = new Set(TEST_USER_RESET_TABLES.map((target) => target.table));
    expect(resetTables).toEqual(exportedTables);
    expect(resetTables.has("gym_equipment")).toBe(false);
    expect(TEST_USER_RESET_TABLES.find((target) => target.table === "gym_exercises")).toMatchObject({ ownerField: "owner_id" });
  });
});

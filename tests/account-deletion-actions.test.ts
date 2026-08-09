import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  createReauthClient: vi.fn(),
  createJob: vi.fn(),
  prepareJob: vi.fn(),
  markSignOutFailed: vi.fn(),
  releaseJob: vi.fn(),
  processJob: vi.fn(),
  redirect: vi.fn((url: string) => { throw new Error(`NEXT_REDIRECT:${url}`); }),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/account-deletion", async (importOriginal) => {
  const original = await importOriginal<typeof import("../src/lib/account-deletion")>();
  return {
    ...original,
    createIsolatedReauthenticationClient: mocks.createReauthClient,
    createOrReuseAccountDeletionJob: mocks.createJob,
    prepareAccountDeletionJobForSignOut: mocks.prepareJob,
    markSessionRevocationFailed: mocks.markSignOutFailed,
    releaseAccountDeletionJobAfterSignOut: mocks.releaseJob,
    processAccountDeletionJob: mocks.processJob,
  };
});

import { requestAccountDeletion } from "../src/app/settings/account-deletion-actions";

const idle = { status: "idle" as const, message: "" };
function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

function configure(options: { passwordError?: boolean; reauthUserId?: string; signOutError?: boolean } = {}) {
  const signOut = vi.fn(async () => ({ error: options.signOutError ? new Error("raw") : null }));
  mocks.createClient.mockResolvedValue({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: "user-a", email: "verified@example.com" } }, error: null })),
      signOut,
    },
  });
  const signInWithPassword = vi.fn(async () => ({
    data: { user: options.passwordError ? null : { id: options.reauthUserId ?? "user-a" } },
    error: options.passwordError ? new Error("wrong") : null,
  }));
  mocks.createReauthClient.mockReturnValue({ auth: { signInWithPassword } });
  mocks.createAdminClient.mockReturnValue({ admin: true });
  mocks.createJob.mockResolvedValue({ id: "job-a" });
  mocks.prepareJob.mockResolvedValue(true);
  mocks.releaseJob.mockResolvedValue(true);
  mocks.processJob.mockResolvedValue({ outcome: "completed" });
  return { signOut, signInWithPassword };
}

describe("account deletion request", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects unauthenticated requests", async () => {
    mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn(async () => ({ data: { user: null }, error: new Error("invalid") })) } });
    const result = await requestAccountDeletion(idle, form({ confirmation: "KONTO LÖSCHEN", password: "password1" }));
    expect(result.message).toContain("erneut an");
    expect(mocks.createReauthClient).not.toHaveBeenCalled();
  });

  it.each([
    [{ confirmation: "falsch", password: "password1" }, "exakt"],
    [{ confirmation: "KONTO LÖSCHEN", password: "" }, "Passwort"],
  ])("rejects invalid confirmation input before authentication", async (values, text) => {
    const result = await requestAccountDeletion(idle, form(values));
    expect(result.message).toContain(text);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("reauthenticates with only the verified email and ignores supplied identity fields", async () => {
    const { signInWithPassword } = configure();
    await expect(requestAccountDeletion(idle, form({
      confirmation: "KONTO LÖSCHEN",
      password: "password1",
      email: "attacker@example.com",
      user_id: "user-b",
    }))).rejects.toThrow("NEXT_REDIRECT:/login?notice=account-deletion-started");

    expect(signInWithPassword).toHaveBeenCalledWith({ email: "verified@example.com", password: "password1" });
    expect(mocks.createJob).toHaveBeenCalledWith(expect.anything(), "user-a", expect.any(String));
    expect(mocks.processJob).toHaveBeenCalledWith(expect.anything(), "job-a");
  });

  it("rejects a wrong password and a reauthenticated foreign user", async () => {
    configure({ passwordError: true });
    expect((await requestAccountDeletion(idle, form({ confirmation: "KONTO LÖSCHEN", password: "wrong" }))).message)
      .toContain("nicht korrekt");
    expect(mocks.createJob).not.toHaveBeenCalled();

    vi.clearAllMocks();
    configure({ reauthUserId: "user-b" });
    expect((await requestAccountDeletion(idle, form({ confirmation: "KONTO LÖSCHEN", password: "password1" }))).message)
      .toContain("nicht zu diesem Konto");
    expect(mocks.createJob).not.toHaveBeenCalled();
  });

  it("does not release or process the job when global sign-out fails", async () => {
    const { signOut } = configure({ signOutError: true });
    const result = await requestAccountDeletion(idle, form({ confirmation: "KONTO LÖSCHEN", password: "password1" }));
    expect(signOut).toHaveBeenCalledWith({ scope: "global" });
    expect(mocks.markSignOutFailed).toHaveBeenCalledWith(expect.anything(), "job-a", "user-a");
    expect(mocks.releaseJob).not.toHaveBeenCalled();
    expect(mocks.processJob).not.toHaveBeenCalled();
    expect(result.message).not.toContain("raw");
  });
});

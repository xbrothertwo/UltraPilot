import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  findJob: vi.fn(),
  prepareJob: vi.fn(),
  releaseJob: vi.fn(),
  processJob: vi.fn(),
  createPasswordClient: vi.fn(),
  redirect: vi.fn((url: string) => { throw new Error(`NEXT_REDIRECT:${url}`); }),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: () => true }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/account-deletion", () => ({
  createIsolatedReauthenticationClient: mocks.createPasswordClient,
  findActiveAccountDeletionJob: mocks.findJob,
  prepareAccountDeletionJobForSignOut: mocks.prepareJob,
  releaseAccountDeletionJobAfterSignOut: mocks.releaseJob,
  processAccountDeletionJob: mocks.processJob,
}));

import { signIn } from "../src/app/auth/actions";

function loginForm() {
  const data = new FormData();
  data.set("email", "athlete@example.com");
  data.set("password", "password1");
  return data;
}

function configure() {
  const signOut = vi.fn(async (): Promise<{ error: Error | null }> => ({ error: null }));
  mocks.createPasswordClient.mockReturnValue({
    auth: {
      signInWithPassword: vi.fn(async () => ({
        data: { user: { id: "user-a" }, session: { access_token: "access", refresh_token: "refresh" } },
        error: null,
      })),
      signOut,
    },
  });
  const setSession = vi.fn(async () => ({ error: null }));
  mocks.createClient.mockResolvedValue({ auth: { setSession } });
  mocks.createAdminClient.mockReturnValue({ admin: true });
  mocks.prepareJob.mockResolvedValue(true);
  mocks.releaseJob.mockResolvedValue(true);
  mocks.processJob.mockResolvedValue({ outcome: "completed" });
  return { signOut, setSession };
}

describe("login protection during account deletion", () => {
  beforeEach(() => vi.clearAllMocks());

  it("blocks login, revokes the new session and resumes an active pre-revoke job", async () => {
    const { signOut, setSession } = configure();
    mocks.findJob.mockResolvedValue({ id: "job-a", status: "revoking_sessions", sessions_revoked_at: null });
    await expect(signIn(loginForm())).rejects.toThrow("NEXT_REDIRECT:/login?notice=account-deletion-processing");
    expect(mocks.prepareJob).toHaveBeenCalledWith({ admin: true }, "job-a", "user-a");
    expect(signOut).toHaveBeenCalledWith({ scope: "global" });
    expect(mocks.releaseJob).toHaveBeenCalledWith({ admin: true }, "job-a", "user-a");
    expect(mocks.processJob).toHaveBeenCalledWith({ admin: true }, "job-a");
    expect(setSession).not.toHaveBeenCalled();
  });

  it("allows a retry login for a job that failed before sessions were revoked", async () => {
    const { signOut, setSession } = configure();
    mocks.findJob.mockResolvedValue({ id: "job-a", status: "failed", sessions_revoked_at: null });
    await expect(signIn(loginForm())).rejects.toThrow("NEXT_REDIRECT:/dashboard");
    expect(signOut).not.toHaveBeenCalled();
    expect(mocks.processJob).not.toHaveBeenCalled();
    expect(setSession).toHaveBeenCalledWith({ access_token: "access", refresh_token: "refresh" });
  });

  it("never establishes an app session when revoking the isolated login fails", async () => {
    const { signOut, setSession } = configure();
    signOut.mockResolvedValue({ error: new Error("raw sign-out detail") });
    mocks.findJob.mockResolvedValue({ id: "job-a", status: "deleting_storage", sessions_revoked_at: "2026-08-11" });
    await expect(signIn(loginForm())).rejects.toThrow("NEXT_REDIRECT:/login?error=account-status-unavailable");
    expect(setSession).not.toHaveBeenCalled();
    expect(mocks.processJob).not.toHaveBeenCalled();
  });
});

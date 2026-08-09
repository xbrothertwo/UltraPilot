import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  processJob: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/account-deletion", () => ({ processAccountDeletionJob: mocks.processJob }));

import { GET } from "../src/app/api/internal/account-deletion/worker/route";

describe("account deletion retry worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("CRON_SECRET", "cron-secret");
    mocks.createAdminClient.mockReturnValue({ admin: true });
  });
  afterEach(() => vi.unstubAllEnvs());

  it("is unavailable outside production and rejects missing or wrong bearer secrets", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    expect((await GET(new Request("https://app.example/api/internal/account-deletion/worker"))).status).toBe(404);

    vi.stubEnv("VERCEL_ENV", "production");
    expect((await GET(new Request("https://app.example/api/internal/account-deletion/worker?user_id=user-b"))).status).toBe(401);
    expect((await GET(new Request("https://app.example/api/internal/account-deletion/worker", {
      headers: { authorization: "Bearer wrong" },
    }))).status).toBe(401);
    expect(mocks.processJob).not.toHaveBeenCalled();
  });

  it("processes at most three jobs and accepts no request-controlled user id", async () => {
    mocks.processJob
      .mockResolvedValueOnce({ outcome: "completed" })
      .mockResolvedValueOnce({ outcome: "failed", errorCode: "storage_delete_failed" })
      .mockResolvedValueOnce({ outcome: "completed" })
      .mockResolvedValueOnce({ outcome: "completed" });
    const response = await GET(new Request("https://app.example/api/internal/account-deletion/worker?user_id=user-b", {
      headers: { authorization: "Bearer cron-secret" },
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: false, processed: 3, completed: 2, failed: 1 });
    expect(mocks.processJob).toHaveBeenCalledTimes(3);
    expect(mocks.processJob).toHaveBeenCalledWith({ admin: true });
  });
});

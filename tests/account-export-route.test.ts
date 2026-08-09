import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createSource: vi.fn(() => ({ source: true })),
  createResponse: vi.fn(() => new Response("zip")),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/account-export/export", () => ({
  createSupabaseExportSource: mocks.createSource,
  createAccountExportResponse: mocks.createResponse,
}));

import { GET } from "../src/app/api/account/export/route";

describe("account export route authorization", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects unauthenticated requests", async () => {
    mocks.createClient.mockResolvedValue({ auth: { getClaims: vi.fn().mockResolvedValue({ data: null, error: new Error("invalid") }) } });
    const response = await GET(new NextRequest("https://app.example/api/account/export"));
    expect(response.status).toBe(401);
    expect(mocks.createResponse).not.toHaveBeenCalled();
  });

  it("uses only the verified claim identity and ignores a manipulated user_id", async () => {
    const client = { auth: { getClaims: vi.fn().mockResolvedValue({ data: { claims: { sub: "user-a", email: "a@example.com" } }, error: null }) } };
    mocks.createClient.mockResolvedValue(client);
    const request = new NextRequest("https://app.example/api/account/export?user_id=user-b");
    await GET(request);
    expect(mocks.createSource).toHaveBeenCalledWith(client);
    expect(mocks.createResponse).toHaveBeenCalledWith(
      { source: true },
      { id: "user-a", email: "a@example.com" },
      { signal: request.signal },
    );
  });
});

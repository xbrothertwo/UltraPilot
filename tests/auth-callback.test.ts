import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createClient = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({ createClient }));

import { GET } from "../src/app/auth/callback/route";

function clientWithExchange(error: Error | null = null) {
  return { auth: { exchangeCodeForSession: vi.fn().mockResolvedValue({ error }) } };
}

describe("auth callback", () => {
  beforeEach(() => vi.clearAllMocks());

  it("exchanges a valid code and follows an allowed recovery target", async () => {
    const client = clientWithExchange();
    createClient.mockResolvedValue(client);
    const response = await GET(new NextRequest("https://app.example/auth/callback?code=valid&next=/auth/reset-password"));
    expect(client.auth.exchangeCodeForSession).toHaveBeenCalledWith("valid");
    expect(response.headers.get("location")).toBe("https://app.example/auth/reset-password");
  });

  it("keeps a normal existing internal callback target", async () => {
    createClient.mockResolvedValue(clientWithExchange());
    const response = await GET(new NextRequest("https://app.example/auth/callback?code=valid&next=/onboarding"));
    expect(response.headers.get("location")).toBe("https://app.example/onboarding");
  });

  it.each([
    "https://evil.example",
    "//evil.example",
    "/%5Cevil.example",
    "/%255Cevil.example",
    "%5C%5Cevil.example",
    "%255C%255Cevil.example",
    "%2F%2Fevil.example",
    "%252F%252Fevil.example",
    "%00",
    "%2500",
    "/%0Aevil.example",
    "/%250Aevil.example",
    "/%not-valid",
  ])(
    "falls back safely for target %s",
    async (target) => {
      createClient.mockResolvedValue(clientWithExchange());
      const response = await GET(new NextRequest(`https://app.example/auth/callback?code=valid&next=${target}`));
      expect(response.headers.get("location")).toBe("https://app.example/dashboard");
    },
  );

  it("sends a missing recovery code to a recovery-specific error page", async () => {
    const response = await GET(new NextRequest("https://app.example/auth/callback?next=/auth/reset-password"));
    expect(response.headers.get("location")).toContain("https://app.example/auth/forgot-password?error=");
    expect(createClient).not.toHaveBeenCalled();
  });

  it("handles a failed or expired recovery code without exposing provider details", async () => {
    createClient.mockResolvedValue(clientWithExchange(new Error("sensitive provider detail")));
    const response = await GET(new NextRequest("https://app.example/auth/callback?code=expired&next=/auth/reset-password"));
    const location = response.headers.get("location") ?? "";
    expect(location).toContain("/auth/forgot-password?error=");
    expect(location).not.toContain("sensitive");
    expect(location).not.toContain("expired");
  });

  it("preserves the existing generic callback error behavior", async () => {
    createClient.mockResolvedValue(clientWithExchange(new Error("invalid")));
    const response = await GET(new NextRequest("https://app.example/auth/callback?code=bad&next=/onboarding"));
    expect(response.headers.get("location")).toBe("https://app.example/login?error=confirmation-link-invalid");
  });
});

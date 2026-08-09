import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createClient = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({ createClient }));

import ResetPasswordPage from "../src/app/auth/reset-password/page";

describe("reset password page", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does not render the password form without a valid session", async () => {
    createClient.mockResolvedValue({
      auth: { getClaims: vi.fn().mockResolvedValue({ data: { claims: { sub: "user-1", amr: [{ method: "password" }] } }, error: null }) },
    });
    const html = renderToStaticMarkup(await ResetPasswordPage());
    expect(html).toContain("Dieser Link ist ungültig oder abgelaufen");
    expect(html).toContain('href="/auth/forgot-password"');
    expect(html).not.toContain('name="password"');
  });

  it("renders the form for a verified recovery session", async () => {
    createClient.mockResolvedValue({
      auth: { getClaims: vi.fn().mockResolvedValue({ data: { claims: { sub: "user-1", amr: [{ method: "recovery" }] } }, error: null }) },
    });
    const html = renderToStaticMarkup(await ResetPasswordPage());
    expect(html).toContain('name="password"');
    expect(html).toContain('name="passwordConfirmation"');
  });
});

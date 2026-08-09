import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/lib/supabase/auth", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: () => true }));
vi.mock("@/app/auth/actions", () => ({ signIn: mocks.signIn, signUp: mocks.signUp }));

import LoginPage from "../src/app/login/page";

async function renderLogin(searchParams: { error?: string; notice?: string; message?: string } = {}) {
  return renderToStaticMarkup(await LoginPage({ searchParams: Promise.resolve(searchParams) }));
}

describe("login recovery feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUser.mockResolvedValue(null);
  });

  it("renders the password-recovery link", async () => {
    const html = await renderLogin();
    expect(html).toContain('href="/auth/forgot-password"');
    expect(html).toContain("Passwort vergessen?");
  });

  it("renders the fixed password-reset notice", async () => {
    const html = await renderLogin({ notice: "password-reset-success" });
    expect(html).toContain("Dein Passwort wurde geändert. Du kannst dich jetzt anmelden.");
  });

  it.each([
    ["account-deletion-started", "deines Kontos wurde gestartet."],
    ["account-deletion-processing", "deines Kontos wird noch verarbeitet."],
  ])("renders the fixed account-deletion notice %s", async (notice, text) => {
    const html = await renderLogin({ notice });
    expect(html).toContain(text);
  });

  it.each([
    { notice: "unknown-notice" },
    { message: "Beliebiger Erfolgstext" },
    { message: "<script>alert('x')</script>" },
  ])("does not render untrusted query feedback", async (params) => {
    const html = await renderLogin(params);
    expect(html).not.toContain(params.notice ?? params.message);
    expect(html).not.toContain("alert(&#x27;x&#x27;)");
  });
});

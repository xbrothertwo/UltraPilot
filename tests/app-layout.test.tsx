import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  usePathname: () => "/dashboard",
}));
vi.mock("@/app/auth/actions", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("@/lib/supabase/auth", () => ({ getCurrentUser: vi.fn(async () => null) }));
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: vi.fn(() => false) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => null) }));

import AuthenticatedAppLayout from "../src/app/(app)/layout";
import RootLayout from "../src/app/layout";
import ForgotPasswordPage from "../src/app/auth/forgot-password/page";
import ResetPasswordPage from "../src/app/auth/reset-password/page";
import LoginPage from "../src/app/login/page";

function renderPublicPage(page: React.ReactNode): string {
  return renderToStaticMarkup(<RootLayout>{page}</RootLayout>);
}

describe("app shell route boundaries", () => {
  it("keeps login and registration forms outside app navigation", async () => {
    const html = renderPublicPage(await LoginPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("Willkommen zurück");
    expect(html).toContain("Konto erstellen");
    expect(html).toContain("Passwort vergessen?");
    expect(html).not.toContain("data-testid=\"app-shell\"");
    expect(html).not.toContain("Mobile Hauptnavigation");
  });

  it("keeps forgot and reset password pages outside app navigation", async () => {
    const forgot = renderPublicPage(await ForgotPasswordPage({ searchParams: Promise.resolve({}) }));
    const reset = renderPublicPage(await ResetPasswordPage());
    expect(forgot).toContain("Passwort zurücksetzen");
    expect(forgot).toContain("Zurück zur Anmeldung");
    expect(reset).toContain("Neues Passwort festlegen");
    expect(reset).toContain("Neue Reset-Mail anfordern");
    expect(`${forgot}${reset}`).not.toContain("data-testid=\"app-shell\"");
  });

  it.each(["Dashboard", "Plan", "Aktivitäten"])("wraps the protected %s route in AppShell", async (label) => {
    const html = renderToStaticMarkup(await AuthenticatedAppLayout({ children: <p>{label}</p> }));
    expect(html).toContain("data-testid=\"app-shell\"");
    expect(html).toContain("Hauptnavigation");
    expect(html).toContain(label);
  });
});

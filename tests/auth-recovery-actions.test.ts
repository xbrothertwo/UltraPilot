import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  redirect: vi.fn((url: string) => { throw new Error(`NEXT_REDIRECT:${url}`); }),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { requestPasswordRecovery, updateRecoveredPassword } from "../src/app/auth/recovery-actions";

const idle = { status: "idle" as const, message: "" };

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

function recoveryClient(resetError: Error | null = null) {
  return {
    auth: {
      resetPasswordForEmail: vi.fn().mockResolvedValue({ error: resetError }),
    },
  };
}

function passwordClient(options: {
  authenticationMethod?: "recovery" | "password";
  claims?: boolean;
  signOutError?: Error | null;
  updateError?: Error | null;
} = {}) {
  return {
    auth: {
      getClaims: vi.fn().mockResolvedValue(options.claims === false
        ? { data: null, error: new Error("invalid session") }
        : { data: { claims: { sub: "user-1", amr: [{ method: options.authenticationMethod ?? "recovery" }] } }, error: null }),
      updateUser: vi.fn().mockResolvedValue({ error: options.updateError ?? null }),
      signOut: vi.fn().mockResolvedValue({ error: options.signOutError ?? null }),
    },
  };
}

describe("password recovery actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example";
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  it("requests a reset with a trimmed email and the trusted absolute callback URL", async () => {
    const client = recoveryClient();
    mocks.createClient.mockResolvedValue(client);
    const result = await requestPasswordRecovery(idle, form({ email: " athlete@example.com " }));

    expect(client.auth.resetPasswordForEmail).toHaveBeenCalledWith("athlete@example.com", {
      redirectTo: "https://app.example/auth/callback?next=/auth/reset-password",
    });
    expect(result).toMatchObject({ status: "success", message: /Falls ein Konto/ });
  });

  it("returns the same neutral response when the provider does not reveal an unknown account", async () => {
    const knownClient = recoveryClient();
    const unknownClient = recoveryClient();
    mocks.createClient.mockResolvedValueOnce(knownClient).mockResolvedValueOnce(unknownClient);

    const known = await requestPasswordRecovery(idle, form({ email: "known@example.com" }));
    const unknown = await requestPasswordRecovery(idle, form({ email: "unknown@example.com" }));
    expect(unknown).toEqual(known);
  });

  it("rejects an invalid email before calling Supabase", async () => {
    const result = await requestPasswordRecovery(idle, form({ email: "invalid" }));
    expect(result).toMatchObject({ status: "error", message: /gültige E-Mail/ });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("maps provider errors to a general German error", async () => {
    mocks.createClient.mockResolvedValue(recoveryClient(new Error("raw provider detail")));
    const result = await requestPasswordRecovery(idle, form({ email: "athlete@example.com" }));
    expect(result).toEqual({ status: "error", message: "Die Anfrage konnte gerade nicht verarbeitet werden. Bitte versuche es später erneut." });
    expect(result.message).not.toContain("provider");
  });

  it.each([
    [{ password: "", passwordConfirmation: "" }, /neues Passwort/],
    [{ password: "short", passwordConfirmation: "short" }, /acht Zeichen/],
    [{ password: "password1", passwordConfirmation: "password2" }, /stimmen nicht/],
  ] as const)("rejects invalid new-password input before calling Supabase", async (values, message) => {
    const result = await updateRecoveredPassword(idle, form(values));
    expect(result).toMatchObject({ status: "error", message });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("rejects a direct update without a valid session", async () => {
    const client = passwordClient({ claims: false });
    mocks.createClient.mockResolvedValue(client);
    const result = await updateRecoveredPassword(idle, form({ password: "password1", passwordConfirmation: "password1" }));
    expect(result).toMatchObject({ status: "error", message: /ungültig oder abgelaufen/ });
    expect(client.auth.updateUser).not.toHaveBeenCalled();
  });

  it("rejects a normal password session before updateUser", async () => {
    const client = passwordClient({ authenticationMethod: "password" });
    mocks.createClient.mockResolvedValue(client);
    const result = await updateRecoveredPassword(idle, form({ password: "password1", passwordConfirmation: "password1" }));
    expect(result).toMatchObject({ status: "error", message: /ungültig oder abgelaufen/ });
    expect(client.auth.updateUser).not.toHaveBeenCalled();
  });

  it("updates the password, signs out and redirects explicitly to login", async () => {
    const client = passwordClient();
    mocks.createClient.mockResolvedValue(client);
    await expect(updateRecoveredPassword(idle, form({ password: "password1", passwordConfirmation: "password1" })))
      .rejects.toThrow("NEXT_REDIRECT:/login?notice=password-reset-success");
    expect(client.auth.updateUser).toHaveBeenCalledWith({ password: "password1" });
    expect(client.auth.signOut).toHaveBeenCalledOnce();
  });

  it("returns a warning and does not redirect when sign-out fails after a successful update", async () => {
    const client = passwordClient({ signOutError: new Error("raw sign-out detail") });
    mocks.createClient.mockResolvedValue(client);
    const result = await updateRecoveredPassword(idle, form({ password: "password1", passwordConfirmation: "password1" }));
    expect(result).toEqual({
      status: "warning",
      message: "Dein Passwort wurde geändert, aber die automatische Abmeldung ist fehlgeschlagen. Bitte melde dich über das Menü ab, bevor du fortfährst.",
    });
    expect(client.auth.updateUser).toHaveBeenCalledOnce();
    expect(client.auth.signOut).toHaveBeenCalledOnce();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("maps password provider errors without signing out", async () => {
    const client = passwordClient({ updateError: new Error("raw provider detail") });
    mocks.createClient.mockResolvedValue(client);
    const result = await updateRecoveredPassword(idle, form({ password: "password1", passwordConfirmation: "password1" }));
    expect(result).toEqual({ status: "error", message: "Das Passwort konnte nicht geändert werden. Bitte versuche es erneut." });
    expect(client.auth.signOut).not.toHaveBeenCalled();
  });
});

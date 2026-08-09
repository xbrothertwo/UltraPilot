import { describe, expect, it } from "vitest";
import {
  MIN_PASSWORD_LENGTH,
  hasRecoveryAuthentication,
  passwordRecoveryRedirectUrl,
  safeInternalRedirect,
  trustedAppOrigin,
  validateNewPassword,
  validateRecoveryEmail,
} from "../src/lib/auth/recovery";

describe("password recovery validation", () => {
  it("trims and accepts a valid email address", () => {
    expect(validateRecoveryEmail("  athlete@example.com ")).toEqual({ ok: true, value: "athlete@example.com" });
  });

  it.each([null, "", "athlete", "athlete@", "@example.com", "a b@example.com"])(
    "rejects invalid email value %s",
    (email) => expect(validateRecoveryEmail(email)).toMatchObject({ ok: false }),
  );

  it("uses the configured HTTPS origin for the absolute recovery callback", () => {
    expect(passwordRecoveryRedirectUrl("https://app.example"))
      .toBe("https://app.example/auth/callback?next=/auth/reset-password");
  });

  it("allows local HTTP but rejects untrusted app URL shapes", () => {
    expect(trustedAppOrigin("http://localhost:3000")).toBe("http://localhost:3000");
    expect(trustedAppOrigin("http://app.example")).toBeNull();
    expect(trustedAppOrigin("https://user:secret@app.example")).toBeNull();
    expect(trustedAppOrigin("https://app.example/path")).toBeNull();
  });

  it("validates empty, short, mismatching and valid new passwords", () => {
    expect(validateNewPassword("", "")).toMatchObject({ ok: false, message: /neues Passwort/ });
    expect(validateNewPassword("x".repeat(MIN_PASSWORD_LENGTH - 1), "x".repeat(MIN_PASSWORD_LENGTH - 1)))
      .toMatchObject({ ok: false, message: /acht Zeichen/ });
    expect(validateNewPassword("password1", "password2")).toMatchObject({ ok: false, message: /stimmen nicht/ });
    expect(validateNewPassword("password1", "password1")).toEqual({ ok: true, value: "password1" });
  });
});

describe("safe auth callback redirects", () => {
  it.each(["/dashboard", "/onboarding", "/auth/reset-password", "/settings?tab=profile"])(
    "keeps existing internal target %s",
    (target) => expect(safeInternalRedirect(target)).toBe(target),
  );

  it.each([
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "\\\\evil.example",
    "javascript:alert(1)",
    "%2F%2Fevil.example",
    "%252F%252Fevil.example",
    "/%5Cevil.example",
    "/%255Cevil.example",
    "%5C%5Cevil.example",
    "%255C%255Cevil.example",
    "%00",
    "%2500",
    "/%00evil.example",
    "/%2500evil.example",
    "/%0Aevil.example",
    "/%250Aevil.example",
    "/%not-valid",
  ])("rejects unsafe target %s", (target) => {
    expect(safeInternalRedirect(target)).toBe("/dashboard");
  });
});

describe("recovery authentication claims", () => {
  it("accepts a verified recovery AMR entry", () => {
    expect(hasRecoveryAuthentication({ sub: "user-1", amr: [{ method: "recovery", timestamp: 123 }] })).toBe(true);
  });

  it.each([
    { sub: "user-1", amr: [{ method: "password" }] },
    { sub: "user-1", amr: [{ method: "magiclink" }] },
    { sub: "user-1", amr: [{ method: "otp" }] },
    { sub: "user-1" },
    { sub: "user-1", amr: "recovery" },
    { sub: "user-1", amr: [null, "recovery", { method: 123 }] },
    null,
  ])("rejects non-recovery or malformed claims", (claims) => {
    expect(hasRecoveryAuthentication(claims)).toBe(false);
  });
});

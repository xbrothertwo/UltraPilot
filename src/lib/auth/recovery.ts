export const MIN_PASSWORD_LENGTH = 8;

export const PASSWORD_RECOVERY_SUCCESS_MESSAGE =
  "Falls ein Konto zu dieser E-Mail-Adresse existiert, wurde ein Link zum Zurücksetzen des Passworts versendet.";

type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string };

export function validateRecoveryEmail(value: FormDataEntryValue | null): ValidationResult<string> {
  if (typeof value !== "string") {
    return { ok: false, message: "Bitte gib eine gültige E-Mail-Adresse ein." };
  }
  const email = value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, message: "Bitte gib eine gültige E-Mail-Adresse ein." };
  }
  return { ok: true, value: email };
}

export function validateNewPassword(
  passwordValue: FormDataEntryValue | null,
  confirmationValue: FormDataEntryValue | null,
): ValidationResult<string> {
  if (typeof passwordValue !== "string" || passwordValue.length === 0) {
    return { ok: false, message: "Bitte gib ein neues Passwort ein." };
  }
  if (passwordValue.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, message: "Das Passwort muss mindestens acht Zeichen lang sein." };
  }
  if (typeof confirmationValue !== "string" || passwordValue !== confirmationValue) {
    return { ok: false, message: "Die Passwörter stimmen nicht überein." };
  }
  return { ok: true, value: passwordValue };
}

export function trustedAppOrigin(configuredUrl: string | undefined): string | null {
  if (!configuredUrl) return null;
  try {
    const url = new URL(configuredUrl);
    const localHttp = url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
    if (url.protocol !== "https:" && !localHttp) return null;
    if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function passwordRecoveryRedirectUrl(configuredUrl: string | undefined): string | null {
  const origin = trustedAppOrigin(configuredUrl);
  return origin ? `${origin}/auth/callback?next=/auth/reset-password` : null;
}

export function hasRecoveryAuthentication(claims: unknown): boolean {
  if (!claims || typeof claims !== "object" || !("amr" in claims)) return false;
  const amr = (claims as { amr?: unknown }).amr;
  if (!Array.isArray(amr)) return false;
  return amr.some((entry) => (
    typeof entry === "object"
    && entry !== null
    && "method" in entry
    && (entry as { method?: unknown }).method === "recovery"
  ));
}

function hasUnsafeRedirectShape(value: string): boolean {
  return !value.startsWith("/")
    || value.startsWith("//")
    || value.includes("\\")
    || /[\u0000-\u001f\u007f]/.test(value);
}

export function safeInternalRedirect(value: string | null, fallback = "/dashboard"): string {
  if (!value) return fallback;
  try {
    let decoded = value;
    for (let attempt = 0; attempt <= value.length; attempt += 1) {
      if (hasUnsafeRedirectShape(decoded)) return fallback;
      const nextDecoded = decodeURIComponent(decoded);
      if (nextDecoded === decoded) break;
      decoded = nextDecoded;
    }
    const base = new URL("https://internal.invalid");
    const target = new URL(value, base);
    if (target.origin !== base.origin) return fallback;
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return fallback;
  }
}

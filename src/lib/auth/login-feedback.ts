export type LoginFeedback = { kind: "error" | "notice"; text: string };

const LOGIN_ERRORS: Readonly<Record<string, string>> = {
  "confirmation-link-invalid": "Der Bestätigungslink ist ungültig oder abgelaufen.",
  "invalid-credentials": "Anmeldung fehlgeschlagen. Prüfe E-Mail-Adresse und Passwort.",
  "invalid-email": "Bitte gib eine gültige E-Mail-Adresse ein.",
  "invalid-password": "Das Passwort muss mindestens acht Zeichen lang sein.",
  "signup-failed": "Das Konto konnte nicht erstellt werden. Bitte versuche es erneut.",
  "supabase-unavailable": "Supabase ist nicht konfiguriert.",
};

const LOGIN_NOTICES: Readonly<Record<string, string>> = {
  "account-created": "Konto erstellt. Bitte bestätige jetzt den Link in deiner E-Mail.",
  "password-reset-success": "Dein Passwort wurde geändert. Du kannst dich jetzt anmelden.",
  "signed-out": "Du bist abgemeldet.",
};

export function getLoginFeedback(errorCode: string | undefined, noticeCode: string | undefined): LoginFeedback | null {
  if (errorCode && LOGIN_ERRORS[errorCode]) return { kind: "error", text: LOGIN_ERRORS[errorCode] };
  if (noticeCode && LOGIN_NOTICES[noticeCode]) return { kind: "notice", text: LOGIN_NOTICES[noticeCode] };
  return null;
}

"use server";

import { redirect } from "next/navigation";
import {
  PASSWORD_RECOVERY_SUCCESS_MESSAGE,
  hasRecoveryAuthentication,
  passwordRecoveryRedirectUrl,
  validateNewPassword,
  validateRecoveryEmail,
} from "@/lib/auth/recovery";
import { createClient } from "@/lib/supabase/server";

export type RecoveryActionState = { status: "idle" | "success" | "error" | "warning"; message: string };

const GENERAL_RECOVERY_ERROR = "Die Anfrage konnte gerade nicht verarbeitet werden. Bitte versuche es später erneut.";

export async function requestPasswordRecovery(
  _previous: RecoveryActionState,
  formData: FormData,
): Promise<RecoveryActionState> {
  const email = validateRecoveryEmail(formData.get("email"));
  if (!email.ok) return { status: "error", message: email.message };

  const redirectTo = passwordRecoveryRedirectUrl(process.env.NEXT_PUBLIC_APP_URL);
  if (!redirectTo) return { status: "error", message: GENERAL_RECOVERY_ERROR };

  const supabase = await createClient();
  if (!supabase) return { status: "error", message: GENERAL_RECOVERY_ERROR };
  const { error } = await supabase.auth.resetPasswordForEmail(email.value, { redirectTo });
  if (error) return { status: "error", message: GENERAL_RECOVERY_ERROR };

  return { status: "success", message: PASSWORD_RECOVERY_SUCCESS_MESSAGE };
}

export async function updateRecoveredPassword(
  _previous: RecoveryActionState,
  formData: FormData,
): Promise<RecoveryActionState> {
  const password = validateNewPassword(formData.get("password"), formData.get("passwordConfirmation"));
  if (!password.ok) return { status: "error", message: password.message };

  const supabase = await createClient();
  if (!supabase) return { status: "error", message: GENERAL_RECOVERY_ERROR };
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claimsData?.claims?.sub || !hasRecoveryAuthentication(claimsData.claims)) {
    return { status: "error", message: "Der Link ist ungültig oder abgelaufen. Bitte fordere eine neue Reset-Mail an." };
  }

  const { error } = await supabase.auth.updateUser({ password: password.value });
  if (error) return { status: "error", message: "Das Passwort konnte nicht geändert werden. Bitte versuche es erneut." };

  const { error: signOutError } = await supabase.auth.signOut();
  if (signOutError) {
    return {
      status: "warning",
      message: "Dein Passwort wurde geändert, aber die automatische Abmeldung ist fehlgeschlagen. Bitte melde dich über das Menü ab, bevor du fortfährst.",
    };
  }
  redirect("/login?notice=password-reset-success");
}

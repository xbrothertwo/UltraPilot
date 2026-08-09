"use server";

import { redirect } from "next/navigation";
import {
  ACCOUNT_DELETION_CONFIRMATION,
  createIsolatedReauthenticationClient,
  createOrReuseAccountDeletionJob,
  markSessionRevocationFailed,
  prepareAccountDeletionJobForSignOut,
  processAccountDeletionJob,
  releaseAccountDeletionJobAfterSignOut,
} from "@/lib/account-deletion";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type AccountDeletionActionState = {
  status: "idle" | "error";
  message: string;
};

const GENERAL_ERROR = "Die Kontolöschung konnte gerade nicht gestartet werden. Bitte versuche es später erneut.";

export async function requestAccountDeletion(
  _previous: AccountDeletionActionState,
  formData: FormData,
): Promise<AccountDeletionActionState> {
  const confirmation = formData.get("confirmation");
  const password = formData.get("password");
  if (confirmation !== ACCOUNT_DELETION_CONFIRMATION) {
    return { status: "error", message: `Bitte gib exakt „${ACCOUNT_DELETION_CONFIRMATION}“ ein.` };
  }
  if (typeof password !== "string" || password.length === 0) {
    return { status: "error", message: "Bitte gib dein aktuelles Passwort ein." };
  }

  const sessionClient = await createClient();
  if (!sessionClient) return { status: "error", message: GENERAL_ERROR };
  const { data: userData, error: userError } = await sessionClient.auth.getUser();
  const verifiedUser = userData.user;
  if (userError || !verifiedUser) {
    return { status: "error", message: "Bitte melde dich erneut an, bevor du dein Konto löschst." };
  }
  if (typeof verifiedUser.email !== "string" || verifiedUser.email.length === 0) {
    return { status: "error", message: "Dieses Konto kann nicht per Passwort bestätigt werden." };
  }

  const reauthenticationClient = createIsolatedReauthenticationClient();
  if (!reauthenticationClient) return { status: "error", message: GENERAL_ERROR };
  const { data: reauthentication, error: reauthenticationError } = await reauthenticationClient.auth.signInWithPassword({
    email: verifiedUser.email,
    password,
  });
  if (reauthenticationError || !reauthentication.user) {
    return { status: "error", message: "Das Passwort ist nicht korrekt. Dein Konto wurde nicht gelöscht." };
  }
  if (reauthentication.user.id !== verifiedUser.id) {
    return { status: "error", message: "Die erneute Anmeldung gehört nicht zu diesem Konto. Es wurde nichts gelöscht." };
  }

  const admin = createAdminClient();
  if (!admin) return { status: "error", message: GENERAL_ERROR };

  let job;
  try {
    job = await createOrReuseAccountDeletionJob(admin, verifiedUser.id, new Date().toISOString());
    if (!await prepareAccountDeletionJobForSignOut(admin, job.id, verifiedUser.id)) {
      return { status: "error", message: GENERAL_ERROR };
    }
  } catch {
    return { status: "error", message: GENERAL_ERROR };
  }

  const { error: signOutError } = await sessionClient.auth.signOut({ scope: "global" });
  if (signOutError) {
    await markSessionRevocationFailed(admin, job.id, verifiedUser.id);
    return {
      status: "error",
      message: "Die Sitzungen konnten nicht sicher beendet werden. Die Löschung wurde noch nicht ausgeführt; bitte versuche es erneut.",
    };
  }

  if (await releaseAccountDeletionJobAfterSignOut(admin, job.id, verifiedUser.id)) {
    await processAccountDeletionJob(admin, job.id);
  }
  redirect("/login?notice=account-deletion-started");
}

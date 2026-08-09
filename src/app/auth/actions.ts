"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/recovery";
import {
  createIsolatedReauthenticationClient,
  findActiveAccountDeletionJob,
  prepareAccountDeletionJobForSignOut,
  processAccountDeletionJob,
  releaseAccountDeletionJobAfterSignOut,
} from "@/lib/account-deletion";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function loginRedirect(kind: "error" | "notice", code: string): never {
  redirect(`/login?${kind}=${encodeURIComponent(code)}`);
}

function credentials(formData: FormData) {
  const email = formData.get("email");
  const password = formData.get("password");
  if (typeof email !== "string" || !email.includes("@")) loginRedirect("error", "invalid-email");
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) loginRedirect("error", "invalid-password");
  return { email: email.trim(), password };
}

export async function signIn(formData: FormData) {
  if (!isSupabaseConfigured()) loginRedirect("error", "supabase-unavailable");
  const passwordCredentials = credentials(formData);
  const passwordClient = createIsolatedReauthenticationClient();
  if (!passwordClient) loginRedirect("error", "supabase-unavailable");
  const { data, error } = await passwordClient.auth.signInWithPassword(passwordCredentials);
  if (error || !data.user || !data.session) loginRedirect("error", "invalid-credentials");

  const admin = createAdminClient();
  if (!admin) {
    await passwordClient.auth.signOut({ scope: "global" });
    loginRedirect("error", "account-status-unavailable");
  }
  let deletionJob;
  try {
    deletionJob = await findActiveAccountDeletionJob(admin, data.user.id);
  } catch {
    await passwordClient.auth.signOut({ scope: "global" });
    loginRedirect("error", "account-status-unavailable");
  }
  if (deletionJob && !(deletionJob.status === "failed" && deletionJob.sessions_revoked_at === null)) {
    if (!deletionJob.sessions_revoked_at) {
      await prepareAccountDeletionJobForSignOut(admin, deletionJob.id, data.user.id);
    }
    const { error: signOutError } = await passwordClient.auth.signOut({ scope: "global" });
    if (signOutError) loginRedirect("error", "account-status-unavailable");
    if (!deletionJob.sessions_revoked_at) {
      await releaseAccountDeletionJobAfterSignOut(admin, deletionJob.id, data.user.id);
    }
    await processAccountDeletionJob(admin, deletionJob.id);
    loginRedirect("notice", "account-deletion-processing");
  }

  const supabase = await createClient();
  if (!supabase) loginRedirect("error", "supabase-unavailable");
  const { error: sessionError } = await supabase.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
  if (sessionError) loginRedirect("error", "invalid-credentials");
  redirect("/dashboard");
}

export async function signUp(formData: FormData) {
  if (!isSupabaseConfigured()) loginRedirect("error", "supabase-unavailable");
  const supabase = await createClient();
  if (!supabase) loginRedirect("error", "supabase-unavailable");
  const { email, password } = credentials(formData);
  const displayNameValue = formData.get("displayName");
  const displayName = typeof displayNameValue === "string" ? displayNameValue.trim().slice(0, 100) : "";
  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin") ?? "http://localhost:3000";
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName || email.split("@")[0] },
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });
  if (error) loginRedirect("error", "signup-failed");
  if (data.session) redirect("/dashboard");
  loginRedirect("notice", "account-created");
}

export async function signOut() {
  const supabase = await createClient();
  if (supabase) await supabase.auth.signOut();
  redirect("/login?notice=signed-out");
}

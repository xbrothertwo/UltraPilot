"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/recovery";
import { isSupabaseConfigured } from "@/lib/supabase/config";
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
  const supabase = await createClient();
  if (!supabase) loginRedirect("error", "supabase-unavailable");
  const { error } = await supabase.auth.signInWithPassword(credentials(formData));
  if (error) loginRedirect("error", "invalid-credentials");
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

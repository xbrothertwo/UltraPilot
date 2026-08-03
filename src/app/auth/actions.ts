"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

function loginRedirect(kind: "error" | "message", text: string): never {
  redirect(`/login?${kind}=${encodeURIComponent(text)}`);
}

function credentials(formData: FormData) {
  const email = formData.get("email");
  const password = formData.get("password");
  if (typeof email !== "string" || !email.includes("@")) loginRedirect("error", "Bitte gib eine gültige E-Mail-Adresse ein.");
  if (typeof password !== "string" || password.length < 8) loginRedirect("error", "Das Passwort muss mindestens acht Zeichen lang sein.");
  return { email: email.trim(), password };
}

export async function signIn(formData: FormData) {
  if (!isSupabaseConfigured()) loginRedirect("error", "Supabase ist nicht konfiguriert.");
  const supabase = await createClient();
  if (!supabase) loginRedirect("error", "Supabase ist nicht konfiguriert.");
  const { error } = await supabase.auth.signInWithPassword(credentials(formData));
  if (error) loginRedirect("error", "Anmeldung fehlgeschlagen. Prüfe E-Mail-Adresse und Passwort.");
  redirect("/dashboard");
}

export async function signUp(formData: FormData) {
  if (!isSupabaseConfigured()) loginRedirect("error", "Supabase ist nicht konfiguriert.");
  const supabase = await createClient();
  if (!supabase) loginRedirect("error", "Supabase ist nicht konfiguriert.");
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
  if (error) loginRedirect("error", error.message);
  if (data.session) redirect("/dashboard");
  loginRedirect("message", "Konto erstellt. Bitte bestätige jetzt den Link in deiner E-Mail.");
}

export async function signOut() {
  const supabase = await createClient();
  if (supabase) await supabase.auth.signOut();
  redirect("/login?message=Du bist abgemeldet.");
}

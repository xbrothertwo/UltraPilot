"use server";

import { revalidatePath } from "next/cache";
import { generateHealthShortcutToken, hashHealthShortcutToken, healthShortcutTokenHint } from "@/lib/apple-health/shortcut-token";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export type HealthShortcutTokenState = { status: "idle" | "success" | "error"; message: string; token?: string };

export async function createHealthShortcutConnection(_previous: HealthShortcutTokenState): Promise<HealthShortcutTokenState> {
  void _previous;
  try {
    const user = await requireUser();
    const supabase = await createClient();
    if (!supabase) throw new Error("Supabase ist nicht verfügbar.");
    const token = generateHealthShortcutToken();
    const { error } = await supabase.from("health_shortcut_tokens").upsert({ user_id: user.id, token_hash: hashHealthShortcutToken(token), token_hint: healthShortcutTokenHint(token), revoked_at: null, last_used_at: null, created_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    revalidatePath("/settings");
    return { status: "success", message: "Verbindungsschlüssel erstellt. Kopiere ihn jetzt – später wird er nicht erneut angezeigt.", token };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Verbindungsschlüssel konnte nicht erstellt werden." };
  }
}

export async function revokeHealthShortcutConnection(): Promise<void> {
  const user = await requireUser();
  const supabase = await createClient();
  if (!supabase) throw new Error("Supabase ist nicht verfügbar.");
  const { error } = await supabase.from("health_shortcut_tokens").update({ revoked_at: new Date().toISOString() }).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}

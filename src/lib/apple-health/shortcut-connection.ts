import { isDemoMode } from "@/lib/demo-data";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export type HealthShortcutStatus = {
  databaseReady: boolean;
  connected: boolean;
  tokenHint: string | null;
  createdAt: string | null;
  lastUsedAt: string | null;
  serviceRoleConfigured: boolean;
};

export async function getHealthShortcutStatus(): Promise<HealthShortcutStatus> {
  const base = { databaseReady: false, connected: false, tokenHint: null, createdAt: null, lastUsedAt: null, serviceRoleConfigured: Boolean(process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY) };
  if (isDemoMode) return base;
  const user = await requireUser();
  const supabase = await createClient();
  if (!supabase) return base;
  const { data, error } = await supabase.from("health_shortcut_tokens").select("token_hint,created_at,last_used_at,revoked_at").eq("user_id", user.id).maybeSingle();
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") return base;
    throw new Error(`Shortcut-Verbindung konnte nicht geladen werden: ${error.message}`);
  }
  return { ...base, databaseReady: true, connected: Boolean(data && !data.revoked_at), tokenHint: data?.token_hint ?? null, createdAt: data?.created_at ?? null, lastUsedAt: data?.last_used_at ?? null };
}

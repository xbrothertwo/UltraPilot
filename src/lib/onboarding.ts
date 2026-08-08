import { isSupabaseConfigured } from "@/lib/supabase/config";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export async function hasCompletedOnboarding(): Promise<boolean> {
  if (!isSupabaseConfigured()) return true;
  await requireUser();
  const supabase = await createClient();
  if (!supabase) return true;
  const { data, error } = await supabase
    .from("profiles")
    .select("onboarding_completed_at")
    .maybeSingle();
  if (error || !data) return true;
  return data.onboarding_completed_at !== null;
}

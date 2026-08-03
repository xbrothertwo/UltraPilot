"use server";

import { revalidatePath } from "next/cache";
import { persistAppleHealthWorkouts, type AppleHealthImportResult } from "@/lib/apple-health/workout-import";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export type { AppleHealthImportResult } from "@/lib/apple-health/workout-import";

export async function importAppleHealthWorkoutBatch(payloads: unknown): Promise<AppleHealthImportResult> {
  const user = await requireUser();
  const supabase = await createClient();
  if (!supabase) throw new Error("Supabase ist nicht verfügbar.");
  const result = await persistAppleHealthWorkouts(supabase, user.id, payloads);
  revalidatePath("/activities");
  revalidatePath("/dashboard");
  revalidatePath("/plan");
  revalidatePath("/progress");
  return result;
}

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import type { NutritionEntry } from "@/lib/nutrition-analysis";

export type SubjectiveFeedback = {
  perceivedExertion: number | null;
  fatigue: number | null;
  mood: number | null;
  stomachTolerance: number | null;
  sleepQuality: number | null;
  painNotes: string;
  notes: string;
};

type NutritionRow = {
  id: string;
  consumed_at_seconds: number | null;
  description: string;
  carbohydrates_grams: number | string | null;
  fluid_milliliters: number | null;
  sodium_milligrams: number | null;
  calories: number | null;
  product_id?: string | null;
  quantity?: number | string;
  entry_method?: "manual" | "timeline" | "bottle_schedule";
  bottle_plan_id?: string | null;
};

function numeric(value: number | string | null): number {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

export async function getActivityJournal(activityId: string): Promise<{ entries: NutritionEntry[]; feedback: SubjectiveFeedback | null; feedbackDetailsReady: boolean }> {
  if (!isSupabaseConfigured()) return { entries: [], feedback: null, feedbackDetailsReady: false };
  await requireUser();
  const supabase = await createClient();
  if (!supabase) return { entries: [], feedback: null, feedbackDetailsReady: false };
  const [nutritionResult, feedbackResult] = await Promise.all([
    supabase.from("nutrition_entries").select("id,consumed_at_seconds,description,carbohydrates_grams,fluid_milliliters,sodium_milligrams,calories,product_id,quantity,entry_method,bottle_plan_id").eq("activity_id", activityId).order("consumed_at_seconds"),
    supabase.from("subjective_feedback").select("perceived_exertion,fatigue,mood,stomach_tolerance,sleep_quality,pain_notes,notes").eq("activity_id", activityId).maybeSingle(),
  ]);
  let nutritionRows: NutritionRow[];
  if (nutritionResult.error) {
    const fallbackNutrition = await supabase.from("nutrition_entries").select("id,consumed_at_seconds,description,carbohydrates_grams,fluid_milliliters,sodium_milligrams,calories").eq("activity_id", activityId).order("consumed_at_seconds");
    if (fallbackNutrition.error) throw new Error(`Ernährung konnte nicht geladen werden: ${fallbackNutrition.error.message}`);
    nutritionRows = (fallbackNutrition.data ?? []) as NutritionRow[];
  } else nutritionRows = (nutritionResult.data ?? []) as NutritionRow[];
  let feedbackDetailsReady = !feedbackResult.error;
  let feedbackData = feedbackResult.data;
  if (feedbackResult.error) {
    const fallback = await supabase.from("subjective_feedback").select("perceived_exertion,fatigue,mood,pain_notes,notes").eq("activity_id", activityId).maybeSingle();
    if (fallback.error) throw new Error(`Feedback konnte nicht geladen werden: ${fallback.error.message}`);
    feedbackData = fallback.data ? { ...fallback.data, stomach_tolerance: null, sleep_quality: null } : null;
    feedbackDetailsReady = false;
  }
  return {
    feedbackDetailsReady,
    entries: nutritionRows.map((row) => ({ id: row.id, consumedAtSeconds: row.consumed_at_seconds, description: row.description, carbohydratesGrams: numeric(row.carbohydrates_grams), fluidMilliliters: numeric(row.fluid_milliliters), sodiumMilligrams: numeric(row.sodium_milligrams), calories: numeric(row.calories), productId: row.product_id ?? null, quantity: numeric(row.quantity ?? 1), entryMethod: row.entry_method ?? "manual", bottlePlanId: row.bottle_plan_id ?? null })),
    feedback: feedbackData ? { perceivedExertion: feedbackData.perceived_exertion, fatigue: feedbackData.fatigue, mood: feedbackData.mood, stomachTolerance: feedbackData.stomach_tolerance, sleepQuality: feedbackData.sleep_quality, painNotes: feedbackData.pain_notes ?? "", notes: feedbackData.notes ?? "" } : null,
  };
}

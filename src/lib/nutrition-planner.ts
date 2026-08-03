import { isSupabaseConfigured } from "@/lib/supabase/config";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export type NutritionProduct = {
  id: string;
  name: string;
  category: "gel" | "bar" | "drink_mix" | "food" | "other";
  servingLabel: string;
  carbohydratesGrams: number;
  fluidMilliliters: number;
  sodiumMilligrams: number;
  calories: number;
};

export type BottlePlan = {
  id: string;
  name: string;
  volumeMilliliters: number;
  carbohydratesGrams: number;
  sodiumMilligrams: number;
  firstDrinkSeconds: number;
  lastDrinkSeconds: number;
  intervalMinutes: number;
  remainingPercent: number;
};

export type BottlePreset = {
  id: string;
  name: string;
  volumeMilliliters: number;
  carbohydratesGrams: number;
  sodiumMilligrams: number;
  calories: number;
};

function numeric(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function getNutritionPlanner(activityId: string): Promise<{ products: NutritionProduct[]; bottles: BottlePlan[]; presets: BottlePreset[]; ready: boolean; presetsReady: boolean }> {
  if (!isSupabaseConfigured()) return { products: [], bottles: [], presets: [], ready: false, presetsReady: false };
  await requireUser();
  const supabase = await createClient();
  if (!supabase) return { products: [], bottles: [], presets: [], ready: false, presetsReady: false };
  const [productsResult, bottlesResult] = await Promise.all([
    supabase.from("nutrition_products").select("id,name,category,serving_label,carbohydrates_grams,fluid_milliliters,sodium_milligrams,calories").order("category").order("name"),
    supabase.from("nutrition_bottle_plans").select("id,name,volume_milliliters,carbohydrates_grams,sodium_milligrams,first_drink_seconds,last_drink_seconds,interval_minutes,remaining_percent").eq("activity_id", activityId).order("created_at"),
  ]);
  if (productsResult.error || bottlesResult.error) return { products: [], bottles: [], presets: [], ready: false, presetsReady: false };
  const presetsResult = await supabase.from("nutrition_bottle_presets").select("id,name,volume_milliliters,carbohydrates_grams,sodium_milligrams,calories").order("name");
  return {
    ready: true,
    presetsReady: !presetsResult.error,
    products: productsResult.data.map((row) => ({ id: row.id, name: row.name, category: row.category as NutritionProduct["category"], servingLabel: row.serving_label, carbohydratesGrams: numeric(row.carbohydrates_grams), fluidMilliliters: numeric(row.fluid_milliliters), sodiumMilligrams: numeric(row.sodium_milligrams), calories: numeric(row.calories) })),
    bottles: bottlesResult.data.map((row) => ({ id: row.id, name: row.name, volumeMilliliters: row.volume_milliliters, carbohydratesGrams: numeric(row.carbohydrates_grams), sodiumMilligrams: row.sodium_milligrams, firstDrinkSeconds: row.first_drink_seconds, lastDrinkSeconds: row.last_drink_seconds, intervalMinutes: row.interval_minutes, remainingPercent: numeric(row.remaining_percent) })),
    presets: (presetsResult.data ?? []).map((row) => ({ id: row.id, name: row.name, volumeMilliliters: row.volume_milliliters, carbohydratesGrams: numeric(row.carbohydrates_grams), sodiumMilligrams: row.sodium_milligrams, calories: row.calories })),
  };
}

export async function getNutritionLibrary(): Promise<{ products: NutritionProduct[]; presets: BottlePreset[]; ready: boolean }> {
  const planner = await getNutritionPlanner("00000000-0000-0000-0000-000000000000");
  return { products: planner.products, presets: planner.presets, ready: planner.ready && planner.presetsReady };
}

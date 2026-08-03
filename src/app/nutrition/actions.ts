"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

function value(formData: FormData, name: string, maximum = 200): string {
  const raw = formData.get(name);
  const result = typeof raw === "string" ? raw.trim() : "";
  if (result.length > maximum) throw new Error(`${name} ist zu lang.`);
  return result;
}

function numberValue(formData: FormData, name: string, maximum: number, integer = false): number {
  const raw = value(formData, name, 30).replace(",", ".");
  const result = raw === "" ? 0 : Number(raw);
  if (!Number.isFinite(result) || result < 0 || result > maximum || (integer && !Number.isInteger(result))) throw new Error(`${name} ist ungültig.`);
  return result;
}

function fail(error: unknown): never {
  redirect(`/nutrition?error=${encodeURIComponent(error instanceof Error ? error.message : "Änderung konnte nicht gespeichert werden.")}`);
}

async function client() {
  const user = await requireUser();
  const supabase = await createClient();
  if (!supabase) throw new Error("Supabase ist nicht verfügbar.");
  return { user, supabase };
}

export async function saveLibraryProduct(formData: FormData) {
  try {
    const { user, supabase } = await client();
    const id = value(formData, "id");
    const name = value(formData, "name");
    if (!name) throw new Error("Der Produktname fehlt.");
    const categoryValue = value(formData, "category");
    const category = ["gel", "bar", "drink_mix", "food", "other"].includes(categoryValue) ? categoryValue : "other";
    const record = { user_id: user.id, name, category, serving_label: value(formData, "servingLabel", 80) || "1 Portion", carbohydrates_grams: numberValue(formData, "carbohydrates", 1000), fluid_milliliters: numberValue(formData, "fluid", 5000, true), sodium_milligrams: numberValue(formData, "sodium", 10000, true), calories: numberValue(formData, "calories", 10000, true), updated_at: new Date().toISOString() };
    const result = id ? await supabase.from("nutrition_products").update(record).eq("id", id) : await supabase.from("nutrition_products").insert({ ...record, source: "manual" });
    if (result.error) throw new Error(result.error.message);
    revalidatePath("/nutrition");
    revalidatePath("/activities/[id]", "page");
  } catch (error) { fail(error); }
  redirect("/nutrition?saved=product");
}

export async function removeLibraryProduct(productId: string) {
  try {
    const { supabase } = await client();
    const { error } = await supabase.from("nutrition_products").delete().eq("id", productId);
    if (error) throw new Error(error.message);
    revalidatePath("/nutrition");
  } catch (error) { fail(error); }
  redirect("/nutrition?saved=deleted");
}

export async function saveBottlePreset(formData: FormData) {
  try {
    const { user, supabase } = await client();
    const id = value(formData, "id");
    const name = value(formData, "name");
    if (!name) throw new Error("Der Rezeptname fehlt.");
    const record = { user_id: user.id, name, volume_milliliters: numberValue(formData, "volume", 5000, true), carbohydrates_grams: numberValue(formData, "carbohydrates", 2000), sodium_milligrams: numberValue(formData, "sodium", 20000, true), calories: numberValue(formData, "calories", 20000, true), updated_at: new Date().toISOString() };
    if (record.volume_milliliters <= 0) throw new Error("Das Flaschenvolumen muss größer als null sein.");
    const result = id ? await supabase.from("nutrition_bottle_presets").update(record).eq("id", id) : await supabase.from("nutrition_bottle_presets").insert(record);
    if (result.error) throw new Error(result.error.message);
    revalidatePath("/nutrition");
    revalidatePath("/activities/[id]", "page");
  } catch (error) { fail(error); }
  redirect("/nutrition?saved=bottle");
}

export async function removeBottlePreset(presetId: string) {
  try {
    const { supabase } = await client();
    const { error } = await supabase.from("nutrition_bottle_presets").delete().eq("id", presetId);
    if (error) throw new Error(error.message);
    revalidatePath("/nutrition");
  } catch (error) { fail(error); }
  redirect("/nutrition?saved=deleted");
}


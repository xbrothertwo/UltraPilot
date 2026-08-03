"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { buildBottleSchedule } from "@/lib/bottle-schedule";

function optionalNumber(formData: FormData, name: string, minimum: number, maximum: number): number | null {
  const raw = formData.get(name);
  if (typeof raw !== "string" || raw.trim() === "") return null;
  const value = Number(raw.replace(",", "."));
  if (!Number.isFinite(value) || value < minimum || value > maximum) throw new Error(`${name} ist ungültig.`);
  return value;
}

function optionalInteger(formData: FormData, name: string, minimum: number, maximum: number): number | null {
  const value = optionalNumber(formData, name, minimum, maximum);
  if (value !== null && !Number.isInteger(value)) throw new Error(`${name} muss eine ganze Zahl sein.`);
  return value;
}

function text(formData: FormData, name: string, maximumLength: number): string {
  const raw = formData.get(name);
  if (typeof raw !== "string") return "";
  const value = raw.trim();
  if (value.length > maximumLength) throw new Error(`${name} ist zu lang.`);
  return value;
}

async function context(activityId: string) {
  const user = await requireUser();
  const supabase = await createClient();
  if (!supabase) throw new Error("Supabase ist nicht verfügbar.");
  const { data, error } = await supabase.from("activities").select("id,elapsed_time_seconds").eq("id", activityId).maybeSingle();
  if (error || !data) throw new Error("Aktivität wurde nicht gefunden.");
  return { user, supabase, elapsedTimeSeconds: data.elapsed_time_seconds as number };
}

function destination(activityId: string, state: string, message?: string): string {
  const query = message ? `error=${encodeURIComponent(message)}` : `saved=${state}`;
  return `/activities/${activityId}?${query}#journal`;
}

export async function saveNutritionEntry(activityId: string, formData: FormData) {
  try {
    const { user, supabase, elapsedTimeSeconds } = await context(activityId);
    const hoursAfterStart = optionalInteger(formData, "Stunden", 0, Math.floor(elapsedTimeSeconds / 3600));
    const minutesAfterStart = optionalInteger(formData, "Minuten", 0, 59);
    const consumedAtSeconds = hoursAfterStart === null && minutesAfterStart === null ? null : Math.round((hoursAfterStart ?? 0) * 3600 + (minutesAfterStart ?? 0) * 60);
    if (consumedAtSeconds !== null && consumedAtSeconds > elapsedTimeSeconds) throw new Error("Der Zeitpunkt liegt nach dem Ende der Aktivität.");
    const description = text(formData, "Beschreibung", 200);
    if (!description) throw new Error("Bitte eine Beschreibung eintragen.");
    const record = {
      activity_id: activityId,
      user_id: user.id,
      consumed_at_seconds: consumedAtSeconds,
      description,
      carbohydrates_grams: optionalNumber(formData, "Kohlenhydrate", 0, 5000),
      fluid_milliliters: optionalInteger(formData, "Flüssigkeit", 0, 100000),
      sodium_milligrams: optionalInteger(formData, "Natrium", 0, 100000),
      calories: optionalInteger(formData, "Kalorien", 0, 50000),
    };
    const { error } = await supabase.from("nutrition_entries").insert(record);
    if (error) throw new Error(error.message);
    revalidatePath(`/activities/${activityId}`);
  } catch (error) {
    redirect(destination(activityId, "", error instanceof Error ? error.message : "Eintrag konnte nicht gespeichert werden."));
  }
  redirect(destination(activityId, "nutrition"));
}

export async function deleteNutritionEntry(activityId: string, entryId: string) {
  try {
    const { supabase } = await context(activityId);
    const { data: entry } = await supabase.from("nutrition_entries").select("entry_method").eq("id", entryId).eq("activity_id", activityId).maybeSingle();
    if (entry?.entry_method === "bottle_schedule") throw new Error("Dieser Eintrag gehört zu einem Flaschenplan. Bitte den gesamten Plan löschen.");
    const { error } = await supabase.from("nutrition_entries").delete().eq("id", entryId).eq("activity_id", activityId);
    if (error) throw new Error(error.message);
    revalidatePath(`/activities/${activityId}`);
  } catch (error) {
    redirect(destination(activityId, "", error instanceof Error ? error.message : "Eintrag konnte nicht gelöscht werden."));
  }
  redirect(destination(activityId, "deleted"));
}

export async function saveSubjectiveFeedback(activityId: string, formData: FormData) {
  try {
    const { user, supabase } = await context(activityId);
    const { error } = await supabase.from("subjective_feedback").upsert({
      activity_id: activityId,
      user_id: user.id,
      perceived_exertion: optionalInteger(formData, "Anstrengung", 1, 10),
      fatigue: optionalInteger(formData, "Beinmüdigkeit", 1, 10),
      mood: optionalInteger(formData, "Energiegefühl", 1, 10),
      stomach_tolerance: optionalInteger(formData, "Magenverträglichkeit", 1, 10),
      sleep_quality: optionalInteger(formData, "Schlafqualität", 1, 10),
      pain_notes: text(formData, "Beschwerden", 1000) || null,
      notes: text(formData, "Notizen", 3000) || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "activity_id" });
    if (error) throw new Error(error.message);
    revalidatePath(`/activities/${activityId}`);
    revalidatePath("/dashboard");
    revalidatePath("/progress");
  } catch (error) {
    redirect(destination(activityId, "", error instanceof Error ? error.message : "Feedback konnte nicht gespeichert werden."));
  }
  redirect(destination(activityId, "feedback"));
}

export async function makeFutureWorkoutEasy(activityId: string, formData: FormData) {
  try {
    const workoutId = formData.get("workoutId");
    if (typeof workoutId !== "string" || !workoutId) throw new Error("Nächste Einheit fehlt.");
    const { user, supabase } = await context(activityId);
    const { data: workout, error: readError } = await supabase.from("planned_workouts").select("id,sport_type,status,scheduled_date,planned_duration_minutes").eq("id", workoutId).eq("user_id", user.id).maybeSingle();
    if (readError || !workout) throw new Error(readError?.message ?? "Nächste Einheit wurde nicht gefunden.");
    const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    if (workout.sport_type !== "cycling" || workout.status !== "planned" || workout.scheduled_date < today) throw new Error("Nur eine zukünftige, offene Radfahrt kann angepasst werden.");
    const duration = Number(workout.planned_duration_minutes ?? 60);
    const { error } = await supabase.from("planned_workouts").update({ title: "Lockere Ausdauerfahrt", intensity: "easy", description: `Durchgehend locker in Z1–Z2 fahren.\nTrittfrequenz angenehm halten und Belastungsspitzen vermeiden.\nDie Einheit soll sich am Ende leichter als am Anfang anfühlen.`, planned_duration_minutes: duration, updated_at: new Date().toISOString() }).eq("id", workoutId).eq("user_id", user.id);
    if (error) throw new Error(error.message);
    revalidatePath(`/activities/${activityId}`);
    revalidatePath("/dashboard");
    revalidatePath("/plan");
  } catch (error) {
    redirect(destination(activityId, "", error instanceof Error ? error.message : "Nächste Einheit konnte nicht angepasst werden."));
  }
  redirect(`/activities/${activityId}?saved=next-easy#debrief`);
}

export async function saveNutritionProduct(activityId: string, formData: FormData) {
  try {
    const { user, supabase } = await context(activityId);
    const name = text(formData, "Produktname", 200);
    const servingLabel = text(formData, "Portion", 80) || "1 Portion";
    const categoryValue = formData.get("Kategorie");
    const categories = ["gel", "bar", "drink_mix", "food", "other"] as const;
    const category = typeof categoryValue === "string" && categories.includes(categoryValue as typeof categories[number]) ? categoryValue : "other";
    if (!name) throw new Error("Bitte einen Produktnamen eintragen.");
    const { error } = await supabase.from("nutrition_products").insert({ user_id: user.id, name, category, serving_label: servingLabel, carbohydrates_grams: optionalNumber(formData, "Produkt Kohlenhydrate", 0, 1000) ?? 0, fluid_milliliters: optionalInteger(formData, "Produkt Flüssigkeit", 0, 5000) ?? 0, sodium_milligrams: optionalInteger(formData, "Produkt Natrium", 0, 10000) ?? 0, calories: optionalInteger(formData, "Produkt Kalorien", 0, 10000) ?? 0, source: "manual" });
    if (error) throw new Error(error.message);
    revalidatePath(`/activities/${activityId}`);
  } catch (error) {
    redirect(destination(activityId, "", error instanceof Error ? error.message : "Produkt konnte nicht gespeichert werden."));
  }
  redirect(destination(activityId, "product"));
}

export async function deleteNutritionProduct(activityId: string, productId: string) {
  try {
    const { supabase } = await context(activityId);
    const { error } = await supabase.from("nutrition_products").delete().eq("id", productId);
    if (error) throw new Error(error.message);
    revalidatePath(`/activities/${activityId}`);
  } catch (error) {
    redirect(destination(activityId, "", error instanceof Error ? error.message : "Produkt konnte nicht gelöscht werden."));
  }
  redirect(destination(activityId, "product-deleted"));
}

export async function addProductConsumption(activityId: string, formData: FormData) {
  try {
    const { user, supabase, elapsedTimeSeconds } = await context(activityId);
    const productId = formData.get("productId");
    if (typeof productId !== "string") throw new Error("Produkt fehlt.");
    const consumedAtSeconds = optionalInteger(formData, "consumedAtSeconds", 0, elapsedTimeSeconds);
    const quantity = optionalNumber(formData, "quantity", 0.1, 20) ?? 1;
    if (consumedAtSeconds === null) throw new Error("Bitte einen Zeitpunkt wählen.");
    const { data: product, error: productError } = await supabase.from("nutrition_products").select("id,name,serving_label,carbohydrates_grams,fluid_milliliters,sodium_milligrams,calories").eq("id", productId).maybeSingle();
    if (productError || !product) throw new Error("Produkt wurde nicht gefunden.");
    const { error } = await supabase.from("nutrition_entries").insert({ activity_id: activityId, user_id: user.id, product_id: product.id, quantity, entry_method: "timeline", consumed_at_seconds: consumedAtSeconds, description: `${product.name} · ${quantity.toLocaleString("de-DE")} × ${product.serving_label}`, carbohydrates_grams: numericProduct(product.carbohydrates_grams) * quantity, fluid_milliliters: Math.round(product.fluid_milliliters * quantity), sodium_milligrams: Math.round(product.sodium_milligrams * quantity), calories: Math.round(product.calories * quantity) });
    if (error) throw new Error(error.message);
    revalidatePath(`/activities/${activityId}`);
    revalidatePath("/dashboard");
  } catch (error) {
    redirect(destination(activityId, "", error instanceof Error ? error.message : "Verpflegung konnte nicht eingetragen werden."));
  }
  redirect(destination(activityId, "timeline"));
}

function numericProduct(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function timeFromForm(formData: FormData, prefix: string): number {
  const hours = optionalInteger(formData, `${prefix} Stunden`, 0, 1000) ?? 0;
  const minutes = optionalInteger(formData, `${prefix} Minuten`, 0, 59) ?? 0;
  return hours * 3600 + minutes * 60;
}

export async function saveBottlePlan(activityId: string, formData: FormData) {
  try {
    const { user, supabase, elapsedTimeSeconds } = await context(activityId);
    const name = text(formData, "Flaschenname", 200) || "Flasche";
    const firstDrinkSeconds = timeFromForm(formData, "Erster Schluck");
    const lastDrinkSeconds = timeFromForm(formData, "Letzter Schluck");
    if (lastDrinkSeconds < firstDrinkSeconds || lastDrinkSeconds > elapsedTimeSeconds) throw new Error("Der Trinkzeitraum liegt außerhalb der Aktivität.");
    const presetIdValue = formData.get("presetId");
    const presetId = typeof presetIdValue === "string" && presetIdValue ? presetIdValue : null;
    const { data: preset, error: presetError } = presetId ? await supabase.from("nutrition_bottle_presets").select("name,volume_milliliters,carbohydrates_grams,sodium_milligrams,calories").eq("id", presetId).maybeSingle() : { data: null, error: null };
    if (presetId && (presetError || !preset)) throw new Error("Flaschenrezept wurde nicht gefunden.");
    const effectiveName = preset?.name ?? name;
    const input = { firstDrinkSeconds, lastDrinkSeconds, intervalMinutes: optionalInteger(formData, "Intervall", 5, 240) ?? 20, remainingPercent: optionalNumber(formData, "Restmenge", 0, 100) ?? 0, volumeMilliliters: preset?.volume_milliliters ?? optionalInteger(formData, "Flaschenvolumen", 1, 5000) ?? 750, carbohydratesGrams: preset ? numericProduct(preset.carbohydrates_grams) : optionalNumber(formData, "Flasche Kohlenhydrate", 0, 2000) ?? 0, sodiumMilligrams: preset?.sodium_milligrams ?? optionalInteger(formData, "Flasche Natrium", 0, 20000) ?? 0, calories: preset?.calories ?? optionalInteger(formData, "Flasche Kalorien", 0, 20000) ?? 0 };
    const events = buildBottleSchedule(input);
    if (!events.length) throw new Error("Aus diesen Angaben konnte kein Trinkplan erstellt werden.");
    const { data: plan, error: planError } = await supabase.from("nutrition_bottle_plans").insert({ activity_id: activityId, user_id: user.id, preset_id: presetId, name: effectiveName, volume_milliliters: input.volumeMilliliters, carbohydrates_grams: input.carbohydratesGrams, sodium_milligrams: input.sodiumMilligrams, calories: input.calories, first_drink_seconds: input.firstDrinkSeconds, last_drink_seconds: input.lastDrinkSeconds, interval_minutes: input.intervalMinutes, remaining_percent: input.remainingPercent }).select("id").single();
    if (planError || !plan) throw new Error(planError?.message ?? "Flaschenplan konnte nicht gespeichert werden.");
    const consumedPercent = 100 - input.remainingPercent;
    const { error: entriesError } = await supabase.from("nutrition_entries").insert(events.map((event) => ({ activity_id: activityId, user_id: user.id, bottle_plan_id: plan.id, quantity: 1, entry_method: "bottle_schedule", consumed_at_seconds: event.consumedAtSeconds, description: `${effectiveName} · abgeleitet (${consumedPercent.toLocaleString("de-DE")} % getrunken)`, carbohydrates_grams: event.carbohydratesGrams, fluid_milliliters: event.fluidMilliliters, sodium_milligrams: event.sodiumMilligrams, calories: event.calories })));
    if (entriesError) { await supabase.from("nutrition_bottle_plans").delete().eq("id", plan.id); throw new Error(entriesError.message); }
    revalidatePath(`/activities/${activityId}`);
    revalidatePath("/dashboard");
  } catch (error) {
    redirect(destination(activityId, "", error instanceof Error ? error.message : "Flaschenplan konnte nicht gespeichert werden."));
  }
  redirect(destination(activityId, "bottle"));
}

export async function deleteBottlePlan(activityId: string, bottlePlanId: string) {
  try {
    const { supabase } = await context(activityId);
    const { error } = await supabase.from("nutrition_bottle_plans").delete().eq("id", bottlePlanId).eq("activity_id", activityId);
    if (error) throw new Error(error.message);
    revalidatePath(`/activities/${activityId}`);
    revalidatePath("/dashboard");
  } catch (error) {
    redirect(destination(activityId, "", error instanceof Error ? error.message : "Flaschenplan konnte nicht gelöscht werden."));
  }
  redirect(destination(activityId, "bottle-deleted"));
}

export async function updateNutritionTimelineEntry(activityId: string, formData: FormData) {
  try {
    const { supabase, elapsedTimeSeconds } = await context(activityId);
    const entryId = formData.get("entryId");
    if (typeof entryId !== "string") throw new Error("Eintrag fehlt.");
    const consumedAtSeconds = optionalInteger(formData, "consumedAtSeconds", 0, elapsedTimeSeconds);
    const quantity = optionalNumber(formData, "quantity", 0.1, 20) ?? 1;
    if (consumedAtSeconds === null) throw new Error("Zeitpunkt fehlt.");
    const { data: entry, error: entryError } = await supabase.from("nutrition_entries").select("id,entry_method,product_id,description").eq("id", entryId).eq("activity_id", activityId).maybeSingle();
    if (entryError || !entry) throw new Error("Eintrag wurde nicht gefunden.");
    if (entry.entry_method === "bottle_schedule") throw new Error("Abgeleitete Flascheneinträge werden über den Flaschenplan geändert.");
    let changes: Record<string, unknown> = { consumed_at_seconds: consumedAtSeconds };
    if (entry.product_id) {
      const { data: product, error: productError } = await supabase.from("nutrition_products").select("name,serving_label,carbohydrates_grams,fluid_milliliters,sodium_milligrams,calories").eq("id", entry.product_id).maybeSingle();
      if (productError || !product) throw new Error("Das zugehörige Produkt wurde nicht gefunden.");
      changes = { ...changes, quantity, description: `${product.name} · ${quantity.toLocaleString("de-DE")} × ${product.serving_label}`, carbohydrates_grams: numericProduct(product.carbohydrates_grams) * quantity, fluid_milliliters: Math.round(product.fluid_milliliters * quantity), sodium_milligrams: Math.round(product.sodium_milligrams * quantity), calories: Math.round(product.calories * quantity) };
    }
    const { error } = await supabase.from("nutrition_entries").update(changes).eq("id", entryId).eq("activity_id", activityId);
    if (error) throw new Error(error.message);
    revalidatePath(`/activities/${activityId}`);
    revalidatePath("/dashboard");
  } catch (error) {
    redirect(destination(activityId, "", error instanceof Error ? error.message : "Timeline-Eintrag konnte nicht geändert werden."));
  }
  redirect(destination(activityId, "timeline-updated"));
}

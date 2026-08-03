"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export async function renameActivity(activityId: string, formData: FormData) {
  let message: string | null = null;
  try {
    const value = formData.get("title");
    const title = typeof value === "string" ? value.trim() : "";
    if (!title) throw new Error("Bitte gib einen Namen ein.");
    if (title.length > 200) throw new Error("Der Name darf höchstens 200 Zeichen lang sein.");
    const user = await requireUser();
    const supabase = await createClient();
    if (!supabase) throw new Error("Supabase ist nicht verfügbar.");
    const { data, error } = await supabase.from("activities").update({ title }).eq("id", activityId).eq("user_id", user.id).select("id").maybeSingle();
    if (error || !data) throw new Error(error?.message ?? "Aktivität wurde nicht gefunden.");
    revalidatePath(`/activities/${activityId}`);
    revalidatePath("/activities");
    revalidatePath("/dashboard");
    revalidatePath("/progress");
  } catch (error) {
    message = error instanceof Error ? error.message : "Aktivität konnte nicht umbenannt werden.";
  }
  if (message) redirect(`/activities/${activityId}?error=${encodeURIComponent(message)}`);
  redirect(`/activities/${activityId}?saved=renamed`);
}

export async function deleteActivity(activityId: string) {
  let message: string | null = null;
  try {
    const user = await requireUser();
    const supabase = await createClient();
    if (!supabase) throw new Error("Supabase ist nicht verfügbar.");
    const { data: activity, error: activityError } = await supabase.from("activities").select("id").eq("id", activityId).maybeSingle();
    if (activityError || !activity) throw new Error("Aktivität wurde nicht gefunden oder gehört nicht zu dir.");
    const { data: files, error: filesError } = await supabase.from("activity_files").select("storage_path").eq("activity_id", activityId);
    if (filesError) throw new Error(`Dateiliste konnte nicht geladen werden: ${filesError.message}`);
    const paths = (files ?? []).map((file) => file.storage_path).filter((path): path is string => typeof path === "string" && path.startsWith(`${user.id}/`));
    if (paths.length !== (files ?? []).length) throw new Error("Eine gespeicherte Datei besitzt einen unerwarteten Pfad. Löschung wurde abgebrochen.");
    if (paths.length) {
      const { error: storageError } = await supabase.storage.from("activity-files").remove(paths);
      if (storageError) throw new Error(`Dateien konnten nicht gelöscht werden: ${storageError.message}`);
    }
    const { error: deleteError } = await supabase.from("activities").delete().eq("id", activityId);
    if (deleteError) throw new Error(`Aktivität konnte nicht gelöscht werden: ${deleteError.message}`);
    revalidatePath("/activities");
    revalidatePath("/dashboard");
  } catch (error) {
    message = error instanceof Error ? error.message : "Aktivität konnte nicht gelöscht werden.";
  }
  if (message) redirect(`/activities/${activityId}?error=${encodeURIComponent(message)}`);
  redirect("/activities?deleted=1");
}

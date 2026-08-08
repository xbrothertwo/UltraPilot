"use server";

import { redirect } from "next/navigation";
import { buildOnboardingRpcArguments } from "@/lib/onboarding-input";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export async function completeOnboarding(formData: FormData) {
  try {
    const rpcArguments =
      buildOnboardingRpcArguments(formData);

    await requireUser();

    const supabase = await createClient();

    if (!supabase) {
      throw new Error("Supabase ist nicht verfügbar.");
    }

    const { error } = await supabase.rpc(
      "complete_onboarding",
      rpcArguments,
    );

    if (error) {
      throw new Error(error.message);
    }
  } catch (error) {
    redirect(
      `/onboarding?error=${encodeURIComponent(
        error instanceof Error
          ? error.message
          : "Profil konnte nicht gespeichert werden.",
      )}`,
    );
  }

  redirect("/dashboard?saved=onboarding");
}
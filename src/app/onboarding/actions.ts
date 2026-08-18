"use server";

import { redirect } from "next/navigation";
import { generateWeeklyPlan } from "@/app/plan/actions";
import { buildOnboardingV2RpcArguments } from "@/lib/onboarding-input";
import { firstPlanningWeekStart } from "@/lib/onboarding-planning";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export async function completeOnboarding(formData: FormData) {
  let firstPlanWeek = "";
  try {
    const rpcArguments = buildOnboardingV2RpcArguments(formData);
    firstPlanWeek = firstPlanningWeekStart(rpcArguments.p_available_weekdays);

    await requireUser();

    const supabase = await createClient();

    if (!supabase) {
      throw new Error("Supabase ist nicht verfügbar.");
    }

    const { error } = await supabase.rpc(
      "complete_onboarding_v2",
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

  const planForm = new FormData();
  planForm.set("week", firstPlanWeek);
  planForm.set("firstRun", "true");
  await generateWeeklyPlan(planForm);
}

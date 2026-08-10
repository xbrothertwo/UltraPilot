import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { hasCompletedOnboarding } from "@/lib/onboarding";
import { OnboardingWizard } from "@/components/onboarding-wizard";

export const metadata = { title: "Willkommen" };
export const dynamic = "force-dynamic";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const query = await searchParams;
  if (isSupabaseConfigured()) {
    const user = await getCurrentUser();
    if (!user) redirect("/login");
    if (await hasCompletedOnboarding()) redirect("/dashboard");
  }
  return <OnboardingWizard error={query.error ?? null} />;
}

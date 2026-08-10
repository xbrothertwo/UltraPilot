import type { ReactNode } from "react";
import { AppNavigation } from "@/components/app-navigation";
import { AppShell } from "@/components/app-shell";
import {
  defaultPlanningGoalSummary,
  getPlanningGoalSummary,
} from "@/lib/planning/data";
import { getCurrentUser } from "@/lib/supabase/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default async function AuthenticatedAppLayout({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured();
  const user = configured ? await getCurrentUser() : null;
  const missionGoal = configured && user
    ? await getPlanningGoalSummary()
    : defaultPlanningGoalSummary;

  return (
    <AppShell
      navigation={(
        <AppNavigation
          configured={configured}
          userEmail={user?.email ?? null}
          missionGoal={missionGoal}
        />
      )}
    >
      {children}
    </AppShell>
  );
}

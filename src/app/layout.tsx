import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppNavigation } from "@/components/app-navigation";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";
import { getCurrentUser } from "@/lib/supabase/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  defaultPlanningGoalSummary,
  getPlanningGoalSummary,
} from "@/lib/planning/data";

export const metadata: Metadata = {
  title: { default: "UltraPilot", template: "%s · UltraPilot" },
  description: "Dein persönliches Cockpit für Rad- und Ultracycling-Training",
  applicationName: "UltraPilot",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "UltraPilot",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#07162d" },
    { media: "(prefers-color-scheme: dark)", color: "#07162d" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const configured = isSupabaseConfigured();
  const user = configured ? await getCurrentUser() : null;
  const missionGoal =
    configured && user
      ? await getPlanningGoalSummary()
      : defaultPlanningGoalSummary;
  return (
    <html lang="de">
      <body>
        <ServiceWorkerRegistration />
        <AppNavigation
          configured={configured}
          userEmail={user?.email ?? null}
          missionGoal={missionGoal}
        />
        <main className="mobile-safe-main min-h-screen px-4 pb-28 pt-5 sm:px-6 sm:pt-7 lg:ml-[18rem] lg:px-10 lg:pb-14 lg:pt-10 xl:px-14">
          <div className="mx-auto max-w-[92rem]">{children}</div>
        </main>
      </body>
    </html>
  );
}

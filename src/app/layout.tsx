import type { Metadata } from "next";
import "./globals.css";
import { AppNavigation } from "@/components/app-navigation";
import { getCurrentUser } from "@/lib/supabase/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: { default: "UltraPilot", template: "%s · UltraPilot" },
  description: "Dein persönliches Cockpit für Rad- und Ultracycling-Training",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const configured = isSupabaseConfigured();
  const user = configured ? await getCurrentUser() : null;
  return (
    <html lang="de">
      <body>
        <AppNavigation configured={configured} userEmail={user?.email ?? null} />
        <main className="min-h-screen px-4 pb-28 pt-7 sm:px-6 lg:ml-[17rem] lg:px-10 lg:pb-12 lg:pt-10 xl:px-14">
          <div className="mx-auto max-w-[88rem]">{children}</div>
        </main>
      </body>
    </html>
  );
}

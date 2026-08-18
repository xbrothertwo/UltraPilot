import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/theme-toggle";

export default function FocusedOnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 sm:py-8 lg:py-10">
      <div className="mx-auto mb-4 flex max-w-4xl justify-end">
        <ThemeToggle
          showLabel
          className="secondary-button !min-h-10 !px-3 !py-2 text-xs"
        />
      </div>
      {children}
    </main>
  );
}

import type { ReactNode } from "react";

export function AppShell({ navigation, children }: { navigation: ReactNode; children: ReactNode }) {
  return (
    <div className="min-h-screen" data-testid="app-shell">
      {navigation}
      <main className="mobile-safe-main min-h-screen px-4 pb-28 pt-5 sm:px-6 sm:pt-7 lg:ml-[15rem] lg:px-10 lg:pb-14 lg:pt-10 xl:px-14">
        <div className="mx-auto max-w-[86rem]">{children}</div>
      </main>
    </div>
  );
}

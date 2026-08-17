"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { signOut } from "@/app/auth/actions";
import { ThemeToggle } from "@/components/theme-toggle";

type IconName =
  | "today"
  | "mission"
  | "plan"
  | "progress"
  | "activities"
  | "nutrition"
  | "gym"
  | "settings"
  | "plus"
  | "more"
  | "close"
  | "bell";
type NavigationLink = {
  href: string;
  label: string;
  icon: IconName;
  soon?: boolean;
};

type NavigationGoal = {
  eventName: string | null;
  targetYear: number | null;
  eventDistanceKm: number | null;
};

type AppNavigationProps = {
  configured: boolean;
  userEmail: string | null;
  missionGoal: NavigationGoal;
};

const links: NavigationLink[] = [
  { href: "/dashboard", label: "Heute", icon: "today" },
  { href: "/plan", label: "Plan", icon: "plan" },
  { href: "/activities", label: "Aktivitäten", icon: "activities" },
  { href: "/progress", label: "Fortschritt", icon: "progress" },
  { href: "/gym", label: "Gym", icon: "gym" },
  { href: "/mission", label: "Missionen", icon: "mission" },
  { href: "/nutrition", label: "Verpflegung", icon: "nutrition" },
  { href: "/notifications", label: "Benachrichtigungen", icon: "bell", soon: true },
];

function Icon({
  name,
  className = "size-5",
}: {
  name: IconName;
  className?: string;
}) {
  const paths: Record<IconName, React.ReactNode> = {
    today: (
      <>
        <path d="M5 3v3M15 3v3M3 9h14" />
        <rect x="3" y="5" width="14" height="12" rx="2" />
        <path d="m8 13 2 2 4-4" />
      </>
    ),
    mission: (
      <>
        <path d="M4 17V3" />
        <path d="M5 4h9l-2 3 2 3H5" />
        <path d="m7 17 3-5 3 5" />
      </>
    ),
    plan: (
      <>
        <path d="M4 3h12v14H4z" />
        <path d="M7 7h6M7 10h6M7 13h3" />
      </>
    ),
    progress: (
      <>
        <path d="M3 16 8 11l3 2 6-8" />
        <path d="M13 5h4v4" />
      </>
    ),
    activities: (
      <>
        <circle cx="10" cy="10" r="7" />
        <path d="M10 6v4l3 2" />
      </>
    ),
    nutrition: (
      <>
        <path d="M6 3v6a4 4 0 0 0 8 0V3M6 6h8M10 13v4" />
      </>
    ),
    gym: (
      <>
        <path d="M3 8v4M6 6v8M14 6v8M17 8v4M6 10h8" />
      </>
    ),
    settings: (
      <>
        <circle cx="10" cy="10" r="3" />
        <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.3 4.3l1.4 1.4M14.3 14.3l1.4 1.4M15.7 4.3l-1.4 1.4M5.7 14.3l-1.4 1.4" />
      </>
    ),
    bell: (
      <>
        <path d="M5 8a5 5 0 0 1 10 0v3l1.5 3h-13L5 11V8Z" />
        <path d="M8 16a2 2 0 0 0 4 0" />
      </>
    ),
    plus: <path d="M10 4v12M4 10h12" />,
    more: (
      <>
        <circle cx="4" cy="10" r="1" fill="currentColor" stroke="none" />
        <circle cx="10" cy="10" r="1" fill="currentColor" stroke="none" />
        <circle cx="16" cy="10" r="1" fill="currentColor" stroke="none" />
      </>
    ),
    close: <path d="m5 5 10 10M15 5 5 15" />,
  };
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`${className} shrink-0`}
    >
      {paths[name]}
    </svg>
  );
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/activities")
    return (
      pathname === href ||
      (pathname.startsWith("/activities/") && pathname !== "/activities/upload")
    );
  return pathname === href || pathname.startsWith(`${href}/`);
}

const DESKTOP_MEDIA_QUERY = "(min-width: 64rem)";

function subscribeToDesktopBreakpoint(callback: () => void): () => void {
  if (typeof window.matchMedia !== "function") return () => undefined;
  const media = window.matchMedia(DESKTOP_MEDIA_QUERY);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

function getDesktopBreakpoint(): boolean {
  return typeof window.matchMedia === "function"
    && window.matchMedia(DESKTOP_MEDIA_QUERY).matches;
}

function useDesktopNavigation(): boolean | null {
  return useSyncExternalStore(
    subscribeToDesktopBreakpoint,
    getDesktopBreakpoint,
    () => null,
  );
}

export function SidebarNavigation({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <aside aria-hidden={!active} inert={!active} data-testid="desktop-navigation" className="fixed inset-y-0 left-0 z-30 hidden w-[15rem] flex-col overflow-hidden border-r border-[var(--line)] bg-[var(--shell)] text-[var(--ink)] lg:flex">
      {children}
    </aside>
  );
}

export function MobileNavigation({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <nav aria-label="Mobile Hauptnavigation" aria-hidden={!active} inert={!active} data-testid="mobile-navigation" className="mobile-safe-nav fixed inset-x-2 bottom-2 z-40 grid grid-cols-5 items-end rounded-[1.4rem] border border-[var(--line)] bg-[var(--shell)]/94 px-1.5 pb-1.5 pt-1 text-[var(--ink)] shadow-[0_18px_50px_var(--shadow-color)] backdrop-blur-2xl lg:hidden">
      {children}
    </nav>
  );
}

export function AppNavigation({
  configured,
  userEmail,
  missionGoal,
}: AppNavigationProps) {
  const pathname = usePathname();
  const desktop = useDesktopNavigation();
  const desktopActive = desktop === true;
  const mobileActive = desktop === false;
  const [moreOpen, setMoreOpen] = useState(false);
  const findLink = (href: string) => links.find((link) => link.href === href)!;
  const mobileMainLinks = [
    findLink("/dashboard"),
    findLink("/plan"),
    findLink("/activities"),
    findLink("/progress"),
  ];
  const mobileMoreLinks: NavigationLink[] = [
    findLink("/gym"),
    findLink("/mission"),
    findLink("/nutrition"),
    findLink("/notifications"),
    { href: "/settings", label: "Einstellungen", icon: "settings" },
  ];
  const moreActive = mobileMoreLinks.some((link) =>
    isActive(pathname, link.href),
  );

  const missionHeadlineParts = [
    missionGoal.eventName?.trim() || null,
    missionGoal.eventDistanceKm !== null
      ? `${missionGoal.eventDistanceKm.toLocaleString("de-DE")} km`
      : null,
  ].filter(Boolean);

  const missionHeadline =
    missionHeadlineParts.length > 0
      ? missionHeadlineParts.join(" · ")
      : "Noch kein Ausdauerziel";

  const missionSubline =
    missionGoal.targetYear !== null
      ? `Zielkorridor ${missionGoal.targetYear}`
      : "Zieljahr nicht festgelegt";

  useEffect(() => {
    if (!moreOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [moreOpen]);

  return (
    <>
      <SidebarNavigation active={desktopActive}>
        <div className="pointer-events-none absolute -left-32 -top-28 size-80 rounded-full bg-[var(--brand-blossom)]/25 blur-3xl" />
        <div className="relative flex h-full flex-col p-5">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 rounded-2xl px-2 py-3"
          >
            <span className="grid size-11 place-items-center rounded-[.95rem] bg-gradient-to-br from-[var(--brand-blossom)] to-[var(--accent)] text-sm font-black tracking-tight text-white shadow-sm">
              UP
            </span>
            <span>
              <strong className="font-display block text-[1.08rem]">
                UltraPilot
              </strong>
              <span className="mt-0.5 block text-[.65rem] font-semibold text-[var(--muted)]">
                Train smart. Bloom strong.
              </span>
            </span>
          </Link>

          <div className="mt-7 rounded-2xl border border-[var(--line)] bg-[var(--surface-raised)] p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[.68rem] font-bold text-[var(--muted)]">
                Ausdauer-Mission
              </span>
              <span className="size-2 rounded-full bg-[var(--success)]" />
            </div>
            <p
              className="font-display mt-2 truncate text-sm"
              title={missionHeadline}
            >
              {missionHeadline}
            </p>

            <p className="mt-1 text-xs text-[var(--muted)]">{missionSubline}</p>
          </div>

          <nav aria-label="Hauptnavigation" className="mt-7 space-y-1">
            <p className="mb-2 px-3 text-[.68rem] font-bold text-[var(--muted)]">
              Cockpit
            </p>
            {links.filter((link) => ["/dashboard", "/plan", "/activities", "/progress", "/gym", "/mission"].includes(link.href)).map((link) => {
              const active = isActive(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={desktopActive && active ? "page" : undefined}
                  className={`group flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm transition ${active ? "bg-[var(--shell-active)] font-bold text-[var(--accent-dark)]" : "font-medium text-[var(--muted)] hover:bg-[var(--shell-hover)] hover:text-[var(--ink)]"}`}
                >
                  <Icon name={link.icon} />
                  <span className="min-w-0 flex-1 truncate">{link.label}</span>
                  {link.soon ? (
                    <span className="shrink-0 rounded-full bg-cyan-300/15 px-2 py-.5 text-[.58rem] font-black uppercase tracking-[.1em] text-cyan-200">
                      Bald
                    </span>
                  ) : active ? (
                    <span className="ml-auto size-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <Link
            href="/activities/upload"
            className="relative mt-6 flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface-raised)] px-4 text-sm font-bold text-[var(--ink)] transition hover:border-[var(--accent)]"
          >
            <Icon name="plus" /> Aktivität importieren
          </Link>

          <div className="mt-auto border-t border-[var(--line)] pt-4">
            <div className="flex items-center gap-2">
              <Link
                href="/settings"
                className={`flex flex-1 items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm ${pathname.startsWith("/settings") ? "bg-[var(--shell-active)] font-bold text-[var(--accent-dark)]" : "text-[var(--muted)] hover:text-[var(--ink)]"}`}
              >
                <Icon name="settings" /> Einstellungen
              </Link>
              <ThemeToggle className="grid size-10 shrink-0 place-items-center rounded-xl text-[var(--muted)] transition hover:bg-[var(--shell-hover)] hover:text-[var(--ink)]" />
            </div>
            {configured &&
              (userEmail ? (
                <form action={signOut}>
                  <button
                    type="submit"
                    className="mt-2 w-full truncate px-3.5 py-2 text-left text-xs text-[var(--muted)] hover:text-[var(--ink)]"
                    title={`${userEmail} abmelden`}
                  >
                    {userEmail} · Abmelden
                  </button>
                </form>
              ) : (
                <Link
                  href="/login"
                  className="mt-2 block px-3.5 py-2 text-xs font-bold text-[var(--accent)]"
                >
                  Anmelden
                </Link>
              ))}
          </div>
        </div>
      </SidebarNavigation>

      <header aria-hidden={!mobileActive} inert={!mobileActive} className="mobile-safe-header sticky top-0 z-30 flex items-center justify-between border-b border-[var(--line)] bg-[var(--shell)]/92 px-4 py-2.5 backdrop-blur-2xl lg:hidden">
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 font-black tracking-[-.03em] text-[var(--ink)]"
        >
          <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-[var(--brand-blossom)] to-[var(--accent)] text-xs text-white shadow-sm">
            UP
          </span>
          UltraPilot
        </Link>
        <div className="flex items-center gap-1.5">
          <ThemeToggle className="grid size-11 shrink-0 place-items-center rounded-full text-[var(--ink-soft)] hover:bg-[var(--accent-soft)]" />
        </div>
      </header>

      <MobileNavigation active={mobileActive}>
        {mobileMainLinks.map((link) => {
          const active = isActive(pathname, link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={mobileActive && active ? "page" : undefined}
              className={`flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[.64rem] font-bold transition ${active ? "bg-[var(--shell-active)] text-[var(--accent-dark)]" : "text-[var(--muted)]"}`}
            >
              <Icon name={link.icon} />
              <span>{link.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          aria-expanded={moreOpen}
          aria-controls="mobile-more-menu"
          onClick={() => setMoreOpen(true)}
          className={`flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[.64rem] font-bold ${moreActive ? "bg-[var(--shell-active)] text-[var(--accent-dark)]" : "text-[var(--muted)]"}`}
        >
          <Icon name="more" />
          <span>Mehr</span>
        </button>
      </MobileNavigation>

      {moreOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Menü schließen"
            onClick={() => setMoreOpen(false)}
            className="absolute inset-0 bg-[#07162d]/58 backdrop-blur-[3px]"
          />
          <section
            id="mobile-more-menu"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-more-title"
            className="mobile-safe-sheet absolute inset-x-0 bottom-0 rounded-t-[2rem] bg-[var(--background)] px-4 pb-5 pt-3 shadow-2xl"
          >
            <div className="mx-auto mb-4 h-1.5 w-11 rounded-full bg-slate-300" />
            <div className="flex items-center justify-between px-1">
              <div>
                <p className="eyebrow">Navigation</p>
                <h2
                  id="mobile-more-title"
                  className="mt-1 text-2xl font-black tracking-tight text-[var(--ink)]"
                >
                  Alles im Blick
                </h2>
              </div>
              <button
                type="button"
                aria-label="Menü schließen"
                onClick={() => setMoreOpen(false)}
                className="grid size-11 place-items-center rounded-full border border-[var(--line)] bg-[var(--surface-strong)] text-[var(--ink)] shadow-sm"
              >
                <Icon name="close" />
              </button>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2.5">
              {mobileMoreLinks.map((link) => {
                const active = isActive(pathname, link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMoreOpen(false)}
                    className={`flex min-h-22 flex-col justify-between rounded-[1.15rem] border p-4 transition ${active ? "border-blue-300 bg-blue-600 text-white shadow-lg shadow-blue-500/15" : "border-[var(--line)] bg-[var(--surface-strong)] text-[var(--ink)] shadow-sm"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Icon name={link.icon} />
                      {link.soon ? <span className="badge-soon">Bald</span> : null}
                    </div>
                    <span className="text-sm font-bold">{link.label}</span>
                  </Link>
                );
              })}
            </div>
            <ThemeToggle
              showLabel
              className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] px-4 text-sm font-bold text-[var(--ink)]"
            />
            {configured ? (
              <div className="mt-4 border-t border-[var(--line)] pt-4">
                {userEmail ? (
                  <form action={signOut}>
                    <button
                      type="submit"
                      className="min-h-11 w-full truncate rounded-xl bg-[var(--ink)] px-4 text-sm font-bold text-white"
                      title={`${userEmail} abmelden`}
                    >
                      {userEmail} · Abmelden
                    </button>
                  </form>
                ) : (
                  <Link
                    href="/login"
                    onClick={() => setMoreOpen(false)}
                    className="flex min-h-11 items-center justify-center rounded-xl bg-[var(--ink)] px-4 text-sm font-bold text-white"
                  >
                    Anmelden
                  </Link>
                )}
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/auth/actions";

type IconName = "today" | "mission" | "plan" | "progress" | "activities" | "nutrition" | "settings" | "plus";

const links: { href: string; label: string; icon: IconName }[] = [
  { href: "/dashboard", label: "Heute", icon: "today" },
  { href: "/mission", label: "Mission", icon: "mission" },
  { href: "/plan", label: "Plan", icon: "plan" },
  { href: "/progress", label: "Fortschritt", icon: "progress" },
  { href: "/activities", label: "Aktivitäten", icon: "activities" },
  { href: "/nutrition", label: "Verpflegung", icon: "nutrition" },
];

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    today: <><path d="M5 3v3M15 3v3M3 9h14"/><rect x="3" y="5" width="14" height="12" rx="2"/><path d="m8 13 2 2 4-4"/></>,
    mission: <><path d="M4 17V3"/><path d="M5 4h9l-2 3 2 3H5"/><path d="m7 17 3-5 3 5"/></>,
    plan: <><path d="M4 3h12v14H4z"/><path d="M7 7h6M7 10h6M7 13h3"/></>,
    progress: <><path d="M3 16 8 11l3 2 6-8"/><path d="M13 5h4v4"/></>,
    activities: <><circle cx="10" cy="10" r="7"/><path d="M10 6v4l3 2"/></>,
    nutrition: <><path d="M6 3v6a4 4 0 0 0 8 0V3M6 6h8M10 13v4"/></>,
    settings: <><circle cx="10" cy="10" r="3"/><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.3 4.3l1.4 1.4M14.3 14.3l1.4 1.4M15.7 4.3l-1.4 1.4M5.7 14.3l-1.4 1.4"/></>,
    plus: <path d="M10 4v12M4 10h12"/>,
  };
  return <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="size-5 shrink-0">{paths[name]}</svg>;
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/activities") return pathname === href || (pathname.startsWith("/activities/") && pathname !== "/activities/upload");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNavigation({ configured, userEmail }: { configured: boolean; userEmail: string | null }) {
  const pathname = usePathname();
  return <>
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[17rem] flex-col overflow-hidden bg-[var(--ink)] text-white lg:flex">
      <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_10%_10%,#4fac78,transparent_35%)]" />
      <div className="relative flex h-full flex-col p-5">
        <Link href="/dashboard" className="flex items-center gap-3 rounded-2xl px-2 py-3">
          <span className="grid size-11 place-items-center rounded-[.9rem] bg-[#d7efdd] text-sm font-black tracking-tight text-[var(--ink)]">UP</span>
          <span><strong className="block text-[1.05rem] tracking-tight">UltraPilot</strong><span className="text-[.68rem] font-bold uppercase tracking-[.16em] text-emerald-200/60">Road to RAG 2028</span></span>
        </Link>
        <nav aria-label="Hauptnavigation" className="mt-8 space-y-1.5">
          {links.map((link) => { const active = isActive(pathname, link.href); return <Link key={link.href} href={link.href} aria-current={active ? "page" : undefined} className={`flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm transition ${active ? "bg-white/12 font-bold text-white shadow-inner" : "font-medium text-emerald-50/62 hover:bg-white/7 hover:text-white"}`}><Icon name={link.icon} />{link.label}{active && <span className="ml-auto size-1.5 rounded-full bg-[#78d69d]" />}</Link>; })}
        </nav>
        <Link href="/activities/upload" className="relative mt-7 flex items-center justify-center gap-2 rounded-xl bg-[#d7efdd] px-4 py-3 text-sm font-bold text-[var(--ink)] transition hover:bg-white"><Icon name="plus" /> Aktivität importieren</Link>
        <div className="mt-auto border-t border-white/10 pt-4">
          <Link href="/settings" className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm ${pathname.startsWith("/settings") ? "bg-white/10 text-white" : "text-emerald-50/55 hover:text-white"}`}><Icon name="settings" /> Einstellungen</Link>
          {configured && (userEmail ? <form action={signOut}><button type="submit" className="mt-2 w-full truncate px-3.5 py-2 text-left text-xs text-emerald-50/40 hover:text-white" title={`${userEmail} abmelden`}>{userEmail} · Abmelden</button></form> : <Link href="/login" className="mt-2 block px-3.5 py-2 text-xs text-emerald-100">Anmelden</Link>)}
        </div>
      </div>
    </aside>

    <header className="mobile-safe-header sticky top-0 z-30 flex items-center justify-between border-b border-black/8 bg-[var(--background)]/90 px-4 py-3 backdrop-blur-xl lg:hidden">
      <Link href="/dashboard" className="flex items-center gap-2.5 font-black tracking-tight"><span className="grid size-9 place-items-center rounded-xl bg-[var(--ink)] text-xs text-white">UP</span>UltraPilot</Link>
      <Link href="/activities/upload" aria-label="Aktivität importieren" className="grid size-10 place-items-center rounded-xl bg-[var(--accent)] text-white"><Icon name="plus" /></Link>
    </header>
    <nav aria-label="Mobile Hauptnavigation" className="mobile-safe-nav fixed inset-x-3 bottom-3 z-40 grid grid-cols-6 rounded-[1.35rem] border border-white/10 bg-[var(--ink)] p-1.5 text-white shadow-2xl lg:hidden">
      {links.map((link) => { const active = isActive(pathname, link.href); return <Link key={link.href} href={link.href} aria-current={active ? "page" : undefined} className={`flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[.62rem] ${active ? "bg-white/12 text-white" : "text-emerald-50/55"}`}><Icon name={link.icon} /><span className="max-w-full truncate">{link.label}</span></Link>; })}
    </nav>
  </>;
}

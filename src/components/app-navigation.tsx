"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "@/app/auth/actions";

type IconName = "today" | "mission" | "plan" | "progress" | "activities" | "nutrition" | "settings" | "plus" | "more" | "close";

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
    more: <><circle cx="4" cy="10" r="1" fill="currentColor" stroke="none"/><circle cx="10" cy="10" r="1" fill="currentColor" stroke="none"/><circle cx="16" cy="10" r="1" fill="currentColor" stroke="none"/></>,
    close: <path d="m5 5 10 10M15 5 5 15" />,
  };
  return <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="size-5 shrink-0">{paths[name]}</svg>;
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/activities") return pathname === href || (pathname.startsWith("/activities/") && pathname !== "/activities/upload");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNavigation({ configured, userEmail }: { configured: boolean; userEmail: string | null }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const mobileMainLinks = ["/dashboard", "/plan", "/mission"].map((href) => links.find((link) => link.href === href)!);
  const mobileMoreLinks = [
    ...links.filter((link) => ["/progress", "/activities", "/nutrition"].includes(link.href)),
    { href: "/settings", label: "Einstellungen", icon: "settings" as const },
  ];
  const moreActive = mobileMoreLinks.some((link) => isActive(pathname, link.href));

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
      <span className="rounded-full border border-[var(--line)] bg-white/70 px-3 py-1.5 text-[.62rem] font-black uppercase tracking-[.12em] text-[var(--accent-dark)]">RAG 2028</span>
    </header>

    <nav aria-label="Mobile Hauptnavigation" className="mobile-safe-nav fixed inset-x-2 bottom-2 z-40 grid grid-cols-5 items-end rounded-[1.45rem] border border-white/10 bg-[var(--ink)] px-1.5 pb-1.5 pt-1 text-white shadow-[0_18px_55px_rgba(4,31,23,.32)] lg:hidden">
      {mobileMainLinks.slice(0, 2).map((link) => { const active = isActive(pathname, link.href); return <Link key={link.href} href={link.href} aria-current={active ? "page" : undefined} className={`flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[.65rem] font-semibold ${active ? "bg-white/12 text-white" : "text-emerald-50/55"}`}><Icon name={link.icon} /><span>{link.label}</span></Link>; })}
      <Link href="/activities/upload" aria-label="Aktivität importieren" className="group -mt-6 flex min-w-0 flex-col items-center gap-1 text-[.65rem] font-bold text-emerald-50">
        <span className="grid size-14 place-items-center rounded-full border-[5px] border-[var(--background)] bg-[var(--accent)] text-white shadow-lg transition group-active:scale-95"><Icon name="plus" /></span>
        <span>Import</span>
      </Link>
      {mobileMainLinks.slice(2).map((link) => { const active = isActive(pathname, link.href); return <Link key={link.href} href={link.href} aria-current={active ? "page" : undefined} className={`flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[.65rem] font-semibold ${active ? "bg-white/12 text-white" : "text-emerald-50/55"}`}><Icon name={link.icon} /><span>{link.label}</span></Link>; })}
      <button type="button" aria-expanded={moreOpen} aria-controls="mobile-more-menu" onClick={() => setMoreOpen(true)} className={`flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[.65rem] font-semibold ${moreActive ? "bg-white/12 text-white" : "text-emerald-50/55"}`}><Icon name="more" /><span>Mehr</span></button>
    </nav>

    {moreOpen ? <div className="fixed inset-0 z-50 lg:hidden">
      <button type="button" aria-label="Menü schließen" onClick={() => setMoreOpen(false)} className="absolute inset-0 bg-[var(--ink)]/55 backdrop-blur-[2px]" />
      <section id="mobile-more-menu" role="dialog" aria-modal="true" aria-labelledby="mobile-more-title" className="mobile-safe-sheet absolute inset-x-0 bottom-0 rounded-t-[2rem] bg-[var(--background)] px-4 pb-5 pt-3 shadow-2xl">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-[var(--line)]" />
        <div className="flex items-center justify-between px-1">
          <div><p className="eyebrow">UltraPilot</p><h2 id="mobile-more-title" className="mt-1 text-2xl font-black tracking-tight text-[var(--ink)]">Mehr</h2></div>
          <button type="button" aria-label="Menü schließen" onClick={() => setMoreOpen(false)} className="grid size-11 place-items-center rounded-full border border-[var(--line)] bg-white text-[var(--ink)]"><Icon name="close" /></button>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2.5">
          {mobileMoreLinks.map((link) => { const active = isActive(pathname, link.href); return <Link key={link.href} href={link.href} onClick={() => setMoreOpen(false)} className={`flex min-h-20 flex-col justify-between rounded-[1.2rem] border p-4 ${active ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-dark)]" : "border-[var(--line)] bg-white text-[var(--ink)]"}`}><Icon name={link.icon} /><span className="text-sm font-bold">{link.label}</span></Link>; })}
        </div>
        {configured ? <div className="mt-4 border-t border-[var(--line)] pt-4">{userEmail ? <form action={signOut}><button type="submit" className="min-h-11 w-full rounded-xl bg-[var(--ink)] px-4 text-sm font-bold text-white">{userEmail} · Abmelden</button></form> : <Link href="/login" onClick={() => setMoreOpen(false)} className="flex min-h-11 items-center justify-center rounded-xl bg-[var(--ink)] px-4 text-sm font-bold text-white">Anmelden</Link>}</div> : null}
      </section>
    </div> : null}
  </>;
}

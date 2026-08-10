"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  nextThemePreference,
  parseThemePreference,
  type ThemePreference,
} from "@/lib/theme";

export { nextThemePreference, parseThemePreference } from "@/lib/theme";
const STORAGE_KEY = "ultrapilot-theme";

function systemPrefersDark(): boolean {
  try {
    return typeof window.matchMedia === "function"
      && window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
}

function effectiveTheme(preference: ThemePreference): "light" | "dark" {
  if (preference !== "system") return preference;
  return systemPrefersDark() ? "dark" : "light";
}

function applyTheme(preference: ThemePreference) {
  const theme = effectiveTheme(preference);
  document.documentElement.dataset.themePreference = preference;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

function subscribe(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme-preference"] });
  return () => observer.disconnect();
}

function getSnapshot(): ThemePreference {
  return parseThemePreference(document.documentElement.dataset.themePreference);
}

export function ThemeToggle({ className = "", showLabel = false }: { className?: string; showLabel?: boolean }) {
  const preference = useSyncExternalStore<ThemePreference>(
    subscribe,
    getSnapshot,
    () => "system",
  );

  useEffect(() => {
    let media: MediaQueryList;
    try {
      if (typeof window.matchMedia !== "function") return;
      media = window.matchMedia("(prefers-color-scheme: dark)");
    } catch {
      return;
    }
    const syncSystem = () => {
      if (getSnapshot() === "system") applyTheme("system");
    };
    media.addEventListener("change", syncSystem);
    return () => media.removeEventListener("change", syncSystem);
  }, []);

  const labels: Record<ThemePreference, string> = { light: "Hell", dark: "Dunkel", system: "System" };
  const next = nextThemePreference(preference);
  return (
    <button
      type="button"
      onClick={() => {
        applyTheme(next);
        try { localStorage.setItem(STORAGE_KEY, next); } catch { /* preference remains active for this page */ }
      }}
      aria-label={`Darstellung: ${labels[preference]}. Zu ${labels[next]} wechseln`}
      title={`Darstellung: ${labels[preference]}`}
      className={className}
    >
      <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" className="size-5 shrink-0">
        {preference === "light" ? <><circle cx="10" cy="10" r="3.5"/><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.5 4.5l1.4 1.4M14.1 14.1l1.4 1.4M15.5 4.5l-1.4 1.4M5.9 14.1l-1.4 1.4"/></> : preference === "dark" ? <path d="M17 11.5A7 7 0 0 1 8.5 3 7 7 0 1 0 17 11.5Z"/> : <><rect x="2.5" y="3" width="15" height="11" rx="2"/><path d="M7 17h6M10 14v3"/></>}
      </svg>
      {showLabel && <span>Darstellung · {labels[preference]}</span>}
    </button>
  );
}

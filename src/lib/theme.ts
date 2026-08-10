export const THEME_PREFERENCES = ["light", "dark", "system"] as const;

export type ThemePreference = (typeof THEME_PREFERENCES)[number];

export function parseThemePreference(value: unknown): ThemePreference {
  return typeof value === "string"
    && THEME_PREFERENCES.includes(value as ThemePreference)
    ? value as ThemePreference
    : "system";
}

export function nextThemePreference(theme: ThemePreference): ThemePreference {
  return theme === "system" ? "light" : theme === "light" ? "dark" : "system";
}

export function getThemeInitScript(): string {
  const allowed = JSON.stringify(THEME_PREFERENCES);
  return `(function(){var p="system";try{var s=localStorage.getItem("ultrapilot-theme");if(${allowed}.indexOf(s)!==-1)p=s;}catch(e){}var d=false;if(p==="system"){try{d=typeof window.matchMedia==="function"&&window.matchMedia("(prefers-color-scheme: dark)").matches;}catch(e){d=false;}}var t=p==="dark"||(p==="system"&&d)?"dark":"light";var r=document.documentElement;r.setAttribute("data-theme-preference",p);r.setAttribute("data-theme",t);r.style.colorScheme=t;})();`;
}

export const THEMES = ["system", "light", "dark"] as const;
export type ThemeChoice = (typeof THEMES)[number];

/** Where the choice is kept: this browser only, it is a preference, not data. */
export const THEME_STORAGE_KEY = "hire-tracker-theme";

/** The theme to show: the choice, or the system's when the choice is "system". */
export function resolveTheme(choice: string | null, systemPrefersDark: boolean): "light" | "dark" {
  if (choice === "light" || choice === "dark") return choice;
  return systemPrefersDark ? "dark" : "light";
}

/**
 * Runs in <head> before the page paints, so a dark page never flashes white. Kept tiny and
 * self-contained: it cannot import anything.
 */
export const THEME_SCRIPT = `(function(){try{var c=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});var d=c==="dark"||(c!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light"}catch(e){}})();`;

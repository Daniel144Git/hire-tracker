"use client";

import { useEffect, useSyncExternalStore } from "react";
import { resolveTheme, THEME_STORAGE_KEY, THEMES, type ThemeChoice } from "@/lib/theme";

const LABEL: Record<ThemeChoice, string> = { system: "System", light: "Light", dark: "Dark" };
const CHANGED = "hire-tracker-theme-change";

function readChoice(): ThemeChoice {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return THEMES.includes(stored as ThemeChoice) ? (stored as ThemeChoice) : "system";
  } catch {
    return "system";
  }
}

/** The stored choice is outside React: other tabs can change it, and so can this one. */
function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGED, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGED, onChange);
  };
}

function apply(choice: ThemeChoice) {
  const systemDark = matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.dataset.theme = resolveTheme(choice, systemDark);
}

/** Light, Dark, or follow the system; remembered in this browser. */
export function ThemePicker() {
  // The server renders "system"; the browser's stored choice takes over after hydration.
  const choice = useSyncExternalStore(subscribe, readChoice, () => "system" as ThemeChoice);

  // Apply the choice, and while following the system, follow its changes too.
  useEffect(() => {
    apply(choice);
    if (choice !== "system") return;
    const media = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [choice]);

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="theme" className="text-sm">
        Theme
      </label>
      <select
        id="theme"
        value={choice}
        onChange={(event) => {
          try {
            localStorage.setItem(THEME_STORAGE_KEY, event.target.value);
          } catch {
            // Private browsing: the theme is not remembered.
          }
          window.dispatchEvent(new Event(CHANGED));
        }}
        className="rounded border border-line-strong bg-background px-1 py-0.5 text-sm"
      >
        {THEMES.map((theme) => (
          <option key={theme} value={theme}>
            {LABEL[theme]}
          </option>
        ))}
      </select>
    </div>
  );
}

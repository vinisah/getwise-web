"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { DEFAULT_PREFS, PREFS_COOKIE, THEMES, themeVars, type UiPrefs } from "@/lib/theme";

const PreferencesContext = createContext<{ prefs: UiPrefs; commit: (prefs: UiPrefs) => void }>({
  prefs: DEFAULT_PREFS,
  commit: () => {},
});

export function PreferencesProvider({ initialPrefs, children }: { initialPrefs: UiPrefs; children: React.ReactNode }) {
  const [prefs, commit] = useState(initialPrefs);
  useEffect(() => {
    const root = document.documentElement;
    for (const [key, value] of Object.entries(themeVars(prefs))) root.style.setProperty(key, value);
    root.dataset.motion = prefs.motion;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (meta) meta.content = THEMES[prefs.theme].brand;
    // This presentation cookie never contains the student's nickname or identity.
    const { theme, accent, density, radius, sidebar, motion, tutorPace } = prefs;
    const visual = { theme, accent, density, radius, sidebar, motion, tutorPace };
    document.cookie = `${PREFS_COOKIE}=${encodeURIComponent(JSON.stringify(visual))}; path=/; max-age=31536000; samesite=lax${location.protocol === "https:" ? "; secure" : ""}`;
  }, [prefs]);
  return <PreferencesContext.Provider value={{ prefs, commit }}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  return useContext(PreferencesContext);
}

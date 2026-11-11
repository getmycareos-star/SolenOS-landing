"use client";

import { useEffect, useState } from "react";

type ThemePreference = "light" | "dark" | "system";
type TextScale = "100" | "125";
type Preferences = { theme: ThemePreference; scale: TextScale };

const STORAGE_KEY = "solenos_display_preferences_v1";
const DEFAULTS: Preferences = { theme: "system", scale: "100" };

function validPreferences(value: unknown): Preferences {
  if (!value || typeof value !== "object") return DEFAULTS;
  const candidate = value as Partial<{ theme: unknown; scale: unknown }>;
  const scale: TextScale =
    candidate.scale === "125" || candidate.scale === "150" || candidate.scale === "200"
      ? "125"
      : "100";
  return {
    theme:
      candidate.theme === "light" || candidate.theme === "dark" || candidate.theme === "system"
        ? candidate.theme
        : DEFAULTS.theme,
    scale,
  };
}

export function GlobalDisplayPreferences() {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULTS);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) setPrefs(validPreferences(JSON.parse(stored)));
    } catch {
      // Keep safe defaults when browser storage is unavailable or corrupt.
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const root = document.documentElement;
    // System default intentionally means the accessible light theme, not OS dark mode.
    root.dataset.solenosTheme = prefs.theme === "dark" ? "dark" : "light";
    root.style.setProperty("--solenos-text-scale", String(Number(prefs.scale) / 100));
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // The active preference still applies for this session.
    }
  }, [prefs, ready]);

  function update(next: Partial<Preferences>) {
    setPrefs((current) => ({ ...current, ...next }));
  }

  return (
    <div className="solenos-display-preferences">
      <button
        type="button"
        className="solenos-display-trigger"
        aria-expanded={open}
        aria-controls="solenos-display-panel"
        aria-label="Display and accessibility settings"
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true">Aa</span>
        <span>Display</span>
      </button>
      {open && (
        <section id="solenos-display-panel" className="solenos-display-panel" role="region" aria-label="Display and accessibility settings">
          <div className="solenos-display-panel-heading">
            <h2>Display & accessibility</h2>
            <button type="button" className="solenos-display-close" onClick={() => setOpen(false)} aria-label="Close display settings">×</button>
          </div>
          <fieldset>
            <legend>Colour theme</legend>
            {(["light", "dark", "system"] as const).map((theme) => (
              <label key={theme}>
                <input type="radio" name="solenos-theme" value={theme} checked={prefs.theme === theme} onChange={() => update({ theme })} />
                {theme === "system" ? "System default" : theme === "light" ? "Light" : "Dark"}
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>Font size</legend>
            {(["100", "125"] as const).map((scale) => (
              <label key={scale}>
                <input type="radio" name="solenos-text-scale" value={scale} checked={prefs.scale === scale} onChange={() => update({ scale })} />
                {scale === "100" ? "Default" : "Large"}
              </label>
            ))}
          </fieldset>
          <p className="solenos-display-note" role="status">Your display preferences are saved on this device.</p>
        </section>
      )}
    </div>
  );
}

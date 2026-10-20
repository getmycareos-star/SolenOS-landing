"use client";

import { useEffect, useState } from "react";
import type { AccessibilityPrefs, TextScale, ThemeLayout, TypographyMode } from "@/lib/mvp-workspace";
import { ACCESSIBILITY_STORAGE_KEY, DEFAULT_ACCESSIBILITY } from "@/lib/mvp-workspace";

type Props = {
  prefs: AccessibilityPrefs;
  onChange: (next: AccessibilityPrefs) => void;
};

export function AccessibilitySettings({ prefs, onChange }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(ACCESSIBILITY_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<AccessibilityPrefs>;
      onChange({
        themeLayout: parsed.themeLayout ?? DEFAULT_ACCESSIBILITY.themeLayout,
        typography: parsed.typography ?? DEFAULT_ACCESSIBILITY.typography,
        textScale: parsed.textScale ?? DEFAULT_ACCESSIBILITY.textScale,
      });
    } catch {
      // ignore corrupt prefs
    }
    // hydrate once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function apply(partial: Partial<AccessibilityPrefs>) {
    const next = { ...prefs, ...partial };
    onChange(next);
    window.localStorage.setItem(ACCESSIBILITY_STORAGE_KEY, JSON.stringify(next));
  }

  return (
    <div className="a11y-float">
      <button
        type="button"
        className="a11y-float-toggle"
        aria-expanded={open}
        aria-controls="a11y-panel"
        onClick={() => setOpen((v) => !v)}
      >
        Aa
        <span className="sr-only">Accessibility settings</span>
      </button>
      {open && (
        <div id="a11y-panel" className="a11y-panel" role="dialog" aria-label="Accessibility settings">
          <fieldset className="a11y-fieldset">
            <legend>Theme</legend>
            <label className="a11y-option">
              <input
                type="radio"
                name="themeLayout"
                checked={prefs.themeLayout === "black_input"}
                onChange={() => apply({ themeLayout: "black_input" as ThemeLayout })}
              />
              Black input / white clarity
            </label>
            <label className="a11y-option">
              <input
                type="radio"
                name="themeLayout"
                checked={prefs.themeLayout === "white_input"}
                onChange={() => apply({ themeLayout: "white_input" as ThemeLayout })}
              />
              White input / black clarity
            </label>
          </fieldset>

          <fieldset className="a11y-fieldset">
            <legend>Typography</legend>
            <label className="a11y-option">
              <input
                type="radio"
                name="typography"
                checked={prefs.typography === "serif"}
                onChange={() => apply({ typography: "serif" as TypographyMode })}
              />
              Serif
            </label>
            <label className="a11y-option">
              <input
                type="radio"
                name="typography"
                checked={prefs.typography === "sans"}
                onChange={() => apply({ typography: "sans" as TypographyMode })}
              />
              Sans-serif
            </label>
          </fieldset>

          <fieldset className="a11y-fieldset">
            <legend>Text size</legend>
            {(
              [
                ["standard", "Standard"],
                ["large", "Large"],
                ["xl", "Extra Large"],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="a11y-option">
                <input
                  type="radio"
                  name="textScale"
                  checked={prefs.textScale === value}
                  onChange={() => apply({ textScale: value as TextScale })}
                />
                {label}
              </label>
            ))}
          </fieldset>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { coerceSolenOSUiLanguage, SOLENOS_UI_LANGUAGES, type SolenOSUiLanguage } from "@/lib/language-preference";

const STORAGE_KEY = "solenos_language_preference";
const COPY: Record<SolenOSUiLanguage, { label: string; description: string; saved: string }> = {
  en: { label: "Language", description: "Choose the language you want SolenOS to use.", saved: "Your language choice is saved on this device." },
  es: { label: "Idioma", description: "Elige el idioma que quieres usar en SolenOS.", saved: "Tu idioma se guarda en este dispositivo." },
  fr: { label: "Langue", description: "Choisissez la langue que vous souhaitez utiliser dans SolenOS.", saved: "Votre choix de langue est enregistré sur cet appareil." },
};

const LANGUAGE_NAMES: Record<SolenOSUiLanguage, string> = {
  en: "English", es: "Español", fr: "Français",
};

export function LanguagePreferenceSelect() {
  const [language, setLanguage] = useState<SolenOSUiLanguage>("en");
  const [hasSavedChoice, setHasSavedChoice] = useState(false);

  useEffect(() => {
    let savedLanguage: string | null = null;
    try {
      savedLanguage = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      // The selector remains usable for this visit if browser storage is blocked.
    }
    const supported = coerceSolenOSUiLanguage(savedLanguage);
    setLanguage(supported);
    setHasSavedChoice(Boolean(savedLanguage));
    document.documentElement.lang = supported;
  }, []);

  const changeLanguage = (value: string) => {
    if (!SOLENOS_UI_LANGUAGES.includes(value as SolenOSUiLanguage)) return;
    const next = value as SolenOSUiLanguage;
    setLanguage(next);
    setHasSavedChoice(true);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
      setHasSavedChoice(true);
    } catch {
      setHasSavedChoice(false);
    }
    document.documentElement.lang = next;
    window.dispatchEvent(new CustomEvent("solenos:language-change", { detail: { language: next } }));
  };

  const copy = COPY[language];
  return (
    <div className="language-preference-control">
      <label className="mobile-settings-label" htmlFor="solenos-language-preference">{copy.label}</label>
      <p className="mobile-settings-hint">{copy.description}</p>
      <select
        id="solenos-language-preference"
        className="mobile-settings-input"
        value={language}
        onChange={(event) => changeLanguage(event.target.value)}
        aria-describedby="solenos-language-preference-status"
      >
        {SOLENOS_UI_LANGUAGES.map((code) => <option key={code} value={code}>{LANGUAGE_NAMES[code]}</option>)}
      </select>
      <p id="solenos-language-preference-status" className="mobile-settings-hint" role="status">{hasSavedChoice ? copy.saved : ""}</p>
    </div>
  );
}

"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import en from "@/lib/i18n/locales/en/translation.json";
import es from "@/lib/i18n/locales/es/translation.json";
import fr from "@/lib/i18n/locales/fr/translation.json";
import { coerceSolenOSUiLanguage, type SolenOSUiLanguage } from "@/lib/language-preference";

const TRANSLATIONS = { en, es, fr } as const;

type LanguageContextValue = {
  language: SolenOSUiLanguage;
  t: (key: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function lookupTranslation(language: SolenOSUiLanguage, key: string): string {
  const value = key.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[segment];
  }, TRANSLATIONS[language]);
  return typeof value === "string" ? value : key;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<SolenOSUiLanguage>("en");

  useEffect(() => {
    const syncLanguage = (event?: Event) => {
      let saved: string | null = null;
      try {
        saved = window.localStorage.getItem("solenos_language_preference");
      } catch {
        // English remains the safe default when browser storage is unavailable.
      }
      const detail = event instanceof CustomEvent ? event.detail as { language?: string } | undefined : undefined;
      const next = coerceSolenOSUiLanguage(detail?.language ?? saved);
      setLanguage(next);
      document.documentElement.lang = next;
    };
    syncLanguage();
    window.addEventListener("solenos:language-change", syncLanguage);
    window.addEventListener("storage", syncLanguage);
    return () => {
      window.removeEventListener("solenos:language-change", syncLanguage);
      window.removeEventListener("storage", syncLanguage);
    };
  }, []);

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    t: (key: string) => lookupTranslation(language, key),
  }), [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useSolenOSTranslations() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error("useSolenOSTranslations must be used inside LanguageProvider");
  return value;
}

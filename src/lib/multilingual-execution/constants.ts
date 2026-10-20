import type { SolenOSLanguage } from "./types";

export const SOLENOS_LANGUAGES = [
  "en",
  "es",
  "zh",
  "tl",
  "vi",
  "ko",
  "fa",
  "ar",
  "ru",
  "hy",
] as const satisfies readonly SolenOSLanguage[];

export const DEFAULT_SOLENOS_LANGUAGE: SolenOSLanguage = "en";

export const SOLENOS_LANGUAGE_NAMES: Record<SolenOSLanguage, string> = {
  en: "English",
  es: "Spanish",
  zh: "Chinese (Simplified)",
  tl: "Tagalog",
  vi: "Vietnamese",
  ko: "Korean",
  fa: "Persian / Farsi",
  ar: "Arabic",
  ru: "Russian",
  hy: "Armenian",
};

/** Domain terms that must remain in original form across output languages. */
export const PRESERVED_DOMAIN_TERMS = [
  "Medi-Cal",
  "Medicare",
  "hospital",
  "doctor",
  "insurance",
] as const;

export const MULTILINGUAL_RESPONSE_HEADER = "x-solenos-language";

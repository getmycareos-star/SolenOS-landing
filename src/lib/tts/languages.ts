/**
 * SolenOS TTS — hard-coded language list.
 * NEVER add, remove, or rename codes without an ADR.
 */

export const TTS_LANGUAGES = [
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
] as const;

export type TtsLanguage = (typeof TTS_LANGUAGES)[number];

export const TTS_LANGUAGE_NAMES: Record<TtsLanguage, string> = {
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

export const DEFAULT_TTS_LANGUAGE: TtsLanguage = "en";

export function isTtsLanguage(value: unknown): value is TtsLanguage {
  return typeof value === "string" && (TTS_LANGUAGES as readonly string[]).includes(value);
}

export function coerceTtsLanguage(value: unknown): TtsLanguage {
  return isTtsLanguage(value) ? value : DEFAULT_TTS_LANGUAGE;
}

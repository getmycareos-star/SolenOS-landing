import { coerceSolenOSLanguage } from "@/lib/multilingual-execution";
import type { SolenOSLanguage } from "@/lib/multilingual-execution/types";

/** BCP-47 tags for Web Speech recognition + synthesis from SolenOS 10 language codes. */
export const SPEECH_RECOGNITION_LANG: Record<SolenOSLanguage, string> = {
  en: "en-US",
  es: "es-US",
  zh: "zh-CN",
  tl: "fil-PH",
  vi: "vi-VN",
  ko: "ko-KR",
  fa: "fa-IR",
  ar: "ar-SA",
  ru: "ru-RU",
  hy: "hy-AM",
};

/** Alias for synthesis — same locale map for MVP browser I/O. */
export const SPEECH_SYNTHESIS_LANG = SPEECH_RECOGNITION_LANG;

export function toSpeechRecognitionLang(languageHint?: string): string {
  const lang = coerceSolenOSLanguage(languageHint);
  return SPEECH_RECOGNITION_LANG[lang];
}

export function toSpeechSynthesisLang(languageHint?: string): string {
  return toSpeechRecognitionLang(languageHint);
}

export function toSolenOSLanguage(languageHint?: string): SolenOSLanguage {
  return coerceSolenOSLanguage(languageHint);
}

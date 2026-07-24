import type { TtsLanguage } from "./languages";

/** Engines allowed for SolenOS TTS — never ElevenLabs, Piper, or other mystery engines. */
export type TtsEngine = "polly" | "google";

/** Languages routed to Amazon Polly (neural). */
export const POLLY_LANGUAGES = ["en", "es", "zh", "ko", "ru", "ar"] as const satisfies readonly TtsLanguage[];

/** Languages routed to Google Cloud TTS. */
export const GOOGLE_TTS_LANGUAGES = ["tl", "vi", "fa", "hy"] as const satisfies readonly TtsLanguage[];

export function routeTtsEngine(language: TtsLanguage): TtsEngine {
  if ((POLLY_LANGUAGES as readonly string[]).includes(language)) return "polly";
  if ((GOOGLE_TTS_LANGUAGES as readonly string[]).includes(language)) return "google";
  // Exhaustive safety — hard-coded list must cover all TTS_LANGUAGES.
  throw new Error(`No TTS engine routed for language: ${language}`);
}

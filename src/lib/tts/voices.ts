import type { TtsLanguage } from "./languages";

export type TtsVoiceProfile = "female" | "male";

export const TTS_VOICE_PROFILES = ["female", "male"] as const satisfies readonly TtsVoiceProfile[];

export const DEFAULT_TTS_VOICE_PROFILE: TtsVoiceProfile = "female";

export function isTtsVoiceProfile(value: unknown): value is TtsVoiceProfile {
  return value === "female" || value === "male";
}

export function coerceTtsVoiceProfile(value: unknown): TtsVoiceProfile {
  return isTtsVoiceProfile(value) ? value : DEFAULT_TTS_VOICE_PROFILE;
}

/** Amazon Polly neural voice IDs — female defaults match product TTS architecture. */
export const POLLY_VOICE_IDS: Record<
  Extract<TtsLanguage, "en" | "es" | "zh" | "ko" | "ru" | "ar">,
  Record<TtsVoiceProfile, string>
> = {
  en: { female: "Joanna", male: "Matthew" },
  es: { female: "Penelope", male: "Miguel" },
  zh: { female: "Zhiyu", male: "Zhiyu" }, // Polly neural Chinese: Zhiyu only
  ko: { female: "Seoyeon", male: "Seoyeon" }, // Polly neural Korean: Seoyeon only
  ru: { female: "Tatyana", male: "Maxim" },
  ar: { female: "Zeina", male: "Zeina" }, // Polly Arabic: Zeina only
};

export const POLLY_LANGUAGE_CODES: Record<
  Extract<TtsLanguage, "en" | "es" | "zh" | "ko" | "ru" | "ar">,
  string
> = {
  en: "en-US",
  es: "es-US",
  zh: "cmn-CN",
  ko: "ko-KR",
  ru: "ru-RU",
  ar: "arb",
};

/** Google Cloud TTS voice configs for non-Polly languages. */
export type GoogleTtsVoiceConfig = {
  languageCode: string;
  name: string;
};

export const GOOGLE_TTS_VOICES: Record<
  Extract<TtsLanguage, "tl" | "vi" | "fa" | "hy">,
  Record<TtsVoiceProfile, GoogleTtsVoiceConfig>
> = {
  tl: {
    female: { languageCode: "fil-PH", name: "fil-PH-Wavenet-A" },
    male: { languageCode: "fil-PH", name: "fil-PH-Wavenet-C" },
  },
  vi: {
    female: { languageCode: "vi-VN", name: "vi-VN-Wavenet-A" },
    male: { languageCode: "vi-VN", name: "vi-VN-Wavenet-D" },
  },
  fa: {
    female: { languageCode: "fa-IR", name: "fa-IR-Wavenet-A" },
    male: { languageCode: "fa-IR", name: "fa-IR-Wavenet-B" },
  },
  hy: {
    female: { languageCode: "hy-AM", name: "hy-AM-Wavenet-A" },
    male: { languageCode: "hy-AM", name: "hy-AM-Wavenet-B" },
  },
};

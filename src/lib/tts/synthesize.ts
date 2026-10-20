import { coerceTtsLanguage, type TtsLanguage } from "./languages";
import { routeTtsEngine, type TtsEngine } from "./route";
import { synthesizeWithPolly } from "./polly";
import { synthesizeWithGoogle } from "./google-tts";
import { buildCalmSsml } from "./ssml";
import {
  coerceTtsVoiceProfile,
  type TtsVoiceProfile,
} from "./voices";

export type SynthesizeSpeechInput = {
  text: string;
  languagePreference?: TtsLanguage | string;
  voiceProfile?: TtsVoiceProfile | string;
};

export type SynthesizeSpeechSuccess = {
  ok: true;
  engine: TtsEngine;
  audioContent: Buffer;
  contentType: "audio/mpeg";
  language: TtsLanguage;
  voiceProfile: TtsVoiceProfile;
  ssml: string;
  voiceId?: string;
  voiceName?: string;
};

export type SynthesizeSpeechFailure = {
  ok: false;
  error: string;
  code: "EMPTY_TEXT" | "MISSING_CREDENTIALS" | "SYNTHESIS_FAILED" | "UNSUPPORTED_LANGUAGE";
  engine?: TtsEngine;
  language?: TtsLanguage;
  ssml?: string;
};

/**
 * Public TTS facade: (text, languagePreference, voiceProfile?) → MP3.
 * Routes exclusively to Amazon Polly or Google Cloud TTS.
 */
export async function synthesizeSpeech(
  input: SynthesizeSpeechInput,
): Promise<SynthesizeSpeechSuccess | SynthesizeSpeechFailure> {
  const text = input.text?.trim() ?? "";
  if (!text) {
    return { ok: false, code: "EMPTY_TEXT", error: "Text is required for speech synthesis" };
  }

  const language = coerceTtsLanguage(input.languagePreference);
  const voiceProfile = coerceTtsVoiceProfile(input.voiceProfile);
  const engine = routeTtsEngine(language);
  const ssml = buildCalmSsml(text);

  if (engine === "polly") {
    const result = await synthesizeWithPolly({
      text,
      language: language as Extract<TtsLanguage, "en" | "es" | "zh" | "ko" | "ru" | "ar">,
      voiceProfile,
    });
    if (!result.ok) {
      return { ...result, engine, language, ssml };
    }
    return {
      ok: true,
      engine: "polly",
      audioContent: result.audioContent,
      contentType: "audio/mpeg",
      language,
      voiceProfile,
      ssml: result.ssml,
      voiceId: result.voiceId,
    };
  }

  const result = await synthesizeWithGoogle({
    text,
    language: language as Extract<TtsLanguage, "tl" | "vi" | "fa" | "hy">,
    voiceProfile,
  });
  if (!result.ok) {
    return { ...result, engine, language, ssml };
  }
  return {
    ok: true,
    engine: "google",
    audioContent: result.audioContent,
    contentType: "audio/mpeg",
    language,
    voiceProfile,
    ssml: result.ssml,
    voiceName: result.voiceName,
  };
}

/** Hook targets for product voice surfaces (same TTS facade). */
export const TTS_VOICE_SURFACE_HOOKS = [
  "voice_mode_3am",
  "weekly_care_briefing",
  "crisis_guidance",
  "benefit_tracker_guidance",
] as const;

export type TtsVoiceSurfaceHook = (typeof TTS_VOICE_SURFACE_HOOKS)[number];

/**
 * Stub hooks for 3am Voice Mode / Weekly Care Briefing / Crisis / Benefit-Tracker.
 * All call the same synthesizeSpeech facade — no alternate engines.
 */
export async function synthesizeForVoiceSurface(params: {
  surface: TtsVoiceSurfaceHook;
  text: string;
  languagePreference?: TtsLanguage | string;
  voiceProfile?: TtsVoiceProfile | string;
}): Promise<SynthesizeSpeechSuccess | SynthesizeSpeechFailure> {
  return synthesizeSpeech({
    text: params.text,
    languagePreference: params.languagePreference,
    voiceProfile: params.voiceProfile,
  });
}

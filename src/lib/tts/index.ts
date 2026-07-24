export {
  TTS_LANGUAGES,
  TTS_LANGUAGE_NAMES,
  DEFAULT_TTS_LANGUAGE,
  isTtsLanguage,
  coerceTtsLanguage,
  type TtsLanguage,
} from "./languages";

export {
  routeTtsEngine,
  POLLY_LANGUAGES,
  GOOGLE_TTS_LANGUAGES,
  type TtsEngine,
} from "./route";

export {
  buildCalmSsml,
  escapeSsmlText,
  TTS_PROSODY_RATE,
  TTS_PROSODY_PITCH,
  TTS_BREAK_MS,
} from "./ssml";

export {
  TTS_VOICE_PROFILES,
  DEFAULT_TTS_VOICE_PROFILE,
  isTtsVoiceProfile,
  coerceTtsVoiceProfile,
  POLLY_VOICE_IDS,
  POLLY_LANGUAGE_CODES,
  GOOGLE_TTS_VOICES,
  type TtsVoiceProfile,
} from "./voices";

export { synthesizeWithPolly } from "./polly";
export { synthesizeWithGoogle } from "./google-tts";

export {
  synthesizeSpeech,
  synthesizeForVoiceSurface,
  TTS_VOICE_SURFACE_HOOKS,
  type SynthesizeSpeechInput,
  type SynthesizeSpeechSuccess,
  type SynthesizeSpeechFailure,
  type TtsVoiceSurfaceHook,
} from "./synthesize";

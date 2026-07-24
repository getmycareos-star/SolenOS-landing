export {
  VOICE_CONVERSATION_STATES,
  type IVoiceController,
  type VoiceConversationState,
  type VoiceConversationTurn,
} from "./interfaces";
export {
  SPEECH_RECOGNITION_LANG,
  SPEECH_SYNTHESIS_LANG,
  toSpeechRecognitionLang,
  toSpeechSynthesisLang,
  toSolenOSLanguage,
} from "./speech-language";
export * from "./speech-to-text";
export * from "./speech-output";

/** Server-safe controller exports — React hooks live in `@/lib/voice/client` only. */
export {
  VoiceConversationController,
  createVoiceConversationController,
  type VoiceConversationAnalyzeFn,
  type VoiceConversationControllerOptions,
} from "./voice-controller/conversation-controller";
export {
  buildVoiceSpokenResponse,
  buildVoiceModeGreeting,
} from "./voice-controller/build-spoken-response";

/** FUTURE channel contract — not an MVP product surface (ADR-018). */
export const VOICE_CONVERSATION_MVP = {
  identity: "SolenOS Voice Conversation — speak naturally, hear clarity",
  status: "FUTURE" as const,
  speechInput: "browser-web-speech" as const,
  speechOutput: "browser-speech-synthesis" as const,
  reasoning: "gemini via POST /api/analyze",
  moduleRoot: "src/lib/voice",
  futureStt: "src/lib/voice/speech-to-text/future",
  futureTts: "src/lib/voice/speech-output/future",
  adr: "docs/15-architecture-decisions/ADR-017-voice-conversation-browser-io-mvp.md",
  supersededForMvpBy:
    "docs/15-architecture-decisions/ADR-018-mvp-input-text-documents-only.md",
} as const;

export { FUTURE_WHISPER_STT } from "./speech-to-text/future/whisper-stt";
export { FUTURE_GEMINI_STT } from "./speech-to-text/future/gemini-stt";
export { FUTURE_CLOUD_TTS } from "./speech-output/future/cloud-tts";

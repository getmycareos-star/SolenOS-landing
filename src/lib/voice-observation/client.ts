"use client";

/**
 * @deprecated Use `@/lib/voice/client` — MVP browser Web Speech only.
 */
export {
  useWebSpeechRecognition,
  getSpeechRecognitionConstructor,
  isWebSpeechSupported,
  type SpeechRecognitionLike,
} from "./use-web-speech";

export {
  transcribeObservationAudio,
  type ServerTranscribeResult,
} from "./observation-voice-client";

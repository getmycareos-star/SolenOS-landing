/**
 * Retired server-side speech transcription selector.
 * The caregiver MVP does not upload audio to hosted STT providers.
 * Browser Web Speech remains a separate browser-only capability.
 */
export const FUTURE_SERVER_TRANSCRIBE = {
  status: "RETIRED" as const,
  module: "src/lib/voice/speech-to-text/future/server-transcribe.ts",
  note: "No server-side Whisper or Gemini transcription; use typed input when browser speech is unavailable.",
};

export {
  transcribeAudio,
  resolveServerSttProvider,
  type TranscribeResult,
  type TranscribeSuccess,
  type TranscribeFailure,
  type SttProvider,
} from "@/lib/voice-observation/transcribe";

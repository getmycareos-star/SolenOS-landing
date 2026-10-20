/**
 * FUTURE — unified server STT routing (Whisper → Gemini).
 * MVP voice conversation does not POST audio blobs.
 */
export const FUTURE_SERVER_TRANSCRIBE = {
  status: "FUTURE" as const,
  module: "src/lib/voice/speech-to-text/future/server-transcribe.ts",
  note: "Observation preview path only; not Voice Conversation Mode default.",
};

export {
  transcribeAudio,
  resolveServerSttProvider,
  type TranscribeResult,
  type TranscribeSuccess,
  type TranscribeFailure,
  type SttProvider,
} from "@/lib/voice-observation/transcribe";

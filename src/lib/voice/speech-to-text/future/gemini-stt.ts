/**
 * FUTURE — Gemini audio STT. Not MVP default.
 * GEMINI_API_KEY is for reasoning via /api/analyze, not server-side transcription in MVP.
 */
export const FUTURE_GEMINI_STT = {
  status: "FUTURE" as const,
  module: "src/lib/voice/speech-to-text/future/gemini-stt.ts",
  requires: ["GEMINI_API_KEY"],
  note: "MVP uses browser SpeechRecognition only. See ADR-017.",
};

export { transcribeWithGemini } from "@/lib/voice-observation/gemini-stt";

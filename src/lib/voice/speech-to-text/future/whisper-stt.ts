/**
 * FUTURE — OpenAI Whisper server STT. Not MVP default.
 * Plug in via ISpeechInput adapter when upgrading beyond browser Web Speech.
 */
export const FUTURE_WHISPER_STT = {
  status: "FUTURE" as const,
  module: "src/lib/voice/speech-to-text/future/whisper-stt.ts",
  requires: ["OPENAI_API_KEY"],
  note: "MVP uses browser SpeechRecognition only. See ADR-017.",
};

export { transcribeWithWhisper } from "@/lib/voice-observation/whisper";

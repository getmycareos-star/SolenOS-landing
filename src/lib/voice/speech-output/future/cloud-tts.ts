/**
 * FUTURE — Amazon Polly + Google Cloud TTS.
 * Upgrade path behind ISpeechOutput; browser synthesis is the preferred first path when voice is re-enabled (ADR-017/018).
 */
export const FUTURE_CLOUD_TTS = {
  status: "FUTURE" as const,
  module: "src/lib/voice/speech-output/future/cloud-tts.ts",
  engines: ["polly", "google"] as const,
  note: "Post-MVP upgrade when cloud credentials configured. See ADR-013 (superseded for MVP by ADR-017).",
};

export { synthesizeSpeech } from "@/lib/tts/synthesize";

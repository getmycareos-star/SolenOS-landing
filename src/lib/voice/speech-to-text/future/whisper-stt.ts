/** Retired: hosted Whisper server transcription is not supported. */
export const FUTURE_WHISPER_STT = {
  status: "RETIRED" as const,
  module: "src/lib/voice/speech-to-text/future/whisper-stt.ts",
  note: "Caregiver MVP uses browser Web Speech only. No hosted transcription provider is configured.",
};

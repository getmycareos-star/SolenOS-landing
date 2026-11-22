/** Retired: Gemini server transcription is not supported. */
export const FUTURE_GEMINI_STT = {
  status: "RETIRED" as const,
  module: "src/lib/voice/speech-to-text/future/gemini-stt.ts",
  note: "Caregiver MVP uses browser Web Speech only. No hosted transcription provider is configured.",
};

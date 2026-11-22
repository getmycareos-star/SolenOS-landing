"use client";

/**
 * Compatibility surface for a future server transcription option.
 * The caregiver MVP uses browser dictation only; this helper never sends audio
 * to a hosted provider or to a server endpoint.
 */
export type ServerTranscribeResult = {
  transcript: string;
  usedServer: false;
  code: "NO_SERVER_STT";
};

export async function transcribeObservationAudio(params: {
  blob: Blob;
  languageHint?: string;
  caregiverId?: string;
}): Promise<ServerTranscribeResult> {
  void params;
  return {
    transcript: "",
    usedServer: false,
    code: "NO_SERVER_STT",
  };
}

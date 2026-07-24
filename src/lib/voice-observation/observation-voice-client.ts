"use client";

export type ServerTranscribeResult = {
  transcript: string;
  /** FUTURE — server STT polish is not MVP default. */
  usedServer: boolean;
  provider?: "whisper" | "gemini";
  model?: string;
};

/**
 * FUTURE optional server STT polish via POST /api/observations/voice.
 * MVP observation capture uses browser Web Speech only — this always soft-fails without server keys.
 */
export async function transcribeObservationAudio(params: {
  blob: Blob;
  languageHint?: string;
  caregiverId?: string;
}): Promise<ServerTranscribeResult> {
  void params;
  return { transcript: "", usedServer: false };
}

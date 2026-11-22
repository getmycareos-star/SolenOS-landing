/**
 * Server-side speech recognition is intentionally disabled.
 * The caregiver MVP uses browser Web Speech only (ADR-017).
 * This compatibility surface must never call a hosted transcription provider.
 */

export type SttProvider = "browser";

export type TranscribeSuccess = {
  ok: true;
  transcript: string;
  model: string;
  provider: SttProvider;
};

export type TranscribeFailure = {
  ok: false;
  error: string;
  code: "EMPTY_AUDIO" | "NO_SERVER_STT";
};

export type TranscribeResult = TranscribeSuccess | TranscribeFailure;

/** Server transcription is not part of the caregiver MVP. */
export function resolveServerSttProvider(): null {
  return null;
}

/** Fail closed; callers must use browser recognition or typed input. */
export async function transcribeAudio(params: {
  audio: Blob | Buffer | ArrayBuffer;
  filename?: string;
  mimeType?: string;
  languageHint?: string;
}): Promise<TranscribeResult> {
  const empty = params.audio instanceof Blob
    ? params.audio.size === 0
    : Buffer.isBuffer(params.audio)
      ? params.audio.length === 0
      : params.audio.byteLength === 0;
  return {
    ok: false,
    code: empty ? "EMPTY_AUDIO" : "NO_SERVER_STT",
    error: "Server transcription is not available. Use browser voice recognition or type your observation.",
  };
}

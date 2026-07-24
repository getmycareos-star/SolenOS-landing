/**
 * FUTURE — unified server STT routing for observation audio blobs.
 * MVP voice I/O uses browser Web Speech only (ADR-017).
 */

import { transcribeWithGemini } from "./gemini-stt";
import { transcribeWithWhisper } from "./whisper";

export type SttProvider = "whisper" | "gemini" | "browser";

export type TranscribeSuccess = {
  ok: true;
  transcript: string;
  model: string;
  provider: SttProvider;
};

export type TranscribeFailure = {
  ok: false;
  error: string;
  code: "MISSING_API_KEY" | "EMPTY_AUDIO" | "TRANSCRIPTION_FAILED" | "NO_SERVER_STT";
};

export type TranscribeResult = TranscribeSuccess | TranscribeFailure;

export function resolveServerSttProvider(): SttProvider | null {
  if (process.env.OPENAI_API_KEY?.trim()) return "whisper";
  if (process.env.GEMINI_API_KEY?.trim()) return "gemini";
  return null;
}

/**
 * Server-side transcription with provider priority:
 * Whisper (OPENAI_API_KEY) → Gemini (GEMINI_API_KEY) → NO_SERVER_STT.
 */
export async function transcribeAudio(params: {
  audio: Blob | Buffer | ArrayBuffer;
  filename?: string;
  mimeType?: string;
  languageHint?: string;
}): Promise<TranscribeResult> {
  const provider = resolveServerSttProvider();

  if (provider === "whisper") {
    const result = await transcribeWithWhisper(params);
    if (result.ok) {
      return { ...result, provider: "whisper" };
    }
    return result;
  }

  if (provider === "gemini") {
    const result = await transcribeWithGemini(params);
    if (result.ok) {
      return { ...result, provider: "gemini" };
    }
    return result;
  }

  return {
    ok: false,
    code: "NO_SERVER_STT",
    error:
      "No server speech-to-text configured. Use on-device browser recognition or type your observation.",
  };
}

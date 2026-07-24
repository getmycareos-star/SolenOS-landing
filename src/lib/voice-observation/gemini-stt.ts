/**
 * Gemini multimodal STT — primary server path when OPENAI_API_KEY is absent.
 * Uses GEMINI_API_KEY from .env (same key as POST /api/analyze).
 */

import { GEMINI_MVP_MODEL } from "@/lib/gemini-contract";
import { getGeminiApiKey } from "@/lib/env/gemini";
import { SOLENOS_LANGUAGE_NAMES } from "@/lib/multilingual-execution/constants";
import { toSolenOSLanguage } from "./speech-language";

export type GeminiSttSuccess = {
  ok: true;
  transcript: string;
  model: string;
  provider: "gemini";
};

export type GeminiSttFailure = {
  ok: false;
  error: string;
  code: "MISSING_API_KEY" | "EMPTY_AUDIO" | "TRANSCRIPTION_FAILED";
};

export type GeminiSttResult = GeminiSttSuccess | GeminiSttFailure;

function getGeminiModel(): string {
  return process.env.SOLENOS_GEMINI_MODEL?.trim() || GEMINI_MVP_MODEL;
}

async function toBase64(audio: Blob | Buffer | ArrayBuffer): Promise<string> {
  if (Buffer.isBuffer(audio)) {
    return audio.toString("base64");
  }
  const buffer = Buffer.from(
    audio instanceof Blob ? await audio.arrayBuffer() : audio,
  );
  return buffer.toString("base64");
}

async function toBlob(
  audio: Blob | Buffer | ArrayBuffer,
  mimeType: string,
): Promise<Blob> {
  if (audio instanceof Blob) return audio;
  if (Buffer.isBuffer(audio)) {
    return new Blob([audio], { type: mimeType });
  }
  return new Blob([audio], { type: mimeType });
}

/**
 * Transcribe caregiver audio via Gemini generateContent (inline audio).
 */
export async function transcribeWithGemini(params: {
  audio: Blob | Buffer | ArrayBuffer;
  filename?: string;
  mimeType?: string;
  languageHint?: string;
}): Promise<GeminiSttResult> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return {
      ok: false,
      code: "MISSING_API_KEY",
      error: "GEMINI_API_KEY is not configured for server transcription.",
    };
  }

  const mimeType = params.mimeType?.trim() || "audio/webm";
  const blob = await toBlob(params.audio, mimeType);

  if (blob.size === 0) {
    return { ok: false, code: "EMPTY_AUDIO", error: "Audio file is empty" };
  }

  const language = toSolenOSLanguage(params.languageHint);
  const languageName = SOLENOS_LANGUAGE_NAMES[language];
  const model = getGeminiModel();
  const base64 = await toBase64(blob);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const prompt = [
    "Transcribe this caregiver observation audio verbatim.",
    `The speaker is likely using ${languageName}.`,
    "Return only the spoken words — no labels, markdown, JSON, or commentary.",
    "If the audio is silent or unintelligible, return an empty string.",
  ].join(" ");

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType,
                  data: base64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 2048,
        },
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return {
        ok: false,
        code: "TRANSCRIPTION_FAILED",
        error: `Gemini transcription failed (${response.status}): ${detail.slice(0, 200) || response.statusText}`,
      };
    }

    const data = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };

    const transcript = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
    if (!transcript) {
      return {
        ok: false,
        code: "TRANSCRIPTION_FAILED",
        error: "Gemini returned an empty transcript",
      };
    }

    return { ok: true, transcript, model, provider: "gemini" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown Gemini error";
    return {
      ok: false,
      code: "TRANSCRIPTION_FAILED",
      error: `Gemini request failed: ${message}`,
    };
  }
}

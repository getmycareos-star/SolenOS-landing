/// <reference path="./optional-sdk.d.ts" />
import { GOOGLE_TTS_VOICES, type TtsVoiceProfile } from "./voices";
import type { TtsLanguage } from "./languages";
import { buildCalmSsml } from "./ssml";

export type GoogleSynthesizeResult = {
  ok: true;
  engine: "google";
  audioContent: Buffer;
  contentType: "audio/mpeg";
  voiceName: string;
  languageCode: string;
  ssml: string;
};

export type GoogleSynthesizeError = {
  ok: false;
  error: string;
  code: "MISSING_CREDENTIALS" | "SYNTHESIS_FAILED";
};

function googleCredentialsConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      process.env.GOOGLE_TTS_CREDENTIALS_JSON ||
      process.env.GOOGLE_CLOUD_PROJECT,
  );
}

/**
 * Synthesize MP3 via Google Cloud Text-to-Speech (Wavenet).
 * Soft-fails with a clear message when credentials are missing.
 */
export async function synthesizeWithGoogle(params: {
  text: string;
  language: Extract<TtsLanguage, "tl" | "vi" | "fa" | "hy">;
  voiceProfile: TtsVoiceProfile;
}): Promise<GoogleSynthesizeResult | GoogleSynthesizeError> {
  const ssml = buildCalmSsml(params.text);
  const voice = GOOGLE_TTS_VOICES[params.language][params.voiceProfile];

  if (!googleCredentialsConfigured()) {
    return {
      ok: false,
      code: "MISSING_CREDENTIALS",
      error:
        "Google Cloud TTS credentials missing. Set GOOGLE_APPLICATION_CREDENTIALS (service account JSON path) or GOOGLE_TTS_CREDENTIALS_JSON.",
    };
  }

  try {
    const { TextToSpeechClient } = await import("@google-cloud/text-to-speech");
    const clientOptions: { credentials?: object; projectId?: string } = {};

    if (process.env.GOOGLE_TTS_CREDENTIALS_JSON) {
      clientOptions.credentials = JSON.parse(process.env.GOOGLE_TTS_CREDENTIALS_JSON) as object;
    }
    if (process.env.GOOGLE_CLOUD_PROJECT) {
      clientOptions.projectId = process.env.GOOGLE_CLOUD_PROJECT;
    }

    const client = new TextToSpeechClient(clientOptions);
    const [response] = await client.synthesizeSpeech({
      input: { ssml },
      voice: {
        languageCode: voice.languageCode,
        name: voice.name,
      },
      audioConfig: {
        audioEncoding: "MP3",
        speakingRate: 0.85,
        pitch: -2.0,
      },
    });

    const audioContent = response.audioContent;
    if (!audioContent) {
      return { ok: false, code: "SYNTHESIS_FAILED", error: "Google TTS returned empty audio" };
    }

    const buffer =
      typeof audioContent === "string"
        ? Buffer.from(audioContent, "base64")
        : Buffer.from(audioContent);

    return {
      ok: true,
      engine: "google",
      audioContent: buffer,
      contentType: "audio/mpeg",
      voiceName: voice.name,
      languageCode: voice.languageCode,
      ssml,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown Google TTS error";
    if (/Cannot find module|MODULE_NOT_FOUND/i.test(message)) {
      return {
        ok: false,
        code: "MISSING_CREDENTIALS",
        error:
          "Google Cloud TTS SDK not installed (@google-cloud/text-to-speech). Install to enable MP3 synthesis, or use text fallback.",
      };
    }
    return { ok: false, code: "SYNTHESIS_FAILED", error: `Google TTS synthesis failed: ${message}` };
  }
}

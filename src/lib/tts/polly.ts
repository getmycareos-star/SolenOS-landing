/// <reference path="./optional-sdk.d.ts" />
import {
  POLLY_LANGUAGE_CODES,
  POLLY_VOICE_IDS,
  type TtsVoiceProfile,
} from "./voices";
import type { TtsLanguage } from "./languages";
import { buildCalmSsml } from "./ssml";

export type PollySynthesizeResult = {
  ok: true;
  engine: "polly";
  audioContent: Buffer;
  contentType: "audio/mpeg";
  voiceId: string;
  languageCode: string;
  ssml: string;
};

export type PollySynthesizeError = {
  ok: false;
  error: string;
  code: "MISSING_CREDENTIALS" | "SYNTHESIS_FAILED";
};

function pollyCredentialsConfigured(): boolean {
  return Boolean(
    process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY &&
      (process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || process.env.POLLY_REGION),
  );
}

/**
 * Synthesize MP3 via Amazon Polly neural voices.
 * Soft-fails with a clear message when AWS credentials are missing.
 */
export async function synthesizeWithPolly(params: {
  text: string;
  language: Extract<TtsLanguage, "en" | "es" | "zh" | "ko" | "ru" | "ar">;
  voiceProfile: TtsVoiceProfile;
}): Promise<PollySynthesizeResult | PollySynthesizeError> {
  const ssml = buildCalmSsml(params.text);
  const voiceId = POLLY_VOICE_IDS[params.language][params.voiceProfile];
  const languageCode = POLLY_LANGUAGE_CODES[params.language];

  if (!pollyCredentialsConfigured()) {
    return {
      ok: false,
      code: "MISSING_CREDENTIALS",
      error:
        "Amazon Polly credentials missing. Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_REGION (or POLLY_REGION).",
    };
  }

  try {
    // Dynamic import so verify scripts / local runs without AWS SDK still load the module graph.
    const { PollyClient, SynthesizeSpeechCommand } = await import("@aws-sdk/client-polly");
    const region =
      process.env.POLLY_REGION ||
      process.env.AWS_REGION ||
      process.env.AWS_DEFAULT_REGION ||
      "us-east-1";

    const client = new PollyClient({ region });
    const response = await client.send(
      new SynthesizeSpeechCommand({
        Text: ssml,
        OutputFormat: "mp3",
        VoiceId: voiceId as never,
        LanguageCode: languageCode as never,
        Engine: "neural",
        TextType: "ssml",
      }),
    );

    if (!response.AudioStream) {
      return { ok: false, code: "SYNTHESIS_FAILED", error: "Polly returned empty audio stream" };
    }

    const chunks: Uint8Array[] = [];
    for await (const chunk of response.AudioStream as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }

    return {
      ok: true,
      engine: "polly",
      audioContent: Buffer.concat(chunks),
      contentType: "audio/mpeg",
      voiceId,
      languageCode,
      ssml,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown Polly error";
    if (/Cannot find module|MODULE_NOT_FOUND/i.test(message)) {
      return {
        ok: false,
        code: "MISSING_CREDENTIALS",
        error:
          "Amazon Polly SDK not installed (@aws-sdk/client-polly). Install to enable MP3 synthesis, or use text fallback.",
      };
    }
    return { ok: false, code: "SYNTHESIS_FAILED", error: `Polly synthesis failed: ${message}` };
  }
}

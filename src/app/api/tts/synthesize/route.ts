import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  coerceTtsLanguage,
  coerceTtsVoiceProfile,
  synthesizeSpeech,
} from "@/lib/tts";

/**
 * POST /api/tts/synthesize — accessibility readback for summaries/reports/confirmations.
 * Not a conversational chat endpoint. Returns MP3 when credentials exist.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Request body must be an object" }, { status: 400 });
  }

  const { text, language_preference, voice_profile } = body as {
    text?: unknown;
    language_preference?: unknown;
    voice_profile?: unknown;
  };

  if (typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "text must be a non-empty string" }, { status: 400 });
  }

  const language = coerceTtsLanguage(language_preference);
  const voiceProfile = coerceTtsVoiceProfile(voice_profile);

  const result = await synthesizeSpeech({
    text: text.trim(),
    languagePreference: language,
    voiceProfile,
  });

  if (!result.ok) {
    const status = result.code === "MISSING_CREDENTIALS" ? 503 : 422;
    return NextResponse.json(
      {
        error: result.error,
        code: result.code,
        engine: result.engine ?? null,
        language: result.language ?? language,
        ssml: result.ssml ?? null,
      },
      { status },
    );
  }

  return new NextResponse(new Uint8Array(result.audioContent), {
    status: 200,
    headers: {
      "Content-Type": result.contentType,
      "Content-Disposition": 'inline; filename="solenos-tts.mp3"',
      "X-SolenOS-TTS-Engine": result.engine,
      "X-SolenOS-TTS-Language": result.language,
      "X-SolenOS-TTS-Voice-Profile": result.voiceProfile,
      "Cache-Control": "no-store",
    },
  });
}

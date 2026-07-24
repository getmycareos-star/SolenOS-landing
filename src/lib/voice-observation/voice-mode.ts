/**
 * FUTURE server-side Voice Mode stub (Whisper + cloud TTS).
 * MVP Voice Conversation uses src/lib/voice with browser I/O only.
 */

import { coerceTtsLanguage, type TtsLanguage } from "@/lib/tts/languages";
import { synthesizeSpeech, type TtsVoiceProfile } from "@/lib/tts";
import { makeLanguageAwarePrompt } from "@/lib/multilingual-execution/prompt";
import type { SolenOSLanguage } from "@/lib/multilingual-execution/types";
import { transcribeAudio } from "./transcribe";

export type VoiceModeSurface =
  | "voice_mode_3am"
  | "weekly_care_briefing"
  | "crisis_guidance"
  | "benefit_tracker_guidance"
  | "observation_confirmation";

export type VoiceModeResult =
  | {
      ok: true;
      transcript: string;
      replyText: string;
      audioContent: Buffer;
      contentType: "audio/mpeg";
      language: TtsLanguage;
      surface: VoiceModeSurface;
    }
  | {
      ok: false;
      error: string;
      code: string;
      transcript?: string;
      replyText?: string;
    };

/**
 * Build a short, non-conversational confirmation / briefing reply in the user's language preference.
 * STUB: does not call Gemini when key missing — returns English template wrapped for language awareness.
 */
export function buildVoiceModeReply(params: {
  surface: VoiceModeSurface;
  transcript: string;
  languagePreference: TtsLanguage;
}): { replyText: string; promptWrapped: string } {
  const baseBySurface: Record<VoiceModeSurface, string> = {
    voice_mode_3am:
      "Observation noted. Rest when you can. Patterns are recorded for later review — not medical advice.",
    weekly_care_briefing:
      "Here is your weekly care briefing summary based on recorded observations only.",
    crisis_guidance:
      "If anyone is in immediate danger, contact emergency services. This guidance is observation-based, not clinical.",
    benefit_tracker_guidance:
      "Benefit tracking notes are ready to review. This is administrative support, not legal advice.",
    observation_confirmation: `Held in the Living Care Record: ${params.transcript.slice(0, 120)}`,
  };

  const replyText = baseBySurface[params.surface];
  const promptWrapped = makeLanguageAwarePrompt(
    replyText,
    params.languagePreference as SolenOSLanguage,
  );
  return { replyText, promptWrapped };
}

/**
 * Voice Mode stub pipeline. Uses Whisper + TTS facade. Optional Gemini left for FUTURE.
 */
export async function runVoiceModeStub(params: {
  surface: VoiceModeSurface;
  audio?: Blob | Buffer | ArrayBuffer;
  transcriptOverride?: string;
  languagePreference?: string;
  voiceProfile?: TtsVoiceProfile | string;
  filename?: string;
  mimeType?: string;
}): Promise<VoiceModeResult> {
  const language = coerceTtsLanguage(params.languagePreference);

  let transcript = params.transcriptOverride?.trim() ?? "";
  if (!transcript) {
    if (!params.audio) {
      return { ok: false, code: "EMPTY_AUDIO", error: "Audio or transcript required" };
    }
    const stt = await transcribeAudio({
      audio: params.audio,
      filename: params.filename,
      mimeType: params.mimeType,
      languageHint: language === "zh" ? "zh" : language,
    });
    if (!stt.ok) {
      return { ok: false, code: stt.code, error: stt.error };
    }
    transcript = stt.transcript;
  }

  const { replyText } = buildVoiceModeReply({
    surface: params.surface,
    transcript,
    languagePreference: language,
  });

  const tts = await synthesizeSpeech({
    text: replyText,
    languagePreference: language,
    voiceProfile: params.voiceProfile,
  });

  if (!tts.ok) {
    return {
      ok: false,
      code: tts.code,
      error: tts.error,
      transcript,
      replyText,
    };
  }

  return {
    ok: true,
    transcript,
    replyText,
    audioContent: tts.audioContent,
    contentType: "audio/mpeg",
    language,
    surface: params.surface,
  };
}

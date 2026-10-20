/**
 * FUTURE — OpenAI Whisper server STT. Not MVP default (ADR-017).
 * Voice observation path may use edited_transcript without audio.
 */

export type WhisperTranscribeSuccess = {
  ok: true;
  transcript: string;
  model: string;
};

export type WhisperTranscribeFailure = {
  ok: false;
  error: string;
  code: "MISSING_API_KEY" | "EMPTY_AUDIO" | "TRANSCRIPTION_FAILED" | "NO_SERVER_STT";
};

export type WhisperTranscribeResult = WhisperTranscribeSuccess | WhisperTranscribeFailure;

const WHISPER_MODEL = "whisper-1";
const OPENAI_TRANSCRIPTIONS_URL = "https://api.openai.com/v1/audio/transcriptions";

function resolveOpenAiKey(): string | undefined {
  return process.env.OPENAI_API_KEY?.trim() || undefined;
}

/**
 * Transcribe caregiver audio via OpenAI Whisper.
 * Soft-fails with a clear message when OPENAI_API_KEY is missing — text fallback remains available.
 */
export async function transcribeWithWhisper(params: {
  audio: Blob | Buffer | ArrayBuffer;
  filename?: string;
  mimeType?: string;
  languageHint?: string;
}): Promise<WhisperTranscribeResult> {
  const apiKey = resolveOpenAiKey();
  if (!apiKey) {
    return {
      ok: false,
      code: "MISSING_API_KEY",
      error: "OPENAI_API_KEY is not configured for Whisper.",
    };
  }

  const filename = params.filename ?? "observation.webm";
  const mimeType = params.mimeType ?? "audio/webm";

  let blob: Blob;
  if (params.audio instanceof Blob) {
    blob = params.audio;
  } else if (Buffer.isBuffer(params.audio)) {
    blob = new Blob([params.audio], { type: mimeType });
  } else {
    blob = new Blob([params.audio], { type: mimeType });
  }

  if (blob.size === 0) {
    return { ok: false, code: "EMPTY_AUDIO", error: "Audio file is empty" };
  }

  const form = new FormData();
  form.append("file", blob, filename);
  form.append("model", WHISPER_MODEL);
  form.append("response_format", "json");
  if (params.languageHint) {
    form.append("language", params.languageHint);
  }

  try {
    const response = await fetch(OPENAI_TRANSCRIPTIONS_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return {
        ok: false,
        code: "TRANSCRIPTION_FAILED",
        error: `Whisper transcription failed (${response.status}): ${detail.slice(0, 200) || response.statusText}`,
      };
    }

    const data = (await response.json()) as { text?: string };
    const transcript = data.text?.trim() ?? "";
    if (!transcript) {
      return {
        ok: false,
        code: "TRANSCRIPTION_FAILED",
        error: "Whisper returned an empty transcript",
      };
    }

    return { ok: true, transcript, model: WHISPER_MODEL };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown Whisper error";
    return {
      ok: false,
      code: "TRANSCRIPTION_FAILED",
      error: `Whisper request failed: ${message}`,
    };
  }
}

/**
 * Full voice observation path: audio → server STT → existing recordObservation.
 */
export async function captureVoiceObservation(params: {
  audio: Blob | Buffer | ArrayBuffer;
  caregiverId: string;
  filename?: string;
  mimeType?: string;
  languageHint?: string;
  /** When provided, skip Whisper and use edited transcript. */
  editedTranscript?: string;
  record: (input: {
    caregiver_id: string;
    raw_text: string;
    source: "voice";
  }) => {
    observation_id: string;
    structured: unknown;
    aggregation: unknown;
    weekly_summary_snippet: string;
    observations_this_week: number;
  };
}): Promise<
  | {
      ok: true;
      transcript: string;
      observation: ReturnType<typeof params.record>;
      whisperModel?: string;
    }
  | WhisperTranscribeFailure
> {
  let transcript = params.editedTranscript?.trim() ?? "";
  let whisperModel: string | undefined;

  if (!transcript) {
    const { transcribeAudio } = await import("./transcribe");
    const stt = await transcribeAudio({
      audio: params.audio,
      filename: params.filename,
      mimeType: params.mimeType,
      languageHint: params.languageHint,
    });
    if (!stt.ok) return stt;
    transcript = stt.transcript;
    whisperModel = stt.model;
  }

  const observation = params.record({
    caregiver_id: params.caregiverId,
    raw_text: transcript,
    source: "voice",
  });

  return { ok: true, transcript, observation, whisperModel };
}

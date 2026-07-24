import type { NextRequest } from "next/server";

import { NextResponse } from "next/server";

import { recordObservation } from "@/lib/observation-intelligence";

import { captureVoiceObservation, transcribeAudio } from "@/lib/voice-observation";



const DEFAULT_CAREGIVER_ID = "default_caregiver";



/**
 * POST /api/observations/voice — observation record from voice or edited transcript.
 *
 * MVP: caregivers use browser Web Speech for dictation; POST with `edited_transcript` only.
 * FUTURE: optional server STT (Whisper/Gemini) when audio blob provided and keys configured.
 * Voice Conversation Mode does NOT use this route — see src/lib/voice + POST /api/analyze.
 */
export async function POST(req: NextRequest) {

  let form: FormData;

  try {

    form = await req.formData();

  } catch {

    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });

  }



  const caregiverIdRaw = form.get("caregiver_id");

  const caregiver_id =

    typeof caregiverIdRaw === "string" && caregiverIdRaw.trim()

      ? caregiverIdRaw.trim()

      : DEFAULT_CAREGIVER_ID;



  const previewRaw = form.get("preview_only");

  const previewOnly =

    previewRaw === "true" || previewRaw === "1" || previewRaw === "yes";



  const editedRaw = form.get("edited_transcript");

  const editedTranscript =

    typeof editedRaw === "string" && editedRaw.trim() ? editedRaw.trim() : undefined;



  const languageHintRaw = form.get("language_hint");

  const languageHint =

    typeof languageHintRaw === "string" && languageHintRaw.trim()

      ? languageHintRaw.trim()

      : undefined;



  const audioEntry = form.get("audio") ?? form.get("file");



  if (!editedTranscript && !(audioEntry instanceof Blob)) {

    return NextResponse.json(

      {

        error:

          "Provide audio (multipart field `audio` or `file`) or edited_transcript. Text path remains available via POST /api/observations.",

      },

      { status: 400 },

    );

  }



  // Preview path: server STT only — caregiver can edit before save.

  if (previewOnly && !editedTranscript) {

    if (!(audioEntry instanceof Blob)) {

      return NextResponse.json({ error: "Audio required for preview" }, { status: 400 });

    }

    const filename =

      audioEntry instanceof File && audioEntry.name ? audioEntry.name : "observation.webm";

    const stt = await transcribeAudio({

      audio: audioEntry,

      filename,

      mimeType: audioEntry.type || "audio/webm",

      languageHint,

    });

    if (!stt.ok) {

      const status = stt.code === "NO_SERVER_STT" ? 503 : 422;

      return NextResponse.json(

        {

          error: stt.error,

          code: stt.code,

          text_fallback: "POST /api/observations with raw_text remains available",

          client_stt_hint:

            stt.code === "NO_SERVER_STT"

              ? "Use on-device browser SpeechRecognition while listening"

              : undefined,

        },

        { status },

      );

    }

    return NextResponse.json({

      transcript: stt.transcript,

      preview_only: true,

      stt_provider: stt.provider,

      stt_model: stt.model,

      source_type: "voice",

    });

  }



  const filename =

    audioEntry instanceof File && audioEntry.name

      ? audioEntry.name

      : "observation.webm";

  const mimeType =

    audioEntry instanceof Blob && audioEntry.type

      ? audioEntry.type

      : "audio/webm";



  const result = await captureVoiceObservation({

    audio: audioEntry instanceof Blob ? audioEntry : new Blob([]),

    caregiverId: caregiver_id,

    filename,

    mimeType,

    languageHint,

    editedTranscript,

    record: recordObservation,

  });



  if (!result.ok) {

    const status = result.code === "NO_SERVER_STT" ? 503 : 422;

    return NextResponse.json(

      {

        error: result.error,

        code: result.code,

        text_fallback: "POST /api/observations with raw_text remains available",

        client_stt_hint:

          result.code === "NO_SERVER_STT"

            ? "Use on-device browser SpeechRecognition while listening"

            : undefined,

      },

      { status },

    );

  }



  return NextResponse.json({

    ...result.observation,

    transcript: result.transcript,

    source_type: "voice",

    stt_model: result.whisperModel ?? null,

  });

}


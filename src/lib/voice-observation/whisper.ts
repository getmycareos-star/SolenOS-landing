/** Compatibility helper for edited browser transcripts. No server speech provider is used. */

export type WhisperTranscribeFailure = {
  ok: false;
  error: string;
  code: "NO_SERVER_STT" | "EMPTY_AUDIO";
};
export type WhisperTranscribeResult = WhisperTranscribeFailure;

export async function captureVoiceObservation(params: {
  audio: Blob | Buffer | ArrayBuffer;
  caregiverId: string;
  editedTranscript?: string;
  record: (input: { caregiver_id: string; raw_text: string; source: "voice" }) => {
    observation_id: string;
    structured: unknown;
    aggregation: unknown;
    weekly_summary_snippet: string;
    observations_this_week: number;
  };
}): Promise<
  | { ok: true; transcript: string; observation: ReturnType<typeof params.record> }
  | WhisperTranscribeFailure
> {
  const transcript = params.editedTranscript?.trim() ?? "";
  if (!transcript) {
    return {
      ok: false,
      code: params.audio instanceof Blob && params.audio.size === 0 ? "EMPTY_AUDIO" : "NO_SERVER_STT",
      error: "Server transcription is not available. Use browser voice recognition or type your observation.",
    };
  }
  const observation = params.record({
    caregiver_id: params.caregiverId,
    raw_text: transcript,
    source: "voice",
  });
  return { ok: true, transcript, observation };
}

import type { InputProvenance } from "../care-events/types";

export type VoiceCaptureState = "idle" | "listening";

export type VoiceCaptureResult = {
  transcript: string;
  provenance: InputProvenance;
};

export type VoiceCaptureCallbacks = {
  onPartial?: (text: string) => void;
  onComplete?: (result: VoiceCaptureResult) => void;
  onEnd?: () => void;
};

export type SpeechRecognitionResultLike = {
  0: { transcript: string; confidence?: number };
  isFinal: boolean;
};

export type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<SpeechRecognitionResultLike> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

export function getSpeechRecognitionConstructor():
  | (new () => SpeechRecognitionLike)
  | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export function isVoiceInputAvailable(): boolean {
  return getSpeechRecognitionConstructor() !== undefined;
}

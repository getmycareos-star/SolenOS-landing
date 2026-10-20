/** Provider-agnostic speech input — MVP: browser Web Speech API only. */

export type SpeechInputErrorCode =
  | "unsupported"
  | "permission_denied"
  | "recognition_failed"
  | "no_speech"
  | "aborted";

export type SpeechInputError = {
  code: SpeechInputErrorCode;
  message: string;
};

export type SpeechInputCallbacks = {
  onPartial?: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (error: SpeechInputError) => void;
  onEnd?: () => void;
};

export interface ISpeechInput {
  readonly providerId: string;
  isSupported(): boolean;
  start(languageHint: string | undefined, callbacks: SpeechInputCallbacks): boolean;
  stop(): void;
}

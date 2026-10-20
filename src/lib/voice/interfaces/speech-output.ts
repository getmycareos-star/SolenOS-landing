/** Provider-agnostic speech output — MVP: browser speechSynthesis only. */

export type SpeechOutputCallbacks = {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (message: string) => void;
};

export interface ISpeechOutput {
  readonly providerId: string;
  isSupported(): boolean;
  speak(text: string, languageHint: string | undefined, callbacks?: SpeechOutputCallbacks): void;
  stop(): void;
  isSpeaking(): boolean;
}

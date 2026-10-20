import type { ISpeechInput, SpeechInputCallbacks } from "../interfaces/speech-input";
import { toSpeechRecognitionLang } from "../speech-language";

export type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult:
    | ((event: {
        results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
      }) => void)
    | null;
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

export function isBrowserWebSpeechSupported(): boolean {
  return getSpeechRecognitionConstructor() !== undefined;
}

/**
 * MVP speech input — browser Web Speech API (`SpeechRecognition`) only.
 * No server STT, Whisper, or cloud audio upload.
 */
export class BrowserWebSpeechInput implements ISpeechInput {
  readonly providerId = "browser-web-speech";

  private recognition: SpeechRecognitionLike | null = null;
  private finalBuffer = "";

  isSupported(): boolean {
    return isBrowserWebSpeechSupported();
  }

  start(languageHint: string | undefined, callbacks: SpeechInputCallbacks): boolean {
    const SpeechRecognitionCtor = getSpeechRecognitionConstructor();
    if (!SpeechRecognitionCtor) {
      callbacks.onError({
        code: "unsupported",
        message:
          "Voice recognition is not supported in this browser (try Chrome, Edge, or Safari).",
      });
      return false;
    }

    this.stop();
    this.finalBuffer = "";

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = toSpeechRecognitionLang(languageHint);

    recognition.onresult = (event) => {
      let interim = "";
      let finalChunk = "";
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalChunk += result[0].transcript;
        else interim += result[0].transcript;
      }
      if (interim.trim()) {
        callbacks.onPartial?.(`${this.finalBuffer} ${interim}`.replace(/\s+/g, " ").trim());
      }
      if (finalChunk.trim()) {
        this.finalBuffer = `${this.finalBuffer} ${finalChunk}`.replace(/\s+/g, " ").trim();
        callbacks.onPartial?.(this.finalBuffer);
      }
    };

    recognition.onerror = (event) => {
      const err = event.error ?? "unknown";
      if (err === "not-allowed") {
        callbacks.onError({
          code: "permission_denied",
          message: "Microphone permission denied.",
        });
      } else if (err === "no-speech") {
        callbacks.onError({
          code: "no_speech",
          message: "No speech detected. Try again.",
        });
      } else if (err !== "aborted") {
        callbacks.onError({
          code: "recognition_failed",
          message: "Voice recognition interrupted. Tap retry.",
        });
      }
    };

    recognition.onend = () => {
      const transcript = this.finalBuffer.trim();
      if (transcript) {
        callbacks.onFinal(transcript);
      } else {
        callbacks.onError({
          code: "no_speech",
          message: "No speech detected. Try again.",
        });
      }
      callbacks.onEnd?.();
      this.recognition = null;
    };

    this.recognition = recognition;
    try {
      recognition.start();
      return true;
    } catch {
      callbacks.onError({
        code: "recognition_failed",
        message: "Could not start voice recognition.",
      });
      return false;
    }
  }

  stop(): void {
    this.recognition?.stop();
    this.recognition = null;
  }
}

/** Continuous dictation variant — fills textarea while user speaks (observation / brain-dump). */
export class BrowserWebSpeechDictation implements ISpeechInput {
  readonly providerId = "browser-web-speech-dictation";

  private recognition: SpeechRecognitionLike | null = null;
  private liveBase = "";

  isSupported(): boolean {
    return isBrowserWebSpeechSupported();
  }

  start(languageHint: string | undefined, callbacks: SpeechInputCallbacks): boolean {
    const SpeechRecognitionCtor = getSpeechRecognitionConstructor();
    if (!SpeechRecognitionCtor) {
      callbacks.onError({
        code: "unsupported",
        message: "Voice recognition is not supported in this browser.",
      });
      return false;
    }

    this.stop();
    this.liveBase = "";

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = toSpeechRecognitionLang(languageHint);

    recognition.onresult = (event) => {
      let interim = "";
      let finalChunk = "";
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalChunk += result[0].transcript;
        else interim += result[0].transcript;
      }
      const assembled = `${this.liveBase}${finalChunk ? ` ${finalChunk}` : ""}${
        interim ? ` ${interim}` : ""
      }`
        .replace(/\s+/g, " ")
        .trim();
      callbacks.onPartial?.(assembled);
      if (finalChunk) {
        this.liveBase = `${this.liveBase} ${finalChunk}`.replace(/\s+/g, " ").trim();
      }
    };

    recognition.onerror = (event) => {
      const err = event.error ?? "unknown";
      if (err === "not-allowed") {
        callbacks.onError({
          code: "permission_denied",
          message: "Microphone permission denied.",
        });
      } else if (err !== "aborted" && err !== "no-speech") {
        callbacks.onError({
          code: "recognition_failed",
          message: "Voice recognition interrupted.",
        });
      }
    };

    recognition.onend = () => {
      callbacks.onEnd?.();
    };

    this.recognition = recognition;
    try {
      recognition.start();
      return true;
    } catch {
      callbacks.onError({
        code: "recognition_failed",
        message: "Could not start voice recognition.",
      });
      return false;
    }
  }

  /** Seed existing textarea content before dictation continues. */
  seedBaseText(text: string): void {
    this.liveBase = text.trim();
  }

  stop(): void {
    this.recognition?.stop();
    this.recognition = null;
  }
}

export const defaultBrowserSpeechInput = new BrowserWebSpeechInput();
export const defaultBrowserSpeechDictation = new BrowserWebSpeechDictation();

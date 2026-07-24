import type { ISpeechOutput, SpeechOutputCallbacks } from "../interfaces/speech-output";
import { toSpeechSynthesisLang } from "../speech-language";

/**
 * MVP speech output — browser `speechSynthesis` only.
 * Read Aloud + automatic voice response in Voice Conversation Mode.
 */
export class BrowserSpeechSynthesisOutput implements ISpeechOutput {
  readonly providerId = "browser-speech-synthesis";

  private utterance: SpeechSynthesisUtterance | null = null;

  isSupported(): boolean {
    return typeof window !== "undefined" && typeof window.speechSynthesis !== "undefined";
  }

  speak(text: string, languageHint: string | undefined, callbacks?: SpeechOutputCallbacks): void {
    const trimmed = text.trim();
    if (!trimmed) {
      callbacks?.onError?.("Nothing to speak.");
      return;
    }

    if (!this.isSupported()) {
      callbacks?.onError?.("Read-aloud is not supported in this browser.");
      return;
    }

    this.stop();

    const utterance = new SpeechSynthesisUtterance(trimmed);
    utterance.lang = toSpeechSynthesisLang(languageHint);
    utterance.rate = 0.92;
    utterance.pitch = 0.95;

    utterance.onstart = () => callbacks?.onStart?.();
    utterance.onend = () => {
      this.utterance = null;
      callbacks?.onEnd?.();
    };
    utterance.onerror = (event) => {
      this.utterance = null;
      const err = (event as SpeechSynthesisErrorEvent).error;
      // Chrome fires "interrupted" / "canceled" when we cancel for a new utterance — not a real failure.
      if (err === "interrupted" || err === "canceled") {
        callbacks?.onEnd?.();
        return;
      }
      callbacks?.onError?.(
        err === "not-allowed"
          ? "Click Hear SolenOS again — the browser blocked autoplay speech."
          : "Speech playback failed. Try Chrome or Edge with sound enabled.",
      );
    };

    this.utterance = utterance;
    // Voices may load asynchronously in Chromium.
    const speakNow = () => {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    };
    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.onvoiceschanged = null;
        speakNow();
      };
      // Fallback if onvoiceschanged never fires
      setTimeout(speakNow, 250);
    } else {
      speakNow();
    }
  }

  stop(): void {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    this.utterance = null;
  }

  isSpeaking(): boolean {
    return typeof window !== "undefined" && window.speechSynthesis?.speaking === true;
  }
}

export const defaultBrowserSpeechOutput = new BrowserSpeechSynthesisOutput();

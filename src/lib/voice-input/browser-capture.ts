import { VOICE_CONFIDENCE_THRESHOLD, VOICE_INPUT_LANG } from "./constants";
import type {
  SpeechRecognitionLike,
  VoiceCaptureCallbacks,
  VoiceCaptureResult,
} from "./types";
import { getSpeechRecognitionConstructor } from "./types";

/**
 * Phase 1 voice capture — one-shot browser STT with silent fallback.
 * No error UI, no continuous listening, no audio storage.
 */
export class BrowserVoiceCapture {
  private recognition: SpeechRecognitionLike | null = null;
  private finalTranscript = "";
  private bestConfidence: number | null = null;
  private gotFinalResult = false;
  private capturedAt: string | null = null;

  start(callbacks: VoiceCaptureCallbacks): boolean {
    const SpeechRecognitionCtor = getSpeechRecognitionConstructor();
    if (!SpeechRecognitionCtor) return false;

    this.stop();
    this.finalTranscript = "";
    this.bestConfidence = null;
    this.gotFinalResult = false;
    this.capturedAt = null;

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = VOICE_INPUT_LANG;

    recognition.onresult = (event) => {
      let interim = "";
      let finalChunk = "";

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i]!;
        const transcript = result[0]?.transcript ?? "";
        const confidence = result[0]?.confidence;

        if (result.isFinal) {
          finalChunk += transcript;
          this.gotFinalResult = true;
          if (typeof confidence === "number" && Number.isFinite(confidence)) {
            this.bestConfidence =
              this.bestConfidence == null
                ? confidence
                : Math.max(this.bestConfidence, confidence);
          }
        } else {
          interim += transcript;
        }
      }

      const preview = `${this.finalTranscript}${finalChunk ? ` ${finalChunk}` : ""}${
        interim ? ` ${interim}` : ""
      }`
        .replace(/\s+/g, " ")
        .trim();

      if (preview) {
        callbacks.onPartial?.(preview);
      }

      if (finalChunk.trim()) {
        this.finalTranscript = `${this.finalTranscript} ${finalChunk}`.replace(/\s+/g, " ").trim();
        if (!this.capturedAt) {
          this.capturedAt = new Date().toISOString();
        }
      }
    };

    recognition.onerror = () => {
      // Silent fallback — partial text stays in the input box; no UI error.
      this.recognition = null;
    };

    recognition.onend = () => {
      const transcript = this.finalTranscript.trim();
      if (transcript) {
        const confidence = this.bestConfidence;
        const transcriptUncertain =
          !this.gotFinalResult ||
          confidence == null ||
          confidence < VOICE_CONFIDENCE_THRESHOLD;

        const result: VoiceCaptureResult = {
          transcript,
          provenance: {
            input_type: "voice",
            captured_at: this.capturedAt ?? new Date().toISOString(),
            recognition_confidence: confidence,
            transcript_uncertain: transcriptUncertain,
          },
        };
        callbacks.onComplete?.(result);
      }
      callbacks.onEnd?.();
      this.recognition = null;
    };

    this.recognition = recognition;
    try {
      recognition.start();
      return true;
    } catch {
      this.recognition = null;
      return false;
    }
  }

  stop(): void {
    this.recognition?.stop();
    this.recognition = null;
  }
}

export const defaultBrowserVoiceCapture = new BrowserVoiceCapture();

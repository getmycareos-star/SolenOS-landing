import type { ISpeechInput } from "../interfaces/speech-input";
import type { ISpeechOutput } from "../interfaces/speech-output";
import type {
  IVoiceController,
  VoiceConversationState,
  VoiceConversationTurn,
} from "../interfaces/voice-controller";
import { defaultBrowserSpeechInput } from "../speech-to-text/browser-web-speech";
import { defaultBrowserSpeechOutput } from "../speech-output/browser-speech-synthesis";
import { buildVoiceModeGreeting, buildVoiceSpokenResponse } from "./build-spoken-response";

export type VoiceConversationAnalyzeFn = (params: {
  input: string;
  languagePreference?: string;
  telemetryUserId?: string;
  careSessionId?: string;
  priorInputRaw?: string;
}) => Promise<Record<string, unknown>>;

export type VoiceConversationControllerOptions = {
  languagePreference?: string;
  telemetryUserId?: string;
  careSessionId?: string;
  speechInput?: ISpeechInput;
  speechOutput?: ISpeechOutput;
  analyze?: VoiceConversationAnalyzeFn;
  onStateChange?: (state: VoiceConversationState) => void;
  onTurn?: (turn: VoiceConversationTurn, turnIndex: number) => void;
  onError?: (message: string) => void;
};

const DEFAULT_ANALYZE: VoiceConversationAnalyzeFn = async ({
  input,
  languagePreference,
  telemetryUserId,
  careSessionId,
  priorInputRaw,
}) => {
  // Care Reality path — never ops /api/analyze as primary voice product (CRI).
  const res = await fetch("/api/situation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      raw_input: input,
      caregiver_id: telemetryUserId ?? "voice_caregiver",
      care_session_id: careSessionId ?? telemetryUserId ?? "voice_session",
      ...(languagePreference ? { language_preference: languagePreference } : {}),
      ...(priorInputRaw ? { prior_input_raw: priorInputRaw } : {}),
    }),
  });
  const data = (await res.json()) as Record<string, unknown> & {
    error?: string;
    reason?: string;
  };
  if (!res.ok) {
    throw new Error(
      (typeof data.reason === "string" && data.reason) || data.error || "Care Reality capture failed",
    );
  }
  return data;
};

/**
 * Voice Conversation loop: Listening → Processing → Responding → Listening.
 * Transcript is internal; UX shows state labels only.
 */
export class VoiceConversationController implements IVoiceController {
  state: VoiceConversationState = "idle";
  active = false;
  lastError: string | null = null;
  lastTurn: VoiceConversationTurn | null = null;
  turns: VoiceConversationTurn[] = [];
  /** Minimal processing hint — internal transcript, not hero UX. */
  lastHeard: string | null = null;

  private readonly speechInput: ISpeechInput;
  private readonly speechOutput: ISpeechOutput;
  private readonly analyze: VoiceConversationAnalyzeFn;
  private readonly options: VoiceConversationControllerOptions;
  private greeted = false;

  constructor(options: VoiceConversationControllerOptions = {}) {
    this.options = options;
    this.speechInput = options.speechInput ?? defaultBrowserSpeechInput;
    this.speechOutput = options.speechOutput ?? defaultBrowserSpeechOutput;
    this.analyze = options.analyze ?? DEFAULT_ANALYZE;
  }

  private setState(next: VoiceConversationState): void {
    this.state = next;
    this.options.onStateChange?.(next);
  }

  async activate(): Promise<void> {
    this.lastError = null;
    this.active = true;
    this.turns = [];
    this.lastTurn = null;
    this.greeted = false;

    if (!this.speechInput.isSupported()) {
      this.lastError =
        "Voice Conversation requires a browser with Web Speech support (Chrome, Edge, or Safari).";
      this.options.onError?.(this.lastError);
      this.active = false;
      this.setState("idle");
      return;
    }

    if (!this.speechOutput.isSupported()) {
      this.lastError = "Read-aloud is not supported in this browser.";
      this.options.onError?.(this.lastError);
      this.active = false;
      this.setState("idle");
      return;
    }

    if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
      } catch {
        this.lastError = "Microphone permission denied.";
        this.options.onError?.(this.lastError);
        this.active = false;
        this.setState("idle");
        return;
      }
    }

    if (!this.greeted) {
      this.greeted = true;
      this.setState("responding");
      this.speechOutput.speak(buildVoiceModeGreeting(this.options.languagePreference), this.options.languagePreference, {
        onEnd: () => {
          if (this.active) this.beginListening();
        },
        onError: () => {
          if (this.active) this.beginListening();
        },
      });
      return;
    }

    this.beginListening();
  }

  deactivate(): void {
    this.active = false;
    this.speechInput.stop();
    this.speechOutput.stop();
    this.lastHeard = null;
    this.setState("idle");
  }

  retry(): void {
    if (!this.active) return;
    this.lastError = null;
    this.beginListening();
  }

  private beginListening(): void {
    if (!this.active) return;
    this.setState("listening");

    const started = this.speechInput.start(this.options.languagePreference, {
      onFinal: (transcript) => {
        void this.handleFinalTranscript(transcript);
      },
      onError: (err) => {
        if (!this.active) return;
        this.lastError = err.message;
        this.options.onError?.(err.message);
        if (err.code === "no_speech") {
          this.retry();
          return;
        }
        this.setState("idle");
      },
    });

    if (!started) {
      this.active = false;
      this.setState("idle");
    }
  }

  private async handleFinalTranscript(transcript: string): Promise<void> {
    if (!this.active) return;
    const trimmed = transcript.trim();
    if (!trimmed) {
      this.retry();
      return;
    }

    this.lastHeard = trimmed;
    this.setState("processing");
    this.lastError = null;

    try {
      const priorInputRaw = this.turns.map((t) => t.userTranscript).join("\n\n") || undefined;
      const raw = await this.analyze({
        input: trimmed,
        languagePreference: this.options.languagePreference,
        telemetryUserId: this.options.telemetryUserId,
        careSessionId: this.options.careSessionId,
        priorInputRaw,
      });

      const spokenResponse = buildVoiceSpokenResponse(raw);
      const turn: VoiceConversationTurn = {
        userTranscript: trimmed,
        spokenResponse,
        rawAnalyze: raw,
      };
      this.turns = [...this.turns, turn];
      this.lastTurn = turn;
      this.options.onTurn?.(turn, this.turns.length);

      this.setState("responding");
      this.speechOutput.speak(spokenResponse, this.options.languagePreference, {
        onEnd: () => {
          if (this.active) this.beginListening();
        },
        onError: (msg) => {
          this.lastError = msg;
          this.options.onError?.(msg);
          if (this.active) this.beginListening();
        },
      });
    } catch (e) {
      this.lastError = e instanceof Error ? e.message : "Could not reach SolenOS.";
      this.options.onError?.(this.lastError);
      this.setState("idle");
    }
  }
}

export function createVoiceConversationController(
  options?: VoiceConversationControllerOptions,
): VoiceConversationController {
  return new VoiceConversationController(options);
}

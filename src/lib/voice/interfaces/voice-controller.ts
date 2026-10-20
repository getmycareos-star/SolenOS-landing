/** Voice Conversation Mode state machine — internal transcript, spoken response. */

export const VOICE_CONVERSATION_STATES = [
  "idle",
  "listening",
  "processing",
  "responding",
] as const;

export type VoiceConversationState = (typeof VOICE_CONVERSATION_STATES)[number];

export type VoiceConversationTurn = {
  /** Internal only — not primary UX. */
  userTranscript: string;
  spokenResponse: string;
  rawAnalyze?: Record<string, unknown>;
};

export interface IVoiceController {
  readonly state: VoiceConversationState;
  readonly active: boolean;
  readonly lastError: string | null;
  readonly lastTurn: VoiceConversationTurn | null;
  /** In-memory multi-turn history for the active session (internal transcript). */
  readonly turns: readonly VoiceConversationTurn[];
  activate(): Promise<void>;
  deactivate(): void;
  retry(): void;
}

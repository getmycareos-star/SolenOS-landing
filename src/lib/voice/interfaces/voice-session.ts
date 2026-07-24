/** In-memory voice conversation session (MVP — no durable persistence). */

export type VoiceSessionTurn = {
  /** Internal transcript — not primary UX. */
  transcript: string;
  spokenResponse: string;
  at: number;
};

export type VoiceSession = {
  sessionId: string;
  turns: VoiceSessionTurn[];
  startedAt: number;
};

export function createVoiceSession(sessionId?: string): VoiceSession {
  return {
    sessionId: sessionId ?? `voice_${Date.now()}`,
    turns: [],
    startedAt: Date.now(),
  };
}

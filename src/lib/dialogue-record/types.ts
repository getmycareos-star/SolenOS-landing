/**
 * Dialogue record — longitudinal conversation memory.
 *
 * The Living Care Record is event-based. This layer adds the missing piece:
 * what was actually *said*, by whom, when, and what understanding emerged.
 *
 * Without this, continuity breaks: a caregiver returns and cannot recall
 * what was discussed, what was decided, or what was left open.
 */

export const DIALOGUE_RECORD_VERSION = "1.0.0";

export type DialogueParticipant = {
  id: string;
  name: string | null;
  role: "caregiver" | "person" | "family" | "clinician" | "other";
  relationshipToPerson: string | null;
};

export type DialogueTurn = {
  id: string;
  dialogueId: string;
  participantId: string;
  speakerRole: "caregiver" | "person" | "family" | "clinician" | "other";
  content: string;
  timestamp: string;
  sentiment: "positive" | "neutral" | "negative" | "uncertain" | null;
  topics: string[];
  careRelevant: boolean;
  /** What SolenOS understood from this turn, if anything. */
  understoodAs: string | null;
  /** Open questions this turn raised. */
  openQuestions: string[];
  /** Decisions made in this turn. */
  decisions: string[];
};

export type DialogueSummary = {
  id: string;
  careRecipientId: string;
  createdAt: string;
  updatedAt: string;
  turnCount: number;
  participants: DialogueParticipant[];
  topics: string[];
  /** What was decided across this dialogue. */
  decisions: string[];
  /** What remains open. */
  openQuestions: string[];
  /** What SolenOS understood overall. */
  overallUnderstanding: string | null;
};

export type DialogueRecord = {
  version: string;
  id: string;
  careRecipientId: string;
  summary: DialogueSummary;
  turns: DialogueTurn[];
  createdAt: string;
  updatedAt: string;
};

export function createEmptyDialogue(params: {
  id: string;
  careRecipientId: string;
  createdAt?: string;
}): DialogueRecord {
  const now = params.createdAt ?? new Date().toISOString();
  return {
    version: DIALOGUE_RECORD_VERSION,
    id: params.id,
    careRecipientId: params.careRecipientId,
    summary: {
      id: params.id,
      careRecipientId: params.careRecipientId,
      createdAt: now,
      updatedAt: now,
      turnCount: 0,
      participants: [],
      topics: [],
      decisions: [],
      openQuestions: [],
      overallUnderstanding: null,
    },
    turns: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function addTurn(
  record: DialogueRecord,
  turn: Omit<DialogueTurn, "id" | "dialogueId">,
): DialogueRecord {
  const now = new Date().toISOString();
  const newTurn: DialogueTurn = {
    ...turn,
    id: `dt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    dialogueId: record.id,
  };
  return {
    ...record,
    turns: [...record.turns, newTurn],
    summary: {
      ...record.summary,
      turnCount: record.turns.length + 1,
      participants: mergeParticipants(record.summary.participants, turn.speakerRole, turn.participantId),
      topics: mergeTopics(record.summary.topics, turn.topics),
      decisions: mergeStrings(record.summary.decisions, turn.decisions),
      openQuestions: mergeStrings(record.summary.openQuestions, turn.openQuestions),
      updatedAt: now,
    },
    updatedAt: now,
  };
}

function mergeParticipants(
  existing: DialogueParticipant[],
  role: string,
  participantId: string,
): DialogueParticipant[] {
  if (existing.some((p) => p.id === participantId)) return existing;
  return [
    ...existing,
    { id: participantId, name: null, role: role as DialogueParticipant["role"], relationshipToPerson: null },
  ];
}

function mergeTopics(existing: string[], newTopics: string[]): string[] {
  const set = new Set(existing);
  for (const t of newTopics) {
    if (t.trim()) set.add(t.trim());
  }
  return [...set];
}

function mergeStrings(existing: string[], newStrings: string[]): string[] {
  const set = new Set(existing);
  for (const s of newStrings) {
    if (s.trim()) set.add(s.trim());
  }
  return [...set];
}

export function summarizeDialogue(record: DialogueRecord): {
  topicCount: number;
  decisionCount: number;
  openQuestionCount: number;
  participantCount: number;
  lastTurnAt: string | null;
  hasDecisions: boolean;
  hasOpenQuestions: boolean;
} {
  return {
    topicCount: record.summary.topics.length,
    decisionCount: record.summary.decisions.length,
    openQuestionCount: record.summary.openQuestions.length,
    participantCount: record.summary.participants.length,
    lastTurnAt: record.turns.length > 0 ? record.turns[record.turns.length - 1]!.timestamp : null,
    hasDecisions: record.summary.decisions.length > 0,
    hasOpenQuestions: record.summary.openQuestions.length > 0,
  };
}
import { addBelief } from "../solenos-layers/belief";
import {
  addMissingInformationItem,
  createMissingInformationItem,
  getUserMissingInformationQueueState,
  setUserMissingInformationQueueState,
} from "../missing-information-queue";

/**
 * Escalate Fail-Safe clarification questions into MIQ + BELIEF as HIGH missing_information.
 * Deterministic; never invents answers — only records knowledge gaps.
 */
export function escalateFailSafeMissingInformation(params: {
  userId: string;
  situationId: string;
  questions: readonly string[];
  nowMs?: number;
}): {
  escalatedQuestions: readonly string[];
  addedCount: number;
} {
  const userId = params.userId.trim();
  const situationId = params.situationId.trim();
  if (!userId || !situationId || params.questions.length === 0) {
    return { escalatedQuestions: [], addedCount: 0 };
  }

  const nowMs = params.nowMs ?? Date.now();
  let state = getUserMissingInformationQueueState(userId);
  const escalated: string[] = [];
  let addedCount = 0;

  for (const question of params.questions) {
    const item = createMissingInformationItem({
      situationId,
      question,
      importance: "HIGH",
      source: "reasoning",
      nowMs,
    });
    if (!item) continue;

    const before = state.items.length;
    state = addMissingInformationItem(state, item);
    if (state.items.length > before) {
      addedCount += 1;
    }

    addBelief(userId, {
      situationId,
      type: "missing_information",
      content: item.question,
      importance: "HIGH",
      confidence: 0.4,
      legacyMissingInfoId: item.id,
      nowMs,
    });
    escalated.push(item.question);
  }

  setUserMissingInformationQueueState(userId, state);
  return { escalatedQuestions: escalated, addedCount };
}

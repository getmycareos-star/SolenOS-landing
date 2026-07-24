import { randomUUID } from "node:crypto";
import type {
  MissingInformationImportance,
  MissingInformationItem,
  MissingInformationQueueState,
  MissingInformationResolutionEvent,
  MissingInformationSource,
} from "./types";
import { transitionMissingInformationStatus } from "./lifecycle";

/** Reject task/checklist language — knowledge gaps only. */
const FORBIDDEN_TASK_LANGUAGE =
  /^\s*(call|schedule|submit|follow\s*up|contact|remind|book|file|send|complete|do|check off|to[- ]?do)\b/i;

export function isKnowledgeGapQuestion(question: string): boolean {
  const q = question.trim();
  if (!q) return false;
  if (FORBIDDEN_TASK_LANGUAGE.test(q)) return false;
  // Prefer interrogative / unknown-state framing over imperatives.
  if (/^(please|make sure|remember to)\b/i.test(q)) return false;
  return true;
}

export function createMissingInformationItem(params: {
  situationId: string;
  question: string;
  importance: MissingInformationImportance;
  source: MissingInformationSource;
  nowMs?: number;
  id?: string;
}): MissingInformationItem | null {
  const situationId = params.situationId.trim();
  const question = params.question.trim();
  if (!situationId || !isKnowledgeGapQuestion(question)) return null;

  const nowIso = new Date(params.nowMs ?? Date.now()).toISOString();
  return {
    id: params.id ?? randomUUID(),
    situationId,
    question,
    importance: params.importance,
    source: params.source,
    status: "open",
    createdAt: nowIso,
  };
}

export function addMissingInformationItem(
  state: MissingInformationQueueState,
  item: MissingInformationItem,
): MissingInformationQueueState {
  if (!item.situationId.trim()) return state;
  if (!isKnowledgeGapQuestion(item.question)) return state;

  const duplicate = state.items.some(
    (existing) =>
      existing.status === "open" &&
      existing.situationId === item.situationId &&
      existing.question.toLowerCase() === item.question.toLowerCase(),
  );
  if (duplicate) return state;

  return {
    ...state,
    items: [...state.items, item],
  };
}

export function resolveMissingInformationItem(
  state: MissingInformationQueueState,
  itemId: string,
  reason: string,
  trigger: MissingInformationResolutionEvent["trigger"],
  nowMs?: number,
): { state: MissingInformationQueueState; event?: MissingInformationResolutionEvent } {
  const nowIso = new Date(nowMs ?? Date.now()).toISOString();
  let event: MissingInformationResolutionEvent | undefined;
  const items = state.items.map((item) => {
    if (item.id !== itemId || item.status !== "open") return item;
    event = { itemId, question: item.question, reason, trigger };
    return transitionMissingInformationStatus(item, "resolved", nowIso);
  });
  return { state: { ...state, items }, event };
}

export function getMissingInformationById(
  state: MissingInformationQueueState,
  itemId: string,
): MissingInformationItem | undefined {
  return state.items.find((i) => i.id === itemId);
}

export function getOpenItemsForSituation(
  state: MissingInformationQueueState,
  situationId: string,
): MissingInformationItem[] {
  return state.items.filter(
    (i) => i.situationId === situationId && i.status === "open",
  );
}

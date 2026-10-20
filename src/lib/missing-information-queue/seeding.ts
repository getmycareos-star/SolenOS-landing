import {
  addMissingInformationItem,
  createMissingInformationItem,
} from "./store";
import type { DetectedMissingInformationSignal } from "./generators";
import type { MissingInformationQueueState } from "./types";

/**
 * Seed queue from detector signals — each item MUST attach to a situationId.
 */
export function seedMissingInformationFromSignals(
  state: MissingInformationQueueState,
  signals: readonly DetectedMissingInformationSignal[],
  situationId: string,
  nowMs?: number,
): MissingInformationQueueState {
  if (!situationId.trim()) return state;

  let next = state;
  for (const signal of signals) {
    const item = createMissingInformationItem({
      situationId: signal.situationId ?? situationId,
      question: signal.question,
      importance: signal.importance,
      source: signal.source,
      nowMs,
    });
    if (!item) continue;
    next = addMissingInformationItem(next, item);
  }
  return next;
}

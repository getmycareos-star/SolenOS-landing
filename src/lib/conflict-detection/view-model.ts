import type { ConflictClarification, ConflictDetectionLayerPayload } from "./types";
import { CONFLICT_CLARIFICATION_HEADLINE } from "./contract-constants";

/**
 * UI clarification view — ONE question at a time.
 * Never surfaces aggregate conflict counts to caregivers.
 */
export type ConflictClarificationView = {
  headline: typeof CONFLICT_CLARIFICATION_HEADLINE;
  question: string;
  options?: readonly string[];
  severity: ConflictClarification["severity"];
  conflictId: string;
  type: ConflictClarification["type"];
  source: "conflict_detection_layer";
};

export function toConflictClarificationView(
  payload: ConflictDetectionLayerPayload | null | undefined,
): ConflictClarificationView | null {
  const clar = payload?.clarification;
  if (!clar) return null;
  return {
    headline: CONFLICT_CLARIFICATION_HEADLINE,
    question: clar.question,
    options: clar.options,
    severity: clar.severity,
    conflictId: clar.conflictId,
    type: clar.type,
    source: "conflict_detection_layer",
  };
}

import type { ContextWeight } from "../context-weighting/types";

/**
 * Audit/trust snapshot — NOT used for runtime decision-making.
 */
export type ReasoningSnapshot = {
  situationId: string;
  inputsUsed: string[];
  assumptionsUsed: string[];
  missingInfoSnapshot: string[];
  contextWeights: ContextWeight[];
  timestamp: string;
};

export type WriteReasoningSnapshotParams = {
  situationId: string;
  inputsUsed?: string[];
  assumptionsUsed?: string[];
  missingInfoSnapshot?: string[];
  contextWeights?: ContextWeight[];
  timestamp?: string;
};

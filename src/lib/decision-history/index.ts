export {
  DECISION_HISTORY_LAYER_IDENTITY,
  DECISION_HISTORY_LAYER_ONE_LINE_TRUTH,
  DECISION_HISTORY_LAYER_PIPELINE_POSITION,
  DECISION_HISTORY_LAYER_FORBIDDEN,
} from "./contract-constants";

export type {
  DecisionHistory,
  DecisionHistoryLog,
  WriteDecisionHistoryParams,
} from "./types";

export {
  createEmptyDecisionHistoryLog,
  writeDecisionHistory,
  decisionHistoryForSituation,
  getDecisionHistoryLog,
  setDecisionHistoryLog,
  appendDecisionHistoryForScope,
  resetDecisionHistoryStore,
} from "./store";

/** @deprecated FACADE — prefer solenos-layers/explanation writeExplanationDecision. */
export const DEPRECATED_FACADE_NOTICE =
  "DEPRECATED FACADE — use src/lib/solenos-layers/explanation instead. Decision History is EXPLANATION (WHY), hard-separated from Timeline.";

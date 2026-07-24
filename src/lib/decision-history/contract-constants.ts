/** Decision History — WHY explanations; never merge with Timeline (WHAT). */

export const DECISION_HISTORY_LAYER_IDENTITY =
  "an append-only WHY log for chosen actions — reasoning, assumptions used, and missing-info impact — never a factual event timeline";

export const DECISION_HISTORY_LAYER_ONE_LINE_TRUTH =
  "Decision History records WHY a decision was chosen; Timeline records WHAT happened — hard separation, never merge.";

export const DECISION_HISTORY_LAYER_PIPELINE_POSITION =
  "DECISION HISTORY WRITER — after Decision / Resolution; before Timeline Writer. Audit/explanation only.";

export const DECISION_HISTORY_LAYER_FORBIDDEN = [
  "merge with Timeline WHAT events",
  "store raw chat transcripts as decisions",
  "mutate prior decision history entries",
  "treat decision history as runtime ranking input",
] as const;

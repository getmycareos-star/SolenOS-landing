/** Reasoning Snapshot — audit/trust ONLY; never runtime decision-making. */

export const REASONING_SNAPSHOT_LAYER_IDENTITY =
  "an audit/trust snapshot of reasoning inputs — not a decision engine and not a Timeline or Decision History substitute";

export const REASONING_SNAPSHOT_LAYER_ONE_LINE_TRUTH =
  "Reasoning snapshots record inputs used for trust and audit — they never drive ranking or actions.";

export const REASONING_SNAPSHOT_LAYER_PIPELINE_POSITION =
  "REASONING SNAPSHOT — after Decision path for audit emit; parallel to Decision History / Timeline writers.";

export const REASONING_SNAPSHOT_LAYER_FORBIDDEN = [
  "use snapshots as Priority Engine inputs",
  "substitute for Decision History WHY",
  "substitute for Timeline WHAT",
  "mutate historical snapshots",
] as const;

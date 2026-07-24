/**
 * FAIL-SAFE MODE — CRITICAL SYSTEM SAFETY RULE.
 * When uncertainty is high, SolenOS must NOT complete the decision — pause and recover missing truth.
 * Derived gate over STATE + BELIEF + open conflicts + responsibility health — not a new truth store.
 */

export const FAIL_SAFE_MODE_IDENTITY =
  "a deterministic post-decision derived gate that pauses incomplete decisions under high uncertainty, high risk with low confidence, or unresolved conflict — never guesses missing facts";

export const FAIL_SAFE_MODE_ONE_LINE_TRUTH =
  "Incomplete data is normal; wrong assumptions can cause real harm — Fail-Safe stops the recommendation and escalates clarification instead of filling gaps.";

export const FAIL_SAFE_MODE_PIPELINE_POSITION =
  "FAIL-SAFE MODE — after Decision Engine assembly; before Human Trust; before Safety Enforcement";

export const FAIL_SAFE_MODE_FORBIDDEN = [
  "infer or guess missing medical / ownership facts",
  "fill gaps with probabilistic assumptions",
  "emit a full next-best-action recommendation while engaged",
  "set DecisionConfidence level to HIGH while engaged",
  "act as a new persistent truth store (STATE/BELIEF persistence beyond HIGH missing-info escalation)",
  "replace ambiguity-structure-validation (pre-reasoning) or Safety Enforcement",
] as const;

/** Clarification mode forces this action id — never a domain “do this next”. */
export const FAIL_SAFE_CLARIFY_ACTION_ID = "clarify_before_action";

export const FAIL_SAFE_CLARIFY_ACTION_LABEL =
  "Clarify missing information before acting";

export const DECISION_CONFIDENCE_LEVELS = ["LOW", "MEDIUM", "HIGH"] as const;

export const FAIL_SAFE_TRIGGER_KINDS = [
  "HIGH_UNCERTAINTY",
  "HIGH_RISK_LOW_CONFIDENCE",
  "UNRESOLVED_CONFLICT",
] as const;

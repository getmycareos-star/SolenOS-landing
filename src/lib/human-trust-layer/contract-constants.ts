/**
 * HUMAN TRUST LAYER — EXPLANATION (post-hoc trust).
 * No recommendation is valid unless a human can understand it, challenge it, and undo it.
 * MUST NOT influence STATE/BELIEF persistence or change decisions.
 */

export const HUMAN_TRUST_LAYER_IDENTITY =
  "a deterministic post-decision EXPLANATION layer that makes every recommendation understandable, challengeable, and reversible without changing the decision";

export const HUMAN_TRUST_LAYER_ONE_LINE_TRUTH =
  "Human Trust explains decisions from the decision graph — it never invents reasons, never drifts across users, and never writes STATE or BELIEF.";

export const HUMAN_TRUST_LAYER_PIPELINE_POSITION =
  "HUMAN TRUST LAYER — after Decision Engine assembly and Fail-Safe Mode; before Safety Enforcement; before trust/disclaimer output assembly";

export const HUMAN_TRUST_LAYER_FORBIDDEN = [
  "influence STATE or BELIEF persistence",
  "change or re-rank decisions",
  "hallucinate reasoning via free LLM generation",
  "replace domain trust/disclaimer footers",
  "act as Safety Enforcement",
] as const;

/** Optimizations in priority order. */
export const HUMAN_TRUST_OPTIMIZE_FOR = [
  "comprehension over sophistication",
  "transparency over efficiency",
  "reversibility over authority",
] as const;

export const REVERSIBILITY_ACTIONS = [
  "undo",
  "ignore",
  "choose_alternative",
] as const;

export const DEFAULT_UNDO_LABEL = "Undo this recommendation";
export const DEFAULT_IGNORE_LABEL = "Ignore for now";
export const DEFAULT_CHOOSE_ALTERNATIVE_LABEL = "Choose a different option";

/** Load/stress states that trigger emotional readability simplification. */
export const EMOTIONAL_READABILITY_LOAD_STATES = ["HIGH", "CRITICAL"] as const;

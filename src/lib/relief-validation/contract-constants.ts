/** Relief Validation Layer — output effectiveness validation only. */

export const RELIEF_VALIDATION_IDENTITY = "output effectiveness validation";

export const RELIEF_VALIDATION_ONE_LINE_TRUTH =
  "SolenOS does not measure people. SolenOS measures whether its structured cognitive decomposition reliably reduces uncertainty and cognitive burden on an interaction-by-interaction basis.";

export const RELIEF_VALIDATION_PURPOSE =
  "Did SolenOS reduce cognitive burden for this interaction? Nothing else.";

export const RELIEF_VALIDATION_MEASURES = [
  "cognitive decompression success",
  "clarity achievement",
  "prioritization effectiveness",
  "uncertainty reduction",
] as const;

export const RELIEF_VALIDATION_FORBIDDEN_MEASURES = [
  "engagement",
  "retention",
  "satisfaction",
  "behavior",
  "productivity",
  "caregiving performance",
  "user value",
] as const;

export const RELIEF_VALIDATION_FORBIDDEN_IDENTITY = [
  "analytics",
  "CRM",
  "behavioral tracking",
  "personalization",
  "user intelligence",
] as const;

export const RELIEF_VALIDATION_ARCHITECTURE_FLOW =
  "INPUT → Cognitive Decomposition → Structured Output → Relief Validation";

export const RELIEF_VALIDATION_FORBIDDEN_FLOW =
  "INPUT → User Modeling → Personalization → Adaptive Behavior";

export const RELIEF_OUTCOMES = ["high", "partial", "none", "failure"] as const;

export type ReliefOutcome = (typeof RELIEF_OUTCOMES)[number];

export const RELIEF_VALIDATION_RECORD_FIELDS = [
  "interaction_id",
  "input_category",
  "output_structured",
  "structure_valid",
  "semantic_valid",
  "latency_ms",
  "risk_level",
  "relief_outcome",
  "requery_detected",
  "helpful_feedback",
] as const;

export const RELIEF_VALIDATION_DRIFT_PREVENTION =
  "Relief validation MUST NEVER evolve into engagement optimization, retention optimization, user scoring, personalization, or behavioral prediction.";

export const RELIEF_VALIDATION_FINAL_TRUTH =
  "Persistence exists to validate whether structured cognitive decomposition consistently reduces uncertainty. Persistence does NOT exist to understand, profile, predict, or optimize users.";

export const RELIEF_CLASSIFICATION_RULES = {
  high: "no re-query, no clarification request, positive feedback OR clean completion",
  partial: "understanding appears improved, some clarification still required",
  none: "confusion remains or outcome unknown — success never assumed",
  failure: "repeated confusion, re-query loops, or explicit negative feedback",
} as const;

/** Priority Engine — thin facade over Situation Priority Contract for situations. */

export const PRIORITY_ENGINE_LAYER_IDENTITY =
  "a thin facade over the Situation Priority Contract — deterministic evaluator of risk, time, uncertainty, dependency, and completion (not a reasoning or LLM system)";

export const PRIORITY_ENGINE_LAYER_ONE_LINE_TRUTH =
  "Priority Engine computes scores only via PriorityContract.calculate — it never generates actions, interprets meaning beyond scoring, assumes intent, or mixes emotion/preference into situation ranking.";

export const PRIORITY_ENGINE_LAYER_PIPELINE_POSITION =
  "PRIORITY ENGINE (MATH FUSION) — after Time Engine; before Conflict Resolver, Action Generator, and Safety";

export const PRIORITY_ENGINE_LAYER_FORBIDDEN = [
  "generate natural language actions",
  "interpret meaning beyond scoring",
  "assume user intent",
  "resolve conflicts (flag only → Conflict Resolver)",
  "hallucinate scores or guess missing weights",
  "inflate urgency without signal support",
  "collapse multi-dependency into a single user",
  "ignore risk penalty",
  "eliminate high-risk actions entirely via score suppression",
  "let LLM decide priority",
  "mix emotional tone into situation Priority Contract scoring",
  "override Priority Contract with user preference",
  "hardcode importance rules in UI",
] as const;

/**
 * @deprecated Legacy action-vector fusion weights.
 * Situation ranking MUST use PriorityContract (Risk×Severity + Time + Uncertainty + Dependency − Completion).
 * Kept only for candidate action-vector adapter path.
 */
export const DEFAULT_PRIORITY_WEIGHTS = {
  Wt: 0.35,
  We: 0.2,
  Wm: 0.2,
  Wd: 0.2,
  Wr: 0.25,
} as const;


/** Usually 1–3 vectors pass to Action Generator. */
export const DEFAULT_TOP_N = 3;

/** Relative score gap below which candidates may flag as conflict. */
export const CONFLICT_SCORE_SIMILARITY_THRESHOLD = 0.08;

/** Minimum absolute score before conflict detection applies. */
export const CONFLICT_MIN_SCORE = 0.15;

/** Hard-constraint suppression floor — high risk suppresses but does not eliminate. */
export const RISK_SUPPRESSION_FLOOR = 0.05;

export const PRIORITY_DOMAINS = [
  "medical",
  "financial",
  "scheduling",
  "care_coordination",
  "emotional_support",
  "operational",
  "unknown",
] as const;

export const HARD_CONSTRAINT_KINDS = [
  "medical_safety",
  "financial_risk",
  "caregiver_dependency",
  "emergency_override",
  "high_missing_info",
] as const;

/** Confidence ceiling when HIGH open knowledge gaps exist. */
export const HIGH_MISSING_INFO_CONFIDENCE_CAP = 0.55;

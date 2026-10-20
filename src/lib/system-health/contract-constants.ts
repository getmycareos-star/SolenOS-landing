/** System Health Module — decision readiness only (not infrastructure metrics). */

export const SYSTEM_HEALTH_LAYER_IDENTITY =
  "a decision-readiness layer that measures whether SolenOS can currently be trusted to make good recommendations from context, memory, situations, contradictions, documents, and decision feedback — never CPU, API, or DB metrics";

export const SYSTEM_HEALTH_LAYER_ONE_LINE_TRUTH =
  "System Health measures recommendation trustworthiness — readiness, not confidence, and never infrastructure uptime.";

export const SYSTEM_HEALTH_LAYER_PIPELINE_POSITION =
  "SYSTEM HEALTH LAYER — after Care Context / Memory / Documents / Priority signals; before or at governance/safety enforcement when emitting recommendations";

export const SYSTEM_HEALTH_LAYER_FORBIDDEN = [
  "CPU, API uptime, DB latency, or infrastructure metrics",
  "analytics dashboards, charts, or KPI screens",
  "merge into Care Context or Care Profile as truth",
  "override medical urgency detection",
  "auto-write memory or resolve contradictions",
] as const;

/** Overall score dimension weights — must sum to 1. */
export const SYSTEM_HEALTH_WEIGHTS = {
  contextQuality: 0.25,
  memoryQuality: 0.2,
  situationCoverage: 0.2,
  contradictionHealth: 0.15,
  documentHealth: 0.1,
  decisionHealth: 0.1,
} as const;

/** Band thresholds on overallHealthScore (inclusive lower bounds). */
export const SYSTEM_HEALTH_BANDS = {
  Strong: { min: 90, max: 100 },
  Stable: { min: 75, max: 89 },
  Degraded: { min: 50, max: 74 },
  Unreliable: { min: 0, max: 49 },
} as const;

export const SYSTEM_HEALTH_BAND_LABELS = [
  "Strong",
  "Stable",
  "Degraded",
  "Unreliable",
] as const;

export const HEALTH_ALERT_SEVERITIES = ["LOW", "MEDIUM", "HIGH"] as const;

/** Document overall confidence below this counts as low-confidence extraction. */
export const SYSTEM_HEALTH_DOCUMENT_CONFIDENCE_THRESHOLD = 0.7;

/** Active situations at or above this trigger "Situation Load High". */
export const SITUATION_LOAD_HIGH_THRESHOLD = 4;

/** Rejection ratio (rejected / total feedback) at or above this flags model drift / context gaps. */
export const REJECTION_DRIFT_RATIO_THRESHOLD = 0.4;

/** Minimum total decision feedback samples before rejection-ratio alert fires. */
export const REJECTION_DRIFT_MIN_SAMPLES = 3;

/** Unread critical documents multiplier — heavily impacts document health. */
export const UNREAD_CRITICAL_DOCUMENT_PENALTY = 18;

export const CLARIFICATION_REQUEST_PREFIX = "[Clarify before recommending] ";

export const HEALTH_UNCERTAINTY_MARKER =
  "Uncertainty elevated: system health indicates degraded decision readiness.";

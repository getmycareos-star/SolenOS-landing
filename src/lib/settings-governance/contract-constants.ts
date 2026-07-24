/** Settings + System Governance Layer — post-reasoning runtime control plane only. */

export const GOVERNANCE_LAYER_IDENTITY =
  "a deterministic post-reasoning governance layer that constrains output behavior via module weighting, activation, routing, and safety constraints without influencing reasoning";

export const GOVERNANCE_LAYER_ONE_LINE_TRUTH =
  "Governance modifies how output is constrained and routed — it never modifies reasoning, hypothesis formation, or input interpretation.";

export const GOVERNANCE_LAYER_PIPELINE_POSITION =
  "SYSTEM SETTINGS / GOVERNANCE LAYER — after reasoning, decision, and action generation; before output assembly (order: governance → safety-enforcement → trust)";

export const GOVERNANCE_LAYER_FORBIDDEN = [
  "influence reasoning",
  "modify hypothesis formation",
  "interpret input",
  "change pre-reasoning module inputs",
  "bypass validation gates",
] as const;

export const ALLOWED_GOVERNANCE_CONSTRAINTS = [
  "risk_cap",
  "risk_floor",
  "emotional_simplification",
  "medical_advisory_restriction",
  "confirmation_required",
  "memory_module_weight",
  "notification_routing",
  "transparency_routing",
  "privacy_inference_block",
  "system_mode_envelope",
  "system_health_gate",
] as const;

export const SYSTEM_MODES = ["NORMAL", "CONSERVATIVE", "AUTONOMOUS", "CRISIS"] as const;

export const WORKLOAD_INTENSITIES = ["LOW", "MEDIUM", "HIGH"] as const;

export const DECISION_AUTHORITY_LEVELS = ["LOW", "MEDIUM", "HIGH"] as const;

export const MEMORY_VISIBILITY_LEVELS = ["hidden", "summary", "full"] as const;

export const EMOTIONAL_MODES = ["simplify", "normal", "full"] as const;

export const NOTIFICATION_URGENCY_FILTERS = ["RED", "RED_ORANGE", "ALL"] as const;

export const NOTIFICATION_DIGEST_MODES = ["instant", "hourly", "daily"] as const;

export const MEDICAL_MODES = ["advisory_only", "restricted"] as const;

export const EMERGENCY_SENSITIVITIES = ["low", "normal", "high"] as const;

export const SAFETY_RISK_TOLERANCE_LEVELS = ["LOW", "MEDIUM", "HIGH"] as const;

export const REASONING_VISIBILITY_LEVELS = ["none", "summary", "full"] as const;

export const CARE_GRAPH_ROLES = [
  "primary_caregiver",
  "secondary_caregiver",
  "shared_caregiver",
  "observer",
] as const;

export const TIME_SENSITIVITIES = ["morning", "night", "unpredictable"] as const;

export const DEFAULT_TIME_HORIZON_MODEL = {
  NOW: "0-2h",
  TODAY: "same calendar day",
  SOON: "1-3 days",
  LATER: "beyond 3 days",
} as const;

/** Safety Enforcement Layer — deterministic output constraint plane after governance, before trust assembly. */

export const SAFETY_ENFORCEMENT_LAYER_IDENTITY =
  "a deterministic post-governance output constraint layer that filters, constrains, and escalates allowed response content without influencing reasoning or input interpretation";

export const SAFETY_ENFORCEMENT_LAYER_ONE_LINE_TRUTH =
  "Safety modifies what output is allowed — it never modifies reasoning path, decision logic, or memory weighting.";

export const SAFETY_ENFORCEMENT_LAYER_PIPELINE_POSITION =
  "SAFETY ENFORCEMENT LAYER — after settings governance, decision assembly, fail-safe mode, and human trust explanation; before trust/disclaimer output assembly";

export const SAFETY_ENFORCEMENT_LAYER_FORBIDDEN = [
  "influence reasoning formation",
  "change user intent interpretation",
  "modify extracted facts",
  "modify pre-reasoning module inputs",
  "duplicate disclaimer domain text",
  "bypass validation gates",
] as const;

export const SAFETY_RISK_TOLERANCE_LEVELS = ["LOW", "MEDIUM", "HIGH"] as const;

export const SAFETY_MEDICAL_MODES = ["advisory_only", "restricted"] as const;

export const SAFETY_EMERGENCY_SENSITIVITIES = ["low", "normal", "high"] as const;

export const ALLOWED_SAFETY_CONSTRAINTS = [
  "medical_advisory_filter",
  "medical_restricted_scope",
  "emergency_override",
  "emergency_sensitivity",
  "external_escalation_gate",
  "uncertainty_injection",
  "certainty_softening",
  "risk_tolerance_shaping",
  "escalation_matrix",
  "conflict_resolution",
  "risk_cap",
  "risk_floor",
  "warning_constraint",
  "autonomy_reduction",
] as const;

export const ESCALATION_MATRIX_ACTIONS = [
  "allow",
  "warn",
  "restrict_escalate",
  "emergency_override",
] as const;

export const UNCERTAINTY_MARKER = "[Uncertainty: key details may be missing or ambiguous.]";

export const ADVISORY_MEDICAL_SUFFIX =
  " This is advisory guidance only — consult qualified healthcare professionals for clinical decisions.";

export const RESTRICTED_SCOPE_SUFFIX =
  " Scope is limited to escalation guidance — defer interpretation to qualified professionals.";

export const CONSERVATIVE_WARNING_PREFIX = "[Safety caution] ";

export const EXTERNAL_ESCALATION_PATTERNS = [
  /\b(?:call|dial|contact)\s+(?:911|999|112|emergency services?)\b/i,
  /\b(?:go to|seek|visit|head to)\s+(?:the\s+)?(?:ER|emergency room|A\s*&\s*E|urgent care)\b/i,
  /\b(?:call|contact)\s+(?:an?\s+)?(?:ambulance|paramedic|emergency medical)\b/i,
  /\bseek immediate (?:medical|emergency) (?:attention|care|help)\b/i,
  /\b(?:call|contact)\s+(?:your\s+)?(?:doctor|physician|healthcare provider|care team)\s+(?:immediately|right away|now|urgently)\b/i,
] as const;

export const CERTAINTY_ABSOLUTE_PATTERNS = [
  /\b(?:definitely|certainly|clearly|obviously|without doubt|undoubtedly|always|never)\b/gi,
  /\b(?:this is|that is|it is) (?:the|a) (?:only|best|correct|right)\b/gi,
  /\b(?:guaranteed|proven|confirmed)\b/gi,
] as const;

export const AUTONOMY_SUGGESTION_PATTERNS = [
  /\byou should (?:immediately|now|right away)\b/i,
  /\bdo this (?:now|immediately|first)\b/i,
  /\b(?:must|need to) act (?:now|immediately|today)\b/i,
] as const;

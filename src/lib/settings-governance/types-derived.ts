import {
  ALLOWED_GOVERNANCE_CONSTRAINTS,
  CARE_GRAPH_ROLES,
  DECISION_AUTHORITY_LEVELS,
  EMERGENCY_SENSITIVITIES,
  SAFETY_RISK_TOLERANCE_LEVELS,
  EMOTIONAL_MODES,
  MEDICAL_MODES,
  MEMORY_VISIBILITY_LEVELS,
  NOTIFICATION_DIGEST_MODES,
  NOTIFICATION_URGENCY_FILTERS,
  REASONING_VISIBILITY_LEVELS,
  SYSTEM_MODES,
  TIME_SENSITIVITIES,
  WORKLOAD_INTENSITIES,
} from "./contract-constants";

export type SystemMode = (typeof SYSTEM_MODES)[number];
export type WorkloadIntensity = (typeof WORKLOAD_INTENSITIES)[number];
export type DecisionAuthorityLevel = (typeof DECISION_AUTHORITY_LEVELS)[number];
export type MemoryVisibility = (typeof MEMORY_VISIBILITY_LEVELS)[number];
export type EmotionalMode = (typeof EMOTIONAL_MODES)[number];
export type NotificationUrgencyFilter = (typeof NOTIFICATION_URGENCY_FILTERS)[number];
export type NotificationDigestMode = (typeof NOTIFICATION_DIGEST_MODES)[number];
export type MedicalMode = (typeof MEDICAL_MODES)[number];
export type EmergencySensitivity = (typeof EMERGENCY_SENSITIVITIES)[number];
export type SafetyRiskToleranceLevel = (typeof SAFETY_RISK_TOLERANCE_LEVELS)[number];
export type ReasoningVisibility = (typeof REASONING_VISIBILITY_LEVELS)[number];
export type CareGraphRole = (typeof CARE_GRAPH_ROLES)[number];
export type TimeSensitivity = (typeof TIME_SENSITIVITIES)[number];
export type GovernanceConstraintKind = (typeof ALLOWED_GOVERNANCE_CONSTRAINTS)[number];

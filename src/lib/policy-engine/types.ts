import type { POLICY_COMPONENTS, POLICY_RULES } from "./contract-constants";

export type PolicyRule = (typeof POLICY_RULES)[number];
export type PolicyComponent = (typeof POLICY_COMPONENTS)[number];

export type ConsentProfile = {
  user_id: string;
  accepted_terms_version: string;
  medical_disclaimer_acknowledged: boolean;
  privacy_model_acknowledged: boolean;
  multi_caregiver_acknowledged: boolean;
  data_improvement_consent: boolean;
  no_advertising_acknowledged: boolean;
  timestamp: string;
  /** Limited mode when terms revoked */
  limited_mode: boolean;
};

export type ConsentAcceptanceInput = {
  user_id: string;
  accepted_terms_version: string;
  medical_disclaimer_acknowledged: boolean;
  privacy_model_acknowledged: boolean;
  multi_caregiver_acknowledged: boolean;
  data_improvement_consent: boolean;
  no_advertising_acknowledged: boolean;
};

export type IngestionPolicyResult = {
  /** Capture always succeeds — raw CareEvent persistence is never blocked. */
  allowed: boolean;
  consent_verified: boolean;
  /** Soft-prompt consent after capture; does not block CareEvent creation. */
  consent_required: boolean;
  /** Interpretation/sharing limited until consent — raw capture still succeeds. */
  interpretation_gated: boolean;
  sharing_gated: boolean;
  medical_advice_request: boolean;
  sensitive_data_flagged: boolean;
  cross_caregiver_restricted: boolean;
  violations: string[];
  /** Soft prompt copy when consent_required — never a hard block reason for capture. */
  soft_consent_prompt: string | null;
  /** @deprecated Capture is never blocked; kept null for compatibility. */
  blocked_reason: string | null;
};

export type OutputPolicyResult = {
  passed: boolean;
  violations: string[];
  sanitized_fields: string[];
  attribution_leaks_blocked: number;
  medical_boundary_violations: number;
  certainty_softened: number;
};

export type ClarificationPolicyResult = {
  passed: boolean;
  filtered_questions: import("../clarification-engine/types").ClarificationQuestion[];
  removed_count: number;
  violations: string[];
};

export type DiffPolicyResult = {
  passed: boolean;
  sanitized_diff: import("../care-context-diff-engine/types").CareContextDiff | null;
  violations: string[];
};

export type DataUsePolicyResult = {
  improvement_allowed: boolean;
  strict_privacy_mode: boolean;
  aggregation_allowed: boolean;
  reason: string;
};

export type PolicyAuditEntry = {
  audit_id: string;
  user_id: string;
  action: "ingestion" | "output" | "consent" | "clarification" | "diff" | "data_use";
  passed: boolean;
  violations: string[];
  timestamp: string;
};

export type PolicyEngineResult = {
  active: boolean;
  consent_profile: ConsentProfile | null;
  consent_verified: boolean;
  consent_required: boolean;
  limited_mode: boolean;
  ingestion: IngestionPolicyResult | null;
  output: OutputPolicyResult | null;
  data_use: DataUsePolicyResult;
  audit_entries: PolicyAuditEntry[];
  rules_upheld: readonly PolicyRule[];
  components_active: readonly PolicyComponent[];
  defining_principle: string;
};

export type ValidateIngestionPolicyInput = {
  user_id: string;
  raw_input: string;
  has_documents: boolean;
  is_high_risk_action?: boolean;
};

export type ValidateOutputPolicyInput = {
  user_id: string;
  surfaces: Record<string, string | string[]>;
};

export type ProcessPolicyEngineInput = {
  user_id: string;
  phase: "ingestion" | "output" | "full";
  raw_input?: string;
  has_documents?: boolean;
  output_surfaces?: Record<string, string | string[]>;
};

export type UpdateDataImprovementConsentInput = {
  user_id: string;
  data_improvement_consent: boolean;
};

export type RevokeConsentInput = {
  user_id: string;
};

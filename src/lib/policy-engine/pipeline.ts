import {
  POLICY_CAPTURE_ALWAYS_PRINCIPLE,
  POLICY_COMPONENTS,
  POLICY_ENGINE_DEFINING_PRINCIPLE,
  POLICY_RULES,
  POLICY_SOFT_CONSENT_AFTER_CAPTURE,
} from "./contract-constants";
import { applyAIOutputConstraints } from "./ai-output-constraints";
import { logPolicyAudit, resetPolicyAuditLog } from "./audit-compliance-logger";
import { getConsentProfile, hasValidConsent, resetConsentStore } from "./consent-store";
import { evaluateDataUseRules } from "./data-use-rules";
import { detectMedicalAdviceRequest } from "./medical-boundary-rules";
import { filterClarificationForMedicalBoundary } from "./medical-boundary-rules";
import type {
  ClarificationPolicyResult,
  DiffPolicyResult,
  IngestionPolicyResult,
  OutputPolicyResult,
  PolicyEngineResult,
  ValidateIngestionPolicyInput,
  ValidateOutputPolicyInput,
} from "./types";
import type { CareContextDiff } from "../care-context-diff-engine/types";
import type { ClarificationEngineResult } from "../clarification-engine/types";
import type { FinalOutputContract } from "../final-output-contract/types";

export function validateIngestionPolicy(
  input: ValidateIngestionPolicyInput,
): IngestionPolicyResult {
  const consentVerified = hasValidConsent(input.user_id);
  const violations: string[] = [];
  const medicalAdviceRequest = detectMedicalAdviceRequest(input.raw_input);

  // Flag only — never refuse intake for worry / med-change / clinical-question language.
  if (medicalAdviceRequest) {
    violations.push("medical_advice_request_flagged_for_output_constraints");
  }

  if (!consentVerified) {
    violations.push("consent_soft_prompt_after_capture");
  }

  // Capture always succeeds. Consent gates interpretation/sharing — not CareEvent persistence.
  const allowed = true;
  void POLICY_CAPTURE_ALWAYS_PRINCIPLE;

  const result: IngestionPolicyResult = {
    allowed,
    consent_verified: consentVerified,
    consent_required: !consentVerified,
    interpretation_gated: !consentVerified,
    sharing_gated: !consentVerified,
    medical_advice_request: medicalAdviceRequest,
    sensitive_data_flagged: false,
    cross_caregiver_restricted: !consentVerified || input.is_high_risk_action === true,
    violations,
    soft_consent_prompt: consentVerified ? null : POLICY_SOFT_CONSENT_AFTER_CAPTURE,
    blocked_reason: null,
  };

  logPolicyAudit({
    user_id: input.user_id,
    action: "ingestion",
    passed: allowed,
    violations,
  });

  return result;
}

export function validateOutputPolicy(input: ValidateOutputPolicyInput): OutputPolicyResult {
  const constrained = applyAIOutputConstraints(input.surfaces);

  const result: OutputPolicyResult = {
    passed: constrained.violations.length === 0,
    violations: constrained.violations,
    sanitized_fields: constrained.sanitized_fields,
    attribution_leaks_blocked: constrained.attribution_leaks_blocked,
    medical_boundary_violations: constrained.medical_boundary_violations,
    certainty_softened: constrained.certainty_softened,
  };

  logPolicyAudit({
    user_id: input.user_id,
    action: "output",
    passed: result.passed || result.sanitized_fields.length > 0,
    violations: result.violations,
  });

  return result;
}

export function applyPolicyToClarification(
  userId: string,
  clarification: ClarificationEngineResult,
): ClarificationPolicyResult & { layer: ClarificationEngineResult } {
  const { filtered, removed, violations } = filterClarificationForMedicalBoundary(
    clarification.questions,
  );

  logPolicyAudit({
    user_id: userId,
    action: "clarification",
    passed: violations.length === 0,
    violations,
  });

  return {
    passed: violations.length === 0,
    filtered_questions: filtered,
    removed_count: removed,
    violations,
    layer: {
      ...clarification,
      questions: filtered,
      budget_used: filtered.length,
    },
  };
}

export function applyPolicyToDiff(userId: string, diff: CareContextDiff): DiffPolicyResult {
  const sectionSurfaces: Record<string, string[]> = {};
  for (const [key, lines] of Object.entries(diff.sections)) {
    sectionSurfaces[key] = lines;
  }
  sectionSurfaces.primary_change = [diff.primary_change];

  const outputPolicy = validateOutputPolicy({ user_id: userId, surfaces: sectionSurfaces });
  const constrained = applyAIOutputConstraints(sectionSurfaces);

  const sanitizedSections = { ...diff.sections };
  for (const [key, value] of Object.entries(constrained.sanitized)) {
    if (key === "primary_change") continue;
    sanitizedSections[key as keyof typeof sanitizedSections] = Array.isArray(value)
      ? value
      : [value];
  }

  const primaryChange = constrained.sanitized.primary_change;
  const sanitized_diff: CareContextDiff = {
    ...diff,
    sections: sanitizedSections,
    primary_change: Array.isArray(primaryChange) ? primaryChange[0] ?? diff.primary_change : primaryChange,
  };

  logPolicyAudit({
    user_id: userId,
    action: "diff",
    passed: outputPolicy.passed || outputPolicy.sanitized_fields.length > 0,
    violations: outputPolicy.violations,
  });

  return {
    passed: outputPolicy.violations.length === 0,
    sanitized_diff,
    violations: outputPolicy.violations,
  };
}

export function applyPolicyToFinalOutput(
  userId: string,
  output: FinalOutputContract,
  options?: {
    medical_advice_request?: boolean;
    consent_required?: boolean;
    soft_consent_prompt?: string | null;
  },
): FinalOutputContract {
  const surfaces: Record<string, string | string[]> = {
    what_is_happening: output.what_is_happening,
    what_matters_now: output.what_matters_now,
    what_to_ask_next: output.what_to_ask_next,
    what_can_wait: output.what_can_wait,
    follow_up_items: output.follow_up_items,
    unknowns: output.decision_trace.unknowns,
  };

  const constrained = applyAIOutputConstraints(surfaces);
  const get = (key: string): string => {
    const v = constrained.sanitized[key];
    return Array.isArray(v) ? v.join(" ") : (v ?? "");
  };
  const getArr = (key: string): string[] => {
    const v = constrained.sanitized[key];
    return Array.isArray(v) ? v : v ? [v] : [];
  };

  let what_to_ask_next = get("what_to_ask_next");
  let what_matters_now = get("what_matters_now");
  let what_can_wait = get("what_can_wait");
  let follow_up_items = getArr("follow_up_items");
  let unknowns =
    getArr("unknowns").length > 0
      ? [...getArr("unknowns")]
      : output.decision_trace.unknowns.length > 0
        ? [...output.decision_trace.unknowns]
        : ["Uncertainty level not fully established — additional input may be needed."];

  // Input sought clinical advice — preserve the record, do not answer as a clinician.
  if (options?.medical_advice_request) {
    const clinicalAnswer =
      detectMedicalAdviceRequest(what_to_ask_next) ||
      detectMedicalAdviceRequest(what_matters_now) ||
      /\b(you should (?:give|prescribe|stop|change)|(?:give|prescribe) (?:her|him|them) )\b/i.test(
        `${what_to_ask_next} ${what_matters_now}`,
      );

    if (clinicalAnswer) {
      what_to_ask_next =
        "Keep noting what you observe. Questions about seriousness or medication changes belong with a clinician or pharmacist.";
      what_matters_now =
        "What you shared is preserved in the care record. SolenOS does not judge medical seriousness or change medications.";
    }

    if (!unknowns.some((u) => /clinician|medical advice|clinical/i.test(u))) {
      unknowns = [
        ...unknowns,
        "Clinical advice is outside SolenOS — observations and worry are still preserved in the record.",
      ];
    }
  }

  // Soft-prompt consent after capture — never block the CareEvent that already landed.
  if (options?.consent_required) {
    const soft =
      options.soft_consent_prompt?.trim() || POLICY_SOFT_CONSENT_AFTER_CAPTURE;
    what_can_wait = soft;
    if (!follow_up_items.some((item) => /privacy terms|consent/i.test(item))) {
      follow_up_items = [...follow_up_items, "Accept privacy terms when ready"];
    }
    if (!unknowns.some((u) => /privacy terms|consent/i.test(u))) {
      unknowns = [...unknowns, "Privacy terms not yet accepted — sharing and full interpretation stay limited."];
    }
  }

  void userId;

  return {
    ...output,
    what_is_happening: get("what_is_happening"),
    what_matters_now,
    what_to_ask_next,
    what_can_wait,
    follow_up_items,
    decision_trace: {
      ...output.decision_trace,
      unknowns,
    },
  };
}

export function buildPolicyEngineLayer(userId: string): PolicyEngineResult {
  const profile = getConsentProfile(userId);
  const consentVerified = hasValidConsent(userId);
  const dataUse = evaluateDataUseRules(userId);

  return {
    active: true,
    consent_profile: profile,
    consent_verified: consentVerified,
    consent_required: !consentVerified,
    limited_mode: profile?.limited_mode ?? false,
    ingestion: null,
    output: null,
    data_use: dataUse,
    audit_entries: [],
    rules_upheld: [...POLICY_RULES],
    components_active: [...POLICY_COMPONENTS],
    defining_principle: POLICY_ENGINE_DEFINING_PRINCIPLE,
  };
}

export function resetPolicyEngineStore(): void {
  resetConsentStore();
  resetPolicyAuditLog();
}

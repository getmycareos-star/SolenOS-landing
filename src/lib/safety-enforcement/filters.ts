import { canonicalizeRiskLevel } from "../final-output-contract";
import type { SolenOSResponse } from "../response-validator";
import { RISK_RANK, type SolenOSRiskLevel } from "../implementation-enforcement/risk-levels";
import {
  CLINICAL_AUTHORITY_PATTERNS,
  DIAGNOSIS_PATTERNS,
  DIAGNOSTIC_CERTAINTY_PATTERNS,
  MEDICATION_INSTRUCTION_PATTERNS,
  SAFE_CONSULTATION_PHRASE,
  SAFE_UNCERTAINTY_PHRASE,
  TREATMENT_PATTERNS,
} from "../medical-responsibility-boundary/constants";
import {
  ADVISORY_MEDICAL_SUFFIX,
  AUTONOMY_SUGGESTION_PATTERNS,
  CERTAINTY_ABSOLUTE_PATTERNS,
  CONSERVATIVE_WARNING_PREFIX,
  EXTERNAL_ESCALATION_PATTERNS,
  RESTRICTED_SCOPE_SUFFIX,
  UNCERTAINTY_MARKER,
} from "./contract-constants";
import type {
  AppliedSafetyConstraint,
  EscalationMatrixAction,
  SafetyMedicalMode,
  SolenOSSafetyControl,
} from "./types";

function rewriteField(text: string, rewriter: (value: string) => string): string {
  return rewriter(text);
}

function rewriteAllFields(
  response: SolenOSResponse,
  rewriter: (value: string) => string,
): SolenOSResponse {
  return {
    ...response,
    what_is_happening: rewriteField(response.what_is_happening, rewriter),
    what_matters_now: rewriteField(response.what_matters_now, rewriter),
    what_to_ask_next: rewriteField(response.what_to_ask_next, rewriter),
    what_can_wait: rewriteField(response.what_can_wait, rewriter),
  };
}

function rewriteMedicalPatterns(text: string): string {
  let next = text;
  for (const pattern of DIAGNOSIS_PATTERNS) {
    next = next.replace(pattern, SAFE_UNCERTAINTY_PHRASE);
  }
  for (const pattern of DIAGNOSTIC_CERTAINTY_PATTERNS) {
    next = next.replace(pattern, SAFE_UNCERTAINTY_PHRASE);
  }
  for (const pattern of TREATMENT_PATTERNS) {
    next = next.replace(pattern, SAFE_CONSULTATION_PHRASE);
  }
  for (const pattern of MEDICATION_INSTRUCTION_PATTERNS) {
    next = next.replace(pattern, SAFE_CONSULTATION_PHRASE);
  }
  for (const pattern of CLINICAL_AUTHORITY_PATTERNS) {
    next = next.replace(
      pattern,
      "Follow existing clinical guidance and ask the care team about any conflicts.",
    );
  }
  return next.replace(/\s{2,}/g, " ").trim();
}

function stripExternalEscalation(text: string): string {
  let next = text;
  for (const pattern of EXTERNAL_ESCALATION_PATTERNS) {
    next = next.replace(pattern, "Follow your existing care plan and discuss urgency with your care team.");
  }
  return next.replace(/\s{2,}/g, " ").trim();
}

function softenCertainty(text: string): string {
  let next = text;
  for (const pattern of CERTAINTY_ABSOLUTE_PATTERNS) {
    next = next.replace(pattern, (match) => {
      const lower = match.toLowerCase();
      if (lower.includes("never")) return "may not";
      if (lower.includes("always")) return "may";
      return "may";
    });
  }
  return next.replace(/\s{2,}/g, " ").trim();
}

function injectUncertainty(text: string): string {
  if (text.includes(UNCERTAINTY_MARKER) || text.includes("may be missing")) {
    return text;
  }
  return `${text} ${UNCERTAINTY_MARKER}`;
}

function reduceAutonomySuggestions(text: string): string {
  let next = text;
  for (const pattern of AUTONOMY_SUGGESTION_PATTERNS) {
    next = next.replace(pattern, "Consider whether");
  }
  return next;
}

function truncateInterpretation(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const truncated = text.slice(0, maxLen).trimEnd();
  const lastSpace = truncated.lastIndexOf(" ");
  const cut = lastSpace > maxLen * 0.6 ? truncated.slice(0, lastSpace) : truncated;
  return cut + "…";
}

function appendSuffixIfMissing(text: string, suffix: string): string {
  if (text.includes(suffix.trim())) return text;
  return text + suffix;
}

function capRiskLevel(
  response: SolenOSResponse,
  maxLevel: SolenOSRiskLevel,
  applied: AppliedSafetyConstraint[],
  kind: "risk_cap" | "risk_floor",
): SolenOSResponse {
  if (RISK_RANK[response.risk_level] > RISK_RANK[maxLevel]) {
    applied.push({ kind, detail: `capped ${response.risk_level} → ${maxLevel}` });
    return { ...response, risk_level: canonicalizeRiskLevel(maxLevel) };
  }
  return response;
}

function floorRiskLevel(
  response: SolenOSResponse,
  minLevel: SolenOSRiskLevel,
  applied: AppliedSafetyConstraint[],
): SolenOSResponse {
  if (RISK_RANK[response.risk_level] < RISK_RANK[minLevel]) {
    applied.push({ kind: "risk_floor", detail: `raised ${response.risk_level} → ${minLevel}` });
    return { ...response, risk_level: canonicalizeRiskLevel(minLevel) };
  }
  return response;
}

export function applyMedicalModeFilter(
  response: SolenOSResponse,
  medicalMode: SafetyMedicalMode,
  emergencyOverride: boolean,
  applied: AppliedSafetyConstraint[],
): SolenOSResponse {
  const effectiveMode = emergencyOverride ? "restricted" : medicalMode;
  let result = rewriteAllFields(response, rewriteMedicalPatterns);

  if (effectiveMode === "advisory_only") {
    applied.push({ kind: "medical_advisory_filter", detail: "medicalMode=advisory_only" });
    result = {
      ...result,
      what_to_ask_next: appendSuffixIfMissing(result.what_to_ask_next, ADVISORY_MEDICAL_SUFFIX),
    };
  }

  if (effectiveMode === "restricted") {
    applied.push({ kind: "medical_restricted_scope", detail: "medicalMode=restricted" });
    result = rewriteAllFields(result, (text) => truncateInterpretation(text, 220));
    result = {
      ...result,
      what_matters_now: truncateInterpretation(result.what_matters_now, 160),
      what_to_ask_next: appendSuffixIfMissing(result.what_to_ask_next, RESTRICTED_SCOPE_SUFFIX),
    };
    result = capRiskLevel(result, "medium", applied, "risk_cap");
  }

  if (emergencyOverride) {
    applied.push({
      kind: "emergency_override",
      detail: "emergency signals override medical mode to restricted escalation guidance",
    });
  }

  return result;
}

export function applyExternalEscalationGate(
  response: SolenOSResponse,
  enabled: boolean,
  applied: AppliedSafetyConstraint[],
): SolenOSResponse {
  if (enabled) {
    applied.push({ kind: "external_escalation_gate", detail: "externalEscalationEnabled=true" });
    return response;
  }

  applied.push({
    kind: "external_escalation_gate",
    detail: "externalEscalationEnabled=false — external routes stripped",
  });
  return rewriteAllFields(response, stripExternalEscalation);
}

export function applyUncertaintyControls(
  response: SolenOSResponse,
  control: Pick<SolenOSSafetyControl, "alwaysShowUncertainty" | "noCertaintyMode">,
  applied: AppliedSafetyConstraint[],
): SolenOSResponse {
  let result = { ...response };

  if (control.noCertaintyMode) {
    applied.push({ kind: "certainty_softening", detail: "noCertaintyMode=true" });
    result = rewriteAllFields(result, softenCertainty);
  }

  if (control.alwaysShowUncertainty) {
    applied.push({ kind: "uncertainty_injection", detail: "alwaysShowUncertainty=true" });
    result = {
      ...result,
      what_is_happening: injectUncertainty(result.what_is_happening),
    };
  }

  return result;
}

export function applyRiskToleranceShaping(
  response: SolenOSResponse,
  riskTolerance: SolenOSSafetyControl["riskTolerance"],
  applied: AppliedSafetyConstraint[],
): SolenOSResponse {
  if (riskTolerance === "LOW") {
    applied.push({ kind: "risk_tolerance_shaping", detail: "riskTolerance=LOW — conservative" });
    let result = { ...response };
    if (!result.what_matters_now.startsWith(CONSERVATIVE_WARNING_PREFIX)) {
      result = {
        ...result,
        what_matters_now: CONSERVATIVE_WARNING_PREFIX + result.what_matters_now,
      };
    }
    result = {
      ...result,
      what_matters_now: reduceAutonomySuggestions(result.what_matters_now),
      what_to_ask_next: reduceAutonomySuggestions(result.what_to_ask_next),
    };
    applied.push({ kind: "autonomy_reduction", detail: "LOW risk tolerance reduces autonomy suggestions" });
    return result;
  }

  if (riskTolerance === "HIGH") {
    applied.push({ kind: "risk_tolerance_shaping", detail: "riskTolerance=HIGH — permissive" });
    return response;
  }

  applied.push({ kind: "risk_tolerance_shaping", detail: "riskTolerance=MEDIUM — balanced" });
  return response;
}

export function applyEscalationMatrixAction(
  response: SolenOSResponse,
  action: EscalationMatrixAction,
  effectiveRisk: SolenOSRiskLevel,
  applied: AppliedSafetyConstraint[],
): SolenOSResponse {
  applied.push({
    kind: "escalation_matrix",
    detail: `effectiveRisk=${effectiveRisk} action=${action}`,
  });

  switch (action) {
    case "allow":
      return response;
    case "warn":
      applied.push({ kind: "warning_constraint", detail: "MEDIUM risk — warning constraints applied" });
      return {
        ...response,
        what_matters_now: response.what_matters_now.includes("[Caution]")
          ? response.what_matters_now
          : `[Caution] ${response.what_matters_now}`,
      };
    case "restrict_escalate":
      applied.push({
        kind: "warning_constraint",
        detail: "HIGH risk — restrict non-critical suggestions",
      });
      return {
        ...capRiskLevel(response, "high", applied, "risk_cap"),
        what_can_wait: truncateInterpretation(response.what_can_wait, 120),
      };
    case "emergency_override":
      applied.push({
        kind: "emergency_override",
        detail: "CRITICAL risk — emergency override mode active",
      });
      return floorRiskLevel(
        {
          ...response,
          what_can_wait: "Non-emergency items are deferred until immediate safety is addressed.",
        },
        "high",
        applied,
      );
    default:
      return response;
  }
}

export function applyEmergencySensitivity(
  response: SolenOSResponse,
  sensitivity: SolenOSSafetyControl["emergencySensitivity"],
  emergencySignals: boolean,
  applied: AppliedSafetyConstraint[],
): SolenOSResponse {
  applied.push({
    kind: "emergency_sensitivity",
    detail: `emergencySensitivity=${sensitivity} signals=${emergencySignals}`,
  });

  if (sensitivity === "high" && emergencySignals) {
    return {
      ...response,
      what_matters_now: truncateInterpretation(response.what_matters_now, 200),
      what_can_wait: truncateInterpretation(response.what_can_wait, 80),
    };
  }

  if (sensitivity === "low" && !emergencySignals) {
    return capRiskLevel(response, "medium", applied, "risk_cap");
  }

  return response;
}

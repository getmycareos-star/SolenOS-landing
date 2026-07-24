/**
 * FAIL-SAFE MODE — CRITICAL SYSTEM SAFETY RULE.
 * Pipeline: Decision Engine → FAIL-SAFE → Human Trust → Safety → Output.
 * Canonical pure eval companion: solenos-layers/derived/fail-safe.ts
 */

export {
  FAIL_SAFE_MODE_IDENTITY,
  FAIL_SAFE_MODE_ONE_LINE_TRUTH,
  FAIL_SAFE_MODE_PIPELINE_POSITION,
  FAIL_SAFE_MODE_FORBIDDEN,
  FAIL_SAFE_CLARIFY_ACTION_ID,
  FAIL_SAFE_CLARIFY_ACTION_LABEL,
  DECISION_CONFIDENCE_LEVELS,
  FAIL_SAFE_TRIGGER_KINDS,
} from "./contract-constants";

export type {
  DecisionConfidence,
  FailSafeTriggerKind,
  FailSafeTriggerHit,
  ClarificationModeOutput,
  FailSafeGuaranteeResult,
  FailSafeModeInput,
  FailSafeModeResult,
  FailSafeModeLayerPayload,
} from "./types";

export { evaluateFailSafeTriggers } from "./evaluate-triggers";

export {
  buildDecisionConfidence,
  buildEscalationQuestions,
  buildClarificationModeOutput,
  failSafeClarifyAction,
} from "./build-clarification";

export {
  runFailSafeGuarantee,
  validateFailSafeModeResult,
} from "./guarantee";

export { escalateFailSafeMissingInformation } from "./escalate-missing-info";

export {
  processFailSafeMode,
  toFailSafeModeLayerPayload,
  applyFailSafeClarificationToResponse,
  type ProcessFailSafeModeOptions,
} from "./process";

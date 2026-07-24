/**
 * DERIVED Fail-Safe evaluation — pure trigger scoring over decision-graph signals.
 * Facade orchestration (escalation + response rewrite): src/lib/fail-safe-mode
 */

export {
  evaluateFailSafeTriggers,
  buildDecisionConfidence,
  buildEscalationQuestions,
  buildClarificationModeOutput,
  failSafeClarifyAction,
  runFailSafeGuarantee,
  type DecisionConfidence,
  type FailSafeModeInput,
  type FailSafeTriggerHit,
  type FailSafeTriggerKind,
  type ClarificationModeOutput,
  FAIL_SAFE_MODE_PIPELINE_POSITION,
  FAIL_SAFE_CLARIFY_ACTION_ID,
} from "../../fail-safe-mode";

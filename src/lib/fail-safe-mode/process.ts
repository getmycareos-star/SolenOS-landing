import type { SolenOSResponse } from "../response-validator";
import {
  buildClarificationModeOutput,
  buildDecisionConfidence,
  buildEscalationQuestions,
  failSafeClarifyAction,
} from "./build-clarification";
import { evaluateFailSafeTriggers } from "./evaluate-triggers";
import { escalateFailSafeMissingInformation } from "./escalate-missing-info";
import { runFailSafeGuarantee } from "./guarantee";
import type {
  FailSafeModeInput,
  FailSafeModeLayerPayload,
  FailSafeModeResult,
} from "./types";

export type ProcessFailSafeModeOptions = {
  /** When true (default), write HIGH missing-info escalations into MIQ + BELIEF. */
  escalateMissingInfo?: boolean;
  nowMs?: number;
};

/**
 * FAIL-SAFE MODE entry — derived gate AFTER Decision Engine, BEFORE Human Trust.
 * Does not invent facts. When engaged: clarity posture only, confidence ≤ MEDIUM.
 */
export function processFailSafeMode(
  input: FailSafeModeInput,
  options: ProcessFailSafeModeOptions = {},
): FailSafeModeResult {
  const triggers = evaluateFailSafeTriggers(input);
  const engaged = triggers.length > 0;
  const escalationQuestions = engaged
    ? buildEscalationQuestions(input, triggers)
    : [];

  let escalatedMissingInfoQuestions: readonly string[] = [];
  if (
    engaged &&
    options.escalateMissingInfo !== false &&
    input.userId?.trim() &&
    input.situationId?.trim()
  ) {
    const escalated = escalateFailSafeMissingInformation({
      userId: input.userId,
      situationId: input.situationId,
      questions: escalationQuestions,
      nowMs: options.nowMs,
    });
    escalatedMissingInfoQuestions = escalated.escalatedQuestions;
  } else if (engaged) {
    escalatedMissingInfoQuestions = escalationQuestions;
  }

  const decisionConfidence = buildDecisionConfidence({
    engaged,
    triggers,
    input,
  });

  const clarify = failSafeClarifyAction();
  const clarification = engaged
    ? buildClarificationModeOutput({
        input,
        escalationQuestions:
          escalatedMissingInfoQuestions.length > 0
            ? escalatedMissingInfoQuestions
            : escalationQuestions,
      })
    : null;

  const effectiveActionId = engaged ? clarify.id : input.chosenActionId;
  const effectiveActionLabel = engaged
    ? clarify.label
    : input.chosenActionLabel;

  const guarantee = runFailSafeGuarantee({
    engaged,
    triggers,
    decisionConfidence,
    clarification,
    effectiveActionId,
  });

  return {
    engaged,
    triggers,
    decisionConfidence,
    clarification,
    effectiveActionId,
    effectiveActionLabel,
    escalatedMissingInfoQuestions,
    posture: engaged ? "clarify" : "allow",
    guarantee,
  };
}

export function toFailSafeModeLayerPayload(
  result: FailSafeModeResult,
): FailSafeModeLayerPayload {
  return {
    engaged: result.engaged,
    posture: result.posture,
    triggers: result.triggers,
    decisionConfidence: result.decisionConfidence,
    clarification: result.clarification,
    effectiveActionId: result.effectiveActionId,
    effectiveActionLabel: result.effectiveActionLabel,
    escalatedMissingInfoQuestions: result.escalatedMissingInfoQuestions,
    guaranteeOk: result.guarantee.ok,
  };
}

/**
 * When Fail-Safe is engaged, rewrite SolenOS output into clarification posture.
 * Suppresses premature “next best action” framing without inventing clinical facts.
 */
export function applyFailSafeClarificationToResponse(
  response: SolenOSResponse,
  result: FailSafeModeResult,
): SolenOSResponse {
  if (!result.engaged || !result.clarification) return response;

  const clarify = result.clarification;
  const knownLine = clarify.known.slice(0, 3).join(" ");
  const missingLine = clarify.mustClarifyBeforeAction
    .map((q, i) => `${i + 1}. ${q}`)
    .join(" ");

  return {
    ...response,
    what_is_happening: [
      "Fail-safe pause: SolenOS will not complete a recommendation until missing truth is recovered.",
      knownLine,
    ]
      .filter(Boolean)
      .join(" "),
    what_matters_now:
      "Clarify critical unknowns before any irreversible care step. Do not proceed on assumptions.",
    what_to_ask_next:
      missingLine ||
      "What must be confirmed before a safe next action can be recommended?",
  };
}

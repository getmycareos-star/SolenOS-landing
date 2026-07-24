import { buildDegradedOutput } from "../final-output-contract";
import { validateAIResponse, type SolenOSResponse } from "../response-validator";
import { FORBIDDEN_REASSURANCE_PATTERNS } from "./contract-constants";
import type { CompletenessResult, ExtractedFacts, RiskUncertaintyOutput } from "./types";

const MAX_QUESTIONS = 5;

function buildClarifyingQuestions(missing: string[]): string[] {
  const questions = missing.map((m) => `Can you clarify: ${m}?`);
  return questions.slice(0, MAX_QUESTIONS);
}

function buildContinuityRecord(facts: ExtractedFacts, completeness: CompletenessResult): string {
  const domainNote =
    completeness.triggered_domains.length > 0
      ? ` Safety domains noted: ${completeness.triggered_domains.join(", ")}.`
      : "";
  return `Caregiver input recorded.${domainNote} Completeness: ${completeness.status}.`;
}

/**
 * Step 5 — Build strict 7-section output format.
 */
export function buildRiskUncertaintyOutput(params: {
  facts: ExtractedFacts;
  completeness: CompletenessResult;
  blocked: boolean;
  priority: RiskUncertaintyOutput["priority_assessment"];
  confidence: RiskUncertaintyOutput["confidence_level"];
}): RiskUncertaintyOutput {
  const { facts, completeness, blocked, priority, confidence } = params;

  return {
    situation_summary: facts.explicit_statements.length
      ? facts.explicit_statements.join(" ")
      : "No explicit input provided.",
    information_completeness: completeness.status,
    confidence_level: blocked ? "Insufficient Information" : confidence,
    priority_assessment: blocked ? "Unable to Determine" : priority,
    missing_information: completeness.missing_signals,
    clarifying_questions: buildClarifyingQuestions(completeness.missing_signals),
    continuity_record: buildContinuityRecord(facts, completeness),
    decision_gate_blocked: blocked,
    triggered_domains: completeness.triggered_domains,
  };
}

/**
 * Build SolenOSResponse when decision gate blocks — no priority/urgency assignment.
 */
export function buildBlockedSolenOSResponse(output: RiskUncertaintyOutput): SolenOSResponse {
  const questions =
    output.clarifying_questions.length > 0
      ? output.clarifying_questions
      : ["What specifically is happening right now, and when did it start?"];

  return validateAIResponse(
    buildDegradedOutput({
      partial_happening: output.situation_summary,
      reason: "Required safety context is missing — decision gate blocked.",
      questions,
      unknowns: output.missing_information,
    }),
  );
}

/**
 * Enforce prohibited reassurance patterns on LLM output when gate was partial/blocked.
 */
export function enforceOutputSafety(
  response: SolenOSResponse,
  output: RiskUncertaintyOutput,
): SolenOSResponse {
  if (!output.decision_gate_blocked && output.information_completeness === "COMPLETE") {
    return response;
  }

  let next = { ...response };

  if (
    output.priority_assessment === "Unable to Determine" ||
    output.decision_gate_blocked
  ) {
    next.what_matters_now = "Unable to determine priority — more context is needed.";
    if (/^low$/i.test(next.risk_level)) {
      next = { ...next, risk_level: "medium" };
    }
  }

  for (const pattern of FORBIDDEN_REASSURANCE_PATTERNS) {
    if (pattern.test(next.what_can_wait)) {
      next.what_can_wait =
        "Further details are needed before anything can be safely deferred.";
    }
    if (pattern.test(next.what_is_happening)) {
      next.what_is_happening = output.situation_summary;
    }
  }

  return validateAIResponse(next);
}

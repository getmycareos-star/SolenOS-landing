import type { SolenOSOutput } from "../output-contract/types";
import { validateAIResponse } from "../response-validator";
import type { Classification, DecisionState, DomainTag, SignalVector } from "./types";

export interface SafeModeTrigger {
  active: boolean;
  reason: string;
}

const SAFE_MODE_THRESHOLD = 0.6;

export function shouldEnterSafeMode(params: {
  confidence: number;
  classification: Classification;
  validation_failed: boolean;
  conflicting_signals: boolean;
  ambiguity: boolean;
  priority_score: number;
  has_concrete_action: boolean;
}): SafeModeTrigger {
  if (params.validation_failed) {
    return { active: true, reason: "validation failed" };
  }
  if (params.conflicting_signals) {
    return { active: true, reason: "conflicting signals" };
  }
  if (params.has_concrete_action && params.priority_score >= 0.5 && params.confidence >= 0.45) {
    return { active: false, reason: "" };
  }
  if (params.classification === "ambiguous" && params.ambiguity) {
    return { active: true, reason: "ambiguous input" };
  }
  if (params.confidence < SAFE_MODE_THRESHOLD) {
    return { active: true, reason: "confidence below threshold" };
  }
  return { active: false, reason: "" };
}

export function applySafeMode(params: {
  raw: string;
  classification: Classification;
  domain: DomainTag;
  decision: DecisionState;
  signals: SignalVector;
  reason: string;
}): SolenOSOutput {
  const facts = params.raw.trim().slice(0, 280);
  const what_is_happening = facts
    ? `${facts} Key details are still unclear.`
    : "The input is too unclear to classify as a specific care update.";

  const what_matters_now =
    params.decision.priority_score >= 0.45
      ? params.decision.primary_action
      : "Gather one missing fact before acting — do not guess.";

  return validateAIResponse({
    what_is_happening,
    what_matters_now,
    what_to_ask_next:
      params.decision.next_question ||
      "What is the one fact you are least certain about right now?",
    risk_level: "medium",
    what_can_wait: "Most actions wait until the missing fact above is clarified.",
    follow_up_items: [],
    decision_trace: {
      events: [],
      assumptions: [],
      unknowns: ["AMBIGUITY", "MISSING_CONTEXT"],
      evidence_sources: [],
    },
    confidence_state: {
      overall_confidence: "low",
      completeness: 0,
      reasoning_limits: ["Input lacks structure for safe interpretation."],
    },
    trust_layer: {
      known: [],
      assumed: [],
      unknown: [
        { statement: "AMBIGUITY", drives_clarification: true },
        { statement: "MISSING_CONTEXT", drives_clarification: true },
      ],
      recency: {
        last_updated_at: null,
        freshness_score: 0,
        interpretation: "potentially outdated (>7–14 days)",
      },
      confidence: 0.2,
    },
    transparency_panel: {
      data_used: { care_events: [], timeline_segments: [], caregiver_inputs: [] },
      data_ignored: { conflicting: [], low_confidence: [], stale_or_decayed: [] },
      reason_for_output: "Safe mode activated due to insufficient structure.",
      evidence_breakdown: [],
      confidence_scores: { overall_pct: 15, tier: "low" },
      recency: { last_update_at: null, critical_event_ages: [], decay_status: "stale" },
      observed: [],
      inferred: [],
    },
  });
}

export function safeModeMinimalInput(
  classification: Classification,
  domain: DomainTag,
): SolenOSOutput {
  return validateAIResponse({
    what_is_happening: "The input is too unclear to classify as a specific care update.",
    what_matters_now: "Describe what is happening with care in one or two sentences.",
    what_to_ask_next: "What changed today that you need clarity on?",
    risk_level: "medium",
    what_can_wait: "Everything else until a clear care update is provided.",
    follow_up_items: [],
    decision_trace: {
      events: [],
      assumptions: [],
      unknowns: ["AMBIGUITY", "MISSING_CONTEXT"],
      evidence_sources: [],
    },
    confidence_state: {
      overall_confidence: "low",
      completeness: 0,
      reasoning_limits: ["Input lacks structure for safe interpretation."],
    },
    trust_layer: {
      known: [],
      assumed: [],
      unknown: [
        { statement: "AMBIGUITY", drives_clarification: true },
        { statement: "MISSING_CONTEXT", drives_clarification: true },
      ],
      recency: {
        last_updated_at: null,
        freshness_score: 0,
        interpretation: "potentially outdated (>7–14 days)",
      },
      confidence: 0.2,
    },
    transparency_panel: {
      data_used: { care_events: [], timeline_segments: [], caregiver_inputs: [] },
      data_ignored: { conflicting: [], low_confidence: [], stale_or_decayed: [] },
      reason_for_output: "Safe mode activated due to insufficient structure.",
      evidence_breakdown: [],
      confidence_scores: { overall_pct: 15, tier: "low" },
      recency: { last_update_at: null, critical_event_ages: [], decay_status: "stale" },
      observed: [],
      inferred: [],
    },
  });
}

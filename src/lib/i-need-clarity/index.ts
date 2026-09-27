/**
 * I Need Clarity / Confidence Collapse Support (Phase 2)
 * Regain understanding when certainty disappears — not generic chat.
 * 
 * Response framework:
 * 1. What changed?
 * 2. What we know
 * 3. What may be relevant
 * 4. What is unclear
 * 5. What to consider next
 */

import type { CanonicalCareEvent } from "../situation-entry/types";
import type { ContinuityTruthSlice } from "../presentation-engine";
import type { ContradictionMaterializationResult } from "../contradiction-materialization";
import type { AggregatedConfidence } from "../confidence-aggregation";
import { projectPresentation } from "../presentation-engine";

export type INeedClarityInput = {
  /** Trigger for clarity request */
  moment_type: "medical_uncertainty" | "sudden_behavior_change" | "family_disagreement" | "is_this_important" | "forgot_what_doctor_said" | "something_feels_different";
  /** Events around the moment */
  context_events: CanonicalCareEvent[];
  /** Current understanding slice */
  truth_slice: ContinuityTruthSlice;
  /** Contradictions */
  contradictions?: ContradictionMaterializationResult;
  /** Confidence assessment */
  confidence?: AggregatedConfidence;
  /** Caregiver's specific question if any */
  caregiver_question?: string;
  /** Caregiver ID */
  caregiver_id: string;
  /** Care recipient ID */
  care_recipient_id: string;
  /** Timestamp */
  timestamp: string;
};

export type INeedClarityResponse = {
  status: "FUTURE";
  moment_type: INeedClarityInput["moment_type"];
  goal: string;
  sections: {
    what_changed: string[];
    what_we_know: string[];
    what_may_be_relevant: string[];
    what_is_unclear: string[];
    what_to_consider_next: string[];
  };
  evidence_event_ids: string[];
  uncertainties: string[];
  confidence_label: string;
  presentation_view: ReturnType<typeof projectPresentation>;
};

const COLLAPSE_MOMENT_GOALS: Record<INeedClarityInput["moment_type"], string> = {
  medical_uncertainty: "Here is what we know so far.",
  sudden_behavior_change: "Here is what appears different from the usual pattern.",
  family_disagreement: "Everyone is working from the same care reality.",
  is_this_important: "Understand before reacting.",
  forgot_what_doctor_said: "Reconstruct relevant timeline and prior context.",
  something_feels_different: "Compare current observation against person-specific baseline.",
};

/**
 * Process I Need Clarity request — entry point for confidence collapse moments
 */
export async function processINeedClarity(input: INeedClarityInput): Promise<INeedClarityResponse> {
  const { moment_type, context_events, truth_slice, contradictions, confidence, caregiver_question, timestamp } = input;
  
  // Build sections based on truth slice and moment type
  const what_changed = truth_slice.what_changed.slice(0, 3);
  
  const what_we_know = [
    ...truth_slice.known.slice(0, 3),
    ...truth_slice.what_is_happening.slice(0, 2),
  ];
  
  const what_may_be_relevant = [
    ...truth_slice.inferred.slice(0, 3),
    ...truth_slice.evidence_summaries.slice(0, 2),
  ];
  
  const what_is_unclear = [
    ...truth_slice.explicit_unknowns.map(u => u.missing_information).slice(0, 3),
    ...(contradictions?.materialized.map(m => m.clarification_question) ?? []).slice(0, 2),
  ];
  
  if (caregiver_question) {
    what_is_unclear.unshift(caregiver_question);
  }
  
  const what_to_consider_next = [
    ...truth_slice.what_needs_attention.slice(0, 2),
    ...(contradictions?.materialized.filter(m => m.priority === "critical" || m.priority === "high").map(m => m.clarification_question) ?? []).slice(0, 1),
  ];
  
  // Build presentation view
  const presentation_view = projectPresentation(truth_slice, { mode: "standard" });
  
  // Confidence label
  const confidence_label = confidence 
    ? (confidence.label === "high" ? "High confidence in current understanding" :
       confidence.label === "moderate" ? "Moderate confidence — some gaps remain" :
       confidence.label === "limited" ? "Limited understanding — key gaps" :
       "Low confidence — significant uncertainty")
    : "Assessing...";
  
  return {
    status: "FUTURE",
    moment_type,
    goal: COLLAPSE_MOMENT_GOALS[moment_type],
    sections: {
      what_changed,
      what_we_know,
      what_may_be_relevant,
      what_is_unclear,
      what_to_consider_next,
    },
    evidence_event_ids: context_events.map(e => e.id),
    uncertainties: what_is_unclear,
    confidence_label,
    presentation_view,
  };
}

export {
  CONFIDENCE_COLLAPSE_NORTH_STAR,
  I_NEED_CLARITY_IDENTITY,
  CONFIDENCE_COLLAPSE_MOMENT_TYPES,
  COLLAPSE_MOMENT_GOALS,
  I_NEED_CLARITY_RESPONSE_SECTIONS,
  CONFIDENCE_COLLAPSE_BOUNDARIES,
} from "../future-capabilities/confidence-collapse-moments";
export type {
  ConfidenceCollapseMomentType,
  ConfidenceCollapseSupportBrief,
} from "../future-capabilities/confidence-collapse-moments";
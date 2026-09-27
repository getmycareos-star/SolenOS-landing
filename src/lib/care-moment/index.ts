/**
 * Care Moment — In-the-moment capture and understanding (Phase 2)
 * Bridges to moment-of-need-engine; NOT emergency medical tool.
 * 
 * Every Care Moment must answer:
 * 1. What changed?
 * 2. What do we know?
 * 3. Why might this matter? (context, not diagnosis)
 * 4. What should be remembered?
 * 5. What questions should be considered?
 */

import type { CanonicalCareEvent } from "../situation-entry/types";
import type { ContinuityTruthSlice } from "../presentation-engine";
import type { ContradictionMaterializationResult } from "../contradiction-materialization";
import type { AggregatedConfidence } from "../confidence-aggregation";
import { projectCareMoment } from "../presentation-engine";
import { projectPresentation } from "../presentation-engine";

export type CareMomentInput = {
  /** Events that triggered this moment */
  trigger_events: CanonicalCareEvent[];
  /** Current understanding slice */
  truth_slice: ContinuityTruthSlice;
  /** Contradictions needing clarification */
  contradictions?: ContradictionMaterializationResult;
  /** Confidence assessment */
  confidence?: AggregatedConfidence;
  /** Input method */
  input_method: "voice" | "text" | "photo" | "message_capture";
  /** Caregiver ID */
  caregiver_id: string;
  /** Care recipient ID */
  care_recipient_id: string;
  /** Timestamp */
  timestamp: string;
};

export type CareMomentResponse = {
  status: "FUTURE";
  input_method: CareMomentInput["input_method"];
  sections: {
    what_changed: string[];
    what_do_we_know: string[];
    why_might_this_matter: string[];
    what_should_be_remembered: string[];
    what_questions_to_consider: string[];
  };
  care_event_ids: string[];
  uncertainties: string[];
  confidence_label: string;
  presentation_view: ReturnType<typeof projectPresentation>;
};

/**
 * Process a Care Moment — entry point for Phase 2 in-the-moment capture
 */
export async function processCareMoment(input: CareMomentInput): Promise<CareMomentResponse> {
  const { trigger_events, truth_slice, contradictions, confidence, input_method, timestamp } = input;
  
  // Use presentation engine to project Care Moment sections
  const moment_sections = projectCareMoment(truth_slice);
  
  // Add contradiction questions if present
  const contradiction_questions = contradictions?.materialized
    .filter(m => m.urgency === "immediate" || m.priority === "critical" || m.priority === "high")
    .slice(0, 2)
    .map(m => m.clarification_question) ?? [];
  
  const all_questions = [
    ...moment_sections.what_questions_to_consider,
    ...contradiction_questions,
  ].slice(0, 3);
  
  // Build presentation view
  const presentation_view = projectPresentation(truth_slice, { mode: "essential" });
  
  // Confidence label
  const confidence_label = confidence 
    ? (confidence.label === "high" ? "We understand this well" :
       confidence.label === "moderate" ? "We have a reasonable understanding" :
       confidence.label === "limited" ? "Our understanding is limited" :
       "We do not understand this well yet")
    : "Understanding building...";
  
  return {
    status: "FUTURE",
    input_method,
    sections: {
      what_changed: moment_sections.what_changed,
      what_do_we_know: moment_sections.what_do_we_know,
      why_might_this_matter: moment_sections.why_might_this_matter,
      what_should_be_remembered: moment_sections.what_should_be_remembered,
      what_questions_to_consider: all_questions,
    },
    care_event_ids: trigger_events.map(e => e.id),
    uncertainties: [
      ...truth_slice.explicit_unknowns.map(u => u.missing_information),
      ...(contradictions?.materialized.map(m => m.clarification_question) ?? []),
    ],
    confidence_label,
    presentation_view,
  };
}

/**
 * Quick Care Moment from just events (for lightweight capture)
 */
export function quickCareMoment(
  events: CanonicalCareEvent[],
  input_method: CareMomentInput["input_method"] = "text"
): CareMomentResponse {
  const truth_slice: ContinuityTruthSlice = {
    what_changed: events.map(e => `${e.extracted_type}: ${e.raw_input.slice(0, 100)}`),
    what_is_happening: [],
    what_needs_attention: [],
    what_is_stable: [],
    known: events.filter(e => (e.integrity?.field_confidence?.extracted_fact?.extraction ?? 0) > 0.7).map(e => e.raw_input.slice(0, 100)),
    inferred: [],
    explicit_unknowns: [],
    confidence_notes: [],
    evidence_summaries: [],
  };
  
  const moment_sections = projectCareMoment(truth_slice);
  
  return {
    status: "FUTURE",
    input_method,
    sections: moment_sections,
    care_event_ids: events.map(e => e.id),
    uncertainties: [],
    confidence_label: "Building understanding...",
    presentation_view: projectPresentation(truth_slice, { mode: "essential" }),
  };
}

export {
  CARE_MOMENT_IDENTITY,
  CARE_MOMENT_ENTRY_LABELS,
  CARE_MOMENT_INPUT_METHODS,
  CARE_MOMENT_RESPONSE_FRAMEWORK,
  CARE_MOMENT_FLOW,
  CARE_MOMENT_BOUNDARIES,
  CARE_MOMENT_SUCCESS_METRIC,
  CARE_MOMENT_TO_MOMENT_OF_NEED_MAP,
} from "../future-capabilities/care-moment";
export type {
  CareMomentBrief,
  CareMomentResponseSection,
} from "../future-capabilities/care-moment";
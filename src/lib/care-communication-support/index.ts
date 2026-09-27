/**
 * Care Communication Support (Phase 3)
 * Extension of Care Reality Engine — NOT a generic communication assistant.
 * 
 * Principle: Do not help users communicate opinions. Help them communicate
 * shared context grounded in care history, observed changes, decisions,
 * outcomes, and unanswered questions.
 * 
 * Output structure:
 * 1. Current situation summary (neutral)
 * 2. Evidence from care reality
 * 3. Conversation preparation
 * 4. Communication drafts (only after understanding)
 */

import type { ContinuityTruthSlice } from "../presentation-engine";
import type { AggregatedConfidence } from "../confidence-aggregation";
import { projectCareCommunicationSupport } from "../presentation-engine";
import { projectPresentation } from "../presentation-engine";

export type CareCommunicationInput = {
  /** Current understanding slice */
  truth_slice: ContinuityTruthSlice;
  /** Aggregated confidence */
  aggregated_confidence?: AggregatedConfidence;
  /** Draft type to generate */
  draft_type?: "message_to_sibling" | "family_group_update" | "questions_for_doctor" | "care_transition_explanation" | "support_conversation_with_parent";
  /** Target audience */
  audience?: "sibling" | "family_group" | "doctor" | "care_team" | "parent" | "professional_caregiver";
  /** Caregiver ID */
  caregiver_id: string;
  /** Care recipient ID */
  care_recipient_id: string;
  /** Timestamp */
  timestamp: string;
};

export type CareCommunicationOutput = {
  status: "FUTURE";
  current_situation_summary: string;
  evidence: Array<{ claim: string; source_type: string; event_ids: string[] }>;
  conversation_preparation: string[];
  draft_type?: string;
  draft_text?: string;
  uncertainties: string[];
  confidence_label: string;
  presentation_view: ReturnType<typeof projectPresentation>;
  boundaries_check: {
    neutral_summary: boolean;
    evidence_cited: boolean;
    no_persuasion: boolean;
    no_sides_taken: boolean;
    no_medical_decisions: boolean;
  };
};

/**
 * Process Care Communication Support request
 */
export async function processCareCommunication(input: CareCommunicationInput): Promise<CareCommunicationOutput> {
  const { truth_slice, aggregated_confidence, draft_type, audience, timestamp } = input;
  
  // Use presentation engine to project communication support
  const comm_support = projectCareCommunicationSupport(truth_slice, draft_type);
  
  // Build presentation view
  const presentation_view = projectPresentation(truth_slice, { mode: "detailed" });
  
  // Confidence label
  const confidence_label = aggregated_confidence 
    ? (aggregated_confidence.label === "high" ? "High confidence in shared context" :
       aggregated_confidence.label === "moderate" ? "Moderate confidence — some gaps" :
       aggregated_confidence.label === "limited" ? "Limited shared context — key gaps" :
       "Low confidence — significant uncertainty")
    : "Building shared context...";
  
  // Boundaries check
  const boundaries_check = {
    neutral_summary: !comm_support.current_situation_summary.includes("should") && 
                     !comm_support.current_situation_summary.includes("must") &&
                     !comm_support.current_situation_summary.includes("need to"),
    evidence_cited: comm_support.evidence_from_care_reality.length > 0,
    no_persuasion: !comm_support.draft_text?.includes("convince") &&
                   !comm_support.draft_text?.includes("persuade") &&
                   !comm_support.draft_text?.includes("you're wrong"),
    no_sides_taken: !comm_support.draft_text?.includes("you are right") &&
                    !comm_support.draft_text?.includes("they are wrong"),
    no_medical_decisions: !comm_support.draft_text?.includes("diagnosis") &&
                          !comm_support.draft_text?.includes("prescribe") &&
                          !comm_support.draft_text?.includes("treatment"),
  };
  
  return {
    status: "FUTURE",
    current_situation_summary: comm_support.current_situation_summary,
    evidence: comm_support.evidence_from_care_reality,
    conversation_preparation: comm_support.conversation_preparation,
    draft_type: comm_support.draft_type,
    draft_text: comm_support.draft_text,
    uncertainties: comm_support.uncertainties,
    confidence_label,
    presentation_view,
    boundaries_check,
  };
}

/**
 * Quick communication draft without full processing
 */
export function quickCommunicationDraft(
  truth_slice: ContinuityTruthSlice,
  draft_type: CareCommunicationInput["draft_type"] = "family_group_update"
): CareCommunicationOutput["draft_text"] {
  const comm = projectCareCommunicationSupport(truth_slice, draft_type);
  return comm.draft_text;
}

export {
  CARE_COMMUNICATION_SUPPORT_IDENTITY,
  CARE_COMMUNICATION_SUPPORT_PRINCIPLE,
  COMMUNICATION_OUTPUT_SECTIONS,
  COMMUNICATION_DRAFT_TYPES,
  COMMUNICATION_GROUNDING_SOURCES,
  COMMUNICATION_BOUNDARIES,
  COMMUNICATION_STRATEGIC_GOAL,
} from "../future-capabilities/care-communication-support";
export type {
  CommunicationOutputSection,
  CareCommunicationBrief,
} from "../future-capabilities/care-communication-support";
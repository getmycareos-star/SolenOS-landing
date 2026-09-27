/**
 * Help Me Communicate This (Phase 3)
 * Conversation preparation from care reality + person-specific profile.
 * Extends Care Communication Support with human context.
 * 
 * Must not: persuade · take sides · create conflict
 * Must: create shared understanding · reduce confusion
 */

import type { ContinuityTruthSlice } from "../presentation-engine";
import type { HumanContextInsight } from "../future-capabilities/human-context";
import type { AggregatedConfidence } from "../confidence-aggregation";
import { processCareCommunication } from "../care-communication-support";
import { projectPresentation } from "../presentation-engine";

export type HelpMeCommunicateInput = {
  /** Current understanding slice */
  truth_slice: ContinuityTruthSlice;
  /** Aggregated confidence */
  aggregated_confidence?: AggregatedConfidence;
  /** Human context insights for personalization */
  human_context?: HumanContextInsight[];
  /** Draft type */
  draft_type: "message_to_sibling" | "family_group_update" | "questions_for_doctor" | "care_transition_explanation" | "support_conversation_with_parent";
  /** Specific goal for this communication */
  communication_goal?: string;
  /** Caregiver ID */
  caregiver_id: string;
  /** Care recipient ID */
  care_recipient_id: string;
  /** Timestamp */
  timestamp: string;
};

export type HelpMeCommunicateOutput = {
  status: "FUTURE";
  current_situation_summary: string;
  evidence: Array<{ claim: string; source_type: string; event_ids: string[] }>;
  conversation_preparation: string[];
  human_context_applied: string[];
  draft_type: string;
  draft_text: string;
  uncertainties: string[];
  confidence_label: string;
  presentation_view: ReturnType<typeof projectPresentation>;
  boundaries_check: {
    neutral_summary: boolean;
    evidence_cited: boolean;
    no_persuasion: boolean;
    no_sides_taken: boolean;
    no_medical_decisions: boolean;
    preserves_empathy: boolean;
    person_specific: boolean;
  };
};

/**
 * Process Help Me Communicate This request
 */
export async function processHelpMeCommunicate(input: HelpMeCommunicateInput): Promise<HelpMeCommunicateOutput> {
  const { truth_slice, aggregated_confidence, human_context, draft_type, communication_goal, timestamp } = input;
  
  // First get base communication support
  const base_comm = await processCareCommunication({
    truth_slice,
    aggregated_confidence,
    draft_type,
    caregiver_id: input.caregiver_id,
    care_recipient_id: input.care_recipient_id,
    timestamp,
  });
  
  // Apply human context personalization
  const human_context_applied: string[] = [];
  let personalized_draft = base_comm.draft_text ?? "";
  
  if (human_context && human_context.length > 0) {
    for (const insight of human_context) {
      human_context_applied.push(`${insight.layer}: ${insight.insight}`);
      
      // Apply relevant insights to draft
      if (insight.layer === "communication_patterns" && insight.confidence === "high") {
        human_context_applied.push("Applied: Use " + insight.insight.toLowerCase());
      }
      if (insight.layer === "what_calms" && draft_type === "support_conversation_with_parent") {
        human_context_applied.push("Applied calming approach: " + insight.insight);
      }
      if (insight.layer === "what_causes_distress" && insight.confidence === "high") {
        human_context_applied.push("Avoid distress trigger: " + insight.insight);
      }
      if (insight.layer === "previous_successful_approaches" && insight.confidence === "high") {
        human_context_applied.push("Use successful approach: " + insight.insight);
      }
      if (insight.layer === "previous_failed_approaches" && insight.confidence === "high") {
        human_context_applied.push("Avoid failed approach: " + insight.insight);
      }
    }
    
    // Add human context note to draft
    if (human_context_applied.length > 0) {
      personalized_draft += "\n\n[Personalized with care profile insights]";
    }
  }
  
  // Add communication goal if provided
  if (communication_goal) {
    personalized_draft = `[Goal: ${communication_goal}]\n\n` + personalized_draft;
  }
  
  // Build presentation view
  const presentation_view = projectPresentation(truth_slice, { mode: "detailed" });
  
  // Confidence label
  const confidence_label = aggregated_confidence 
    ? (aggregated_confidence.label === "high" ? "High confidence in shared context" :
       aggregated_confidence.label === "moderate" ? "Moderate confidence — some gaps" :
       aggregated_confidence.label === "limited" ? "Limited shared context — key gaps" :
       "Low confidence — significant uncertainty")
    : "Building shared context...";
  
  // Enhanced boundaries check
  const boundaries_check = {
    ...base_comm.boundaries_check,
    preserves_empathy: !personalized_draft.includes("ignore") && 
                       !personalized_draft.includes("doesn't matter") &&
                       !personalized_draft.includes("overreacting"),
    person_specific: human_context_applied.length > 0,
  };
  
  return {
    status: "FUTURE",
    current_situation_summary: base_comm.current_situation_summary,
    evidence: base_comm.evidence,
    conversation_preparation: [
      ...base_comm.conversation_preparation,
      ...(human_context_applied.length > 0 ? ["Review person-specific communication patterns and triggers"] : []),
    ],
    human_context_applied,
    draft_type,
    draft_text: personalized_draft,
    uncertainties: base_comm.uncertainties,
    confidence_label,
    presentation_view,
    boundaries_check,
  };
}

export {
  HUMAN_CONTEXT_IDENTITY,
  HUMAN_CONTEXT_PRINCIPLE,
  HUMAN_CONTEXT_LAYERS,
  HUMAN_CONTEXT_TO_PROFILE_SECTION,
  HUMAN_CONTEXT_BOUNDARIES,
  HUMAN_CONTEXT_WRONG_VS_RIGHT,
} from "../future-capabilities/human-context";
export type {
  HumanContextLayer,
  HumanContextInsight,
} from "../future-capabilities/human-context";
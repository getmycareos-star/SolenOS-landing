/**
 * Care Communication Support (Phase 3 — FUTURE).
 * Extension of Care Reality Engine — NOT a generic communication assistant.
 */

export const CARE_COMMUNICATION_SUPPORT_IDENTITY =
  "Help families communicate shared context — not opinions.";

export const CARE_COMMUNICATION_SUPPORT_PRINCIPLE =
  "Do not help users communicate opinions. Help them communicate shared context grounded in care history, observed changes, decisions, outcomes, and unanswered questions.";

/** Output structure for "Help Me Communicate This" — engine contract, not UI. */
export const COMMUNICATION_OUTPUT_SECTIONS = [
  "current_situation_summary",
  "evidence_from_care_reality",
  "conversation_preparation",
  "communication_drafts",
] as const;

export type CommunicationOutputSection = (typeof COMMUNICATION_OUTPUT_SECTIONS)[number];

export const COMMUNICATION_DRAFT_TYPES = [
  "message_to_sibling",
  "family_group_update",
  "questions_for_doctor",
  "care_transition_explanation",
  "support_conversation_with_parent",
] as const;

export const COMMUNICATION_GROUNDING_SOURCES = [
  "care_history",
  "observed_changes",
  "previous_decisions",
  "outcomes",
  "unanswered_questions",
  "timeline_events",
  "family_observations",
  "appointment_information",
] as const;

export const COMMUNICATION_BOUNDARIES = {
  must: [
    "neutral_situation_summary",
    "evidence_cited_for_each_claim",
    "structure_discussion_not_persuade",
    "preserve_accuracy_and_empathy",
    "create_shared_understanding",
  ],
  must_not: [
    "take_sides_in_disagreement",
    "decide_who_is_right",
    "create_conflict",
    "persuade_toward_medical_decision",
    "write_message_before_understanding_situation",
    "generic_letter_templates_without_care_context",
  ],
} as const;

export const COMMUNICATION_STRATEGIC_GOAL = {
  before: "Why didn't anyone tell me?",
  after: "Now everyone understands what has been happening.",
} as const;

export type CareCommunicationBrief = {
  /** FUTURE — populated by Care Reality Engine when phase gate passes */
  status: "FUTURE";
  current_situation_summary: string;
  evidence: Array<{ claim: string; source_type: string; event_ids: string[] }>;
  conversation_preparation: string[];
  draft_type?: (typeof COMMUNICATION_DRAFT_TYPES)[number];
  draft_text?: string;
  uncertainties: string[];
};

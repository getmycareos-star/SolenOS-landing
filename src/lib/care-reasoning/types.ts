/**
 * Care Reasoning — pre-projection internal reasoning layer.
 *
 * Before any caregiver-facing response is composed, this layer answers the
 * 13 core questions about the care situation, powered by ContinuityDecision
 * and CareSituationUnderstanding.
 *
 * The 13 questions are:
 *   1. Who is this about? (who)
 *   2. Is this new information or continuation? (information_type)
 *   3. What changed? (change)
 *   4. What matters most? (priority)
 *   5. What can wait? (deferral)
 *   6. What is unknown? (unknowns)
 *   7. What questions reduce uncertainty? (questions)
 *   8. What evidence exists? (evidence)
 *   9. What relationships exist? (relationships)
 *  10. What should be remembered? (memory)
 *  11. What should be monitored? (monitor)
 *  12. What should be revisited later? (revisit)
 *  13. Are all questions sufficiently answered? (all_answered)
 */

import type { ContinuityDecision } from "../care-identity/continuity-detection";
import type { CareSituationUnderstanding } from "../care-situation-understanding/types";

/**
 * Answer to "Who is this about?"
 */
export type ReasoningWho = {
  care_recipient: string | null;
  certainty: "known" | "inferred_from_kinship" | "unknown";
  needs_confirmation: boolean;
};

/**
 * Answer to "Is this new information or continuation?"
 */
export type ReasoningInformationType = {
  is_new_information: boolean;
  is_continuation: boolean;
  describes_change: boolean;
  is_correction: boolean;
  is_emotional_only: boolean;
  /** Summary of what in the input is new vs continued from prior */
  new_aspects: string[];
  continued_aspects: string[];
};

/**
 * Answer to "What changed?"
 */
export type ReasoningChange = {
  has_changes: boolean;
  /** Descriptions of what changed */
  changes: string[];
  /** Whether we have a comparable prior to measure against */
  has_comparable_prior: boolean;
  /** Mode: initial assessment (no prior) vs change detection (has prior) */
  mode: "initial_assessment" | "change_detection";
};

/**
 * Answer to "What matters most?"
 */
export type ReasoningPriority = {
  matters_now: string[];
  can_wait: string[];
  significance: "safety_critical" | "functional_change" | "emerging_pattern" | "contextual" | "low";
};

/**
 * Answer to "What can wait?"
 */
export type ReasoningDeferral = {
  can_wait: string[];
  reason: "not_urgent" | "admin_or_load" | "no_comparable_prior" | "already_addressed";
};

/**
 * Answer to "What is unknown?"
 */
export type ReasoningUnknowns = {
  prior_unknowns_carried_forward: string[];
  new_unknowns: string[];
  remaining_uncertainty: "high" | "medium" | "low";
};

/**
 * Answer to "What questions reduce uncertainty?"
 */
export type ReasoningQuestions = {
  targeted_questions: string[];
  priority: "must_know" | "helpful_to_know" | "can_wait";
};

/**
 * Answer to "What evidence exists?" (Question 8)
 */
export type ReasoningEvidence = {
  /** Summaries of specific evidence supporting current understanding */
  supporting_evidence: string[];
  /** Evidence that contradicts or challenges current understanding */
  contradictory_evidence: string[];
  /** Evidence that is missing — would reduce uncertainty if obtained */
  missing_evidence: string[];
  /** Overall evidential strength */
  strength: "strong" | "moderate" | "weak" | "insufficient";
};

/**
 * Answer to "What relationships exist?" (Question 9)
 * Non-causal links between observations, events, and changes.
 */
export type ReasoningRelationships = {
  /** Temporal relationships (events happening in sequence or proximity) */
  temporal_links: string[];
  /** Contextual relationships (events sharing a context) */
  contextual_links: string[];
  /** Pattern relationships (repeated or cyclical observations) */
  pattern_links: string[];
  /** Whether any relationships have been identified */
  has_relationships: boolean;
};

/**
 * Answer to "What should be remembered?" (Question 10)
 */
export type ReasoningMemory = {
  /** Facts worth committing to longitudinal memory */
  remember: string[];
  /** Facts that should NOT be committed (noise, transient) */
  do_not_remember: string[];
  /** Open loops that need follow-up */
  open_loops: string[];
  /** Memory strategy: what to keep, what to let decay */
  strategy: "preserve" | "monitor" | "let_decay" | "unknown";
};

/**
 * Answer to "What should be monitored?" (Question 11)
 */
export type ReasoningMonitor = {
  /** Specific things to watch for */
  watch_for: string[];
  /** Indicators that would change priority or risk level */
  escalation_triggers: string[];
  /** Recommended monitoring cadence */
  cadence: "immediate" | "next_update" | "periodic" | "passive";
};

/**
 * Answer to "What should be revisited later?" (Question 12)
 */
export type ReasoningRevisit = {
  /** Topics or unknowns to revisit */
  revisit_topics: string[];
  /** Trigger for when to revisit (time, event, or condition) */
  revisit_trigger: string;
  /** Priority of revisiting */
  priority: "essential" | "helpful" | "optional";
};

/**
 * Complete snapshot of the internal reasoning for a single turn.
 * Produced before any response composition, fed into the composer.
 * Now covers all 13 reasoning questions.
 */
export type CareReasoningSnapshot = {
  who: ReasoningWho;
  information_type: ReasoningInformationType;
  change: ReasoningChange;
  priority: ReasoningPriority;
  deferral: ReasoningDeferral;
  unknowns: ReasoningUnknowns;
  questions: ReasoningQuestions;
  /** Question 8: What evidence exists? */
  evidence: ReasoningEvidence;
  /** Question 9: What relationships exist? */
  relationships: ReasoningRelationships;
  /** Question 10: What should be remembered? */
  memory: ReasoningMemory;
  /** Question 11: What should be monitored? */
  monitor: ReasoningMonitor;
  /** Question 12: What should be revisited later? */
  revisit: ReasoningRevisit;
  /** Question 13: Are all questions sufficiently answered? */
  all_questions_answered: boolean;
  /** Whether the system should orient as new or acknowledge return */
  continuity_type: "new_caregiver" | "new_care_recipient" | "returning" | "continuation";
  /** Whether this snapshot is ready for caregiver-facing composition */
  can_compose: boolean;
};

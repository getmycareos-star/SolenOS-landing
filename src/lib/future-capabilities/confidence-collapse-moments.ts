/**
 * Confidence Collapse Moments + "I Need Clarity" (Phase 2 — FUTURE).
 * Regain understanding when certainty disappears — not generic chat.
 */

export const CONFIDENCE_COLLAPSE_NORTH_STAR =
  "Can SolenOS help this person regain understanding when confidence starts to disappear?";

export const I_NEED_CLARITY_IDENTITY =
  "Something changed. Help me understand it.";

export const CONFIDENCE_COLLAPSE_MOMENT_TYPES = [
  "medical_uncertainty",
  "sudden_behavior_change",
  "family_disagreement",
  "is_this_important",
  "forgot_what_doctor_said",
  "something_feels_different",
] as const;

export type ConfidenceCollapseMomentType =
  (typeof CONFIDENCE_COLLAPSE_MOMENT_TYPES)[number];

export const COLLAPSE_MOMENT_GOALS: Record<ConfidenceCollapseMomentType, string> = {
  medical_uncertainty: "Here is what we know so far.",
  sudden_behavior_change: "Here is what appears different from the usual pattern.",
  family_disagreement: "Everyone is working from the same care reality.",
  is_this_important: "Understand before reacting.",
  forgot_what_doctor_said: "Reconstruct relevant timeline and prior context.",
  something_feels_different: "Compare current observation against person-specific baseline.",
};

/** I Need Clarity response framework — mirrors moment-of-need, extends for collapse. */
export const I_NEED_CLARITY_RESPONSE_SECTIONS = [
  "what_changed",
  "what_we_know",
  "what_may_be_relevant",
  "what_is_unclear",
  "what_to_consider_next",
] as const;

export const CONFIDENCE_COLLAPSE_BOUNDARIES = {
  is: [
    "reconstruct_context",
    "identify_changes",
    "preserve_continuity",
    "reduce_uncertainty",
    "shared_care_reality_for_family",
  ],
  is_not: [
    "diagnosing",
    "predicting_medical_outcomes",
    "replacing_professionals",
    "making_decisions_for_families",
    "ask_anything_chat",
  ],
} as const;

export type ConfidenceCollapseSupportBrief = {
  status: "FUTURE";
  moment_type: ConfidenceCollapseMomentType;
  goal: string;
  sections: Partial<
    Record<(typeof I_NEED_CLARITY_RESPONSE_SECTIONS)[number], string[]>
  >;
  evidence_event_ids: string[];
  uncertainties: string[];
};

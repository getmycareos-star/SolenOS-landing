/**
 * Future capabilities — architecture contracts only (Phase 2/3).
 * NOT MVP features. No UI until Care Reality Engine trust foundation exists.
 */

export const FUTURE_CAPABILITY_STATUS = "FUTURE" as const;

export const CAPABILITY_PHASES = ["phase_2", "phase_3"] as const;

/** MVP must prove trusted care reality understanding before these activate. */
export const FUTURE_CAPABILITY_READINESS_GATE =
  "Care Reality Engine must produce evidence-backed, person-specific understanding before communication or clarity UX ships.";

export const FUTURE_CAPABILITY_IDS = [
  "care_moment",
  "i_need_clarity",
  "care_understanding_confidence",
  "confidence_collapse_support",
  "care_communication_support",
  "help_me_communicate_this",
] as const;

export type FutureCapabilityId = (typeof FUTURE_CAPABILITY_IDS)[number];
export type CapabilityPhase = (typeof CAPABILITY_PHASES)[number];

export const FUTURE_CAPABILITY_REGISTRY: Record<
  FutureCapabilityId,
  {
    label: string;
    phase: CapabilityPhase;
    status: typeof FUTURE_CAPABILITY_STATUS;
    /** Existing engine this extends — never a standalone product. */
    extends: string;
    notA: string;
  }
> = {
  care_moment: {
    label: "Care Moment — Something is happening",
    phase: "phase_2",
    status: FUTURE_CAPABILITY_STATUS,
    extends: "moment_of_need_engine + care_reality_intelligence",
    notA: "emergency medical tool · diagnosis system · chatbot",
  },
  i_need_clarity: {
    label: "I Need Clarity — confidence collapse entry",
    phase: "phase_2",
    status: FUTURE_CAPABILITY_STATUS,
    extends: "moment_of_need_engine + baseline_intelligence_engine",
    notA: "Ask anything chat · generic AI assistant",
  },
  care_understanding_confidence: {
    label: "Care Understanding Confidence — current understanding view",
    phase: "phase_2",
    status: FUTURE_CAPABILITY_STATUS,
    extends: "continuity_properties + evidence_preservation + care_state_engine",
    notA: "caregiving score · health score · performance rating",
  },
  confidence_collapse_support: {
    label: "Confidence Collapse Moments — regain understanding when certainty disappears",
    phase: "phase_2",
    status: FUTURE_CAPABILITY_STATUS,
    extends: "moment_of_need_engine + care_context_diff_engine",
    notA: "diagnosis · medical prediction · decision replacement",
  },
  care_communication_support: {
    label: "Care Communication Support — shared context, not opinions",
    phase: "phase_3",
    status: FUTURE_CAPABILITY_STATUS,
    extends: "care_reality_intelligence + evidence_preservation",
    notA: "generic communication assistant · family chat · message writer without context",
  },
  help_me_communicate_this: {
    label: "Help Me Communicate This — conversation preparation from care reality",
    phase: "phase_3",
    status: FUTURE_CAPABILITY_STATUS,
    extends: "care_communication_support + care_reality_profile_engine",
    notA: "persuasion engine · taking sides in family disagreement",
  },
};

/** Shared boundary — all future capabilities. */
export const FUTURE_CAPABILITY_BOUNDARIES = {
  must: [
    "ground_in_care_reality_engine",
    "show_evidence_and_uncertainty",
    "preserve_original_care_events",
    "reduce_confusion_not_create_conflict",
  ],
  must_not: [
    "generic_communication_assistant",
    "gamified_scores_or_ratings",
    "ask_anything_chatbot",
    "take_sides_in_family_disagreement",
    "persuade_medical_decisions",
    "diagnose_or_prescribe",
    "ship_before_trust_foundation",
  ],
} as const;

/** Chaos-first ingestion — implemented via adoption wedge; principle documented here. */
export const CHAOS_FIRST_INGESTION = {
  status: "IMPLEMENTED" as const,
  modulePath: "src/lib/adoption-wedge-engine",
  entryPhrase: "Bring the chaos. SolenOS helps make sense of it.",
  forbids: [
    "complete_your_care_profile",
    "enter_all_medications_manually",
    "build_parent_history_first",
    "long_questionnaires_before_value",
    "categorize_every_event_upfront",
  ],
  successQuestion: "Did the caregiver understand more with almost no extra effort?",
} as const;

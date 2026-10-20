/** Caregiver demand → continuity failure model. Questions are symptoms, not feature requests. */

export const CAREGIVER_DEMAND_IDENTITY =
  "Every caregiver question is evidence of missing continuity — not a request for a better answer.";

export const DEMAND_TYPES = ["continuity_demand", "search_demand"] as const;

export const CONTINUITY_FAILURE_THEMES = [
  "decision_fatigue",
  "cognitive_load",
  "progression_visibility",
  "decision_confidence",
  "conversation_preparation",
  "financial_uncertainty",
  "care_coordination",
  "emotional_burden",
] as const;

export type ContinuityFailureTheme = (typeof CONTINUITY_FAILURE_THEMES)[number];

/** Maps real caregiver question themes to missing engines — build the cause, not the answer. */
export const QUESTION_TO_CONTINUITY_FAILURE: ReadonlyArray<{
  theme: ContinuityFailureTheme;
  example_questions: readonly string[];
  underlying_need: string;
  missing_capabilities: readonly string[];
  demand_type: "continuity_demand" | "search_demand";
}> = [
  {
    theme: "progression_visibility",
    example_questions: [
      "Is this getting worse?",
      "Does my parent need 24/7 care?",
      "Warning signs they need professional care",
      "Is Dad wandering more than before?",
    ],
    underlying_need: "I don't understand how reality is changing.",
    missing_capabilities: [
      "care_context_diff_engine",
      "timeline_reconstruction_engine",
      "state_of_care_summary_engine",
    ],
    demand_type: "continuity_demand",
  },
  {
    theme: "decision_fatigue",
    example_questions: [
      "Should I hire professional help?",
      "Home vs memory care?",
      "When should I call the doctor?",
      "What should I do next?",
    ],
    underlying_need: "I need confidence in my next decision.",
    missing_capabilities: [
      "state_of_care_summary_engine",
      "prioritization_engine",
      "trust_layer_engine",
    ],
    demand_type: "continuity_demand",
  },
  {
    theme: "cognitive_load",
    example_questions: [
      "I can't remember what happened at the last appointment",
      "Am I forgetting something?",
      "Everything is getting mixed up",
      "What should I tell the doctor?",
    ],
    underlying_need: "I am carrying too much cognitive load.",
    missing_capabilities: [
      "care_event_store",
      "care_context",
      "retention_engine",
      "timeline_reconstruction_engine",
    ],
    demand_type: "continuity_demand",
  },
  {
    theme: "decision_confidence",
    example_questions: [
      "Should I worry?",
      "Am I missing something?",
      "Am I doing enough?",
      "Is this normal for them?",
    ],
    underlying_need: "I lack confidence in my understanding of this person's care reality.",
    missing_capabilities: [
      "baseline_intelligence_engine",
      "confidence_calibration_system",
      "trust_layer_engine",
      "care_reality_profile_engine",
    ],
    demand_type: "continuity_demand",
  },
  {
    theme: "conversation_preparation",
    example_questions: [
      "What do I tell the doctor?",
      "How do I explain this to family?",
      "What changed since last visit?",
    ],
    underlying_need: "I need structured continuity for important conversations.",
    missing_capabilities: [
      "timeline_reconstruction_engine",
      "state_of_care_summary_engine",
      "care_context_diff_engine",
      "meeting_preparation",
    ],
    demand_type: "continuity_demand",
  },
  {
    theme: "care_coordination",
    example_questions: [
      "How do I hire a caregiver?",
      "Live-in care vs respite?",
      "Who should handle night shifts?",
    ],
    underlying_need: "I cannot coordinate care effectively.",
    missing_capabilities: [
      "multi_caregiver_context_model",
      "state_of_care_summary_engine",
      "caregiver_load_engine",
    ],
    demand_type: "continuity_demand",
  },
  {
    theme: "emotional_burden",
    example_questions: [
      "How do I prevent caregiver burnout?",
      "Balancing work and dementia caregiving",
      "I feel guilty all the time",
    ],
    underlying_need: "I am carrying too much burden without visibility into load.",
    missing_capabilities: ["caregiver_load_engine", "continuity_decay_engine"],
    demand_type: "continuity_demand",
  },
  {
    theme: "financial_uncertainty",
    example_questions: [
      "Does Medicare cover dementia care?",
      "Medicaid for caregiving",
      "Cost of memory care",
      "Paying caregivers",
    ],
    underlying_need: "I am making care decisions under financial uncertainty.",
    missing_capabilities: [],
    demand_type: "search_demand",
  },
] as const;

/** Continuity-demand linguistic signals (product-market fit core). */
export const CONTINUITY_DEMAND_PATTERNS = [
  /\b(what changed|getting worse|am i (?:forgetting|missing)|should i (?:worry|hire|be concerned))\b/i,
  /\b(can'?t remember|everything is (?:mixed|confused)|what matters now|what should i (?:do|tell))\b/i,
  /\b(is this normal|am i doing enough|do i need more help|things keep changing)\b/i,
  /\b(almost fell|wander(?:ing)?|refused|confused|medication changed|fell again)\b/i,
] as const;

/** Search-demand signals — attract via content; do not become the product core. */
export const SEARCH_DEMAND_PATTERNS = [
  /\b(medicare|medicaid|insurance covers|how much (?:does|do)|salary|cost of)\b/i,
  /\b(legal|power of attorney|guardianship forms?)\b/i,
] as const;

export const REAL_USER_JOBS = [
  {
    id: "reduce_decision_fatigue",
    label: "Reduce Decision Fatigue",
    outcome: "Fewer difficult decisions made without adequate CareContext",
  },
  {
    id: "reduce_cognitive_load",
    label: "Reduce Cognitive Load",
    outcome: "Caregivers no longer reconstruct timelines from memory",
  },
  {
    id: "make_progression_visible",
    label: "Make Progression Visible",
    outcome: "Improving / stable / deteriorating is continuously answered",
  },
  {
    id: "increase_decision_confidence",
    label: "Increase Decision Confidence",
    outcome: "Known / uncertain / evidence / missing info are explicit",
  },
  {
    id: "prepare_important_conversations",
    label: "Prepare Caregivers for Important Conversations",
    outcome: "Structured chronological context for clinicians and family",
  },
] as const;

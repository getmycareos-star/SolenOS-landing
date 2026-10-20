/**
 * Care Reality Engine — frozen MVP reasoning principles (behavioral contract).
 * SoT: docs/02-product/solenos-care-reality-engine-principles.md
 *
 * Not UI. Not keyword templates. Maps to existing engines.
 */

export const CARE_REALITY_ENGINE_PRINCIPLES_PURPOSE =
  "Frozen MVP reasoning contract: change care reality, preserve uncertainty, never overwrite history, explain understanding.";

/** Principle ids — stable for verify + architecture map. */
export const CARE_REALITY_ENGINE_PRINCIPLES = [
  "did_this_change_care_reality",
  "preserve_uncertainty",
  "never_overwrite_history",
  "understanding_must_be_explainable",
  "separate_observations_from_conclusions",
  "confidence_on_understanding_engine_only",
  "event_lifecycle",
  "avoid_chatbot_personality",
  "timeline_is_the_product",
  "questions_only_reduce_uncertainty",
  "new_vs_existing_care_record",
] as const;

export type CareRealityEnginePrinciple =
  (typeof CARE_REALITY_ENGINE_PRINCIPLES)[number];

/** First gate on every capture. */
export const CARE_REALITY_IMPACT_QUESTION =
  "Did this information change the person's care reality?";

/** Universal processing — input must do ≥1. */
export const CARE_REALITY_UNIVERSAL_ACTIONS = [
  "create_event",
  "update_event",
  "record_decision",
  "preserve_decision_why",
  "identify_change",
  "connect_related_events",
  "preserve_outcome",
  "reduce_uncertainty",
  "create_unknown",
  "strengthen_timeline",
] as const;

export type CareRealityUniversalAction =
  (typeof CARE_REALITY_UNIVERSAL_ACTIONS)[number];

/** Attach memory to care record (person), not caregiver account alone. */
export const CARE_RECORD_SCOPE_RULE =
  "Care Reality memory attaches to the care recipient Care Record — not solely the caregiver user account.";

export const CARE_RECORD_MODE = {
  new_care_record: "Establish initial Care Reality — do not invent history or compare to absent baseline.",
  existing_care_record:
    "Compare before respond — change, update, confirm, contradict, answer unknown, or new decision.",
} as const;

/** Internal reasoning order — every interaction. */
export const CARE_REALITY_REASONING_ORDER = [
  "classify_new_or_existing_care_record",
  "load_existing_care_reality",
  "compare_new_information",
  "identify_events_changes_decisions_outcomes_contradictions_unknowns",
  "update_living_care_record",
  "generate_current_understanding",
  "produce_caregiver_response",
] as const;

/** Epistemic layers — never collapse into one blob. */
export const CARE_REALITY_EPISTEMIC_LAYERS = [
  "observations",
  "interpretations",
  "confirmed_facts",
  "unknowns",
] as const;

/** Engine-only confidence bands — never % in caregiver UI. */
export const CARE_REALITY_CONFIDENCE_BANDS = ["low", "medium", "high"] as const;

/** Chatbot personality bans (caregiver-facing). */
export const CARE_REALITY_CHATBOT_BANS = [
  /i'?m sorry to hear that/i,
  /i understand how (?:difficult|hard|you feel)/i,
  /i'?m here for you/i,
] as const;

/** Causal theater — correlation presented as cause. */
export const CARE_REALITY_CAUSAL_THEATER = [
  /\b(?:the |this )?medication caused\b/i,
  /\bthe fall caused\b/i,
  /\bthis means (?:dementia|alzheimer).*(?:worsening|progressing)\b/i,
] as const;

/** Vague time language that ages poorly — prefer concrete when held. */
export const CARE_REALITY_VAGUE_TIME_WARNINGS = [
  /\brecently\b/i,
  /\ba while ago\b/i,
  /\bearlier\b/i,
] as const;

/** Response must earn trust — at least one. */
export const CARE_REALITY_RESPONSE_VALUE = [
  "understand",
  "organize",
  "clarify",
  "prepare",
] as const;

/** Primary orientation distinctions (cognitive load). */
export const CARE_REALITY_ATTENTION_LANES = [
  "what_matters_now",
  "what_can_wait",
  "what_should_be_monitored",
] as const;

/** Modules that already implement principle intent (wiring map). */
export const CARE_REALITY_PRINCIPLE_MODULES = {
  did_this_change_care_reality: [
    "src/lib/care-reality-intelligence/baseline-comparison-engine.ts",
    "src/lib/mvp-response-behavior",
  ],
  preserve_uncertainty: [
    "src/lib/care-reality-intelligence/uncertainty-preservation.ts",
  ],
  never_overwrite_history: [
    "src/lib/care-reality-intelligence/care-reality-memory.ts",
    "src/lib/active-care-situation",
  ],
  understanding_must_be_explainable: [
    "src/lib/response-behavior",
    "docs/02-product/solenos-evidence-visibility-directive.md",
  ],
  separate_observations_from_conclusions: [
    "src/lib/care-reality-output",
    "src/lib/care-epistemics",
  ],
  confidence_on_understanding_engine_only: [
    "src/lib/care-reality-intelligence/situation-model.ts",
  ],
  event_lifecycle: ["src/lib/active-care-situation", "src/lib/situation-relationship-engine"],
  avoid_chatbot_personality: [
    "src/lib/response-acceptance-gate",
    "src/lib/caregiver-response-composer",
  ],
  timeline_is_the_product: [
    "src/lib/living-care-record-ux",
    "src/lib/care-reality-state",
  ],
  questions_only_reduce_uncertainty: [
    "src/lib/progressive-understanding/questions.ts",
  ],
  new_vs_existing_care_record: [
    "src/lib/care-memory-maturity",
    "src/lib/mvp-response-behavior",
  ],
} as const;

export function containsChatbotPersonality(blob: string): boolean {
  return CARE_REALITY_CHATBOT_BANS.some((p) => p.test(blob));
}

export function containsCausalTheater(blob: string): boolean {
  return CARE_REALITY_CAUSAL_THEATER.some((p) => p.test(blob));
}

/** Feature gate question — reject if answer is no. */
export const CARE_REALITY_FEATURE_FILTER =
  "Does this improve the Care Reality Engine's understanding of the person's care reality over time?";

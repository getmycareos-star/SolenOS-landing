import type { EMOTIONAL_OUTCOMES, PRODUCT_PRINCIPLES } from "./contract-constants";

export type ProductPrinciple = (typeof PRODUCT_PRINCIPLES)[number];

export type EmotionalOutcome = (typeof EMOTIONAL_OUTCOMES)[number];

export type BehavioralIndicator = {
  id: string;
  label: string;
  present: boolean;
  evidence: string;
};

export type NorthStarExperienceResult = {
  /** Always active — philosophy layer evaluates every meaningful interaction. */
  active: boolean;
  north_star_feeling: string;
  continuity_recognition: string | null;
  emotional_outcomes_targeted: EmotionalOutcome[];
  principles_upheld: ProductPrinciple[];
  principles_gaps: ProductPrinciple[];
  anti_patterns_detected: string[];
  experience_test_passed: boolean;
  experience_score: number;
  behavioral_indicators: BehavioralIndicator[];
  is_return_session: boolean;
  related_prior_event_ids: string[];
  continuity_voice_enabled: boolean;
  defining_principle: string;
  experience_test_question: string;
  decision_trace: string[];
};

export type ProcessNorthStarExperienceInput = {
  caregiver_id: string;
  raw_input: string;
  is_first_situation: boolean;
  events_created: import("../situation-entry/types").CanonicalCareEvent[];
  all_events: import("../situation-entry/types").CanonicalCareEvent[];
  prior_event_count: number;
  what_changed: string[];
  what_i_understood: import("../situation-entry/types").UnderstoodItem[];
  what_is_uncertain: string[];
  what_needs_clarification: string[];
  has_decision_trace: boolean;
  has_confidence_surface: boolean;
};

export type ExperienceGateInput = {
  feature_name: string;
  strengthens_continuity: boolean;
  reduces_cognitive_burden: boolean;
  makes_caregiver_feel_understood: boolean;
  requires_repetition: boolean;
  ignores_prior_context: boolean;
  increases_screen_time: boolean;
};

export type ExperienceGateResult = {
  passes: boolean;
  experience_test_question: string;
  reasons: string[];
  recommendation: "build" | "redesign" | "remove";
};

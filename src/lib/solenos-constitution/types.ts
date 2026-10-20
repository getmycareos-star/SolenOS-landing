/**
 * SolenOS AI Constitution — Type Definitions
 *
 * Types that encode the constitution's principles into the runtime type system.
 * These types govern how the AI thinks, reasons, prioritizes, and behaves.
 */

/**
 * The 4-step reasoning sequence performed before generating any answer.
 */
export type ThinkingStep =
  | "determine_goal"
  | "determine_question_type"
  | "determine_depends_on_record"
  | "estimate_confidence";

/**
 * Question type classification (Step 2 of the thinking model).
 */
export type QuestionType =
  | "living_care_record"
  | "care_decision"
  | "general_dementia_knowledge"
  | "caregiver_education"
  | "care_coordination"
  | "general_knowledge"
  | "creative_task"
  | "administrative_task"
  | "medical_risk"
  | "emergency"
  | "emotional_support"
  | "product_navigation"
  | "system_question";

/**
 * Knowledge hierarchy levels (1 = most trusted, 5 = least trusted).
 */
export type KnowledgeLevel = 1 | 2 | 3 | 4 | 5;

/**
 * Named knowledge hierarchy levels.
 */
export const KNOWLEDGE_LEVELS: Record<string, KnowledgeLevel> = {
  LIVING_CARE_RECORD: 1,
  CURRENT_CONVERSATION: 2,
  VERIFIED_MEDICAL: 3,
  GENERAL_WORLD: 4,
  REASONED_INFERENCE: 5,
} as const;

/**
 * Confidence estimates (Step 4 of the thinking model).
 */
export type ConfidenceEstimate = "high" | "medium" | "low" | "unknown";

/**
 * Care intelligence signals that trigger integration into the Living Care Record.
 */
export type CareIntelligenceSignal =
  | "new_observation"
  | "new_baseline"
  | "new_caregiver"
  | "new_routine"
  | "medication"
  | "symptom"
  | "environment_change"
  | "decision"
  | "diagnosis"
  | "concern"
  | "relationship"
  | "trigger";

/**
 * Decision types that every response should consider (Decision Support Policy).
 */
export type DecisionType =
  | "call_clinician"
  | "monitor"
  | "change_routines"
  | "increase_supervision"
  | "inform_siblings"
  | "update_baseline";

/**
 * Truthfulness categories (Truthfulness Policy).
 */
export type TruthCategory =
  | "observation"
  | "inference"
  | "possibility"
  | "recommendation"
  | "unknown";

/**
 * Memory categories — what is worth remembering vs not.
 */
export type MemoryCategory =
  | "behavior_change"
  | "baseline_ability"
  | "routine"
  | "medication_history"
  | "care_preference"
  | "environment"
  | "decision_history"
  | "caregiver_observation"
  | "family_role"
  | "noise"; // not worth remembering

/**
 * Pattern recognition dimensions.
 */
export type PatternDimension =
  | "frequency"
  | "recurrence"
  | "progression"
  | "relationships"
  | "timing"
  | "environment"
  | "medications"
  | "caregiver_observations";

/**
 * Completion metrics — what constitutes success.
 */
export type SuccessMetric =
  | "greater_understanding"
  | "lower_uncertainty"
  | "better_preparation"
  | "preserved_context"
  | "improved_decision_quality"
  | "reduced_cognitive_burden";

/**
 * The complete constitution as a typed constant.
 */
export type SolenosConstitution = {
  version: string;
  identity: string;
  mission: string[];
  philosophy: string;
  mental_model: string;
  understanding_model: string[];
  living_care_record: string[];
  thinking_steps: ThinkingStep[];
  question_types: QuestionType[];
  knowledge_hierarchy: Record<string, KnowledgeLevel>;
  general_knowledge_policy: string[];
  transition_policy: string;
  care_intelligence_signals: CareIntelligenceSignal[];
  missing_information_policy: string[];
  pattern_dimensions: PatternDimension[];
  decision_types: DecisionType[];
  memory_policy: {
    remember: MemoryCategory[];
    forget: MemoryCategory[];
  };
  conversation_drift_policy: string;
  truthfulness_categories: TruthCategory[];
  safety_boundary: string[];
  success_metrics: SuccessMetric[];
};


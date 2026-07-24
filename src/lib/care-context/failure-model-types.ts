/**
 * Failure-first taxonomy — caregiver questions are symptoms of system failures.
 * Classify failures BEFORE thinking about features.
 */
export type CaregiverFailureCategory =
  | "invisible_progression"
  | "no_objective_view"
  | "memory_reconstruction_failure"
  | "decision_without_context"
  | "no_context_for_change"
  | "caregiver_cognitive_overload"
  | "low_trust"
  | "fragmented_observations"
  | "contradictory_reports"
  | "missing_information"
  | "decision_overload"
  | "returning_after_absence"
  | "information_not_eliminable_by_continuity";

export interface FailureDefinition {
  category: CaregiverFailureCategory;
  label: string;
  description: string;
  /** Engines that eliminate or reduce this failure. */
  engines: SolenOSEngine[];
  /** Can continuity eliminate this failure? If false → educational content only. */
  continuityCanEliminate: boolean;
}

/** SolenOS engines — each must tie to a real caregiver failure or it is not MVP. */
export type SolenOSEngine =
  | "timeline_reconstruction"
  | "diff_engine"
  | "care_context"
  | "contradiction_detection"
  | "clarification_engine"
  | "prioritization_engine"
  | "attention_budget"
  | "care_transparency_panel"
  | "return_value_loop"
  | "caregiver_load_engine"
  | "state_of_care"
  | "pattern_learning_engine"
  | "trust_layer"
  | "confidence_layer"
  | "uncertainty_layer"
  | "clinical_summary_generator"
  | "visit_summaries"
  | "clinician_reports"
  | "clinician_reports"
  | "immutable_care_events"
  // Legacy aliases
  | "timeline_engine"
  | "risk_engine"
  | "confidence_system";

export type ContinuityFailureType =
  | "no_maintained_memory"
  | "disconnected_events"
  | "missing_progression_view"
  | "missing_prioritization"
  | "missing_confidence_model"
  | "missing_clinical_summary"
  | "fragmented_timeline";

export interface FailureFirstMapping {
  /** Example question — symptom, not the product target. */
  exampleQuestion: string;
  questionPatterns: RegExp[];
  /** What actually failed in the care system. */
  failureCategory: CaregiverFailureCategory;
  failureLabel: string;
  /** Product response — engines/surfaces, not answers. */
  productResponse: SolenOSEngine[];
  /** What this question is NOT about (reframe). */
  notAbout: string;
  continuityCanEliminate: boolean;
}

export interface QuestionCapabilityMapping {
  questionPatterns: RegExp[];
  label: string;
  missingCapabilities: SolenOSEngine[];
  buildNotAnswer: string;
  continuityFailure: ContinuityFailureType;
  continuityFailureDescription: string;
  failureCategory: CaregiverFailureCategory;
}

export interface FailureFirstDiagnosis {
  question: string;
  /** Reframed: what the question is really about. */
  notAbout: string;
  /** The system failure that caused this question. */
  failureCategory: CaregiverFailureCategory;
  failureLabel: string;
  failureDescription: string;
  /** Engines that eliminate this failure. */
  productResponse: SolenOSEngine[];
  /** Can continuity eliminate this? If no → content, not core product. */
  continuityCanEliminate: boolean;
  productScope: "core" | "educational_content";
  doNotBuild: string;
  impliedMissingContext: string[];
  canSurfaceProactively: boolean;
  /** What caregiver sees instead of asking. */
  openingSurface: OpeningSurface;
}

/** What caregivers see when they open SolenOS — questions disappear. */
export interface OpeningSurface {
  whatChanged: string[];
  whatIsStable: string[];
  whatNeedsAttention: string[];
  whatIsUncertain: string[];
  whatShouldHappenNext: string[];
}

export interface QuestionFailureDiagnosis {
  question: string;
  continuityFailure: string;
  continuityFailureType: ContinuityFailureType;
  failureCategory: CaregiverFailureCategory;
  missingCapabilities: SolenOSEngine[];
  doNotBuild: string;
  buildInstead: string;
  impliedMissingContext: string[];
  canSurfaceProactively: boolean;
  proactiveOutputs: string[];
  productScope: "core" | "educational_content";
}

export interface ProactiveSurfaceItem {
  preventsQuestion: string;
  engine: SolenOSEngine;
  output: string;
  evidence: string[];
}

export interface ProactiveSurfacePlan {
  items: ProactiveSurfaceItem[];
  idealExperience: string;
  openingSurface: OpeningSurface;
}

export interface FeatureEvaluation {
  featureName: string;
  failureSolved: CaregiverFailureCategory | null;
  reducesUncertainty: boolean;
  reducesCognitiveLoad: boolean;
  reducesReconstruction: boolean;
  reducesQuestions: boolean;
  inCoreMission: boolean;
  verdict: "build" | "defer" | "reject";
  reason: string;
}

export interface SuccessMetricsSnapshot {
  repeatedQuestionCount: number;
  openUncertaintyCount: number;
  timelineGapCount: number;
  proactiveCoveragePercent: number;
  reconstructionBurden: "high" | "moderate" | "low";
  assessedAt: string;
}

export const CONTINUITY_GAP = {
  currentCaregiving: [
    "Observation",
    "Memory",
    "Forgetting",
    "Reconstruction",
    "Decision",
  ],
  solenos: [
    "Observation",
    "CareEvent",
    "CareContext",
    "State of Care",
    "Decision",
  ],
} as const;

export const PRODUCT_INVARIANT =
  "Caregiver questions are not the product. They are symptoms of failures in continuity, memory, coordination, progression awareness, or decision-making.";

export const IDEAL_EXPERIENCE =
  "I already understand what's happening because the system has maintained continuity for me.";

export const FAILURE_FIRST_RULE =
  "What failed that caused this question to exist? If continuity can eliminate that failure, build that capability.";

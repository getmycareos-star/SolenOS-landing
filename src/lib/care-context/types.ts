import type { CareEventType } from "../care-snapshot/types";
import type { OutcomeMeasurementResult } from "../oml/types";

/** Longitudinal understanding of a family's care journey. */
export interface CareContext {
  identity?: {
    patientName?: string;
    contextLabel?: string;
  };
  timeline: ContextCareEvent[];
  recentChanges: ChangeRecord[];
  uncertainties: string[];
  prioritizedActions: PrioritizedAction[];
  /** Cached engine outputs — recomputed on context update. */
  stateOfCare?: StateOfCare;
  caregiverLoad?: CaregiverLoadAssessment;
  patterns?: PatternObservation[];
  updatedAt: string;
  /** Outcome Measurement Layer — emitted on every context update. */
  oml?: OutcomeMeasurementResult;
}

export interface ContextCareEvent {
  id: string;
  date: string | null;
  dateLabel: string;
  description: string;
  type: CareEventType;
  source: "note" | "question" | "observation";
  recordedAt: string;
}

export interface ChangeRecord {
  description: string;
  detectedAt: string;
  category: ChangeCategory;
  /** Event IDs or descriptions supporting this change. */
  evidence: string[];
}

export type ChangeCategory =
  | "progression"
  | "new_symptom"
  | "behavior_change"
  | "care_level"
  | "medication"
  | "mobility"
  | "nighttime_event"
  | "crisis"
  | "caregiver_burden"
  | "other";

export interface PrioritizedAction {
  action: string;
  urgency: "now" | "soon" | "when_possible";
  reason: string;
  trust?: TrustExplanation;
}

export type SignalTheme =
  | "financial_uncertainty"
  | "care_coordination"
  | "disease_progression"
  | "emotional_burden"
  | "decision_making";

export type DemandType = "continuity" | "search" | "mixed";

export type EngineAction =
  | "create_care_events"
  | "update_timeline"
  | "compare_historical_context"
  | "detect_progression"
  | "compute_changes"
  | "highlight_uncertainty"
  | "prioritize_next_actions"
  | "recommend_professional_consultation"
  | "preserve_longitudinal_journey";

export interface QuestionInterpretation {
  rawQuestion: string;
  demandType: DemandType;
  signalThemes: SignalTheme[];
  proposedEvents: Omit<ContextCareEvent, "id" | "recordedAt">[];
  engineActions: EngineAction[];
  uncertainties: string[];
  continuityFraming: string;
}

export interface ContinuityAssessment {
  whatChanged: string[];
  whatMattersNow: string[];
  whatCanWait: string[];
  whatRemainsUncertain: string[];
  whatShouldHappenNext: PrioritizedAction[];
}

/** Trajectory of the care situation — not a diagnosis. */
export interface StateOfCare {
  trajectory: "improving" | "stable" | "deteriorating" | "insufficient_data";
  summary: string;
  evidenceFor: string[];
  evidenceAgainst: string[];
  assessedAt: string;
}

/** Diff Engine output — answers "What has changed?" */
export interface DiffResult {
  changes: ChangeRecord[];
  summary: string[];
  /** Highest-value caregiver question answered proactively. */
  headline: string;
  computedAt: string;
}

/** Caregiver Load Engine output. */
export interface CaregiverLoadAssessment {
  level: "low" | "moderate" | "high" | "critical";
  score: number;
  factors: LoadFactor[];
  assessedAt: string;
}

export interface LoadFactor {
  factor: string;
  weight: number;
  evidence: string[];
}

/** Clarification that explicitly reduces uncertainty — never data collection for its own sake. */
export interface ClarificationRequest {
  question: string;
  /** Which uncertainty this clarification resolves. */
  reducesUncertainty: string;
  /** What becomes possible after clarification. */
  enables: string;
  priority: "blocking" | "helpful" | "optional";
}

export interface TrustExplanation {
  whyThisRecommendation: string;
  supportingEvidence: string[];
  missingInformation: string[];
  informationRecency: string;
  confidenceLevel: ConfidenceLevel;
  confidenceReason: string;
}

export type ConfidenceLevel = "low" | "moderate" | "appropriate" | "high";

/** Pattern without causation claims. */
export interface PatternObservation {
  pattern: string;
  occurrences: number;
  firstSeen: string | null;
  lastSeen: string | null;
  relatedEvents: string[];
  /** Explicit: correlation, not causation. */
  disclaimer: string;
}

/** Full reasoning output for a decision question — NOT an immediate answer. */
export interface ContextReasoning {
  question: string;
  /** Checks performed against CareContext before any guidance. */
  contextChecks: ContextCheck[];
  diff: DiffResult;
  stateOfCare: StateOfCare;
  caregiverLoad: CaregiverLoadAssessment;
  clarificationsNeeded: ClarificationRequest[];
  guidance: PrioritizedAction[];
  patterns: PatternObservation[];
  /** Explicit: this is continuity-based reasoning, not an isolated answer. */
  reasoningNote: string;
}

export interface ContextCheck {
  dimension: ContextCheckDimension;
  finding: "increased" | "decreased" | "unchanged" | "unknown" | "not_observed";
  evidence: string[];
}

export type ContextCheckDimension =
  | "caregiver_burden"
  | "mobility"
  | "nighttime_events"
  | "supervision_demand"
  | "wandering_frequency"
  | "medication_changes"
  | "uncertainty_level"
  | "crisis_frequency";

export interface ContentTopic {
  id: string;
  title: string;
  priority: "highest" | "high" | "medium";
  signalThemes: SignalTheme[];
  continuityHook: string;
  demandType: DemandType;
  /** Content educates first; SolenOS is the logical extension. */
  educatesFirst: boolean;
}

export type CaregiverJob =
  | "reduce_decision_fatigue"
  | "reduce_cognitive_load"
  | "make_progression_visible"
  | "increase_decision_confidence"
  | "prepare_for_conversations";

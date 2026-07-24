import type { ExplicitUnknownsProjection } from "../unknowns-engine";
import type { CaregiverFailureCategory } from "./failure-map";
import type { SourceReliability } from "./source-reliability";
import type { LearningWeightUpdate, StoredInference } from "./inference-learning";
import type { OutcomeMeasurementResult } from "../oml/types";
import type { PresentedContinuityView } from "../presentation-engine";
import type { EvidencedConclusion } from "../evidence-preservation";
import type { CareEventPrivacyMeta } from "../privacy-institutional-contracts";

export type ContinuityPropertiesResult = {
  active: true;
  one_system: true;
  source_reliability_on_events: Array<{
    event_id: string;
    source_reliability: SourceReliability;
  }>;
  privacy_on_events: Array<{
    event_id: string;
    privacy: CareEventPrivacyMeta;
  }>;
  explicit_unknowns: ExplicitUnknownsProjection;
  outcome_measurement: OutcomeMeasurementResult | null;
  failure_signals: {
    failures: CaregiverFailureCategory[];
    build_engines: string[];
    continuity_product: boolean;
    content_only: boolean;
  } | null;
  recorded_inferences: StoredInference[];
  learning_updates: LearningWeightUpdate[];
  presentation: PresentedContinuityView;
  evidence_conclusion: EvidencedConclusion | null;
  clinical_profile_id: string;
  invariants: {
    questions_are_symptoms: true;
    reliability_is_not_confidence: true;
    unknowns_are_structured: true;
    feedback_must_be_explicit: true;
    measure_uncertainty_reduction: true;
    presentation_does_not_mutate_truth: true;
    institutions_are_projections_only: true;
    dementia_is_profile_not_architecture: true;
  };
  defining_principle: string;
};

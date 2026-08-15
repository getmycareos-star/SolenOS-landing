import type { EXTRACTED_TYPES, TRACKING_DIMENSIONS } from "./contract-constants";
import type { EventTime } from "../time-model/types";
import type {
  CareEventIntegrity,
  CareEventLifecycleStatus,
} from "../care-event-integrity/types";

export type ExtractedType = (typeof EXTRACTED_TYPES)[number];
export type TrackingDimension = (typeof TRACKING_DIMENSIONS)[number];

export type CareEventEntity = {
  kind: "person" | "place" | "institution" | "object";
  label: string;
};

/** Canonical CareEvent — primary object in SolenOS. */
export type CanonicalCareEvent = {
  id: string;
  /** Temporal sort key — derived from event_time.start or ingestion_time fallback */
  timestamp: string;
  event_time: EventTime;
  /** Immutable — when system received this input */
  ingestion_time: string;
  raw_input: string;
  extracted_type: ExtractedType;
  entities: CareEventEntity[];
  attributes: Record<string, string | string[] | boolean | null>;
  uncertainty: string[];
  source: "user_input" | "document";
  /**
   * Situation-scoped root CareEvent id — soft updates share the same root.
   * Distinct from CareContextRoot.root_event_id (session-first event).
   */
  root_event_id: string | null;
  /**
   * Active Care Situation id on the durable spine.
   * Soft updates (updates_active / adds_context / answers_uncertainty) share one situation_id.
   */
  situation_id: string | null;
  document_id: string | null;
  /** Lifecycle: committed | provisional | unparsed_raw | invalidated | superseded */
  status: CareEventLifecycleStatus;
  /** Trust metadata — field confidence, audit trail, supersession chain */
  integrity: CareEventIntegrity;
  /** Deterministic priority ranking — recomputed on ingest, edit, dependency change */
  priority: import("../care-event-priority/types").CareEventPriority;
  /** Multi-source attribution — mandatory for longitudinal integrity */
  source_attribution?: import("../multi-caregiver-context-model/types").CareEventSourceAttribution;
  /**
   * Source Reliability Layer (SRL) — input truth quality.
   * Independent from system confidence (calibration layer).
   */
  source_reliability?: import("../continuity-properties/source-reliability").SourceReliability;
  /**
   * Privacy / institutional readiness metadata — does NOT change CareContext truth.
   * Roles affect visibility/presentation only.
   */
  privacy?: import("../privacy-institutional-contracts").CareEventPrivacyMeta;
};

export type CareContextRoot = {
  id: "CareContextRoot";
  /** Primary scope — care recipient, not single caregiver */
  care_recipient_id: string;
  /** Contributing caregiver for this session (one of many) */
  caregiver_id: string;
  events: CanonicalCareEvent[];
  root_event_id: string | null;
  created_at: string;
  updated_at: string;
  multi_caregiver: import("../multi-caregiver-context-model/types").MultiCaregiverCareContext;
};

export type UnderstoodItem = {
  label: string;
  extracted_type: ExtractedType;
  event_id: string;
};

export type SituationResponse = {
  what_i_understood: UnderstoodItem[];
  what_is_uncertain: string[];
  what_needs_clarification: string[];
  what_will_be_tracked: TrackingDimension[];
  what_changed: string[];
  what_merged_or_split: string[];
  events_created: CanonicalCareEvent[];
  context: CareContextRoot;
  is_first_situation: boolean;
  document_events_count: number;
  dare: SituationDareSummary | null;
  timeline_views: {
    temporal_order: string[];
    ingestion_order: string[];
  } | null;
  integrity_summary: {
    provisional_in_graph: number;
    unparsed_in_graph: number;
    invalidated: number;
    superseded: number;
  } | null;
  priority_layer: {
    top_events: string[];
    attention_events: string[];
    hidden_count: number;
  } | null;
  memory_layer: {
    active_episode_id: string | null;
    episode_count: number;
    long_term_summary_count: number;
    total_raw_events: number;
    retrieval_order: string[];
    context_window_chars: number;
  } | null;
  failure_resilience_layer: {
    failures: import("../failure-resilience/types").FailureRecord[];
    confidence_summaries: import("../failure-resilience/types").ExtractionConfidence[];
    pending_processing: import("../failure-resilience/types").PendingProcessing[];
    outcomes_applied: Record<
      import("../failure-resilience/types").FailureOutcome,
      number
    >;
    processing_status: import("../failure-resilience/types").ProcessingStatus;
    recovery_actions: string[];
    continuity_preserved: boolean;
  } | null;
  trust_provenance_layer: {
    provenance_records: import("../trust-provenance/types").ProvenanceRecord[];
    trust_indicators: import("../trust-provenance/types").TrustIndicator[];
    audit_trail_summary: import("../trust-provenance/types").AuditTrailSummary[];
    evidence_bundles: import("../trust-provenance/types").EvidenceBundle[];
    reasoning_chains: import("../trust-provenance/types").ReasoningChain[];
    confidence_assessment: import("../trust-provenance/types").ResponseConfidenceAssessment;
    retrieval_context: import("../trust-provenance/types").RetrievalContextSnapshot;
    generation_boundaries: import("../trust-provenance/types").GenerationBoundaries;
    insufficient_evidence_message: string;
  } | null;
  network_effect_moat_layer: {
    interaction_outcomes: import("../network-effect-moat/types").InteractionOutcome[];
    enrichment_actions: import("../network-effect-moat/types").EnrichmentAction[];
    entity_matches: import("../network-effect-moat/types").EntityMatch[];
    event_matches: import("../network-effect-moat/types").EventMatch[];
    resolved_uncertainties: import("../network-effect-moat/types").ResolvedUncertainty[];
    new_relationships: number;
    compounding_metrics: import("../network-effect-moat/types").CompoundingMetrics;
    moat_strength: import("../network-effect-moat/types").MoatStrength;
    maturity_stage: import("../network-effect-moat/types").MaturityStage;
    maturity_message: string;
    context_grew: boolean;
    isolated_records: number;
  } | null;
  success_model_layer: {
    primary: import("../success-model/types").PrimarySuccessScores;
    system_quality: import("../success-model/types").SystemQualityScores;
    user_trust: import("../success-model/types").UserTrustScores;
    longitudinal: import("../success-model/types").LongitudinalScores;
    overall_success_score: number;
    overall_level: "strong" | "moderate" | "weak" | "insufficient";
    outcome_summary: string;
    recall_probes: import("../success-model/types").RecallProbe[];
    activity_metrics_excluded: string[];
  } | null;
  final_output: import("../final-output-contract/types").FinalOutputContract;
  mvp_surface_area_layer: import("../mvp-surface-area/types").MvpSurfaceAreaLayer;
  continuous_execution_loop_layer: import("../continuous-execution-loop/types").ContinuousExecutionLoopLayer;
  behavior_interpretation_layer: import("../behavior-interpretation-engine/types").BehaviorInterpretationResult;
  continuity_decay_layer: import("../continuity-decay-engine/types").ContinuityDecayResult;
  north_star_experience_layer: import("../north-star-experience/types").NorthStarExperienceResult;
  clarification_engine_layer?: import("../clarification-engine/types").ClarificationEngineResult;
  memory_strategy_layer?: import("../memory-strategy-engine/types").MemoryStrategyResult;
  trust_layer_engine_layer?: import("../trust-layer-engine/types").TrustLayerEngineResult;
  crisis_mode_interaction_layer?: import("../crisis-mode-interaction-layer/types").CrisisModeInteractionResult;
  multi_caregiver_context_layer?: import("../multi-caregiver-context-model/types").MultiCaregiverContextResult;
  audit_trail_layer?: import("../audit-trail-system/types").AuditTrailResult;
  state_of_care_summary_layer?: import("../state-of-care-summary-engine/types").StateOfCareSummaryResult;
  care_context_diff_layer?: import("../care-context-diff-engine/types").CareContextDiffResult;
  entry_behavior_layer?: import("../entry-behavior-protocol/types").EntryBehaviorResult;
  care_timeline_engine_layer?: import("../care-timeline-engine/types").CareTimelineEngineResult;
  task_extraction_layer?: import("../task-extraction-engine/types").TaskExtractionResult;
  current_state_view_layer?: import("../current-state-view-engine/types").CurrentStateViewResult;
  adoption_wedge_layer?: import("../adoption-wedge-engine/types").AdoptionWedgeResult;
  product_reality_model_layer?: import("../product-reality-model/types").ProductRealityModelResult;
  forbidden_build_zone_layer?: import("../forbidden-build-zone/types").ForbiddenBuildZoneResult;
  policy_engine_layer?: import("../policy-engine/types").PolicyEngineResult;
  timeline_reconstruction_layer?: import("../timeline-reconstruction-engine/types").TimelineReconstructionResult;
  contradiction_detection_layer?: import("../contradiction-detection-engine/types").ContradictionDetectionResult;
  care_transparency_layer?: import("../care-transparency-layer/types").CareTransparencyResult;
  baseline_intelligence_layer?: import("../baseline-intelligence-engine/types").BaselineIntelligenceResult;
  care_state_change_report?: import("../care-state-change-detector").CareStateChangeReport;
  input_relevance_layer?: import("../input-relevance").InputRelevanceClassification;
  care_reality_profile_layer?: import("../care-reality-profile-engine/types").CareRealityProfileResult;
  moment_of_need_layer?: import("../moment-of-need-engine/types").MomentOfNeedResult;
  retention_engine_layer?: import("../retention-engine/types").RetentionEngineResult;
  priority_resolution_layer?: import("../priority-resolution-system/types").PriorityResolutionResult;
  edge_state_layer?: import("../edge-state-machine/types").EdgeStateResult;
  event_sourced_storage_layer?: import("../event-sourced-storage/types").EventSourcedStorageResult;
  engine_execution_contract_layer?: import("../engine-execution-contract/types").EngineExecutionContractResult;
  confidence_calibration_layer?: import("../confidence-calibration-system/types").ConfidenceCalibrationResult;
  care_state_engine_layer?: import("../care-state-engine/types").CareStateEngineResult;
  single_user_journey_layer?: import("../single-user-journey/types").SingleUserJourneyResult;
  product_north_star_layer?: import("../product-north-star/types").ProductNorthStarResult;
  product_constitution_layer?: import("../product-constitution/types").ProductConstitutionResult;
  /** Vertical Continuity properties (SRL/EUM/OML/FDLL/failure-map) — not a separate product. */
  continuity_properties_layer?: import("../continuity-properties/types").ContinuityPropertiesResult;
  /** Care Reality Intelligence facade — composes baseline, profile, state, continuity (not a new pillar). */
  care_reality_intelligence_layer?: import("../care-reality-intelligence/types").CareRealityIntelligenceResult;
  /** Care Reality Engine Foundation — Phases 1–13 enrichment on the live Care Reality path. */
  care_reality_engine_layer?: import("../care-reality-engine").CareRealityEngineFoundationResult;
  /** Care Signal Understanding — input→signals→care state→priority→unknowns (never task lists). */
  care_signal_understanding_layer?: import("../care-signal-understanding").CareSignalUnderstandingResult;
/** Generalized care understanding — 10 rules; Observed/Derived/Unknown; open loops. */
  generalized_care_understanding_layer?: import("../generalized-care-understanding").GeneralizedCareUnderstandingResult;

  /**
   * Care Identity summary — lifecycle state, session count, active care recipient.
   * Enables the pipeline to distinguish new caregivers from returning ones.
   */
  care_identity_summary?: import("../care-identity").CareIdentitySummary;
  /**
   * Continuity decision — how this input relates to prior care reality.
   * Used by the response composer to branch: new user orientation vs returning continuity.
   */
  continuity_decision?: import("../care-identity").ContinuityDecision;

  /**
   * Server-composed caregiver response — moves understanding to the server path.
   * Client uses this as primary source; falls back to client composition offline.
   */
  composed_response?: import("../caregiver-response-composer").ComposedCaregiverResponse;
  /**
   * Durable care key (= caregiver_id / care_session_id). Used for TrackedSituation + sidebar.
   */
  care_key?: string;
  /** Resolution Active Situations upserted from this MVP write. */
  resolution_engine_layer?: import("../resolution-engine/types").ResolutionEngineLayerPayload;
  /** UI-shaped active situations for sidebar hydration (from TrackedSituation). */
  active_situations?: import("../ui-runtime/types").ActiveSituation[];
  /** Full UI Situation objects for sidebar runtime sync. */
  ui_situations?: import("../ui-runtime/types").Situation[];
  /**
   * Active Care Situation (continuity spine) — server Map keyed by durable care key.
   * Distinct from resolution `active_situations` (TrackedSituation sidebar).
   */
  active_care_situation?: import("../active-care-situation").ActiveCareSituation | null;
  /** Caregiver turn projected from ACS after pipeline ingest. */
  active_care_situation_turn?: import("../active-care-situation").ActiveSituationTurn | null;
  /** CareContext events grouped by durable situation_id (soft updates share a group). */
  care_situation_groups?: {
    situation_id: string;
    root_event_id: string | null;
    event_ids: string[];
  }[];
  architectural_boundaries_layer?: import("../architectural-boundaries/types").ArchitecturalBoundariesResult;
};

export type ProcessSituationInput = {
  raw_input: string;
  caregiver_id?: string;
  /**
   * Acting contributor on a shared Care Reality (Locked B).
   * Defaults to caregiver_id when omitted.
   */
  contributor_id?: string;
  /**
   * Join / target Care Reality (care recipient). When set, links the contributor
   * to this shared Living Care Record.
   */
  care_recipient_id?: string;
  /** Alias of durable care key — MVP binds this to caregiver_id. */
  care_session_id?: string;
  source?: "user_input" | "document";
  timestamp?: string;
  provenance?: import("../care-events/types").InputProvenance;
  documents?: {
    id: string;
    name: string;
    extracted_text: string;
    mime_type?: string | null;
    ocr_confidence?: number | null;
    extraction_source?: string | null;
  }[];
};

export type SituationDareSummary = {
  provisional_count: number;
  uncertain_events: import("../data-acquisition-resilience/types").UncertainEventCandidate[];
  unreadable_sections: import("../data-acquisition-resilience/types").DocumentUnreadableSection[];
  disambiguation_questions: import("../data-acquisition-resilience/types").DisambiguationQuestion[];
  conflicts: import("../data-acquisition-resilience/types").ConflictingEventSet[];
  candidates_count: number;
  validated_count: number;
  normalization_actions: import("../event-normalization/types").NormalizationAction[];
  could_not_process: boolean;
};

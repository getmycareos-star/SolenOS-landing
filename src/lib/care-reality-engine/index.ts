/**
 * Care Reality Engine Foundation — integrated MVP spine.
 * SoT: docs/02-product/solenos-care-reality-engine-foundation.md
 */

export {
  CARE_REALITY_ENGINE_PURPOSE,
  CARE_REALITY_ENGINE_NOT,
  CARE_REALITY_ENGINE_PHASES,
  CARE_REALITY_ORIENTATION_QUESTIONS,
  MVP_EXCLUSIONS,
  EVIDENCE_PIPELINE,
  CARE_REALITY_ENGINE_MOAT_TEST,
  type CareRealityEnginePhase,
} from "./phases";

export {
  resolveIdentityAttribution,
  noteMentionsUnboundKinshipLabel,
  ensureCareRecipientNamed,
  type CareRecipientRecord,
  type ContributorRecord,
  type IdentityAttributionResult,
} from "./identity-attribution";

export {
  BASELINE_PROFILE_DOMAINS,
  getBaselineProfile,
  upsertBaselineProfileEntry,
  syncBaselineFromIntelligenceFacts,
  resetBaselineProfileStore,
  type BaselineProfile,
  type BaselineProfileDomain,
  type BaselineProfileEntry,
} from "./baseline-profile";

export {
  emptyCoreBundle,
  type CareRealityEvent,
  type CareRealityObservation,
  type CareRealityDecision,
  type CareRealityAction,
  type CareRealityOutcome,
  type CareRealityUnknown,
  type CareRealityCoreBundle,
} from "./core-objects";

export {
  CHANGE_KINDS,
  detectChangesFromComparison,
  type ChangeKind,
  type DetectedChange,
  type ChangeDetectionResult,
} from "./change-detection";

export {
  preserveBehavioralObservation,
  assertNoDiagnosisInObservation,
  type BehavioralObservationRecord,
} from "./behavioral-observation";

export {
  EVIDENCE_PRIORITY,
  rankEvidenceSource,
  resolveEvidenceOrientation,
  type EvidencePriorityLevel,
} from "./evidence-priority";

export {
  adaptForCaregiverCapacity,
  type CapacityAdaptation,
} from "./capacity-adaptation";

export {
  CARE_TRANSITION_KINDS,
  detectCareTransitions,
  type CareTransitionKind,
  type CareTransitionDetection,
} from "./care-transition";

export {
  SAFETY_BOUNDARY_HIGH_RISK_FRAMING,
  SAFETY_BOUNDARY_BANS,
  applySafetyBoundaryToOutput,
  containsSafetyBoundaryViolation,
  type SafetyBoundaryResult,
} from "./safety-boundary";

export {
  recordMemoryCorrection,
  listMemoryCorrections,
  resetMemoryCorrectionStore,
  type MemoryCorrectionRecord,
} from "./memory-correction";

export {
  looksLikeExplicitMemoryCorrection,
  findCorrectionTargetObservation,
  extractCorrectedClaimFromCorrection,
  negatedContentTokensFromCorrection,
} from "./detect-memory-correction";

export {
  validateCaregiverOrientation,
  type OrientationValidation,
} from "./orientation-validation";

export {
  processCareRealityEngineFoundation,
  type ProcessCareRealityEngineInput,
  type CareRealityEngineFoundationResult,
} from "./process";

export {
  CRE_BEHAVIOR_EXAMPLES_PURPOSE,
  CRE_FORBIDDEN_SCENARIO_DETECTORS,
  CRE_BEHAVIOR_EXAMPLES,
  CRE_BEHAVIOR_PASS_RATE_TARGET,
  creBehaviorExampleCount,
  type CreBehaviorExampleId,
  type CreBehaviorExample,
} from "./behavior-examples";

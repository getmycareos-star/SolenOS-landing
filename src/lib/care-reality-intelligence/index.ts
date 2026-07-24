export {
  BUILD_SURFACE,
  CARE_REALITY_INTELLIGENCE_CATEGORY,
  CARE_REALITY_INTELLIGENCE_DEFINING_PRINCIPLE,
  CARE_REALITY_INTELLIGENCE_IDENTITY,
  CARE_REALITY_INTELLIGENCE_STATUS,
  CARE_REALITY_INTELLIGENCE_THESIS,
  CARE_TRANSITION_SIGNAL_TYPES,
  COMPARISON_ENGINE_QUESTION,
  COMPARISON_ENGINE_REJECTS,
  CORE_CAPABILITIES,
  DO_NOT_BUILD,
  INFORMATION_PROGRESSION,
  INTELLIGENCE_CHAIN_STAGES,
  TRUST_ENGINEERING_RULES,
} from "./contract-constants";
export {
  INTELLIGENCE_NO_HARDCODE_PURPOSE,
  CARE_REALITY_REASONING_STRUCTURE,
  CARE_REALITY_ATTENTION_RANK,
  INTELLIGENCE_LAYER_ASK,
  INTELLIGENCE_LAYER_NEVER_ASK,
  KEYWORD_CLASSIFIER_THEATER_PATTERNS,
  containsKeywordClassifierTheater,
  attentionRankForExtractionCategory,
} from "./no-hardcode-contract";
export type { CareRealityAttentionRank } from "./no-hardcode-contract";
export {
  ILLUSTRATION_VS_IMPLEMENTATION_PURPOSE,
  ILLUSTRATION_PRE_COMMIT_GATE,
  UNIVERSAL_CARE_REALITY_OBJECTS,
  ILLUSTRATION_DOC_MARKERS,
  containsIllustrationAsProduct,
  containsIllustrationShapedSchema,
  containsIllustrationUiDefault,
  containsIllustrationScenarioObject,
  assertIllustrationNotImplementedAsProduct,
  ILLUSTRATION_SHAPED_SCHEMA_PATTERNS,
  ILLUSTRATION_UI_DEFAULT_PATTERNS,
  ILLUSTRATION_SCENARIO_OBJECT_PATTERNS,
} from "./illustration-vs-implementation";
export {
  CARE_REALITY_SITUATION_MODEL_PURPOSE,
  buildCareRealitySituationModel,
  orientationFromSituationModel,
} from "./situation-model";
export type {
  CareRealitySituationModel,
  SituationModelConfidence,
} from "./situation-model";
export {
  CARE_RECIPIENT_ANCHOR_PURPOSE,
  CARE_REALITY_PROCESSING_ORDER,
  buildCareRecipientAnchor,
  orientationFromCareRecipientAnchor,
  composeCareRecipientIdentityAsk,
  composeSessionKinshipConfirmAsk,
  detectSessionKinshipCue,
  centersContributorConflictOverRecipient,
} from "./care-recipient-anchor";
export type { CareRecipientAnchor } from "./care-recipient-anchor";
export {
  BASELINE_COMPARISON_PURPOSE,
  compareAgainstBaseline,
  orientationFromBaselineComparison,
  seedBaselineFromCapture,
  inventsBaselineCausation,
  isFlatExtractionWithoutBaseline,
  heldPriorCareMemoryFacts,
  heldCrsCareMemoryFacts,
} from "./baseline-comparison-engine";
export type {
  BaselineComparisonResult,
  BaselineState,
  BaselineDomain,
  BaselineConfidence,
} from "./baseline-comparison-engine";
export {
  INITIAL_CARE_REALITY_ASSESSMENT_PURPOSE,
  orientationFromInitialAssessment,
  orientationFromComparisonInitialMode,
  containsHallucinatedChangeLanguage,
  initialBaselineEstablishmentAsks,
  HALLUCINATED_CHANGE_PATTERNS,
  PERSON_BASELINE_AREAS,
} from "./initial-care-reality-assessment";
export type {
  CareRealityAssessmentMode,
  PersonBaselineArea,
} from "./initial-care-reality-assessment";
export {
  SITUATION_GENERATOR_PURPOSE,
  generateActiveSituation,
  orientationFromGeneratedSituation,
  containsSituationSummaryTheater,
  SITUATION_SUMMARY_THEATER_PATTERNS,
} from "./situation-generator";
export type {
  GeneratedActiveSituation,
  SituationConfidence,
  SituationConfidenceBand,
  PossibleSituationLink,
} from "./situation-generator";
export {
  CARE_REALITY_MEMORY_PURPOSE,
  ingestCareRealityMemoryFromCapture,
  listCareRealityMemory,
  listPrimaryCareRealityMemory,
  detectRealityRecurrence,
  isTextRecurrenceOnly,
  summarizeCareRealityMemory,
  centersArgumentAsCareMemory,
  containsTextMemoryTheater,
  memoryPriorityForType,
  resetCareRealityMemoryStore,
  TEXT_MEMORY_THEATER_PATTERNS,
} from "./care-reality-memory";
export type {
  CareRealityMemoryObject,
  CareRealityMemoryType,
  CareRealityMemoryStatus,
  MemoryConfidenceBand,
} from "./care-reality-memory";
export {
  INTELLIGENCE_VALIDATION_PURPOSE,
  INTELLIGENCE_GATE_QUESTION,
  validateIntelligenceResponse,
  assertIntelligenceValidation,
  isSentenceSummaryFailure,
  isTaskGeneratorFailure,
  isGenericSafetyFailure,
  isFamilyDistractionFailure,
  isExcessiveQuestioningFailure,
  buildIntelligenceChecklist,
  HARD_REJECTION_TASK_PATTERNS,
  HARD_REJECTION_GENERIC_SAFETY_PATTERNS,
  HARD_REJECTION_FAMILY_DISTRACTION_PATTERNS,
} from "./intelligence-validation";
export type {
  IntelligenceFailureMode,
  IntelligenceChecklistItem,
  IntelligenceValidationResult,
} from "./intelligence-validation";
export {
  CAREGIVER_UNDERSTANDING_TEST_PURPOSE,
  MIDNIGHT_GATE_QUESTION,
  evaluateCaregiverUnderstandingTest,
  assertCaregiverUnderstandingTest,
  isCaregiverEchoFailure,
  improvesUnderstanding,
  improvesOrientation,
  improvesUncertaintyReduction,
  improvesPriority,
  FALSE_REASSURANCE_PATTERNS,
  FALSE_CERTAINTY_PATTERNS,
  PRE_RESPONSE_REASONING_ORDER,
} from "./caregiver-understanding-test";
export type {
  UnderstandingDimension,
  UnderstandingTestFailure,
  UnderstandingDimensionResult,
  CaregiverUnderstandingTestResult,
} from "./caregiver-understanding-test";
export {
  CLINICAL_SITUATION_CLASSIFICATION_PURPOSE,
  classifyClinicalSituations,
  humanOrientationFromClinicalCategories,
  preferClinicalHumanOrientation,
  priorityForCategory,
  containsClinicalCategoryLeakage,
  CLINICAL_CATEGORY_LEAKAGE_PATTERNS,
} from "./clinical-situation-classification";
export type {
  ClinicalSituationCategoryId,
  ClinicalSituationHit,
  ClinicalSituationLink,
  ClinicalSituationClassification,
} from "./clinical-situation-classification";
export {
  UNCERTAINTY_PRESERVATION_PURPOSE,
  preserveUncertainty,
  preferUncertaintyOrientation,
  containsCausalTheater,
  isStoredConclusionAsFact,
  validateUncertaintyPreservation,
  assertUncertaintyPreservation,
  CAUSAL_THEATER_PATTERNS,
} from "./uncertainty-preservation";
export type {
  UncertaintyConfidenceBand,
  UncertaintyKnownFact,
  UncertaintyPossibleLink,
  UncertaintyPreservationModel,
} from "./uncertainty-preservation";
export type {
  BuildSurface,
  CareLoopOutcome,
  CareRealityIntelligenceResult,
  CareRealityIntelligenceSnapshot,
  CareTransitionSignal,
  CareTransitionSignalType,
  CoreCapability,
  IntelligenceChainLink,
  IntelligenceChainStage,
  ProcessCareRealityIntelligenceInput,
  TrustEngineeringRule,
} from "./types";
export {
  listCareTransitionSignalTypes,
  processCareRealityIntelligence,
} from "./compose";

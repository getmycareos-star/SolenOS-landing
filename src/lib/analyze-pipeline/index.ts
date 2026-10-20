import { strictParseModelJson } from "../gemini-contract";
import {
  FailureObservabilityCollector,
  classifyDeterminismFailure,
  classifyInferenceInconsistency,
  classifyMedicalBoundaryFailure,
  classifyEpistemicSafetyFailure,
  classifyGroundingFailure,
  classifyUnknownStateFailure,
  classifyEmotionalStabilizationFailure,
  classifyDocumentIntakeFailure,
  classifyCalibratedUncertaintyFailure,
  classifyCognitiveClarityFailure,
  classifyUrgencyEscalationFailure,
  classifySafetyOverrideFailure,
  classifyNonConversationalFailure,
  classifyNonAssistantOutputFailure,
  classifyEpisodicReliefFailure,
  classifyChaosToClarityFailure,
  classifySemanticRoleIsolationFailure,
  classifyOutputCompressionFailure,
  classifyPressureReductionFailure,
  classifyCognitiveCompressionFailure,
  classifyClarityGateBlockFailure,
  classifyOverloadFailure,
  classifyParseFailure,
  classifyQualityFailure,
  classifyZodFailure,
  detectInputOverload,
  fingerprintOutput,
  fingerprintsDiverge,
  publishLastFailureLogs,
  type FailureLogEntry,
} from "../failure-observability";
import { runDeterminismGate } from "../consistency-determinism";
import { stressNormalizeInput, type StressNormalizedOutput } from "../input-stress-normalizer";
import { applyContextWindowStrategy } from "../context-window-strategy";
import { isOutputQualityValid } from "../output-quality-gate";
import { isGroundingValid } from "../grounding-validation";
import { isUnknownStateValid } from "../unknown-state-verification";
import { applyDocumentIntake, isDocumentIntakeValid } from "../document-intake";
import {
  processDocumentIntelligenceLayer,
  toDocumentIntelligenceLayerPayload,
  type DocumentIntelligenceLayerPayload,
  type DocumentIntelligenceLayerResult,
} from "../document-intelligence";
import { isEmotionalStabilizationValid } from "../emotional-stabilization";
import { isCalibratedUncertaintyValid } from "../calibrated-uncertainty";
import { isCognitiveClarityValid } from "../cognitive-clarity";
import { isUrgencyEscalationValid } from "../urgency-escalation";
import { isNonConversationalValid } from "../non-conversational";
import { isNonAssistantOutputValid } from "../non-assistant-output";
import { isEpisodicReliefValid } from "../episodic-relief";
import { isChaosToClarityValid } from "../chaos-to-clarity";
import { isSemanticRoleIsolationValid } from "../semantic-role-isolation";
import { isOutputCompressionValid } from "../implementation-enforcement";
import {
  detectGuiltReplayPatterns,
  formatGuiltReplayObservation,
  isCognitiveCompressionValid,
} from "../cognitive-compression";
import { isPressureReductionValid } from "../pressure-reduction";
import {
  applySafetyOverrideCheck,
  isSafetyOverrideValid,
} from "../safety-override";
import { detectUrgencyLevel } from "../urgency-detection";
import {
  classifyInputSurface,
  InputClassificationResultSchema,
  selectBehaviorProfile,
} from "../input-classification";
import {
  buildStructuredClarificationResponse,
  processInputClarityGate,
} from "../ambiguity-structure-validation";
import {
  applyRiskUncertaintyToResponse,
  buildGateBlockedResponse,
  processRiskUncertainty,
  toRiskUncertaintyLayerPayload,
  type RiskUncertaintyLayerPayload,
} from "../risk-uncertainty-engine";
import { processCareJourneyInput } from "../care-journey-graph/server";
import {
  toCareJourneyGraphLayerPayload,
  type CareJourneyGraphLayerPayload,
} from "../care-journey-graph";
import {
  applyPostCareToneAdjustment,
  classifyCareContextState,
  formatCareContextObservation,
  type CareContextState,
} from "../post-care-insight";
import {
  classifyCaregiverDepletionSignals,
  CaregiverDepletionSignalsResultSchema,
  formatCaregiverDepletionObservations,
  type CaregiverDepletionSignalsResult,
} from "../caregiver-depletion-signals";
import { enforceMedicalBoundary } from "../medical-responsibility-boundary";
import { enforceEpistemicSafety } from "../epistemic-safety-engine";
import { runPreReasoningGrounding } from "../grounding-retrieval";
import { invokeGeminiExecution } from "../solenos-langchain-adapter/gemini";
import {
  validateMultilingualExecution,
  type MultilingualExecutionMeta,
  type SolenOSLanguage,
} from "../multilingual-execution";
import {
  applySettingsGovernance,
  DEFAULT_SOLENOS_SETTINGS,
  toGovernanceLayerPayload,
  type GovernanceLayerPayload,
  type SolenOSSettings,
} from "../settings-governance";
import {
  applyCareProfileBehaviorWeighting,
  applyCareProfileGovernanceWeighting,
  processCareProfileLayer,
  toCareProfileLayerPayload,
  type CareProfileLayerPayload,
} from "../care-profile";
import {
  applyCareContextBehaviorWeighting,
  applyCareContextGovernanceWeighting,
  computeCareContext,
  formatSituationalCareContextObservation,
  toCareContextLayerPayload,
  validateCareContextAgainstProfile,
  type CareContextLayerPayload,
} from "../care-context/situational";
import {
  applyMemoryInfluenceBehaviorWeighting,
  applyMemoryInfluenceGovernanceWeighting,
  mergeMemoryInfluenceIntoGroundingContext,
  processMemoryInfluenceLayer,
  toMemoryInfluenceLayerPayload,
  type MemoryInfluenceLayerPayload,
} from "../memory-influence";
import {
  processCaseMemoryLayer,
  shapeSolenOSFromDecisionSnapshot,
  toCaseMemoryLayerPayload,
  type CaseMemoryLayerPayload,
  type CaseMemoryLayerResult,
} from "../case-memory";
import {
  applyTimeEngineBehaviorWeighting,
  applyTimeEngineGovernanceWeighting,
  formatTimeEngineObservation,
  processTimeEngineLayer,
  toTimeEngineLayerPayload,
  type TimeEngineLayerPayload,
} from "../time-engine";
import {
  applyPriorityEngineBehaviorWeighting,
  applyPriorityEngineGovernanceWeighting,
  formatPriorityEngineObservation,
  processPriorityEngineLayer,
  toPriorityEngineLayerPayload,
  type PriorityEngineLayerPayload,
} from "../priority-engine";
import {
  mergeDecisionSnapshotFromPrioritization,
  processDeterministicPrioritization,
  toDeterministicPrioritizationLayerPayload,
  type DeterministicPrioritizationLayerPayload,
  type DeterministicPrioritizationLayerResult,
} from "../deterministic-prioritization";
import {
  overlayDecisionSnapshotFields,
  processPrioritizationEngine,
  toPrioritizationEngineLayerPayload,
  type PrioritizationEngineLayerPayload,
  type PrioritizationEngineLayerResult,
} from "../prioritization-engine";
import {
  formatDemandEngineObservation,
  processDemandEngineLayer,
  toDemandEngineLayerPayload,
  type DemandEngineLayerPayload,
} from "../demand-engine";
import {
  formatCaregiverLoadObservation,
  processCaregiverLoadLayer,
  selectSurfaceDemandsForLoad,
  shapeWhatCanWaitFromDeferredDemands,
  toCaregiverLoadLayerPayload,
  type CaregiverLoadLayerPayload,
} from "../caregiver-load-index";
import {
  applyPostDecisionEmotionalLoad,
  formatEmotionalLoadSignalObservation,
  processEmotionalLoadSignalLayer,
  toEmotionalLoadSignalLayerPayload,
  type EmotionalLoadSignalLayerPayload,
} from "../emotional-load-signal";
import {
  emotionalContradictionHints,
  detectHighSignalStressPattern,
  formatCaregiverPsychologicalLoadObservation,
  formatHighSignalStressObservation,
  highSignalStressMetricBoosts,
  processCaregiverPsychologicalLoad,
  shapeContainmentOutput,
  toCaregiverPsychologicalLoadPayload,
  toHighSignalStressLayerPayload,
  type CaregiverPsychologicalLoadPayload,
  type HighSignalStressLayerPayload,
} from "../caregiver-psychological-load";
import {
  formatLoadInterpretationObservation,
  processLoadInterpretation,
  shapeLoadFirstOutput,
  toLoadInterpretationLayerPayload,
  type LoadInterpretation,
  type LoadInterpretationLayerPayload,
} from "../load-interpretation";
import {
  formatCaregiverLoadEngineObservation,
  persistSessionLoadState,
  processCaregiverLoadEngine,
  toCaregiverLoadEngineLayerPayload,
  type CaregiverLoadEngineLayerPayload,
  type CaregiverLoadEngineResult,
} from "../caregiver-load-engine";
import {
  formatAttentionObservation,
  processAttentionLayer,
  shapeBehavioralResponse,
  toAttentionLayerPayload,
  type AttentionLayerPayload,
  type AttentionLayerResult,
} from "../attention-engine";
import {
  formatInteractionLoadObservation,
  processInteractionLoadSignal,
  shapeInteractionSurvivabilityOutput,
  toInteractionLoadLayerPayload,
  type InteractionLoadLayerPayload,
} from "../interaction-load-signal";
import {
  applyResponsibilityOwnerToAction,
  formatResponsibilityGraphObservation,
  processResponsibilityGraphLayer,
  toResponsibilityGraphLayerPayload,
  type ResponsibilityGraphLayerPayload,
} from "../responsibility-graph";
import {
  formatResolutionEngineObservation,
  processResolutionEngineLayer,
  toResolutionEngineLayerPayload,
  type ResolutionEngineLayerPayload,
} from "../resolution-engine";
import {
  applyAssumptionRegistryBehaviorWeighting,
  applyAssumptionRegistryGovernanceWeighting,
  formatAssumptionRegistryObservation,
  processAssumptionRegistryLayer,
  refreshAssumptionRegistryFromDocuments,
  toAssumptionRegistryLayerPayload,
  type AssumptionRegistryLayerPayload,
} from "../assumption-registry";
import {
  applyMissingInformationQueueBehaviorWeighting,
  applyMissingInformationQueueGovernanceWeighting,
  formatMissingInformationQueueObservation,
  processMissingInformationQueueLayer,
  refreshMissingInformationQueueFromDocuments,
  toMissingInformationQueueLayerPayload,
  type MissingInformationQueueLayerPayload,
} from "../missing-information-queue";
import {
  applySituationRiskRegisterBehaviorWeighting,
  applySituationRiskRegisterGovernanceWeighting,
  formatSituationRiskRegisterObservation,
  processSituationRiskRegisterLayer,
  toSituationRiskRegisterLayerPayload,
  type SituationRiskRegisterLayerPayload,
} from "../situation-risk-register";
import { processContextWeighting } from "../context-weighting";
import {
  processConflictDetection,
  formatConflictDetectionObservation,
} from "../conflict-detection";
import {
  type DecisionHistory,
} from "../decision-history";
import { captureReasoningSnapshot, type ReasoningSnapshot } from "../reasoning-snapshot";
import { mapLifecycleToCanonical } from "../core-runtime";
import {
  enforceSafetyConstraints,
  toSafetyLayerPayload,
  type SafetyLayerPayload,
} from "../safety-enforcement";
import {
  processHumanTrustLayer,
  toHumanTrustLayerPayload,
  type HumanTrustLayerPayload,
} from "../human-trust-layer";
import {
  applyFailSafeClarificationToResponse,
  processFailSafeMode,
  toFailSafeModeLayerPayload,
  type FailSafeModeLayerPayload,
} from "../fail-safe-mode";
import {
  processConfidenceLayer,
  toConfidenceLayerPayload,
  type ConfidenceLayerPayload,
} from "../confidence-layer";
import {
  processCrisisPreventionLayer,
  toCrisisPreventionLayerPayload,
  type CrisisPreventionLayerPayload,
} from "../crisis-prevention-layer";
import {
  processDelegationLayer,
  toDelegationLayerPayload,
  type DelegationLayerPayload,
} from "../delegation-layer";
import {
  compoundAnalyzeInteraction,
  type FamilyIntelligenceSnapshot,
} from "../family-intelligence";
import { resolveDurableCareKey } from "../care-identity";
import {
  applySystemHealthGovernanceWeighting,
  processSystemHealthLayer,
  toSystemHealthLayerPayload,
  type SystemHealthLayerPayload,
} from "../system-health";
import {
  computeAutonomyGate,
  computeHealthSummary,
  computePriority,
  computeRisk,
  syncLegacyBeliefsToStore,
  syncTrackedSituationsToState,
  writeExplanationDecision,
  type DerivedPriorityResult,
  type DerivedRiskResult,
  type ExplanationHealthSummary,
} from "../solenos-layers";
import {
  assembleOutputLayer,
  toTrustLayerPayload,
  type TrustLayerPayload,
} from "../trust-disclaimer-footer";
import {
  validateAIResponse,
  isValidationError,
  type SolenOSResponse,
} from "../response-validator";
import {
  ANALYZE_PIPELINE_FAILURE,
  ANALYZE_MAX_RETRIES,
  type AnalyzeFailureResponse,
} from "./constants";

export interface AnalyzePipelineParams {
  input: string;
  geminiApiKey: string;
  geminiModel?: string;
  telemetry_user_id?: string;
  care_session_id?: string;
  source_type?: "text" | "document";
  userLanguage?: SolenOSLanguage;
  governanceSettings?: SolenOSSettings;
}

export interface AnalyzePipelineRun {
  result: SolenOSResponse | AnalyzeFailureResponse;
  failure_logs: readonly FailureLogEntry[];
  care_context_state: CareContextState;
  caregiver_depletion_signals: CaregiverDepletionSignalsResult;
  /** Post-reasoning safety annotations — absent on failure or clarity-gate BLOCK. */
  trust_layer?: TrustLayerPayload;
  /** Post-reasoning governance routing — absent on failure or clarity-gate BLOCK. */
  governance_layer?: GovernanceLayerPayload;
  /** Post-governance safety enforcement envelope — absent on failure or clarity-gate BLOCK. */
  safety_layer?: SafetyLayerPayload;
  /**
   * HUMAN TRUST LAYER — post-decision EXPLANATION (understand / challenge / undo).
   * Present on every successful recommendation; never changes the decision.
   */
  human_trust_layer?: HumanTrustLayerPayload;
  /**
   * FAIL-SAFE MODE — post-decision derived gate (pause under uncertainty / unresolved conflict).
   * Present on successful recommendation paths; not a truth store.
   */
  fail_safe_mode_layer?: FailSafeModeLayerPayload;
  /**
   * CAREGIVER CONFIDENCE — post-decision reassurance ("Am I doing enough?").
   * DERIVED over STATE+BELIEF+crisis; plain English only.
   */
  confidence_layer?: ConfidenceLayerPayload;
  /**
   * CRISIS PREVENTION — predictive failure risks (what becomes dangerous LATER).
   */
  crisis_prevention_layer?: CrisisPreventionLayerPayload;
  /**
   * DELEGATION — suggest-only when caregiver load HIGH/CRITICAL.
   */
  delegation_layer?: DelegationLayerPayload;
  /**
   * FAMILY INTELLIGENCE — read-mostly compounding snapshot of 5 strategic assets.
   * Non-blocking; accumulates Family Memory / Care Graph / Decision History /
   * Delegation Network / Crisis Prediction + trust/confidence bridges.
   */
  family_intelligence_snapshot?: FamilyIntelligenceSnapshot;
  /** Care profile weighting envelope — absent on clarity-gate BLOCK. */
  care_profile_layer?: CareProfileLayerPayload;
  /** Ephemeral situational care context — absent on clarity-gate BLOCK; never persisted. */
  care_context_layer?: CareContextLayerPayload;
  /** Weighted memory influence envelope — absent on clarity-gate BLOCK; influence only, not truth. */
  memory_influence_layer?: MemoryInfluenceLayerPayload;
  /**
   * CASE MEMORY — Case-centered care memory + Pattern Response Policy.
   * Exposes internal 6-field decision_snapshot; public SolenOS display remains 5-field schema.
   */
  case_memory_layer?: CaseMemoryLayerPayload;
  /** Temporary assumptions influencing decisions — absent on clarity-gate BLOCK; not memory truth. */
  assumption_registry_layer?: AssumptionRegistryLayerPayload;
  /** Knowledge gaps affecting reasoning — absent on clarity-gate BLOCK; not a task list. */
  missing_information_queue_layer?: MissingInformationQueueLayerPayload;
  /** Systemic risk across ACTIVE situations — absent on clarity-gate BLOCK; not UI badges. */
  situation_risk_register_layer?: SituationRiskRegisterLayerPayload;
  /** Temporal priority weight signals — absent on clarity-gate BLOCK; never schedules or reminds. */
  time_engine_layer?: TimeEngineLayerPayload;
  /** Priority fusion vectors — absent on clarity-gate BLOCK; scores only, never NL actions. */
  priority_engine_layer?: PriorityEngineLayerPayload;
  /**
   * DETERMINISTIC PRIORITIZATION — issue extract → score → compress to 6-field Decision Snapshot.
   * Debug scores/explanations live here; public fields never include DO_FIRST buckets.
   */
  deterministic_priority_layer?: DeterministicPrioritizationLayerPayload;
  /**
   * PRIORITIZATION ENGINE — four-dimension reasoning (decay, clocks, pools, self-neglect).
   * Extended output with items[], resource_tension[], risk_cascade[] — never one score.
   */
  prioritization_engine_layer?: PrioritizationEngineLayerPayload;
  /**
   * RISK & UNCERTAINTY ENGINE — mandatory completeness gate before priority/urgency assignment.
   */
  risk_uncertainty_layer?: RiskUncertaintyLayerPayload;
  /**
   * CARE JOURNEY GRAPH — structured events + relationships; updated before reasoning.
   */
  care_journey_graph_layer?: CareJourneyGraphLayerPayload;
  /** STATE demands + derived pressure — absent on clarity-gate BLOCK. */
  demand_engine_layer?: DemandEngineLayerPayload;
  /** DERIVED caregiver load — shapes surface count; not a dashboard. */
  caregiver_load_layer?: CaregiverLoadLayerPayload;
  /**
   * EMOTIONAL LOAD SIGNAL — derived stress/burnout/fatigue; load-aware priority + post-decision constraints.
   */
  emotional_load_signal_layer?: EmotionalLoadSignalLayerPayload;
  /**
   * CAREGIVER PSYCHOLOGICAL LOAD — moral injury, identity drift, containment, validation.
   */
  caregiver_psychological_load_layer?: CaregiverPsychologicalLoadPayload;
  /**
   * CAREGIVER LOAD ENGINE — master product module: 5 load dimensions + unified burnout.
   */
  caregiver_load_engine?: CaregiverLoadEngineLayerPayload;
  /**
   * LOAD-FIRST INTERPRETATION — burden recognition before care advice (heuristic detection).
   */
  load_interpretation_layer?: LoadInterpretationLayerPayload;
  /**
   * HIGH-SIGNAL STRESS — emotional harm + sleep + uncertainty; Acute Burnout → Containment Mode.
   */
  high_signal_stress_layer?: HighSignalStressLayerPayload;
  /**
   * INTERACTION LOAD SIGNAL — repetitive emotional interaction loops, boundary stress, sleep protection.
   */
  interaction_load_layer?: InteractionLoadLayerPayload;
  /**
   * ATTENTION ENGINE — Behavioral Spec v1: Class A/B/C → Now/Watch/Later.
   */
  attention_layer?: AttentionLayerPayload;
  /** STATE ownership map — Person → Responsibility → Demand; not a contact list. */
  responsibility_graph_layer?: ResponsibilityGraphLayerPayload;
  /** CLI-constrained top demands for Decision Surface. */
  surface_demands?: readonly {
    id: string;
    title: string;
    description: string;
    pressureScore: number;
    status: string;
    situationId: string;
    ownerName?: string | null;
  }[];
  deferred_demand_titles?: readonly string[];
  /** Situation lifecycle — ACTIVE/RESOLVED/ARCHIVED; evidence-based resolution only. */
  resolution_engine_layer?: ResolutionEngineLayerPayload;
  /** Document intelligence envelope — absent when not document input. */
  document_intelligence_layer?: DocumentIntelligenceLayerPayload;
  /** Full document intelligence result — memory proposals pending only, never auto-committed. */
  document_intelligence?: DocumentIntelligenceLayerResult;
  /** Decision readiness (not infrastructure) — absent on clarity-gate BLOCK. */
  system_health_layer?: SystemHealthLayerPayload;
  /** WHY explanation for the chosen action — never Timeline WHAT. */
  decision_history?: DecisionHistory;
  /** Audit/trust reasoning snapshot — not used for ranking. */
  reasoning_snapshot?: ReasoningSnapshot;
  /** Cross-layer conflict registry — soft confidence / CRITICAL medical gate; one clarification. */
  conflict_detection?: {
    flagCount: number;
    openCount: number;
    reEvaluationRequired: boolean;
    totalConfidenceReduction: number;
    highMissingInfoBlocked: boolean;
    criticalDecisionRestricted: boolean;
    conflictLoadContribution: number;
    clarification: {
      headline: string;
      question: string;
      options?: readonly string[];
      severity: string;
      conflictId: string;
      type: string;
    } | null;
  };
  /** Derived (pure) over STATE+BELIEF — not persisted engines. */
  layered_derived?: {
    risk: DerivedRiskResult;
    priority: DerivedPriorityResult;
    health: ExplanationHealthSummary;
    caregiverLoad?: {
      score: number;
      state: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
      surfaceLimit: number;
    };
    emotionalLoad?: {
      compositeScore: number;
      cognitiveFatigueLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
      burnoutProbability: number;
      protectionModeEngaged: boolean;
    };
    psychologicalLoad?: {
      moralInjurySeverity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
      identityDriftLevel: "STABLE" | "EMERGING" | "SIGNIFICANT" | "FRAGMENTED";
      containmentEngaged: boolean;
      emotionalValidationTriggered: boolean;
    };
    loadInterpretation?: {
      emotionalLoadScore: number;
      loadFirstMode: boolean;
      sleepRisk: number;
      uncertaintyIndex: number;
    };
    caregiverLoadEngine?: {
      cognitiveLoadScore: number;
      emotionalLoadScore: number;
      sleepRiskScore: number;
      uncertaintyIndex: number;
      dependencyLoadScore: number;
      burnoutProbability: number;
      burnoutTrend: "stable" | "rising" | "critical";
      burnoutTier: "Low" | "Moderate" | "High" | "Critical";
      loadFirstMode: boolean;
    };
    interactionLoad?: {
      detected: boolean;
      boundaryViolationIndex: number;
      sleepDisruptionRisk: "LOW" | "ELEVATED" | "CRITICAL";
      sleepProtectionEngaged: boolean;
      outputStrategy: "normal" | "interaction_survivability";
    };
    attention?: {
      attentionClass: "A" | "B" | "C";
      attentionPriority: "Now" | "Watch" | "Later";
      burnoutTier: "Low" | "Moderate" | "High" | "Critical";
    };
  };
  user_language: SolenOSLanguage;
}

type StructuralResult =
  | { ok: true; data: SolenOSResponse; rawParsed: unknown }
  | { ok: false; kind: "parse" | "zod" };

function validateStructuralLayer(rawOutput: string): StructuralResult {
  let parsed: unknown;
  try {
    parsed = strictParseModelJson(rawOutput);
  } catch {
    return { ok: false, kind: "parse" };
  }

  try {
    return { ok: true, data: validateAIResponse(parsed), rawParsed: parsed };
  } catch (error) {
    if (isValidationError(error)) {
      return { ok: false, kind: "zod" };
    }
    throw error;
  }
}

function classifyStructuralFailure(kind: "parse" | "zod") {
  return kind === "parse" ? classifyParseFailure() : classifyZodFailure();
}

function assembleTrustLayer(
  response: SolenOSResponse,
  rawInput: string,
  documentIntake: ReturnType<typeof applyDocumentIntake>,
  documentIntelligence?: DocumentIntelligenceLayerPayload,
): { response: SolenOSResponse; trust_layer: TrustLayerPayload } {
  const { assembled, guarantee } = assembleOutputLayer(response, {
    rawInput,
    documentIntake,
    documentIntelligence,
  });
  if (!guarantee.ok) {
    console.warn("[analyze-pipeline] trust layer guarantee violations:", guarantee.violations);
  }
  return {
    response: assembled.response,
    trust_layer: toTrustLayerPayload(assembled),
  };
}

/**
 * Gemini 1.5 Pro cognitive pipeline with failure observability (metadata only).
 */
export async function runAnalyzePipeline(
  params: AnalyzePipelineParams,
): Promise<SolenOSResponse | AnalyzeFailureResponse> {
  const run = await runAnalyzePipelineWithObservability(params);
  return run.result;
}

export async function runAnalyzePipelineWithObservability(
  params: AnalyzePipelineParams,
): Promise<AnalyzePipelineRun> {
  const collector = new FailureObservabilityCollector();
  const userLanguage = params.userLanguage ?? "en";
  const governanceSettings = params.governanceSettings;
  const multilingualMeta: MultilingualExecutionMeta = {
    userLanguage,
    promptWrapped: true,
  };

  // Step 1: INPUT RECEIVED
  const structuredInput = stressNormalizeInput(params.input);

  // Step 2: INPUT CLASSIFICATION
  const inputClassification = InputClassificationResultSchema.parse(
    classifyInputSurface(structuredInput.raw_input),
  );

  // Step 2b: CLARITY GATE (pre-reasoning structure validation)
  const clarityGate = processInputClarityGate(
    structuredInput.raw_input,
    inputClassification.mode,
  );
  if (clarityGate.action === "BLOCK") {
    collector.record({
      ...classifyClarityGateBlockFailure(),
      retry_count: 0,
    });
    publishLastFailureLogs(collector.getLogs());
    return {
      result: buildStructuredClarificationResponse(clarityGate.clarity),
      failure_logs: collector.getLogs(),
      care_context_state: "uncertain",
      caregiver_depletion_signals: {
        caregiver_depletion_state: "normal",
        is_single_caregiver: false,
        environmental_dependency_flag: "none",
      },
      user_language: userLanguage,
    };
  }

  // Step 2d: CARE JOURNEY GRAPH — update structured journey before any reasoning
  const careJourneyGraphProcessed = processCareJourneyInput({
    description: structuredInput.raw_input,
    caregiver_id: params.telemetry_user_id ?? "default_caregiver",
    case_id: params.care_session_id ?? null,
    source: params.source_type === "document" ? "document" : "text",
  });
  const careJourneyGraphLayer = toCareJourneyGraphLayerPayload(careJourneyGraphProcessed);

  // Step 2c: RISK & UNCERTAINTY GATE — blocks priority/urgency when safety context insufficient
  const riskUncertaintyProcessed = processRiskUncertainty(structuredInput.raw_input);
  const riskUncertaintyLayer = toRiskUncertaintyLayerPayload(riskUncertaintyProcessed);
  if (riskUncertaintyProcessed.blocked) {
    const blocked = buildGateBlockedResponse(structuredInput.raw_input);
    publishLastFailureLogs(collector.getLogs());
    return {
      result: blocked.result,
      risk_uncertainty_layer: blocked.layer,
      care_journey_graph_layer: careJourneyGraphLayer,
      failure_logs: collector.getLogs(),
      care_context_state: "uncertain",
      caregiver_depletion_signals: {
        caregiver_depletion_state: "normal",
        is_single_caregiver: false,
        environmental_dependency_flag: "none",
      },
      user_language: userLanguage,
    };
  }

  // Step 3: URGENCY DETECTION
  const urgencyDetection = detectUrgencyLevel(
    structuredInput.raw_input,
    inputClassification.mode,
  );

  // Step 3a: CASE MEMORY — identify Case → extract → update → selective recall → PRP
  // Case is the long-lived product spine; Situations remain runtime STATE root (ADR-001).
  let caseMemoryLayer: CaseMemoryLayerResult = processCaseMemoryLayer({
    input: structuredInput.raw_input,
    situationId: params.care_session_id,
    source: params.source_type === "document" ? "document_input" : "caregiver_input",
  });
  if (!caseMemoryLayer.guarantee.ok) {
    console.warn(
      "[analyze-pipeline] case memory guarantee violations:",
      caseMemoryLayer.guarantee.violations,
    );
  }

  // Step 3b: CARE CONTEXT LAYER — ephemeral situational state; before Care Profile
  const situationalCareContext = computeCareContext({
    input: structuredInput.raw_input,
    inputMode: inputClassification.mode,
    urgencyDetection,
  });
  if (!situationalCareContext.guarantee.ok) {
    console.warn(
      "[analyze-pipeline] care context guarantee violations:",
      situationalCareContext.guarantee.violations,
    );
  }

  // Step 4: SIGNAL EXTRACTION (observational only — no behavioral branching)
  const careContext = classifyCareContextState({
    input: structuredInput.raw_input,
    inputMode: inputClassification.mode,
    urgencyDetection,
  });
  const caregiverDepletion = CaregiverDepletionSignalsResultSchema.parse(
    classifyCaregiverDepletionSignals(structuredInput.raw_input),
  );

  // Step 4c: HIGH-SIGNAL STRESS — acute burnout classification + containment triggers.
  const highSignalStress = detectHighSignalStressPattern({
    userInput: structuredInput.raw_input,
  });
  const highSignalStressBoosts = highSignalStressMetricBoosts(highSignalStress);
  const highSignalStressObservation = formatHighSignalStressObservation(highSignalStress);

  // Step 4d: INTERACTION LOAD SIGNAL — repetition/boundary/sleep before CLI + Emotional Load.
  const interactionLoadLayer = processInteractionLoadSignal({
    rawInput: structuredInput.raw_input,
    situationId: params.care_session_id ?? null,
  });
  if (!interactionLoadLayer.guarantee.ok) {
    console.warn(
      "[analyze-pipeline] interaction load guarantee violations:",
      interactionLoadLayer.guarantee.violations,
    );
  }
  const interactionLoadObservation = formatInteractionLoadObservation(interactionLoadLayer);

  // Step 4e: CAREGIVER LOAD ENGINE — unified 5-dimension burden detection + burnout.
  let caregiverLoadEngine: CaregiverLoadEngineResult = processCaregiverLoadEngine({
    rawInput: structuredInput.raw_input,
    highSignalStress,
    interactionLoadLayer,
  });
  if (!caregiverLoadEngine.guarantee.ok) {
    console.warn(
      "[analyze-pipeline] caregiver load engine guarantee violations:",
      caregiverLoadEngine.guarantee.violations,
    );
  }
  const loadInterpretation: LoadInterpretation = { ...caregiverLoadEngine.loadInterpretation };
  const loadInterpretationObservation = formatCaregiverLoadEngineObservation(caregiverLoadEngine);
  if (params.care_session_id) {
    persistSessionLoadState(
      params.care_session_id,
      caregiverLoadEngine.state.signals,
      caregiverLoadEngine.state.scores,
      caregiverLoadEngine.state.burnout,
    );
  }

  // Step 5: MODE CONSTRAINT SELECTION
  let behaviorProfile = selectBehaviorProfile(inputClassification);
  behaviorProfile = applyPostCareToneAdjustment(
    behaviorProfile,
    careContext.care_context_state,
  );
  behaviorProfile = applyCareContextBehaviorWeighting(behaviorProfile, situationalCareContext);

  // Step 3c: MEMORY INFLUENCE LAYER — after Care Context; before grounding and Care Profile
  const memoryInfluenceLayer = processMemoryInfluenceLayer({
    telemetry_user_id: params.telemetry_user_id,
    input: structuredInput.raw_input,
    careContext: situationalCareContext.context,
    governanceSettings,
    inferenceAllowed: !(
      governanceSettings?.privacyControl.disableInferenceEngine ??
      DEFAULT_SOLENOS_SETTINGS.privacyControl.disableInferenceEngine
    ),
  });
  if (!memoryInfluenceLayer.guarantee.ok) {
    console.warn(
      "[analyze-pipeline] memory influence guarantee violations:",
      memoryInfluenceLayer.guarantee.violations,
    );
  }
  behaviorProfile = applyMemoryInfluenceBehaviorWeighting(behaviorProfile, memoryInfluenceLayer);

  // Step 6: SAFETY OVERRIDE
  const safetyOverride = applySafetyOverrideCheck(urgencyDetection, behaviorProfile);
  const careContextObservation = formatCareContextObservation(
    careContext.care_context_state,
  );
  const situationalCareContextObservation = formatSituationalCareContextObservation(
    situationalCareContext.context,
  );
  const depletionObservations = formatCaregiverDepletionObservations(caregiverDepletion);
  const guiltReplayObservation = formatGuiltReplayObservation(
    detectGuiltReplayPatterns(structuredInput.raw_input),
  );

  // Step 7: OUTPUT CONTRACT ENFORCEMENT (pre-LLM constraints)
  // FAILURE ISOLATION: document intake is synchronous input tagging only — NOT async OCR.
  // The async pipeline (Upload→Queue→OCR→Extraction→Parsing→Case Attachment→Memory Update)
  // runs independently; decompression output must never wait on OCR/extraction completion.
  const documentIntake = applyDocumentIntake(structuredInput);
  const contextWindow = applyContextWindowStrategy(structuredInput);

  const preReasoningRaw = await runPreReasoningGrounding({
    telemetry_user_id: params.telemetry_user_id,
    policy_categories: ["safety", "grounding"],
  });
  const preReasoning = {
    ...preReasoningRaw,
    grounding_context: mergeMemoryInfluenceIntoGroundingContext(
      preReasoningRaw.grounding_context,
      memoryInfluenceLayer,
    ),
  };

  // Step 7b: CARE PROFILE LAYER — after memory/context, before emotional/time/priority weighting
  const careProfileLayer = processCareProfileLayer({
    telemetry_user_id: params.telemetry_user_id,
    input: structuredInput.raw_input,
    groundingContext: preReasoning.grounding_context,
    governanceSettings,
    inferenceAllowed: !(
      governanceSettings?.privacyControl.disableInferenceEngine ??
      DEFAULT_SOLENOS_SETTINGS.privacyControl.disableInferenceEngine
    ),
  });
  if (!careProfileLayer.guarantee.ok) {
    console.warn(
      "[analyze-pipeline] care profile guarantee violations:",
      careProfileLayer.guarantee.violations,
    );
  }
  const profileContextValidation = validateCareContextAgainstProfile(
    situationalCareContext.context,
    careProfileLayer.state.profile,
  );
  if (!profileContextValidation.ok) {
    console.warn(
      "[analyze-pipeline] care context vs profile validation:",
      profileContextValidation.violations,
    );
  }
  behaviorProfile = applyCareProfileBehaviorWeighting(behaviorProfile, careProfileLayer);

  // Step 7c: TIME ENGINE LAYER — after memory influence + care-profile emotional weighting;
  // before priority / conflict resolution. Emits weight signals only (no scheduling/reminders).
  const timeEngineLayer = processTimeEngineLayer({
    input: structuredInput.raw_input,
    governanceSettings,
    careProfile: careProfileLayer.state.profile,
    careContext: situationalCareContext.context,
    memoryState: memoryInfluenceLayer.state,
    memoryEnvelope: memoryInfluenceLayer.envelope,
    urgencyDetection,
  });
  if (!timeEngineLayer.guarantee.ok) {
    console.warn(
      "[analyze-pipeline] time engine guarantee violations:",
      timeEngineLayer.guarantee.violations,
    );
  }
  behaviorProfile = applyTimeEngineBehaviorWeighting(behaviorProfile, timeEngineLayer);
  const timeEngineObservation = formatTimeEngineObservation(timeEngineLayer);

  // ─── SolenOS 3-Layer Runtime ─────────────────────────────────────────────
  // INPUT → STATE UPDATE → BELIEF UPDATE → DERIVED (Risk, Priority) → ACTION → EXPLANATION
  // ONLY STATE + BELIEF persist. Risk/priority/health are pure derived functions.

  // STATE UPDATE — resolution lifecycle syncs into canonical STATE situations.
  // Durable care key: prefer care_session_id, else telemetry user, else stable default (not a fresh UUID).
  const resolutionCareSessionId = resolveDurableCareKey({
    care_session_id: params.care_session_id,
    caregiver_id: params.telemetry_user_id,
  });
  const resolutionEngineLayer = processResolutionEngineLayer({
    input: structuredInput.raw_input,
    careSessionId: resolutionCareSessionId,
    userId: params.telemetry_user_id,
    sourceType: params.source_type ?? (documentIntake.is_document_input ? "document" : "text"),
    applyDetectedEvidence: true,
    situationTitle: structuredInput.raw_input.slice(0, 120),
  });
  if (!resolutionEngineLayer.guarantee.ok) {
    console.warn(
      "[analyze-pipeline] resolution engine guarantee violations:",
      resolutionEngineLayer.guarantee.violations,
    );
  }
  const resolutionEngineObservation = formatResolutionEngineObservation(
    resolutionEngineLayer,
  );
  const stateSituations = syncTrackedSituationsToState(
    resolutionCareSessionId,
    resolutionEngineLayer.situations,
    { summary: structuredInput.raw_input.slice(0, 200) },
  );

  // BELIEF UPDATE — assumption + missing_information unify into BeliefItem store.
  const assumptionRegistryLayer = processAssumptionRegistryLayer({
    telemetry_user_id: params.telemetry_user_id,
    input: structuredInput.raw_input,
    careProfile: careProfileLayer.state.profile,
    careContext: situationalCareContext.context,
    trackedSituations: resolutionEngineLayer.situations,
  });
  if (!assumptionRegistryLayer.guarantee.ok) {
    console.warn(
      "[analyze-pipeline] assumption registry guarantee violations:",
      assumptionRegistryLayer.guarantee.violations,
    );
  }
  behaviorProfile = applyAssumptionRegistryBehaviorWeighting(
    behaviorProfile,
    assumptionRegistryLayer,
  );
  const assumptionRegistryObservation = formatAssumptionRegistryObservation(
    assumptionRegistryLayer,
  );

  const missingInformationQueueLayer = processMissingInformationQueueLayer({
    telemetry_user_id: params.telemetry_user_id,
    input: structuredInput.raw_input,
    careProfile: careProfileLayer.state.profile,
    careContext: situationalCareContext.context,
    trackedSituations: resolutionEngineLayer.situations,
    timeEngine: timeEngineLayer,
    clarityGate,
    memoryState: memoryInfluenceLayer.state,
  });
  if (!missingInformationQueueLayer.guarantee.ok) {
    console.warn(
      "[analyze-pipeline] missing information queue guarantee violations:",
      missingInformationQueueLayer.guarantee.violations,
    );
  }
  behaviorProfile = applyMissingInformationQueueBehaviorWeighting(
    behaviorProfile,
    missingInformationQueueLayer,
  );
  const missingInformationQueueObservation = formatMissingInformationQueueObservation(
    missingInformationQueueLayer,
  );

  const beliefUserId = params.telemetry_user_id ?? resolutionCareSessionId;
  const unifiedBeliefs = syncLegacyBeliefsToStore({
    userId: beliefUserId,
    assumptions: assumptionRegistryLayer.state.assumptions,
    missingInformation: missingInformationQueueLayer.state.items,
  });

  // DERIVED COMPUTATION — pure functions over STATE + BELIEF (no persistent engines).
  // Demand Engine (STATE actions) → Caregiver Load (DERIVED) → Priority ranks demands.
  const demandEngineLayer = processDemandEngineLayer({
    careSessionId: resolutionCareSessionId,
    trackedSituations: resolutionEngineLayer.situations,
    careContext: situationalCareContext.context,
    beliefs: unifiedBeliefs,
  });
  if (!demandEngineLayer.guarantee.ok) {
    console.warn(
      "[analyze-pipeline] demand engine guarantee violations:",
      demandEngineLayer.guarantee.violations,
    );
  }
  const demandEngineObservation = formatDemandEngineObservation(demandEngineLayer);

  // STATE ownership — after Demand Engine, before Priority / Decision.
  const responsibilityGraphLayer = processResponsibilityGraphLayer({
    telemetry_user_id: params.telemetry_user_id,
    careSessionId: resolutionCareSessionId,
    input: structuredInput.raw_input,
    careProfile: careProfileLayer.state.profile,
    demands: demandEngineLayer.output.allDemands,
  });
  if (!responsibilityGraphLayer.guarantee.ok) {
    console.warn(
      "[analyze-pipeline] responsibility graph guarantee violations:",
      responsibilityGraphLayer.guarantee.violations,
    );
  }
  const responsibilityGraphObservation = formatResponsibilityGraphObservation(
    responsibilityGraphLayer,
  );

  const caregiverLoadLayer = processCaregiverLoadLayer({
    demands: demandEngineLayer.output.allDemands,
    unresolvedSituationCount: resolutionEngineLayer.active.length,
    beliefs: unifiedBeliefs,
    careProfile: careProfileLayer.state.profile,
    careContext: situationalCareContext.context,
    pendingConflictCount:
      careProfileLayer.state.pendingConflicts.length +
      responsibilityGraphLayer.envelope.health.conflictCount,
    uncertaintyLoadFloor: highSignalStressBoosts.uncertaintyLoadFloor,
    conflictLoadFloor: highSignalStressBoosts.conflictLoadFloor,
    interactionLoadLayer,
  });
  if (!caregiverLoadLayer.guarantee.ok) {
    console.warn(
      "[analyze-pipeline] caregiver load guarantee violations:",
      caregiverLoadLayer.guarantee.violations,
    );
  }
  const caregiverLoadObservation = formatCaregiverLoadObservation(caregiverLoadLayer);
  const surfaceDemands = selectSurfaceDemandsForLoad(
    demandEngineLayer.rankedActive,
    caregiverLoadLayer,
  );
  const deferredDemandTitles = shapeWhatCanWaitFromDeferredDemands(
    demandEngineLayer.rankedActive,
    surfaceDemands,
  );

  const emotionalLoadSignalLayer = processEmotionalLoadSignalLayer({
    caregiverLoad: caregiverLoadLayer.load,
    demands: demandEngineLayer.output.allDemands,
    beliefs: unifiedBeliefs,
    activeSituations: resolutionEngineLayer.active,
    memoryEnvelope: memoryInfluenceLayer.envelope,
    depletion: caregiverDepletion,
    careProfile: careProfileLayer.state.profile,
    careContext: situationalCareContext.context,
    pendingConflictCount: responsibilityGraphLayer.envelope.health.conflictCount,
    governanceSettings,
    baseTopN: caregiverLoadLayer.surfaceLimit,
    loadInterpretation,
    interactionLoadLayer,
  });
  if (!emotionalLoadSignalLayer.guarantee.ok) {
    console.warn(
      "[analyze-pipeline] emotional load signal guarantee violations:",
      emotionalLoadSignalLayer.guarantee.violations,
    );
  }
  const emotionalLoadObservation = formatEmotionalLoadSignalObservation(
    emotionalLoadSignalLayer,
  );

  // Unify ELS operational burnout into master load engine.
  const elsBurnout = emotionalLoadSignalLayer.signal.burnoutProbability.value;
  if (elsBurnout > caregiverLoadEngine.state.burnout.probability) {
    caregiverLoadEngine = processCaregiverLoadEngine({
      rawInput: structuredInput.raw_input,
      highSignalStress,
      interactionLoadLayer,
      emotionalBurnoutProbability: elsBurnout,
    });
    Object.assign(loadInterpretation, caregiverLoadEngine.loadInterpretation);
  }

  // Step 4f: ATTENTION ENGINE — after load scoring, before Priority / Decision assembly.
  const attentionLayer: AttentionLayerResult = processAttentionLayer({
    rawInput: structuredInput.raw_input,
    urgencyDetection,
    caregiverLoadEngine,
    interactionLoadLayer,
    safetyOverrideEngaged: safetyOverride.state.active,
  });
  const attentionObservation = formatAttentionObservation(attentionLayer);

  const earlyPsychologicalLoad = processCaregiverPsychologicalLoad({
    userInput: structuredInput.raw_input,
    caregiverLoad: caregiverLoadLayer.load,
    emotionalLoadSignalLayer,
    depletion: caregiverDepletion,
    assumptionHints: assumptionRegistryLayer.envelope.influenceHints,
    memoryLabels: [
      ...memoryInfluenceLayer.state.memory.identityMemory.entries
        .slice(0, 6)
        .map((e) => e.influenceLabel),
    ],
    unresolvedSituationCount: resolutionEngineLayer.active.length,
    openConflictCount: responsibilityGraphLayer.envelope.health.conflictCount,
    deferredDemandTitles,
    highSignalStress,
  });
  if (!earlyPsychologicalLoad.guarantee.ok) {
    console.warn(
      "[analyze-pipeline] psychological load guarantee violations:",
      earlyPsychologicalLoad.guarantee.violations,
    );
  }
  const psychologicalLoadObservation = formatCaregiverPsychologicalLoadObservation(
    earlyPsychologicalLoad,
  );

  let effectiveSurfaceDemands = surfaceDemands;
  if (earlyPsychologicalLoad.containmentMode.engaged) {
    effectiveSurfaceDemands = surfaceDemands.slice(
      0,
      earlyPsychologicalLoad.containmentMode.maxActions,
    );
  } else if (loadInterpretation.loadFirstMode) {
    effectiveSurfaceDemands = surfaceDemands.slice(0, 1);
  } else if (
    interactionLoadLayer.outputStrategy === "interaction_survivability" &&
    interactionLoadLayer.sleepProtectionMode.engaged
  ) {
    effectiveSurfaceDemands = surfaceDemands.slice(
      0,
      interactionLoadLayer.sleepProtectionMode.maxActions,
    );
  } else if (interactionLoadLayer.detected) {
    effectiveSurfaceDemands = surfaceDemands.slice(0, 2);
  }

  // Early conflict pass (no priority conflicts yet) — soft-lowers BELIEF for PriorityContract.
  const conflictScopeId = params.telemetry_user_id ?? resolutionCareSessionId;
  const earlyConflictDetection = processConflictDetection({
    scopeId: conflictScopeId,
    situationId:
      resolutionEngineLayer.active[0]?.id ??
      resolutionEngineLayer.situations[0]?.id,
    userInput: structuredInput.raw_input,
    memoryLabels: [
      ...memoryInfluenceLayer.state.memory.identityMemory.entries
        .slice(0, 8)
        .map((e) => e.influenceLabel),
      ...memoryInfluenceLayer.state.memory.operationalMemory.entries
        .slice(0, 8)
        .map((e) => e.influenceLabel),
    ],
    assumptionHints: [...assumptionRegistryLayer.envelope.influenceHints],
    responsibilityHints: [
      ...responsibilityGraphLayer.state.conflicts
        .filter((c) => !c.resolved)
        .slice(0, 5)
        .map((c) => c.detail),
      ...(responsibilityGraphLayer.envelope.escalate
        ? [responsibilityGraphLayer.envelope.health.summary]
        : []),
    ],
    assumptionInvalidations: assumptionRegistryLayer.invalidations,
    highMissingInfoCount: Math.max(
      missingInformationQueueLayer.envelope.highPriorityOpenCount,
      unifiedBeliefs.filter(
        (b) =>
          b.type === "missing_information" &&
          b.status === "active" &&
          b.importance === "HIGH",
      ).length,
    ),
    emotionalContradictionHints: emotionalContradictionHints(
      earlyPsychologicalLoad.emotionalContradictionLoops,
    ),
  });

  const layeredRisk = computeRisk(stateSituations, unifiedBeliefs);
  const layeredPriority = computePriority({
    situations: stateSituations,
    beliefs: unifiedBeliefs,
    risk: layeredRisk,
    demands: demandEngineLayer.output.activeDemands,
    conflictBelief: {
      confidencePenalty: earlyConflictDetection.envelope.confidencePenalty,
      criticalDecisionRestricted:
        earlyConflictDetection.criticalDecisionRestricted,
      clarificationQuestion:
        earlyConflictDetection.envelope.clarification?.question ?? null,
    },
  });
  // Early derived health exists for gate semantics; full merge happens post-document refresh.
  void computeHealthSummary(stateSituations, unifiedBeliefs);
  void computeAutonomyGate(stateSituations, unifiedBeliefs);

  // Facade: legacy risk/priority process APIs (thin wrap path kept for verify scripts).
  const situationRiskRegisterLayer = processSituationRiskRegisterLayer({
    trackedSituations: resolutionEngineLayer.situations,
    careContext: situationalCareContext.context,
    careProfile: careProfileLayer.state.profile,
    timeEngine: timeEngineLayer,
    urgencyDetection,
    missingInformationState: missingInformationQueueLayer.state,
    missingInformationEnvelope: missingInformationQueueLayer.envelope,
    assumptionEnvelope: assumptionRegistryLayer.envelope,
  });
  if (!situationRiskRegisterLayer.guarantee.ok) {
    console.warn(
      "[analyze-pipeline] situation risk register guarantee violations:",
      situationRiskRegisterLayer.guarantee.violations,
    );
  }
  behaviorProfile = applySituationRiskRegisterBehaviorWeighting(
    behaviorProfile,
    situationRiskRegisterLayer,
  );
  const situationRiskRegisterObservation = formatSituationRiskRegisterObservation(
    situationRiskRegisterLayer,
  );

  const priorityEngineLayer = processPriorityEngineLayer({
    timeEngine: timeEngineLayer,
    memoryState: memoryInfluenceLayer.state,
    memoryEnvelope: memoryInfluenceLayer.envelope,
    assumptionEnvelope: assumptionRegistryLayer.envelope,
    missingInformationEnvelope: missingInformationQueueLayer.envelope,
    systemRiskEnvelope: situationRiskRegisterLayer.priorityEnvelope,
    careProfile: careProfileLayer.state.profile,
    careContext: situationalCareContext.context,
    depletion: caregiverDepletion,
    urgencyDetection,
    governanceSettings,
    trackedSituations: resolutionEngineLayer.situations,
    // CLI + Emotional Load Signal shape recommendation count.
    topN: emotionalLoadSignalLayer.priorityAdjustment.adjustedTopN,
    emotionalLoadSignal: emotionalLoadSignalLayer,
  });
  if (!priorityEngineLayer.guarantee.ok) {
    console.warn(
      "[analyze-pipeline] priority engine guarantee violations:",
      priorityEngineLayer.guarantee.violations,
    );
  }
  behaviorProfile = applyPriorityEngineBehaviorWeighting(
    behaviorProfile,
    priorityEngineLayer,
  );
  const priorityEngineObservation = formatPriorityEngineObservation(priorityEngineLayer);

  // DETERMINISTIC PRIORITIZATION — issue ranking + fixed-schema compression (before final assembly).
  // Priority Contract still owns Situation ranking; this engine owns issue→Decision Snapshot compression.
  const deterministicPriorityLayer: DeterministicPrioritizationLayerResult =
    processDeterministicPrioritization({
      input: structuredInput.raw_input,
    });
  if (!deterministicPriorityLayer.guarantee.ok) {
    console.warn(
      "[analyze-pipeline] deterministic prioritization guarantee violations:",
      deterministicPriorityLayer.guarantee.violations,
    );
  } else {
    caseMemoryLayer = {
      ...caseMemoryLayer,
      snapshot: mergeDecisionSnapshotFromPrioritization(
        caseMemoryLayer.snapshot,
        deterministicPriorityLayer,
      ),
    };
  }

  const prioritizationEngineLayer: PrioritizationEngineLayerResult =
    processPrioritizationEngine({
      input: structuredInput.raw_input,
      loadScores: {
        emotionalLoadScore: caregiverLoadEngine.state.scores.emotionalLoadScore,
        cognitiveLoadScore: caregiverLoadEngine.state.scores.cognitiveLoadScore,
        sleepRiskScore: caregiverLoadEngine.state.scores.sleepRiskScore,
      },
    });
  if (prioritizationEngineLayer.itemCount >= 2) {
    caseMemoryLayer = {
      ...caseMemoryLayer,
      snapshot: {
        ...caseMemoryLayer.snapshot,
        ...overlayDecisionSnapshotFields(caseMemoryLayer.snapshot, prioritizationEngineLayer),
      },
    };
  }

  // CONTEXT WEIGHTING + CONFLICT DETECTION — soft influence / flag only (before decision emit).
  const contextWeighting = processContextWeighting({
    userInput: structuredInput.raw_input,
    assumptionHints: [...assumptionRegistryLayer.envelope.influenceHints],
    memoryLabels: memoryInfluenceLayer.state.memory.identityMemory.entries
      .slice(0, 5)
      .map((e) => ({
        id: e.id,
        label: e.influenceLabel,
        confidence: e.confidence,
      })),
  });
  // HIGH importance missing_information + CRITICAL medical conflicts block irreversible decisions.
  const conflictDetection = processConflictDetection({
    scopeId: conflictScopeId,
    situationId:
      resolutionEngineLayer.active[0]?.id ??
      resolutionEngineLayer.situations[0]?.id,
    userInput: structuredInput.raw_input,
    memoryLabels: [
      ...memoryInfluenceLayer.state.memory.identityMemory.entries
        .slice(0, 8)
        .map((e) => e.influenceLabel),
      ...memoryInfluenceLayer.state.memory.operationalMemory.entries
        .slice(0, 8)
        .map((e) => e.influenceLabel),
    ],
    assumptionHints: [...assumptionRegistryLayer.envelope.influenceHints],
    responsibilityHints: [
      ...responsibilityGraphLayer.state.conflicts
        .filter((c) => !c.resolved)
        .slice(0, 5)
        .map((c) => c.detail),
      ...(responsibilityGraphLayer.envelope.escalate
        ? [responsibilityGraphLayer.envelope.health.summary]
        : []),
    ],
    priorityConflicts: priorityEngineLayer.conflicts,
    assumptionInvalidations: assumptionRegistryLayer.invalidations,
    highMissingInfoCount: Math.max(
      missingInformationQueueLayer.envelope.highPriorityOpenCount,
      unifiedBeliefs.filter(
        (b) =>
          b.type === "missing_information" &&
          b.status === "active" &&
          b.importance === "HIGH",
      ).length,
    ),
    emotionalContradictionHints: emotionalContradictionHints(
      earlyPsychologicalLoad.emotionalContradictionLoops,
    ),
  });
  const conflictBelief = {
    confidencePenalty: conflictDetection.envelope.confidencePenalty,
    criticalDecisionRestricted: conflictDetection.criticalDecisionRestricted,
    clarificationQuestion:
      conflictDetection.envelope.clarification?.question ?? null,
  };
  void formatConflictDetectionObservation(conflictDetection);
  const highMissingInfoBlocked =
    layeredPriority.highMissingInfoBlocked ||
    missingInformationQueueLayer.envelope.highPriorityOpenCount > 0 ||
    conflictDetection.criticalDecisionRestricted;
  if (detectInputOverload(structuredInput)) {
    collector.record({
      ...classifyOverloadFailure(),
      retry_count: 0,
    });
  }

  let lastZodValid: SolenOSResponse | null = null;
  let lastFingerprint: ReturnType<typeof fingerprintOutput> | null = null;

  for (let attempt = 0; attempt <= ANALYZE_MAX_RETRIES; attempt++) {
    // Step 8: STRUCTURED RESPONSE GENERATION
    const raw = await invokeGeminiExecution({
      contextWindow,
      documentIntake,
      groundingContext: preReasoning.grounding_context,
      envelopeOptions: {
        behaviorProfile,
        urgencyDetection,
        safetyOverrideLine: safetyOverride.constraint_line,
        observationTags: [
          situationalCareContextObservation,
          careContextObservation,
          timeEngineObservation,
          resolutionEngineObservation,
          demandEngineObservation,
          responsibilityGraphObservation,
          caregiverLoadObservation,
          emotionalLoadObservation,
          psychologicalLoadObservation,
          loadInterpretationObservation,
          highSignalStressObservation,
          interactionLoadObservation,
          attentionObservation,
          assumptionRegistryObservation,
          missingInformationQueueObservation,
          situationRiskRegisterObservation,
          priorityEngineObservation,
          ...depletionObservations,
          ...(guiltReplayObservation ? [guiltReplayObservation] : []),
          ...(clarityGate.constraintLine ? [clarityGate.constraintLine] : []),
        ],
      },
      apiKey: params.geminiApiKey,
      model: params.geminiModel,
      retry: attempt > 0,
      userLanguage,
    });

    // Step 9: RESPONSE VALIDATION
    const structural = validateStructuralLayer(raw);
    if (!structural.ok) {
      collector.record({
        ...classifyStructuralFailure(structural.kind),
        retry_count: attempt,
      });
      continue;
    }

    const fingerprint = fingerprintOutput(structural.data);
    if (lastFingerprint && fingerprintsDiverge(lastFingerprint, fingerprint)) {
      collector.record({
        ...classifyInferenceInconsistency(),
        retry_count: attempt,
      });
    }
    lastFingerprint = fingerprint;
    lastZodValid = structural.data;

    if (!isGroundingValid(structural.data, structuredInput, contextWindow)) {
      collector.record({
        ...classifyGroundingFailure(),
        retry_count: attempt,
      });
      continue;
    }

    if (!isChaosToClarityValid(structural.data, structuredInput)) {
      collector.record({
        ...classifyChaosToClarityFailure(),
        retry_count: attempt,
      });
      continue;
    }

    if (!isSemanticRoleIsolationValid(structural.data)) {
      collector.record({
        ...classifySemanticRoleIsolationFailure(),
        retry_count: attempt,
      });
      continue;
    }

    if (!isCognitiveCompressionValid(structural.data, structuredInput.raw_input)) {
      collector.record({
        ...classifyCognitiveCompressionFailure(),
        retry_count: attempt,
      });
      continue;
    }

    if (!isUrgencyEscalationValid(structural.data, structuredInput, inputClassification.mode)) {
      collector.record({
        ...classifyUrgencyEscalationFailure(),
        retry_count: attempt,
      });
      continue;
    }

    if (!isSafetyOverrideValid(structural.data, safetyOverride.state)) {
      collector.record({
        ...classifySafetyOverrideFailure(),
        retry_count: attempt,
      });
      continue;
    }

    if (!isUnknownStateValid(structural.data, structuredInput)) {
      collector.record({
        ...classifyUnknownStateFailure(),
        retry_count: attempt,
      });
      continue;
    }

    if (!isDocumentIntakeValid(structural.data, documentIntake)) {
      collector.record({
        ...classifyDocumentIntakeFailure(),
        retry_count: attempt,
      });
      continue;
    }

    const determinism = runDeterminismGate({
      rawParsed: structural.rawParsed,
      validated: structural.data,
      normalizedInput: structuredInput.raw_input,
    });
    if (!determinism.ok) {
      collector.record({
        ...classifyDeterminismFailure(determinism.failure_type),
        retry_count: attempt,
      });
      continue;
    }

    const medicalBoundary = enforceMedicalBoundary(structural.data);
    if (!medicalBoundary.valid) {
      collector.record({
        ...classifyMedicalBoundaryFailure(),
        retry_count: attempt,
      });
      continue;
    }

    const safeOutput = medicalBoundary.output;

    const epistemic = enforceEpistemicSafety(safeOutput, structuredInput);
    if (!epistemic.valid) {
      collector.record({
        ...classifyEpistemicSafetyFailure(),
        retry_count: attempt,
      });
      continue;
    }

    // Decision integration — recommendations must name an owner when known.
    const epistemicOutput = {
      ...epistemic.output,
      what_to_ask_next: applyResponsibilityOwnerToAction(
        responsibilityGraphLayer,
        epistemic.output.what_to_ask_next,
      ),
    };

    if (!isEmotionalStabilizationValid(epistemicOutput, structuredInput)) {
      collector.record({
        ...classifyEmotionalStabilizationFailure(),
        retry_count: attempt,
      });
      continue;
    }

    if (!isCalibratedUncertaintyValid(epistemicOutput)) {
      collector.record({
        ...classifyCalibratedUncertaintyFailure(),
        retry_count: attempt,
      });
      continue;
    }

    if (!isCognitiveClarityValid(epistemicOutput)) {
      collector.record({
        ...classifyCognitiveClarityFailure(),
        retry_count: attempt,
      });
      continue;
    }

    if (!isNonConversationalValid(epistemicOutput)) {
      collector.record({
        ...classifyNonConversationalFailure(),
        retry_count: attempt,
      });
      continue;
    }

    if (!isEpisodicReliefValid(epistemicOutput)) {
      collector.record({
        ...classifyEpisodicReliefFailure(),
        retry_count: attempt,
      });
      continue;
    }

    if (!isPressureReductionValid(epistemicOutput)) {
      collector.record({
        ...classifyPressureReductionFailure(),
        retry_count: attempt,
      });
      continue;
    }

    if (!isOutputCompressionValid(epistemicOutput, behaviorProfile, safetyOverride.state)) {
      collector.record({
        ...classifyOutputCompressionFailure(),
        retry_count: attempt,
      });
      continue;
    }

    if (!isOutputQualityValid(epistemicOutput)) {
      collector.record({
        ...classifyQualityFailure(),
        retry_count: attempt,
      });
      continue;
    }

    if (!isNonAssistantOutputValid(epistemicOutput)) {
      collector.record({
        ...classifyNonAssistantOutputFailure(),
        retry_count: attempt,
      });
      continue;
    }

    let governance = applySituationRiskRegisterGovernanceWeighting(
      applyMissingInformationQueueGovernanceWeighting(
      applyAssumptionRegistryGovernanceWeighting(
      applyPriorityEngineGovernanceWeighting(
        applyTimeEngineGovernanceWeighting(
          applyMemoryInfluenceGovernanceWeighting(
            applyCareProfileGovernanceWeighting(
              applyCareContextGovernanceWeighting(
                applySettingsGovernance(
                  epistemicOutput,
                  governanceSettings ?? DEFAULT_SOLENOS_SETTINGS,
                  { validatedRiskLevel: epistemicOutput.risk_level },
                ),
                situationalCareContext,
              ),
              careProfileLayer,
            ),
            memoryInfluenceLayer,
          ),
          timeEngineLayer,
        ),
        priorityEngineLayer,
      ),
      assumptionRegistryLayer,
    ),
      missingInformationQueueLayer,
    ),
      situationRiskRegisterLayer,
    );
    if (!governance.guarantee.ok) {
      console.warn(
        "[analyze-pipeline] governance guarantee violations:",
        governance.guarantee.violations,
      );
    }

    if (loadInterpretation.loadFirstMode) {
      governance = {
        ...governance,
        response: shapeLoadFirstOutput({
          response: governance.response,
          interpretation: loadInterpretation,
          deferredDemandTitles,
        }),
      };
    }

    if (highSignalStress.acuteCaregiverBurnoutRiskState) {
      governance = {
        ...governance,
        response: shapeContainmentOutput({
          response: governance.response,
          highSignalStress,
          deferredDemandTitles,
        }),
      };
    }

    if (interactionLoadLayer.outputStrategy === "interaction_survivability") {
      governance = {
        ...governance,
        response: shapeInteractionSurvivabilityOutput({
          response: governance.response,
          layer: interactionLoadLayer,
          deferredDemandTitles,
        }),
      };
    }

    governance = {
      ...governance,
      response: shapeBehavioralResponse({
        response: governance.response,
        classification: attentionLayer.classification,
        scores: caregiverLoadEngine.state.scores,
        signals: caregiverLoadEngine.state.signals,
        suppressEducation:
          caregiverLoadEngine.state.loadFirstMode ||
          caregiverLoadEngine.state.actionReduction.suppressEducation,
        loadSignalsPresent: caregiverLoadEngine.state.signals.matchedFamilies.length > 0,
      }),
    };

    // DOCUMENT INTELLIGENCE LAYER — after Action Generator; before Output Assembly.
    // Transforms raw document text into graph nodes; does NOT feed LLM or auto-write memory.
    const documentIntelligence = processDocumentIntelligenceLayer({
      rawInput: structuredInput.raw_input,
      documentIntake,
      careContextIds: situationalCareContext.context.recentEvents.slice(0, 3),
    });
    if (!documentIntelligence.guarantee.ok) {
      console.warn(
        "[analyze-pipeline] document intelligence guarantee violations:",
        documentIntelligence.guarantee.violations,
      );
    }
    const documentIntelligencePayload = toDocumentIntelligenceLayerPayload(documentIntelligence);

    const refreshedAssumptionRegistry = refreshAssumptionRegistryFromDocuments(
      assumptionRegistryLayer,
      documentIntelligence,
      params.telemetry_user_id,
    );

    const refreshedMissingInformationQueue = refreshMissingInformationQueueFromDocuments(
      missingInformationQueueLayer,
      documentIntelligence,
      {
        telemetry_user_id: params.telemetry_user_id,
        input: structuredInput.raw_input,
        situationId: resolutionEngineLayer.active[0]?.id,
      },
    );

    // Re-sync BELIEF after document-driven refreshes; recompute derived health gate.
    const refreshedBeliefs = syncLegacyBeliefsToStore({
      userId: beliefUserId,
      assumptions: refreshedAssumptionRegistry.state.assumptions,
      missingInformation: refreshedMissingInformationQueue.state.items,
    });
    const refreshedLayeredHealth = computeHealthSummary(stateSituations, refreshedBeliefs);
    const refreshedAutonomyGate = computeAutonomyGate(stateSituations, refreshedBeliefs);

    // SYSTEM HEALTH — EXPLANATION derived summary; gating via computeAutonomyGate(STATE,BELIEF).
    // Soft-reconcile: facade process still runs; autonomy constraints merge derived gate.
    const systemHealthLayer = processSystemHealthLayer({
      careContextLayer: situationalCareContext,
      memoryInfluenceLayer,
      assumptionRegistryLayer: refreshedAssumptionRegistry,
      missingInformationQueueLayer: refreshedMissingInformationQueue,
      documentIntelligence,
      priorityEngineLayer,
      stressNormalized: structuredInput,
      clarityGate,
      currentAutonomy: governance.routing.decisionAutonomy,
      situations: {
        activeSituations: resolutionEngineLayer.active.length,
        blockedSituations: 0,
        unresolvedSituations: resolutionEngineLayer.active.length,
        titles: resolutionEngineLayer.active.map((s) => s.title),
        totalRiskExposure: situationRiskRegisterLayer.systemRisk.totalRiskExposure,
      },
    });
    if (!systemHealthLayer.guarantee.ok) {
      console.warn(
        "[analyze-pipeline] system health guarantee violations:",
        systemHealthLayer.guarantee.violations,
      );
    }
    // Merge derived autonomy gate (STATE+BELIEF) into health gate — not a separate health engine.
    systemHealthLayer.gate = {
      ...systemHealthLayer.gate,
      constrainAutonomy:
        systemHealthLayer.gate.constrainAutonomy || refreshedAutonomyGate.constrainAutonomy,
      boostUncertainty:
        systemHealthLayer.gate.boostUncertainty || refreshedAutonomyGate.boostUncertainty,
      requestClarification:
        systemHealthLayer.gate.requestClarification ||
        refreshedAutonomyGate.requestClarification,
      reasons: [
        ...new Set([...systemHealthLayer.gate.reasons, ...refreshedAutonomyGate.reasons]),
      ],
    };
    governance = applySystemHealthGovernanceWeighting(governance, systemHealthLayer);
    const systemHealthPayload = toSystemHealthLayerPayload(systemHealthLayer);

    // Decision Engine assembly (chosen action + rejected alternatives) — before Fail-Safe + Human Trust + Safety.
    const topAction =
      layeredPriority.topDemandId ??
      priorityEngineLayer.rankedForActionGenerator[0]?.actionId ??
      layeredPriority.topActionId ??
      "clarify_before_action";
    const topDemand =
      demandEngineLayer.rankedActive.find((d) => d.id === topAction) ??
      effectiveSurfaceDemands[0] ??
      demandEngineLayer.rankedActive[0];
    const rejectedAlternatives = [
      ...demandEngineLayer.rankedActive
        .filter((d) => d.id !== topAction)
        .slice(0, caregiverLoadLayer.surfaceLimit + 2)
        .map((d) => ({ id: d.id, label: d.title })),
      ...priorityEngineLayer.rankedForActionGenerator
        .filter((v) => v.actionId !== topAction)
        .map((v) => ({ id: v.actionId, label: v.actionId })),
    ]
      .filter((v, i, arr) => arr.findIndex((x) => x.id === v.id) === i)
      .slice(0, 5);

    // EMOTIONAL LOAD SIGNAL — AFTER Decision Engine, BEFORE Fail-Safe Mode.
    const postDecisionEmotionalLoad = applyPostDecisionEmotionalLoad({
      layer: emotionalLoadSignalLayer,
      chosenActionId: topAction,
      chosenDemand: topDemand,
      baseSurfaceLimit: caregiverLoadLayer.surfaceLimit,
      riskContext: {
        outputRiskLevel: governance.response.risk_level,
        priorityOverrideApplied: layeredPriority.priorityOverrideApplied,
        medicalOrTimeSensitive:
          layeredPriority.priorityOverrideApplied ||
          situationalCareContext.context.situationType === "emergency" ||
          situationalCareContext.context.urgencyLevel === "CRITICAL" ||
          situationalCareContext.context.urgencyLevel === "HIGH",
        topRiskLevel: layeredRisk.situationRisks.reduce<
          "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | undefined
        >((max, r) => {
          const order = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };
          if (!max) return r.baseLevel;
          return order[r.baseLevel] > order[max] ? r.baseLevel : max;
        }, undefined),
      },
    });
    if (!postDecisionEmotionalLoad.guarantee.ok) {
      console.warn(
        "[analyze-pipeline] post-decision emotional load guarantee violations:",
        postDecisionEmotionalLoad.guarantee.violations,
      );
    }

    const finalPsychologicalLoad = processCaregiverPsychologicalLoad({
      userInput: structuredInput.raw_input,
      caregiverLoad: caregiverLoadLayer.load,
      emotionalLoadSignalLayer,
      postDecisionEmotionalLoad,
      depletion: caregiverDepletion,
      assumptionHints: refreshedAssumptionRegistry.envelope.influenceHints,
      memoryLabels: [
        ...memoryInfluenceLayer.state.memory.identityMemory.entries
          .slice(0, 6)
          .map((e) => e.influenceLabel),
      ],
      unresolvedSituationCount: resolutionEngineLayer.active.length,
      openConflictCount: conflictDetection.envelope.openCount,
      deferredDemandTitles,
      protectionModeEngaged: postDecisionEmotionalLoad.protectionMode.engaged,
      highSignalStress,
    });
    if (!finalPsychologicalLoad.guarantee.ok) {
      console.warn(
        "[analyze-pipeline] final psychological load guarantee violations:",
        finalPsychologicalLoad.guarantee.violations,
      );
    }

    const containmentSurfaceDemands = finalPsychologicalLoad.containmentMode.engaged
      ? effectiveSurfaceDemands.slice(0, finalPsychologicalLoad.containmentMode.maxActions)
      : effectiveSurfaceDemands;

    // FAIL-SAFE MODE — AFTER Emotional Load Signal, BEFORE Human Trust.
    // Derived gate: do not guess; escalate HIGH missing info; clarification posture only when engaged.
    const failSafeMode = processFailSafeMode({
      chosenActionId: topAction,
      chosenActionLabel: topDemand?.title ?? topAction,
      rejectedAlternatives,
      knownFacts: [
        topDemand?.title ?? topAction,
        ...(layeredPriority.explanationLines ?? []).slice(0, 2),
      ],
      missingInfoQuestions: refreshedMissingInformationQueue.envelope.needsNext,
      highMissingInfoBlocked,
      highPriorityMissingInfoCount:
        refreshedMissingInformationQueue.envelope.highPriorityOpenCount,
      openConflictCount: conflictDetection.envelope.openCount,
      criticalDecisionRestricted: conflictDetection.criticalDecisionRestricted,
      reEvaluationRequired: conflictDetection.reEvaluationRequired,
      conflictClarificationQuestion:
        conflictDetection.envelope.clarification?.question ?? null,
      responsibilityEscalate: responsibilityGraphLayer.envelope.escalate,
      responsibilityHealthState: responsibilityGraphLayer.envelope.health.state,
      criticalUnassignedCount:
        responsibilityGraphLayer.envelope.health.criticalUnassignedCount,
      unassignedCount: responsibilityGraphLayer.envelope.health.unassignedCount,
      ownershipConflictCount: responsibilityGraphLayer.envelope.health.conflictCount,
      outputRiskLevel: governance.response.risk_level,
      priorityOverrideApplied: layeredPriority.priorityOverrideApplied,
      careContextUrgency: situationalCareContext.context.urgencyLevel,
      medicalOrTimeSensitive:
        layeredPriority.priorityOverrideApplied ||
        situationalCareContext.context.situationType === "emergency" ||
        situationalCareContext.context.urgencyLevel === "CRITICAL" ||
        situationalCareContext.context.urgencyLevel === "HIGH",
      confidenceCap: layeredPriority.confidenceCap,
      conflictConfidencePenalty: conflictDetection.envelope.confidencePenalty,
      systemHealthBand: systemHealthLayer.band,
      systemHealthRequestClarification: systemHealthLayer.gate.requestClarification,
      systemHealthBoostUncertainty: systemHealthLayer.gate.boostUncertainty,
      situationId:
        resolutionEngineLayer.active[0]?.id ??
        resolutionEngineLayer.situations[0]?.id ??
        null,
      userId: params.telemetry_user_id ?? null,
    });
    if (!failSafeMode.guarantee.ok) {
      console.warn(
        "[analyze-pipeline] fail-safe guarantee violations:",
        failSafeMode.guarantee.violations,
      );
    }
    const failSafePayload = toFailSafeModeLayerPayload(failSafeMode);
    const effectiveActionId = failSafeMode.effectiveActionId;
    const effectiveActionLabel = failSafeMode.effectiveActionLabel;

    // CRISIS PREVENTION — AFTER Fail-Safe, BEFORE Confidence + Delegation + Human Trust.
    const crisisPreventionLayer = processCrisisPreventionLayer({
      demands: demandEngineLayer.output.allDemands,
      activeSituations: resolutionEngineLayer.active.map((s) => ({
        id: s.id,
        title: s.title,
        priority: stateSituations.find((ss) => ss.id === s.id)?.priority,
        status: s.status,
      })),
      beliefs: refreshedBeliefs,
      caregiverLoadState: caregiverLoadLayer.load.state,
      caregiverLoadScore: caregiverLoadLayer.load.score,
      emotionalBurnoutProbability:
        emotionalLoadSignalLayer.signal.burnoutProbability.value,
      openConflictCount: conflictDetection.envelope.openCount,
      conflictLoadContribution: conflictDetection.envelope.conflictLoadContribution,
    });
    if (!crisisPreventionLayer.guarantee.ok) {
      console.warn(
        "[analyze-pipeline] crisis prevention guarantee violations:",
        crisisPreventionLayer.guarantee.violations,
      );
    }
    const crisisPreventionPayload = toCrisisPreventionLayerPayload(crisisPreventionLayer);

    // CONFIDENCE LAYER — feeds crisis probability into confidence decrease.
    const confidenceLayer = processConfidenceLayer({
      demands: demandEngineLayer.output.allDemands,
      activeSituations: resolutionEngineLayer.active.map((s) => ({
        id: s.id,
        title: s.title,
        priority: stateSituations.find((ss) => ss.id === s.id)?.priority,
        status: s.status,
      })),
      beliefs: refreshedBeliefs,
      caregiverLoadState: caregiverLoadLayer.load.state,
      caregiverLoadScore: caregiverLoadLayer.load.score,
      emotionalBurnoutProbability:
        emotionalLoadSignalLayer.signal.burnoutProbability.value,
      conflictConfidencePenalty: conflictDetection.envelope.confidencePenalty,
      openConflictCount: conflictDetection.envelope.openCount,
      criticalUnassignedCount:
        responsibilityGraphLayer.envelope.health.criticalUnassignedCount,
      failSafeEngaged: failSafeMode.engaged,
      crisisRisks: crisisPreventionLayer.risks,
    });
    if (!confidenceLayer.guarantee.ok) {
      console.warn(
        "[analyze-pipeline] confidence layer guarantee violations:",
        confidenceLayer.guarantee.violations,
      );
    }
    const confidencePayload = toConfidenceLayerPayload(confidenceLayer);

    const careRelationships = careProfileLayer.state.profile.careRelationships;
    const delegationLayer = processDelegationLayer({
      demands: demandEngineLayer.output.allDemands,
      ownershipEvals: responsibilityGraphLayer.envelope.ownershipEvals,
      persons: responsibilityGraphLayer.state.persons,
      loads: responsibilityGraphLayer.envelope.loads,
      caregiverLoadState: caregiverLoadLayer.load.state,
      primaryCaregiverName:
        responsibilityGraphLayer.envelope.ownershipEvals.find(
          (e) => e.demandId === topAction,
        )?.ownerNames[0] ??
        careRelationships.sharedCareWith[0] ??
        "Primary caregiver",
      sharedCaregivers: careRelationships.sharedCareWith,
      externalCaregivers: careRelationships.externalCaregivers,
    });
    if (!delegationLayer.guarantee.ok) {
      console.warn(
        "[analyze-pipeline] delegation layer guarantee violations:",
        delegationLayer.guarantee.violations,
      );
    }
    const delegationPayload = toDelegationLayerPayload(delegationLayer);

    // HUMAN TRUST LAYER — AFTER Confidence/Crisis/Delegation, BEFORE Safety Enforcement.
    // EXPLANATION only: deterministic from decision graph; never mutates the decision.
    const humanTrustLayer = processHumanTrustLayer({
      chosenActionId: effectiveActionId,
      chosenActionLabel: effectiveActionLabel,
      rejectedAlternatives,
      priorityExplanationLines: layeredPriority.explanationLines,
      priorityOverrideApplied: layeredPriority.priorityOverrideApplied,
      topSituationId: layeredPriority.topSituationId,
      demandRanking: demandEngineLayer.rankedActive.map((d) => ({
        id: d.id,
        title: d.title,
        pressureScore: d.pressureScore,
      })),
      conflictClarifications: conflictDetection.envelope.clarification
        ? [conflictDetection.envelope.clarification.question]
        : [],
      caregiverLoadState: caregiverLoadLayer.load.state,
      emotionalStress:
        memoryInfluenceLayer.envelope.emotionalBias > 0.35 ||
        caregiverLoadLayer.load.state === "HIGH" ||
        caregiverLoadLayer.load.state === "CRITICAL" ||
        emotionalLoadSignalLayer.signal.cognitiveFatigue.level === "HIGH" ||
        emotionalLoadSignalLayer.signal.cognitiveFatigue.level === "CRITICAL",
      caregiverProtectionMode: postDecisionEmotionalLoad.protectionMode.engaged,
      recommendationLoadMetadata: postDecisionEmotionalLoad.recommendationMetadata,
      highMissingInfoBlocked: highMissingInfoBlocked || failSafeMode.engaged,
      failSafeEngaged: failSafeMode.engaged,
      failSafeMustClarify: failSafeMode.clarification?.mustClarifyBeforeAction,
      assumptionsUsed: refreshedAssumptionRegistry.envelope.influenceHints.slice(0, 5),
      missingInfoImpact: [
        ...(failSafeMode.escalatedMissingInfoQuestions ?? []),
        ...refreshedMissingInformationQueue.envelope.needsNext,
      ].slice(0, 5),
      outputRiskLevel: governance.response.risk_level,
      deferredDemandTitles,
      confidenceExplanation: confidencePayload.explanation,
      crisisWarnings: crisisPreventionLayer.risks
        .filter((r) => r.probability >= 0.35)
        .slice(0, 2)
        .map((r) => r.explanation),
      delegationSuggestions: delegationLayer.suggestions,
      emotionalValidation: finalPsychologicalLoad.emotionalValidation,
      containmentMode: finalPsychologicalLoad.containmentMode.engaged
        ? {
            engaged: true,
            whatNotToDoToday: finalPsychologicalLoad.containmentMode.whatNotToDoToday,
            emphasizeWhatCanWait:
              finalPsychologicalLoad.containmentMode.emphasizeWhatCanWait,
          }
        : undefined,
      moralInjurySeverity: finalPsychologicalLoad.moralInjury.severity,
      identityDriftLevel: finalPsychologicalLoad.identityDrift.driftLevel,
      loadFirstMode: loadInterpretation.loadFirstMode,
      burdenSummary: loadInterpretation.burdenSummary,
      primaryContributors: loadInterpretation.primaryContributors,
      dependencyLoadScore: caregiverLoadEngine.state.scores.dependencyLoadScore,
      burnoutTrend: caregiverLoadEngine.state.burnout.trend,
      interactionLoadFlags: interactionLoadLayer.flags.length > 0
        ? interactionLoadLayer.flags.map((f) => ({ code: f.code, description: f.description }))
        : undefined,
      sleepProtectionMode: interactionLoadLayer.sleepProtectionMode.engaged,
      outputStrategy: interactionLoadLayer.outputStrategy,
      boundaryViolationIndex: interactionLoadLayer.metrics.boundaryViolationIndex,
      interactionLoadInsight: interactionLoadLayer.detected
        ? interactionLoadLayer.systemInsight
        : undefined,
    });
    if (!humanTrustLayer.guarantee.ok) {
      console.warn(
        "[analyze-pipeline] human trust guarantee violations:",
        humanTrustLayer.guarantee.violations,
      );
    }
    const humanTrustPayload = toHumanTrustLayerPayload(humanTrustLayer);

    const failSafeAdjustedResponse = applyFailSafeClarificationToResponse(
      governance.response,
      failSafeMode,
    );

    const baseSafetyControl = (governanceSettings ?? DEFAULT_SOLENOS_SETTINGS).safetyControl;
    const safetyEnforcement = enforceSafetyConstraints(failSafeAdjustedResponse, {
      safetyControl: {
        ...baseSafetyControl,
        alwaysShowUncertainty:
          baseSafetyControl.alwaysShowUncertainty ||
          systemHealthLayer.gate.boostUncertainty ||
          failSafeMode.engaged,
        noCertaintyMode:
          baseSafetyControl.noCertaintyMode ||
          systemHealthLayer.band === "Unreliable" ||
          failSafeMode.decisionConfidence.level === "LOW",
      },
      careContextUrgency: situationalCareContext.context.urgencyLevel,
      emergencySituation: situationalCareContext.context.situationType === "emergency",
      memoryCompositeInfluence: memoryInfluenceLayer.envelope.compositeInfluence,
      emotionalDistressSignal:
        memoryInfluenceLayer.envelope.emotionalBias > 0.35 ||
        emotionalLoadSignalLayer.signal.cognitiveFatigue.level !== "LOW",
      overloadSimplification:
        situationRiskRegisterLayer.overload ||
        caregiverLoadLayer.load.state === "HIGH" ||
        caregiverLoadLayer.load.state === "CRITICAL" ||
        postDecisionEmotionalLoad.outputConstraints.simplifyOutput ||
        interactionLoadLayer.sleepProtectionMode.engaged,
    });
    if (!safetyEnforcement.guarantee.ok) {
      console.warn(
        "[analyze-pipeline] safety enforcement guarantee violations:",
        safetyEnforcement.guarantee.violations,
      );
    }

    // CASE MEMORY PRP — shape SolenOS fields from 6-field Decision Snapshot (State A/B/C).
    const prpShapedResponse = shapeSolenOSFromDecisionSnapshot(
      safetyEnforcement.response,
      caseMemoryLayer.snapshot,
      caseMemoryLayer.policy.state,
    );

    const trustLayer = assembleTrustLayer(
      prpShapedResponse,
      structuredInput.raw_input,
      documentIntake,
      documentIntelligencePayload,
    );

    const enforcedResponse = applyRiskUncertaintyToResponse(
      trustLayer.response,
      riskUncertaintyLayer,
    );

    const multilingualCheck = validateMultilingualExecution(
      enforcedResponse,
      multilingualMeta,
      userLanguage,
    );
    if (!multilingualCheck.ok) {
      console.warn(
        "[analyze-pipeline] multilingual validation violations:",
        multilingualCheck.violations,
      );
    }

    publishLastFailureLogs(collector.getLogs());

    const situationId =
      resolutionEngineLayer.active[0]?.id ??
      resolutionEngineLayer.situations[0]?.id ??
      resolutionCareSessionId;
    const scopeId = params.telemetry_user_id ?? resolutionCareSessionId;

    // Decision History = WHY (EXPLANATION) — hard separation from Timeline WHAT.
    // Prefer top demand when priority ranks demands; CLI never used as reasoner text.
    const decisionHistory = writeExplanationDecision(scopeId, {
      situationId,
      chosenAction: effectiveActionId,
      rejectedAlternatives: rejectedAlternatives.map((a) => a.id),
      reasoningSummary: failSafeMode.engaged
        ? `FAIL-SAFE engaged (${failSafeMode.triggers.map((t) => t.kind).join(", ")}); confidence=${failSafeMode.decisionConfidence.level}. ${failSafeMode.clarification?.mustClarifyBeforeAction[0] ?? "Clarify before action."}`
        : conflictDetection.criticalDecisionRestricted
        ? `CRITICAL open medical conflict restricts high-confidence action until clarified. ${conflictDetection.envelope.clarification?.question ?? ""}`.trim()
        : highMissingInfoBlocked
        ? `HIGH missing_information belief blocked high-confidence irreversible posture; clarification preferred. PriorityContract: ${layeredPriority.explanationLines?.[0] ?? "n/a"}. Output risk=${trustLayer.response.risk_level}.`
        : `PriorityContract ${layeredPriority.topSituationId ? `topSituation=${layeredPriority.topSituationId}` : `selected ${effectiveActionId}`}${layeredPriority.priorityOverrideApplied ? " SAFETY_OVERRIDE=CRITICAL×NOW" : ""}; load=${caregiverLoadLayer.load.state}; ${layeredPriority.explanationLines?.[0] ?? ""}; output risk=${trustLayer.response.risk_level}.`,
      assumptionsUsed: refreshedAssumptionRegistry.envelope.influenceHints.slice(0, 5),
      missingInfoImpact: [
        ...(failSafeMode.escalatedMissingInfoQuestions ?? []),
        ...(conflictDetection.envelope.clarification
          ? [conflictDetection.envelope.clarification.question]
          : []),
        ...refreshedMissingInformationQueue.envelope.needsNext,
      ].slice(0, 5),
    });

    const reasoningSnapshot = captureReasoningSnapshot({
      situationId,
      inputsUsed: [structuredInput.raw_input.slice(0, 200)],
      assumptionsUsed: refreshedAssumptionRegistry.envelope.influenceHints.slice(0, 5),
      missingInfoSnapshot: refreshedMissingInformationQueue.envelope.needsNext.slice(0, 5),
      contextWeights: contextWeighting.items.map((i) => i.weights),
    });

    // Canonical status check — Situation is primary (lifecycle → active|resolved|archived).
    void mapLifecycleToCanonical(
      resolutionEngineLayer.active[0]?.status ??
        resolutionEngineLayer.situations[0]?.status ??
        "ACTIVE",
    );

    const finalLayeredRisk = computeRisk(stateSituations, refreshedBeliefs);
    const finalLayeredPriority = computePriority({
      situations: stateSituations,
      beliefs: refreshedBeliefs,
      risk: finalLayeredRisk,
      demands: demandEngineLayer.output.activeDemands,
      candidateActionIds: priorityEngineLayer.rankedForActionGenerator.map((v) => v.actionId),
      conflictBelief,
    });

    // FAMILY INTELLIGENCE — compound analyze interaction into strategic stores (non-blocking).
    const familyIntelligenceSnapshot = compoundAnalyzeInteraction({
      scopeId,
      careProfile: careProfileLayer.state.profile,
      responsibilityState: responsibilityGraphLayer.state,
      responsibilityLoads: responsibilityGraphLayer.envelope.loads,
      memoryInfluenceEntries: [
        ...memoryInfluenceLayer.state.memory.longTermPatternMemory.entries,
        ...memoryInfluenceLayer.state.memory.operationalMemory.entries,
      ],
      decision: decisionHistory,
      crisisRisks: crisisPreventionLayer.risks,
      delegationSuggestions: delegationLayer.suggestions,
      confidence: confidenceLayer.state,
      primaryOwnerName:
        responsibilityGraphLayer.envelope.ownershipEvals[0]?.ownerNames[0] ??
        "Primary caregiver",
      careEventSummary: effectiveActionId,
    });

    return {
      result: enforcedResponse,
      trust_layer: trustLayer.trust_layer,
      risk_uncertainty_layer: riskUncertaintyLayer,
      care_journey_graph_layer: careJourneyGraphLayer,
      governance_layer: toGovernanceLayerPayload(governance),
      safety_layer: toSafetyLayerPayload(safetyEnforcement),
      human_trust_layer: humanTrustPayload,
      fail_safe_mode_layer: failSafePayload,
      confidence_layer: confidencePayload,
      crisis_prevention_layer: crisisPreventionPayload,
      delegation_layer: delegationPayload,
      family_intelligence_snapshot: familyIntelligenceSnapshot,
      care_profile_layer: toCareProfileLayerPayload(careProfileLayer),
      care_context_layer: toCareContextLayerPayload(situationalCareContext),
      memory_influence_layer: toMemoryInfluenceLayerPayload(memoryInfluenceLayer),
      case_memory_layer: toCaseMemoryLayerPayload(caseMemoryLayer),
      assumption_registry_layer: toAssumptionRegistryLayerPayload(refreshedAssumptionRegistry),
      missing_information_queue_layer: toMissingInformationQueueLayerPayload(
        refreshedMissingInformationQueue,
      ),
      situation_risk_register_layer: toSituationRiskRegisterLayerPayload(
        situationRiskRegisterLayer,
      ),
      time_engine_layer: toTimeEngineLayerPayload(timeEngineLayer),
      priority_engine_layer: toPriorityEngineLayerPayload(priorityEngineLayer),
      deterministic_priority_layer: toDeterministicPrioritizationLayerPayload(
        deterministicPriorityLayer,
      ),
      prioritization_engine_layer: toPrioritizationEngineLayerPayload(
        prioritizationEngineLayer,
      ),
      demand_engine_layer: toDemandEngineLayerPayload(
        demandEngineLayer,
        caregiverLoadLayer.surfaceLimit,
      ),
      caregiver_load_layer: toCaregiverLoadLayerPayload(caregiverLoadLayer),
      emotional_load_signal_layer: toEmotionalLoadSignalLayerPayload(
        emotionalLoadSignalLayer,
      ),
      caregiver_psychological_load_layer: toCaregiverPsychologicalLoadPayload(
        finalPsychologicalLoad,
      ),
      load_interpretation_layer: toLoadInterpretationLayerPayload(loadInterpretation),
      caregiver_load_engine: toCaregiverLoadEngineLayerPayload(caregiverLoadEngine),
      high_signal_stress_layer: toHighSignalStressLayerPayload(
        finalPsychologicalLoad.highSignalStress,
        finalPsychologicalLoad.containmentMode.engaged,
      ),
      interaction_load_layer: toInteractionLoadLayerPayload(interactionLoadLayer),
      attention_layer: toAttentionLayerPayload(attentionLayer),
      responsibility_graph_layer: toResponsibilityGraphLayerPayload(
        responsibilityGraphLayer,
      ),
      surface_demands: containmentSurfaceDemands.map((d) => {
        const eval_ = responsibilityGraphLayer.envelope.ownershipEvals.find(
          (e) => e.demandId === d.id,
        );
        return {
          id: d.id,
          title: d.title,
          description: d.description,
          pressureScore: d.pressureScore,
          status: d.status,
          situationId: d.situationId,
          ownerName: eval_?.ownerNames[0] ?? null,
        };
      }),
      deferred_demand_titles: deferredDemandTitles,
      resolution_engine_layer: toResolutionEngineLayerPayload(resolutionEngineLayer),
      document_intelligence_layer: documentIntelligencePayload,
      document_intelligence: documentIntelligence,
      system_health_layer: systemHealthPayload,
      decision_history: decisionHistory,
      reasoning_snapshot: reasoningSnapshot,
      conflict_detection: {
        flagCount: conflictDetection.flags.length,
        openCount: conflictDetection.envelope.openCount,
        reEvaluationRequired: conflictDetection.reEvaluationRequired,
        totalConfidenceReduction: conflictDetection.totalConfidenceReduction,
        highMissingInfoBlocked,
        criticalDecisionRestricted: conflictDetection.criticalDecisionRestricted,
        conflictLoadContribution:
          conflictDetection.envelope.conflictLoadContribution,
        clarification: conflictDetection.envelope.clarification
          ? {
              headline: conflictDetection.envelope.clarification.headline,
              question: conflictDetection.envelope.clarification.question,
              options: conflictDetection.envelope.clarification.options,
              severity: conflictDetection.envelope.clarification.severity,
              conflictId: conflictDetection.envelope.clarification.conflictId,
              type: conflictDetection.envelope.clarification.type,
            }
          : null,
      },
        layered_derived: {
        risk: finalLayeredRisk,
        priority: finalLayeredPriority,
        health: refreshedLayeredHealth,
        caregiverLoad: {
          score: caregiverLoadLayer.load.score,
          state: caregiverLoadLayer.load.state,
          surfaceLimit: caregiverLoadLayer.surfaceLimit,
        },
        emotionalLoad: {
          compositeScore: emotionalLoadSignalLayer.signal.compositeScore,
          cognitiveFatigueLevel: emotionalLoadSignalLayer.signal.cognitiveFatigue.level,
          burnoutProbability: emotionalLoadSignalLayer.signal.burnoutProbability.value,
          protectionModeEngaged: postDecisionEmotionalLoad.protectionMode.engaged,
        },
        psychologicalLoad: {
          moralInjurySeverity: finalPsychologicalLoad.moralInjury.severity,
          identityDriftLevel: finalPsychologicalLoad.identityDrift.driftLevel,
          containmentEngaged: finalPsychologicalLoad.containmentMode.engaged,
          emotionalValidationTriggered: finalPsychologicalLoad.emotionalValidation !== null,
        },
        loadInterpretation: {
          emotionalLoadScore: loadInterpretation.emotionalLoadScore,
          loadFirstMode: loadInterpretation.loadFirstMode,
          sleepRisk: loadInterpretation.sleepRisk,
          uncertaintyIndex: loadInterpretation.uncertaintyIndex,
        },
        caregiverLoadEngine: {
          cognitiveLoadScore: caregiverLoadEngine.state.scores.cognitiveLoadScore,
          emotionalLoadScore: caregiverLoadEngine.state.scores.emotionalLoadScore,
          sleepRiskScore: caregiverLoadEngine.state.scores.sleepRiskScore,
          uncertaintyIndex: caregiverLoadEngine.state.scores.uncertaintyIndex,
          dependencyLoadScore: caregiverLoadEngine.state.scores.dependencyLoadScore,
          burnoutProbability: caregiverLoadEngine.state.burnout.probability,
          burnoutTrend: caregiverLoadEngine.state.burnout.trend,
          burnoutTier: caregiverLoadEngine.state.burnout.tier,
          loadFirstMode: caregiverLoadEngine.state.loadFirstMode,
        },
        interactionLoad: {
          detected: interactionLoadLayer.detected,
          boundaryViolationIndex: interactionLoadLayer.metrics.boundaryViolationIndex,
          sleepDisruptionRisk: interactionLoadLayer.metrics.sleepDisruptionRisk,
          sleepProtectionEngaged: interactionLoadLayer.sleepProtectionMode.engaged,
          outputStrategy: interactionLoadLayer.outputStrategy,
        },
        attention: {
          attentionClass: attentionLayer.classification.attentionClass,
          attentionPriority: attentionLayer.classification.attentionPriority,
          burnoutTier: attentionLayer.burnoutTier,
        },
      },
      failure_logs: collector.getLogs(),
      care_context_state: careContext.care_context_state,
      caregiver_depletion_signals: caregiverDepletion,
      user_language: userLanguage,
    };
  }

  publishLastFailureLogs(collector.getLogs());

  if (lastZodValid) {
    let fallbackGovernance = applySituationRiskRegisterGovernanceWeighting(
      applyMissingInformationQueueGovernanceWeighting(
      applyAssumptionRegistryGovernanceWeighting(
      applyPriorityEngineGovernanceWeighting(
        applyTimeEngineGovernanceWeighting(
          applyMemoryInfluenceGovernanceWeighting(
            applyCareProfileGovernanceWeighting(
              applyCareContextGovernanceWeighting(
                applySettingsGovernance(
                  lastZodValid,
                  governanceSettings ?? DEFAULT_SOLENOS_SETTINGS,
                  { validatedRiskLevel: lastZodValid.risk_level },
                ),
                situationalCareContext,
              ),
              careProfileLayer,
            ),
            memoryInfluenceLayer,
          ),
          timeEngineLayer,
        ),
        priorityEngineLayer,
      ),
      assumptionRegistryLayer,
    ),
      missingInformationQueueLayer,
    ),
      situationRiskRegisterLayer,
    );
    const fallbackDocumentIntelligence = processDocumentIntelligenceLayer({
      rawInput: structuredInput.raw_input,
      documentIntake,
      careContextIds: situationalCareContext.context.recentEvents.slice(0, 3),
    });
    const fallbackDocumentIntelligencePayload = toDocumentIntelligenceLayerPayload(
      fallbackDocumentIntelligence,
    );
    const fallbackRefreshedAssumptionRegistry = refreshAssumptionRegistryFromDocuments(
      assumptionRegistryLayer,
      fallbackDocumentIntelligence,
      params.telemetry_user_id,
    );
    const fallbackRefreshedMissingInformation =
      refreshMissingInformationQueueFromDocuments(
        missingInformationQueueLayer,
        fallbackDocumentIntelligence,
        {
          telemetry_user_id: params.telemetry_user_id,
          input: structuredInput.raw_input,
          situationId: resolutionEngineLayer.active[0]?.id,
        },
      );
    const fallbackRefreshedBeliefs = syncLegacyBeliefsToStore({
      userId: beliefUserId,
      assumptions: fallbackRefreshedAssumptionRegistry.state.assumptions,
      missingInformation: fallbackRefreshedMissingInformation.state.items,
    });
    const fallbackSystemHealth = processSystemHealthLayer({
      careContextLayer: situationalCareContext,
      memoryInfluenceLayer,
      assumptionRegistryLayer: fallbackRefreshedAssumptionRegistry,
      missingInformationQueueLayer: fallbackRefreshedMissingInformation,
      documentIntelligence: fallbackDocumentIntelligence,
      priorityEngineLayer,
      stressNormalized: structuredInput,
      clarityGate,
      currentAutonomy: fallbackGovernance.routing.decisionAutonomy,
      situations: {
        activeSituations: resolutionEngineLayer.active.length,
        blockedSituations: 0,
        unresolvedSituations: resolutionEngineLayer.active.length,
        titles: resolutionEngineLayer.active.map((s) => s.title),
        totalRiskExposure: situationRiskRegisterLayer.systemRisk.totalRiskExposure,
      },
    });
    fallbackGovernance = applySystemHealthGovernanceWeighting(
      fallbackGovernance,
      fallbackSystemHealth,
    );

    const fallbackTopAction =
      layeredPriority.topDemandId ??
      priorityEngineLayer.rankedForActionGenerator[0]?.actionId ??
      layeredPriority.topActionId ??
      "clarify_before_action";
    const fallbackTopDemand =
      demandEngineLayer.rankedActive.find((d) => d.id === fallbackTopAction) ??
      surfaceDemands[0] ??
      demandEngineLayer.rankedActive[0];
    const fallbackRejected = [
      ...demandEngineLayer.rankedActive
        .filter((d) => d.id !== fallbackTopAction)
        .slice(0, caregiverLoadLayer.surfaceLimit + 2)
        .map((d) => ({ id: d.id, label: d.title })),
      ...priorityEngineLayer.rankedForActionGenerator
        .filter((v) => v.actionId !== fallbackTopAction)
        .map((v) => ({ id: v.actionId, label: v.actionId })),
    ]
      .filter((v, i, arr) => arr.findIndex((x) => x.id === v.id) === i)
      .slice(0, 5);

    const fallbackPostDecisionEmotionalLoad = applyPostDecisionEmotionalLoad({
      layer: emotionalLoadSignalLayer,
      chosenActionId: fallbackTopAction,
      chosenDemand: fallbackTopDemand,
      baseSurfaceLimit: caregiverLoadLayer.surfaceLimit,
      riskContext: {
        outputRiskLevel: fallbackGovernance.response.risk_level,
        priorityOverrideApplied: layeredPriority.priorityOverrideApplied,
        medicalOrTimeSensitive:
          layeredPriority.priorityOverrideApplied ||
          situationalCareContext.context.situationType === "emergency" ||
          situationalCareContext.context.urgencyLevel === "CRITICAL" ||
          situationalCareContext.context.urgencyLevel === "HIGH",
        topRiskLevel: layeredRisk.situationRisks.reduce<
          "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | undefined
        >((max, r) => {
          const order = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };
          if (!max) return r.baseLevel;
          return order[r.baseLevel] > order[max] ? r.baseLevel : max;
        }, undefined),
      },
    });

    const fallbackFailSafe = processFailSafeMode({
      chosenActionId: fallbackTopAction,
      chosenActionLabel: fallbackTopDemand?.title ?? fallbackTopAction,
      rejectedAlternatives: fallbackRejected,
      knownFacts: [
        fallbackTopDemand?.title ?? fallbackTopAction,
        ...(layeredPriority.explanationLines ?? []).slice(0, 2),
      ],
      missingInfoQuestions:
        fallbackRefreshedMissingInformation.envelope.needsNext,
      highMissingInfoBlocked,
      highPriorityMissingInfoCount:
        fallbackRefreshedMissingInformation.envelope.highPriorityOpenCount,
      openConflictCount: conflictDetection.envelope.openCount,
      criticalDecisionRestricted: conflictDetection.criticalDecisionRestricted,
      reEvaluationRequired: conflictDetection.reEvaluationRequired,
      conflictClarificationQuestion:
        conflictDetection.envelope.clarification?.question ?? null,
      responsibilityEscalate: responsibilityGraphLayer.envelope.escalate,
      responsibilityHealthState: responsibilityGraphLayer.envelope.health.state,
      criticalUnassignedCount:
        responsibilityGraphLayer.envelope.health.criticalUnassignedCount,
      unassignedCount: responsibilityGraphLayer.envelope.health.unassignedCount,
      ownershipConflictCount: responsibilityGraphLayer.envelope.health.conflictCount,
      outputRiskLevel: fallbackGovernance.response.risk_level,
      priorityOverrideApplied: layeredPriority.priorityOverrideApplied,
      careContextUrgency: situationalCareContext.context.urgencyLevel,
      medicalOrTimeSensitive:
        layeredPriority.priorityOverrideApplied ||
        situationalCareContext.context.situationType === "emergency" ||
        situationalCareContext.context.urgencyLevel === "CRITICAL" ||
        situationalCareContext.context.urgencyLevel === "HIGH",
      confidenceCap: layeredPriority.confidenceCap,
      conflictConfidencePenalty: conflictDetection.envelope.confidencePenalty,
      systemHealthBand: fallbackSystemHealth.band,
      systemHealthRequestClarification:
        fallbackSystemHealth.gate.requestClarification,
      systemHealthBoostUncertainty: fallbackSystemHealth.gate.boostUncertainty,
      situationId:
        resolutionEngineLayer.active[0]?.id ??
        resolutionEngineLayer.situations[0]?.id ??
        null,
      userId: params.telemetry_user_id ?? null,
    });

    const fallbackCrisisPrevention = processCrisisPreventionLayer({
      demands: demandEngineLayer.output.allDemands,
      activeSituations: resolutionEngineLayer.active.map((s) => ({
        id: s.id,
        title: s.title,
        priority: stateSituations.find((ss) => ss.id === s.id)?.priority,
        status: s.status,
      })),
      beliefs: fallbackRefreshedBeliefs,
      caregiverLoadState: caregiverLoadLayer.load.state,
      caregiverLoadScore: caregiverLoadLayer.load.score,
      emotionalBurnoutProbability:
        emotionalLoadSignalLayer.signal.burnoutProbability.value,
      openConflictCount: conflictDetection.envelope.openCount,
      conflictLoadContribution: conflictDetection.envelope.conflictLoadContribution,
    });
    const fallbackConfidence = processConfidenceLayer({
      demands: demandEngineLayer.output.allDemands,
      activeSituations: resolutionEngineLayer.active.map((s) => ({
        id: s.id,
        title: s.title,
        priority: stateSituations.find((ss) => ss.id === s.id)?.priority,
        status: s.status,
      })),
      beliefs: fallbackRefreshedBeliefs,
      caregiverLoadState: caregiverLoadLayer.load.state,
      caregiverLoadScore: caregiverLoadLayer.load.score,
      emotionalBurnoutProbability:
        emotionalLoadSignalLayer.signal.burnoutProbability.value,
      conflictConfidencePenalty: conflictDetection.envelope.confidencePenalty,
      openConflictCount: conflictDetection.envelope.openCount,
      criticalUnassignedCount:
        responsibilityGraphLayer.envelope.health.criticalUnassignedCount,
      failSafeEngaged: fallbackFailSafe.engaged,
      crisisRisks: fallbackCrisisPrevention.risks,
    });
    const fallbackCareRelationships = careProfileLayer.state.profile.careRelationships;
    const fallbackDelegation = processDelegationLayer({
      demands: demandEngineLayer.output.allDemands,
      ownershipEvals: responsibilityGraphLayer.envelope.ownershipEvals,
      persons: responsibilityGraphLayer.state.persons,
      loads: responsibilityGraphLayer.envelope.loads,
      caregiverLoadState: caregiverLoadLayer.load.state,
      primaryCaregiverName:
        responsibilityGraphLayer.envelope.ownershipEvals.find(
          (e) => e.demandId === fallbackTopAction,
        )?.ownerNames[0] ??
        fallbackCareRelationships.sharedCareWith[0] ??
        "Primary caregiver",
      sharedCaregivers: fallbackCareRelationships.sharedCareWith,
      externalCaregivers: fallbackCareRelationships.externalCaregivers,
    });

    const fallbackPsychologicalLoad = processCaregiverPsychologicalLoad({
      userInput: structuredInput.raw_input,
      caregiverLoad: caregiverLoadLayer.load,
      emotionalLoadSignalLayer,
      postDecisionEmotionalLoad: fallbackPostDecisionEmotionalLoad,
      depletion: caregiverDepletion,
      assumptionHints: fallbackRefreshedAssumptionRegistry.envelope.influenceHints,
      memoryLabels: [
        ...memoryInfluenceLayer.state.memory.identityMemory.entries
          .slice(0, 6)
          .map((e) => e.influenceLabel),
      ],
      unresolvedSituationCount: resolutionEngineLayer.active.length,
      openConflictCount: conflictDetection.envelope.openCount,
      deferredDemandTitles,
      protectionModeEngaged: fallbackPostDecisionEmotionalLoad.protectionMode.engaged,
      highSignalStress,
    });

    const fallbackHumanTrust = processHumanTrustLayer({
      chosenActionId: fallbackFailSafe.effectiveActionId,
      chosenActionLabel: fallbackFailSafe.effectiveActionLabel,
      rejectedAlternatives: fallbackRejected,
      priorityExplanationLines: layeredPriority.explanationLines,
      priorityOverrideApplied: layeredPriority.priorityOverrideApplied,
      topSituationId: layeredPriority.topSituationId,
      demandRanking: demandEngineLayer.rankedActive.map((d) => ({
        id: d.id,
        title: d.title,
        pressureScore: d.pressureScore,
      })),
      conflictClarifications: conflictDetection.envelope.clarification
        ? [conflictDetection.envelope.clarification.question]
        : [],
      caregiverLoadState: caregiverLoadLayer.load.state,
      emotionalStress:
        memoryInfluenceLayer.envelope.emotionalBias > 0.35 ||
        caregiverLoadLayer.load.state === "HIGH" ||
        caregiverLoadLayer.load.state === "CRITICAL" ||
        emotionalLoadSignalLayer.signal.cognitiveFatigue.level === "HIGH" ||
        emotionalLoadSignalLayer.signal.cognitiveFatigue.level === "CRITICAL",
      caregiverProtectionMode: fallbackPostDecisionEmotionalLoad.protectionMode.engaged,
      recommendationLoadMetadata: fallbackPostDecisionEmotionalLoad.recommendationMetadata,
      highMissingInfoBlocked: highMissingInfoBlocked || fallbackFailSafe.engaged,
      failSafeEngaged: fallbackFailSafe.engaged,
      failSafeMustClarify: fallbackFailSafe.clarification?.mustClarifyBeforeAction,
      assumptionsUsed:
        fallbackRefreshedAssumptionRegistry.envelope.influenceHints.slice(0, 5),
      missingInfoImpact: [
        ...(fallbackFailSafe.escalatedMissingInfoQuestions ?? []),
        ...fallbackRefreshedMissingInformation.envelope.needsNext,
      ].slice(0, 5),
      outputRiskLevel: fallbackGovernance.response.risk_level,
      deferredDemandTitles,
      confidenceExplanation: fallbackConfidence.state.explanation,
      crisisWarnings: fallbackCrisisPrevention.risks
        .filter((r) => r.probability >= 0.35)
        .slice(0, 2)
        .map((r) => r.explanation),
      delegationSuggestions: fallbackDelegation.suggestions,
      emotionalValidation: fallbackPsychologicalLoad.emotionalValidation,
      containmentMode: fallbackPsychologicalLoad.containmentMode.engaged
        ? {
            engaged: true,
            whatNotToDoToday: fallbackPsychologicalLoad.containmentMode.whatNotToDoToday,
            emphasizeWhatCanWait:
              fallbackPsychologicalLoad.containmentMode.emphasizeWhatCanWait,
          }
        : undefined,
      moralInjurySeverity: fallbackPsychologicalLoad.moralInjury.severity,
      identityDriftLevel: fallbackPsychologicalLoad.identityDrift.driftLevel,
    });

    const fallbackFailSafeResponse = applyFailSafeClarificationToResponse(
      fallbackGovernance.response,
      fallbackFailSafe,
    );

    const fallbackSafetyControl = (governanceSettings ?? DEFAULT_SOLENOS_SETTINGS).safetyControl;
    const fallbackSafetyEnforcement = enforceSafetyConstraints(fallbackFailSafeResponse, {
      safetyControl: {
        ...fallbackSafetyControl,
        alwaysShowUncertainty:
          fallbackSafetyControl.alwaysShowUncertainty ||
          fallbackSystemHealth.gate.boostUncertainty ||
          fallbackFailSafe.engaged,
        noCertaintyMode:
          fallbackSafetyControl.noCertaintyMode ||
          fallbackSystemHealth.band === "Unreliable" ||
          fallbackFailSafe.decisionConfidence.level === "LOW",
      },
      careContextUrgency: situationalCareContext.context.urgencyLevel,
      emergencySituation: situationalCareContext.context.situationType === "emergency",
      memoryCompositeInfluence: memoryInfluenceLayer.envelope.compositeInfluence,
      emotionalDistressSignal:
        memoryInfluenceLayer.envelope.emotionalBias > 0.35 ||
        emotionalLoadSignalLayer.signal.cognitiveFatigue.level !== "LOW",
      overloadSimplification:
        situationRiskRegisterLayer.overload ||
        caregiverLoadLayer.load.state === "HIGH" ||
        caregiverLoadLayer.load.state === "CRITICAL" ||
        fallbackPostDecisionEmotionalLoad.outputConstraints.simplifyOutput,
    });
    const trustLayer = assembleTrustLayer(
      shapeSolenOSFromDecisionSnapshot(
        fallbackSafetyEnforcement.response,
        caseMemoryLayer.snapshot,
        caseMemoryLayer.policy.state,
      ),
      structuredInput.raw_input,
      documentIntake,
      fallbackDocumentIntelligencePayload,
    );
    const fallbackEnforcedResponse = applyRiskUncertaintyToResponse(
      trustLayer.response,
      riskUncertaintyLayer,
    );
    const fallbackHumanTrustPayload = toHumanTrustLayerPayload(fallbackHumanTrust);
    const fallbackFailSafePayload = toFailSafeModeLayerPayload(fallbackFailSafe);

    const fallbackScopeId = params.telemetry_user_id ?? resolutionCareSessionId;
    const fallbackFamilyIntelligence = compoundAnalyzeInteraction({
      scopeId: fallbackScopeId,
      careProfile: careProfileLayer.state.profile,
      responsibilityState: responsibilityGraphLayer.state,
      responsibilityLoads: responsibilityGraphLayer.envelope.loads,
      memoryInfluenceEntries: [
        ...memoryInfluenceLayer.state.memory.longTermPatternMemory.entries,
        ...memoryInfluenceLayer.state.memory.operationalMemory.entries,
      ],
      crisisRisks: fallbackCrisisPrevention.risks,
      delegationSuggestions: fallbackDelegation.suggestions,
      confidence: fallbackConfidence.state,
      primaryOwnerName:
        responsibilityGraphLayer.envelope.ownershipEvals[0]?.ownerNames[0] ??
        "Primary caregiver",
      careEventSummary: fallbackTopAction,
    });

    return {
      result: fallbackEnforcedResponse,
      trust_layer: trustLayer.trust_layer,
      risk_uncertainty_layer: riskUncertaintyLayer,
      care_journey_graph_layer: careJourneyGraphLayer,
      governance_layer: toGovernanceLayerPayload(fallbackGovernance),
      safety_layer: toSafetyLayerPayload(fallbackSafetyEnforcement),
      human_trust_layer: fallbackHumanTrustPayload,
      fail_safe_mode_layer: fallbackFailSafePayload,
      confidence_layer: toConfidenceLayerPayload(fallbackConfidence),
      crisis_prevention_layer: toCrisisPreventionLayerPayload(fallbackCrisisPrevention),
      delegation_layer: toDelegationLayerPayload(fallbackDelegation),
      family_intelligence_snapshot: fallbackFamilyIntelligence,
      care_profile_layer: toCareProfileLayerPayload(careProfileLayer),
      care_context_layer: toCareContextLayerPayload(situationalCareContext),
      memory_influence_layer: toMemoryInfluenceLayerPayload(memoryInfluenceLayer),
      case_memory_layer: toCaseMemoryLayerPayload(caseMemoryLayer),
      assumption_registry_layer: toAssumptionRegistryLayerPayload(fallbackRefreshedAssumptionRegistry),
      missing_information_queue_layer: toMissingInformationQueueLayerPayload(
        fallbackRefreshedMissingInformation,
      ),
      situation_risk_register_layer: toSituationRiskRegisterLayerPayload(
        situationRiskRegisterLayer,
      ),
      time_engine_layer: toTimeEngineLayerPayload(timeEngineLayer),
      priority_engine_layer: toPriorityEngineLayerPayload(priorityEngineLayer),
      deterministic_priority_layer: toDeterministicPrioritizationLayerPayload(
        deterministicPriorityLayer,
      ),
      prioritization_engine_layer: toPrioritizationEngineLayerPayload(
        prioritizationEngineLayer,
      ),
      demand_engine_layer: toDemandEngineLayerPayload(
        demandEngineLayer,
        caregiverLoadLayer.surfaceLimit,
      ),
      caregiver_load_layer: toCaregiverLoadLayerPayload(caregiverLoadLayer),
      emotional_load_signal_layer: toEmotionalLoadSignalLayerPayload(
        emotionalLoadSignalLayer,
      ),
      caregiver_psychological_load_layer: toCaregiverPsychologicalLoadPayload(
        fallbackPsychologicalLoad,
      ),
      load_interpretation_layer: toLoadInterpretationLayerPayload(loadInterpretation),
      caregiver_load_engine: toCaregiverLoadEngineLayerPayload(caregiverLoadEngine),
      high_signal_stress_layer: toHighSignalStressLayerPayload(
        fallbackPsychologicalLoad.highSignalStress,
        fallbackPsychologicalLoad.containmentMode.engaged,
      ),
      interaction_load_layer: toInteractionLoadLayerPayload(interactionLoadLayer),
      attention_layer: toAttentionLayerPayload(attentionLayer),
      responsibility_graph_layer: toResponsibilityGraphLayerPayload(
        responsibilityGraphLayer,
      ),
      surface_demands: surfaceDemands.map((d) => {
        const eval_ = responsibilityGraphLayer.envelope.ownershipEvals.find(
          (e) => e.demandId === d.id,
        );
        return {
          id: d.id,
          title: d.title,
          description: d.description,
          pressureScore: d.pressureScore,
          status: d.status,
          situationId: d.situationId,
          ownerName: eval_?.ownerNames[0] ?? null,
        };
      }),
      deferred_demand_titles: deferredDemandTitles,
      resolution_engine_layer: toResolutionEngineLayerPayload(resolutionEngineLayer),
      document_intelligence_layer: fallbackDocumentIntelligencePayload,
      document_intelligence: fallbackDocumentIntelligence,
      system_health_layer: toSystemHealthLayerPayload(fallbackSystemHealth),
      failure_logs: collector.getLogs(),
      care_context_state: careContext.care_context_state,
      caregiver_depletion_signals: caregiverDepletion,
      user_language: userLanguage,
    };
  }

  return {
    result: ANALYZE_PIPELINE_FAILURE,
    failure_logs: collector.getLogs(),
    care_context_state: careContext.care_context_state,
    caregiver_depletion_signals: caregiverDepletion,
    user_language: userLanguage,
  };
}

export { normalizeAnalyzeInput, parseAnalyzeRequest, AnalyzeRequestSchema } from "./request";
export type { AnalyzeRequest } from "./request";
export {
  ANALYZE_RETRY_NOTICE,
  ANALYZE_MAX_RETRIES,
  ANALYZE_FAILURE,
  ANALYZE_PIPELINE_FAILURE,
  isAnalyzeFailure,
} from "./constants";
export type { AnalyzeFailureResponse, AnalyzeFailureReason } from "./constants";
export {
  ANALYZE_OPS_KEY_HEADER,
  CAREGIVER_ENTRY_PIPELINE,
  OPS_ANALYZE_PIPELINE,
  analyzePipelineDisabledResponse,
  isAnalyzePipelineEnabled,
} from "./caregiver-entry-gate";

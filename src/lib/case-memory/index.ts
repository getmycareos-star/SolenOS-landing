export {
  CASE_MEMORY_LAYER_IDENTITY,
  CASE_MEMORY_LAYER_ONE_LINE_TRUTH,
  CASE_MEMORY_LAYER_PIPELINE_POSITION,
  CASE_MEMORY_LAYER_FORBIDDEN,
  CASE_MEMORY_ANTI_PATTERNS,
  CASE_DECISION_SNAPSHOT_KEYS,
  CASE_RISK_LEVELS,
  PATTERN_MATCH_STRENGTHS,
  PATTERN_RESPONSE_STATES,
  CASE_SELECTIVE_RECALL_MAX,
  CASE_WEAK_MATCH_THRESHOLD,
  CASE_STRONG_MATCH_THRESHOLD,
  CASE_VS_SITUATION_MAPPING,
  CASE_EVENT_TYPES,
  CASE_INPUT_WORKFLOW,
} from "./contract-constants";

export type {
  Case,
  CaseProfile,
  Condition,
  Medication,
  Provider,
  Facility,
  CaseDocument,
  CaseEvent,
  CaseEventType,
  CaseIntervention,
  CaseOutcomeSummary,
  FamilyContext,
  CaseUnderstanding,
  CaseStatus,
  CaseRiskLevel,
  CaseDecisionSnapshot,
  PatternMatchStrength,
  PatternResponseState,
  RankedCaseEvent,
  SelectiveRecallResult,
  PatternResponsePolicyResult,
  ExtractedCaseFacts,
  CaseMemoryLayerResult,
  CaseMemoryLayerPayload,
  CaseMemoryGuaranteeResult,
  CaseMemoryPersistenceAdapter,
} from "./types";

export {
  resetCaseStore,
  getCase,
  upsertCase,
  findCaseByAlias,
  listCases,
  createCaseId,
  createEmptyCase,
} from "./stores/case-store";

export {
  resetEventTimelineStore,
  listEventsForCase,
  appendCaseEvent,
  replaceEventsForCase,
  getEvent,
  countEventsForCase,
  createEventId,
} from "./stores/event-timeline-store";

export {
  resetInterventionOutcomeStore,
  recordInterventionOutcome,
  listInterventionsForCase,
  findSuccessfulIntervention,
  outcomeFromSuccess,
} from "./stores/intervention-outcome-store";

export {
  getCaseMemoryPersistenceAdapter,
  setCaseMemoryPersistenceAdapter,
  useNoopCaseMemoryPersistence,
  usePostgresStubCaseMemoryPersistence,
  persistCaseBestEffort,
  persistEventBestEffort,
} from "./stores/persistence-adapters";

export { identifyCase, type IdentifyCaseResult } from "./identify-case";
export { extractFacts } from "./extract-facts";
export { updateCaseFromFacts, type UpdateCaseResult } from "./update-case";
export { detectEventType, detectEventTags } from "./detect-event-type";
export { shouldRecall, type ShouldRecallParams } from "./should-recall";
export { rankRelevantEvents } from "./rank-relevant-events";
export { applyPatternResponsePolicy } from "./pattern-response-policy";
export {
  assembleDecisionSnapshot,
  decisionSnapshotKeys,
  isExactDecisionSnapshotSchema,
  listsMultiplePastDates,
} from "./assemble-decision-snapshot";
export { shapeSolenOSFromDecisionSnapshot } from "./shape-output";
export { runCaseMemoryGuarantee, validateCaseMemoryLayerResult } from "./guarantee";
export {
  processCaseMemoryLayer,
  toCaseMemoryLayerPayload,
  type ProcessCaseMemoryLayerParams,
} from "./process";

import { resetCaseStore } from "./stores/case-store";
import { resetEventTimelineStore } from "./stores/event-timeline-store";
import { resetInterventionOutcomeStore } from "./stores/intervention-outcome-store";

/** Reset all in-memory case-memory stores — tests only. */
export function resetCaseMemoryStores(): void {
  resetCaseStore();
  resetEventTimelineStore();
  resetInterventionOutcomeStore();
}

export {
  SOLENOS_SYSTEM_PURPOSE,
  MODULAR_MONOLITH_PRINCIPLE,
  FORBIDDEN_ARCHITECTURES,
  ARCHITECTURE_GUARDRAIL_QUESTION,
  ARCHITECTURE_FINAL_DIRECTIVE,
  EVENT_FIRST_PRINCIPLE,
  DOCUMENT_ASYNC_PIPELINE,
  FAILURE_ISOLATION_BOUNDARIES,
} from "./contract-constants";

export {
  DOMAIN_MODULES,
  DOMAIN_BOUNDARIES,
  CASE_SCOPED_MEMORY_RULE,
  type DomainModule,
  type DomainBoundary,
} from "./domain-boundaries";

export {
  SYSTEM_EVENT_TYPES,
  SystemEventTypeSchema,
  SystemEventRecordSchema,
  SystemEventInsertSchema,
  type SystemEventType,
  type SystemEventRecord,
  type SystemEventInsert,
} from "./events";

export {
  CaseStatusSchema,
  CaseStateSchema,
  RiskLevelSchema,
  RiskStateSchema,
  CurrentCareStateSchema,
  MemoryEntrySchema,
  MemoryStateSchema,
  UserContextStateSchema,
  type CaseStatus,
  type CaseState,
  type RiskLevel,
  type RiskState,
  type CurrentCareState,
  type MemoryEntry,
  type MemoryState,
  type UserContextState,
} from "./state-models";

export {
  DOMAIN_MODULE_MAP,
  getDomainModulePaths,
  type DomainModuleMapping,
} from "./module-map";

export {
  passesArchitectureGuardrail,
  type ArchitectureGuardrailInput,
  type ArchitectureGuardrailResult,
} from "./guardrail";

export {
  emitSystemEvent,
  resetSystemEventsForTests,
  getMemorySystemEvents,
  type EmitSystemEventResult,
} from "./emit-event";

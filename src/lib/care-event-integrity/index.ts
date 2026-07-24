export {
  INTEGRITY_IDENTITY,
  TRUST_LOOP,
  CARE_EVENT_STATUSES,
  CONFIDENCE_LEVELS,
  TRUTH_SOURCE_PRIORITY,
  INTEGRITY_CORRECTION_TYPES,
} from "./contract-constants";

export type {
  CareEventLifecycleStatus,
  ConfidenceLevel,
  TruthSource,
  IntegrityCorrectionType,
  FieldConfidence,
  EventAuditEntry,
  CareEventIntegrity,
} from "./types";

export {
  numericToConfidenceLevel,
  createFieldConfidence,
  upgradeFieldConfidence,
  downgradeFieldConfidence,
  createDefaultIntegrityFields,
} from "./confidence";

export {
  mapNormalizationStatusToLifecycle,
  createIntegrityState,
  isActiveLifecycleStatus,
  attachAuditId,
  markSuperseded,
  markUserCorrected,
} from "./lifecycle";

export {
  appendAuditEntry,
  getAuditTrailForEvent,
  listAuditForCaregiver,
  resetIntegrityAuditStore,
} from "./audit-store";

export {
  buildUnparsedRawEvent,
  buildProvisionalEvent,
  resolveLifecycleFromValidated,
} from "./canonical-build";

export {
  snapshotEvent,
  invalidateCanonicalEvent,
  supersedeWithUserVersion,
  applyUserFieldEdit,
  filterActiveEvents,
  filterByStatus,
} from "./corrections";

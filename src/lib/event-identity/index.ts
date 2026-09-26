export {
  EVENT_IDENTITY_IDENTITY,
  EVENT_IDENTITY_LOOP,
  EVENT_IDENTITY_RESOLUTIONS,
  EVIDENCE_RELATIONS,
  EVENT_IDENTITY_FAILURE_LABELS,
  IDENTITY_TIME_WINDOWS,
  IDENTITY_CONFIDENCE,
  IDENTITY_ATTRIBUTES,
} from "./contract-constants";

export type {
  EventIdentityResolution,
  EvidenceRelation,
  EventIdentityFailureLabel,
  IdentityAttribute,
} from "./contract-constants";

export type {
  IncomingEvidence,
  ExistingEvent,
  IdentityResolutionResult,
  BatchIdentityResolution,
  EventIdentityContext,
  NormalizedEventAttributes,
  DocumentVersionRecord,
} from "./types";

export {
  detectExactDuplicates,
  detectExactCaregiverDuplicate,
  detectExactDocumentDuplicate,
  detectExactMedicationListDuplicate,
  detectRepeatedCaregiverNote,
  detectMultiSystemLabResult,
  detectImportedVsManualEntry,
  detectMultiSourceSameEvent,
} from "./detect-exact-duplicates";

export {
  detectSemanticSameEvent,
  detectFallPhrasingVariation,
  detectSameHospitalization,
  detectSameAppointment,
  detectSameMedicationChange,
  detectSameSymptomReport,
  semanticEventMatch,
} from "./detect-semantic-same";

export {
  detectGenuinelySeparateEvents,
  detectSeparateFalls,
  detectSeparateERVisits,
  detectSeparateMedicationChanges,
  detectSeparateAppointments,
  detectSeparateSymptomEpisodes,
} from "./detect-separate-events";

export {
  detectRepeatedObservations,
  detectRepeatedStableWeight,
  detectRepeatedWalkerUse,
  detectRepeatedStableMedication,
  detectRepeatedBathingAssistance,
  detectRepeatedNighttimeConfusion,
  detectRepeatedPersistentState,
} from "./detect-repeated-observations";

export {
  detectDocumentVersions,
  detectDraftVsFinal,
  detectCorrectedClinicalNote,
  detectUpdatedMedicationList,
  detectImportedVsManualDuplicate,
  recordDocumentVersion,
  getDocumentVersions,
  clearDocumentVersions,
} from "./detect-document-versions";

export {
  detectDuplicateVsUpdate,
  detectEnrichmentUpdate,
  detectUnderstandingCorrection,
  detectMedicationAdministrationDetail,
  detectAppointmentOutcomeAdded,
  detectAmbiguousRecurrence,
} from "./detect-duplicate-vs-update";

export {
  resolveEventIdentity,
  resolveEventIdentitiesBatch,
  createEventIdentityContext,
  getEventRealityCount,
  getEvidenceCountForEvent,
} from "./resolve";
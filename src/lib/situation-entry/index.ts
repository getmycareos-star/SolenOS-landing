export {
  SITUATION_ENTRY_IDENTITY,
  CARE_CONTEXT_ROOT_ID,
  EXTRACTED_TYPES,
  TRACKING_DIMENSIONS,
  SITUATION_ENTRY_PROHIBITED,
} from "./contract-constants";

export type {
  ExtractedType,
  TrackingDimension,
  CareEventEntity,
  CanonicalCareEvent,
  CareContextRoot,
  UnderstoodItem,
  SituationResponse,
  ProcessSituationInput,
} from "./types";

export {
  classifyExtractedType,
  parseSituationToCareEvent,
  parseDocumentToCareEvents,
  buildSituationUnderstanding,
  deriveTrackingDimensions,
} from "./parse-situation";

export {
  getOrCreateCareContextRoot,
  getCareContextRoot,
  appendEventsToContext,
  updateEventTimeInContext,
  invalidateEventInContext,
  applyUserCorrectionInContext,
  supersedeEventInContext,
  resetCareContextRootStore,
  clearCareContextMemoryCache,
} from "./context-store";

export { getTemporalTimeline, getIngestionTimeline, getTimelineViews, withDualTime } from "./dual-time";

export { computeWhatChanged } from "./what-changed";
export {
  caregiverLineFromDareUncertain,
  caregiverLineFromUnreadableSection,
  sanitizeCaregiverFacingLines,
  sanitizeSituationUncertaintyFields,
  CAREGIVER_RESPONSE_BANNED_TOKENS,
  caregiverLineContainsBannedToken,
} from "./caregiver-facing-uncertainty";
export {
  processSituationInput,
  processSituationRecompile,
  processSessionReentry,
  getSituationTimeline,
  getTopSituationEvents,
} from "./pipeline";

export { toCaregiverSituationResponse } from "./caregiver-response-dto";
export {
  CAREGIVER_SITUATION_KEYS,
  CAREGIVER_INTERNAL_PIPELINE_FIELDS,
  assertCaregiverDtoExcludesInternalCompile,
  type CaregiverSituationResponse,
} from "./caregiver-response-dto";

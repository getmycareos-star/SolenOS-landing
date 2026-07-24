export {
  CARE_JOURNEY_GRAPH_IDENTITY,
  CARE_JOURNEY_GRAPH_BOUNDARY,
  JOURNEY_EVENT_TYPES,
  RELATIONSHIP_TYPES,
  RESOLVED_STATUSES,
  CLINICAL_IMPORTANCE_LEVELS,
  type JourneyEventType,
  type RelationshipType,
  type ResolvedStatus,
  type ClinicalImportance,
  type JourneyEvidence,
  type JourneyGraphEvent,
  type JourneyRelationship,
  type CareJourneyGraph,
  type ContinuityPattern,
  type ContinuityAssessment,
  type CareJourneyPipelineResult,
  type IngestJourneyInputParams,
} from "./types";

export {
  classifyJourneyEventType,
  EVENT_TYPE_LABELS,
  journeyCategoryFromType,
  inferClinicalImportance,
} from "./classify-event";

export { structureJourneyEvent, extractPipelineFacts } from "./structure-event";
export { detectRelationships, relatedEventIds } from "./detect-relationships";
export { assessContinuity } from "./continuity-assess";

export {
  getOrCreateGraph,
  getGraph,
  getGraphForCaregiver,
  addEventToGraph,
  resetCareJourneyGraphStore,
} from "./graph-store";

export { toCareJourneyGraphLayerPayload } from "./layer-payload";
export type { CareJourneyGraphLayerPayload } from "./types";

/**
 * Client-safe barrel only.
 * Postgres + pipeline: import from `@/lib/care-journey-graph/server`.
 */

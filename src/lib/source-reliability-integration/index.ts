export {
  SOURCE_RELIABILITY_INTEGRATION_IDENTITY,
  SOURCE_RELIABILITY_INTEGRATION_PIPELINE_POSITION,
  SOURCE_RELIABILITY_INTEGRATION_FORBIDDEN,
} from "./contract-constants";

export type {
  ReliabilityWeightedEvent,
  SourceReliabilityIntegrationResult,
} from "./index";

export {
  integrateSourceReliability,
  applySourceReliabilityWeight,
  getEventSourceReliability,
  buildSourceTransparencySummary,
  filterEventsByReliability,
  adjustEventConfidenceByReliability,
  REASONING_RELIABILITY_THRESHOLD,
} from "./index";
export {
  CONFIDENCE_AGGREGATION_IDENTITY,
  CONFIDENCE_AGGREGATION_PIPELINE_POSITION,
  CONFIDENCE_AGGREGATION_FORBIDDEN,
} from "./contract-constants";

export type {
  ConfidenceSource,
  ConfidenceInput,
  AggregatedConfidence,
} from "./index";

export {
  computeAggregatedConfidence,
  aggregateConfidence,
  confidenceLabel,
  bayesianUpdate,
} from "./index";
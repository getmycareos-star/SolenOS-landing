export {
  CONTINUITY_GRAPH_IDENTITY,
  CONTINUITY_GRAPH_THESIS,
  CONTINUITY_GRAPH_MOAT,
  UNIVERSAL_NODE_TYPES,
  UNIVERSAL_EDGE_TYPES,
  CONTINUITY_DOMAINS,
} from "./contract-constants";

export type {
  UniversalNodeType,
  UniversalEdgeType,
  ContinuityDomain,
  ContinuityNode,
  ContinuityEdge,
  ContinuityGraph,
  CascadeChain,
  ContextReasoningOutput,
  ContinuityGraphResult,
  IngestContinuityInputParams,
  ContinuityGraphLayerPayload,
} from "./types";

export type { ContinuityIntelligenceInsight } from "./types";

export {
  domainFromCategory,
  nodeTypeFromJourneyEvent,
  inferDomainFromText,
  obligationFromText,
  constraintFromText,
} from "./classify-nodes";

export { mapJourneyRelationshipType, inferUniversalEdges } from "./infer-edges";
export { runContextReasoning } from "./context-reasoning";
export {
  detectMissingObligations,
  detectUnresolvedDecisions,
  detectDependencyGaps,
  runContinuityIntelligence,
} from "./continuity-intelligence";

export {
  getOrCreateContinuityGraph,
  getContinuityGraph,
  getContinuityGraphForScope,
  addToContinuityGraph,
  detectCascadeChains,
  resetContinuityGraphStore,
} from "./graph-store";

export {
  syncContinuityGraphFromJourney,
  getContinuityGraphForCaregiver,
} from "./bridge-from-journey";

export {
  processContinuityInput,
  syncFromJourneyResult,
  getContinuityGraphSnapshot,
} from "./pipeline";

export { toContinuityGraphLayerPayload } from "./layer-payload";

/**
 * Client-safe barrel. Postgres helpers: `@/lib/continuity-graph/server`.
 */

export {
  MEMORY_LAYERS_IDENTITY,
  MEMORY_LAYER_IDS,
  EPISODE_KINDS,
  EPISODE_STATUS,
  CONTINUITY_SUMMARY_KINDS,
  EPISODE_CLUSTER_DAYS,
  RECENT_EVENT_DAYS,
  LONG_TERM_EPISODE_AGE_DAYS,
  DEFAULT_PAGE_SIZE,
  RETRIEVAL_PRIORITY_ORDER,
  CONTEXT_WINDOW_PRIORITY,
} from "./contract-constants";

export type {
  MemoryLayerId,
  EpisodeKind,
  EpisodeStatus,
  ContinuitySummaryKind,
  RetrievalPriority,
  RawEventRef,
  ContinuityLink,
  StructuredContinuityLayer,
  CareEpisode,
  LongTermContinuitySummary,
  HierarchicalMemoryGraph,
  MemoryLayerStore,
  RetrievalBundle,
  ContextWindowBundle,
  PaginatedResult,
} from "./types";

export {
  toRawEventRef,
  rawRefsFromEvents,
  assertRawPreservation,
  indexRawByTime,
  indexRawByStatus,
  indexRawByEpisode,
} from "./layer-raw";

export { buildContinuityLinks, buildStructuredContinuityLayer } from "./layer-continuity";

export {
  detectEpisodes,
  getActiveEpisode,
  eventToEpisodeMap,
  getEpisodeById,
  markEpisodeStatus,
} from "./layer-episodes";

export { deriveLongTermSummaries, expandSummaryToEventIds } from "./layer-long-term";

export {
  rebuildMemoryLayers,
  getMemoryLayerStore,
  getCachedMemoryLayers,
  invalidateMemoryCache,
  resetMemoryLayerStore,
} from "./store";

export { buildHierarchicalGraph } from "./compact";

export {
  retrieveMemoryContext,
  resolveEventsFromRetrieval,
  type RetrieveOptions,
} from "./retrieve";

export {
  composeContextWindow,
  contextWindowPriorityOrder,
  estimateContextWindowSize,
  type ComposeContextParams,
} from "./context-window";

export { paginate, paginateByTimestamp } from "./pagination";

export {
  processMemoryLayers,
  getMemoryLayersForCaregiver,
  getPaginatedRawEvents,
  lazyLoadEpisode,
  type MemoryPipelineResult,
} from "./pipeline";

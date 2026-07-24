import type { CanonicalCareEvent } from "../situation-entry/types";
import { buildHierarchicalGraph } from "./compact";
import { composeContextWindow } from "./context-window";
import { paginateByTimestamp } from "./pagination";
import { retrieveMemoryContext } from "./retrieve";
import { getMemoryLayerStore, rebuildMemoryLayers } from "./store";
import type { MemoryLayerStore, PaginatedResult, RawEventRef } from "./types";

export type MemoryPipelineResult = {
  store: MemoryLayerStore;
  hierarchical: ReturnType<typeof buildHierarchicalGraph>;
  retrieval: ReturnType<typeof retrieveMemoryContext>;
  context_window: ReturnType<typeof composeContextWindow>;
};

/** Run after every ingest — async-safe rebuild of memory layers. */
export function processMemoryLayers(params: {
  caregiver_id: string;
  events: CanonicalCareEvent[];
  current_situation?: string;
  unresolved_questions?: string[];
}): MemoryPipelineResult {
  const store = rebuildMemoryLayers(params.caregiver_id, params.events);
  const hierarchical = buildHierarchicalGraph(store);
  const retrieval = retrieveMemoryContext(store, {
    unresolved_questions: params.unresolved_questions,
  });
  const rawById = new Map(store.raw_event_refs.map((r) => [r.event_id, r]));
  const context_window = composeContextWindow({
    current_situation: params.current_situation,
    retrieval,
    rawById,
  });

  return { store, hierarchical, retrieval, context_window };
}

export function getMemoryLayersForCaregiver(caregiverId: string) {
  return getMemoryLayerStore(caregiverId);
}

export function getPaginatedRawEvents(
  caregiverId: string,
  offset = 0,
  limit = 20,
): PaginatedResult<RawEventRef> | null {
  const store = getMemoryLayerStore(caregiverId);
  if (!store) return null;
  return paginateByTimestamp(store.raw_event_refs, offset, limit);
}

export function lazyLoadEpisode(
  caregiverId: string,
  episodeId: string,
): { episode: import("./types").CareEpisode; events: RawEventRef[] } | null {
  const store = getMemoryLayerStore(caregiverId);
  if (!store) return null;
  const episode = store.episodes.find((ep) => ep.id === episodeId);
  if (!episode) return null;
  const refById = new Map(store.raw_event_refs.map((r) => [r.event_id, r]));
  const events = episode.event_ids
    .map((id) => refById.get(id))
    .filter((r): r is RawEventRef => r !== undefined);
  return { episode, events };
}

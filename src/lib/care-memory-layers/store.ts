import type { CanonicalCareEvent } from "../situation-entry/types";
import { buildStructuredContinuityLayer } from "./layer-continuity";
import { detectEpisodes, getActiveEpisode } from "./layer-episodes";
import { deriveLongTermSummaries } from "./layer-long-term";
import { rawRefsFromEvents } from "./layer-raw";
import type { MemoryLayerStore } from "./types";

const stores = new Map<string, MemoryLayerStore>();
const summaryCache = new Map<string, { data: MemoryLayerStore; cached_at: string }>();

function storeKey(caregiverId: string): string {
  return `memory_layers::${caregiverId}`;
}

/** Rebuild all memory layers from canonical events — organizational, never destructive. */
export function rebuildMemoryLayers(
  caregiverId: string,
  events: CanonicalCareEvent[],
): MemoryLayerStore {
  const existing = stores.get(storeKey(caregiverId));
  const raw_event_refs = rawRefsFromEvents(events);

  const structured = buildStructuredContinuityLayer(
    caregiverId,
    events,
    existing?.structured,
  );

  const episodes = detectEpisodes(caregiverId, events, existing?.episodes ?? []);
  const long_term_summaries = deriveLongTermSummaries(
    caregiverId,
    episodes,
    existing?.long_term_summaries ?? [],
  );

  const store: MemoryLayerStore = {
    caregiver_id: caregiverId,
    raw_event_refs,
    structured,
    episodes,
    long_term_summaries,
    active_episode_id: getActiveEpisode(episodes)?.id ?? null,
    updated_at: new Date().toISOString(),
  };

  stores.set(storeKey(caregiverId), store);
  summaryCache.set(storeKey(caregiverId), {
    data: store,
    cached_at: new Date().toISOString(),
  });

  return store;
}

export function getMemoryLayerStore(caregiverId: string): MemoryLayerStore | undefined {
  const cached = summaryCache.get(storeKey(caregiverId));
  if (cached) return cached.data;
  return stores.get(storeKey(caregiverId));
}

export function getCachedMemoryLayers(caregiverId: string): MemoryLayerStore | undefined {
  return summaryCache.get(storeKey(caregiverId))?.data;
}

export function invalidateMemoryCache(caregiverId: string): void {
  summaryCache.delete(storeKey(caregiverId));
}

export function resetMemoryLayerStore(): void {
  stores.clear();
  summaryCache.clear();
}

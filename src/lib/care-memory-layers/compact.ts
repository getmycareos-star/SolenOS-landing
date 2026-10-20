import type { MemoryLayerStore, HierarchicalMemoryGraph, RawEventRef } from "./types";
import { eventToEpisodeMap } from "./layer-episodes";

/** Graph compaction — hierarchical episodes over flat events. */
export function buildHierarchicalGraph(store: MemoryLayerStore): HierarchicalMemoryGraph {
  const refById = new Map(store.raw_event_refs.map((r) => [r.event_id, r]));
  const eventToEp = eventToEpisodeMap(store.episodes);
  const groupedIds = new Set<string>();

  const episodes = store.episodes.map((episode) => {
    const events = episode.event_ids
      .map((id) => refById.get(id))
      .filter((r): r is RawEventRef => r !== undefined);
    for (const id of episode.event_ids) groupedIds.add(id);
    return { episode, events };
  });

  const ungrouped_recent = store.raw_event_refs
    .filter((r) => !groupedIds.has(r.event_id))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 20);

  return {
    caregiver_id: store.caregiver_id,
    episodes,
    ungrouped_recent,
    long_term_summaries: store.long_term_summaries,
    total_raw_events: store.raw_event_refs.length,
  };
}

import { RECENT_EVENT_DAYS, RETRIEVAL_PRIORITY_ORDER } from "./contract-constants";
import type { MemoryLayerStore, RetrievalBundle, RawEventRef } from "./types";
import { getActiveEpisode } from "./layer-episodes";

function daysSince(iso: string, reference = new Date()): number {
  return Math.floor((reference.getTime() - new Date(iso).getTime()) / 86400000);
}

export type RetrieveOptions = {
  include_raw_history?: boolean;
  unresolved_questions?: string[];
  reference?: Date;
};

/** Prioritized retrieval — never loads entire Care Context by default. */
export function retrieveMemoryContext(
  store: MemoryLayerStore,
  options: RetrieveOptions = {},
): RetrievalBundle {
  const ref = options.reference ?? new Date();
  const active_episode = getActiveEpisode(store.episodes);

  const recent_events = store.raw_event_refs
    .filter((r) => daysSince(r.timestamp, ref) <= RECENT_EVENT_DAYS)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const open_follow_ups = store.raw_event_refs.filter(
    (r) =>
      r.extracted_type === "follow_up" &&
      r.status !== "invalidated" &&
      r.status !== "superseded",
  );

  const historical_episodes = store.episodes
    .filter((ep) => ep.status === "completed" || ep.status === "monitoring")
    .sort((a, b) => b.started_at.localeCompare(a.started_at));

  return {
    active_episode,
    recent_events,
    open_follow_ups,
    unresolved_questions: options.unresolved_questions ?? [],
    historical_episodes,
    long_term_summaries: store.long_term_summaries,
    raw_events_on_demand: options.include_raw_history ? store.raw_event_refs : null,
    retrieval_order: [...RETRIEVAL_PRIORITY_ORDER],
  };
}

export function resolveEventsFromRetrieval(
  bundle: RetrievalBundle,
  eventLookup: Map<string, RawEventRef>,
): RawEventRef[] {
  const ids = new Set<string>();
  const out: RawEventRef[] = [];

  function add(ref: RawEventRef | undefined): void {
    if (!ref || ids.has(ref.event_id)) return;
    ids.add(ref.event_id);
    out.push(ref);
  }

  if (bundle.active_episode) {
    for (const id of bundle.active_episode.event_ids) {
      add(eventLookup.get(id));
    }
  }

  for (const ref of bundle.recent_events) add(ref);
  for (const ref of bundle.open_follow_ups) add(ref);

  if (bundle.raw_events_on_demand) {
    for (const ref of bundle.raw_events_on_demand) add(ref);
  }

  return out;
}

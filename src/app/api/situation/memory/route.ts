import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  buildHierarchicalGraph,
  composeContextWindow,
  getMemoryLayerStore,
  getPaginatedRawEvents,
  lazyLoadEpisode,
  MEMORY_LAYERS_IDENTITY,
  paginate,
  processMemoryLayers,
  retrieveMemoryContext,
} from "@/lib/care-memory-layers";
import { getCareContextRoot } from "@/lib/situation-entry";

const DEFAULT_CAREGIVER_ID = "default_caregiver";

/** GET /api/situation/memory — layered memory retrieval with pagination */
export async function GET(req: NextRequest) {
  const caregiverId = req.nextUrl.searchParams.get("caregiver_id") ?? DEFAULT_CAREGIVER_ID;
  const offset = Number(req.nextUrl.searchParams.get("offset") ?? "0");
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? "20");
  const episodeId = req.nextUrl.searchParams.get("episode_id");
  const includeFullHistory = req.nextUrl.searchParams.get("full_history") === "true";

  const context = getCareContextRoot(caregiverId);
  if (!context) {
    return NextResponse.json({
      identity: MEMORY_LAYERS_IDENTITY,
      store: null,
      hierarchical: null,
    });
  }

  let store = getMemoryLayerStore(caregiverId);
  if (!store) {
    const built = processMemoryLayers({ caregiver_id: caregiverId, events: context.events });
    store = built.store;
  }

  if (episodeId) {
    const lazy = lazyLoadEpisode(caregiverId, episodeId);
    return NextResponse.json({
      identity: MEMORY_LAYERS_IDENTITY,
      episode: lazy,
    });
  }

  const hierarchical = buildHierarchicalGraph(store);
  const paginatedEpisodes = paginate(hierarchical.episodes, offset, limit);
  const paginatedRaw = getPaginatedRawEvents(caregiverId, offset, limit);
  const retrieval = retrieveMemoryContext(store, { include_raw_history: includeFullHistory });
  const rawById = new Map(store.raw_event_refs.map((r) => [r.event_id, r]));
  const context_window = composeContextWindow({ retrieval, rawById });

  return NextResponse.json({
    identity: MEMORY_LAYERS_IDENTITY,
    store: {
      caregiver_id: store.caregiver_id,
      total_raw_events: store.raw_event_refs.length,
      episode_count: store.episodes.length,
      long_term_summary_count: store.long_term_summaries.length,
      active_episode_id: store.active_episode_id,
      updated_at: store.updated_at,
    },
    hierarchical: {
      ...hierarchical,
      episodes: paginatedEpisodes.items,
      pagination: paginatedEpisodes,
    },
    raw_events: paginatedRaw,
    retrieval: {
      active_episode: retrieval.active_episode,
      recent_count: retrieval.recent_events.length,
      open_follow_ups_count: retrieval.open_follow_ups.length,
      unresolved_questions: retrieval.unresolved_questions,
      historical_episode_count: retrieval.historical_episodes.length,
      long_term_summary_count: retrieval.long_term_summaries.length,
      retrieval_order: retrieval.retrieval_order,
      includes_full_history: includeFullHistory,
    },
    context_window,
  });
}

import type { ContextWindowBundle, MemoryLayerStore, RawEventRef, RetrievalBundle } from "./types";
import { CONTEXT_WINDOW_PRIORITY } from "./contract-constants";

export type ComposeContextParams = {
  current_situation?: string | null;
  retrieval: RetrievalBundle;
  rawById: Map<string, RawEventRef>;
  maxHistorical?: number;
  maxEvidence?: number;
};

/**
 * Context window management — minimum context for AI.
 * Full lifetime history is NEVER included unless explicitly requested.
 */
export function composeContextWindow(params: ComposeContextParams): ContextWindowBundle {
  const maxHist = params.maxHistorical ?? 5;
  const maxEvidence = params.maxEvidence ?? 3;

  const related_unresolved: string[] = [
    ...params.retrieval.unresolved_questions,
    ...params.retrieval.open_follow_ups
      .map((r) => {
        const ref = params.rawById.get(r.event_id);
        return ref ? `${ref.extracted_type}: ${ref.event_id}` : null;
      })
      .filter((s): s is string => s !== null),
  ].slice(0, 5);

  const relevant_historical_events: RawEventRef[] = [];
  if (params.retrieval.active_episode) {
    for (const id of params.retrieval.active_episode.event_ids) {
      const ref = params.rawById.get(id);
      if (ref) relevant_historical_events.push(ref);
    }
  }
  for (const ep of params.retrieval.historical_episodes.slice(0, 2)) {
    for (const id of ep.event_ids.slice(0, 2)) {
      const ref = params.rawById.get(id);
      if (ref && relevant_historical_events.length < maxHist) {
        relevant_historical_events.push(ref);
      }
    }
  }

  const supporting_evidence = params.retrieval.recent_events
    .filter((r) => r.source === "document")
    .slice(0, maxEvidence);

  return {
    current_situation: params.current_situation ?? null,
    active_episode_summary: params.retrieval.active_episode?.summary ?? null,
    related_unresolved,
    relevant_historical_events: relevant_historical_events.slice(0, maxHist),
    supporting_evidence,
    includes_full_history: false,
  };
}

export function contextWindowPriorityOrder(): readonly string[] {
  return CONTEXT_WINDOW_PRIORITY;
}

export function estimateContextWindowSize(bundle: ContextWindowBundle): number {
  let size = 0;
  if (bundle.current_situation) size += bundle.current_situation.length;
  if (bundle.active_episode_summary) size += bundle.active_episode_summary.length;
  size += bundle.related_unresolved.join(" ").length;
  size += bundle.relevant_historical_events.length * 80;
  size += bundle.supporting_evidence.length * 80;
  return size;
}

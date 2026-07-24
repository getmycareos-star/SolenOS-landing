"use client";

import { useCallback, useEffect, useState } from "react";
import type { HierarchicalMemoryGraph } from "@/lib/care-memory-layers";

type Props = {
  caregiverId?: string;
  className?: string;
};

export function MemoryEpisodePanel({ caregiverId = "default_caregiver", className }: Props) {
  const [graph, setGraph] = useState<HierarchicalMemoryGraph | null>(null);
  const [expandedEpisode, setExpandedEpisode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const pageSize = 5;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/situation/memory?caregiver_id=${encodeURIComponent(caregiverId)}&offset=${page * pageSize}&limit=${pageSize}`,
      );
      if (!res.ok) return;
      const data = (await res.json()) as { hierarchical: HierarchicalMemoryGraph };
      setGraph(data.hierarchical);
    } finally {
      setLoading(false);
    }
  }, [caregiverId, page]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!graph && loading) return null;
  if (!graph || graph.episodes.length === 0) return null;

  return (
    <section
      className={className}
      aria-labelledby="memory-episode-heading"
      data-testid="memory-episode-panel"
    >
      <h3 id="memory-episode-heading" className="section-kicker">
        Care episodes
      </h3>
      <p className="situation-timeline-hint">
        Hierarchical continuity — {graph.total_raw_events} raw events preserved across{" "}
        {graph.episodes.length} episode{graph.episodes.length === 1 ? "" : "s"}.
      </p>
      <ul className="memory-episode-list">
        {graph.episodes.map(({ episode, events }) => (
          <li key={episode.id} className="memory-episode-item">
            <button
              type="button"
              className="memory-episode-toggle"
              onClick={() =>
                setExpandedEpisode(expandedEpisode === episode.id ? null : episode.id)
              }
              aria-expanded={expandedEpisode === episode.id}
            >
              <span className="episode-kind">{episode.kind.replace(/_/g, " ")}</span>
              <span className="episode-status">{episode.status}</span>
              <span className="episode-title">{episode.title}</span>
              <span className="episode-count">{events.length} events</span>
            </button>
            {expandedEpisode === episode.id && (
              <ul className="memory-episode-events">
                {events.map((ev) => (
                  <li key={ev.event_id}>
                    <span className="extracted-type">{ev.extracted_type.replace(/_/g, " ")}</span>
                    <time dateTime={ev.timestamp}>
                      {new Date(ev.timestamp).toLocaleDateString()}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
      {graph.long_term_summaries.length > 0 && (
        <div className="long-term-summaries">
          <h4 className="section-kicker">Long-term continuity</h4>
          <ul>
            {graph.long_term_summaries.slice(0, 3).map((s) => (
              <li key={s.id}>
                <strong>{s.title}</strong>
                <p>{s.narrative}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="memory-pagination">
        <button type="button" disabled={page === 0 || loading} onClick={() => setPage((p) => p - 1)}>
          Previous
        </button>
        <button type="button" disabled={loading} onClick={() => setPage((p) => p + 1)}>
          Next
        </button>
      </div>
    </section>
  );
}

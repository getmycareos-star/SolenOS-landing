"use client";

import { useCallback, useEffect, useState } from "react";

import type { CareRecordTimelineEntry } from "@/lib/care-record";

type Props = {
  className?: string;
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function eventTypeLabel(type: string): string {
  return type.replace(/_/g, " ");
}

export function CareRecordTimelinePanel({ className }: Props) {
  const [timeline, setTimeline] = useState<CareRecordTimelineEntry[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (searchQuery?: string) => {
    setLoading(true);
    try {
      const endpoint =
        searchQuery?.trim()
          ? `/api/care-record/search?q=${encodeURIComponent(searchQuery.trim())}`
          : "/api/care-record/timeline";
      const res = await fetch(endpoint);
      const data = (await res.json()) as {
        timeline?: CareRecordTimelineEntry[];
        matches?: CareRecordTimelineEntry[];
      };
      setTimeline(data.matches ?? data.timeline ?? []);
    } catch {
      setTimeline([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section
      className={`care-record-panel${className ? ` ${className}` : ""}`}
      aria-label="Care history"
    >
      <h3 className="care-record-title">Care history</h3>
      <p className="care-record-note">
        A continuous record — searchable, linked, retrievable.
      </p>

      <form
        className="care-record-search"
        onSubmit={(e) => {
          e.preventDefault();
          void load(query);
        }}
      >
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="When did confusion begin? Last fall? Medication changes?"
          aria-label="Search care history"
        />
        <button type="submit" disabled={loading}>
          Search
        </button>
      </form>

      {loading && <p className="care-record-muted">Loading…</p>}

      {!loading && timeline.length === 0 && (
        <p className="care-record-muted">No events recorded yet. Your history builds here.</p>
      )}

      <ol className="care-record-timeline">
        {timeline.map((entry) => (
          <li key={entry.id} className="care-record-entry">
            <header>
              <time dateTime={entry.date}>{formatDate(entry.date)}</time>
              <span className="care-record-type">{eventTypeLabel(entry.event_type)}</span>
            </header>
            <p className="care-record-summary">{entry.structured.summary}</p>
            {entry.structured.people_involved.length > 0 && (
              <p className="care-record-meta">
                People: {entry.structured.people_involved.join(", ")}
              </p>
            )}
            {entry.structured.decisions_made.length > 0 && (
              <p className="care-record-meta">
                Decision: {entry.structured.decisions_made[0]}
              </p>
            )}
            {entry.structured.documents_attached.length > 0 && (
              <p className="care-record-meta">
                Documents: {entry.structured.documents_attached.map((d) => d.name).join(", ")}
              </p>
            )}
            {entry.structured.outcome && entry.structured.outcome.status !== "pending" && (
              <p className="care-record-outcome">
                Outcome ({entry.structured.outcome.status}): {entry.structured.outcome.summary}
              </p>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

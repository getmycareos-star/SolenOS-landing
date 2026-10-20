import type { TimelineEntry } from "@/lib/ui-runtime";

interface TimelineLogViewProps {
  entries: readonly TimelineEntry[];
  situationId: string | null;
}

/** Append-only audit timeline — chronological, immutable, no edit controls. */
export function TimelineLogView({ entries, situationId }: TimelineLogViewProps) {
  const visible = situationId
    ? entries.filter((e) => e.situationId === situationId)
    : entries;

  const chronological = [...visible].sort((a, b) =>
    a.timestamp.localeCompare(b.timestamp),
  );

  return (
    <section className="timeline-log" aria-label="Timeline audit log">
      <header className="region-header">
        <h2 className="region-title">Timeline</h2>
        <p className="region-hint">Append-only operational audit — not a conversation</p>
      </header>

      {chronological.length === 0 ? (
        <p className="timeline-empty">No timeline events yet.</p>
      ) : (
        <ol className="timeline-list">
          {chronological.map((entry) => (
            <li key={entry.id} className="timeline-entry" data-type={entry.type}>
              <time dateTime={entry.timestamp} className="timeline-time">
                {formatTimestamp(entry.timestamp)}
              </time>
              <span className="timeline-type">{entry.type}</span>
              <p className="timeline-summary">{entry.summary}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

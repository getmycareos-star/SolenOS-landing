"use client";

import type { CanonicalCareEvent } from "@/lib/situation-entry";
import { getTopEvents, UI_SURFACE_LIMIT } from "@/lib/care-event-priority";
import { formatEventTimeLabel } from "@/lib/time-model";

type Props = {
  events: CanonicalCareEvent[];
  className?: string;
  /** Full timeline for expand — all events ranked by priority */
  showFullTimeline?: boolean;
};

function tierClass(tier: string): string {
  return `priority-tier priority-tier-${tier.toLowerCase()}`;
}

export function SituationTimelinePanel({
  events,
  className,
  showFullTimeline = false,
}: Props) {
  if (events.length === 0) return null;

  const ranked = getTopEvents(events, showFullTimeline ? events.length : UI_SURFACE_LIMIT);
  const hiddenCount = showFullTimeline
    ? 0
    : Math.max(0, events.filter((e) => e.status !== "invalidated" && e.status !== "superseded").length - UI_SURFACE_LIMIT);

  return (
    <section
      className={className}
      aria-labelledby="situation-timeline-heading"
      data-testid="situation-timeline-panel"
    >
      <h3 id="situation-timeline-heading" className="section-kicker">
        {showFullTimeline ? "Full timeline" : "What matters now"}
      </h3>
      <p className="situation-timeline-hint">
        Sorted by priority score — not timestamp or ingestion order.
        {hiddenCount > 0 && ` ${hiddenCount} lower-priority event${hiddenCount === 1 ? "" : "s"} hidden.`}
      </p>
      <ul className="situation-timeline-list">
        {ranked.map((event) => (
          <li key={event.id} className="situation-timeline-item">
            <div className="situation-timeline-meta">
              <span className={tierClass(event.priority.tier)}>{event.priority.tier}</span>
              <span className="priority-score">{event.priority.priority_score}</span>
              <time dateTime={event.timestamp}>{formatEventTimeLabel(event.event_time)}</time>
              {event.event_time.type !== "exact" && (
                <span className="time-uncertainty-badge">{event.event_time.type}</span>
              )}
              <span className="extracted-type">{event.extracted_type.replace(/_/g, " ")}</span>
              {event.source === "document" && <span className="source-badge">document</span>}
            </div>
            <p className="situation-timeline-body">{event.raw_input}</p>
            {event.uncertainty.length > 0 && (
              <p className="situation-timeline-uncertainty">
                Uncertain: {event.uncertainty.join("; ")}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

"use client";

import type { CanonicalCareEvent } from "@/lib/situation-entry";
import { formatEventTimeLabel } from "@/lib/time-model";

type Props = {
  events: CanonicalCareEvent[];
  className?: string;
};

export function PriorityAttentionPanel({ events, className }: Props) {
  const critical = events.filter((e) => e.priority.priority_score >= 80);

  if (critical.length === 0) return null;

  return (
    <section
      className={className}
      aria-labelledby="priority-attention-heading"
      data-testid="priority-attention-panel"
    >
      <h3 id="priority-attention-heading" className="section-kicker">
        Needs attention
      </h3>
      <ul className="priority-attention-list">
        {critical.map((event) => (
          <li key={event.id} className="priority-attention-item">
            <div className="priority-attention-meta">
              <span className="priority-tier priority-tier-critical">{event.priority.tier}</span>
              <span className="priority-score">Score {event.priority.priority_score}</span>
              <span className="extracted-type">{event.extracted_type.replace(/_/g, " ")}</span>
            </div>
            <p className="priority-attention-body">{event.raw_input}</p>
            <p className="priority-attention-signals">
              Urgency {event.priority.urgency} · Uncertainty {event.priority.uncertainty} ·{" "}
              {formatEventTimeLabel(event.event_time)}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

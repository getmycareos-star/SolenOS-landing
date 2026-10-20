"use client";

import type { CareJourneyGraphLayerPayload } from "@/lib/care-journey-graph";
import { EVENT_TYPE_LABELS } from "@/lib/care-journey-graph";

type Props = {
  layer: CareJourneyGraphLayerPayload | null;
};

export function CareContinuityPanel({ layer }: Props) {
  if (!layer) return null;

  const { continuity, new_relationships, event_type, facts_only_summary } = layer;

  return (
    <section className="clarity-section care-continuity" aria-label="Care journey continuity">
      <h2 className="section-kicker">Care journey</h2>
      <p className="care-continuity-facts">{facts_only_summary}</p>
      <p className="care-continuity-event-type">
        Recorded as: {EVENT_TYPE_LABELS[event_type]}
      </p>

      {continuity.what_changed_since_last.length > 0 && (
        <div className="care-continuity-block">
          <h3>What changed</h3>
          <ul>
            {continuity.what_changed_since_last.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {continuity.patterns_detected.length > 0 && (
        <div className="care-continuity-block">
          <h3>Continuity patterns</h3>
          <ul>
            {continuity.patterns_detected.map((p) => (
              <li key={p.pattern_note}>{p.pattern_note}</li>
            ))}
          </ul>
        </div>
      )}

      {new_relationships.length > 0 && (
        <div className="care-continuity-block">
          <h3>Linked events</h3>
          <ul className="care-journey-relationships">
            {new_relationships.map((rel) => (
              <li key={rel.id}>
                <span className="rel-type">{rel.relationship_type.replace(/_/g, " ")}</span>
                {rel.note && <span className="rel-note"> — {rel.note}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {continuity.suggested_connection_questions.length > 0 && (
        <div className="care-continuity-block">
          <h3>Connection questions</h3>
          <ul>
            {continuity.suggested_connection_questions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </div>
      )}

      {continuity.open_questions.length > 0 && (
        <div className="care-continuity-block">
          <h3>Open questions</h3>
          <ul>
            {continuity.open_questions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </div>
      )}

      {continuity.continuity_notes.length > 0 && (
        <ul className="care-continuity-notes">
          {continuity.continuity_notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

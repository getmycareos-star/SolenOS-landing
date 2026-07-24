"use client";

import type { ContradictionDetectionResult } from "@/lib/contradiction-detection-engine";

type Props = {
  layer: ContradictionDetectionResult;
};

export function ContradictionDetectionPanel({ layer }: Props) {
  if (!layer.active) return null;

  return (
    <div className="contradiction-detection-panel">
      <h4>Contradiction &amp; transition tracking</h4>
      <p className="panel-muted">{layer.defining_principle}</p>
      <p>
        Events preserved: <strong>{layer.events_preserved_count}</strong>
        {" · "}
        Transitions: <strong>{layer.transitions.length}</strong>
        {" · "}
        Open contradictions: <strong>{layer.open_contradictions.length}</strong>
      </p>

      {layer.transitions.length > 0 && (
        <ul>
          {layer.transitions.map((t) => (
            <li key={t.transition_id}>
              {t.from_state} → {t.to_state} ({t.type}, {Math.round(t.confidence * 100)}%)
            </li>
          ))}
        </ul>
      )}

      {layer.clarification_triggers.length > 0 && (
        <div>
          <h5>Safety clarification</h5>
          <ul>
            {layer.clarification_triggers.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

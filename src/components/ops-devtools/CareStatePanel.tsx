"use client";

import type { CareStateEngineResult } from "@/lib/care-state-engine";

type Props = { layer: CareStateEngineResult };

export function CareStatePanel({ layer }: Props) {
  if (!layer.active) return null;
  const s = layer.care_state;

  return (
    <div className="care-state-panel">
      <h4>Care state</h4>
      <p className="panel-muted">{layer.defining_principle}</p>
      <p>
        <strong>Current understanding:</strong> {s.current_understanding}
      </p>

      {s.recent_changes.length > 0 && (
        <section>
          <h5>What changed</h5>
          <ul>
            {s.recent_changes.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      )}

      {s.needs_attention.length > 0 && (
        <section>
          <h5>Needs attention</h5>
          <ul>
            {s.needs_attention.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      )}

      {s.unknowns.length > 0 && (
        <section>
          <h5>What we don&apos;t know</h5>
          <ul>
            {s.unknowns.slice(0, 4).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      )}

      {s.explicit_unknowns?.length > 0 && (
        <section>
          <h5>Explicit unknowns</h5>
          <ul>
            {s.explicit_unknowns.slice(0, 4).map((u) => (
              <li key={u.unknown_id ?? u.field_name}>
                <strong>{u.priority}</strong>: {u.missing_information ?? u.field_name} —{" "}
                {u.reason_it_matters ?? u.why_it_matters}
              </li>
            ))}
          </ul>
        </section>
      )}

      {s.confidence_scores.length > 0 && (
        <section>
          <h5>Confidence</h5>
          <ul>
            {s.confidence_scores.slice(0, 3).map((c) => (
              <li key={c.area}>
                {c.area}: {c.level} — {c.note}
              </li>
            ))}
          </ul>
        </section>
      )}

      {s.what_is_stable.length > 0 && (
        <section>
          <h5>Stable</h5>
          <ul>
            {s.what_is_stable.slice(0, 3).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

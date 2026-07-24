"use client";

import type { MultiCaregiverContextResult } from "@/lib/multi-caregiver-context-model";

type Props = {
  layer: MultiCaregiverContextResult;
  viewerCaregiverId?: string;
};

export function MultiCaregiverContextPanel({ layer }: Props) {
  if (!layer.active) return null;

  const shared = layer.shared_reality;

  return (
    <div className="multi-caregiver-context-panel">
      <h4>Shared care reality</h4>
      <p className="panel-muted">{layer.defining_principle}</p>

      {shared.aggregated_state.length > 0 && (
        <section>
          <h5>Current condition (fused)</h5>
          <ul>
            {shared.aggregated_state.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      )}

      {shared.unresolved_questions.length > 0 && (
        <section>
          <h5>System questions</h5>
          <ul>
            {shared.unresolved_questions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </section>
      )}

      {shared.active_risks.length > 0 && (
        <section>
          <h5>Active signals</h5>
          <ul>
            {shared.active_risks.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </section>
      )}

      <details className="system-layers-internal">
        <summary>Internal audit (not shared between caregivers)</summary>
        <p className="panel-muted">
          Attribution exists for clinical traceability but is never shown in the shared view.
        </p>
        <p>{layer.attribution_map.length} attribution record(s) — internal only</p>
      </details>
    </div>
  );
}

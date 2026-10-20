"use client";

import type { BaselineIntelligenceResult } from "@/lib/baseline-intelligence-engine";

type Props = {
  layer: BaselineIntelligenceResult;
};

export function BaselineIntelligencePanel({ layer }: Props) {
  if (!layer.active) return null;

  return (
    <div className="baseline-intelligence-panel">
      <h4>Baseline intelligence</h4>
      <p className="panel-muted">{layer.defining_principle}</p>

      {layer.baseline_facts.length > 0 && (
        <section>
          <h5>What is normal for this person</h5>
          <ul>
            {layer.baseline_facts.map((f) => (
              <li key={`${f.domain}-${f.label}`}>
                [{f.domain.replace(/_/g, " ")}] {f.label}
              </li>
            ))}
          </ul>
        </section>
      )}

      {layer.deviations.length > 0 && (
        <section>
          <h5>Is this unusual for this person?</h5>
          <ul>
            {layer.deviations.map((d) => (
              <li key={`${d.source_event_id}-${d.observation}`}>
                {d.is_unusual_for_person ? "Unusual — " : "Within pattern — "}
                {d.observation} ({d.deviation_type.replace(/_/g, " ")})
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

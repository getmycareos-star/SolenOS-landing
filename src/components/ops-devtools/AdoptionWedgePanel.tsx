"use client";

import type { AdoptionWedgeResult } from "@/lib/adoption-wedge-engine";

type Props = {
  layer: AdoptionWedgeResult;
};

export function AdoptionWedgePanel({ layer }: Props) {
  if (!layer.active) return null;

  const { sections } = layer;

  return (
    <div className="adoption-wedge-panel">
      <h4>Organized from your input</h4>
      <p className="panel-muted">{layer.defining_principle}</p>

      {layer.ingestion_ready ? (
        <p className="adoption-wedge-ingestion">{sections.structured_summary_of_chaos[0]}</p>
      ) : (
        <>
          {sections.structured_summary_of_chaos.length > 0 && (
            <div>
              <h5>Structured summary</h5>
              <ul>
                {sections.structured_summary_of_chaos.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          )}

          {sections.current_state_snapshot.length > 0 && (
            <div>
              <h5>Current situation</h5>
              <ul>
                {sections.current_state_snapshot.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          )}

          {sections.actionable_output.length > 0 && (
            <div>
              <h5>What needs attention</h5>
              <ul>
                {sections.actionable_output.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

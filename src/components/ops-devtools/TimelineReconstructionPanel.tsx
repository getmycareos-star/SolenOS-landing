"use client";

import type { TimelineReconstructionResult } from "@/lib/timeline-reconstruction-engine";

type Props = {
  layer: TimelineReconstructionResult;
};

export function TimelineReconstructionPanel({ layer }: Props) {
  if (!layer.active) return null;

  return (
    <div className="timeline-reconstruction-panel">
      <h4>Reconstructed timeline</h4>
      <p className="panel-muted">{layer.defining_principle}</p>

      {layer.nodes.length > 0 && (
        <ol>
          {layer.nodes.map((node) => (
            <li key={node.node_id}>
              <strong>{node.ordering_label}</strong> — {node.observation.slice(0, 100)}
              <span className="panel-muted">
                {" "}
                (confidence {Math.round(node.temporal_confidence * 100)}%)
              </span>
            </li>
          ))}
        </ol>
      )}

      {layer.uncertainty_flags.length > 0 && (
        <div>
          <h5>Ordering uncertainty</h5>
          <ul>
            {layer.uncertainty_flags.map((flag) => (
              <li key={flag}>{flag}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

"use client";

import type { ProductRealityModelResult } from "@/lib/product-reality-model";

type Props = {
  layer: ProductRealityModelResult;
};

export function ProductRealityModelPanel({ layer }: Props) {
  if (!layer.active) return null;

  return (
    <div className="product-reality-model-panel">
      <h4>Operating model</h4>
      <p className="panel-muted">{layer.defining_principle}</p>
      <p>
        Event-driven state: <strong>{layer.event_driven ? "yes" : "no"}</strong>
        {" · "}
        Open contradictions: <strong>{layer.contradiction_count}</strong>
        {" · "}
        Uncertainty signals: <strong>{layer.incomplete_fields_count}</strong>
      </p>
      {layer.failure_modes_detected.length > 0 && (
        <ul>
          {layer.failure_modes_detected.map((mode) => (
            <li key={mode}>{mode.replace(/_/g, " ")}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

"use client";

import type { ProductNorthStarResult } from "@/lib/product-north-star";

type Props = { layer: ProductNorthStarResult };

export function ProductNorthStarPanel({ layer }: Props) {
  if (!layer.active) return null;

  return (
    <div className="product-north-star-panel">
      <h4>Product North Star</h4>
      <p>
        <strong>{layer.north_star}</strong>
      </p>
      <p className="panel-muted">{layer.defining_principle}</p>

      {layer.demand && (
        <section>
          <h5>Demand signal</h5>
          <p>
            {layer.demand.demand_type.replace(/_/g, " ")}
            {layer.demand.treat_as_product_signal ? " — core product fit" : ""}
          </p>
          {layer.demand.underlying_needs[0] && (
            <p className="panel-muted">{layer.demand.underlying_needs[0]}</p>
          )}
          {layer.demand.build_engines_not_answers.length > 0 && (
            <p className="panel-muted">
              Build engines, not answers:{" "}
              {layer.demand.build_engines_not_answers.slice(0, 4).join(", ")}
            </p>
          )}
        </section>
      )}

      <section>
        <h5>Memory questions covered</h5>
        <ul>
          {Object.entries(layer.implicit_output_coverage).map(([key, ok]) => (
            <li key={key}>
              {ok ? "✓" : "·"} {key.replace(/_/g, " ")}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

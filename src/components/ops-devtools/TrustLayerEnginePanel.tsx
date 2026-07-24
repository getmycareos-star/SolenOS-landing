"use client";

import type { TrustLayerEngineResult } from "@/lib/trust-layer-engine";

type Props = {
  layer: TrustLayerEngineResult;
};

export function TrustLayerEnginePanel({ layer }: Props) {
  if (!layer.active) return null;

  const { trust_layer: trust } = layer;

  return (
    <div className="trust-layer-engine-panel">
      <h4>Trust layer</h4>
      <p className="panel-muted">{layer.defining_principle}</p>
      <p>
        Confidence: {trust.recency.interpretation} — freshness{" "}
        {trust.recency.freshness_score >= 0.7
          ? "recent"
          : trust.recency.freshness_score >= 0.4
            ? "aging"
            : "stale"}
      </p>

      {trust.known.length > 0 && (
        <section>
          <h5>What solenos knows</h5>
          <ul>
            {trust.known.map((k) => (
              <li key={`${k.source}-${k.statement.slice(0, 40)}`}>
                {k.statement}
                <span className="panel-muted"> — {k.source}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {trust.assumed.length > 0 && (
        <section>
          <h5>What solenos assumes</h5>
          <ul>
            {trust.assumed.map((a) => (
              <li key={a.statement.slice(0, 60)}>
                {a.statement}
                <span className="panel-muted"> — {a.reasoning_basis}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {trust.unknown.length > 0 && (
        <section>
          <h5>What solenos does not know</h5>
          <ul>
            {trust.unknown.map((u) => (
              <li key={u.statement.slice(0, 60)}>
                {u.statement}
                {u.drives_clarification && (
                  <span className="panel-muted"> — drives clarification</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {!layer.valid && layer.validation_errors.length > 0 && (
        <section>
          <h5>Validation</h5>
          <ul>
            {layer.validation_errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

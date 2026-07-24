"use client";

import type { PolicyEngineResult } from "@/lib/policy-engine";

type Props = {
  layer: PolicyEngineResult;
};

export function PolicyEnginePanel({ layer }: Props) {
  if (!layer.active) return null;

  return (
    <div className="policy-engine-panel">
      <h4>Policy engine</h4>
      <p className="panel-muted">{layer.defining_principle}</p>
      <p>
        Consent verified: <strong>{layer.consent_verified ? "yes" : "no"}</strong>
        {layer.limited_mode && " · limited mode"}
      </p>
      {layer.ingestion && !layer.ingestion.allowed && (
        <p className="panel-muted">{layer.ingestion.blocked_reason}</p>
      )}
      {layer.output && layer.output.sanitized_fields.length > 0 && (
        <p className="panel-muted">
          Output sanitized: {layer.output.sanitized_fields.join(", ")}
        </p>
      )}
      <p className="panel-muted">{layer.data_use.reason}</p>
    </div>
  );
}

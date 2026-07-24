"use client";

import type { ForbiddenBuildZoneResult } from "@/lib/forbidden-build-zone";

type Props = {
  layer: ForbiddenBuildZoneResult;
};

export function ForbiddenBuildZonePanel({ layer }: Props) {
  if (!layer.active) return null;

  return (
    <div className="forbidden-build-zone-panel">
      <h4>Build filter</h4>
      <p className="panel-muted">{layer.defining_principle}</p>
      <p>
        Filter passed: <strong>{layer.build_filter_passed ? "yes" : "no"}</strong>
      </p>
      {layer.output_violations.length > 0 && (
        <ul>
          {layer.output_violations.map((v) => (
            <li key={v}>{v}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

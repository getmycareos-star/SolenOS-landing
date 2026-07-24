"use client";

import type { ArchitecturalBoundariesResult } from "@/lib/architectural-boundaries";

type Props = {
  layer: ArchitecturalBoundariesResult;
};

export function ArchitecturalBoundariesPanel({ layer }: Props) {
  if (!layer.enforced) return null;

  return (
    <div className="architectural-boundaries-panel">
      <h4>Architectural boundaries</h4>
      <p className="panel-muted">{layer.defining_principle}</p>
      <p>
        Rules satisfied: {layer.rules_satisfied.length} / {layer.rules_checked.length}
      </p>
      {layer.violations_detected.length > 0 && (
        <section>
          <h5>Violations detected and remediated</h5>
          <ul>
            {layer.violations_detected.map((v) => (
              <li key={`${v.rule}-${v.field}`}>
                [{v.rule}] {v.matched_text} → {v.remediation}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

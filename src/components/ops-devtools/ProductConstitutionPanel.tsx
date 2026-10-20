"use client";

import type { ProductConstitutionResult } from "@/lib/product-constitution";

type Props = { layer: ProductConstitutionResult };

export function ProductConstitutionPanel({ layer }: Props) {
  if (!layer.active) return null;
  const d = layer.daily_care_confidence;

  return (
    <div className="product-constitution-panel">
      <h4>Living Care Record</h4>
      <p className="panel-muted">{layer.worldview}</p>
      <p>
        <strong>Care status:</strong> {d.understanding_level.replace(/_/g, " ")}
      </p>

      {d.ten_minute_priorities.length > 0 && (
        <section>
          <h5>If you only have 10 minutes</h5>
          <ol>
            {d.ten_minute_priorities.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
        </section>
      )}

      {d.information_gaps.length > 0 && (
        <section>
          <h5>What we don&apos;t know</h5>
          <ul>
            {d.information_gaps.slice(0, 4).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      )}

      {d.nothing_urgent.length > 0 && d.potential_concerns.length === 0 && (
        <section>
          <h5>Permission to pause</h5>
          <ul>
            {d.nothing_urgent.slice(0, 2).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      )}

      <p className="panel-muted">{layer.tagline}</p>
    </div>
  );
}

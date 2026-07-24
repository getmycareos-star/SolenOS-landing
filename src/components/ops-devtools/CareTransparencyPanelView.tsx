"use client";

import type { CareTransparencyPanel } from "@/lib/care-transparency-layer";

type Props = {
  panel: CareTransparencyPanel;
};

export function CareTransparencyPanelView({ panel }: Props) {
  return (
    <details className="care-transparency-panel" open>
      <summary>Why am I seeing this?</summary>

      <p>
        <strong>Reason:</strong> {panel.reason_for_output}
      </p>
      <p>
        Understanding: <strong>{panel.confidence_scores.tier}</strong> · Recency:{" "}
        {panel.recency.decay_status}
      </p>

      {panel.data_used.care_events.length > 0 && (
        <div>
          <h5>Data used</h5>
          <ul>
            {panel.data_used.care_events.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {(panel.data_ignored.conflicting.length > 0 ||
        panel.data_ignored.low_confidence.length > 0) && (
        <div>
          <h5>Data ignored</h5>
          <ul>
            {[...panel.data_ignored.conflicting, ...panel.data_ignored.low_confidence].map(
              (item) => (
                <li key={item}>{item}</li>
              ),
            )}
          </ul>
        </div>
      )}

      <div className="transparency-split">
        {panel.observed.length > 0 && (
          <div>
            <h5>Observed</h5>
            <ul>
              {panel.observed.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
          </div>
        )}
        {panel.inferred.length > 0 && (
          <div>
            <h5>Inferred</h5>
            <ul>
              {panel.inferred.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </details>
  );
}

"use client";

import type { StateOfCareSummaryResult } from "@/lib/state-of-care-summary-engine";
import { STATE_OF_CARE_SECTIONS } from "@/lib/state-of-care-summary-engine";

const SECTION_LABELS: Record<(typeof STATE_OF_CARE_SECTIONS)[number], string> = {
  what_is_happening_now: "What is happening now",
  what_changed_recently: "What changed recently",
  what_needs_attention: "What needs attention",
  what_is_stable: "What is stable",
  what_remains_uncertain: "What remains uncertain",
  what_should_happen_next: "What should happen next",
};

type Props = {
  layer: StateOfCareSummaryResult;
};

export function StateOfCareSummaryPanel({ layer }: Props) {
  if (!layer.active) return null;

  const { summary } = layer;

  return (
    <div className="state-of-care-summary-panel">
      <h4>State of Care</h4>
      <p className="panel-muted">{layer.defining_principle}</p>
      <p className="state-of-care-headline">
        <strong>What matters most:</strong> {summary.what_matters_most}
      </p>
      <p className="panel-muted">
        Snapshot v{summary.snapshot_version} — {summary.timestamp}
      </p>
      {STATE_OF_CARE_SECTIONS.map((key) => (
        <div key={key} className="state-of-care-section">
          <h5>{SECTION_LABELS[key]}</h5>
          <ul>
            {summary.sections[key].map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

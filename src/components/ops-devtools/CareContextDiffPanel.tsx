"use client";

import type { CareContextDiffResult } from "@/lib/care-context-diff-engine";
import { CARE_CONTEXT_DIFF_SECTIONS } from "@/lib/care-context-diff-engine";

const SECTION_LABELS: Record<(typeof CARE_CONTEXT_DIFF_SECTIONS)[number], string> = {
  factual_delta: "What changed",
  directional_change: "What progressed or worsened",
  newly_important: "What is newly important",
  lost_confidence: "What lost confidence",
  stabilized: "What stabilized",
  system_interpretation: "What this means",
};

type Props = {
  layer: CareContextDiffResult;
};

export function CareContextDiffPanel({ layer }: Props) {
  if (!layer.active) return null;

  const { diff } = layer;

  return (
    <div className="care-context-diff-panel">
      <h4>Care context diff</h4>
      <p className="panel-muted">{layer.defining_principle}</p>
      <p>
        <strong>{diff.primary_change}</strong>
      </p>
      <p className="panel-muted">
        {diff.time_frame} (relative to {diff.relative_to})
      </p>
      {CARE_CONTEXT_DIFF_SECTIONS.map((key) => {
        const items = diff.sections[key];
        if (items.length === 0) return null;
        return (
          <div key={key} className="care-context-diff-section">
            <h5>{SECTION_LABELS[key]}</h5>
            <ul>
              {items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

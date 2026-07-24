"use client";

import type { RetentionEngineResult } from "@/lib/retention-engine";
import { RETURN_STATE_SECTIONS } from "@/lib/retention-engine";

type Props = {
  layer: RetentionEngineResult;
};

const SECTION_LABELS: Record<(typeof RETURN_STATE_SECTIONS)[number], string> = {
  what_changed_since_last_visit: "What changed since last visit",
  what_got_worse: "What got worse",
  what_got_better: "What got better",
  what_needs_action_now: "What needs action now",
  what_is_stable: "What is stable",
};

export function ReturnStateOfCarePanel({ layer }: Props) {
  if (!layer.active) return null;

  const { return_state } = layer;

  return (
    <div className="return-state-of-care-panel">
      <h4>Return state of care</h4>
      <p className="panel-muted">{layer.defining_principle}</p>
      {!return_state.is_return_session && (
        <p className="panel-muted">Active session — delta will deepen after time away.</p>
      )}

      {RETURN_STATE_SECTIONS.map((key) => {
        const items = return_state.sections[key];
        if (items.length === 0) return null;
        return (
          <section key={key}>
            <h5>{SECTION_LABELS[key]}</h5>
            <ul>
              {items.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

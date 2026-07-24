"use client";

import type { BehaviorInterpretationResult } from "@/lib/behavior-interpretation-engine";

type Props = {
  layer: BehaviorInterpretationResult;
};

export function BehaviorInterpretationPanel({ layer }: Props) {
  if (!layer.triggered) return null;

  return (
    <div className="behavior-interpretation-panel">
      <h4>Behavior interpretation</h4>
      <p className="panel-muted">
        Observable signals only — multiple hypotheses, not a diagnosis.
      </p>

      {layer.observed_behaviors.length > 0 && (
        <section>
          <h5>What behavior occurred</h5>
          <ul>
            {layer.observed_behaviors.map((b) => (
              <li key={`${b.behavior_id}-${b.source_event_id}`}>{b.label}</li>
            ))}
          </ul>
        </section>
      )}

      {layer.hypotheses.length > 0 && (
        <section>
          <h5>What might it communicate</h5>
          <ul>
            {layer.hypotheses.slice(0, 6).map((h) => (
              <li key={`${h.interpretation}-${h.supporting_event_ids.join(",")}`}>
                {h.interpretation} ({h.confidence}) — {h.uncertainty_note}
              </li>
            ))}
          </ul>
        </section>
      )}

      {layer.investigation_checklist.length > 0 && (
        <section>
          <h5>What should be investigated</h5>
          <ul>
            {layer.investigation_checklist.slice(0, 6).map((i) => (
              <li key={`${i.domain}-${i.item}`}>
                [{i.domain}] {i.item}
              </li>
            ))}
          </ul>
        </section>
      )}

      {layer.recommended_approach.length > 0 && (
        <section>
          <h5>Safest caregiver approach</h5>
          <ul>
            {layer.recommended_approach.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </section>
      )}

      {layer.escalation.escalation_recommended && (
        <section className="behavior-escalation">
          <h5>Professional review suggested</h5>
          <ul>
            {layer.escalation.triggers.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>
      )}

      {layer.behavioral_change_detected && (
        <p className="panel-muted">Behavioral change detected vs prior continuity.</p>
      )}
    </div>
  );
}

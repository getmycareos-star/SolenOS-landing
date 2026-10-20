"use client";

import type { CrisisModeInteractionResult } from "@/lib/crisis-mode-interaction-layer";

type Props = {
  layer: CrisisModeInteractionResult;
};

export function CrisisModeInteractionPanel({ layer }: Props) {
  if (!layer.crisis_mode || !layer.crisis_output) return null;

  const co = layer.crisis_output;

  return (
    <div className="crisis-mode-panel">
      <h4>Crisis mode — triage</h4>
      <p className="panel-muted">{layer.defining_principle}</p>
      <p>
        Urgency: {layer.urgency_level} — UI: {layer.ui_mode}
      </p>

      <section>
        <h5>Immediate concerns</h5>
        <ul>
          {co.immediate_concerns.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </section>

      <section>
        <h5>Immediate actions</h5>
        <ul>
          {co.immediate_actions.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      </section>

      {co.do_not_do.length > 0 && (
        <section>
          <h5>Do not do</h5>
          <ul>
            {co.do_not_do.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h5>Monitor</h5>
        <ul>
          {co.monitor.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      </section>

      <section>
        <h5>Escalation</h5>
        <ul>
          <li>Clinician: {co.escalation.clinician}</li>
          <li>Emergency: {co.escalation.emergency_services}</li>
          <li>Network: {co.escalation.caregiver_network}</li>
        </ul>
      </section>

      {layer.suppressed_engines.length > 0 && (
        <p className="panel-muted">
          Deferred: {layer.suppressed_engines.join(", ")}
        </p>
      )}
    </div>
  );
}

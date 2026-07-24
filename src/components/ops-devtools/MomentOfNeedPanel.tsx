"use client";

import type { MomentOfNeedResult } from "@/lib/moment-of-need-engine";

type Props = {
  layer: MomentOfNeedResult;
};

export function MomentOfNeedPanel({ layer }: Props) {
  if (!layer.triggered) return null;

  return (
    <div className="moment-of-need-panel">
      <h4>What is happening right now</h4>
      <p className="panel-muted">{layer.defining_principle}</p>

      {layer.sections.what_changed.length > 0 && (
        <section>
          <h5>What changed</h5>
          <ul>
            {layer.sections.what_changed.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      )}

      {layer.sections.what_we_know.length > 0 && (
        <section>
          <h5>What we know</h5>
          <ul>
            {layer.sections.what_we_know.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      )}

      {layer.sections.possible_context.length > 0 && (
        <section>
          <h5>Possible context</h5>
          <ul>
            {layer.sections.possible_context.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      )}

      {layer.sections.questions_worth_tracking.length > 0 && (
        <section>
          <h5>Questions worth tracking</h5>
          <ul>
            {layer.sections.questions_worth_tracking.slice(0, 5).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      )}

      {layer.human_support.length > 0 && (
        <section>
          <h5>Support</h5>
          <ul>
            {layer.human_support.map((s) => (
              <li key={`${s.kind}-${s.message}`}>
                [{s.kind.replace(/_/g, " ")}] {s.message}
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="panel-muted">
        Confidence: {layer.confidence} · Not a diagnosis — person-specific context only
      </p>
    </div>
  );
}

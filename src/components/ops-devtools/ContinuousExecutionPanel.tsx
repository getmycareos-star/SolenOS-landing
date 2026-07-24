"use client";

import type { ContinuousExecutionLoopLayer } from "@/lib/continuous-execution-loop";

type Props = {
  layer: ContinuousExecutionLoopLayer;
};

export function ContinuousExecutionPanel({ layer }: Props) {
  return (
    <div className="continuous-execution-panel">
      <h4>Execution loop</h4>
      <p className="panel-muted">
        Mode: {layer.system_mode} · Phase: {layer.loop_phase} · Operation: {layer.operation}
      </p>
      {layer.output_triggered_by_diff && (
        <p className="panel-muted">Output triggered by state diff (not full history).</p>
      )}
      {layer.what_changed.length > 0 && (
        <section>
          <h5>Diff summary</h5>
          <ul>
            {layer.what_changed.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      )}
      {layer.open_uncertainties.length > 0 && (
        <section>
          <h5>Open uncertainty</h5>
          <ul>
            {layer.open_uncertainties.map((u) => (
              <li key={u}>{u}</li>
            ))}
          </ul>
        </section>
      )}
      {layer.idle_refresh && (
        <section>
          <h5>Idle refresh</h5>
          <ul>
            {layer.idle_refresh.since_last_loop.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

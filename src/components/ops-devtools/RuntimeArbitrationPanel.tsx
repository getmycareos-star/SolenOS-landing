"use client";

import type { PriorityResolutionResult } from "@/lib/priority-resolution-system";
import type { EdgeStateResult } from "@/lib/edge-state-machine";
import type { ConfidenceCalibrationResult } from "@/lib/confidence-calibration-system";
import type { EventSourcedStorageResult } from "@/lib/event-sourced-storage";
import type { EngineExecutionContractResult } from "@/lib/engine-execution-contract";

type Props = {
  priority?: PriorityResolutionResult;
  edge?: EdgeStateResult;
  confidence?: ConfidenceCalibrationResult;
  storage?: EventSourcedStorageResult;
  engineContract?: EngineExecutionContractResult;
};

export function RuntimeArbitrationPanel({
  priority,
  edge,
  confidence,
  storage,
  engineContract,
}: Props) {
  if (!priority?.active && !edge?.active) return null;

  return (
    <div className="runtime-arbitration-panel">
      <h4>Runtime arbitration</h4>

      {priority?.active && (
        <section>
          <h5>Dominant mode</h5>
          <p>
            <strong>{priority.dominant_mode.replace(/_/g, " ")}</strong>
          </p>
          <p className="panel-muted">{priority.selection_reason}</p>
          <p className="panel-muted">
            Suppressed: {priority.suppressed_modes.map((m) => m.replace(/_/g, " ")).join(", ")}
          </p>
        </section>
      )}

      {edge?.active && (
        <section>
          <h5>Edge state</h5>
          <p>
            <strong>{edge.edge_state}</strong> — {edge.classification_reason}
          </p>
          {edge.banner_message && <p className="panel-muted">{edge.banner_message}</p>}
        </section>
      )}

      {confidence?.active && (
        <section>
          <h5>Confidence calibration</h5>
          <p>
            Aggregate: {(confidence.aggregate_confidence * 100).toFixed(0)}% —{" "}
            {confidence.aggregate_reason}
          </p>
        </section>
      )}

      {storage?.active && (
        <section>
          <h5>Event-sourced storage</h5>
          <p className="panel-muted">
            {storage.event_count} events in store · projection rebuildable · mutation blocked
          </p>
        </section>
      )}

      {engineContract?.active && (
        <section>
          <h5>Engine contracts</h5>
          <p className="panel-muted">
            {engineContract.registered_engines} engines · emit-only ·{" "}
            {engineContract.contract_valid ? "valid" : "violations detected"}
          </p>
        </section>
      )}
    </div>
  );
}

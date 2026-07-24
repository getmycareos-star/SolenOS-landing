"use client";

import { Loader2 } from "lucide-react";

import { ACTIVATION_ACKNOWLEDGEMENT } from "@/lib/activation-system/contract-constants";

type Props = {
  phase: "idle" | "acknowledged" | "processing" | "done";
};

export function ActivationOutputPanel({ phase }: Props) {
  if (phase === "idle") {
    return (
      <div className="workspace-panel-inner placeholder-panel">
        <p className="clarity-placeholder">Updates to the care record will appear here…</p>
      </div>
    );
  }

  return (
    <div className="workspace-panel-inner activation-output" aria-live="polite">
      <p className="activation-ack">{ACTIVATION_ACKNOWLEDGEMENT}</p>
      {(phase === "acknowledged" || phase === "processing") && (
        <p className="activation-loading" role="status">
          <Loader2 className="spin" size={20} aria-hidden />
          <span>Preserving…</span>
        </p>
      )}
      {phase === "done" && (
        <p className="activation-ready">Ready — taking you there now.</p>
      )}
    </div>
  );
}

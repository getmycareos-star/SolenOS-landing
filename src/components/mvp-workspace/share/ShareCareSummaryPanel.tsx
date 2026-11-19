"use client";

import { X } from "lucide-react";
import { CareHandoffSharing } from "@/components/workflows/CareHandoffSharing";

export type ShareRequestState =
  | "idle"
  | "checking_readiness"
  | "empty"
  | "limited"
  | "audience_selection"
  | "preparing"
  | "review"
  | "format_selection"
  | "sharing"
  | "shared"
  | "failed"
  | "offline";

interface ShareCareSummaryPanelProps {
  intent?: "share" | "export";
  caregiverId: string;
  careSessionId: string;
  careRecipientName?: string;
  onClose: () => void;
  onShared?: () => void;
}

/**
 * All share/export briefings now use the backend LCR handoff pipeline.
 * The former browser-side /api/situation summary composer is intentionally
 * removed from this entry point so it cannot become a competing source of truth.
 */
export function ShareCareSummaryPanel({
  onClose,
}: ShareCareSummaryPanelProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="lcr-briefing-dialog-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 120,
        background: "rgba(18, 28, 20, 0.48)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 12,
      }}
    >
      <section
        style={{
          width: "min(980px, 100%)",
          maxHeight: "min(92vh, 900px)",
          overflowY: "auto",
          background: "#fff",
          borderRadius: 16,
          padding: 16,
          boxShadow: "0 18px 60px rgba(0,0,0,.22)",
        }}
      >
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
          <div>
            <h2 id="lcr-briefing-dialog-title" style={{ margin: 0, fontSize: 18, color: "#172117" }}>
              Prepare a care briefing
            </h2>
            <p style={{ margin: "4px 0 0", color: "#59665a", fontSize: 12 }}>
              Built from the saved Living Care Record. Review the sources before sharing.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close care briefing"
            style={{ border: "1px solid #d5dfd5", borderRadius: 9, background: "#fff", color: "#172117", padding: 8, cursor: "pointer" }}
          >
            <X size={18} aria-hidden />
          </button>
        </header>
        <CareHandoffSharing draft={null} audience={null} purpose={null} />
      </section>
    </div>
  );
}

"use client";

import { useState } from "react";
import { X } from "lucide-react";
import {
  CareHandoffSharing,
  type CareHandoffSharingProps,
} from "@/components/workflows/CareHandoffSharing";

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

type BriefingDraft = NonNullable<CareHandoffSharingProps["draft"]>;

function downloadBriefing(draft: BriefingDraft) {
  const sections = draft.generation?.sections ?? [];
  const content = [
    draft.audience === "family"
      ? "SolenOS Family Care Briefing"
      : "SolenOS Professional Care Briefing",
    "Source of truth: Living Care Record",
    "Prepared: " + (draft.prepared_at || "Not recorded"),
    "Period: " + (draft.window?.from || "Not recorded") + " to " + (draft.window?.to || "Not recorded"),
    "Review status: " + (draft.review_status || "Needs review"),
    ...(draft.generation?.sources_available && draft.generation.sources_considered !== undefined && draft.generation.sources_available > draft.generation.sources_considered ? ["Briefing selection: " + draft.generation.sources_considered + " of " + draft.generation.sources_available + " available source records. This is not the full Care Record."] : []),
    ...(draft.retrieval_complete === false ? [
      "Retrieval warning: this briefing does not include all available Care Record information.",
      ...(draft.partial_sources ?? []).map(item => item.source + ": at least " + item.returned_count + " records were retrieved; more may be available."),
      ...(draft.limitations ?? []).map(item => item.source === "allergies"
        ? "Allergy information could not be checked from a connected source. This does not mean there are no allergies."
        : item.source + ": " + item.status + (item.reason ? " (" + item.reason + ")" : "")),
    ] : []),
    "",
    draft.generation?.status === "source_only_fallback"
      ? "Important: The writing assistant was unavailable. This draft contains saved source wording only and has not been summarized or interpreted. Check each source and date before relying on or sharing it."
      : "Important: AI-written wording is a draft. Each item includes wording from its saved source. Check the source and uncertainty labels before relying on or sharing it.",
    ...sections.flatMap((item, index) => [
      "",
      item.section,
      item.summary || item.text,
      item.supporting_quote ? "Saved source wording: " + item.supporting_quote : "Saved source wording unavailable.",
      "Related care detail: " + (index + 1),
      "Evidence status: " + (item.epistemic_status || "Not recorded"),
      "Record status: " + (item.record_status || "Not recorded"),
      "Event date: " + (item.event_at || "Not recorded"),
      "Recorded date: " + (item.recorded_at || "Not recorded"),
      item.stale_warning ? "Warning: This information may be out of date." : "",
    ]),
    "",
    "This briefing does not update the Living Care Record.",
  ].filter(Boolean).join("\n");
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "solenos-care-briefing-" + new Date().toISOString().slice(0, 10) + ".txt";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function ShareCareSummaryPanel({
  intent = "share",
  onClose,
}: ShareCareSummaryPanelProps) {
  const [draft, setDraft] = useState<CareHandoffSharingProps["draft"]>(null);
  const [audience, setAudience] = useState<CareHandoffSharingProps["audience"]>(null);
  const [purpose, setPurpose] = useState<CareHandoffSharingProps["purpose"]>(null);
  const [exportReviewed, setExportReviewed] = useState(false);

  function resumeDraft(next: BriefingDraft) {
    setExportReviewed(false);
    setDraft(next);
    setAudience(next.audience === "professional" ? "professional" : "family");
    setPurpose(
      next.purpose === "professional_appointment"
        ? "appointment"
        : next.purpose === "period_summary"
          ? "overview"
          : "today",
    );
  }

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
        <CareHandoffSharing
          draft={draft}
          audience={audience}
          purpose={purpose}
          onResumeDraft={resumeDraft}
        />
        {intent === "export" && draft?.generation_status === "generated" && draft.validation_status === "exact_quote_reference_validation_passed" && (
          <div style={{ borderTop: "1px solid #e2e9e1", marginTop: 12, paddingTop: 12 }}>
            <label style={{ display: "flex", alignItems: "flex-start", gap: 9, fontSize: 12, lineHeight: 1.5, marginBottom: 10 }}>
              <input type="checkbox" checked={exportReviewed} onChange={event => setExportReviewed(event.target.checked)} />
              <span>I reviewed each generated summary item against its saved source wording and checked the dates and uncertainty labels.</span>
            </label>
            <button
              type="button"
              disabled={!exportReviewed}
              onClick={() => downloadBriefing(draft)}
              style={{ border: "1px solid #cbd8cb", borderRadius: 9, padding: "9px 12px", background: exportReviewed ? "#dce9dc" : "#eef1ec", color: "#172117", fontWeight: 650, cursor: exportReviewed ? "pointer" : "not-allowed" }}
            >
              Download summary (.txt)
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

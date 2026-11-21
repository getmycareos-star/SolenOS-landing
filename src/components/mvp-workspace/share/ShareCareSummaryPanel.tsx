"use client";

import { useState } from "react";
import { getJSON } from "@/api/client";
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
    ...(draft.selected_appointment ? [
      "Appointment: " + draft.selected_appointment.title,
      "Scheduled for: " + (draft.selected_appointment.scheduled_at || "Not recorded"),
      ...(draft.selected_appointment.provider ? ["Provider: " + draft.selected_appointment.provider] : []),
    ] : []),
    "Review status: " + (draft.review_status || "Needs review"),
    ...(draft.template_sections ?? []).filter(item => /medication/i.test(item.title)).map(item => item.coverage_note),
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
    "This briefing does not update the Care Record.",
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
  const [exportReviewedSourceRefs, setExportReviewedSourceRefs] = useState<string[]>([]);
  const [exportChecking, setExportChecking] = useState(false);
  const [exportError, setExportError] = useState("");
  const exportableDraft = draft !== null &&
    ["generated", "source_only_fallback"].includes(draft.generation_status || "") &&
    draft.validation_status === "exact_quote_reference_validation_passed" &&
    draft.source_freshness?.status === "current"
      ? draft
      : null;

  function resumeDraft(next: BriefingDraft) {
    setExportReviewed(false);
    setExportReviewedSourceRefs([]);
    setExportError("");
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

  async function verifyAndDownloadBriefing() {
    if (!exportableDraft || exportChecking) return;
    setExportChecking(true);
    setExportError("");
    try {
      const latest = await getJSON("/handoff-drafts/" + encodeURIComponent(exportableDraft.draft_id)) as BriefingDraft;
      const sameSnapshot = typeof latest.source_snapshot_sha256 === "string" &&
        latest.source_snapshot_sha256.length === 64 &&
        latest.source_snapshot_sha256 === exportableDraft.source_snapshot_sha256;
      const sameRevision = latest.revision_number === exportableDraft.revision_number;
      const sameReviewedSections = JSON.stringify(latest.generation?.sections ?? []) ===
        JSON.stringify(exportableDraft.generation?.sections ?? []);
      if (latest.source_freshness?.status !== "current" || !sameSnapshot || !sameRevision || !sameReviewedSections) {
        setDraft(latest);
        setExportReviewed(false);
        setExportReviewedSourceRefs([]);
        setExportError(latest.source_freshness?.status === "current"
          ? "This briefing changed after you reviewed it. Check the updated source items before exporting."
          : "The saved sources changed or could not be checked. Prepare a new briefing before exporting.");
        return;
      }
      const requiredRefs = [...new Set((latest.generation?.sections ?? []).map(item => item.source_ref))];
      if (!exportReviewed || requiredRefs.length === 0 || requiredRefs.some(ref => !exportReviewedSourceRefs.includes(ref))) {
        setExportError("Check every source item and the briefing notice before exporting.");
        return;
      }
      downloadBriefing(latest);
    } catch {
      setExportError("SolenOS could not confirm that this briefing is up to date. No file was exported.");
    } finally {
      setExportChecking(false);
    }
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
            <h2 id="lcr-briefing-dialog-title" style={{ margin: 0, fontSize: "calc(18px * var(--solenos-text-scale, 1))", color: "#172117" }}>
              Prepare a care briefing
            </h2>
            <p style={{ margin: "4px 0 0", color: "#59665a", fontSize: "calc(12px * var(--solenos-text-scale, 1))" }}>
              Built from the saved Care Record. Review the sources before sharing.
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
        {intent === "export" && draft && draft.source_freshness?.status !== "current" && (
          <p role="alert" style={{ color: "#8d2d2d", fontSize: "calc(12px * var(--solenos-text-scale, 1))", lineHeight: 1.5 }}>
            This briefing is out of date or its saved sources could not be checked. Prepare a new briefing before exporting.
          </p>
        )}
        {intent === "export" && exportError && (
          <p role="alert" style={{ color: "#8d2d2d", fontSize: "calc(12px * var(--solenos-text-scale, 1))", lineHeight: 1.5 }}>{exportError}</p>
        )}
        {intent === "export" && exportableDraft && (
          <div style={{ borderTop: "1px solid #e2e9e1", marginTop: 12, paddingTop: 12 }}>
            <strong style={{ display: "block", fontSize: "calc(13px * var(--solenos-text-scale, 1))", marginBottom: 8 }}>Check each briefing item before exporting</strong>
            {(exportableDraft.generation?.sections ?? []).map((item, index) => (
              <label key={item.source_ref + index} style={{ display: "flex", alignItems: "flex-start", gap: 9, fontSize: "calc(12px * var(--solenos-text-scale, 1))", lineHeight: 1.5, marginBottom: 8 }}>
                <input
                  type="checkbox"
                  checked={exportReviewedSourceRefs.includes(item.source_ref)}
                  onChange={event => setExportReviewedSourceRefs(current => event.target.checked
                    ? [...new Set([...current, item.source_ref])]
                    : current.filter(ref => ref !== item.source_ref))}
                />
                <span>I checked “{item.section}” against its saved source wording, dates and uncertainty labels.</span>
              </label>
            ))}
            <label style={{ display: "flex", alignItems: "flex-start", gap: 9, fontSize: "calc(12px * var(--solenos-text-scale, 1))", lineHeight: 1.5, margin: "10px 0" }}>
              <input type="checkbox" checked={exportReviewed} onChange={event => setExportReviewed(event.target.checked)} />
              <span>I understand this is an AI-assisted draft, not a medical opinion or a replacement for the full Care Record.</span>
            </label>
            <button
              type="button"
              disabled={exportChecking || !exportReviewed || (exportableDraft.generation?.sections ?? []).length === 0 || [...new Set((exportableDraft.generation?.sections ?? []).map(item => item.source_ref))].some(ref => !exportReviewedSourceRefs.includes(ref))}
              onClick={() => void verifyAndDownloadBriefing()}
              style={{ border: "1px solid #cbd8cb", borderRadius: 9, padding: "9px 12px", background: exportReviewed && (exportableDraft.generation?.sections ?? []).length > 0 && [...new Set((exportableDraft.generation?.sections ?? []).map(item => item.source_ref))].every(ref => exportReviewedSourceRefs.includes(ref)) ? "#dce9dc" : "#eef1ec", color: "#172117", fontWeight: 650, cursor: exportReviewed && (exportableDraft.generation?.sections ?? []).length > 0 && [...new Set((exportableDraft.generation?.sections ?? []).map(item => item.source_ref))].every(ref => exportReviewedSourceRefs.includes(ref)) ? "pointer" : "not-allowed" }}
            >
              {exportChecking ? "Checking saved sources…" : "Download summary (.txt)"}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

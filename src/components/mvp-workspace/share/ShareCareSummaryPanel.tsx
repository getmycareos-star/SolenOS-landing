"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  Download,
  Loader2,
  Printer,
  Share2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  type ShareAudience,
  AUDIENCE_OPTIONS,
  assessReadiness,
  type ReadinessResult,
  detectConflicts,
  generateSummary,
  type GeneratedSummary,
  recordShareHistory,
  selectContentForAudience,
  type SelectedContent,
} from "@/lib/share-summary";
import { apiUrl, safeJson } from "@/lib/api-url";
import { sanitizeCaregiverErrorMessage } from "@/lib/mvp-input-architecture";
import type { SituationResponse } from "@/lib/situation-entry";

/* ------------------------------------------------------------------ */
/*  Share request state machine                                        */
/* ------------------------------------------------------------------ */

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
  /** Durable care key for fetching care data. */
  caregiverId: string;
  /** Care session id. */
  careSessionId: string;
  /** Display name for the care recipient. */
  careRecipientName?: string;
  /** Close the panel. */
  onClose: () => void;
  /** Called when sharing completes successfully. */
  onShared?: () => void;
}

type ShareFormat = "copy" | "print" | "native";

export function ShareCareSummaryPanel({
  caregiverId,
  careSessionId,
  careRecipientName,
  onClose,
  onShared,
}: ShareCareSummaryPanelProps) {
  const [state, setState] = useState<ShareRequestState>("idle");
  const [readiness, setReadiness] = useState<ReadinessResult | null>(null);
  const [audience, setAudience] = useState<ShareAudience | null>(null);
  const [otherRecipient, setOtherRecipient] = useState("");
  const [summary, setSummary] = useState<GeneratedSummary | null>(null);
  const [selectedContent, setSelectedContent] = useState<SelectedContent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [situationResponse, setSituationResponse] = useState<any>(null);
  const [format, setFormat] = useState<ShareFormat | null>(null);
  const [sharingResult, setSharingResult] = useState<string | null>(null);

  const isOffline = useMemo(() => typeof navigator !== "undefined" && !navigator.onLine, []);

  const fetchCareData = useCallback(async (): Promise<any> => {
    const url = apiUrl(
      `/api/situation?caregiver_id=${encodeURIComponent(caregiverId)}&care_session_id=${encodeURIComponent(careSessionId)}`,
    );
    const res = await fetch(url);
    if (!res.ok) throw new Error("Could not load care information.");
    const data = await safeJson(res);
    return data;
  }, [caregiverId, careSessionId]);

  const startShare = useCallback(async () => {
    setError(null);
    setState("checking_readiness");

    try {
      const data = await fetchCareData();
      setSituationResponse(data);

      const readinessResult = assessReadiness(
        data as SituationResponse | null,
      );
      setReadiness(readinessResult);

      if (readinessResult.state === "empty") {
        setState("empty");
        return;
      }
      if (readinessResult.state === "limited") {
        setState("limited");
        return;
      }
      setState("audience_selection");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load care information.");
      setState("failed");
    }
  }, [fetchCareData]);

  const handleAudienceSelect = useCallback(
    async (selected: ShareAudience) => {
      setAudience(selected);
      setState("preparing");

      try {
        // In a full implementation, this would call an AI service to generate
        // the summary. Here we generate it client-side from available data.
        // The summary is derived from the existing care state — no fabrication.
        const response = situationResponse as any;
        const recipient = selected === "other" ? otherRecipient : undefined;
        const content = selectContentForAudience(response, selected, recipient);
        const generated = generateSummary(response, selected, recipient);
        setSelectedContent(content);
        setSummary(generated);
        setState("review");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not prepare the summary.");
        setState("failed");
      }
    },
    [situationResponse, otherRecipient],
  );

  const handleProceedFromLimited = useCallback(() => {
    setState("audience_selection");
  }, []);

  const handleAddMoreInfo = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleReviewConfirm = useCallback(() => {
    setState("format_selection");
  }, []);

  const handleBackToAudience = useCallback(() => {
    setState("audience_selection");
  }, []);

  const handleBackToReview = useCallback(() => {
    setState("review");
  }, []);

  const handleShare = useCallback(async () => {
    if (!summary || !format || !selectedContent) return;
    setState("sharing");
    setSharingResult(null);

    try {
      if (format === "copy") {
        const text = buildPlainTextSummary(summary, selectedContent);
        await navigator.clipboard.writeText(text);
        setSharingResult("Summary copied to clipboard.");
        recordShareHistory(summary.preparedFor, "text", "shared");
        setState("shared");
        onShared?.();
        return;
      }

      if (format === "print") {
        // Use browser print with a dedicated print window
        const printWindow = window.open("", "_blank", "width=800,height=600");
        if (!printWindow) {
          throw new Error("Could not open print window. Please allow pop-ups.");
        }
        const html = buildPrintHtml(summary, selectedContent, careRecipientName);
        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
        }, 300);
        setSharingResult("Print dialog opened.");
        recordShareHistory(summary.preparedFor, "PDF", "shared");
        setState("shared");
        onShared?.();
        return;
      }

      if (format === "native") {
        if (typeof navigator !== "undefined" && typeof (navigator as any).share === "function") {
          const text = buildPlainTextSummary(summary, selectedContent);
          await (navigator as any).share({
            title: "Care summary",
            text,
          });
          setSharingResult("Shared successfully.");
          recordShareHistory(summary.preparedFor, "native", "shared");
          setState("shared");
          onShared?.();
          return;
        }
        throw new Error("Native sharing is not supported on this device.");
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        setState("format_selection");
        return;
      }
      recordShareHistory(summary?.preparedFor ?? "unknown", format ?? "unknown", "failed");
      setError(sanitizeCaregiverErrorMessage(e instanceof Error ? e.message : "Sharing failed."));
      setState("failed");
    }
  }, [summary, format, selectedContent, careRecipientName, onShared]);

  const handleRetry = useCallback(() => {
    setError(null);
    if (state === "failed" && summary && format) {
      setState("sharing");
      void handleShare();
    } else if (state === "failed") {
      setState("checking_readiness");
      void startShare();
    }
  }, [state, summary, format, handleShare, startShare]);

  const handleCopyText = useCallback(async () => {
    if (!summary || !selectedContent) return;
    try {
      const text = buildPlainTextSummary(summary, selectedContent);
      await navigator.clipboard.writeText(text);
      setSharingResult("Summary copied to clipboard.");
      recordShareHistory(summary.preparedFor, "text", "shared");
      setState("shared");
      onShared?.();
    } catch {
      recordShareHistory(summary?.preparedFor ?? "unknown", "text", "failed");
      setError("Could not copy text.");
      setState("failed");
    }
  }, [summary, selectedContent, onShared]);

  const handleSaveDownload = useCallback(() => {
    if (!summary || !selectedContent) return;
    const text = buildPlainTextSummary(summary, selectedContent);
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `care-summary-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setSharingResult("Summary downloaded.");
    recordShareHistory(summary.preparedFor, "download", "shared");
    setState("shared");
    onShared?.();
  }, [summary, selectedContent, onShared]);

  // Start the flow when panel mounts
  useEffect(() => {
    if (state === "idle") {
      void startShare();
    }
  }, [state, startShare]);

  const showBackButton =
    state === "audience_selection" ||
    state === "review" ||
    state === "format_selection";

  const renderHeader = () => (
    <div className="share-panel-header">
      <div className="share-panel-header-left">
        {showBackButton && (
          <button
            type="button"
            className="share-panel-back"
            onClick={
              state === "audience_selection"
                ? undefined
                : state === "review"
                  ? handleBackToAudience
                  : handleBackToReview
            }
            aria-label="Back"
            disabled={state === "audience_selection"}
          >
            <ChevronLeft size={20} aria-hidden />
          </button>
        )}
        <h2 className="share-panel-title">Share care summary</h2>
      </div>
      <button
        type="button"
        className="share-panel-close"
        onClick={onClose}
        aria-label="Close"
      >
        <X size={20} aria-hidden />
      </button>
    </div>
  );

  const renderReadinessEmpty = () => (
    <div className="share-panel-body">
      <div className="share-readiness-card share-readiness-card--empty">
        <h3 className="share-readiness-title">Nothing to share yet</h3>
        <p className="share-readiness-message">
          There isn't enough care information in this record to create a useful summary yet.
        </p>
        <div className="share-readiness-actions">
          <Button variant="primary" onClick={handleAddMoreInfo}>
            Add care information
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );

  const renderReadinessLimited = () => (
    <div className="share-panel-body">
      <div className="share-readiness-card share-readiness-card--limited">
        <h3 className="share-readiness-title">This record has limited information</h3>
        <p className="share-readiness-message">
          We can create a summary, but it may be incomplete because this care record
          contains limited information.
        </p>
        <div className="share-readiness-actions">
          <Button variant="primary" onClick={handleProceedFromLimited}>
            Continue anyway
          </Button>
          <Button variant="secondary" onClick={handleAddMoreInfo}>
            Add more information
          </Button>
        </div>
      </div>
    </div>
  );

  const renderAudienceSelection = () => (
    <div className="share-panel-body">
      <p className="share-panel-lede">Who is this care summary for?</p>
      <div className="share-audience-options">
        {AUDIENCE_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={audience === opt.id}
            className={`share-audience-option${audience === opt.id ? " is-selected" : ""}`}
            onClick={() => handleAudienceSelect(opt.id)}
          >
            <span className="share-audience-label">{opt.label}</span>
            <span className="share-audience-desc">{opt.description}</span>
          </button>
        ))}
      </div>
      {audience === "other" && (
        <div className="share-other-field">
          <label className="share-other-label" htmlFor="share-other-recipient">
            Recipient or purpose
          </label>
          <input
            id="share-other-recipient"
            className="share-other-input"
            type="text"
            placeholder="e.g. Physical therapist, Insurance case manager, Social worker"
            value={otherRecipient}
            onChange={(e) => setOtherRecipient(e.target.value)}
          />
          <Button
            variant="primary"
            className="share-other-confirm"
            disabled={!otherRecipient.trim()}
            onClick={() => handleAudienceSelect("other")}
          >
            Continue
          </Button>
        </div>
      )}
    </div>
  );

  const renderReview = () => {
    if (!summary || !selectedContent) return null;
    return (
      <div className="share-panel-body">
        <div className="share-review-meta">
          <span className="share-review-audience">Prepared for: {summary.preparedFor}</span>
          <span className="share-review-date">{new Date(summary.generatedAt).toLocaleString()}</span>
        </div>

        <div className="share-review-sections">
          {summary.sections.map((section) => (
            <div key={section.heading} className="share-review-section">
              <h4 className="share-review-section-heading">{section.heading}</h4>
              <ul className="share-review-section-list">
                {section.items.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {summary.conflicts.length > 0 && (
          <div className="share-review-conflicts">
            <h4 className="share-review-section-heading">Conflicting information</h4>
            {summary.conflicts.map((c, i) => (
              <p key={i} className="share-review-conflict">{c.description}</p>
            ))}
          </div>
        )}

        {summary.unknowns.length > 0 && (
          <div className="share-review-unknowns">
            <h4 className="share-review-section-heading">Unknowns</h4>
            {summary.unknowns.map((u, i) => (
              <p key={i}>{u}</p>
            ))}
          </div>
        )}

        {summary.freshness.isStale && (
          <div className="share-review-freshness">
            <h4 className="share-review-section-heading">This summary may be out of date</h4>
            {summary.freshness.staleItems.map((item, i) => (
              <p key={i}>{item}</p>
            ))}
          </div>
        )}

        <div className="share-review-included">
          <h4 className="share-review-section-heading">Included</h4>
          <p>{summary.includedCategories.join(", ")}</p>
        </div>
        <div className="share-review-excluded">
          <h4 className="share-review-section-heading">Not included</h4>
          <p>{summary.excludedCategories.join(", ")}</p>
        </div>

        <div className="share-review-actions">
          <Button variant="primary" onClick={handleReviewConfirm}>
            Continue
          </Button>
          <Button variant="secondary" onClick={handleBackToAudience}>
            Change recipient
          </Button>
        </div>
      </div>
    );
  };

  const renderFormatSelection = () => (
    <div className="share-panel-body">
      <p className="share-panel-lede">Choose how to share this summary.</p>
      <div className="share-format-options">
        <button
          type="button"
          className={`share-format-option${format === "copy" ? " is-selected" : ""}`}
          onClick={() => setFormat("copy")}
        >
          <ClipboardCopy size={20} aria-hidden />
          <span className="share-format-label">Copy text</span>
          <span className="share-format-desc">Copy the summary to paste anywhere.</span>
        </button>
        <button
          type="button"
          className={`share-format-option${format === "print" ? " is-selected" : ""}`}
          onClick={() => setFormat("print")}
        >
          <Printer size={20} aria-hidden />
          <span className="share-format-label">Print / PDF</span>
          <span className="share-format-desc">Open print dialog to save as PDF.</span>
        </button>
        <button
          type="button"
          className={`share-format-option${format === "native" ? " is-selected" : ""}`}
          onClick={() => setFormat("native")}
          disabled={typeof navigator === "undefined" || typeof (navigator as any).share !== "function"}
        >
          <Share2 size={20} aria-hidden />
          <span className="share-format-label">Share</span>
          <span className="share-format-desc">
            {typeof navigator !== "undefined" && typeof (navigator as any).share === "function"
              ? "Use your device's share sheet."
              : "Not available on this device."}
          </span>
        </button>
      </div>
      {format && (
        <div className="share-confirm-bar">
          {summary && (
            <p className="share-confirm-detail">
              Ready to share — prepared for <strong>{summary.preparedFor}</strong> as{" "}
              <strong>{format === "copy" ? "text" : format === "print" ? "PDF" : "shared file"}</strong>.
              Includes: {summary.includedCategories.slice(0, 4).join(", ")}.
            </p>
          )}
          <div className="share-confirm-actions">
            <Button variant="primary" onClick={handleShare} loading={state === "sharing"}>
              {state === "sharing" ? "Sharing…" : "Share"}
            </Button>
            <Button variant="secondary" onClick={handleBackToReview}>
              Back
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  const renderSharing = () => (
    <div className="share-panel-body">
      <div className="share-loading">
        <Loader2 className="spin" size={32} aria-hidden />
        <p>Preparing your summary…</p>
      </div>
    </div>
  );

  const renderShared = () => (
    <div className="share-panel-body">
      <div className="share-success-card">
        <h3 className="share-success-title">Summary ready</h3>
        {sharingResult && <p className="share-success-message">{sharingResult}</p>}
        <div className="share-readiness-actions">
          <Button variant="secondary" onClick={handleCopyText}>
            <ClipboardCopy size={16} aria-hidden />
            Copy text
          </Button>
          <Button variant="secondary" onClick={handleSaveDownload}>
            <Download size={16} aria-hidden />
            Save
          </Button>
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );

  const renderFailed = () => (
    <div className="share-panel-body">
      <div className="share-error-card">
        <h3 className="share-error-title">We couldn't complete the share</h3>
        {error && <p className="share-error-message">{sanitizeCaregiverErrorMessage(error)}</p>}
        <div className="share-readiness-actions">
          <Button variant="primary" onClick={handleRetry}>
            Try again
          </Button>
          {summary && (
            <Button variant="secondary" onClick={handleCopyText}>
              <ClipboardCopy size={16} aria-hidden />
              Copy text
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );

  const renderOffline = () => (
    <div className="share-panel-body">
      <div className="share-readiness-card share-readiness-card--limited">
        <h3 className="share-readiness-title">You're offline</h3>
        <p className="share-readiness-message">
          Your care information is safely saved on this device. We can prepare this
          shareable summary when your connection is restored.
        </p>
        <div className="share-readiness-actions">
          <Button variant="secondary" onClick={onClose}>
            OK
          </Button>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (state) {
      case "checking_readiness":
      case "preparing":
      case "sharing":
        return renderSharing();
      case "empty":
        return renderReadinessEmpty();
      case "limited":
        return renderReadinessLimited();
      case "audience_selection":
        return renderAudienceSelection();
      case "review":
        return renderReview();
      case "format_selection":
        return renderFormatSelection();
      case "shared":
        return renderShared();
      case "failed":
        return renderFailed();
      case "offline":
        return renderOffline();
      default:
        return null;
    }
  };

  if (state === "idle") return null;

  return (
    <div className="share-care-summary-overlay" role="dialog" aria-label="Share care summary">
      <div className="share-care-summary-panel">
        {renderHeader()}
        {error && state === "failed" && (
          <p className="share-panel-error" role="alert">
            {sanitizeCaregiverErrorMessage(error)}
          </p>
        )}
        {renderContent()}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers — plain text and print HTML                                */
/* ------------------------------------------------------------------ */

function buildPlainTextSummary(
  summary: GeneratedSummary,
  content: SelectedContent,
): string {
  const lines: string[] = [];
  lines.push("CARE SUMMARY");
  lines.push(`Prepared for: ${summary.preparedFor}`);
  lines.push(`Generated: ${new Date(summary.generatedAt).toLocaleString()}`);
  lines.push("");

  for (const section of summary.sections) {
    lines.push(section.heading.toUpperCase());
    lines.push("—".repeat(40));
    for (const item of section.items) {
      lines.push(`• ${item}`);
    }
    lines.push("");
  }

  if (summary.conflicts.length > 0) {
    lines.push("CONFLICTING INFORMATION");
    lines.push("—".repeat(40));
    for (const c of summary.conflicts) {
      lines.push(`• ${c.description}`);
    }
    lines.push("");
  }

  if (summary.unknowns.length > 0) {
    lines.push("UNKNOWNS");
    lines.push("—".repeat(40));
    for (const u of summary.unknowns) {
      lines.push(`• ${u}`);
    }
    lines.push("");
  }

  if (summary.freshness.isStale) {
    lines.push("FRESHNESS NOTE");
    lines.push("—".repeat(40));
    for (const s of summary.freshness.staleItems) {
      lines.push(`• ${s}`);
    }
    lines.push("");
  }

  lines.push("—".repeat(40));
  lines.push(summary.evidenceNote);
  lines.push("");

  return lines.join("\n");
}

function buildPrintHtml(
  summary: GeneratedSummary,
  content: SelectedContent,
  recipientName?: string,
): string {
  const sectionsHtml = summary.sections
    .map(
      (s) => `
    <section style="margin-bottom:1.2rem;">
      <h3 style="font-size:0.85rem;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 0.4rem;color:#3d4543;">${escapeHtml(s.heading)}</h3>
      <ul style="margin:0;padding-left:1.2rem;line-height:1.6;">
        ${s.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </ul>
    </section>`,
    )
    .join("");

  const conflictsHtml = summary.conflicts.length
    ? `
    <section style="margin-top:1rem;padding:0.8rem;background:#fef3c7;border-left:3px solid #f59e0b;border-radius:4px;">
      <h3 style="font-size:0.85rem;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 0.4rem;color:#92400e;">Conflicting information</h3>
      ${summary.conflicts.map((c) => `<p style="margin:0 0 0.3rem;line-height:1.5;color:#92400e;">${escapeHtml(c.description)}</p>`).join("")}
    </section>`
    : "";

  const freshnessHtml = summary.freshness.isStale
    ? `
    <section style="margin-top:1rem;padding:0.8rem;background:#f3f4f6;border-left:3px solid #6b7280;border-radius:4px;">
      <h3 style="font-size:0.85rem;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 0.4rem;color:#374151;">Freshness note</h3>
      ${summary.freshness.staleItems.map((s) => `<p style="margin:0 0 0.3rem;line-height:1.5;color:#374151;">${escapeHtml(s)}</p>`).join("")}
    </section>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Care summary — ${escapeHtml(summary.preparedFor)}</title>
  <style>
    body { font-family: "Libre Baskerville", Georgia, serif; max-width: 700px; margin: 2rem auto; padding: 0 1.5rem; color: #1f2937; line-height: 1.6; }
    h1 { font-size: 1.4rem; margin: 0 0 0.3rem; }
    .meta { font-size: 0.8rem; color: #6b7280; margin-bottom: 1.5rem; }
  </style>
</head>
<body>
  <h1>Care summary</h1>
  <p class="meta">Prepared for: ${escapeHtml(summary.preparedFor)} &middot; Generated: ${new Date(summary.generatedAt).toLocaleString()}${recipientName ? ` &middot; Recipient: ${escapeHtml(recipientName)}` : ""}</p>
  ${sectionsHtml}
  ${conflictsHtml}
  ${freshnessHtml}
  <footer style="margin-top:2rem;padding-top:1rem;border-top:1px solid #e5e7eb;font-size:0.75rem;color:#6b7280;">
    ${escapeHtml(summary.evidenceNote)}
  </footer>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

"use client";

import { useEffect, useState } from "react";
import { getCaregiverId, getPersonId, getJSON, postJSON } from "@/api/client";
import { caregiverSafeAssistantText, caregiverSafeErrorMessage } from "@/lib/caregiver-language";

type SaveReceipt = {
  id: string;
  jobId: string | null;
  processingStatus: "queued" | "processing" | "completed" | "failed" | "unavailable";
  extractionStatus: string;
  assessmentStatus: string;
  medicationNeedsConfirmation: boolean;
  medicationContext: string | null;
};

export default function NaturalLanguageDailyUpdate() {
  const [report, setReport] = useState("");
  const [requestKey, setRequestKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<SaveReceipt | null>(null);

  useEffect(() => {
    const jobId = receipt?.jobId;
    if (!jobId) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;

    const poll = async () => {
      try {
        const status = await getJSON(`/assistant/jobs/${jobId}`) as {
          status?: string;
          daily_capture?: { assessment_status?: string; observation_count?: number };
        };
        if (!active) return;
        if (status.status === "completed") {
          setReceipt((current) => current?.jobId === jobId
            ? {
                ...current,
                processingStatus: "completed",
                extractionStatus: "available",
                assessmentStatus: status.daily_capture?.assessment_status || "completed",
              }
            : current);
          window.dispatchEvent(new Event("careRecordUpdated"));
          return;
        }
        if (status.status === "failed" || status.status === "cancelled") {
          setReceipt((current) => current?.jobId === jobId
            ? { ...current, processingStatus: "failed", extractionStatus: "failed", assessmentStatus: "failed" }
            : current);
          window.dispatchEvent(new Event("careRecordUpdated"));
          return;
        }
        setReceipt((current) => current?.jobId === jobId
          ? { ...current, processingStatus: status.status === "processing" ? "processing" : "queued" }
          : current);
      } catch {
        // A temporary status-read failure must not turn a saved report into a failed save.
      }
      attempts += 1;
      if (active && attempts < 60) timer = setTimeout(poll, 2000);
    };

    void poll();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [receipt?.jobId]);

  function updateReport(value: string) {
    setReport(value);
    setRequestKey(null);
    setReceipt(null);
    setError("");
  }

  async function saveUpdate() {
    if (saving || !report.trim()) return;
    const personId = getPersonId();
    const caregiverId = getCaregiverId();
    if (!personId || !caregiverId) {
      setError("Your care session could not be verified. Reopen Daily Care before saving.");
      return;
    }

    const idempotencyKey = requestKey ?? crypto.randomUUID();
    setRequestKey(idempotencyKey);
    setSaving(true);
    setError("");
    try {
      const response = await postJSON("/daily-care/entries", {
        person_id: personId,
        caregiver_id: caregiverId,
        capture_idempotency_key: idempotencyKey,
        capture_kind: "natural_language_update",
        notes: report,
      }) as {
        success?: boolean;
        id?: string;
        qwen_extraction_status?: string;
        qwen_job_id?: string | null;
        execution_status?: { assessment?: string };
      };

      if (response?.success !== true || typeof response.id !== "string" || !response.id) {
        throw new Error("The server did not confirm that your update was saved.");
      }

      const medicationMentioned = /\b(medication|medicine|dose|dosage|prescription)\b/i.test(report);
      const possibleChange = /\b(changed|change|new dose|adjusted|increased|decreased|reduced|stopped)\b/i.test(report);
      const uncertainty = /\b(i think|maybe|might|may have|not sure|cannot remember|can't remember|don't remember|forgot)\b/i.test(report);
      const medicationNeedsConfirmation = medicationMentioned && possibleChange && uncertainty;
      const extractionStatus = response.qwen_extraction_status || "unavailable";
      setReceipt({
        id: response.id,
        jobId: response.qwen_job_id || null,
        processingStatus: response.qwen_job_id
          ? "queued"
          : extractionStatus === "available" ? "completed" : "unavailable",
        extractionStatus,
        assessmentStatus: response.execution_status?.assessment || "pending",
        medicationNeedsConfirmation,
        medicationContext: medicationNeedsConfirmation ? "Checking the existing medication record…" : null,
      });
      if (medicationNeedsConfirmation) {
        void Promise.allSettled([
          getJSON("/care-continuity/medications"),
          getJSON("/documents/intelligence"),
        ]).then(([medicationResult, documentResult]) => {
          const contextParts: string[] = [];
          if (medicationResult.status === "fulfilled") {
            const projection = medicationResult.value as {
              medications?: Array<{ name?: string; dose?: string }>;
              pending_review?: Array<{ name?: string; dose?: string }>;
            };
            const current = Array.isArray(projection?.medications) ? projection.medications : [];
            const pending = Array.isArray(projection?.pending_review) ? projection.pending_review : [];
            const currentText = current.slice(0, 3).map((item) =>
              [item.name, item.dose].filter(Boolean).map((value) => caregiverSafeAssistantText(value) || "").filter(Boolean).join(" — ")
            ).filter(Boolean);
            const pendingText = pending.slice(0, 3).map((item) =>
              [item.name, item.dose].filter(Boolean).map((value) => caregiverSafeAssistantText(value) || "").filter(Boolean).join(" — ")
            ).filter(Boolean);
            if (currentText.length) {
              contextParts.push(`The existing reviewed medication record lists: ${currentText.join("; ")}. This does not confirm a change reported today.`);
            } else if (pendingText.length) {
              contextParts.push(`Medication information already awaiting review: ${pendingText.join("; ")}. It is not a confirmed current dose.`);
            } else {
              contextParts.push("No reviewed medication record is available to confirm the reported change.");
            }
          } else {
            contextParts.push("Existing medication records could not be checked just now.");
          }

          if (documentResult.status === "fulfilled") {
            const documents = documentResult.value as {
              items?: Array<{
                document_name?: string;
                extraction_status?: string;
                observations?: Array<{
                  source_quote?: string;
                  page_number?: number | null;
                  field_type?: string;
                  review_status?: string;
                  canonical_candidate?: {
                    medication_details?: { strength?: string | null; dosage_instructions?: string | null } | null;
                  } | null;
                }>;
              }>;
              processing_jobs?: unknown[];
            };
            const candidates = (Array.isArray(documents?.items) ? documents.items : [])
              .flatMap((document) => (Array.isArray(document.observations) ? document.observations : [])
                .filter((candidate) => candidate.review_status !== "rejected")
                .filter((candidate) =>
                  Boolean(candidate.canonical_candidate?.medication_details)
                  || /\b(medication|medicine|dose|dosage|prescription|tablet|capsule)\b/i.test(candidate.source_quote || "")
                  || /medication/i.test(candidate.field_type || "")
                )
                .map((candidate) => ({ document, candidate })))
              .slice(0, 2);
            if (candidates.length) {
              for (const { document, candidate } of candidates) {
                const details = candidate.canonical_candidate?.medication_details;
                const detailText = [details?.strength, details?.dosage_instructions]
                  .filter(Boolean)
                  .map((value) => caregiverSafeAssistantText(value) || "")
                  .filter(Boolean)
                  .join("; ");
                const name = caregiverSafeAssistantText(document.document_name) || "Saved document";
                const quote = caregiverSafeAssistantText(candidate.source_quote) || "No readable medication excerpt was returned.";
                const page = candidate.page_number ? `, page ${candidate.page_number}` : "";
                contextParts.push(`${name}${page} contains an extracted medication detail: “${quote.slice(0, 220)}”${detailText ? ` Details: ${detailText}.` : "."} This extraction is not confirmation of a new dose.`);
              }
            } else if (Array.isArray(documents?.processing_jobs) && documents.processing_jobs.length) {
              contextParts.push("Some saved documents are still being processed and cannot confirm a new dose yet.");
            } else {
              contextParts.push("No medication-specific details were returned from saved-document extraction. This does not rule out information in a document that has not been processed.");
            }
          } else {
            contextParts.push("Saved document information could not be checked just now.");
          }

          setReceipt((currentReceipt) => currentReceipt
            ? { ...currentReceipt, medicationContext: contextParts.join(" ") }
            : currentReceipt);
        });
      }
      setReport("");
      setRequestKey(null);
      window.dispatchEvent(new Event("careRecordUpdated"));
    } catch (cause) {
      setError(caregiverSafeErrorMessage());
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="natural-language-daily-update" aria-labelledby="natural-daily-update-title"
      style={{ width: "100%", display: "grid", gap: 10, padding: 14, border: "1px solid var(--theme-panel-border)", borderRadius: 12, background: "var(--theme-panel-bg)", color: "var(--theme-panel-fg)" }}>
      <h3 id="natural-daily-update-title" style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>What happened?</h3>
      <p style={{ margin: 0, color: "var(--theme-panel-muted)", lineHeight: 1.5 }}>
        Write it in your own words. One sentence is enough. You do not need to choose a category or fill in extra fields.
      </p>
      <label htmlFor="natural-daily-update-report" style={{ fontWeight: 650 }}>Your update</label>
      <textarea id="natural-daily-update-report" value={report} onChange={(event) => updateReport(event.target.value)}
        maxLength={12000} rows={4}
        placeholder="For example: Slept poorly last night and seemed more unsettled this morning."
        disabled={saving}
        style={{ width: "100%", minHeight: 104, padding: 12, border: "1px solid var(--theme-panel-border)", borderRadius: 10, background: "var(--theme-field-bg)", color: "var(--theme-field-fg)", font: "inherit", resize: "vertical" }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <span style={{ color: "var(--theme-panel-muted)", fontSize: 12 }}>Your original wording is kept in the care history.</span>
        <button type="button" onClick={() => void saveUpdate()} disabled={saving || !report.trim()}
          className="workspace-primary" style={{ minHeight: 44, padding: "10px 16px", borderRadius: 9 }}>
          {saving ? "Saving…" : "Save update"}
        </button>
      </div>
      {error && <p role="alert" style={{ margin: 0, color: "var(--theme-danger-fg, #9b3434)" }}>{error}</p>}
      {receipt && (
        <div role="status" style={{ color: "var(--theme-panel-muted)", lineHeight: 1.5 }}>
          <p style={{ margin: 0 }}>Your update was saved to the care record.</p>
          {(receipt.processingStatus === "queued" || receipt.processingStatus === "processing") && (
            <p style={{ margin: "6px 0 0" }}>
              SolenOS is organizing the details in the background. You can keep using Daily Care.
            </p>
          )}
          {receipt.processingStatus === "completed" && (
            <p style={{ margin: "6px 0 0" }}>
              The source-grounded details are now available in the care record.
            </p>
          )}
          {(receipt.processingStatus === "failed" || receipt.processingStatus === "unavailable") && (
            <p style={{ margin: "6px 0 0" }}>
              SolenOS could not organize the details yet. Your original report is still saved, and no extracted details have been treated as confirmed.
            </p>
          )}
          {receipt.medicationNeedsConfirmation && (
            <>
              {receipt.medicationContext && <p style={{ margin: "6px 0 0" }}>{receipt.medicationContext}</p>}
              <p style={{ margin: "6px 0 0" }}>
                Your report suggests a medication may have changed, but it does not confirm a new dose. Please check the doctor’s instructions or contact the prescribing professional before relying on a different dose.
              </p>
            </>
          )}
        </div>
      )}
    </section>
  );
}

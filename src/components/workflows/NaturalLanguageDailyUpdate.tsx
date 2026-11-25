"use client";

import { useEffect, useRef, useState } from "react";
import { getCaregiverId, getPersonId, getJSON } from "@/api/client";
import { caregiverSafeAssistantText, caregiverSafeErrorMessage, caregiverSourceText } from "@/lib/caregiver-language";
import { sendQueuedCareWrite } from "@/lib/offline-sync/send-queued-care-write";
import {
  deliverDurableWrite,
  discardDurableWrite,
  durableWriteId,
  enqueueDurableWrite,
  getDurableWriteSummary,
  hasDurableWrite,
  syncDurableWrites,
} from "@/lib/offline-sync/durable-write-queue";

const QWEN_JOB_POLL_INTERVAL_MS = 5_000;
const QWEN_JOB_MAX_WAIT_MS = 12 * 60 * 1000;
const QWEN_JOB_MAX_POLLS = Math.ceil(QWEN_JOB_MAX_WAIT_MS / QWEN_JOB_POLL_INTERVAL_MS);

type SaveReceipt = {
  id: string | null;
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
  const [pendingLocal, setPendingLocal] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [attentionCount, setAttentionCount] = useState(0);
  const [syncNotice, setSyncNotice] = useState("");
  const pendingQueueId = useRef<string | null>(null);

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
          const assessmentStatus = status.daily_capture?.assessment_status || "completed";
          const assessmentFailed = assessmentStatus === "failed" || assessmentStatus === "unavailable";
          setReceipt((current) => current?.jobId === jobId
            ? {
                ...current,
                processingStatus: assessmentFailed ? "failed" : "completed",
                extractionStatus: assessmentFailed ? assessmentStatus : "available",
                assessmentStatus,
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
      if (active && attempts < QWEN_JOB_MAX_POLLS) {
        timer = setTimeout(poll, QWEN_JOB_POLL_INTERVAL_MS);
      } else if (active) {
        setReceipt((current) => current?.jobId === jobId
          ? {
              ...current,
              processingStatus: "unavailable",
              extractionStatus: "unavailable",
              assessmentStatus: "unavailable",
            }
          : current);
      }
    };

    void poll();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [receipt?.jobId]);

  useEffect(() => {
    let active = true;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let identityRetryCount = 0;
    const send = sendQueuedCareWrite;
    const sync = async () => {
      const personId = getPersonId();
      const caregiverId = getCaregiverId();
      if (!personId || !caregiverId) {
        // The workspace may mount before the bearer session has hydrated.
        // Retry briefly so queued encrypted writes are not stranded until a
        // later navigation or another identity event.
        if (active && identityRetryCount < 20) {
          identityRetryCount += 1;
          if (retryTimer) clearTimeout(retryTimer);
          retryTimer = setTimeout(sync, 250);
        }
        return;
      }
      identityRetryCount = 0;
      try {
        const summary = await getDurableWriteSummary(personId, caregiverId);
        if (!active) return;
        setPendingCount(summary.pending);
        setAttentionCount(summary.blocked + summary.failed_recoverable);
        if (typeof navigator !== "undefined" && !navigator.onLine) return;
        const result = await syncDurableWrites({ personId, caregiverId, send });
        const afterSync = await getDurableWriteSummary(personId, caregiverId);
        if (!active) return;
        setPendingCount(afterSync.pending);
        setAttentionCount(afterSync.blocked + afterSync.failed_recoverable);
        if (afterSync.pending > 0 && typeof navigator !== "undefined" && navigator.onLine) {
          if (retryTimer) clearTimeout(retryTimer);
          retryTimer = setTimeout(sync, 5_000);
        }
        if (pendingQueueId.current && !(await hasDurableWrite(pendingQueueId.current))) {
          pendingQueueId.current = null;
          setPendingLocal(false);
          setRequestKey(null);
          setReport("");
          setSyncNotice("Your original update has reached your Care Record.");
          window.dispatchEvent(new Event("careRecordUpdated"));
        } else if (result.synced > 0) {
          setSyncNotice("A queued item has reached SolenOS. Any required review or processing may still be outstanding.");
          window.dispatchEvent(new Event("careRecordUpdated"));
        }
      } catch {
        // The encrypted queue remains available for the next online attempt.
      }
    };
    void sync();
    const handleIdentityChange = () => {
      identityRetryCount = 0;
      void sync();
    };
    window.addEventListener("online", sync);
    window.addEventListener("personIdChanged", handleIdentityChange);
    window.addEventListener("solenos:offline-queue-updated", sync);
    return () => {
      active = false;
      if (retryTimer) clearTimeout(retryTimer);
      window.removeEventListener("online", sync);
      window.removeEventListener("personIdChanged", handleIdentityChange);
      window.removeEventListener("solenos:offline-queue-updated", sync);
    };
  }, []);

  function updateReport(value: string) {
    setReport(value);
    setRequestKey(null);
    setReceipt(null);
    setError("");
    setSyncNotice("");
  }

  async function saveUpdate() {
    if (saving || !report.trim()) return;
    const personId = getPersonId();
    const caregiverId = getCaregiverId();
    if (!personId || !caregiverId) {
      setError("We couldn’t confirm which Care Record to use. Please reopen SolenOS and try again.");
      return;
    }

    const idempotencyKey = requestKey ?? crypto.randomUUID();
    setRequestKey(idempotencyKey);
    setSaving(true);
    setError("");
    setSyncNotice("");
    const payload = {
      person_id: personId,
      caregiver_id: caregiverId,
      capture_idempotency_key: idempotencyKey,
      capture_kind: "natural_language_update",
      notes: report,
    };
    let queueId: string | null = null;
    try {
      try {
        queueId = await enqueueDurableWrite({
          person_id: personId,
          caregiver_id: caregiverId,
          endpoint: "/daily-care/entries",
          idempotency_key: idempotencyKey,
          payload,
        });
        pendingQueueId.current = queueId;
      } catch {
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          throw new Error("This device could not securely keep an offline copy. The update was not saved.");
        }
      }
      const response = (queueId
        ? await deliverDurableWrite<{
            success?: boolean;
            id?: string;
            qwen_extraction_status?: string;
            qwen_job_id?: string | null;
            execution_status?: { assessment?: string };
          }>(queueId, sendQueuedCareWrite)
        : await sendQueuedCareWrite("/daily-care/entries", payload)) as {
          success?: boolean;
          id?: string;
          qwen_extraction_status?: string;
          qwen_job_id?: string | null;
          execution_status?: { assessment?: string };
        };

      if (response.success !== true || typeof response.id !== "string" || !response.id.trim()) {
        throw new Error("Your update could not be confirmed as saved. Please try again.");
      }

      const medicationMentioned = /\b(medication|medicine|dose|dosage|prescription)\b/i.test(report);
      const possibleChange = /\b(changed|change|new dose|adjusted|increased|decreased|reduced|stopped)\b/i.test(report);
      const uncertainty = /\b(i think|maybe|might|may have|not sure|cannot remember|can't remember|don't remember|forgot)\b/i.test(report);
      const medicationNeedsConfirmation = medicationMentioned && possibleChange && uncertainty;
      const extractionStatus = response.qwen_extraction_status || "unavailable";
      setReceipt({
        id: response.id ?? null,
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
              contextParts.push(`Medication information waiting for your review: ${pendingText.join("; ")}. It may not be the current dose.`);
            } else {
              contextParts.push("We couldn’t find a reviewed medication record to check this change against.");
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
                const quote = caregiverSourceText(candidate.source_quote) || "The document text could not be read.";
                const page = candidate.page_number ? `, page ${candidate.page_number}` : "";
                contextParts.push(`${name}${page} contains this medication detail: “${quote.slice(0, 220)}”${detailText ? ` Details: ${detailText}.` : "."} These words do not confirm a new dose.`);
              }
            } else if (Array.isArray(documents?.processing_jobs) && documents.processing_jobs.length) {
              contextParts.push("Some saved documents are still being checked. They cannot confirm a new dose yet.");
            } else {
              contextParts.push("We couldn’t find medicine details in the documents we checked. A document that has not been checked yet may still contain this information.");
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
      pendingQueueId.current = null;
      setPendingLocal(false);
      setPendingCount(0);
      setRequestKey(null);
      window.dispatchEvent(new Event("careRecordUpdated"));
    } catch (cause) {
      if (queueId) {
        setPendingLocal(true);
        const status = typeof cause === "object" && cause !== null && "status" in cause
          ? Number((cause as { status?: unknown }).status)
          : null;
        const summary = await getDurableWriteSummary(personId, caregiverId).catch(() => null);
        if (summary) {
          setPendingCount(summary.pending);
          setAttentionCount(summary.blocked + summary.failed_recoverable);
        }
        if (status === 401 || status === 403) {
          setError("Your update is saved on this device, but we couldn’t confirm which Care Record to use. Please reopen SolenOS and try again.");
        } else if (status === 400 || status === 409 || status === 422) {
          setError("Your update is saved on this device, but it needs a quick review before it can be added to your Care Record.");
        } else {
          setError("Your update is saved on this device. It hasn’t reached your Care Record yet. We’ll try again when your connection returns.");
        }
      } else {
        const reason = cause instanceof Error ? cause.message : "";
        setError(
          reason.includes("could not securely keep an offline copy")
            ? reason
            : caregiverSafeErrorMessage(),
        );
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="natural-language-daily-update" aria-labelledby="natural-daily-update-title"
      style={{ width: "100%", display: "grid", gap: 10, padding: 14, border: "1px solid var(--theme-panel-border)", borderRadius: 12, background: "var(--theme-panel-bg)", color: "var(--theme-panel-fg)" }}>
      <h3 id="natural-daily-update-title" style={{ margin: 0, fontSize: "calc(17px * var(--solenos-text-scale, 1))", fontWeight: 700 }}>What happened?</h3>
      <p style={{ margin: 0, color: "var(--theme-panel-muted)", lineHeight: 1.5 }}>
        Write it in your own words. One sentence is enough. You do not need to choose a category or fill in extra fields.
      </p>
      <label htmlFor="natural-daily-update-report" style={{ fontWeight: 650 }}>Your update</label>
      <textarea id="natural-daily-update-report" value={report} onChange={(event) => updateReport(event.target.value)}
        maxLength={12000} rows={4}
        placeholder="For example: Slept poorly last night and seemed more unsettled this morning."
        disabled={saving || pendingLocal}
        style={{ width: "100%", minHeight: 104, padding: 12, border: "1px solid var(--theme-panel-border)", borderRadius: 10, background: "var(--theme-field-bg)", color: "var(--theme-field-fg)", font: "inherit", resize: "vertical" }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <span style={{ color: "var(--theme-panel-muted)", fontSize: "calc(12px * var(--solenos-text-scale, 1))" }}>Your original wording is kept in the care history.</span>
        <button type="button" onClick={() => void saveUpdate()} disabled={saving || !report.trim()}
          className="workspace-primary" style={{ minHeight: 44, padding: "10px 16px", borderRadius: 9 }}>
          {saving ? "Saving…" : pendingLocal ? "Retry save" : "Save update"}
        </button>
      </div>
      {error && <p role="alert" style={{ margin: 0, color: "var(--theme-danger-fg, #9b3434)" }}>{error}</p>}
      {pendingLocal && requestKey && (
        <button
          type="button"
          onClick={() => {
            const id = durableWriteId("/daily-care/entries", requestKey);
            void discardDurableWrite(id).then(() => {
              pendingQueueId.current = null;
              setPendingLocal(false);
              setPendingCount((count) => Math.max(0, count - 1));
              setRequestKey(null);
              setReport("");
              setError("");
            });
          }}
          style={{ justifySelf: "start", border: 0, background: "transparent", color: "var(--theme-panel-muted)", textDecoration: "underline", cursor: "pointer" }}
        >
          Remove this pending update from this device
        </button>
      )}
      {pendingCount > 0 && !pendingLocal && (
        <p role="status" style={{ margin: 0, color: "var(--theme-panel-muted)" }}>
          {pendingCount} queued item{pendingCount === 1 ? "" : "s"} waiting to reach SolenOS. They are not yet confirmed in your care record.
        </p>
      )}
      {attentionCount > 0 && (
        <p role="alert" style={{ margin: 0, color: "var(--theme-danger-fg, #9b3434)" }}>
          {attentionCount} queued item{attentionCount === 1 ? "" : "s"} still need attention. SolenOS has not confirmed that they were saved.
        </p>
      )}
      {syncNotice && <p role="status" style={{ margin: 0, color: "var(--theme-panel-muted)" }}>{syncNotice}</p>}
      {receipt && (
        <div role="status" style={{ color: "var(--theme-panel-muted)", lineHeight: 1.5 }}>
          <p style={{ margin: 0 }}>Your original update was saved to your Care Record.</p>
          {(receipt.processingStatus === "queued" || receipt.processingStatus === "processing") && (
            <p style={{ margin: "6px 0 0" }}>
              SolenOS is organizing the details in the background. You can keep using Daily Care.
            </p>
          )}
          {receipt.processingStatus === "completed" && (
            <p style={{ margin: "6px 0 0" }}>
              The details from your update are ready for you to review.
            </p>
          )}
          {(receipt.processingStatus === "failed" || receipt.processingStatus === "unavailable") && (
            <p style={{ margin: "6px 0 0" }}>
              SolenOS couldn’t finish sorting this update. Your original report is still saved. No extracted details have been treated as confirmed or added to your Care Record.
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

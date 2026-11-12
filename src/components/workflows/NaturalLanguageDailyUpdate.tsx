"use client";

import { useState } from "react";
import { getCaregiverId, getPersonId, postJSON } from "@/api/client";
import { caregiverSafeErrorMessage } from "@/lib/caregiver-language";

type SaveReceipt = {
  id: string;
  extractionStatus: string;
  assessmentStatus: string;
  medicationNeedsConfirmation: boolean;
};

export default function NaturalLanguageDailyUpdate() {
  const [report, setReport] = useState("");
  const [requestKey, setRequestKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<SaveReceipt | null>(null);

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
        execution_status?: { assessment?: string };
      };

      if (response?.success !== true || typeof response.id !== "string" || !response.id) {
        throw new Error("The server did not confirm that your update was saved.");
      }

      const medicationMentioned = /\b(medication|medicine|dose|dosage|prescription)\b/i.test(report);
      const possibleChange = /\b(changed|change|new dose|adjusted|increased|decreased|reduced|stopped)\b/i.test(report);
      const uncertainty = /\b(i think|maybe|might|may have|not sure|cannot remember|can't remember|don't remember|forgot)\b/i.test(report);
      setReceipt({
        id: response.id,
        extractionStatus: response.qwen_extraction_status || "not_reported",
        assessmentStatus: response.execution_status?.assessment || "not_reported",
        medicationNeedsConfirmation: medicationMentioned && possibleChange && uncertainty,
      });
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
          {receipt.extractionStatus !== "available" && (
            <p style={{ margin: "6px 0 0" }}>
              SolenOS could not finish understanding this update. Your original report is safe, and no extracted details have been treated as confirmed.
            </p>
          )}
          {receipt.extractionStatus === "available" && receipt.assessmentStatus === "failed" && (
            <p style={{ margin: "6px 0 0" }}>
              SolenOS could not organize the observations yet. Your original report remains saved.
            </p>
          )}
          {receipt.medicationNeedsConfirmation && (
            <p style={{ margin: "6px 0 0" }}>
              Your report suggests a medication may have changed, but it does not confirm a new dose. Please check the doctor’s instructions or contact the prescribing professional before relying on a different dose.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

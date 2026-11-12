"use client";

import { useState } from "react";
import { getCaregiverId, getPersonId, postJSON } from "@/api/client";

type CheckInKind = "same_as_usual" | "change" | "uncertain";

const OPTIONS: Array<{ value: CheckInKind; label: string; description: string }> = [
  {
    value: "same_as_usual",
    label: "About the same as usual",
    description: "Your overall impression is that today felt familiar.",
  },
  {
    value: "change",
    label: "Some things were different",
    description: "You noticed a difference, without needing to explain it now.",
  },
  {
    value: "uncertain",
    label: "It’s hard to tell",
    description: "You are not sure how to describe today.",
  },
];

const choiceStyle = (selected: boolean): React.CSSProperties => ({
  display: "block",
  width: "100%",
  minHeight: 58,
  padding: "12px 14px",
  borderRadius: 12,
  border: selected ? "2px solid #668b7b" : "1px solid var(--theme-panel-border)",
  background: selected ? "var(--theme-selected-bg)" : "var(--theme-panel-bg)",
  color: "var(--theme-panel-fg)",
  textAlign: "left",
  cursor: "pointer",
});

export default function QuickDailyCheckIn() {
  const [kind, setKind] = useState<CheckInKind | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);

  function selectKind(value: CheckInKind) {
    setKind(value);
    setError("");
    setSavedAt(null);
    setIdempotencyKey(null);
  }

  async function saveCheckIn() {
    if (!kind || saving) return;

    const personId = getPersonId();
    const caregiverId = getCaregiverId();
    if (!personId || !caregiverId) {
      setError("Your care session could not be verified. Reopen Daily Care before saving.");
      return;
    }

    const requestKey = idempotencyKey ?? crypto.randomUUID();
    setIdempotencyKey(requestKey);
    setSaving(true);
    setError("");

    const reportedAt = new Date().toISOString();
    const noteText = note.trim();

    try {
      const response = (await postJSON("/daily/log", {
        person_id: personId,
        caregiver_id: caregiverId,
        medications: [],
        vitals: [],
        scales: [],
        notes: noteText,
        quick_check_in: {
          schema_version: 1,
          kind,
          selected_areas: [],
          scope: "overall_impression_only",
          caregiver_reported_at: reportedAt,
          epistemic_status: "caregiver_reported",
          idempotency_key: requestKey,
          note: noteText || null,
        },
      })) as { success?: boolean; id?: string | number; recorded_at?: string | null };

      if (response?.success !== true || response.id === undefined || response.id === null) {
        throw new Error("The server did not confirm that this check-in was saved.");
      }

      setSavedAt(response.recorded_at || new Date().toISOString());
      setIdempotencyKey(null);
      setKind(null);
      setNote("");
      window.dispatchEvent(new Event("careRecordUpdated"));
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : "";
      setError(
        reason && reason.length < 180 && !/sql|traceback|stack/i.test(reason)
          ? reason
          : "We couldn’t confirm whether this check-in was saved. Your selection is still here. Check the care record before retrying.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      aria-labelledby="quick-daily-checkin-title"
      className="quick-daily-checkin"
      style={{
        width: "100%",
        maxWidth: "48rem",
        margin: "0 auto 1rem",
        padding: "clamp(.9rem, 3vw, 1.25rem)",
        border: "1px solid var(--theme-panel-border)",
        borderRadius: 16,
        background: "var(--theme-panel-bg)",
        color: "var(--theme-panel-fg)",
      }}
    >
      <h2 id="quick-daily-checkin-title" style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 700 }}>
        Quick check-in
      </h2>
      <p style={{ margin: "0 0 14px", color: "var(--theme-panel-muted)", lineHeight: 1.55 }}>
        How has today been? One overall impression is enough. You can leave this blank.
      </p>

      <div role="group" aria-label="Your overall impression" style={{ display: "grid", gap: 8 }}>
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={kind === option.value}
            disabled={saving}
            onClick={() => selectKind(option.value)}
            style={choiceStyle(kind === option.value)}
          >
            <span style={{ display: "block", fontWeight: 700 }}>{option.label}</span>
            <span style={{ display: "block", marginTop: 3, color: "var(--theme-panel-muted)", fontSize: 13 }}>
              {option.description}
            </span>
          </button>
        ))}
      </div>

      {kind && (
        <div style={{ marginTop: 14 }}>
          <label htmlFor="daily-checkin-note" style={{ display: "block", marginBottom: 6, fontWeight: 650 }}>
            Anything you’d like to add? <span style={{ color: "var(--theme-panel-muted)", fontWeight: 400 }}>Optional</span>
          </label>
          <textarea
            id="daily-checkin-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={2000}
            rows={3}
            placeholder="You can leave this empty."
            disabled={saving}
            style={{
              display: "block",
              width: "100%",
              minHeight: 76,
              padding: 12,
              border: "1px solid var(--theme-panel-border)",
              borderRadius: 10,
              background: "var(--theme-field-bg)",
              color: "var(--theme-field-fg)",
              font: "inherit",
            }}
          />
          <button
            type="button"
            onClick={() => void saveCheckIn()}
            disabled={saving}
            className="workspace-primary"
            style={{ marginTop: 10, minHeight: 44, padding: "10px 16px", borderRadius: 9 }}
          >
            {saving ? "Saving…" : "Save check-in"}
          </button>
        </div>
      )}

      {error && <p role="alert" style={{ margin: "12px 0 0", color: "var(--theme-danger-fg, #9b3434)" }}>{error}</p>}
      {savedAt && (
        <p role="status" style={{ margin: "12px 0 0", color: "var(--theme-panel-muted)" }}>
          Check-in saved to the care record.
        </p>
      )}
      <p style={{ margin: "12px 0 0", color: "var(--theme-panel-muted)", fontSize: 12, lineHeight: 1.5 }}>
        This records your overall impression only. It does not confirm medicines were given or measurements were taken.
      </p>
    </section>
  );
}

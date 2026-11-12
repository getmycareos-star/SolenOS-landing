"use client";

import { useState, type CSSProperties } from "react";
import { getCaregiverId, getPersonId, postJSON } from "@/api/client";
import { LivingArchiveMark } from "@/components/brand";

type QuickUpdateKind = "same_as_usual" | "change" | "concern" | "care_completed" | "uncertain";

const CARE_AREAS = [
  { value: "sleep", label: "Sleep" },
  { value: "eating_and_drinking", label: "Eating and drinking" },
  { value: "mobility", label: "Mobility" },
  { value: "mood_and_behavior", label: "Mood and behavior" },
  { value: "communication", label: "Communication" },
  { value: "daily_routine", label: "Daily routine" },
  { value: "personal_care", label: "Personal care" },
] as const;

const COMPLETED_CARE = [
  { value: "meal_support", label: "Meal support" },
  { value: "personal_care", label: "Personal care" },
  { value: "mobility_support", label: "Mobility support" },
  { value: "appointment_support", label: "Appointment support" },
  { value: "other_care", label: "Other care" },
] as const;

const UPDATE_OPTIONS: Array<{ value: QuickUpdateKind; label: string }> = [
  { value: "same_as_usual", label: "Same as usual" },
  { value: "change", label: "Something changed" },
  { value: "concern", label: "I have a concern" },
  { value: "care_completed", label: "Care was completed" },
  { value: "uncertain", label: "I’m not sure" },
];

const buttonStyle = (selected: boolean): CSSProperties => ({
  minHeight: 46,
  padding: "10px 14px",
  borderRadius: 10,
  border: selected ? "2px solid #527d70" : "1px solid #cbd8d2",
  background: selected ? "var(--theme-selected-bg)" : "var(--theme-panel-bg)",
  color: "var(--theme-panel-fg)",
  fontSize: 15,
  fontWeight: selected ? 700 : 600,
  textAlign: "left",
  cursor: "pointer",
});

export default function QuickDailyCheckIn() {
  const [kind, setKind] = useState<QuickUpdateKind | null>(null);
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<{ id: string; summary: string; recordedAt: string | null } | null>(null);
  const [executionReceipt, setExecutionReceipt] = useState<{
    stages?: Record<string, string>;
  } | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);

  const choices = kind === "care_completed" ? COMPLETED_CARE : CARE_AREAS;
  function chooseKind(next: QuickUpdateKind) {
    setKind(next);
    setSelectedAreas([]);
    setNote("");
    setError("");
    setReceipt(null);
    setIdempotencyKey(null);
    // The ordinary-day path is deliberately one tap: save an overall
    // caregiver impression without claiming any individual domain was checked.
    if (next === "same_as_usual") void saveUpdate(next, [], "", crypto.randomUUID());
  }

  function toggleArea(value: string) {
    setSelectedAreas((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    );
    setError("");
    setReceipt(null);
    setIdempotencyKey(null);
  }

  async function saveUpdate(
    updateKind: QuickUpdateKind | null = kind,
    areas: string[] = selectedAreas,
    noteValue: string = note,
    requestKey?: string,
  ) {
    if (!updateKind || (updateKind !== "same_as_usual" && areas.length === 0) || saving) return;

    const personId = getPersonId();
    const caregiverId = getCaregiverId();
    if (!personId || !caregiverId) {
      setError("Your care session could not be verified. Reopen Daily Care before saving.");
      return;
    }

    const requestId = requestKey ?? idempotencyKey ?? crypto.randomUUID();
    if (!idempotencyKey) setIdempotencyKey(requestId);

    setSaving(true);
    setError("");
    setReceipt(null);

    const reportedAt = new Date().toISOString();
    const areaChoices = updateKind === "care_completed" ? COMPLETED_CARE : CARE_AREAS;
    const labels = areaChoices.filter((area) => areas.includes(area.value)).map((area) => area.label).join(", ");
    const noteText = noteValue.trim();
    const lead =
      updateKind === "same_as_usual"
        ? (labels
          ? `Caregiver reports no significant change from usual in: ${labels}. Other areas were not assessed by this check-in.`
          : "Caregiver reports no significant change in their overall impression of care. No individual care areas were assessed by this check-in.")
        : updateKind === "change"
          ? `Caregiver reports a change relating to: ${labels}.`
          : updateKind === "concern"
            ? `Caregiver reports a concern relating to: ${labels}.`
            : updateKind === "uncertain"
              ? `Caregiver is unsure about: ${labels}. No status is inferred for these areas.`
              : `Caregiver reports completing care relating to: ${labels}.`;
    const summary = noteText ? `${lead} Caregiver note: ${noteText}` : lead;

    try {
      const response = (await postJSON("/daily/log", {
        person_id: personId,
        caregiver_id: caregiverId,
        medications: [],
        vitals: [],
        scales: [],
        notes: summary,
        quick_check_in: {
          schema_version: 1,
          kind: updateKind,
          selected_areas: areas,
          scope: areas.length > 0 ? "selected_areas_only" : "overall_impression_only",
          caregiver_reported_at: reportedAt,
          epistemic_status: "caregiver_reported",
          idempotency_key: requestId,
          note: noteText || null,
        },
      })) as {
        success?: boolean;
        id?: string | number;
        recorded_at?: string | null;
        care_continuity_execution?: { stages?: Record<string, string> } | null;
      };

      if (response?.success !== true || response.id === undefined || response.id === null) {
        throw new Error("The server did not confirm that this update was saved.");
      }

      // The LCR screen subscribes to this event and reloads from PostgreSQL.
      window.dispatchEvent(new Event("careRecordUpdated"));
      setReceipt({
        id: String(response.id),
        summary,
        recordedAt: response.recorded_at || null,
      });
      setExecutionReceipt(response.care_continuity_execution ?? null);
      setIdempotencyKey(null);
      setKind(null);
      setSelectedAreas([]);
      setNote("");
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message.trim() : "";
      const safeReason = reason && reason.length <= 180 && !/sql|traceback|stack|select .* from/i.test(reason)
        ? ` Server response: ${reason}`
        : "";
      setError(`We couldn’t confirm whether this update was saved.${safeReason} Your update may already be recorded. Retry this same update only after the record has been checked and duplicate protection is confirmed. Do not submit a different update while this outcome is unresolved.`);
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
        Quick update
      </h2>
      <p style={{ margin: "0 0 14px", color: "var(--theme-panel-muted)", lineHeight: 1.55 }}>
        Record a simple update without completing the full daily-care form.
      </p>

      <div role="group" aria-label="Choose a quick care update" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 13rem), 1fr))", gap: 8 }}>
        {UPDATE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={kind === option.value}
            disabled={saving}
            onClick={() => chooseKind(option.value)}
            style={buttonStyle(kind === option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {kind && (
        <div style={{ marginTop: 16 }}>
          <p style={{ margin: "0 0 10px", fontWeight: 650, lineHeight: 1.5 }}>
            {kind === "same_as_usual"
              ? "Which areas did you check and find usual?"
              : kind === "care_completed"
                ? "What care was completed?"
                : kind === "uncertain"
                  ? "Which areas are you unsure about?"
                  : "Which areas does this update relate to?"}
          </p>
          <p style={{ margin: "0 0 10px", color: "var(--theme-panel-muted)", fontSize: 13, lineHeight: 1.5 }}>
            {kind === "uncertain" ? "Select only the areas you are unsure about. This will not be treated as a confirmed observation." : "Select only the areas you can report on. Unselected areas will not be marked as checked or unchanged."}
          </p>
          {kind === "same_as_usual" && (
            <p style={{ margin: "0 0 10px", color: "var(--theme-panel-muted)", fontSize: 13, lineHeight: 1.5 }}>
              Selecting areas is optional. If you leave them blank, SolenOS records only your overall impression; no individual care domains are marked as checked or unchanged. This does not establish or change the person’s baseline.
            </p>
          )}
          <div role="group" aria-label="Select care areas" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {choices.map((area) => {
              const selected = selectedAreas.includes(area.value);
              return (
                <button
                  key={area.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleArea(area.value)}
                  style={{
                    ...buttonStyle(selected),
                    minHeight: 42,
                    padding: "8px 12px",
                    fontSize: 14,
                  }}
                >
                  {selected ? "✓ " : ""}{area.label}
                </button>
              );
            })}
          </div>

          <label htmlFor="quick-daily-checkin-note" style={{ display: "block", marginTop: 14, fontWeight: 600, fontSize: 14 }}>
            Add a note (optional)
          </label>
          <textarea
            id="quick-daily-checkin-note"
            value={note}
            onChange={(event) => { setNote(event.target.value); setIdempotencyKey(null); }}
            maxLength={2000}
            rows={2}
            placeholder="Add a detail if it would help…"
            style={{
              display: "block",
              width: "100%",
              minHeight: 76,
              marginTop: 6,
              padding: "10px 12px",
              border: "1px solid var(--theme-panel-border)",
              borderRadius: 9,
              background: "var(--theme-panel-bg)",
              color: "var(--theme-panel-fg)",
              font: "inherit",
              fontSize: 16,
              resize: "vertical",
            }}
          />

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
            <button
              type="button"
              onClick={() => void saveUpdate()}
              disabled={saving || (kind !== "same_as_usual" && selectedAreas.length === 0)}
              className="workspace-primary"
              style={{ minHeight: 46, padding: "10px 16px", borderRadius: 9, fontWeight: 700 }}
            >
              {saving ? "Saving…" : "Save update"}
            </button>
            <button
              type="button"
              onClick={() => { setKind(null); setSelectedAreas([]); setNote(""); setError(""); }}
              disabled={saving}
              style={{ minHeight: 46, padding: "10px 14px", borderRadius: 9, border: "1px solid #cbd8d2", background: "var(--theme-panel-bg)", color: "var(--theme-panel-fg)", fontWeight: 600 }}
            >
              Clear selection
            </button>
          </div>
          {saving && <div style={{ marginTop: 10 }}><LivingArchiveMark size="sm" label="Saving your care update…" /></div>}
          {selectedAreas.length === 0 && kind !== "same_as_usual" && (
            <p style={{ margin: "8px 0 0", color: "var(--theme-panel-muted)", fontSize: 13 }}>
              Select at least one area before saving.
            </p>
          )}
        </div>
      )}

      {error && (
        <p role="alert" style={{ margin: "12px 0 0", padding: "10px 12px", borderRadius: 9, background: "var(--theme-warning-bg)", border: "1px solid var(--theme-warning-border)", color: "var(--theme-warning-fg)" }}>
          {error}
        </p>
      )}

      {receipt && executionReceipt?.stages && (
        <p role="status" style={{ marginTop: 8, color: "var(--theme-panel-muted)", fontSize: 13, lineHeight: 1.5 }}>
          Source saved: {executionReceipt.stages.source_preservation === "verified" ? "confirmed" : "not confirmed"}.
          {" "}Evidence: {executionReceipt.stages.evidence === "verified" ? "linked and confirmed" : executionReceipt.stages.evidence === "not_applicable" ? "not required" : "not confirmed"}.
          {" "}Care-record update: {executionReceipt.stages.reconciliation === "committed" ? "saved" : "not confirmed"}.
        </p>
      )}
      {receipt && (
        <div role="status" style={{ marginTop: 12, padding: "12px", borderRadius: 9, background: "var(--theme-success-bg)", border: "1px solid var(--theme-success-border)", color: "var(--theme-panel-fg)" }}>
          <strong>Saved to the care record.</strong>
          <p style={{ margin: "5px 0 0", lineHeight: 1.5 }}>{receipt.summary}</p>
          {receipt.recordedAt && (
            <p style={{ margin: "5px 0 0", fontSize: 13, color: "var(--theme-panel-muted)" }}>
              Recorded {new Date(receipt.recordedAt).toLocaleString()}
            </p>
          )}
          <span style={{ display: "block", marginTop: 4, fontSize: 12, color: "var(--theme-panel-muted)" }}>
            Record reference: {receipt.id}
          </span>
        </div>
      )}
    </section>
  );
}

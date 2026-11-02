"use client";

import { useState, type CSSProperties } from "react";
import { getCaregiverId, getPersonId, postJSON } from "@/api/client";

type QuickUpdateKind = "same_as_usual" | "change" | "concern" | "care_completed";

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
  { value: "same_as_usual", label: "No significant change" },
  { value: "change", label: "Something changed" },
  { value: "concern", label: "I have a concern" },
  { value: "care_completed", label: "Care was completed" },
];

const buttonStyle = (selected: boolean): CSSProperties => ({
  minHeight: 46,
  padding: "10px 14px",
  borderRadius: 10,
  border: selected ? "2px solid #527d70" : "1px solid #cbd8d2",
  background: selected ? "#eaf2ed" : "#fff",
  color: "#172b35",
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

  const choices = kind === "care_completed" ? COMPLETED_CARE : CARE_AREAS;
  const selectedLabels = choices
    .filter((area) => selectedAreas.includes(area.value))
    .map((area) => area.label);

  function chooseKind(next: QuickUpdateKind) {
    setKind(next);
    setSelectedAreas([]);
    setNote("");
    setError("");
    setReceipt(null);
  }

  function toggleArea(value: string) {
    setSelectedAreas((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    );
    setError("");
    setReceipt(null);
  }

  async function saveUpdate() {
    if (!kind || selectedAreas.length === 0 || saving) return;

    const personId = getPersonId();
    const caregiverId = getCaregiverId();
    if (!personId || !caregiverId) {
      setError("Your care session could not be verified. Reopen Daily Care before saving.");
      return;
    }

    setSaving(true);
    setError("");
    setReceipt(null);

    const reportedAt = new Date().toISOString();
    const labels = selectedLabels.join(", ");
    const noteText = note.trim();
    const lead =
      kind === "same_as_usual"
        ? `Caregiver reports no significant change from usual in: ${labels}. Other areas were not assessed by this check-in.`
        : kind === "change"
          ? `Caregiver reports a change relating to: ${labels}.`
          : kind === "concern"
            ? `Caregiver reports a concern relating to: ${labels}.`
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
          kind,
          selected_areas: selectedAreas,
          scope: "selected_areas_only",
          caregiver_reported_at: reportedAt,
          epistemic_status: "caregiver_reported",
          note: noteText || null,
        },
      })) as { success?: boolean; id?: string | number; recorded_at?: string | null };

      if (response?.success !== true || response.id === undefined || response.id === null) {
        throw new Error("The server did not confirm that this update was saved.");
      }

      setReceipt({
        id: String(response.id),
        summary,
        recordedAt: response.recorded_at || null,
      });
      setKind(null);
      setSelectedAreas([]);
      setNote("");
    } catch {
      setError("We couldn’t confirm whether this update was saved. Check your care record before trying again, to avoid creating a duplicate.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      aria-labelledby="quick-daily-checkin-title"
      style={{
        width: "100%",
        maxWidth: "48rem",
        margin: "0 auto 1rem",
        padding: "clamp(.9rem, 3vw, 1.25rem)",
        border: "1px solid #dce5e0",
        borderRadius: 16,
        background: "#fff",
        color: "#172b35",
      }}
    >
      <h2 id="quick-daily-checkin-title" style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 700 }}>
        Quick update
      </h2>
      <p style={{ margin: "0 0 14px", color: "#52656d", lineHeight: 1.55 }}>
        Record a simple update without completing the full daily-care form.
      </p>

      <div role="group" aria-label="Choose a quick care update" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 13rem), 1fr))", gap: 8 }}>
        {UPDATE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={kind === option.value}
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
                : "Which areas does this update relate to?"}
          </p>
          <p style={{ margin: "0 0 10px", color: "#52656d", fontSize: 13, lineHeight: 1.5 }}>
            Select only the areas you can report on. Unselected areas will not be marked as checked or unchanged.
          </p>
          {kind === "same_as_usual" && (
            <p style={{ margin: "0 0 10px", color: "#52656d", fontSize: 13, lineHeight: 1.5 }}>
              This saves your report for the selected areas only. It does not establish or change the person’s baseline.
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
            onChange={(event) => setNote(event.target.value)}
            maxLength={2000}
            rows={2}
            placeholder="Add a detail if it would help…"
            style={{
              display: "block",
              width: "100%",
              minHeight: 76,
              marginTop: 6,
              padding: "10px 12px",
              border: "1px solid #bdcbd0",
              borderRadius: 9,
              background: "#fff",
              color: "#172b35",
              font: "inherit",
              fontSize: 16,
              resize: "vertical",
            }}
          />

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
            <button
              type="button"
              onClick={saveUpdate}
              disabled={saving || selectedAreas.length === 0}
              className="workspace-primary"
              style={{ minHeight: 46, padding: "10px 16px", borderRadius: 9, fontWeight: 700 }}
            >
              {saving ? "Saving…" : "Save update"}
            </button>
            <button
              type="button"
              onClick={() => { setKind(null); setSelectedAreas([]); setNote(""); setError(""); }}
              disabled={saving}
              style={{ minHeight: 46, padding: "10px 14px", borderRadius: 9, border: "1px solid #cbd8d2", background: "#fff", color: "#172b35", fontWeight: 600 }}
            >
              Clear selection
            </button>
          </div>
          {selectedAreas.length === 0 && (
            <p style={{ margin: "8px 0 0", color: "#52656d", fontSize: 13 }}>
              Select at least one area before saving.
            </p>
          )}
        </div>
      )}

      {error && (
        <p role="alert" style={{ margin: "12px 0 0", padding: "10px 12px", borderRadius: 9, background: "#fff4dc", border: "1px solid #c8a85d", color: "#3b2e11" }}>
          {error}
        </p>
      )}

      {receipt && (
        <div role="status" style={{ marginTop: 12, padding: "12px", borderRadius: 9, background: "#edf5eb", border: "1px solid #8eae8a", color: "#172b35" }}>
          <strong>Saved to the care record.</strong>
          <p style={{ margin: "5px 0 0", lineHeight: 1.5 }}>{receipt.summary}</p>
          {receipt.recordedAt && (
            <p style={{ margin: "5px 0 0", fontSize: 13, color: "#52656d" }}>
              Recorded {new Date(receipt.recordedAt).toLocaleString()}
            </p>
          )}
          <span style={{ display: "block", marginTop: 4, fontSize: 12, color: "#52656d" }}>
            Record reference: {receipt.id}
          </span>
        </div>
      )}
    </section>
  );
}

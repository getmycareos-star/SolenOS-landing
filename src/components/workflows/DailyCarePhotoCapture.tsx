"use client";

import { useState } from "react";
import { getCaregiverId, getPersonId, postFormData } from "@/api/client";

export default function DailyCarePhotoCapture() {
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function savePhoto() {
    if (!file || saving) return;
    const personId = getPersonId();
    const caregiverId = getCaregiverId();
    if (!personId || !caregiverId) {
      setError("Your care session could not be verified. Reopen Daily Care before uploading.");
      return;
    }

    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("person_id", personId);
      form.append("caregiver_id", caregiverId);
      const result = await postFormData("/upload", form) as { evidence_id?: string };
      if (!result?.evidence_id) {
        throw new Error("The server did not confirm that the photo was saved.");
      }
      setSaved(true);
      setFile(null);
      window.dispatchEvent(new Event("careRecordUpdated"));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "";
      setError(message && message.length < 180 && !/sql|traceback|stack/i.test(message)
        ? message
        : "We couldn’t confirm whether the photo was saved. Your selected file is still available to retry.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby="daily-care-photo-title" style={{
      padding: 16,
      border: "1px solid var(--theme-panel-border)",
      borderRadius: 12,
      background: "var(--theme-panel-bg)",
      color: "var(--theme-panel-fg)",
    }}>
      <h3 id="daily-care-photo-title" style={{ margin: "0 0 6px", fontSize: 18 }}>Add a photograph</h3>
      <p style={{ margin: "0 0 12px", color: "var(--theme-panel-muted)", lineHeight: 1.5 }}>
        Choose a photo that helps explain something in the care record. Upload only what you want to share.
      </p>
      <label htmlFor="daily-care-photo-file" style={{ display: "block", marginBottom: 8, fontWeight: 650 }}>
        Photograph
      </label>
      <input
        id="daily-care-photo-file"
        type="file"
        accept="image/*"
        onChange={(event) => {
          setFile(event.target.files?.[0] ?? null);
          setError("");
          setSaved(false);
        }}
        disabled={saving}
      />
      {file && <p style={{ margin: "8px 0", color: "var(--theme-panel-muted)" }}>{file.name}</p>}
      <button
        type="button"
        onClick={() => void savePhoto()}
        disabled={!file || saving}
        className="workspace-primary"
        style={{ display: "block", marginTop: 12, minHeight: 44, padding: "10px 16px", borderRadius: 9 }}
      >
        {saving ? "Uploading…" : "Save photograph"}
      </button>
      {error && <p role="alert" style={{ color: "var(--theme-danger-fg, #9b3434)" }}>{error}</p>}
      {saved && <p role="status">Photograph saved as care-record evidence.</p>}
    </section>
  );
}

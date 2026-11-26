"use client";

import { useEffect, useRef, useState } from "react";
import { getCaregiverId, getPersonId } from "@/api/client";
import { SnapCameraCapture } from "@/components/mvp-workspace/capture/SnapCameraCapture";
import { extractAttachedDocument } from "@/components/mvp-workspace/capture/extract-attached";
import {
  discardDurableWrite,
  durableWriteId,
  getDurableWriteSummary,
  hasDurableWrite,
  syncDurableWrites,
} from "@/lib/offline-sync/durable-write-queue";
import { sendQueuedCareWrite } from "@/lib/offline-sync/send-queued-care-write";

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const SUPPORTED_PHOTO_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/bmp", "image/tiff",
]);

export default function DailyCarePhotoCapture() {
  const [file, setFile] = useState<File | null>(null);
  const [captureMethod, setCaptureMethod] = useState<"snap" | "upload">("upload");
  const [captureTimestamp, setCaptureTimestamp] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [ingestionKey, setIngestionKey] = useState<string | null>(null);
  const [pendingLocal, setPendingLocal] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncNotice, setSyncNotice] = useState("");
  const [uploadStage, setUploadStage] = useState<"idle" | "preparing" | "sending" | "confirming">("idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const pendingQueueId = useRef<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    let active = true;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    const sync = async () => {
      const personId = getPersonId();
      const caregiverId = getCaregiverId();
      if (!personId || !caregiverId) return;
      try {
        const summary = await getDurableWriteSummary(personId, caregiverId);
        if (!active) return;
        setPendingCount(summary.pending);
        if (typeof navigator !== "undefined" && !navigator.onLine) return;
        const result = await syncDurableWrites({
          personId,
          caregiverId,
          send: sendQueuedCareWrite,
        });
        const afterSync = await getDurableWriteSummary(personId, caregiverId);
        if (!active) return;
        setPendingCount(afterSync.pending);
        if (afterSync.pending > 0 && typeof navigator !== "undefined" && navigator.onLine) {
          if (retryTimer) clearTimeout(retryTimer);
          retryTimer = setTimeout(sync, 5_000);
        }
        if (pendingQueueId.current && !(await hasDurableWrite(pendingQueueId.current))) {
          pendingQueueId.current = null;
          setPendingLocal(false);
          setIngestionKey(null);
          setCaptureTimestamp(null);
          setFile(null);
          setSaved(true);
          setSyncNotice("Your photo has reached SolenOS and is saved as evidence. It has not been confirmed as a care-record event.");
        }
        if (result.synced > 0) {
          setSyncNotice("A queued item has reached SolenOS. Any required review or processing may still be outstanding.");
          window.dispatchEvent(new Event("careRecordUpdated"));
        }
      } catch {
        // Keep the encrypted original available for a later retry.
      }
    };
    void sync();
    window.addEventListener("online", sync);
    window.addEventListener("personIdChanged", sync);
    window.addEventListener("solenos:offline-queue-updated", sync);
    return () => {
      active = false;
      if (retryTimer) clearTimeout(retryTimer);
      window.removeEventListener("online", sync);
      window.removeEventListener("personIdChanged", sync);
      window.removeEventListener("solenos:offline-queue-updated", sync);
    };
  }, []);

  function selectPhoto(selected: File | undefined, method: "snap" | "upload") {
    if (!selected) return;
    setError("");
    setSaved(false);
    setSyncNotice("");
    setUploadStage("idle");
    if (!SUPPORTED_PHOTO_TYPES.has(selected.type.toLowerCase())) {
      setFile(null);
      setIngestionKey(null);
      setCaptureTimestamp(null);
      setError("Choose a JPEG, PNG, WebP, GIF, BMP or TIFF photo.");
      return;
    }
    if (selected.size <= 0 || selected.size > MAX_PHOTO_BYTES) {
      setFile(null);
      setIngestionKey(null);
      setCaptureTimestamp(null);
      setError("Photos must be 10 MiB or smaller. Choose a smaller photo and try again.");
      return;
    }
    const sameSelection = file
      && file.name === selected.name
      && file.size === selected.size
      && file.lastModified === selected.lastModified;
    if (!sameSelection) {
      setIngestionKey(null);
      setCaptureTimestamp(new Date().toISOString());
    }
    setCaptureMethod(method);
    setFile(selected);
  }

  async function savePhoto() {
    if (!file || saving) return;
    const personId = getPersonId();
    const caregiverId = getCaregiverId();
    if (!personId || !caregiverId) {
      setError("We could not confirm which Care Record to use. Reopen Daily Care and try again.");
      return;
    }

    setSaving(true);
    setError("");
    setSaved(false);
    setSyncNotice("");
    setUploadStage("preparing");
    const retryKey = ingestionKey ?? crypto.randomUUID();
    const capturedAt = captureTimestamp ?? new Date().toISOString();
    const queueId = durableWriteId("/upload", retryKey);
    setIngestionKey(retryKey);
    pendingQueueId.current = queueId;

    try {
      setUploadStage("sending");
      const result = await extractAttachedDocument(
        file,
        captureMethod,
        retryKey,
        capturedAt,
        undefined,
        "care_photo",
      );
      setUploadStage("confirming");

      if (result.status === "saved" && result.evidenceId) {
        pendingQueueId.current = null;
        setPendingLocal(false);
        setSaved(true);
        setFile(null);
        setIngestionKey(null);
        setCaptureTimestamp(null);
        setSyncNotice("Your photo was uploaded and saved as evidence. It has not been confirmed as a care-record event.");
        window.dispatchEvent(new Event("careRecordUpdated"));
        return;
      }

      if (result.status === "pending" || await hasDurableWrite(queueId)) {
        setPendingLocal(true);
        const summary = await getDurableWriteSummary(personId, caregiverId).catch(() => null);
        if (summary) setPendingCount(summary.pending);
        setError("This photo is saved on this device. It has not reached SolenOS or been added to your care record yet. It will be sent when your connection returns.");
        return;
      }

      setError(result.errorNote || "SolenOS could not confirm that this photo was received. Keep the photo selected and retry; the same request key will be reused.");
    } catch (cause) {
      const queued = await hasDurableWrite(queueId).catch(() => false);
      if (queued) {
        setPendingLocal(true);
        const summary = await getDurableWriteSummary(personId, caregiverId).catch(() => null);
        if (summary) setPendingCount(summary.pending);
        setError("This photo is saved on this device. It has not reached SolenOS or been added to your care record yet. It will be sent when your connection returns.");
      } else {
        setError(cause instanceof Error
          ? cause.message
          : "SolenOS could not confirm the upload. Keep the photo selected and retry.");
      }
    } finally {
      setUploadStage("idle");
      setSaving(false);
    }
  }

  async function removePendingPhoto() {
    if (!ingestionKey) return;
    try {
      await discardDurableWrite(durableWriteId("/upload", ingestionKey));
      pendingQueueId.current = null;
      setPendingLocal(false);
      setIngestionKey(null);
      setError("The queued copy was removed from this device. The photo is still selected; save it again when ready.");
    } catch {
      setError("SolenOS could not remove the queued copy. It remains on this device.");
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
      <h3 id="daily-care-photo-title" style={{ margin: "0 0 6px", fontSize: "calc(18px * var(--solenos-text-scale, 1))" }}>Add a photograph</h3>
      <p style={{ margin: "0 0 12px", color: "var(--theme-panel-muted)", lineHeight: 1.5 }}>
        Take a new photo or choose one from this device. A saved photo is evidence, not proof that a care event happened.
      </p>
      <div style={{ display: "grid", gap: 10 }}>
        <button
          type="button"
          className="workspace-secondary"
          onClick={() => setCameraOpen(true)}
          disabled={saving || pendingLocal}
          style={{ minHeight: 44, padding: "10px 14px", borderRadius: 9, textAlign: "left" }}
        >
          Take a photo
        </button>
        <div>
          <label htmlFor="daily-care-photo-library" style={{ display: "block", marginBottom: 6, fontWeight: 650 }}>
            Choose an existing photo
          </label>
          <input
            id="daily-care-photo-library"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/bmp,image/tiff"
            onChange={(event) => selectPhoto(event.target.files?.[0], "upload")}
            disabled={saving || pendingLocal}
          />
        </div>
      </div>
      <SnapCameraCapture
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={(captured) => {
          selectPhoto(captured, "snap");
          setCameraOpen(false);
        }}
      />
      {file && (
        <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
          <p style={{ margin: 0, color: "var(--theme-panel-muted)" }}>{file.name} · {(file.size / (1024 * 1024)).toFixed(1)} MiB</p>
          {previewUrl && <img src={previewUrl} alt="Preview of the selected care photo" style={{ display: "block", width: "100%", maxHeight: 320, objectFit: "contain", borderRadius: 10, background: "var(--theme-field-bg)" }} />}
        </div>
      )}
      <button
        type="button"
        onClick={() => void savePhoto()}
        disabled={!file || saving}
        className="workspace-primary"
        style={{ display: "block", marginTop: 12, minHeight: 44, padding: "10px 16px", borderRadius: 9 }}
      >
        {saving ? (uploadStage === "preparing" ? "Preparing photo…" : uploadStage === "confirming" ? "Checking saved copy…" : "Sending photo…") : pendingLocal ? "Retry upload" : "Save photograph"}
      </button>
      {saving && <p role="status" aria-live="polite" style={{ color: "var(--theme-panel-muted)" }}>{uploadStage === "preparing" ? "Preparing the original photo for a safe upload." : uploadStage === "confirming" ? "Checking that SolenOS saved the original photo." : "Sending the original photo to SolenOS. Keep this screen open until receipt is confirmed."}</p>}
      {error && <p role="alert" style={{ color: "var(--theme-danger-fg, #9b3434)" }}>{error}</p>}
      {pendingLocal && ingestionKey && (
        <button
          type="button"
          onClick={() => void removePendingPhoto()}
          style={{ border: 0, background: "transparent", color: "var(--theme-panel-muted)", textDecoration: "underline", cursor: "pointer" }}
        >
          Remove the queued copy from this device
        </button>
      )}
      {pendingCount > 0 && !pendingLocal && (
        <p role="status">{pendingCount} queued item{pendingCount === 1 ? "" : "s"} waiting to reach SolenOS.</p>
      )}
      {syncNotice && <p role="status">{syncNotice}</p>}
      {saved && <p role="status">Photo uploaded and saved as evidence. It has not been confirmed as a care-record event.</p>}
    </section>
  );
}

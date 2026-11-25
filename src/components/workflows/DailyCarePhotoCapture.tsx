"use client";

import { useEffect, useRef, useState } from "react";
import { getCaregiverId, getPersonId, postFormData } from "@/api/client";
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

const MAX_SERVER_PHOTO_BYTES = 10 * 1024 * 1024;
const MAX_OFFLINE_PHOTO_BYTES = MAX_SERVER_PHOTO_BYTES;
const SUPPORTED_PHOTO_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/bmp", "image/tiff",
]);

async function encodeFileForOfflineQueue(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return window.btoa(binary);
}

export default function DailyCarePhotoCapture() {
  const [file, setFile] = useState<File | null>(null);
  const [captureMethod, setCaptureMethod] = useState<"snap" | "upload">("upload");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  // Reuse one server idempotency key while the same selected file is retried.
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
      setError("Choose a JPEG, PNG, WebP, GIF, BMP or TIFF photo.");
      return;
    }
    if (selected.size <= 0 || selected.size > MAX_SERVER_PHOTO_BYTES) {
      setFile(null);
      setIngestionKey(null);
      setError("Photos must be 10 MiB or smaller. Choose a smaller photo and try again.");
      return;
    }
    const sameSelection = file
      && file.name === selected.name
      && file.size === selected.size
      && file.lastModified === selected.lastModified;
    if (!sameSelection) setIngestionKey(null);
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
    setIngestionKey(retryKey);
    const fields = {
      ingestion_key: retryKey,
      person_id: personId,
      caregiver_id: caregiverId,
      evidence_type: "care_photo",
      capture_method: captureMethod,
    };
    let queueId: string | null = null;
    let localQueueUnavailable = false;
    try {
      if (file.size <= MAX_OFFLINE_PHOTO_BYTES) {
        try {
          queueId = await enqueueDurableWrite({
            person_id: personId,
            caregiver_id: caregiverId,
            endpoint: "/upload",
            idempotency_key: retryKey,
            payload: {
              offline_kind: "file_upload",
              file_name: file.name,
              mime_type: file.type || "application/octet-stream",
              file_base64: await encodeFileForOfflineQueue(file),
              fields,
            },
          });
          pendingQueueId.current = queueId;
        } catch {
          localQueueUnavailable = true;
          if (typeof navigator !== "undefined" && !navigator.onLine) {
            throw new Error("This photo could not be saved safely on this device. It was not saved.");
          }
        }
      } else if (typeof navigator !== "undefined" && !navigator.onLine) {
        throw new Error("This photo is too large to save on this device without a connection. Connect to the internet before trying again.");
      }

      setUploadStage("sending");
      const form = new FormData();
      form.append("file", file);
      form.append("ingestion_key", retryKey);
      form.append("person_id", personId);
      form.append("caregiver_id", caregiverId);
      form.append("evidence_type", "care_photo");
      form.append("capture_method", captureMethod);
      const result = queueId
        ? await deliverDurableWrite<{ evidence_id?: string; persisted?: boolean }>(queueId, sendQueuedCareWrite)
        : await postFormData("/upload", form) as { evidence_id?: string; persisted?: boolean };
      setUploadStage("confirming");
      if (!result?.evidence_id || result.persisted !== true) {
        throw new Error("SolenOS did not confirm that the original photo was saved.");
      }
      pendingQueueId.current = null;
      setPendingLocal(false);
      setSaved(true);
      setFile(null);
      setIngestionKey(null);
      setUploadStage("idle");
      setSyncNotice("Your photo was uploaded and saved as evidence. It has not been confirmed as a care-record event.");
      window.dispatchEvent(new Event("careRecordUpdated"));
    } catch (cause) {
      setUploadStage("idle");
      if (queueId) {
        setPendingLocal(true);
        const summary = await getDurableWriteSummary(personId, caregiverId).catch(() => null);
        if (summary) setPendingCount(summary.pending);
        setError("This photo is saved on this device. It has not reached SolenOS or been added to your care record yet. It will be sent when your connection returns.");
      } else {
        const reason = cause instanceof Error ? cause.message : "";
        setError(localQueueUnavailable
          ? "This photo could not be saved on this device, and SolenOS could not confirm the upload. Keep this screen open and retry; the photo is not safely queued."
          : reason || "SolenOS could not confirm that this photo was received. Keep the photo selected and retry; the same request key will be reused.");
      }
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
      <h3 id="daily-care-photo-title" style={{ margin: "0 0 6px", fontSize: "calc(18px * var(--solenos-text-scale, 1))" }}>Add a photograph</h3>
      <p style={{ margin: "0 0 12px", color: "var(--theme-panel-muted)", lineHeight: 1.5 }}>
        Choose a photo that helps explain something in the care record. Upload only what you want to share.
      </p>
      <div style={{ display: "grid", gap: 10 }}>
        <div>
          <label htmlFor="daily-care-photo-camera" style={{ display: "block", marginBottom: 6, fontWeight: 650 }}>
            Take a photo
          </label>
          <input
            id="daily-care-photo-camera"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/bmp,image/tiff"
            capture="environment"
            onChange={(event) => selectPhoto(event.target.files?.[0], "snap")}
            disabled={saving || pendingLocal}
          />
        </div>
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
      {file && (
        <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
          <p style={{ margin: 0, color: "var(--theme-panel-muted)" }}>{file.name} · {(file.size / (1024 * 1024)).toFixed(1)} MiB</p>
          {previewUrl && <img src={previewUrl} alt="Preview of the selected care photo" style={{ display: "block", width: "100%", maxHeight: 320, objectFit: "contain", borderRadius: 10, background: "var(--theme-field-bg)" }} />}
          {typeof navigator !== "undefined" && !navigator.onLine && file.size > MAX_OFFLINE_PHOTO_BYTES && (
            <p role="status" style={{ color: "var(--theme-panel-muted)", margin: 0 }}>This photo is too large to keep in the offline queue. Connect to the internet before sending it.</p>
          )}
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
          onClick={() => {
            void discardDurableWrite(durableWriteId("/upload", ingestionKey)).then(() => {
              pendingQueueId.current = null;
              setPendingLocal(false);
              setIngestionKey(null);
              setFile(null);
              setError("");
            });
          }}
          style={{ border: 0, background: "transparent", color: "var(--theme-panel-muted)", textDecoration: "underline", cursor: "pointer" }}
        >
          Remove this pending photo from this device
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

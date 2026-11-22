"use client";

import { useEffect, useRef, useState } from "react";
import { getCaregiverId, getPersonId, postFormData } from "@/api/client";
import { sendQueuedCareWrite } from "@/lib/offline-sync/send-queued-care-write";
import { caregiverSafeErrorMessage } from "@/lib/caregiver-language";
import {
  deliverDurableWrite,
  discardDurableWrite,
  durableWriteId,
  enqueueDurableWrite,
  getDurableWriteSummary,
  hasDurableWrite,
  syncDurableWrites,
} from "@/lib/offline-sync/durable-write-queue";

const MAX_OFFLINE_PHOTO_BYTES = 8 * 1024 * 1024;

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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  // Reuse one server idempotency key while the same selected file is retried.
  const [ingestionKey, setIngestionKey] = useState<string | null>(null);
  const [pendingLocal, setPendingLocal] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncNotice, setSyncNotice] = useState("");
  const pendingQueueId = useRef<string | null>(null);

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
        }
        if (result.synced > 0) {
          setSyncNotice("A saved update has been added to your Care Record.");
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
    const retryKey = ingestionKey ?? crypto.randomUUID();
    setIngestionKey(retryKey);
    const fields = {
      ingestion_key: retryKey,
      person_id: personId,
      caregiver_id: caregiverId,
      evidence_type: "care_photo",
    };
    let queueId: string | null = null;
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
          if (typeof navigator !== "undefined" && !navigator.onLine) {
            throw new Error("This photo could not be saved safely on this device. It was not saved.");
          }
        }
      } else if (typeof navigator !== "undefined" && !navigator.onLine) {
        throw new Error("This photo is too large to save on this device without a connection. Connect to the internet before trying again.");
      }

      const form = new FormData();
      form.append("file", file);
      form.append("ingestion_key", retryKey);
      form.append("person_id", personId);
      form.append("caregiver_id", caregiverId);
      form.append("evidence_type", "care_photo");
      const result = queueId
        ? await deliverDurableWrite<{ evidence_id?: string; persisted?: boolean }>(queueId, sendQueuedCareWrite)
        : await postFormData("/upload", form) as { evidence_id?: string; persisted?: boolean };
      if (!result?.evidence_id || result.persisted !== true) {
        throw new Error("The server did not confirm that the photo was saved.");
      }
      pendingQueueId.current = null;
      setPendingLocal(false);
      setSaved(true);
      setFile(null);
      setIngestionKey(null);
      window.dispatchEvent(new Event("careRecordUpdated"));
    } catch {
      if (queueId) {
        setPendingLocal(true);
        const summary = await getDurableWriteSummary(personId, caregiverId).catch(() => null);
        if (summary) setPendingCount(summary.pending);
        setError("This photo is saved securely on this device, but it has not been added to your Care Record yet. It will be sent when your connection returns.");
      } else {
        setError(caregiverSafeErrorMessage());
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
      <label htmlFor="daily-care-photo-file" style={{ display: "block", marginBottom: 8, fontWeight: 650 }}>
        Photograph
      </label>
      <input
        id="daily-care-photo-file"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={(event) => {
          setFile(event.target.files?.[0] ?? null);
          setIngestionKey(null);
          setPendingLocal(false);
          setError("");
          setSaved(false);
        }}
        disabled={saving || pendingLocal}
      />
      {file && <p style={{ margin: "8px 0", color: "var(--theme-panel-muted)" }}>{file.name}</p>}
      <button
        type="button"
        onClick={() => void savePhoto()}
        disabled={!file || saving}
        className="workspace-primary"
        style={{ display: "block", marginTop: 12, minHeight: 44, padding: "10px 16px", borderRadius: 9 }}
      >
        {saving ? "Uploading…" : pendingLocal ? "Retry upload" : "Save photograph"}
      </button>
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
        <p role="status">{pendingCount} update{pendingCount === 1 ? "" : "s"} waiting to be added to your Care Record.</p>
      )}
      {syncNotice && <p role="status">{syncNotice}</p>}
      {saved && <p role="status">Photograph saved with your care information.</p>}
    </section>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getCaregiverId, getPersonId } from "@/api/client";
import { sendQueuedCareWrite } from "@/lib/offline-sync/send-queued-care-write";
import { getDurableWriteSummary, isDurableWriteStoragePersistent, retryBlockedDurableWrites, retryPendingDurableWrites, syncDurableWrites } from "@/lib/offline-sync/durable-write-queue";

export default function DailyCareOfflineQueueNotice() {
  const [pending, setPending] = useState(0);
  const [sending, setSending] = useState(0);
  const [attention, setAttention] = useState(0);
  const [synced, setSynced] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [retryNotice, setRetryNotice] = useState("");
  const [persistentStorage, setPersistentStorage] = useState<boolean | null>(null);
  const retryTimer = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    const personId = getPersonId();
    const caregiverId = getCaregiverId();
    if (!personId || !caregiverId) return;

    try {
      if (retryTimer.current) window.clearTimeout(retryTimer.current);
      retryTimer.current = null;
      const before = await getDurableWriteSummary(personId, caregiverId);
      const storageIsPersistent = await isDurableWriteStoragePersistent().catch(() => false);
      setPersistentStorage(storageIsPersistent);
      setPending(before.pending);
      setSending(before.sending);
      setAttention(before.blocked + before.failed_recoverable);
      if (before.pending > 0) setSynced(false);

      if (
        typeof navigator !== "undefined" &&
        navigator.onLine &&
        (before.pending > 0 || before.sending > 0 || before.failed_recoverable > 0)
      ) {
        const result = await syncDurableWrites({
          personId,
          caregiverId,
          send: sendQueuedCareWrite,
        });
        const after = await getDurableWriteSummary(personId, caregiverId);
        setPending(after.pending);
        setSending(after.sending);
        setAttention(after.blocked + after.failed_recoverable);
        if (result.synced > 0) {
          setSynced(true);
          window.dispatchEvent(new Event("careRecordUpdated"));
        }
        if (retryTimer.current) window.clearTimeout(retryTimer.current);
        if (after.pending > 0 || after.sending > 0 || after.failed_recoverable > 0) {
          retryTimer.current = window.setTimeout(() => {
            retryTimer.current = null;
            void refresh();
          }, 16_000);
        }
      }
    } catch {
      // A failed status read must never hide or delete the encrypted local queue.
    }
  }, []);

  const retryAttention = useCallback(async () => {
    const personId = getPersonId();
    const caregiverId = getCaregiverId();
    if (!personId || !caregiverId) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setRetryNotice("Reconnect to the internet before retrying these updates.");
      return;
    }
    setRetrying(true);
    setRetryNotice("");
    try {
      await retryBlockedDurableWrites(personId, caregiverId);
      setRetryNotice("Retry requested. SolenOS will confirm whether each update was received.");
      await refresh();
    } catch {
      setRetryNotice("SolenOS could not retry these updates. They remain saved on this device.");
    } finally {
      setRetrying(false);
    }
  }, [refresh]);

  const retryOnReconnect = useCallback(async () => {
    const personId = getPersonId();
    const caregiverId = getCaregiverId();
    if (personId && caregiverId && typeof navigator !== "undefined" && navigator.onLine) {
      await retryPendingDurableWrites(personId, caregiverId);
    }
    await refresh();
  }, [refresh]);

  useEffect(() => {
    let active = true;
    const update = () => {
      if (active) void refresh();
    };
    const reconnect = () => {
      if (active) void retryOnReconnect();
    };
    update();
    window.addEventListener("online", reconnect);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    window.addEventListener("personIdChanged", update);
    window.addEventListener("solenos:offline-queue-updated", update);
    return () => {
      active = false;
      if (retryTimer.current) window.clearTimeout(retryTimer.current);
      retryTimer.current = null;
      window.removeEventListener("online", reconnect);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("personIdChanged", update);
      window.removeEventListener("solenos:offline-queue-updated", update);
    };
  }, [refresh, retryOnReconnect]);

  return (
    <>
      {pending > 0 && (
        <p role="status" className="daily-care-muted">
          {pending} update{pending === 1 ? "" : "s"} saved on this device and waiting to reach SolenOS. They are not yet confirmed in your care record. Keep this browser data until they are sent.
        </p>
      )}
      {(pending > 0 || sending > 0 || attention > 0) && persistentStorage === false && (
        <p role="alert" className="daily-care-muted">
          This browser has not protected these device-only updates from automatic storage cleanup. Keep this browser data and reconnect or resolve the issue as soon as you can.
        </p>
      )}
      {sending > 0 && (
        <div role="status" className="daily-care-muted" style={{ display: "grid", gap: 6 }}>
          <span>{sending} queued item{sending === 1 ? "" : "s"} being sent to SolenOS. This does not mean they have been added to your care record.</span>
          <progress aria-label="Sending queued care updates" max={100} style={{ width: "100%", minHeight: 8 }} />
        </div>
      )}
      {synced && (
        <p role="status" className="daily-care-muted">
          A queued item has reached SolenOS. Any required review or processing may still be outstanding before its details become part of the care record.
        </p>
      )}
      {attention > 0 && (
        <div role="alert" className="daily-care-muted" style={{ display: "grid", gap: 8 }}>
          <p style={{ margin: 0 }}>{attention} queued item{attention === 1 ? "" : "s"} need attention. SolenOS has not confirmed that they were saved.</p>
          <button type="button" className="workspace-secondary" onClick={() => void retryAttention()} disabled={retrying}>
            {retrying ? "Checking updates…" : "Try sending again"}
          </button>
        </div>
      )}
      {retryNotice && <p role="status" className="daily-care-muted">{retryNotice}</p>}
    </>
  );
}

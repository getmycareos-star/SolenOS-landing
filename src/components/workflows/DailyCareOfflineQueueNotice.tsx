"use client";

import { useCallback, useEffect, useState } from "react";
import { getCaregiverId, getPersonId } from "@/api/client";
import { sendQueuedCareWrite } from "@/lib/offline-sync/send-queued-care-write";
import { getDurableWriteSummary, retryBlockedDurableWrites, retryPendingDurableWrites, syncDurableWrites } from "@/lib/offline-sync/durable-write-queue";

export default function DailyCareOfflineQueueNotice() {
  const [pending, setPending] = useState(0);
  const [attention, setAttention] = useState(0);
  const [synced, setSynced] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [retryNotice, setRetryNotice] = useState("");

  const refresh = useCallback(async () => {
    const personId = getPersonId();
    const caregiverId = getCaregiverId();
    if (!personId || !caregiverId) return;

    try {
      const before = await getDurableWriteSummary(personId, caregiverId);
      setPending(before.pending);
      setAttention(before.blocked + before.failed_recoverable);
      if (before.pending > 0) setSynced(false);

      if (typeof navigator !== "undefined" && navigator.onLine && before.pending > 0) {
        const result = await syncDurableWrites({
          personId,
          caregiverId,
          send: sendQueuedCareWrite,
        });
        const after = await getDurableWriteSummary(personId, caregiverId);
        setPending(after.pending);
        setAttention(after.blocked + after.failed_recoverable);
        if (result.synced > 0) {
          setSynced(true);
          window.dispatchEvent(new Event("careRecordUpdated"));
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
    window.addEventListener("personIdChanged", update);
    window.addEventListener("solenos:offline-queue-updated", update);
    return () => {
      active = false;
      window.removeEventListener("online", reconnect);
      window.removeEventListener("personIdChanged", update);
      window.removeEventListener("solenos:offline-queue-updated", update);
    };
  }, [refresh, retryOnReconnect]);

  return (
    <>
      {pending > 0 && (
        <p role="status" className="daily-care-muted">
          {pending} update{pending === 1 ? "" : "s"} saved on this device and waiting to reach SolenOS. They are not yet confirmed in your care record.
        </p>
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

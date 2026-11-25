"use client";

import { useCallback, useEffect, useState } from "react";
import { getCaregiverId, getPersonId } from "@/api/client";
import { sendQueuedCareWrite } from "@/lib/offline-sync/send-queued-care-write";
import { getDurableWriteSummary, retryPendingDurableWrites, syncDurableWrites } from "@/lib/offline-sync/durable-write-queue";

export default function DailyCareOfflineQueueNotice() {
  const [pending, setPending] = useState(0);
  const [attention, setAttention] = useState(0);
  const [synced, setSynced] = useState(false);

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
        <p role="alert" className="daily-care-muted">
          {attention} update{attention === 1 ? "" : "s"} need attention and have not been saved to the care record.
        </p>
      )}
    </>
  );
}

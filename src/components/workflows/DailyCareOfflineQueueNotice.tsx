"use client";

import { useCallback, useEffect, useState } from "react";
import { getCaregiverId, getPersonId } from "@/api/client";
import { sendQueuedCareWrite } from "@/lib/offline-sync/send-queued-care-write";
import { getDurableWriteSummary, syncDurableWrites } from "@/lib/offline-sync/durable-write-queue";

export default function DailyCareOfflineQueueNotice() {
  const [pending, setPending] = useState(0);
  const [attention, setAttention] = useState(0);

  const refresh = useCallback(async () => {
    const personId = getPersonId();
    const caregiverId = getCaregiverId();
    if (!personId || !caregiverId) return;

    try {
      const before = await getDurableWriteSummary(personId, caregiverId);
      setPending(before.pending);
      setAttention(before.blocked + before.failed_recoverable);

      if (typeof navigator !== "undefined" && navigator.onLine && before.pending > 0) {
        const result = await syncDurableWrites({
          personId,
          caregiverId,
          send: sendQueuedCareWrite,
        });
        const after = await getDurableWriteSummary(personId, caregiverId);
        setPending(after.pending);
        setAttention(after.blocked + after.failed_recoverable);
        if (result.synced > 0) window.dispatchEvent(new Event("careRecordUpdated"));
      }
    } catch {
      // A failed status read must never hide or delete the encrypted local queue.
    }
  }, []);

  useEffect(() => {
    let active = true;
    const update = () => {
      if (active) void refresh();
    };
    update();
    window.addEventListener("online", update);
    window.addEventListener("personIdChanged", update);
    window.addEventListener("solenos:offline-queue-updated", update);
    return () => {
      active = false;
      window.removeEventListener("online", update);
      window.removeEventListener("personIdChanged", update);
      window.removeEventListener("solenos:offline-queue-updated", update);
    };
  }, [refresh]);

  return (
    <>
      {pending > 0 && (
        <p role="status" className="daily-care-muted">
          {pending} update{pending === 1 ? "" : "s"} waiting to sync with the care record.
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

"use client";

import { useEffect, useRef, useState } from "react";
import { getCaregiverId, getPersonId, postJSON } from "@/api/client";
import {
  deliverDurableWrite,
  discardBlockedDurableWrites,
  discardDurableWrite,
  durableWriteId,
  enqueueDurableWrite,
  getDurableWriteSummary,
  hasDurableWrite,
  retryBlockedDurableWrites,
  syncDurableWrites,
} from "@/lib/offline-sync/durable-write-queue";

type CheckInKind = "same_as_usual" | "change" | "uncertain";

const OPTIONS: Array<{ value: CheckInKind; label: string; description: string }> = [
  {
    value: "same_as_usual",
    label: "About the same as usual",
    description: "Your overall impression is that today felt familiar.",
  },
  {
    value: "change",
    label: "Some things were different",
    description: "You noticed a difference, without needing to explain it now.",
  },
  {
    value: "uncertain",
    label: "It’s hard to tell",
    description: "You are not sure how to describe today.",
  },
];

const choiceStyle = (selected: boolean): React.CSSProperties => ({
  display: "block",
  width: "100%",
  minHeight: 58,
  padding: "12px 14px",
  borderRadius: 12,
  border: selected ? "2px solid #668b7b" : "1px solid var(--theme-panel-border)",
  background: selected ? "var(--theme-selected-bg)" : "var(--theme-panel-bg)",
  color: "var(--theme-panel-fg)",
  textAlign: "left",
  cursor: "pointer",
});

export default function QuickDailyCheckIn() {
  const [kind, setKind] = useState<CheckInKind | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const [reportedAt, setReportedAt] = useState<string | null>(null);
  const [pendingLocal, setPendingLocal] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [attentionCount, setAttentionCount] = useState(0);
  const [syncNotice, setSyncNotice] = useState("");
  const pendingQueueId = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    const send = async (endpoint: string, payload: unknown) => {
      const response = await postJSON(endpoint, payload) as { success?: boolean; id?: string | number };
      if (response?.success !== true || response.id === undefined || response.id === null) {
        throw new Error("The server did not confirm that this update was saved.");
      }
      return response;
    };
    const sync = async () => {
      const personId = getPersonId();
      const caregiverId = getCaregiverId();
      if (!personId || !caregiverId) return;
      try {
        const summary = await getDurableWriteSummary(personId, caregiverId);
        if (!active) return;
        setPendingCount(summary.pending);
        setAttentionCount(summary.blocked + summary.failed_recoverable);
        if (typeof navigator !== "undefined" && !navigator.onLine) return;
        const result = await syncDurableWrites({ personId, caregiverId, send });
        const afterSync = await getDurableWriteSummary(personId, caregiverId);
        if (!active) return;
        setPendingCount(afterSync.pending);
        setAttentionCount(afterSync.blocked + afterSync.failed_recoverable);
        if (afterSync.pending > 0 && typeof navigator !== "undefined" && navigator.onLine) {
          if (retryTimer) clearTimeout(retryTimer);
          retryTimer = setTimeout(sync, 5_000);
        }
        if (pendingQueueId.current) {
          const stillQueued = await hasDurableWrite(pendingQueueId.current);
          if (!stillQueued) {
            pendingQueueId.current = null;
            setPendingLocal(false);
            setIdempotencyKey(null);
            setReportedAt(null);
            setKind(null);
            setNote("");
            setSavedAt(new Date().toISOString());
          }
        }
        if (result.synced > 0) {
          setSyncNotice("A pending update has synced to the care record.");
          window.dispatchEvent(new Event("careRecordUpdated"));
        }
      } catch {
        // The encrypted queue remains available for the next online attempt.
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

  async function retryQueuedUpdates() {
    const personId = getPersonId();
    const caregiverId = getCaregiverId();
    if (!personId || !caregiverId) return;
    const send = async (endpoint: string, payload: unknown) => {
      const response = await postJSON(endpoint, payload) as { success?: boolean; id?: string | number };
      if (response?.success !== true || response.id === undefined || response.id === null) {
        throw new Error("The server did not confirm that this update was saved.");
      }
      return response;
    };
    await retryBlockedDurableWrites(personId, caregiverId);
    const result = await syncDurableWrites({ personId, caregiverId, send });
    const summary = await getDurableWriteSummary(personId, caregiverId);
    setPendingCount(summary.pending);
    setAttentionCount(summary.blocked + summary.failed_recoverable);
    if (result.synced > 0) {
      setSyncNotice("Pending updates have synced to the care record.");
      window.dispatchEvent(new Event("careRecordUpdated"));
    }
  }

  async function removeBlockedUpdates() {
    const personId = getPersonId();
    const caregiverId = getCaregiverId();
    if (!personId || !caregiverId) return;
    await discardBlockedDurableWrites(personId, caregiverId);
    const summary = await getDurableWriteSummary(personId, caregiverId);
    setPendingCount(summary.pending);
    setAttentionCount(summary.blocked + summary.failed_recoverable);
  }

  function selectKind(value: CheckInKind) {
    setKind(value);
    setError("");
    setSavedAt(null);
    setIdempotencyKey(null);
    setReportedAt(null);
    setSyncNotice("");
  }

  async function saveCheckIn() {
    if (!kind || saving) return;

    const personId = getPersonId();
    const caregiverId = getCaregiverId();
    if (!personId || !caregiverId) {
      setError("Your care session could not be verified. Reopen Daily Care before saving.");
      return;
    }

    const requestKey = idempotencyKey ?? crypto.randomUUID();
    const capturedAt = reportedAt ?? new Date().toISOString();
    setIdempotencyKey(requestKey);
    setReportedAt(capturedAt);
    setSaving(true);
    setError("");
    setSyncNotice("");

    const noteText = note.trim();
    const payload = {
      person_id: personId,
      caregiver_id: caregiverId,
      medications: [],
      vitals: [],
      scales: [],
      notes: noteText,
      quick_check_in: {
        schema_version: 1,
        kind,
        selected_areas: [],
        scope: "overall_impression_only",
        caregiver_reported_at: capturedAt,
        epistemic_status: "caregiver_reported",
        idempotency_key: requestKey,
        note: noteText || null,
      },
    };
    let queueId: string | null = null;

    try {
      try {
        queueId = await enqueueDurableWrite({
          person_id: personId,
          caregiver_id: caregiverId,
          endpoint: "/daily/log",
          idempotency_key: requestKey,
          payload,
        });
        pendingQueueId.current = queueId;
      } catch {
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          throw new Error("This device could not securely keep an offline copy. The check-in was not saved.");
        }
      }

      const send = async (endpoint: string, body: unknown) => {
        const response = await postJSON(endpoint, body) as {
          success?: boolean;
          id?: string | number;
          recorded_at?: string | null;
        };
        if (response?.success !== true || response.id === undefined || response.id === null) {
          throw new Error("The server did not confirm that this check-in was saved.");
        }
        return response;
      };
      const response = queueId
        ? await deliverDurableWrite<{ success?: boolean; id?: string | number; recorded_at?: string | null }>(queueId, send)
        : await send("/daily/log", payload);

      setSavedAt(response.recorded_at || new Date().toISOString());
      pendingQueueId.current = null;
      setPendingLocal(false);
      setPendingCount(0);
      setIdempotencyKey(null);
      setReportedAt(null);
      setKind(null);
      setNote("");
      window.dispatchEvent(new Event("careRecordUpdated"));
    } catch (cause) {
      const status = typeof cause === "object" && cause !== null && "status" in cause
        ? Number((cause as { status?: unknown }).status)
        : null;
      if (queueId) {
        setPendingLocal(true);
        const summary = await getDurableWriteSummary(personId, caregiverId).catch(() => null);
        if (summary) {
          setPendingCount(summary.pending);
          setAttentionCount(summary.blocked + summary.failed_recoverable);
        }
        if (status === 401 || status === 403) {
          setError("This check-in is encrypted on this device, but your care session must be verified before it can reach the care record.");
        } else if (status === 400 || status === 409 || status === 422) {
          setError("This check-in is kept on this device, but the server needs the update reviewed before it can be saved.");
        } else {
          setError("This check-in is encrypted and saved on this device. It has not reached the care record yet; it will sync when your connection returns.");
        }
      } else {
        const reason = cause instanceof Error ? cause.message : "";
        setError(
          reason && reason.length < 180 && !/sql|traceback|stack/i.test(reason)
            ? reason
            : "We couldn’t confirm whether this check-in was saved. Your selection is still here. Check the care record before retrying.",
        );
      }
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
        Quick check-in
      </h2>
      <p style={{ margin: "0 0 14px", color: "var(--theme-panel-muted)", lineHeight: 1.55 }}>
        How has today been? One overall impression is enough. You can leave this blank.
      </p>

      <div role="group" aria-label="Your overall impression" style={{ display: "grid", gap: 8 }}>
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={kind === option.value}
            disabled={saving || pendingLocal}
            onClick={() => selectKind(option.value)}
            style={choiceStyle(kind === option.value)}
          >
            <span style={{ display: "block", fontWeight: 700 }}>{option.label}</span>
            <span style={{ display: "block", marginTop: 3, color: "var(--theme-panel-muted)", fontSize: 13 }}>
              {option.description}
            </span>
          </button>
        ))}
      </div>

      {kind && (
        <div style={{ marginTop: 14 }}>
          <label htmlFor="daily-checkin-note" style={{ display: "block", marginBottom: 6, fontWeight: 650 }}>
            Anything you’d like to add? <span style={{ color: "var(--theme-panel-muted)", fontWeight: 400 }}>Optional</span>
          </label>
          <textarea
            id="daily-checkin-note"
            value={note}
            onChange={(event) => {
              setNote(event.target.value);
              setIdempotencyKey(null);
              setReportedAt(null);
            }}
            maxLength={2000}
            rows={3}
            placeholder="You can leave this empty."
            disabled={saving || pendingLocal}
            style={{
              display: "block",
              width: "100%",
              minHeight: 76,
              padding: 12,
              border: "1px solid var(--theme-panel-border)",
              borderRadius: 10,
              background: "var(--theme-field-bg)",
              color: "var(--theme-field-fg)",
              font: "inherit",
            }}
          />
          <button
            type="button"
            onClick={() => void saveCheckIn()}
            disabled={saving}
            className="workspace-primary"
            style={{ marginTop: 10, minHeight: 44, padding: "10px 16px", borderRadius: 9 }}
          >
            {saving ? "Saving…" : pendingLocal ? "Retry save" : "Save check-in"}
          </button>
        </div>
      )}

      {error && <p role="alert" style={{ margin: "12px 0 0", color: "var(--theme-danger-fg, #9b3434)" }}>{error}</p>}
      {pendingLocal && idempotencyKey && (
        <button
          type="button"
          onClick={() => {
            const id = durableWriteId("/daily/log", idempotencyKey);
            void discardDurableWrite(id).then(() => {
              pendingQueueId.current = null;
              setPendingLocal(false);
              setPendingCount((count) => Math.max(0, count - 1));
              setIdempotencyKey(null);
              setReportedAt(null);
              setKind(null);
              setNote("");
              setError("");
            });
          }}
          style={{ justifySelf: "start", border: 0, background: "transparent", color: "var(--theme-panel-muted)", textDecoration: "underline", cursor: "pointer" }}
        >
          Remove this pending check-in from this device
        </button>
      )}
      {pendingCount > 0 && !pendingLocal && (
        <p role="status" style={{ margin: "8px 0 0", color: "var(--theme-panel-muted)" }}>
          {pendingCount} update{pendingCount === 1 ? "" : "s"} waiting to sync with the care record.
        </p>
      )}
      {attentionCount > 0 && (
        <div style={{ display: "grid", gap: 6 }}>
          <p role="alert" style={{ margin: "8px 0 0", color: "var(--theme-danger-fg, #9b3434)" }}>
            {attentionCount} update{attentionCount === 1 ? "" : "s"} need attention and have not been saved to the care record.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" disabled={saving} onClick={() => void retryQueuedUpdates()} style={{ border: 0, background: "transparent", textDecoration: "underline", cursor: "pointer" }}>
              Retry queued updates
            </button>
            <button type="button" disabled={saving} onClick={() => void removeBlockedUpdates()} style={{ border: 0, background: "transparent", textDecoration: "underline", cursor: "pointer" }}>
              Remove updates needing attention from this device
            </button>
          </div>
        </div>
      )}
      {syncNotice && <p role="status" style={{ margin: "8px 0 0", color: "var(--theme-panel-muted)" }}>{syncNotice}</p>}
      {savedAt && (
        <p role="status" style={{ margin: "12px 0 0", color: "var(--theme-panel-muted)" }}>
          Check-in saved to the care record.
        </p>
      )}
      <p style={{ margin: "12px 0 0", color: "var(--theme-panel-muted)", fontSize: 12, lineHeight: 1.5 }}>
        This records your overall impression only. It does not confirm medicines were given or measurements were taken.
      </p>
    </section>
  );
}

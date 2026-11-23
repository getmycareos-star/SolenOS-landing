"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRightLeft, Check } from "lucide-react";
import { ensureAnonymousSession, getCaregiverId, getJSON, postJSON } from "@/api/client";
import { Button } from "@/components/ui/Button";
import { caregiverSourceText } from "@/lib/caregiver-language";

type ResponsibilityTransfer = {
  id: string;
  responsibility_type: string;
  from_caregiver_name: string;
  to_caregiver_id: string | null;
  reason?: string | null;
  status: string;
};
type PrimaryTransfer = {
  id: string;
  from_caregiver_id: string;
  from_caregiver_name: string;
  to_caregiver_id: string;
  reason?: string | null;
  status: string;
};

export function CaregiverHandoverInbox() {
  const [responsibilityTransfers, setResponsibilityTransfers] = useState<ResponsibilityTransfer[]>([]);
  const [primaryTransfers, setPrimaryTransfers] = useState<PrimaryTransfer[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [failedTransferSources, setFailedTransferSources] = useState<Array<"responsibility" | "primary">>([]);
  const loadSequenceRef = useRef(0);
  const loadedScopeRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    const requestSequence = ++loadSequenceRef.current;
    const isCurrentRequest = () => loadSequenceRef.current === requestSequence;
    setLoading(true);
    setError("");
    setFailedTransferSources(["responsibility", "primary"]);
    try {
      const session = await ensureAnonymousSession();
      if (!isCurrentRequest()) return;
      const caregiverId = session.caregiver.id || getCaregiverId();
      const personId = session.person?.id;
      if (!caregiverId || !personId) throw new Error("Caregiver account unavailable");
      const scopeKey = personId + ":" + caregiverId;
      if (loadedScopeRef.current && loadedScopeRef.current !== scopeKey) {
        setResponsibilityTransfers([]);
        setPrimaryTransfers([]);
      }
      loadedScopeRef.current = scopeKey;
      const [responsibilities, primary] = await Promise.allSettled([
        getJSON("/caregiver-access/responsibility-transfers") as Promise<ResponsibilityTransfer[]>,
        getJSON("/caregiver-access/primary-transfers") as Promise<PrimaryTransfer[]>,
      ]);
      if (!isCurrentRequest()) return;
      // A failed request must not clear requests already loaded from the other
      // source or from an earlier successful refresh.
      const failed: Array<"responsibility" | "primary"> = [];
      if (responsibilities.status === "fulfilled" && Array.isArray(responsibilities.value)) {
        setResponsibilityTransfers(responsibilities.value.filter(item => item.status === "pending" && item.to_caregiver_id === caregiverId));
      } else {
        failed.push("responsibility");
      }
      if (primary.status === "fulfilled" && Array.isArray(primary.value)) {
        setPrimaryTransfers(primary.value.filter(item => item.status === "pending" && item.to_caregiver_id === caregiverId));
      } else {
        failed.push("primary");
      }
      setFailedTransferSources(failed);
      if (failed.length > 0) {
        setError("We couldn't check all pending care handovers. Please try again.");
      }
    } catch {
      if (isCurrentRequest()) {
        setResponsibilityTransfers([]);
        setPrimaryTransfers([]);
        loadedScopeRef.current = null;
        setFailedTransferSources(["responsibility", "primary"]);
        setError("We couldn't check for pending care handovers. Please try again.");
      }
    } finally {
      if (isCurrentRequest()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const refreshForSessionChange = () => void load();
    window.addEventListener("personIdChanged", refreshForSessionChange);
    void load();
    return () => window.removeEventListener("personIdChanged", refreshForSessionChange);
  }, [load]);

  const respond = async (kind: "responsibility" | "primary", id: string, decision: "accept" | "reject") => {
    setBusy(true);
    setError("");
    try {
      await postJSON("/caregiver-access/" + (kind === "primary" ? "primary-transfers/" : "responsibility-transfers/") + encodeURIComponent(id) + "/" + decision, {});
      // Refresh the inherited care summary so the new responsibility owner and
      // primary-caregiver permissions are reflected immediately.
      window.location.reload();
    } catch {
      setError("We couldn't confirm whether your response was saved. Refresh the handover list before trying again.");
    } finally {
      setBusy(false);
    }
  };

  if (responsibilityTransfers.length === 0 && primaryTransfers.length === 0 && !error && !loading) return null;

  return (
    <section aria-labelledby="caregiver-handover-heading" className="mobile-settings-card" style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <ArrowRightLeft size={18} aria-hidden />
        <h2 id="caregiver-handover-heading" style={{ margin: 0, fontSize: "calc(17px * var(--solenos-text-scale, 1))" }}>Care responsibilities waiting for you</h2>
      </div>
      {loading && <p className="mobile-settings-hint">Checking for care handovers…</p>}
      {(responsibilityTransfers.length > 0 || primaryTransfers.length > 0) && <p className="mobile-settings-hint">Please review these requests. Your care responsibilities will not change unless you accept.</p>}
      {failedTransferSources.length > 0 && (responsibilityTransfers.length > 0 || primaryTransfers.length > 0) && <p className="mobile-settings-hint" role="status">Some requests shown here could not be refreshed and may be out of date. Refresh before responding to those requests.</p>}
      {primaryTransfers.map(item => (
        <div key={item.id} style={{ borderTop: "1px solid var(--border)", paddingTop: 12, marginTop: 10 }}>
          <strong>{caregiverSourceText(item.from_caregiver_name) || "A caregiver"} has asked you to become the main caregiver.</strong>
          {item.reason && <p className="mobile-settings-hint">{caregiverSourceText(item.reason) || "No reason was recorded."}</p>}
          <div className="mobile-settings-buttons">
            <Button type="button" variant="primary" disabled={busy || failedTransferSources.includes("primary")} onClick={() => void respond("primary", item.id, "accept")}><Check size={15} aria-hidden /> Accept</Button>
            <Button type="button" variant="secondary" disabled={busy || failedTransferSources.includes("primary")} onClick={() => void respond("primary", item.id, "reject")}>Decline</Button>
          </div>
        </div>
      ))}
      {responsibilityTransfers.map(item => (
        <div key={item.id} style={{ borderTop: "1px solid var(--border)", paddingTop: 12, marginTop: 10 }}>
          <strong>{caregiverSourceText(item.from_caregiver_name) || "A caregiver"} has asked you to take over a care responsibility.</strong>
          {item.reason && <p className="mobile-settings-hint">{caregiverSourceText(item.reason) || "No reason was recorded."}</p>}
          <div className="mobile-settings-buttons">
            <Button type="button" variant="primary" disabled={busy || failedTransferSources.includes("responsibility")} onClick={() => void respond("responsibility", item.id, "accept")}><Check size={15} aria-hidden /> Accept</Button>
            <Button type="button" variant="secondary" disabled={busy || failedTransferSources.includes("responsibility")} onClick={() => void respond("responsibility", item.id, "reject")}>Decline</Button>
          </div>
        </div>
      ))}
      {error && <div role="alert" className="mobile-settings-hint"><p>{error}</p><Button type="button" variant="secondary" disabled={loading || busy} onClick={() => void load()}>Try again</Button></div>}
    </section>
  );
}

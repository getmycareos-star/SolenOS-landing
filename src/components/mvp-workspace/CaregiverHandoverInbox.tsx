"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowRightLeft, Check } from "lucide-react";
import { ensureAnonymousSession, getCaregiverId, getJSON, postJSON } from "@/api/client";
import { Button } from "@/components/ui/Button";

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

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const session = await ensureAnonymousSession();
      const caregiverId = session.caregiver.id || getCaregiverId();
      if (!caregiverId) throw new Error("Caregiver account unavailable");
      const [responsibilities, primary] = await Promise.allSettled([
        getJSON("/caregiver-access/responsibility-transfers") as Promise<ResponsibilityTransfer[]>,
        getJSON("/caregiver-access/primary-transfers") as Promise<PrimaryTransfer[]>,
      ]);
      // A failed request must not clear requests already loaded from the other
      // source or from an earlier successful refresh.
      if (responsibilities.status === "fulfilled") {
        setResponsibilityTransfers((responsibilities.value ?? []).filter(item => item.status === "pending" && item.to_caregiver_id === caregiverId));
      }
      if (primary.status === "fulfilled") {
        setPrimaryTransfers((primary.value ?? []).filter(item => item.status === "pending" && item.to_caregiver_id === caregiverId));
      }
      if (responsibilities.status === "rejected" || primary.status === "rejected") {
        setError("We couldn't check all pending care handovers. Please try again.");
      }
    } catch {
      setError("We couldn't check for pending care handovers. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const respond = async (kind: "responsibility" | "primary", id: string, decision: "accept" | "reject") => {
    setBusy(true);
    setError("");
    try {
      await postJSON("/caregiver-access/" + (kind === "primary" ? "primary-transfers/" : "responsibility-transfers/") + encodeURIComponent(id) + "/" + decision, {});
      // Refresh the inherited care summary so the new responsibility owner and
      // primary-caregiver permissions are reflected immediately.
      window.location.reload();
    } catch {
      setError("We couldn't record your response. The existing caregiver assignment has not been changed.");
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
      {primaryTransfers.map(item => (
        <div key={item.id} style={{ borderTop: "1px solid var(--border)", paddingTop: 12, marginTop: 10 }}>
          <strong>{item.from_caregiver_name} has asked you to become the main caregiver.</strong>
          {item.reason && <p className="mobile-settings-hint">{item.reason}</p>}
          <div className="mobile-settings-buttons">
            <Button type="button" variant="primary" disabled={busy} onClick={() => void respond("primary", item.id, "accept")}><Check size={15} aria-hidden /> Accept</Button>
            <Button type="button" variant="secondary" disabled={busy} onClick={() => void respond("primary", item.id, "reject")}>Decline</Button>
          </div>
        </div>
      ))}
      {responsibilityTransfers.map(item => (
        <div key={item.id} style={{ borderTop: "1px solid var(--border)", paddingTop: 12, marginTop: 10 }}>
          <strong>{item.from_caregiver_name} has asked you to take over a care responsibility.</strong>
          {item.reason && <p className="mobile-settings-hint">{item.reason}</p>}
          <div className="mobile-settings-buttons">
            <Button type="button" variant="primary" disabled={busy} onClick={() => void respond("responsibility", item.id, "accept")}><Check size={15} aria-hidden /> Accept</Button>
            <Button type="button" variant="secondary" disabled={busy} onClick={() => void respond("responsibility", item.id, "reject")}>Decline</Button>
          </div>
        </div>
      ))}
      {error && <div role="alert" className="mobile-settings-hint"><p>{error}</p><Button type="button" variant="secondary" disabled={loading || busy} onClick={() => void load()}>Try again</Button></div>}
    </section>
  );
}
